import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { investorApi } from '../../api/investor.api';
import { StartupDetailDrawer } from './StartupDetailDrawer';

const categories = ['Agriculture', 'Health', 'Education', 'Energy', 'Software', 'Other'];
const stages = ['Pre-Idea', 'Ideation', 'MVP', 'Pre-Launch', 'Launched'];

const getInvestorWorkflowErrorMessage = (error: unknown) => {
  if (isAxiosError<{ error?: { message?: string } }>(error)) {
    return error.response?.data?.error?.message ?? 'Unable to complete the investor action right now.';
  }

  return error instanceof Error ? error.message : 'Unable to complete the investor action right now.';
};

export default function StartupMarketplace() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [stage, setStage] = useState<string>('all');
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(200);
  const [acceptingPenny, setAcceptingPenny] = useState(true);
  const [acceptingSole, setAcceptingSole] = useState(true);
  const [selectedStartupId, setSelectedStartupId] = useState<string | null>(null);
  const [viewedStartupIds, setViewedStartupIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const startupsQuery = useQuery({
    queryKey: ['investor-startups', { category, stage, minScore, maxScore, acceptingPenny, acceptingSole }],
    queryFn: () =>
      investorApi.getStartups({
        category: category === 'all' ? undefined : category,
        stage: stage === 'all' ? undefined : stage,
        minScore,
        maxScore,
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
    onSuccess: async () => {
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
          <p className="mt-2 text-slate-400">Browse startups and review full profiles before engaging.</p>
        </div>
        <div className="w-full max-w-md">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search startups or founders"
          />
        </div>
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

        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">
            Min score {minScore}
          </div>
          <Input
            type="range"
            min={0}
            max={200}
            value={minScore}
            onChange={(event) => setMinScore(Number(event.target.value))}
          />
        </div>

        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">
            Max score {maxScore}
          </div>
          <Input
            type="range"
            min={0}
            max={200}
            value={maxScore}
            onChange={(event) => setMaxScore(Number(event.target.value))}
          />
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
                      {startup.founder?.displayName ?? 'Founding team'} is currently at {liveScore}/200.
                      <span className="ml-2 text-slate-500">
                        Launch snapshot: {startup.innovationScoreAtLaunch}/200.
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge>{startup.stage}</Badge>
                    <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      Live score {liveScore}/200
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {startup.traction.patentFiled ? <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Patent filed</Badge> : null}
                  {startup.traction.mvpBuilt ? <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">MVP ready</Badge> : null}
                  {startup.traction.revenueGenerating ? <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">Revenue generating</Badge> : null}
                  <Badge className="border-slate-700 bg-slate-900 text-slate-300">Team {startup.teamSize}</Badge>
                  {startup.acceptsPennyInvestors ? (
                    <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">Accepting Penny</Badge>
                  ) : null}
                  {startup.acceptsSoleInvestor ? (
                    <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">Accepting Sole</Badge>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => openStartup(startup._id)}>
                    View Pitch
                  </Button>
                  <Button
                    title="Open the full profile to choose investor type and submit your proposal"
                    disabled={!canExpressInterest || expressInterestMutation.isPending}
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
