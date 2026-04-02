import { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BriefcaseBusiness,
  ExternalLink,
  Globe,
  Linkedin,
  MessageCircle,
  Rocket,
  Search,
  Send,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { dmApi } from '../../api/dm.api';
import { marketplaceApi, MarketplaceProfile } from '../../api/marketplace.api';
import { dealApi } from '../../api/deal.api';
import { startupApi } from '../../api/startup.api';
import { InvestorProposalModal } from '../../components/messaging/InvestorProposalModal';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../utils/apiError';
import { getStartupSectionPath, normalizeStartupRouteId } from './navigation';

const getInvestorSearchText = (profile: MarketplaceProfile) =>
  [profile.displayName, profile.domain, profile.headline, profile.location, profile.bio]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const getFirstContactKey = (investorId: string, currentUserId?: string) =>
  currentUserId ? `dm_first_contact_${investorId}_${currentUserId}` : `dm_first_contact_${investorId}`;

const markInvestorContactStarted = (investorId: string, currentUserId?: string) => {
  localStorage.setItem(getFirstContactKey(investorId, currentUserId), 'true');
  localStorage.setItem(`dm_first_contact_${investorId}`, 'true');
};

const countsLabel = (profile: MarketplaceProfile) => [
  `${profile.insightCounts.experience} experience`,
  `${profile.insightCounts.portfolioProjects} projects`,
  `${profile.insightCounts.skills} skills`,
].join(' · ');

export function InvestorOutreach() {
  const navigate = useNavigate();
  const { startupId } = useParams<{ startupId: string }>();
  const normalizedStartupId = normalizeStartupRouteId(startupId);
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?._id);
  const [search, setSearch] = useState('');
  const [selectedInvestor, setSelectedInvestor] = useState<MarketplaceProfile | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const startupQuery = useQuery({
    queryKey: ['startup', normalizedStartupId],
    queryFn: () => startupApi.getById(normalizedStartupId!),
    enabled: Boolean(normalizedStartupId),
  });

  const dealsQuery = useQuery({
    queryKey: ['student', 'active-deals'],
    queryFn: dealApi.getMyDeals,
    refetchInterval: 60_000,
  });

  const investorsQuery = useQuery({
    queryKey: ['marketplace', 'startup-launch', 'investors'],
    queryFn: () => marketplaceApi.list('investor', { limit: 50 }),
    staleTime: 60_000,
  });

  const sendPitchMutation = useMutation({
    mutationFn: async ({
      investorId,
      message,
    }: {
      investorId: string;
      message: string;
    }) => dmApi.send(investorId, { message, messageType: 'text', queryType: 'investor' }),
    onSuccess: async (_message, variables) => {
      markInvestorContactStarted(variables.investorId, currentUserId);
      setFeedback({
        tone: 'success',
        message: 'Pitch request sent. Continue the investor conversation in Messages.',
      });
      setSelectedInvestor(null);
      await queryClient.invalidateQueries({ queryKey: ['dm', 'conversations'] });
      navigate(`/dashboard/messages/${variables.investorId}`);
    },
    onError: (error) => {
      setFeedback({
        tone: 'error',
        message: getApiErrorMessage(error, 'Unable to send the pitch request right now.'),
      });
    },
  });

  const investors = useMemo(() => {
    const items = investorsQuery.data ?? [];

    if (!deferredSearch) {
      return items;
    }

    return items.filter((profile) => getInvestorSearchText(profile).includes(deferredSearch));
  }, [deferredSearch, investorsQuery.data]);

  const startup = startupQuery.data;
  const deals = dealsQuery.data?.items ?? [];
  const activeDeals = deals.filter((deal) => deal.status === 'active');
  const canPitchFromStartup =
    Boolean(startup?.name?.trim() && startup?.tagline?.trim() && startup?.category?.trim()) ||
    false;
  const hasStartup = Boolean(normalizedStartupId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Investor Outreach</h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Launch your startup profile, shortlist investors, send pitch requests, and continue the
            conversation in one workflow. Investor deal creation still happens when an investor
            accepts and expresses interest from their side.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate(getStartupSectionPath(normalizedStartupId!, 'overview'))}
            disabled={!hasStartup}
          >
            <Rocket className="mr-2 h-4 w-4" />
            Launch Overview
          </Button>
          <Button
            onClick={() => navigate(getStartupSectionPath(normalizedStartupId!, 'investor-deals'))}
            disabled={!hasStartup}
          >
            <BriefcaseBusiness className="mr-2 h-4 w-4" />
            Investor Deals
          </Button>
        </div>
      </div>

      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            feedback.tone === 'success'
              ? 'border border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
              : 'border border-red-500/30 bg-red-500/10 text-red-200'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="p-5">
          <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">Startup Profile</div>
          <div className="mt-3 text-2xl font-bold text-white">
            {startup?.name?.trim() ? 'Ready' : 'Draft'}
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {startup?.name?.trim()
              ? `${startup.name} is available as your pitch source.`
              : 'Create your startup profile on the Overview tab first.'}
          </p>
        </Card>

        <Card className="p-5">
          <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">Investor Launch</div>
          <div className="mt-3 text-2xl font-bold text-white">
            {startup?.launchedToInvestors ? 'Live' : 'Pending'}
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {startup?.launchedToInvestors
              ? 'Investors can now discover you in their marketplace.'
              : 'You can still send pitch requests, but launch to investors to appear in investor discovery.'}
          </p>
        </Card>

        <Card className="p-5">
          <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">Pitch Deck</div>
          <div className="mt-3 text-2xl font-bold text-white">
            {startup?.pitchDeckUrl ? 'Uploaded' : 'Missing'}
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {startup?.pitchDeckUrl
              ? 'Pitch requests can include your deck automatically.'
              : 'Upload a pitch deck on the Overview tab to strengthen investor outreach.'}
          </p>
        </Card>

        <Card className="p-5">
          <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">Active Deals</div>
          <div className="mt-3 text-2xl font-bold text-white">{activeDeals.length}</div>
          <p className="mt-2 text-sm text-slate-400">
            Formal investor interest and deal-stage progress will appear in Investor Deals.
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="grid gap-6 border-b border-slate-800 px-6 py-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
              <Sparkles className="h-4 w-4" />
              Outreach Workflow
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>1. Build and save the startup profile on the Overview tab.</p>
              <p>2. Launch to investors so your startup appears inside the investor dashboard.</p>
              <p>3. Shortlist investors here and send either a direct message or a structured pitch request.</p>
              <p>4. Continue the conversation in Messages. If the investor is interested, they create formal deal interest from their investor workflow.</p>
            </div>
          </div>
          <div className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-slate-900 to-slate-900 p-5">
            <div className="text-sm font-semibold text-white">Current readiness</div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-4">
                <span>Startup profile saved</span>
                <span className={startup?.name?.trim() ? 'text-emerald-300' : 'text-amber-300'}>
                  {startup?.name?.trim() ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Launched to investors</span>
                <span className={startup?.launchedToInvestors ? 'text-emerald-300' : 'text-amber-300'}>
                  {startup?.launchedToInvestors ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Pitch deck attached</span>
                <span className={startup?.pitchDeckUrl ? 'text-emerald-300' : 'text-amber-300'}>
                  {startup?.pitchDeckUrl ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search investors by name, domain, bio, or focus area"
              className="pl-11"
            />
          </div>
        </div>
      </Card>

      {startupQuery.isLoading || investorsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : startupQuery.isError ? (
        <Card className="p-6 text-sm text-red-200">
          {getApiErrorMessage(startupQuery.error, 'Unable to load this startup right now.')}
        </Card>
      ) : investorsQuery.isError ? (
        <Card className="p-6 text-sm text-red-200">
          {getApiErrorMessage(investorsQuery.error, 'Unable to load investors right now.')}
        </Card>
      ) : investors.length === 0 ? (
        <Card className="p-6 text-sm text-slate-400">
          No investors match the current search.
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {investors.map((investor) => (
            <Card key={investor._id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-lg font-bold text-white">
                    {investor.avatar ? (
                      <img
                        src={investor.avatar}
                        alt={investor.displayName}
                        className="h-14 w-14 rounded-2xl object-cover"
                      />
                    ) : (
                      investor.displayName.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold text-white">{investor.displayName}</h3>
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                        Investor
                      </span>
                    </div>
                    {investor.headline ? (
                      <p className="mt-2 text-sm text-slate-200">{investor.headline}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                      <span className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1.5">
                        {investor.domain ?? 'General innovation investing'}
                      </span>
                      {investor.location ? (
                        <span className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1.5">
                          {investor.location}
                        </span>
                      ) : null}
                      <span className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1.5">
                        {countsLabel(investor)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {investor.bio ?? 'This investor has not added a public bio yet.'}
                    </p>

                    {investor.links ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {investor.links.websiteUrl ? (
                          <a
                            href={investor.links.websiteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-500/40 hover:text-white"
                          >
                            <Globe className="h-3.5 w-3.5" />
                            Website
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        {investor.links.linkedinUrl ? (
                          <a
                            href={investor.links.linkedinUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-500/40 hover:text-white"
                          >
                            <Linkedin className="h-3.5 w-3.5" />
                            LinkedIn
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => {
                      setFeedback(null);
                      setSelectedInvestor(investor);
                    }}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Send Pitch
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      markInvestorContactStarted(investor._id, currentUserId);
                      navigate(`/dashboard/messages/${investor._id}`);
                    }}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Open Chat
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <InvestorProposalModal
        isOpen={Boolean(selectedInvestor)}
        onClose={() => setSelectedInvestor(null)}
        onSend={(message) => {
          if (!selectedInvestor) {
            return;
          }

          sendPitchMutation.mutate({
            investorId: selectedInvestor._id,
            message,
          });
        }}
        recipientName={selectedInvestor?.displayName ?? 'Investor'}
        isStudent={true}
        preferredStartupId={normalizedStartupId}
      />

      {!canPitchFromStartup ? (
        <Card className="border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-amber-100">
          Save a startup profile on the Overview tab first. You can still use Product Workspace
          projects as a pitch source, but a saved startup profile makes investor outreach and
          launch visibility much cleaner.
        </Card>
      ) : null}
    </div>
  );
}
