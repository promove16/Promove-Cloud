import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  CircleDot,
  Clock,
  FileText,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/admin.api';
import { UserRole } from '../../types/roles.types';

type Accent = 'cyan' | 'amber' | 'violet' | 'emerald' | 'rose';

const ACCENT: Record<
  Accent,
  { bar: string; chip: string; icon: string; ring: string; dot: string; bar2: string }
> = {
  cyan: {
    bar: 'bg-cyan-400',
    bar2: 'bg-cyan-500/30',
    chip: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    icon: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
    ring: 'group-hover:border-cyan-500/40 group-hover:shadow-[0_0_0_1px_rgba(34,211,238,0.15),0_18px_40px_-18px_rgba(34,211,238,0.45)]',
    dot: 'bg-cyan-400',
  },
  amber: {
    bar: 'bg-amber-400',
    bar2: 'bg-amber-500/30',
    chip: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    icon: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    ring: 'group-hover:border-amber-500/40 group-hover:shadow-[0_0_0_1px_rgba(251,191,36,0.15),0_18px_40px_-18px_rgba(251,191,36,0.45)]',
    dot: 'bg-amber-400',
  },
  violet: {
    bar: 'bg-violet-400',
    bar2: 'bg-violet-500/30',
    chip: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
    icon: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
    ring: 'group-hover:border-violet-500/40 group-hover:shadow-[0_0_0_1px_rgba(167,139,250,0.15),0_18px_40px_-18px_rgba(167,139,250,0.45)]',
    dot: 'bg-violet-400',
  },
  emerald: {
    bar: 'bg-emerald-400',
    bar2: 'bg-emerald-500/30',
    chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    icon: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    ring: 'group-hover:border-emerald-500/40 group-hover:shadow-[0_0_0_1px_rgba(52,211,153,0.15),0_18px_40px_-18px_rgba(52,211,153,0.45)]',
    dot: 'bg-emerald-400',
  },
  rose: {
    bar: 'bg-rose-400',
    bar2: 'bg-rose-500/30',
    chip: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    icon: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
    ring: 'group-hover:border-rose-500/40 group-hover:shadow-[0_0_0_1px_rgba(251,113,133,0.15),0_18px_40px_-18px_rgba(251,113,133,0.45)]',
    dot: 'bg-rose-400',
  },
};

const ROLE_LABELS: Partial<Record<UserRole, string>> = {
  [UserRole.STUDENT]: 'Students',
  [UserRole.SCHOOL]: 'Schools',
  [UserRole.COLLEGE]: 'Colleges',
  [UserRole.MENTOR]: 'Mentors',
  [UserRole.INVESTOR]: 'Investors',
  [UserRole.RECRUITER]: 'Recruiters',
  [UserRole.ADMIN]: 'Admins',
};

const STAGE_LABELS = ['Negotiation', 'Agreement', 'Transfer', 'Settlement'];

const nf = new Intl.NumberFormat('en-IN');

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

