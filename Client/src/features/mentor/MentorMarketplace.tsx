import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Gavel,
  Lightbulb,
  Rocket,
  Sparkles,
  X,
} from 'lucide-react';
import { isAxiosError } from 'axios';
import {
  mentorApi,
  MentorBid,
  MentorBidOpportunity,
  MentorBidOpportunityKind,
  SubmitMentorBidPayload,
} from '../../api/mentor.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { OptionTabs } from '../../components/ui/OptionTabs';
import { Spinner } from '../../components/ui/Spinner';

interface SubmitBidModalProps {
  opportunity: MentorBidOpportunity;
  onClose: () => void;
  onSuccess: () => void;
}

type TabKey = 'opportunities' | 'my_bids';
type KindFilter = 'all' | MentorBidOpportunityKind;

const tabLabels: Record<TabKey, string> = {
  opportunities: 'Opportunities',
  my_bids: 'My Bids',
};

const BID_STATUS_CLASSNAME: Record<MentorBid['status'], string> = {
  pending: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
  accepted: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  rejected: 'border-rose-500/20 bg-rose-500/10 text-rose-200',
  withdrawn: 'border-slate-700 bg-slate-800/80 text-slate-300',
};

const formatShortDate = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });

const formatLongDate = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const getKindConfig = (kind: MentorBidOpportunityKind) =>
  kind === 'startup'
    ? {
        label: 'Startup',
        icon: Rocket,
        accentClassName: 'text-cyan-300',
        surfaceClassName: 'bg-cyan-500/10 text-cyan-300',
      }
    : {
        label: 'Problem Bank',
        icon: Lightbulb,
        accentClassName: 'text-violet-300',
        surfaceClassName: 'bg-violet-500/10 text-violet-300',
      };

function getApiError(error: unknown) {
  if (isAxiosError<{ error?: { message?: string } }>(error)) {
    return (
      error.response?.data?.error?.message ??
      'Unable to submit your bid. Please try again.'
    );
  }

  return error instanceof Error
    ? error.message
    : 'Unable to submit your bid. Please try again.';
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof BookOpen;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[156px] flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-800 bg-slate-950/40 px-4 py-6 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-500">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  toneClassName,
  value,
}: {
  icon: typeof Rocket;
  label: string;
  toneClassName: string;
  value: number;
}) {
  return (
    <Card className="flex min-h-[116px] flex-col gap-4 rounded-[24px] border-slate-800 bg-slate-900/70 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClassName}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="space-y-1">
        <div className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{value}</div>
        <div className="text-sm text-slate-400">{label}</div>
      </div>
    </Card>
  );
}

