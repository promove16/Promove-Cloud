import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Calendar,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { DashboardEmpty } from './dashboardSurface';
import type { DashboardEvent, RecentProject, StudentLeaderboardItem } from '../../types/school.types';

type OverviewStatCard = {
  label: string;
  value: number | string;
  badge: string;
  icon: LucideIcon;
  color: string;
  to?: string;
};

type OverviewQuickStat = {
  label: string;
  value: string;
};

type OverviewAction = {
  label: string;
  to: string;
  variant?: 'primary' | 'secondary';
};

type InstitutionOverviewDashboardProps = {
  institutionLabel: string;
  institutionName: string;
  subtitle: string;
  topInnovatorsTitle: string;
  topInnovatorsAction?: OverviewAction;
  topInnovatorsEmptyMessage: string;
  eventsTitle: string;
  eventsEmptyMessage: string;
  recentProjectsTitle: string;
  recentProjectsAction?: OverviewAction;
  recentProjectsEmptyMessage: string;
  announcementTitle: string;
  announcementBody: string;
  announcementAction?: OverviewAction;
  statCards: OverviewStatCard[];
  quickStats: OverviewQuickStat[];
  topStudents: StudentLeaderboardItem[];
  upcomingEvents: DashboardEvent[];
  recentProjects: RecentProject[];
  studentTo?: (student: StudentLeaderboardItem) => string;
  eventTo?: (event: DashboardEvent) => string;
  projectTo?: (project: RecentProject) => string;
  isLoading?: boolean;
};

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const relativeDayFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const formatDate = (value: string) => dateFormatter.format(new Date(value));

const formatRelativeDays = (value: string) => {
  const now = Date.now();
  const updatedAt = new Date(value).getTime();
  const dayDiff = Math.round((updatedAt - now) / (1000 * 60 * 60 * 24));

  if (Math.abs(dayDiff) < 1) {
    return 'Updated today';
  }

  return `Updated ${relativeDayFormatter.format(dayDiff, 'day')}`;
};

const getInitials = (value: string) =>
  value
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

const getProjectStatusTone = (stage: string) => {
  switch (stage) {
    case 'Launch':
      return 'bg-emerald-500/10 text-emerald-300';
    case 'Patent':
      return 'bg-cyan-500/10 text-cyan-300';
    case 'Build':
      return 'bg-violet-500/10 text-violet-300';
    case 'Problem':
      return 'bg-amber-500/10 text-amber-300';
    default:
      return 'bg-slate-800 text-slate-300';
  }
};

const getButtonVariant = (variant?: 'primary' | 'secondary') => variant ?? 'primary';

