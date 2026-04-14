import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { investorApi } from '../../api/investor.api';
import { MAX_INNOVATION_SCORE } from '../../constants/score';
import { StartupDetailDrawer } from './StartupDetailDrawer';

const categories = ['Agriculture', 'Health', 'Education', 'Energy', 'Software', 'Other'];
const stages = ['Pre-Idea', 'Ideation', 'MVP', 'Pre-Launch', 'Launched'];
const scoreRangeMin = 0;
const scoreRangeMax = MAX_INNOVATION_SCORE;

const getInvestorWorkflowErrorMessage = (error: unknown) => {
  if (isAxiosError<{ error?: { message?: string } }>(error)) {
    return error.response?.data?.error?.message ?? 'Unable to complete the investor action right now.';
  }

  return error instanceof Error ? error.message : 'Unable to complete the investor action right now.';
};

export default function StartupMarketplace() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [stage, setStage] = useState<string>('all');
  const [scoreRange, setScoreRange] = useState({ min: scoreRangeMin, max: scoreRangeMax });
  const [acceptingPenny, setAcceptingPenny] = useState(true);
  const [acceptingSole, setAcceptingSole] = useState(true);
  const [selectedStartupId, setSelectedStartupId] = useState<string | null>(null);
  const [viewedStartupIds, setViewedStartupIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const startupsQuery = useQuery({
    queryKey: ['investor-startups', { category, stage, scoreRange, acceptingPenny, acceptingSole }],
    queryFn: () =>
      investorApi.getStartups({
        category: category === 'all' ? undefined : category,
        stage: stage === 'all' ? undefined : stage,
        minScore: scoreRange.min,
        maxScore: scoreRange.max,
        acceptingPenny: acceptingPenny || undefined,
        acceptingSole: acceptingSole || undefined,
        page: 1,
        limit: 20,
      }),
    refetchInterval: 60_000,
  });

  const expressInterestMutation = useMutation({
    mutationFn: (params: {
      startupId: string;
      payload: {
        investorType: 'penny' | 'sole';
        proposedAmountINR: number;
        proposedEquityPercent: number;
        chosenRole?: 'shareholder' | 'director' | 'observer';
      };
    }) =>
      params.payload.investorType === 'sole'
        ? investorApi.expressSoleInterest(params.startupId, params.payload)
        : investorApi.expressInterest(params.startupId, params.payload),
    onSuccess: async (_, variables) => {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(`investor-interest-draft:${variables.startupId}`);
      }
      setFeedback({ type: 'success', message: 'Interest sent. The student has been notified.' });
      setSelectedStartupId(null);
      await queryClient.invalidateQueries({ queryKey: ['investor-startups'] });
      await queryClient.invalidateQueries({ queryKey: ['investor-deals'] });
      await queryClient.invalidateQueries({ queryKey: ['investor-dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['investor-portfolio'] });
    },
    onError: (error) => {
      setFeedback({ type: 'error', message: getInvestorWorkflowErrorMessage(error) });
    },
  });

  useEffect(() => {
    const highlightedStartupId =
      typeof (location.state as { highlightStartupId?: unknown } | null)?.highlightStartupId === 'string'
        ? ((location.state as { highlightStartupId: string }).highlightStartupId)
        : null;

    if (!highlightedStartupId) {
      return;
    }

    setFeedback(null);
    setViewedStartupIds((current) => new Set(current).add(highlightedStartupId));
    setSelectedStartupId(highlightedStartupId);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);

  const startups = useMemo(
    () =>
      (startupsQuery.data?.items ?? []).filter((startup) =>
        `${startup.name} ${startup.category} ${startup.founder?.displayName ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [search, startupsQuery.data?.items],
  );

  const openStartup = (startupId: string) => {
    setFeedback(null);
    setViewedStartupIds((current) => new Set(current).add(startupId));
    setSelectedStartupId(startupId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Startup Marketplace</h1>
          <p className="mt-2 text-slate-400">
            Ready to invest? Browse startups, review founder scores, and express your interest.
          </p>
        </div>
        <div className="w-full max-w-md">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search startups or founders"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
        <span className="font-medium text-cyan-300">Express Interest</span>
        <span className="text-slate-600">&rarr;</span>
        <span>Start Negotiating</span>
        <span className="text-slate-600">&rarr;</span>
        <span>Due Diligence</span>
        <span className="text-slate-600">&rarr;</span>
        <span>Close Deal</span>
      </div>

      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
              : 'border border-red-500/30 bg-red-500/10 text-red-200'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <Card className="grid gap-4 p-5 lg:grid-cols-4">
        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Category</div>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
          >
            <option value="all">All categories</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Stage</div>
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
          >
            <option value="all">All stages</option>
            {stages.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.2em] text-slate-400">
            <span>Score range</span>
            <span className="text-slate-300">
              {scoreRange.min} - {scoreRange.max}
            </span>
          </div>
          <div className="space-y-3">
            <Input
              aria-label="Minimum innovation score"
              type="range"
              min={scoreRangeMin}
              max={scoreRangeMax}
              value={scoreRange.min}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                setScoreRange((current) => ({ ...current, min: Math.min(nextValue, current.max) }));
              }}
            />
            <Input
              aria-label="Maximum innovation score"
              type="range"
              min={scoreRangeMin}
              max={scoreRangeMax}
              value={scoreRange.max}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                setScoreRange((current) => ({ ...current, max: Math.max(nextValue, current.min) }));
              }}
            />
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Show Startups Accepting</div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={acceptingPenny}
                onChange={(event) => setAcceptingPenny(event.target.checked)}
              />
              Penny Investors
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={acceptingSole}
                onChange={(event) => setAcceptingSole(event.target.checked)}
              />
              Sole Investor
            </label>
          </div>
        </div>
      </Card>

      {startupsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : startupsQuery.isError ? (
        <Card className="p-6 text-sm text-red-200">
          {getInvestorWorkflowErrorMessage(startupsQuery.error)}
        </Card>
      ) : startups.length === 0 ? (
        <Card className="p-6 text-sm text-slate-400">
          No startups match the current investor filters.
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {startups.map((startup) => {
            const canExpressInterest = viewedStartupIds.has(startup._id);
            const liveScore = startup.founder?.innovationScore ?? startup.innovationScoreAtLaunch;

            return (
              <Card key={startup._id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xl font-semibold text-white">{startup.name}</div>
                    <div className="mt-1 text-sm text-cyan-300">{startup.category}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-400">{startup.tagline}</div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">
                      {startup.founder?.displayName ?? 'Founding team'} is currently at {liveScore}/{MAX_INNOVATION_SCORE}.
                      <span className="ml-2 text-slate-500">
                        Launch snapshot: {startup.innovationScoreAtLaunch}/{MAX_INNOVATION_SCORE}.
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge>{startup.stage}</Badge>
                    <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      Live score {liveScore}/{MAX_INNOVATION_SCORE}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {startup.traction.patentFiled ? <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Patent filed</Badge> : null}
                  {startup.traction.mvpBuilt ? <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">MVP ready</Badge> : null}
                  {startup.traction.revenueGenerating ? <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">Revenue generating</Badge> : null}
                  <Badge className="border-slate-700 bg-slate-900 text-slate-300">Team {startup.teamSize}</Badge>
                  {startup.acceptsPennyInvestors ? (
                    <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">Accepting Penny Investors</Badge>
                  ) : (
                    <Badge className="border-slate-700 bg-slate-900 text-slate-400">No Penny Investors</Badge>
                  )}
                  {startup.acceptsSoleInvestor ? (
                    <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">Accepting Sole Investor</Badge>
                  ) : (
                    <Badge className="border-slate-700 bg-slate-900 text-slate-400">No Sole Investor</Badge>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => openStartup(startup._id)}>
                    View Pitch
                  </Button>
                  <Button
                    onClick={() => openStartup(startup._id)}
                  >
                    Express Interest
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <StartupDetailDrawer
        startupId={selectedStartupId}
        open={Boolean(selectedStartupId)}
        canExpressInterest={Boolean(selectedStartupId && viewedStartupIds.has(selectedStartupId))}
        isExpressingInterest={expressInterestMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStartupId(null);
          }
        }}
        onExpressInterest={(startupId, payload) => {
          setViewedStartupIds((current) => new Set(current).add(startupId));
          setFeedback(null);
          expressInterestMutation.mutate({ startupId, payload });
        }}
      />
    </div>
  );
}
