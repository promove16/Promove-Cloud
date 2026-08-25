import { Fragment, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Coins,
  ExternalLink,
  FileText,
  FolderKanban,
  History,
  Package,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { adminApi, AdminStartupReviewItem } from '../../api/admin.api';
import { AdminPageHeader } from './AdminPageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import {
  StartupInitializationProfile,
  StartupRegistrationProfile,
  StartupReviewStatus,
} from '../../types/startup.types';
import {
  DEFAULT_STARTUP_INIT_PROFILE,
  DEFAULT_STARTUP_IPR_PROFILE,
  STARTUP_INIT_QUESTION_LABELS,
  STARTUP_IPR_QUESTION_LABELS,
  formatStartupInitValue,
  formatStartupIprValue,
} from '../startup/iprIntake';

const reviewTone: Record<StartupReviewStatus, string> = {
  draft: 'border-slate-700 bg-slate-900 text-slate-300',
  review_requested: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  changes_requested: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
};

const statusDot: Record<StartupReviewStatus, string> = {
  draft: 'bg-slate-500',
  review_requested: 'bg-amber-400',
  changes_requested: 'bg-rose-400',
  approved: 'bg-emerald-400',
};

const statusOptions: Array<{ value: StartupReviewStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All startups' },
  { value: 'review_requested', label: 'Pending review' },
  { value: 'changes_requested', label: 'Changes requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'draft', label: 'Drafts' },
];

const getErrorMessage = (error: unknown) => {
  if (isAxiosError<{ error?: { message?: string } }>(error)) {
    return error.response?.data?.error?.message ?? 'Unable to update startup review right now.';
  }

  return error instanceof Error ? error.message : 'Unable to update startup review right now.';
};

const fallbackReadiness: AdminStartupReviewItem['readiness'] = {
  isReviewReady: false,
  missingItems: [],
  requiredDocumentCategories: [],
  uploadedDocumentCategories: [],
};

const fallbackTraction: AdminStartupReviewItem['traction'] = {
  patentFiled: false,
  mvpBuilt: false,
  revenueGenerating: false,
};

const startupInitializationTextKeys: Array<keyof StartupInitializationProfile> = [
  'vision',
  'mission',
  'foundingStory',
  'teamComposition',
  'productOverview',
  'customerProfile',
  'marketOpportunity',
  'pricingStrategy',
  'competitiveLandscape',
  'defensibleMoat',
  'currentTraction',
  'upcomingMilestones',
  'fundingAsk',
  'risksAndMitigation',
];

const startupRegistrationTextKeys: Array<keyof StartupRegistrationProfile> = [
  'problemStatement',
  'solutionDifferentiation',
  'coreInnovation',
  'priorArtStatus',
  'workingMechanism',
  'keyComponents',
  'documentationReadiness',
  'developmentContext',
  'targetMarkets',
  'publicDisclosureStatus',
  'legalAgreements',
];

const hasTextValue = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

const hasStartupInitializationNarrative = (profile: StartupInitializationProfile) =>
  startupInitializationTextKeys.some((key) => hasTextValue(profile[key]));

const countTextAnswers = <T extends Record<string, unknown>>(profile: T, keys: Array<keyof T>) =>
  keys.filter((key) => hasTextValue(profile[key])).length;

const formatOptionalValue = (value: string) => {
  const trimmed = value.trim();
  return trimmed || 'Not provided';
};

const formatINR = (value?: number) =>
  typeof value === 'number' ? `₹${value.toLocaleString('en-IN')}` : '—';

const formatAuditAction = (value: string) =>
  value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (character) => character.toUpperCase());

