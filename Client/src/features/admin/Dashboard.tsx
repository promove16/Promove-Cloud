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
}: {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="border-slate-800/90 bg-slate-950/85 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</div>
          <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
          <div className="mt-2 text-sm text-slate-400">{detail}</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
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

  const analytics = analyticsQuery.data;
  const mentorshipStats = mentorshipProgramsQuery.data?.stats;

  const metrics = useMemo(
    () => [
      {
        label: 'Platform Users',
        value: analytics?.totalUsers ?? 0,
        detail: `${analytics?.activeThisWeek ?? 0} active this week`,
        icon: Users,
      },
      {
        label: 'Patents Pending',
        value: analytics?.patentsPending ?? 0,
        detail: 'Needs admin review',
        icon: FileText,
      },
      {
        label: 'Deals in Flow',
        value: analytics?.totalDeals ?? 0,
        detail: `${analytics?.dealConversionRate ?? 0}% completed to stage 4`,
        icon: BriefcaseBusiness,
      },
      {
        label: 'Mentorship Queue',
        value: mentorshipStats?.pending ?? 0,
        detail: `${mentorshipStats?.assigned ?? 0} assigned sessions`,
        icon: GraduationCap,
      },
    ],
    [analytics, mentorshipStats],
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
        meta: `${analytics?.totalDeals ?? 0} active deal records`,
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
        description: 'Open the temporary analytics placeholder while the full reporting workspace is being updated.',
        meta: 'Temporary holding page',
        icon: BarChart3,
      },
    ],
    [analytics, mentorshipStats],
  );

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden border border-slate-800 bg-slate-950">
        <div className="absolute inset-x-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent_28%)]" />
        <div className="relative space-y-6 px-6 py-6 lg:px-8 lg:py-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">Admin Console</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Platform control center</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                The home screen stays focused on current platform health and where to go next. Deep analytics, review
                queues, and mentorship operations now live in their own sections.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => navigate('/dashboard/admin/patents')}>
                Review Patents
              </Button>
              <Button variant="secondary" onClick={() => navigate('/dashboard/admin/mentorship/requests')}>
                Open Mentorship
              </Button>
              <Button onClick={() => navigate('/dashboard/admin/analytics')}>
                Open Analytics
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                detail={metric.detail}
                icon={metric.icon}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">Admin Sections</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Open the right workspace</h2>
          </div>
          <div className="text-sm text-slate-500">
            {analyticsQuery.isLoading || mentorshipProgramsQuery.isLoading ? 'Refreshing dashboard data...' : 'Live data is up to date.'}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {adminSections.map((section) => (
            <Link
              key={section.path}
              to={section.path}
              className="group border border-slate-800 bg-slate-950 px-6 py-5 transition hover:border-cyan-500/40 hover:bg-slate-950/80"
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

      <section className="overflow-hidden border border-slate-800 bg-slate-950">
        <div className="border-b border-slate-800 px-6 py-5 lg:px-8">
          <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">Analytics Status</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Analytics is temporarily parked</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            The admin navigation still reserves an analytics entry, but it currently opens a temporary page while the
            reporting workspace is being refreshed.
          </p>
        </div>
        <div className="px-6 py-6 text-sm leading-6 text-slate-400 lg:px-8">
          Use the temporary analytics page if you need the reserved route. Core admin monitoring remains visible on this
          dashboard through the live summary cards above.
        </div>
      </section>
    </div>
  );
}