function OpportunityCard({
  opportunity,
  onBid,
}: {
  opportunity: MentorBidOpportunity;
  onBid: () => void;
}) {
  const kind = getKindConfig(opportunity.kind);
  const KindIcon = kind.icon;
  const meta = [
    opportunity.kind === 'startup'
      ? opportunity.startupName
      : opportunity.institution ?? 'Open problem',
    opportunity.stage,
    opportunity.domain,
  ].filter(Boolean);

  return (
    <Card className="rounded-[24px] border-slate-800 bg-slate-900/70 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3.5">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kind.surfaceClassName}`}>
              <KindIcon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs font-semibold uppercase tracking-[0.26em] ${kind.accentClassName}`}>
                  {kind.label}
                </span>
                <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                  {formatShortDate(opportunity.postedAt)}
                </span>
              </div>
              <h3 className="mt-2 text-lg font-semibold text-white sm:text-xl">
                {opportunity.title}
              </h3>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {meta.map((item) => (
                  <span
                    key={`${opportunity._id}-${item}`}
                    className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-[11px] text-slate-300"
                  >
                    {item}
                  </span>
                ))}
                {typeof opportunity.sessionsRequested === 'number' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-[11px] text-slate-300">
                    <Clock3 className="h-3.5 w-3.5 text-slate-500" />
                    {opportunity.sessionsRequested} sessions
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <p className="mt-3.5 text-sm leading-6 text-slate-300">
            {opportunity.description}
          </p>

          {opportunity.preferredExpertise?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {opportunity.preferredExpertise.map((tag) => (
                <Badge
                  key={`${opportunity._id}-${tag}`}
                  className="border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-200"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2.5 lg:w-auto lg:min-w-[148px] lg:items-end lg:pl-4">
          {opportunity.hasBid ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              Bid Sent
            </div>
          ) : (
            <Button onClick={onBid} className="w-full px-4 py-2.5 lg:w-auto">
              <Gavel className="mr-1.5 h-4 w-4" />
              Submit Bid
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function BidHistoryCard({
  bid,
  onWithdraw,
  withdrawing,
}: {
  bid: MentorBid;
  onWithdraw: (bidId: string) => void;
  withdrawing: boolean;
}) {
  return (
    <Card className="rounded-[24px] border-slate-800 bg-slate-900/70 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-slate-700 bg-slate-950/80 text-slate-300">
              {bid.kind === 'startup' ? 'Startup' : 'Problem Bank'}
            </Badge>
            <span
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${BID_STATUS_CLASSNAME[bid.status]}`}
            >
              {bid.status}
            </span>
          </div>

          <h3 className="mt-2.5 text-lg font-semibold text-white">
            {bid.opportunityTitle}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{bid.expertise}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-[11px] text-slate-300">
              {bid.hoursPerWeek} hrs / week
            </span>
            <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-[11px] text-slate-300">
              {bid.proposedDurationWeeks} weeks
            </span>
            <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-[11px] text-slate-400">
              Submitted {formatLongDate(bid.createdAt)}
            </span>
          </div>
        </div>

        {bid.status === 'pending' ? (
          <Button
            variant="secondary"
            onClick={() => onWithdraw(bid._id)}
            disabled={withdrawing}
            className="w-full px-4 py-2.5 lg:w-auto"
          >
            Withdraw
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function SubmitBidModal({
  opportunity,
  onClose,
  onSuccess,
}: SubmitBidModalProps) {
  const queryClient = useQueryClient();
  const [expertise, setExpertise] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState('4');
  const [proposedDurationWeeks, setProposedDurationWeeks] = useState('8');
  const [coverNote, setCoverNote] = useState('');
  const [errors, setErrors] = useState<{
    expertise?: string;
    coverNote?: string;
  }>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: SubmitMentorBidPayload) => mentorApi.submitBid(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['mentor-bid-opportunities'],
      });
      await queryClient.invalidateQueries({ queryKey: ['mentor-my-bids'] });
      await queryClient.invalidateQueries({ queryKey: ['mentor-dashboard'] });
      onSuccess();
    },
    onError: (error) => setApiError(getApiError(error)),
  });

  const handleSubmit = () => {
    const nextErrors: typeof errors = {};

    if (!expertise.trim()) {
      nextErrors.expertise = 'Describe your relevant expertise.';
    }

    if (!coverNote.trim()) {
      nextErrors.coverNote = 'A cover note is required.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    mutation.mutate({
      opportunityId: opportunity._id,
      kind: opportunity.kind,
      expertise: expertise.trim(),
      hoursPerWeek: Math.max(1, Number(hoursPerWeek)),
      proposedDurationWeeks: Math.max(1, Number(proposedDurationWeeks)),
      coverNote: coverNote.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-[30px] border border-slate-800 bg-[#070b17] shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">
              Submit Proposal
            </div>
            <h2 className="text-xl font-bold text-white">{opportunity.title}</h2>
            <p className="text-sm text-slate-400">
              {opportunity.kind === 'startup'
                ? opportunity.startupName
                : opportunity.institution ?? 'Problem Bank'}{' '}
              · {opportunity.domain}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-900 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                Relevant Expertise <span className="text-rose-400">*</span>
              </label>
              <Input
                value={expertise}
                onChange={(event) => {
                  setExpertise(event.target.value);
                  setErrors((current) => ({
                    ...current,
                    expertise: undefined,
                  }));
                }}
                placeholder="Product strategy, AI systems, EdTech growth"
                className={errors.expertise ? 'border-rose-500' : ''}
              />
              {errors.expertise ? (
                <div className="text-xs text-rose-400">{errors.expertise}</div>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                Hours / Week
              </label>
              <select
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                value={hoursPerWeek}
                onChange={(event) => setHoursPerWeek(event.target.value)}
              >
                {[1, 2, 4, 6, 8, 10, 12, 16].map((hours) => (
                  <option key={hours} value={hours}>
                    {hours} hrs / week
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                Duration
              </label>
              <select
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                value={proposedDurationWeeks}
                onChange={(event) =>
                  setProposedDurationWeeks(event.target.value)
                }
              >
                {[2, 4, 6, 8, 12, 16, 24].map((weeks) => (
                  <option key={weeks} value={weeks}>
                    {weeks} weeks
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              Cover Note <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={coverNote}
              onChange={(event) => {
                setCoverNote(event.target.value);
                setErrors((current) => ({
                  ...current,
                  coverNote: undefined,
                }));
              }}
              rows={5}
              maxLength={800}
              placeholder="Explain why you are the right mentor, the outcome you will drive, and how you will structure the engagement."
              className={`w-full resize-none rounded-xl border bg-slate-900 px-4 py-3 text-sm leading-6 text-white placeholder:text-slate-600 outline-none transition focus:border-cyan-500 ${
                errors.coverNote ? 'border-rose-500' : 'border-slate-700'
              }`}
            />
            <div className="flex items-center justify-between text-xs">
              <span className="text-rose-400">
                {errors.coverNote ?? ''}
              </span>
              <span className="text-slate-500">{coverNote.length}/800</span>
            </div>
          </div>

          {apiError ? (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{apiError}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-800 px-6 py-4 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="w-full sm:w-auto"
          >
            {mutation.isPending ? 'Submitting...' : 'Submit Proposal'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function MentorMarketplace() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('opportunities');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [selectedOpportunity, setSelectedOpportunity] =
    useState<MentorBidOpportunity | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const opportunitiesQuery = useQuery({
    queryKey: ['mentor-bid-opportunities'],
    queryFn: mentorApi.getBidOpportunities,
    refetchInterval: 60_000,
  });

  const myBidsQuery = useQuery({
    queryKey: ['mentor-my-bids'],
    queryFn: mentorApi.getMyBids,
    refetchInterval: 60_000,
  });

  const withdrawMutation = useMutation({
    mutationFn: mentorApi.withdrawBid,
    onSuccess: async () => {
      setSuccessMessage('Bid withdrawn successfully.');
      await queryClient.invalidateQueries({ queryKey: ['mentor-my-bids'] });
      await queryClient.invalidateQueries({
        queryKey: ['mentor-bid-opportunities'],
      });
      await queryClient.invalidateQueries({ queryKey: ['mentor-dashboard'] });
    },
  });

  const opportunities = opportunitiesQuery.data ?? [];
  const myBids = myBidsQuery.data ?? [];
  const filteredOpportunities =
    kindFilter === 'all'
      ? opportunities
      : opportunities.filter((opportunity) => opportunity.kind === kindFilter);

  const startupCount = opportunities.filter(
    (opportunity) => opportunity.kind === 'startup',
  ).length;
  const problemCount = opportunities.filter(
    (opportunity) => opportunity.kind === 'problem_bank',
  ).length;
  const pendingBidCount = myBids.filter((bid) => bid.status === 'pending').length;

  return (
    <div className="space-y-4 px-4 pb-5 sm:px-6">
      <section className="space-y-3">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">
            Mentor Marketplace
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Bidding Opportunities
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
                Browse live startup and problem-bank mentorship requests, submit
                proposals with a clear engagement plan, and track everything
                from the same workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border-slate-700 bg-slate-900/70 text-slate-300">
                {opportunities.length} open requests
              </Badge>
              <Badge className="border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
                {pendingBidCount} pending bids
              </Badge>
            </div>
          </div>
        </div>

        {successMessage ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-3">
          <SummaryCard
            icon={Rocket}
            label="Startup Opportunities"
            value={startupCount}
            toneClassName="bg-cyan-500/10 text-cyan-300"
          />
          <SummaryCard
            icon={Lightbulb}
            label="Problem Bank Slots"
            value={problemCount}
            toneClassName="bg-violet-500/10 text-violet-300"
          />
          <SummaryCard
            icon={Gavel}
            label="Pending Bids"
            value={pendingBidCount}
            toneClassName="bg-amber-500/10 text-amber-300"
          />
        </div>
      </section>

      <OptionTabs
        items={(Object.keys(tabLabels) as TabKey[]).map((tabId) => ({
          id: tabId,
          label: tabLabels[tabId],
        }))}
        activeId={activeTab}
        onChange={setActiveTab}
        aria-label="Mentor marketplace tabs"
        className="-mt-1"
        listClassName="gap-4"
      />

      {activeTab === 'opportunities' ? (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {([
              { id: 'all', label: 'All' },
              { id: 'startup', label: 'Startups' },
              { id: 'problem_bank', label: 'Problem Bank' },
            ] as const).map((filter) => {
              const isActive = kindFilter === filter.id;

              return (
                <button
                  key={filter.id}
                  onClick={() => setKindFilter(filter.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300'
                      : 'border-slate-700 bg-slate-950/50 text-slate-400 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          {opportunitiesQuery.isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner />
            </div>
          ) : filteredOpportunities.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No opportunities found"
              description="There are no mentor requests in this segment right now. Check back soon for new startup and problem-bank openings."
            />
          ) : (
            <div className="space-y-3">
              {filteredOpportunities.map((opportunity) => (
                <OpportunityCard
                  key={opportunity._id}
                  opportunity={opportunity}
                  onBid={() => setSelectedOpportunity(opportunity)}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          {myBidsQuery.isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner />
            </div>
          ) : myBids.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No bids yet"
              description="You have not submitted any mentor proposals yet. Explore the live opportunities and place your first bid."
              action={
                <button
                  onClick={() => setActiveTab('opportunities')}
                  className="inline-flex items-center gap-1 text-sm font-medium text-cyan-300 hover:text-cyan-200"
                >
                  Browse opportunities <ChevronRight className="h-4 w-4" />
                </button>
              }
            />
          ) : (
            <div className="space-y-3">
              {myBids.map((bid) => (
                <BidHistoryCard
                  key={bid._id}
                  bid={bid}
                  onWithdraw={(bidId) => withdrawMutation.mutate(bidId)}
                  withdrawing={withdrawMutation.isPending}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {selectedOpportunity ? (
        <SubmitBidModal
          opportunity={selectedOpportunity}
          onClose={() => setSelectedOpportunity(null)}
          onSuccess={() => {
            setSelectedOpportunity(null);
            setSuccessMessage(
              `Proposal submitted for "${selectedOpportunity.title}".`,
            );
            setActiveTab('my_bids');
          }}
        />
      ) : null}
    </div>
  );
}
