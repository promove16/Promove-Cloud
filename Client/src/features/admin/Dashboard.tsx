import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  FileText,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/admin.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  href,
}: {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  href?: string;
}) {
  const content = (
    <Card
      className={`flex h-full min-h-[210px] min-w-0 flex-col border-slate-800 bg-slate-900 p-5 ${
        href ? 'transition hover:border-blue-500/40 hover:bg-slate-800' : ''
      }`}
    >
      <div className="flex h-full items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</div>
          <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
          <div className="mt-2 text-sm text-slate-400">{detail}</div>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );

  if (!href) {
    return content;
  }

  return (
    <Link to={href} className="block h-full min-w-0">
      {content}
    </Link>
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
    (deal) => deal.cancellationRequest?.status === 'pending' || (deal.adminApprovalRequired && !deal.adminApprovedAt),
  ).length;
  const dashboardIsRefreshing =
    analyticsQuery.isLoading ||
    mentorshipProgramsQuery.isLoading ||
    registrationRequestsQuery.isLoading ||
    dealsQuery.isLoading ||
    problemReviewsQuery.isLoading;

  const metrics = useMemo(
    () => [
      {
        label: 'Pending Requests',
        value: registrationRequestsQuery.data?.total ?? 0,
        detail: 'Institution and operator registrations awaiting approval',
        icon: ShieldCheck,
        href: '/dashboard/admin/users/requests',
      },
      {
        label: 'Active Deals',
        value: activeDeals.length,
        detail: pendingDealReviews > 0 ? `${pendingDealReviews} awaiting admin review` : 'No deals blocked on admin review',
        icon: BriefcaseBusiness,
        href: '/dashboard/admin/deals/overview',
      },
      {
        label: 'Problem Reviews',
        value: problemReviewsQuery.data?.length ?? 0,
        detail: 'Submitted workspaces queued for moderation',
        icon: Sparkles,
        href: '/dashboard/admin/problems/reviews',
      },
      {
        label: 'Patent Reviews',
        value: analytics?.patentsPending ?? 0,
        detail: 'Patent filings waiting for admin action',
        icon: FileText,
        href: '/dashboard/admin/patents',
      },
    ],
    [
      activeDeals.length,
      analytics?.patentsPending,
      pendingDealReviews,
      problemReviewsQuery.data?.length,
      registrationRequestsQuery.data?.total,
    ],
  );

  const adminSections = useMemo(
    () => [
      {
        label: 'Problems',
        path: '/dashboard/admin/problems/reviews',
        eyebrow: 'Challenge operations',
        description: 'Manage problem statements and review solution submissions from the admin queue.',
        meta: 'Catalog and review workflow',
        icon: Sparkles,
      },
      {
        label: 'Users',
        path: '/dashboard/admin/users/requests',
        eyebrow: 'Access control',
        description: 'Approve registrations, manage roles, and inspect operator activity in one place.',
        meta: `${analytics?.totalUsers ?? 0} tracked accounts`,
        icon: Users,
      },
      {
        label: 'Patents',
        path: '/dashboard/admin/patents',
        eyebrow: 'Verification desk',
        description: 'Process filings, supporting documents, and innovation score approvals.',
        meta: `${analytics?.patentsPending ?? 0} pending approvals`,
        icon: FileText,
      },
      {
        label: 'Deals',
        path: '/dashboard/admin/deals/overview',
        eyebrow: 'Mediation desk',
        description: 'Track stock-transfer reviews, investor approvals, and ProMove royalty flow.',
        meta: `${activeDeals.length} active deal records`,
        icon: BriefcaseBusiness,
      },
      {
        label: 'Mentorship',
        path: '/dashboard/admin/mentorship/requests',
        eyebrow: 'Program operations',
        description: 'Create mentor accounts and assign pending institution mentorship requests.',
        meta: `${mentorshipStats?.pending ?? 0} pending requests`,
        icon: GraduationCap,
      },
      {
        label: 'Analytics',
        path: '/dashboard/admin/analytics',
        eyebrow: 'Platform insights',
        description: 'Inspect operational overview, usage activity, user intelligence, and admin logs in one workspace.',
        meta: 'Live reporting workspace',
        icon: BarChart3,
      },
    ],
    [activeDeals.length, analytics, mentorshipStats],
  );

  return (
    <div className="w-full max-w-full space-y-8 overflow-x-hidden">
      <section className="relative min-w-0 overflow-hidden border border-slate-800 bg-slate-950">
        <div className="absolute inset-x-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent_28%)]" />
        <div className="relative space-y-6 px-6 py-6 lg:px-8 lg:py-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">Admin Console</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Platform control center</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Keep the top of the dashboard focused on approvals, unresolved tickets, and live moderation queues.
                Deeper analytics and workflow detail still live inside their dedicated admin sections.
              </p>
            </div>
            <div className="flex w-full min-w-0 flex-col items-stretch gap-3 sm:w-40 xl:shrink-0">
              <Button
                className="w-full whitespace-nowrap"
                variant="secondary"
                onClick={() => navigate('/dashboard/admin/patents')}
              >
                Review Patents
              </Button>
              <Button
                className="w-full whitespace-nowrap"
                variant="secondary"
                onClick={() => navigate('/dashboard/admin/mentorship/requests')}
              >
                Institution Requests
              </Button>
              <Button className="w-full whitespace-nowrap" onClick={() => navigate('/dashboard/admin/analytics')}>
                Open Analytics
              </Button>
            </div>
          </div>

          <div className="grid min-w-0 auto-rows-fr items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                detail={metric.detail}
                icon={metric.icon}
                href={metric.href}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="min-w-0 space-y-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">Admin Sections</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Open the right workspace</h2>
          </div>
          <div className="shrink-0 text-sm text-slate-500">
            {dashboardIsRefreshing ? 'Refreshing dashboard data...' : 'Live data is up to date.'}
          </div>
        </div>

        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          {adminSections.map((section) => (
            <Link
              key={section.path}
              to={section.path}
              className="group min-w-0 border border-slate-800 bg-slate-900 px-6 py-5 transition hover:border-blue-500/40 hover:bg-slate-800"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.25em] text-cyan-300">{section.eyebrow}</div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center border border-slate-800 bg-slate-900 text-cyan-300 transition group-hover:border-cyan-500/30 group-hover:bg-cyan-500/10">
                      <section.icon className="h-5 w-5" />
                    </div>
                    <div className="text-xl font-semibold text-white">{section.label}</div>
                  </div>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">{section.description}</p>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-slate-600 transition group-hover:text-cyan-300" />
              </div>
              <div className="mt-5 text-sm text-slate-500">{section.meta}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="min-w-0 overflow-hidden border border-slate-800 bg-slate-950">
        <div className="border-b border-slate-800 px-6 py-5 lg:px-8">
          <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">Analytics Status</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Analytics workspace is live</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            The admin analytics route now opens the reporting workspace directly, with dedicated views for platform
            overview, usage trends, user activity, and logs.
          </p>
        </div>
        <div className="px-6 py-6 text-sm leading-6 text-slate-400 lg:px-8">
          Use this dashboard for fast moderation triage, then jump into analytics when you need deeper reporting or
          account-level investigation.
        </div>
      </section>
    </div>
  );
}