export function InstitutionOverviewDashboard({
  institutionLabel,
  institutionName,
  subtitle,
  topInnovatorsTitle,
  topInnovatorsAction,
  topInnovatorsEmptyMessage,
  eventsTitle,
  eventsEmptyMessage,
  recentProjectsTitle,
  recentProjectsAction,
  recentProjectsEmptyMessage,
  announcementTitle,
  announcementBody,
  announcementAction,
  statCards,
  quickStats,
  topStudents,
  upcomingEvents,
  recentProjects,
  studentTo,
  eventTo,
  projectTo,
  isLoading = false,
}: InstitutionOverviewDashboardProps) {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">{institutionLabel}</div>
        <h1 className="text-3xl font-bold text-white md:text-4xl">{institutionName}</h1>
        <p className="max-w-3xl text-slate-400">{subtitle}</p>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => (
          <Link
            key={stat.label}
            to={stat.to ?? '#'}
            className={`rounded-2xl border border-slate-800 bg-slate-900/85 p-6 shadow-[0_18px_60px_rgba(2,6,23,0.28)] transition hover:border-slate-700 ${
              stat.to ? 'block cursor-pointer' : 'pointer-events-none block'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color}`}
              >
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 text-xs font-semibold text-emerald-300">
                {stat.badge}
              </div>
            </div>
            <div className="mt-5 text-3xl font-bold text-white">{stat.value}</div>
            <div className="mt-2 text-sm text-slate-400">{stat.label}</div>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/85 p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-white">{topInnovatorsTitle}</h2>
            {topInnovatorsAction ? (
              <Link to={topInnovatorsAction.to} className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-200">
                {topInnovatorsAction.label}
              </Link>
            ) : null}
          </div>

          {topStudents.length === 0 ? (
            <DashboardEmpty
              message={isLoading ? 'Loading dashboard data...' : topInnovatorsEmptyMessage}
            />
          ) : (
            <div className="space-y-4">
              {topStudents.map((student) => (
                <Link
                  key={student._id}
                  to={studentTo ? studentTo(student) : '#'}
                  className={`rounded-2xl border border-slate-800 bg-slate-950/80 p-5 transition-colors hover:border-slate-700 ${
                    studentTo ? 'block' : 'pointer-events-none block'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-lg font-bold text-white">
                      {student.avatar ? (
                        <img src={student.avatar} alt={student.displayName} className="h-full w-full object-cover" />
                      ) : (
                        getInitials(student.displayName)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-bold text-white">{student.displayName}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                        <span>{student.activeProject?.title ?? 'No active workspace'}</span>
                        <span className="flex items-center gap-1">
                          <Trophy className="h-4 w-4 text-yellow-400" />
                          Score {student.innovationScore}
                        </span>
                        {student.activeProject ? (
                          <span>{student.activeProject.progressPercent}% progress</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                      Rank #{student.rank}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/85 p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-white">{eventsTitle}</h2>
            <div className="rounded-xl bg-cyan-500/10 p-2">
              <Calendar className="h-5 w-5 text-cyan-300" />
            </div>
          </div>

          {upcomingEvents.length === 0 ? (
            <DashboardEmpty message={isLoading ? 'Loading events...' : eventsEmptyMessage} />
          ) : (
            <div className="space-y-4">
              {upcomingEvents.map((event) => (
                <Link
                  key={event._id}
                  to={eventTo ? eventTo(event) : '#'}
                  className={`rounded-2xl border border-slate-800 bg-slate-950/80 p-4 transition-colors hover:border-slate-700 ${
                    eventTo ? 'block' : 'pointer-events-none block'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-500/10">
                      <Calendar className="h-5 w-5 text-cyan-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-white">{event.title}</h3>
                      <p className="mt-1 text-xs text-slate-400">{formatDate(event.scheduledAt)}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-300">
                          {event.type}
                        </span>
                        <span className="text-xs text-slate-500">{event.participantsCount} participants</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/85 p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-white">{recentProjectsTitle}</h2>
          {recentProjectsAction ? (
            <Link to={recentProjectsAction.to} className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-200">
              {recentProjectsAction.label}
            </Link>
          ) : null}
        </div>

        {recentProjects.length === 0 ? (
          <DashboardEmpty message={isLoading ? 'Loading projects...' : recentProjectsEmptyMessage} />
        ) : (
          <div className="space-y-4">
            {recentProjects.map((project) => (
              <Link
                key={project._id}
                to={projectTo ? projectTo(project) : '#'}
                className={`rounded-2xl border border-slate-800 bg-slate-950/80 p-5 transition-colors hover:border-slate-700 ${
                  projectTo ? 'block' : 'pointer-events-none block'
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold text-white">{project.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                      <span className="text-slate-400">by {project.studentName}</span>
                      <span className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-300">{project.category}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getProjectStatusTone(project.stage)}`}>
                        {project.stage}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-slate-500">{formatRelativeDays(project.updatedAt)}</div>
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-400">Progress</span>
                    <span className="font-semibold text-white">{project.progressPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500"
                      style={{ width: `${project.progressPercent}%` }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-cyan-900/40 bg-gradient-to-r from-cyan-950/30 via-slate-900/80 to-violet-950/25 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-500/10">
            <Bell className="h-6 w-6 text-cyan-300" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-white">{announcementTitle}</h3>
            <p className="mt-2 max-w-3xl text-slate-400">{announcementBody}</p>
            {announcementAction ? (
              <div className="mt-4">
                <Link to={announcementAction.to}>
                  <Button variant={getButtonVariant(announcementAction.variant)}>
                    {announcementAction.label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {quickStats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900/85 p-6 text-center">
            <div className="text-4xl font-bold text-white">{stat.value}</div>
            <div className="mt-2 text-slate-400">{stat.label}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