const humanizeAction = (action: string) => {
  if (action === 'ACCOUNT_ONBOARDED') return 'User Onboarded';
  return action
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

function MetricTile({
  label,
  value,
  detail,
  icon: Icon,
  accent,
  href,
}: {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  accent: Accent;
  href?: string;
}) {
  const a = ACCENT[accent];
  const body = (
    <div
      className={`group relative flex h-full min-h-[176px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 transition duration-300 ${
        href ? `hover:-translate-y-0.5 hover:bg-slate-900 ${a.ring}` : ''
      }`}
    >
      <span className={`absolute inset-x-0 top-0 h-px ${a.bar} opacity-70`} />
      <div className="flex items-start justify-between gap-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.28em] text-slate-500">{label}</div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${a.icon}`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      <div className="mt-auto">
        <div className="font-heading text-[2.5rem] font-semibold leading-none tracking-tight text-white tabular-nums">
          {nf.format(value)}
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
          <span className="truncate">{detail}</span>
          {href ? (
            <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-slate-300" />
          ) : null}
        </div>
      </div>
    </div>
  );

  return href ? (
    <Link to={href} className="block h-full min-w-0">
      {body}
    </Link>
  ) : (
    body
  );
}

function DistributionBar({
  label,
  value,
  max,
  accent,
}: {
  label: string;
  value: number;
  max: number;
  accent: Accent;
}) {
  const pct = max > 0 ? Math.max(value > 0 ? 6 : 0, Math.round((value / max) * 100)) : 0;
  const a = ACCENT[accent];
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm text-slate-300">{label}</span>
        <span className="font-heading text-sm font-semibold text-white tabular-nums">{nf.format(value)}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
        <div className={`h-full rounded-full ${a.bar} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const analyticsQuery = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: adminApi.getAnalytics,
    refetchInterval: 60_000,
    staleTime: 60_000,
  });
  const mentorshipProgramsQuery = useQuery({
    queryKey: ['admin-mentorship-programs'],
    queryFn: () => adminApi.getMentorshipPrograms(),
    staleTime: 60_000,
  });
  const registrationRequestsQuery = useQuery({
    queryKey: ['admin-registration-requests', 'pending', 'dashboard'],
    queryFn: () => adminApi.getRegistrationRequests({ status: 'pending' }),
    staleTime: 60_000,
  });
  const dealsQuery = useQuery({
    queryKey: ['admin-deals', 'dashboard'],
    queryFn: adminApi.getDeals,
    staleTime: 60_000,
  });
  const problemReviewsQuery = useQuery({
    queryKey: ['admin-problem-review-requests', 'dashboard'],
    queryFn: () => adminApi.getProblemReviewRequests({ status: 'review_requested' }),
    staleTime: 60_000,
  });

  const analytics = analyticsQuery.data;
  const mentorshipStats = mentorshipProgramsQuery.data?.stats;
  const activeDeals = dealsQuery.data?.filter((deal) => deal.status === 'active') ?? [];
  const pendingDealReviews = activeDeals.filter(
    (deal) =>
      deal.paymentApproval?.status === 'requested' ||
      deal.cancellationRequest?.status === 'pending' ||
      (deal.adminApprovalRequired && !deal.adminApprovedAt),
  ).length;

  const pendingRegistrations = registrationRequestsQuery.data?.total ?? 0;
  const problemReviews = problemReviewsQuery.data?.length ?? 0;
  const patentsPending = analytics?.patentsPending ?? 0;
  const mentorshipPending = mentorshipStats?.pending ?? 0;
  const awardsPending = analytics?.awardsPending ?? 0;

  const dashboardIsRefreshing =
    analyticsQuery.isFetching ||
    mentorshipProgramsQuery.isFetching ||
    registrationRequestsQuery.isFetching ||
    dealsQuery.isFetching ||
    problemReviewsQuery.isFetching;

  const lastSynced = analyticsQuery.dataUpdatedAt
    ? new Date(analyticsQuery.dataUpdatedAt).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const metrics: Array<{
    label: string;
    value: number;
    detail: string;
    icon: LucideIcon;
    accent: Accent;
    href: string;
  }> = useMemo(
    () => [
      {
        label: 'Pending Requests',
        value: pendingRegistrations,
        detail: 'Registrations awaiting approval',
        icon: ShieldCheck,
        accent: 'amber',
        href: '/dashboard/admin/onboarding/accounts',
      },
      {
        label: 'Active Deals',
        value: activeDeals.length,
        detail:
          pendingDealReviews > 0 ? `${pendingDealReviews} awaiting your review` : 'Nothing blocked on admin',
        icon: BriefcaseBusiness,
        accent: 'cyan',
        href: '/dashboard/admin/deals/overview',
      },
      {
        label: 'Problem Reviews',
        value: problemReviews,
        detail: 'Workspaces queued for moderation',
        icon: Sparkles,
        accent: 'violet',
        href: '/dashboard/admin/problems/reviews',
      },
      {
        label: 'Patent Reviews',
        value: patentsPending,
        detail: 'Filings waiting for action',
        icon: FileText,
        accent: 'emerald',
        href: '/dashboard/admin/patents',
      },
    ],
    [activeDeals.length, patentsPending, pendingDealReviews, problemReviews, pendingRegistrations],
  );

  const triageItems = useMemo(
    () =>
      [
        {
          label: 'Registration approvals',
          hint: 'Institution & operator access',
          count: pendingRegistrations,
          icon: ShieldCheck,
          accent: 'amber' as Accent,
          href: '/dashboard/admin/onboarding/accounts',
        },
        {
          label: 'Deal mediation',
          hint: 'Payments, transfers & cancellations',
          count: pendingDealReviews,
          icon: BriefcaseBusiness,
          accent: 'cyan' as Accent,
          href: '/dashboard/admin/deals/overview',
        },
        {
          label: 'Problem moderation',
          hint: 'Submitted solution workspaces',
          count: problemReviews,
          icon: Sparkles,
          accent: 'violet' as Accent,
          href: '/dashboard/admin/problems/reviews',
        },
        {
          label: 'Patent verification',
          hint: 'Filings & innovation scores',
          count: patentsPending,
          icon: FileText,
          accent: 'emerald' as Accent,
          href: '/dashboard/admin/patents',
        },
        {
          label: 'Mentorship requests',
          hint: 'Institution mentor assignments',
          count: mentorshipPending,
          icon: GraduationCap,
          accent: 'rose' as Accent,
          href: '/dashboard/admin/mentorship/requests',
        },
      ]
        .map((item) => ({ ...item, urgent: item.count > 0 }))
        .sort((a, b) => b.count - a.count),
    [pendingRegistrations, pendingDealReviews, problemReviews, patentsPending, mentorshipPending],
  );

  const totalOpenItems = triageItems.reduce((sum, item) => sum + item.count, 0) + awardsPending;

  const roleDistribution = useMemo(() => {
    const byRole = analytics?.usersByRole;
    if (!byRole) return [];
    const order: UserRole[] = [
      UserRole.STUDENT,
      UserRole.COLLEGE,
      UserRole.SCHOOL,
      UserRole.MENTOR,
      UserRole.INVESTOR,
      UserRole.RECRUITER,
    ];
    const accents: Accent[] = ['cyan', 'violet', 'amber', 'rose', 'emerald', 'cyan'];
    return order
      .map((role, index) => ({
        label: ROLE_LABELS[role] ?? role,
        value: byRole[role] ?? 0,
        accent: accents[index % accents.length],
      }))
      .filter((entry) => entry.value > 0);
  }, [analytics?.usersByRole]);

  const roleMax = roleDistribution.reduce((max, entry) => Math.max(max, entry.value), 0);

  const dealPipeline = useMemo(() => {
    const byStage = analytics?.dealsByStage;
    if (!byStage) return [];
    return (['1', '2', '3', '4'] as const).map((stage, index) => ({
      label: STAGE_LABELS[index],
      value: byStage[stage] ?? 0,
    }));
  }, [analytics?.dealsByStage]);

  const pipelineTotal = dealPipeline.reduce((sum, stage) => sum + stage.value, 0);

  const adminSections = useMemo(
    () => [
      {
        label: 'Problems',
        path: '/dashboard/admin/problems/reviews',
        description: 'Manage problem statements and review solution submissions.',
        icon: Sparkles,
      },
      {
        label: 'Onboarding',
        path: '/dashboard/admin/onboarding/accounts',
        description: 'Approve registrations, manage roles, and inspect activity.',
        icon: Users,
      },
      {
        label: 'Patents',
        path: '/dashboard/admin/patents',
        description: 'Process filings, documents, and innovation scores.',
        icon: FileText,
      },
      {
        label: 'Deals',
        path: '/dashboard/admin/deals/overview',
        description: 'Track transfer reviews, investor approvals, and royalty flow.',
        icon: BriefcaseBusiness,
      },
      {
        label: 'Mentorship',
        path: '/dashboard/admin/mentorship/requests',
        description: 'Create mentor accounts and assign institution requests.',
        icon: GraduationCap,
      },
      {
        label: 'Analytics',
        path: '/dashboard/admin/analytics',
        description: 'Operational overview, usage trends, and admin logs.',
        icon: BarChart3,
      },
    ],
    [],
  );

  const recentActions = (analytics?.recentAdminActions ?? []).slice(0, 5);
  const usage = analytics?.usageSummary;

  return (
    <div className="w-full max-w-full space-y-7 overflow-x-hidden">
      {/* Command band */}
      <section className="relative min-w-0 overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(34,211,238,0.14),transparent_42%),radial-gradient(circle_at_100%_0%,rgba(167,139,250,0.12),transparent_38%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148,163,184,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.6) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        <div className="relative px-6 py-7 lg:px-9 lg:py-9">
          <div className="flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 max-w-2xl">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[11px] font-medium uppercase tracking-[0.34em] text-cyan-300">
                  Admin Command Center
                </span>
              </div>
              <h1 className="font-heading mt-4 text-[2rem] font-semibold leading-[1.05] tracking-tight text-white sm:text-[2.5rem]">
                Platform control center
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Triage approvals and live moderation queues at a glance, then dive into a dedicated workspace for the
                full workflow. {totalOpenItems > 0 ? (
                  <span className="text-slate-200">
                    {nf.format(totalOpenItems)} item{totalOpenItems === 1 ? '' : 's'} need attention.
                  </span>
                ) : (
                  <span className="text-emerald-300">All queues are clear.</span>
                )}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {dashboardIsRefreshing
                    ? 'Syncing live data…'
                    : lastSynced
                      ? `Synced ${lastSynced}`
                      : 'Live data'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {nf.format(analytics?.totalUsers ?? 0)} accounts
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  {nf.format(analytics?.activeThisWeek ?? 0)} active this week
                </span>
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-2.5 sm:max-w-md xl:w-auto xl:max-w-none xl:grid-cols-1 xl:gap-2.5">
              <button
                type="button"
                onClick={() => navigate('/dashboard/admin/analytics')}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Open Analytics
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard/admin/patents')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
              >
                Review Patents
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard/admin/mentorship/requests')}
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 xl:col-span-1"
              >
                Institution Requests
              </button>
            </div>
          </div>

          <div className="mt-8 grid min-w-0 auto-rows-fr items-stretch gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricTile key={metric.label} {...metric} />
            ))}
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.55fr),minmax(0,1fr)]">
        {/* Priority queue */}
        <section className="min-w-0 space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-[0.3em] text-cyan-300">Priority Queue</div>
              <h2 className="font-heading mt-1.5 text-xl font-semibold text-white">What needs you next</h2>
            </div>
            <div className="shrink-0 text-xs text-slate-500">
              {dashboardIsRefreshing ? 'Refreshing…' : 'Up to date'}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/40">
            {triageItems.map((item, index) => {
              const a = ACCENT[item.accent];
              return (
                <Link
                  key={item.label}
                  to={item.href}
                  className={`group flex items-center gap-4 px-5 py-4 transition hover:bg-slate-800/50 ${
                    index !== 0 ? 'border-t border-slate-800/70' : ''
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${a.icon}`}>
                    <item.icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{item.label}</div>
                    <div className="truncate text-xs text-slate-500">{item.hint}</div>
                  </div>
                  <div
                    className={`inline-flex h-7 min-w-[2.75rem] items-center justify-center rounded-full border px-2.5 text-sm font-semibold tabular-nums ${
                      item.urgent ? a.chip : 'border-slate-700/70 bg-slate-800/40 text-slate-500'
                    }`}
                  >
                    {nf.format(item.count)}
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-300" />
                </Link>
              );
            })}
          </div>

          {/* Admin modules */}
          <div className="pt-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.3em] text-cyan-300">Workspaces</div>
            <h2 className="font-heading mt-1.5 text-xl font-semibold text-white">Open the right module</h2>
          </div>
          <div className="grid min-w-0 gap-3.5 sm:grid-cols-2">
            {adminSections.map((section) => (
              <Link
                key={section.path}
                to={section.path}
                className="group min-w-0 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 transition hover:-translate-y-0.5 hover:border-cyan-500/30 hover:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-cyan-300 transition group-hover:border-cyan-500/30 group-hover:bg-cyan-500/10">
                    <section.icon className="h-[18px] w-[18px]" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-700 transition group-hover:text-cyan-300" />
                </div>
                <div className="mt-4 text-base font-semibold text-white">{section.label}</div>
                <p className="mt-1.5 text-sm leading-6 text-slate-400">{section.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Insights rail */}
        <aside className="min-w-0 space-y-6">
          {/* Community */}
          <section className="min-w-0 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.3em] text-cyan-300">Community</div>
              <Link
                to="/dashboard/admin/analytics"
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-cyan-300"
              >
                Details <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-heading text-3xl font-semibold text-white tabular-nums">
                {nf.format(analytics?.totalUsers ?? 0)}
              </span>
              <span className="text-sm text-slate-500">members</span>
            </div>
            <div className="mt-5 space-y-3.5">
              {roleDistribution.length > 0 ? (
                roleDistribution.map((entry) => (
                  <DistributionBar
                    key={entry.label}
                    label={entry.label}
                    value={entry.value}
                    max={roleMax}
                    accent={entry.accent}
                  />
                ))
              ) : (
                <p className="text-sm text-slate-500">No member data yet.</p>
              )}
            </div>
          </section>

          {/* Deal pipeline */}
          <section className="min-w-0 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.3em] text-cyan-300">Deal Pipeline</div>
              <span className="text-xs text-slate-500">{nf.format(pipelineTotal)} total</span>
            </div>
            <div className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-slate-800/80">
              {dealPipeline.map((stage, index) => {
                const width = pipelineTotal > 0 ? (stage.value / pipelineTotal) * 100 : 0;
                const fills = ['bg-cyan-400', 'bg-violet-400', 'bg-amber-400', 'bg-emerald-400'];
                return width > 0 ? (
                  <div key={stage.label} className={fills[index]} style={{ width: `${width}%` }} />
                ) : null;
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {dealPipeline.map((stage, index) => {
                const dots = ['bg-cyan-400', 'bg-violet-400', 'bg-amber-400', 'bg-emerald-400'];
                return (
                  <div key={stage.label} className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${dots[index]}`} />
                    <div className="min-w-0">
                      <div className="font-heading text-sm font-semibold text-white tabular-nums">
                        {nf.format(stage.value)}
                      </div>
                      <div className="truncate text-[11px] text-slate-500">{stage.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {usage ? (
              <div className="mt-5 flex items-center gap-2 border-t border-slate-800/70 pt-4 text-xs text-slate-500">
                <CircleDot className="h-3.5 w-3.5 text-cyan-300" />
                {nf.format(usage.writeActionsLast7Days)} write actions in the last 7 days
              </div>
            ) : null}
          </section>

          {/* Recent admin activity */}
          <section className="min-w-0 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.3em] text-cyan-300">Recent Admin Activity</div>
            <div className="mt-4 space-y-4">
              {recentActions.length > 0 ? (
                recentActions.map((entry) => (
                  <div key={entry._id} className="flex gap-3">
                    <div className="mt-1 flex flex-col items-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                      <span className="mt-1 w-px flex-1 bg-slate-800" />
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <div className="truncate text-sm font-medium text-slate-200">{humanizeAction(entry.action)}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                        <span className="truncate">{entry.targetName || entry.targetModel}</span>
                        <span className="text-slate-700">•</span>
                        <span className="shrink-0">{formatRelative(entry.createdAt) ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No admin actions recorded yet.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
