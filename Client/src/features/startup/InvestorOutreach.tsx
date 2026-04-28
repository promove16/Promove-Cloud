import { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ExternalLink,
  Globe,
  Linkedin,
  MessageCircle,
  Search,
  Send,
} from 'lucide-react';
import { dmApi } from '../../api/dm.api';
import { marketplaceApi, MarketplaceProfile } from '../../api/marketplace.api';
import { dealApi } from '../../api/deal.api';
import { startupApi } from '../../api/startup.api';
import { InvestorProposalModal } from '../../components/messaging/InvestorProposalModal';
import type { InvestorProposalPayload } from '../../components/messaging/InvestorProposalModal';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../utils/apiError';
import { normalizeStartupRouteId } from './navigation';
import { isStartupFounder } from './startupAccess';

const getInvestorSearchText = (profile: MarketplaceProfile) =>
  [
    profile.displayName,
    profile.domain,
    profile.headline,
    profile.location,
    profile.bio,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const getFirstContactKey = (investorId: string, currentUserId?: string) =>
  currentUserId
    ? `dm_first_contact_${investorId}_${currentUserId}`
    : `dm_first_contact_${investorId}`;

const markInvestorContactStarted = (
  investorId: string,
  currentUserId?: string,
) => {
  localStorage.setItem(getFirstContactKey(investorId, currentUserId), 'true');
  localStorage.setItem(`dm_first_contact_${investorId}`, 'true');
};

const countsLabel = (profile: MarketplaceProfile) =>
  [
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
  const [selectedInvestor, setSelectedInvestor] =
    useState<MarketplaceProfile | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const startupQuery = useQuery({
    queryKey: ['startup', normalizedStartupId],
    queryFn: () => startupApi.getById(normalizedStartupId!),
    enabled: Boolean(normalizedStartupId),
  });

  const startup = startupQuery.data;
  const isFounder = isStartupFounder(startup, currentUserId);

  const dealsQuery = useQuery({
    queryKey: ['student', 'active-deals'],
    queryFn: dealApi.getMyDeals,
    enabled: isFounder,
    refetchInterval: 60_000,
  });

  const investorsQuery = useQuery({
    queryKey: ['marketplace', 'startup-launch', 'investors'],
    queryFn: () => marketplaceApi.list('investor', { limit: 50 }),
    enabled: isFounder,
    staleTime: 60_000,
  });

  const sendPitchMutation = useMutation({
    mutationFn: async ({
      investorId,
      payload,
    }: {
      investorId: string;
      payload: InvestorProposalPayload;
    }) =>
      dmApi.send(investorId, {
        message: payload.message,
        messageType: 'text',
        queryType: 'investor',
        pitchContext: {
          ...(payload.startupId ? { startupId: payload.startupId } : {}),
          ...(payload.workspaceId ? { workspaceId: payload.workspaceId } : {}),
        },
      }),
    onSuccess: async (_message, variables) => {
      markInvestorContactStarted(variables.investorId, currentUserId);
        setFeedback({
          tone: 'success',
          message:
          'Investor outreach sent. Continue the conversation in Messages.',
        });
      setSelectedInvestor(null);
      await queryClient.invalidateQueries({
        queryKey: ['dm', 'conversations'],
      });
      navigate(`/dashboard/messages/${variables.investorId}`);
    },
    onError: (error) => {
      setFeedback({
        tone: 'error',
        message: getApiErrorMessage(
          error,
          'Unable to send the investor outreach right now.',
        ),
      });
    },
  });

  const investors = useMemo(() => {
    const items = investorsQuery.data ?? [];

    if (!deferredSearch) {
      return items;
    }

    return items.filter((profile) =>
      getInvestorSearchText(profile).includes(deferredSearch),
    );
  }, [deferredSearch, investorsQuery.data]);

  const deals = (dealsQuery.data?.items ?? []).filter((deal) =>
    normalizedStartupId ? deal.startupId === normalizedStartupId : true,
  );
  const activeDeals = deals.filter((deal) => deal.status === 'active');
  const canPitchFromStartup =
    Boolean(
      startup?.name?.trim() &&
      startup?.tagline?.trim() &&
      startup?.category?.trim(),
    ) || false;
  return (
    <div className="space-y-6">
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

      {startupQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : startupQuery.isError ? (
        <Card className="p-6 text-sm text-red-200">
          {getApiErrorMessage(
            startupQuery.error,
            'Unable to load this startup right now.',
          )}
        </Card>
      ) : startup && !isFounder ? (
        <Card className="max-w-4xl border border-amber-500/20 bg-amber-500/5 p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200">
            Founder-managed area
          </div>
          <h2 className="mt-3 text-xl font-bold text-white">
            Investor outreach is managed by the startup creator or founders.
          </h2>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-4">
            <Card className="p-5">
              <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">
                Startup Profile
              </div>
              <div className="mt-3 text-2xl font-bold text-white">
                {startup?.name?.trim() ? 'Ready' : 'Draft'}
              </div>
            </Card>

            <Card className="p-5">
              <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">
                Investor Launch
              </div>
              <div className="mt-3 text-2xl font-bold text-white">
                {startup?.launchedToInvestors ? 'Live' : 'Pending'}
              </div>
            </Card>

            <Card className="p-5">
              <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">
                Pitch Deck
              </div>
              <div className="mt-3 text-2xl font-bold text-white">
                {startup?.pitchDeckUrl ? 'Uploaded' : 'Missing'}
              </div>
            </Card>

            <Card className="p-5">
              <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">
                Active Deals
              </div>
              <div className="mt-3 text-2xl font-bold text-white">
                {activeDeals.length}
              </div>
            </Card>
          </div>
          <Card className="overflow-hidden p-0">
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

          {investorsQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : investorsQuery.isError ? (
            <Card className="p-6 text-sm text-red-200">
              {getApiErrorMessage(
                investorsQuery.error,
                'Unable to load investors right now.',
              )}
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
                          <h3 className="text-xl font-semibold text-white">
                            {investor.displayName}
                          </h3>
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                            Investor
                          </span>
                        </div>
                        {investor.headline ? (
                          <p className="mt-2 text-sm text-slate-200">
                            {investor.headline}
                          </p>
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
                          {investor.bio ??
                            'This investor has not added a public bio yet.'}
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
                          markInvestorContactStarted(
                            investor._id,
                            currentUserId,
                          );
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
            onSend={(payload) => {
              if (!selectedInvestor) {
                return;
              }

              sendPitchMutation.mutate({
                investorId: selectedInvestor._id,
                payload,
              });
            }}
            recipientName={selectedInvestor?.displayName ?? 'Investor'}
            isStudent={true}
            preferredStartupId={normalizedStartupId}
          />

          {!canPitchFromStartup ? (
            <Card className="border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-amber-100">
              Save a startup profile first.
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