const dealStatusTone: Record<'active' | 'closed' | 'cancelled', string> = {
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  closed: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  cancelled: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

const formatReviewStatusLabel = (value?: string | null) => (value ?? 'draft').replace(/_/g, ' ');

const formatDocumentCategoryLabel = (value?: string | null) => (value ?? 'other').replace(/_/g, ' ');

const formatRelative = (iso?: string | null) => {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN');
};

const getReviewedLabel = (
  startup: Pick<Partial<AdminStartupReviewItem>, 'reviewStatus' | 'adminReviewedAt'>,
) => {
  const reviewStatus = startup.reviewStatus ?? 'draft';

  if (startup.adminReviewedAt) {
    return new Date(startup.adminReviewedAt).toLocaleString('en-IN');
  }

  if (reviewStatus === 'review_requested') {
    return 'Pending';
  }

  if (reviewStatus === 'changes_requested') {
    return 'Changes requested';
  }

  if (reviewStatus === 'approved') {
    return 'Approved';
  }

  return 'Not started';
};

const needsApprovalDecision = (startup: Pick<AdminStartupReviewItem, 'reviewStatus'>) =>
  startup.reviewStatus === 'review_requested';

type NormalizedStartup = ReturnType<typeof normalizeStartup>;

function normalizeStartup(startup: AdminStartupReviewItem) {
  return {
    ...startup,
    reviewStatus: startup.reviewStatus ?? 'draft',
    stage: startup.stage?.trim() || 'Unknown stage',
    category: startup.category?.trim() || 'Uncategorized',
    tagline: startup.tagline?.trim() || 'No tagline provided.',
    founders: Array.isArray(startup.founders)
      ? startup.founders.map((founder) => ({
          ...founder,
          displayName: founder.displayName?.trim() || 'Unnamed founder',
        }))
      : [],
    registrationProfile: {
      ...DEFAULT_STARTUP_IPR_PROFILE,
      ...(startup.registrationProfile ?? {}),
    },
    initializationProfile: {
      ...DEFAULT_STARTUP_INIT_PROFILE,
      ...(startup.initializationProfile ?? {}),
    },
    readiness: {
      ...fallbackReadiness,
      ...(startup.readiness ?? {}),
      missingItems: startup.readiness?.missingItems ?? [],
      requiredDocumentCategories: startup.readiness?.requiredDocumentCategories ?? [],
      uploadedDocumentCategories: startup.readiness?.uploadedDocumentCategories ?? [],
    },
    documents: Array.isArray(startup.documents) ? startup.documents : [],
    traction: {
      ...fallbackTraction,
      ...(startup.traction ?? {}),
    },
  };
}

function Section({
  title,
  icon,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-900/60"
      >
        <span className="flex items-center gap-2.5 text-sm font-semibold text-slate-200">
          <span className="text-cyan-300">{icon}</span>
          {title}
          {typeof count === 'number' ? (
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400">
              {count}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? <div className="border-t border-slate-800 px-4 py-4">{children}</div> : null}
    </div>
  );
}

export default function Startups() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const focusedStartupId = searchParams.get('startupId')?.trim() ?? '';
  const [status, setStatus] = useState<StartupReviewStatus | 'all'>('all');
  const [feedback, setFeedback] = useState<{ message: string; tone: 'info' | 'error' } | null>(
    null,
  );
  const [notesByStartup, setNotesByStartup] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string>('');

  const startupsQuery = useQuery({
    queryKey: ['admin-startup-reviews', status],
    queryFn: () => adminApi.getStartupReviews(status === 'all' ? undefined : { status }),
    refetchInterval: 60_000,
  });

  const reviewMutation = useMutation({
    mutationFn: (params: {
      startupId: string;
      payload: { decision: 'approved' | 'changes_requested'; adminNotes?: string };
    }) => adminApi.reviewStartup(params.startupId, params.payload),
    onSuccess: async () => {
      setFeedback({ message: 'Startup review updated.', tone: 'info' });
      await queryClient.invalidateQueries({ queryKey: ['admin-startup-reviews'] });
    },
    onError: (error) => {
      setFeedback({ message: getErrorMessage(error), tone: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (startupId: string) => adminApi.deleteStartup(startupId),
    onSuccess: async () => {
      setFeedback({ message: 'Startup deleted.', tone: 'info' });
      setConfirmDeleteId('');
      setSelectedId('');
      await queryClient.invalidateQueries({ queryKey: ['admin-startup-reviews'] });
    },
    onError: (error) => {
      setFeedback({ message: getErrorMessage(error), tone: 'error' });
    },
  });

  const startups = useMemo(() => {
    const items = (startupsQuery.data ?? []).map(normalizeStartup);

    if (!focusedStartupId) {
      return items;
    }

    return [...items].sort((left, right) => {
      const leftFocused = left._id === focusedStartupId ? 1 : 0;
      const rightFocused = right._id === focusedStartupId ? 1 : 0;
      return rightFocused - leftFocused;
    });
  }, [focusedStartupId, startupsQuery.data]);

  const pendingCount = useMemo(
    () => startups.filter((startup) => startup.reviewStatus === 'review_requested').length,
    [startups],
  );

  // Keep a valid startup selected as the data and filters change.
  useEffect(() => {
    if (startups.length === 0) {
      setSelectedId('');
      return;
    }

    setSelectedId((current) => {
      if (current && startups.some((startup) => startup._id === current)) {
        return current;
      }
      if (focusedStartupId && startups.some((startup) => startup._id === focusedStartupId)) {
        return focusedStartupId;
      }
      return startups[0]._id;
    });
  }, [startups, focusedStartupId]);

  const selected = useMemo(
    () => startups.find((startup) => startup._id === selectedId) ?? null,
    [startups, selectedId],
  );

  // Full related-data record (investors, funds, market reach, audit trail) for the selected startup.
  const recordQuery = useQuery({
    queryKey: ['admin-startup-record', selectedId],
    queryFn: () => adminApi.getStartupRecord(selectedId),
    enabled: Boolean(selectedId),
    refetchInterval: 60_000,
  });
  const record = recordQuery.data ?? null;

  const handleReview = (
    startup: NormalizedStartup,
    decision: 'approved' | 'changes_requested',
  ) => {
    const adminNotes = notesByStartup[startup._id]?.trim();

    if (decision === 'approved' && !startup.readiness.isReviewReady) {
      setFeedback({
        message: `Startup cannot be verified yet. Missing: ${startup.readiness.missingItems.join(', ')}.`,
        tone: 'error',
      });
      return;
    }

    if (decision === 'changes_requested' && !adminNotes) {
      setFeedback({
        message: 'Admin notes are required when requesting changes.',
        tone: 'error',
      });
      return;
    }

    setFeedback(null);
    reviewMutation.mutate({
      startupId: startup._id,
      payload: {
        decision,
        ...(adminNotes ? { adminNotes } : {}),
      },
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Admin · Startups"
        title="Startup review queue"
        description="Pick a startup from the queue to review its readiness, documents, and intake answers — then approve it or send it back for changes."
        stats={[{ label: 'Awaiting Decision', value: pendingCount, accent: 'amber' }]}
      >
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((option) => {
            const active = status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(option.value)}
                className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </AdminPageHeader>

      {feedback ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.tone === 'error'
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-100'
              : 'border-cyan-500/20 bg-cyan-500/10 text-cyan-100'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {focusedStartupId ? (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          Focused on the linked startup. Switch filters if you need the broader review queue.
        </div>
      ) : null}

      {startupsQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : startups.length === 0 ? (
        <Card className="p-6 text-sm text-slate-400">
          No startup submissions match this review filter.
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          {/* Triage queue */}
          <div className="space-y-2 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:pr-1">
            {startups.map((startup) => {
              const isActive = startup._id === selectedId;
              const submitted = formatRelative(startup.reviewRequestedAt);
              const approvalNeeded = needsApprovalDecision(startup);
              return (
                <button
                  key={startup._id}
                  type="button"
                  onClick={() => setSelectedId(startup._id)}
                  className={`w-full rounded-2xl border px-4 py-3.5 text-left transition ${
                    isActive
                      ? `border-cyan-400/50 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.25)] ${
                          approvalNeeded ? 'ring-1 ring-amber-300/35' : ''
                        }`
                      : approvalNeeded
                        ? 'border-amber-400/35 bg-amber-500/10 hover:border-amber-300/50 hover:bg-amber-500/15'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${statusDot[startup.reviewStatus] ?? statusDot.draft}`}
                      />
                      <span className="truncate text-sm font-semibold text-white">
                        {startup.name}
                      </span>
                    </span>
                    {approvalNeeded ? (
                      <span
                        aria-label="Approval needed"
                        title="Approval needed"
                        className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-300 shadow-[0_0_0_4px_rgba(252,211,77,0.14)]"
                      />
                    ) : null}
                  </div>
                  <div className="mt-1.5 truncate text-xs text-slate-400">
                    {startup.category} · {startup.stage}
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                        startup.readiness.isReviewReady ? 'text-emerald-300' : 'text-amber-300'
                      }`}
                    >
                      {startup.readiness.isReviewReady ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {startup.readiness.isReviewReady
                        ? 'Ready'
                        : `${startup.readiness.missingItems.length} gap${
                            startup.readiness.missingItems.length === 1 ? '' : 's'
                          }`}
                    </span>
                    {submitted ? (
                      <span className="text-[11px] text-slate-500">{submitted}</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          {selected ? (
            <Card
              key={selected._id}
              className="flex flex-col gap-5 p-6 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto"
            >
              {/* Detail header */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={reviewTone[selected.reviewStatus] ?? reviewTone.draft}>
                      {formatReviewStatusLabel(selected.reviewStatus)}
                    </Badge>
                    {selected.launchedToInvestors ? (
                      <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                        Investor marketplace live
                      </Badge>
                    ) : null}
                  </div>
                  <h2 className="mt-3 text-2xl font-bold text-white">{selected.name}</h2>
                  <p className="mt-1 text-sm text-slate-300">{selected.tagline}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                    <span>{selected.category}</span>
                    <span className="text-slate-700">•</span>
                    <span>{selected.stage}</span>
                    <span className="text-slate-700">•</span>
                    <span>
                      Protection:{' '}
                      {formatStartupIprValue(
                        'ipProtectionType',
                        selected.registrationProfile.ipProtectionType,
                      )}
                    </span>
                  </div>
                </div>
                {selected.pitchDeckUrl ? (
                  <a href={selected.pitchDeckUrl} target="_blank" rel="noreferrer">
                    <Button variant="secondary" size="sm">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Pitch deck
                    </Button>
                  </a>
                ) : null}
              </div>

              {/* Approval pipeline */}
              <ReviewPipeline
                status={selected.reviewStatus}
                launched={selected.launchedToInvestors}
              />

              {/* Decision verdict — the one thing that matters */}
              {selected.reviewStatus === 'approved' ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
                      <CheckCircle2 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-emerald-200">
                        Approved — cleared to launch
                      </div>
                      <div className="mt-1 text-xs text-emerald-100/80">
                        Reviewed {getReviewedLabel(selected)}. The founder can now launch to the
                        investor marketplace.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`rounded-2xl border p-4 ${
                    selected.readiness.isReviewReady
                      ? 'border-emerald-500/30 bg-emerald-500/10'
                      : 'border-amber-500/30 bg-amber-500/10'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        selected.readiness.isReviewReady
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {selected.readiness.isReviewReady ? (
                        <ShieldCheck className="h-5 w-5" />
                      ) : (
                        <AlertTriangle className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-semibold ${
                          selected.readiness.isReviewReady ? 'text-emerald-200' : 'text-amber-200'
                        }`}
                      >
                        {selected.readiness.isReviewReady
                          ? 'Checklist complete — ready to approve'
                          : `${selected.readiness.missingItems.length} item${
                              selected.readiness.missingItems.length === 1 ? '' : 's'
                            } need attention before approval`}
                      </div>
                      {!selected.readiness.isReviewReady &&
                      selected.readiness.missingItems.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {selected.readiness.missingItems.slice(0, 6).map((item) => (
                          <li key={item} className="flex items-center gap-2 text-xs text-amber-100/90">
                            <span className="h-1 w-1 rounded-full bg-amber-300" />
                            {item}
                          </li>
                        ))}
                        {selected.readiness.missingItems.length > 6 ? (
                          <li className="text-xs text-amber-100/70">
                            + {selected.readiness.missingItems.length - 6} more
                          </li>
                        ) : null}
                      </ul>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick facts */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Fact icon={<FolderKanban className="h-4 w-4" />} label="Workspace">
                  {selected.workspace ? (
                    <span>
                      <span className="block font-medium text-emerald-200">
                        {selected.workspace.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {selected.workspace.category} · Active link
                      </span>
                    </span>
                  ) : (
                    <span className="text-amber-200">No active workspace linked</span>
                  )}
                </Fact>
                <Fact icon={<Users className="h-4 w-4" />} label="Founders">
                  {selected.founders.map((founder) => founder.displayName).join(', ') ||
                    'No founders mapped'}
                </Fact>
                <Fact icon={<Package className="h-4 w-4" />} label="Products / Team">
                  {selected.activeProducts} active products · {selected.teamSize} team members
                </Fact>
                <Fact icon={<Banknote className="h-4 w-4" />} label="Funding needed">
                  {typeof selected.fundingNeeded === 'number'
                    ? `₹${selected.fundingNeeded.toLocaleString('en-IN')}`
                    : 'Not specified'}
                </Fact>
                <Fact icon={<CalendarClock className="h-4 w-4" />} label="Timeline">
                  <span className="block">
                    Submitted{' '}
                    {selected.reviewRequestedAt
                      ? new Date(selected.reviewRequestedAt).toLocaleString('en-IN')
                      : 'Not submitted'}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Reviewed {getReviewedLabel(selected)}
                  </span>
                </Fact>
              </div>

              {/* Traction */}
              {selected.traction.patentFiled ||
              selected.traction.mvpBuilt ||
              selected.traction.revenueGenerating ? (
                <div className="flex flex-wrap gap-2">
                  {selected.traction.patentFiled ? (
                    <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                      Patent filed
                    </Badge>
                  ) : null}
                  {selected.traction.mvpBuilt ? (
                    <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                      MVP built
                    </Badge>
                  ) : null}
                  {selected.traction.revenueGenerating ? (
                    <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                      Revenue generating
                    </Badge>
                  ) : null}
                </div>
              ) : null}

              {/* Progressive disclosure: dense data tucked away */}
              <div className="space-y-2">
                {hasStartupInitializationNarrative(selected.initializationProfile) ? (
                  <Section
                    title="Startup narrative"
                    icon={<FileText className="h-4 w-4" />}
                    count={countTextAnswers(
                      selected.initializationProfile,
                      startupInitializationTextKeys,
                    )}
                    defaultOpen
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      {Object.entries(selected.initializationProfile).map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-200"
                        >
                          <div className="text-xs uppercase tracking-[0.15em] text-slate-500">
                            {
                              STARTUP_INIT_QUESTION_LABELS[
                                key as keyof typeof STARTUP_INIT_QUESTION_LABELS
                              ]
                            }
                          </div>
                          <div className="mt-2 whitespace-pre-wrap text-white">
                            {formatOptionalValue(
                              formatStartupInitValue(
                                key as keyof StartupInitializationProfile,
                                String(value),
                              ),
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                ) : null}

                <Section title="IPR snapshot" icon={<Sparkles className="h-4 w-4" />}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <SnapshotRow
                      label="Innovation stage"
                      value={formatStartupIprValue(
                        'developmentStage',
                        selected.registrationProfile.developmentStage,
                      )}
                    />
                    <SnapshotRow
                      label="Inventors"
                      value={formatStartupIprValue(
                        'inventorOwnership',
                        selected.registrationProfile.inventorOwnership,
                      )}
                    />
                    <SnapshotRow
                      label="Commercialization"
                      value={formatStartupIprValue(
                        'commercializationStrategy',
                        selected.registrationProfile.commercializationStrategy,
                      )}
                    />
                    <SnapshotRow
                      label="Protection sought"
                      value={formatStartupIprValue(
                        'ipProtectionType',
                        selected.registrationProfile.ipProtectionType,
                      )}
                    />
                  </div>
                </Section>

                <Section
                  title="IPR intake answers"
                  icon={<FileText className="h-4 w-4" />}
                  count={countTextAnswers(selected.registrationProfile, startupRegistrationTextKeys)}
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    {Object.entries(selected.registrationProfile).map(([key, value]) => (
                      <div
                        key={key}
                        className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-200"
                      >
                        <div className="text-xs uppercase tracking-[0.15em] text-slate-500">
                          {
                            STARTUP_IPR_QUESTION_LABELS[
                              key as keyof typeof STARTUP_IPR_QUESTION_LABELS
                            ]
                          }
                        </div>
                        <div className="mt-2 whitespace-pre-wrap text-white">
                          {formatOptionalValue(
                            formatStartupIprValue(
                              key as keyof AdminStartupReviewItem['registrationProfile'],
                              value,
                            ),
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section
                  title="Uploaded documents"
                  icon={<FileText className="h-4 w-4" />}
                  count={selected.documents.length}
                >
                  {selected.documents.length > 0 ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      {selected.documents.map((document) => (
                        <a
                          key={document._id}
                          href={document.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-200 transition hover:border-cyan-500/40"
                        >
                          <div className="font-medium text-white">{document.fileName}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {formatDocumentCategoryLabel(document.category)} ·{' '}
                            {new Date(document.uploadedAt).toLocaleDateString('en-IN')}
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">
                      No legal or compliance documents uploaded yet.
                    </div>
                  )}
                </Section>
              </div>

              {/* Full related-data record: investors, funds, market reach, audit trail */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1 pt-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Full record
                  {recordQuery.isFetching ? (
                    <span className="text-[10px] font-normal normal-case tracking-normal text-slate-600">
                      syncing…
                    </span>
                  ) : null}
                </div>

                {recordQuery.isError ? (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-200">
                    Couldn't load the full record for this startup.
                  </div>
                ) : null}

                <Section
                  title="Funds & cap table"
                  icon={<Wallet className="h-4 w-4" />}
                  defaultOpen
                >
                  {record ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <SnapshotRow label="Total raised" value={formatINR(record.funds.totalRaisedINR)} />
                      <SnapshotRow
                        label="Royalty owed to ProMove"
                        value={formatINR(record.funds.totalRoyaltyOwedINR)}
                      />
                      <SnapshotRow
                        label="Equity sold"
                        value={`${record.funds.capTable.totalInvestorEquity.toFixed(2)}%`}
                      />
                      <SnapshotRow
                        label="Founder retained"
                        value={`${record.funds.capTable.founderRetainedEquity.toFixed(2)}%`}
                      />
                      <SnapshotRow
                        label="Shares available"
                        value={`${record.funds.capTable.availableShares.toLocaleString('en-IN')} / ${record.funds.capTable.totalShares.toLocaleString('en-IN')}`}
                      />
                      <SnapshotRow
                        label="Investors"
                        value={`${record.funds.pennyInvestorCount} penny · ${record.funds.soleInvestorCount} sole`}
                      />
                    </div>
                  ) : (
                    <RecordLoading loading={recordQuery.isLoading} />
                  )}
                </Section>

                <Section
                  title="Investors & deals"
                  icon={<Coins className="h-4 w-4" />}
                  count={record?.investors.length}
                  defaultOpen
                >
                  {record ? (
                    record.investors.length > 0 ? (
                      <div className="space-y-2">
                        {record.investors.map((investor) => (
                          <div
                            key={investor.dealId}
                            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white">
                                  {investor.investorName}
                                </span>
                                <Badge className="border-slate-700 bg-slate-800 text-slate-300">
                                  {investor.investorType}
                                </Badge>
                                <Badge className={dealStatusTone[investor.status]}>
                                  {investor.status}
                                </Badge>
                              </div>
                              <span className="text-xs text-slate-500">Stage {investor.stage}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                              <span>
                                <span className="text-slate-500">Amount:</span>{' '}
                                {formatINR(investor.amountINR)}
                              </span>
                              <span>
                                <span className="text-slate-500">Equity:</span>{' '}
                                {typeof investor.equityPercent === 'number'
                                  ? `${investor.equityPercent}%`
                                  : '—'}
                              </span>
                              {investor.investorRole ? (
                                <span>
                                  <span className="text-slate-500">Role:</span> {investor.investorRole}
                                </span>
                              ) : null}
                              {typeof investor.royaltyOwedINR === 'number' ? (
                                <span>
                                  <span className="text-slate-500">Royalty:</span>{' '}
                                  {formatINR(investor.royaltyOwedINR)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">
                        No investors have engaged with this startup yet.
                      </div>
                    )
                  ) : (
                    <RecordLoading loading={recordQuery.isLoading} />
                  )}
                </Section>

                <Section title="Market reach" icon={<TrendingUp className="h-4 w-4" />}>
                  {record ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          className={
                            record.marketReach.launchedToInvestors
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : 'border-slate-700 bg-slate-900 text-slate-400'
                          }
                        >
                          {record.marketReach.launchedToInvestors
                            ? 'Live to investors'
                            : 'Not live to investors'}
                        </Badge>
                        <Badge
                          className={
                            record.marketReach.launchedToMentors
                              ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                              : 'border-slate-700 bg-slate-900 text-slate-400'
                          }
                        >
                          {record.marketReach.launchedToMentors
                            ? 'Live to mentors'
                            : 'Not live to mentors'}
                        </Badge>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <SnapshotRow
                          label="Score at launch"
                          value={record.marketReach.innovationScoreAtLaunch}
                        />
                        <SnapshotRow
                          label="Users reached"
                          value={
                            typeof record.marketReach.traction.usersCount === 'number'
                              ? record.marketReach.traction.usersCount.toLocaleString('en-IN')
                              : '—'
                          }
                        />
                        <SnapshotRow
                          label="Launched"
                          value={
                            record.marketReach.launchedAt
                              ? new Date(record.marketReach.launchedAt).toLocaleDateString('en-IN')
                              : 'Not launched'
                          }
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          className={
                            record.marketReach.traction.mvpBuilt
                              ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                              : 'border-slate-700 bg-slate-900 text-slate-500'
                          }
                        >
                          MVP {record.marketReach.traction.mvpBuilt ? '✓' : '—'}
                        </Badge>
                        <Badge
                          className={
                            record.marketReach.traction.revenueGenerating
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                              : 'border-slate-700 bg-slate-900 text-slate-500'
                          }
                        >
                          Revenue {record.marketReach.traction.revenueGenerating ? '✓' : '—'}
                        </Badge>
                        <Badge
                          className={
                            record.marketReach.traction.patentFiled
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : 'border-slate-700 bg-slate-900 text-slate-500'
                          }
                        >
                          Patent {record.marketReach.traction.patentFiled ? '✓' : '—'}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <RecordLoading loading={recordQuery.isLoading} />
                  )}
                </Section>

                <Section
                  title="Admin audit trail"
                  icon={<History className="h-4 w-4" />}
                  count={record?.auditTrail.length}
                >
                  {record ? (
                    record.auditTrail.length > 0 ? (
                      <ol className="space-y-3">
                        {record.auditTrail.map((entry) => (
                          <li key={entry._id} className="relative flex gap-3 pl-1">
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-400/70" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-white">
                                {formatAuditAction(entry.action)}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-500">
                                {entry.adminName} · {new Date(entry.createdAt).toLocaleString('en-IN')}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="text-sm text-slate-500">
                        No admin actions recorded for this startup yet.
                      </div>
                    )
                  ) : (
                    <RecordLoading loading={recordQuery.isLoading} />
                  )}
                </Section>
              </div>

              {selected.adminNotes ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                  <span className="text-slate-500">Latest admin notes:</span> {selected.adminNotes}
                </div>
              ) : null}

              {/* Decision panel — actions adapt to the current review stage */}
              {selected.reviewStatus === 'draft' ? (
                <div className="mt-1 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-4 text-sm text-slate-400">
                  This startup is still a draft — there's nothing to review until the founder submits
                  it.
                </div>
              ) : (
                <div className="mt-1 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-500">
                    Review notes{' '}
                    <span className="normal-case tracking-normal text-slate-600">
                      (required to request changes)
                    </span>
                  </label>
                  <textarea
                    value={notesByStartup[selected._id] ?? ''}
                    onChange={(event) =>
                      setNotesByStartup((current) => ({
                        ...current,
                        [selected._id]: event.target.value,
                      }))
                    }
                    rows={2}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500/50"
                    placeholder="Add context for approval or describe the changes needed…"
                  />
                  <div className="mt-3 flex flex-wrap gap-3">
                    {selected.reviewStatus === 'review_requested' ? (
                      <Button
                        onClick={() => handleReview(selected, 'approved')}
                        disabled={reviewMutation.isPending || !selected.readiness.isReviewReady}
                        title={
                          selected.readiness.isReviewReady
                            ? 'Verify the workspace link and completed startup details'
                            : `Complete before verification: ${selected.readiness.missingItems.join(', ')}`
                        }
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Verify startup
                      </Button>
                    ) : null}
                    <Button
                      variant="secondary"
                      onClick={() => handleReview(selected, 'changes_requested')}
                      disabled={reviewMutation.isPending}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {selected.reviewStatus === 'approved'
                        ? 'Reopen & request changes'
                        : 'Request changes'}
                    </Button>
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                    <Rocket className="h-3.5 w-3.5 text-cyan-400/70" />
                    {selected.reviewStatus === 'approved'
                      ? 'Verified. Any founder edit returns the startup to draft and requires a new submission.'
                      : selected.reviewStatus === 'changes_requested'
                        ? 'Changes requested — verification stays unavailable until the founder resubmits.'
                        : selected.readiness.isReviewReady
                          ? 'Workspace and required details are complete. Verify to allow marketplace launch.'
                          : 'Verification is blocked until the workspace and all required details are complete.'}
                  </p>
                </div>
              )}

              {/* Danger zone — permanently remove the startup from the platform */}
              <div className="mt-1 rounded-2xl border border-rose-500/25 bg-rose-500/5 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-rose-200">
                  <Trash2 className="h-4 w-4" />
                  Delete startup
                </div>
                <p className="mt-1 text-xs text-rose-100/70">
                  Removes this startup from the marketplace and review queue. Blocked while active
                  investor deals exist — cancel those first.
                </p>
                {confirmDeleteId === selected._id ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className="text-xs text-rose-100">
                      Permanently delete <span className="font-semibold">{selected.name}</span>?
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => deleteMutation.mutate(selected._id)}
                      disabled={deleteMutation.isPending}
                      className="border-rose-500/40 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      {deleteMutation.isPending ? 'Deleting…' : 'Confirm delete'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmDeleteId('')}
                      disabled={deleteMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setFeedback(null);
                      setConfirmDeleteId(selected._id);
                    }}
                    className="mt-3 border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete startup
                  </Button>
                )}
              </div>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-slate-500">
        <span className="text-cyan-300">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-sm text-white">{children}</div>
    </div>
  );
}

function ReviewPipeline({
  status,
  launched,
}: {
  status: StartupReviewStatus;
  launched: boolean;
}) {
  const steps = ['Submitted', 'In review', 'Approved', 'Live to investors'];
  const doneUpTo = launched ? 3 : status === 'approved' ? 2 : status === 'draft' ? -1 : 0;
  const activeIndex = Math.min(doneUpTo + 1, steps.length - 1);
  const changesRequested = status === 'changes_requested';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-4">
      <div className="flex items-start">
        {steps.map((label, index) => {
          const isDone = index <= doneUpTo;
          const isActive = index === activeIndex && !isDone;
          const flagChanges = changesRequested && index === 1;
          return (
            <Fragment key={label}>
              {index > 0 ? (
                <div
                  className={`mt-3.5 h-px flex-1 ${index <= doneUpTo ? 'bg-cyan-500/50' : 'bg-slate-800'}`}
                />
              ) : null}
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
                    isDone
                      ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200'
                      : flagChanges
                        ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                        : isActive
                          ? 'border-cyan-400/60 bg-slate-900 text-cyan-200'
                          : 'border-slate-700 bg-slate-900 text-slate-600'
                  }`}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span
                  className={`max-w-[5.5rem] text-center text-[11px] leading-tight ${
                    flagChanges
                      ? 'text-amber-200'
                      : isDone || isActive
                        ? 'text-slate-200'
                        : 'text-slate-600'
                  }`}
                >
                  {flagChanges ? 'Changes requested' : label}
                </span>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function RecordLoading({ loading }: { loading: boolean }) {
  return (
    <div className="text-sm text-slate-500">
      {loading ? 'Loading related data…' : 'No data available.'}
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-white">{value}</div>
    </div>
  );
}
