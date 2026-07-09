import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BriefcaseBusiness,
  GraduationCap,
  ChevronRight,
  Activity,
  ExternalLink,
  Users,
  CalendarDays,
  Gavel,
  Sparkles,
  Trophy,
  Star,
  Award,
  Zap,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { mentorApi, MentorDashboardActivity } from '../../api/mentor.api';
import { mentorScoreApi } from '../../api/mentorScore.api';
import { getMentorSocket } from '../../lib/socket';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { PatentShowcase } from '../shared/PatentShowcase';
import { getStudentPortfolioViewPath } from '../marketplace/navigation';
import { useAuthStore } from '../../store/authStore';

const TOTAL_GUIDED_MAX = 700;

function mentorBand(total: number) {
  if (total >= 600) return { name: 'Master Mentor', text: 'text-amber-300', ring: 'text-amber-400', chip: 'border-amber-500/30 bg-amber-500/10 text-amber-300' };
  if (total >= 400) return { name: 'Advanced Mentor', text: 'text-fuchsia-300', ring: 'text-fuchsia-400', chip: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300' };
  if (total >= 200) return { name: 'Emerging Mentor', text: 'text-cyan-300', ring: 'text-cyan-400', chip: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300' };
  return { name: 'Building Foundation', text: 'text-slate-300', ring: 'text-slate-400', chip: 'border-slate-600/40 bg-slate-500/10 text-slate-300' };
}

function dateToObj(dateStr?: string) {
  if (!dateStr) return { month: '—', day: '—', year: '—' };
  const d = new Date(dateStr);
  return {
    month: d.toLocaleString('en-IN', { month: 'short' }).toUpperCase(),
    day: d.getDate(),
    year: d.getFullYear(),
  };
}

export default function MentorDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const dashboardQuery = useQuery({
    queryKey: ['mentor-dashboard'],
    queryFn: mentorApi.getDashboard,
    refetchInterval: 60_000,
  });

  const [liveActivities, setLiveActivities] = useState<MentorDashboardActivity[]>([]);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'projects' | 'programs'>('projects');
  const [activityFilter, setActivityFilter] = useState<'all' | 'score' | 'patents'>('all');

  useEffect(() => {
    if (dashboardQuery.data) {
      setLiveActivities(dashboardQuery.data.recentActivities);
    }
  }, [dashboardQuery.data]);

  useEffect(() => {
    const socket = getMentorSocket();
    if (!socket.connected) {
      socket.connect();
    }
    const handleActivity = (activity: MentorDashboardActivity) => {
      setLiveActivities((current) =>
        [activity, ...current.filter((item) => item.studentId !== activity.studentId)].slice(0, 10)
      );
      void queryClient.invalidateQueries({ queryKey: ['mentor-dashboard'] });
    };

    socket.on('student:activity', handleActivity);
    return () => {
      socket.off('student:activity', handleActivity);
    };
  }, [queryClient]);

  const scoreQuery = useQuery({
    queryKey: ['mentor-score', 'me'],
    queryFn: mentorScoreApi.getMyScore,
  });

  const total = scoreQuery.data?.totalScore ?? 0;
  const progress = total / TOTAL_GUIDED_MAX;
  const band = useMemo(() => mentorBand(total), [total]);

  const greeting = useMemo(() => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good morning';
    if (hours < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const stats = useMemo(
    () => [
      {
        label: 'Students',
        value: dashboardQuery.data?.activeStudentCount ?? 0,
        link: '/dashboard/mentor/students',
        icon: Users,
      },
      {
        label: 'Sessions',
        value: dashboardQuery.data?.upcomingSessions ?? dashboardQuery.data?.sessionsToday ?? 0,
        link: '/dashboard/mentor/sessions',
        icon: CalendarDays,
      },
      {
        label: 'Bids',
        value: dashboardQuery.data?.pendingBids ?? dashboardQuery.data?.pendingReviews ?? 0,
        link: '/dashboard/mentor/marketplace',
        icon: Gavel,
      },
    ],
    [dashboardQuery.data],
  );

  const filteredActivities = useMemo(() => {
    if (activityFilter === 'all') return liveActivities;
    if (activityFilter === 'score') return liveActivities.filter((a) => a.delta > 0);
    if (activityFilter === 'patents') {
      return liveActivities.filter(
        (a) => a.trigger === 'PATENT_SUBMITTED' || a.trigger === 'PATENT_APPROVED'
      );
    }
    return liveActivities;
  }, [liveActivities, activityFilter]);

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 text-lg font-bold text-white">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.displayName} className="h-full w-full rounded-2xl object-cover" />
              ) : (
                user?.displayName?.slice(0, 2).toUpperCase() || 'M'
              )}
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-900 bg-emerald-500" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-cyan-400">Mentor workspace</div>
              <h1 className="mt-1 text-2xl font-bold text-white">
                {greeting}, {user?.displayName || 'Mentor'}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                You are guiding {dashboardQuery.data?.activeStudentCount || 0} students across {dashboardQuery.data?.assignedProjectsCount || 0} projects and {dashboardQuery.data?.assignedProgramsCount || 0} institution programs.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => navigate('/dashboard/mentor/marketplace')}>
              Browse Opportunities
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button onClick={() => navigate('/dashboard/mentor/students')}>
              Open Student Feed
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <section className="rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 shadow-xl shadow-black/45">
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Overview & Insights</h2>
          <Link
            to="/dashboard/mentor/score"
            className="inline-flex items-center gap-1 text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors"
          >
            Full score breakdown <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center">
          {/* Circular SVG Gauge */}
          <div className="relative mx-auto flex h-32 w-32 shrink-0 items-center justify-center lg:mx-0">
            <svg className="absolute inset-0 h-full w-full -rotate-90 transform drop-shadow-[0_0_10px_rgba(99,102,241,0.25)]">
              <circle cx="64" cy="64" r="54" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800/60" />
              <circle
                cx="64" cy="64" r="54"
                stroke="url(#scoreGrad)"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 54}`}
                strokeDashoffset={`${2 * Math.PI * 54 * (1 - Math.min(1, progress))}`}
                className="transition-all duration-1000 ease-out"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="50%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
            <div className="z-10 text-center">
              <div className="text-3xl font-black text-white tracking-tight">{total}</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">of {TOTAL_GUIDED_MAX}</div>
            </div>
          </div>

          {/* Details & Metadata */}
          <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                <span className={`text-xl font-black bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent`}>{band.name}</span>
                <Badge className={`border ${band.chip} text-[10px] font-extrabold uppercase py-0.5 px-2`}>Current tier</Badge>
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-2 lg:justify-start">
                <div className="flex items-center gap-1.5 rounded-full border border-white/5 bg-slate-950/60 px-3.5 py-1.5 text-xs font-semibold text-slate-300">
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  <span>Rank:</span>
                  <span className="font-extrabold text-white">
                    {scoreQuery.data?.rank && scoreQuery.data.rank > 0 ? `#${scoreQuery.data.rank}` : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-white/5 bg-slate-950/60 px-3.5 py-1.5 text-xs font-semibold text-slate-300">
                  <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                  <span>Rating:</span>
                  <span className="font-extrabold text-white">
                    {scoreQuery.data?.mentorshipRating && scoreQuery.data.mentorshipRating > 0
                      ? `${scoreQuery.data.mentorshipRating.toFixed(1)}`
                      : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-white/5 bg-slate-950/60 px-3.5 py-1.5 text-xs font-semibold text-slate-300">
                  <Award className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Next tier in:</span>
                  <span className="font-extrabold text-white">
                    {total >= 600 ? 'Max tier' : `${total >= 400 ? 600 - total : total >= 200 ? 400 - total : 200 - total} pts`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Phase progress indicators using the empty space on the right */}
          <div className="w-full lg:w-auto lg:min-w-[440px] flex-shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-800 lg:border-t-0 lg:border-l lg:border-slate-800 pt-5 lg:pt-0 lg:pl-6">
            {[
              { label: 'Phase 1: Empowerment', value: scoreQuery.data?.phase1Score ?? 0, cap: 140, color: 'from-cyan-400 to-blue-500', glow: 'shadow-cyan-500/5' },
              { label: 'Phase 2: Incubation', value: scoreQuery.data?.phase2Score ?? 0, cap: 245, color: 'from-violet-500 to-indigo-500', glow: 'shadow-violet-500/5' },
              { label: 'Phase 3: Global Impact', value: scoreQuery.data?.phase3Score ?? 0, cap: null, color: 'from-emerald-400 to-teal-500', glow: 'shadow-emerald-500/5' },
            ].map(({ label, value, cap, color, glow }) => {
              const percent = cap ? Math.min(100, (value / cap) * 100) : 100;
              return (
                <div key={label} className={`group rounded-2xl border border-white/5 bg-slate-900/30 p-3.5 flex flex-col justify-between transition-all hover:bg-slate-900/50 hover:border-slate-800 ${glow}`}>
                  <div className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider truncate">{label.split(':')[0]}</div>
                  <div className="mt-2 flex items-baseline justify-between gap-1">
                    <span className="text-base font-extrabold text-white">{value}</span>
                    {cap !== null && <span className="text-[10px] text-slate-500 font-semibold">/ {cap}</span>}
                  </div>
                  {cap !== null ? (
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-950 overflow-hidden">
                      <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-1000 ease-out`} style={{ width: `${percent}%` }} />
                    </div>
                  ) : (
                    <div className="mt-2 text-[9px] text-emerald-400/80 font-bold uppercase tracking-wide flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> No cap
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-slate-800/80 px-5 py-5 sm:grid-cols-3 sm:px-6 bg-slate-950/40">
          {stats.map((stat) => (
            <Link
              to={stat.link}
              key={stat.label}
              className="group relative overflow-hidden rounded-2xl border border-white/5 bg-slate-900/30 p-4 transition-all duration-300 hover:-translate-y-1 hover:bg-slate-900/60 hover:border-slate-700/80 hover:shadow-lg hover:shadow-indigo-500/5 block"
              aria-label={`${stat.label}: ${stat.value}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950/60 text-slate-300 border border-white/5 transition-transform duration-300 group-hover:scale-110">
                    <stat.icon className="h-5 w-5 text-indigo-400 group-hover:text-indigo-300" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white tracking-tight">{stat.value}</div>
                    <div className="text-xs font-semibold text-slate-400 group-hover:text-slate-300 transition-colors uppercase tracking-wider">{stat.label}</div>
                  </div>
                </div>
                <div className="h-7 w-7 rounded-full bg-white/5 border border-white/5 flex items-center justify-center -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-200">
                  <ChevronRight className="h-4 w-4 text-cyan-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Workspace & activity */}
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 xl:col-span-2">
          <div className="flex flex-col gap-3 border-b border-slate-800 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-white">Mentorship Workspace</h2>
            <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1">
              <button
                onClick={() => setActiveWorkspaceTab('projects')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeWorkspaceTab === 'projects'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Startups & Projects ({dashboardQuery.data?.projectAssignments?.length ?? 0})
              </button>
              <button
                onClick={() => setActiveWorkspaceTab('programs')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeWorkspaceTab === 'programs'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Institutions ({dashboardQuery.data?.institutionPrograms?.length ?? 0})
              </button>
            </div>
          </div>

          <div className="p-5">
            {activeWorkspaceTab === 'projects' ? (
              (dashboardQuery.data?.projectAssignments ?? []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 py-10 text-center text-sm text-slate-400">
                  <BriefcaseBusiness className="mx-auto mb-2 h-7 w-7 text-slate-600" />
                  No project assignments yet.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {dashboardQuery.data?.projectAssignments.map((assignment) => (
                    <div
                      key={assignment.workspaceId}
                      className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/40 p-4 transition-colors hover:border-slate-700"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-semibold uppercase text-blue-300">
                            {assignment.category}
                          </span>
                          <span className="text-xs font-medium text-slate-500">Stage: {assignment.stage}</span>
                        </div>

                        <h3 className="mt-2.5 text-sm font-semibold leading-snug text-white">{assignment.title}</h3>
                        <p className="mt-0.5 text-xs text-slate-400">{assignment.startupName || 'Startup Workspace'}</p>

                        {assignment.students && assignment.students.length > 0 && (
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-500">Team:</span>
                            <div className="flex -space-x-2">
                              {assignment.students.map((student) => (
                                <div
                                  key={student._id}
                                  title={student.displayName}
                                  className="relative inline-block h-6 w-6 rounded-full border border-slate-900 bg-gradient-to-br from-indigo-500 to-purple-600 ring-2 ring-slate-900"
                                >
                                  {student.avatar ? (
                                    <img
                                      src={student.avatar}
                                      alt={student.displayName}
                                      className="h-full w-full rounded-full object-cover"
                                    />
                                  ) : (
                                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
                                      {student.displayName.slice(0, 1).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 border-t border-slate-800 pt-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-400">Progress: {assignment.progressPercent}%</span>
                          <span className="text-slate-500">Updated {new Date(assignment.updatedAt).toLocaleDateString('en-IN')}</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                            style={{ width: `${assignment.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (dashboardQuery.data?.institutionPrograms ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 py-10 text-center text-sm text-slate-400">
                <GraduationCap className="mx-auto mb-2 h-7 w-7 text-slate-600" />
                No institution programs assigned yet.
              </div>
            ) : (
              <div className="space-y-3">
                {dashboardQuery.data?.institutionPrograms.map((program) => {
                  const dateObj = dateToObj(program.scheduledAt || program.preferredDate);
                  return (
                    <div
                      key={program._id}
                      className="flex flex-col items-start gap-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 sm:flex-row"
                    >
                      <div className="flex w-full shrink-0 flex-row items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 p-2 sm:h-16 sm:w-14 sm:flex-col sm:gap-0">
                        <span className="text-xs font-bold tracking-wide text-violet-400">{dateObj.month}</span>
                        <span className="text-xl font-bold text-white">{dateObj.day}</span>
                        <span className="text-[11px] font-medium text-slate-500">{dateObj.year}</span>
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-violet-500/10 px-2 py-0.5 text-xs font-semibold uppercase text-violet-300">
                            {program.institution.type}
                          </span>
                          <Badge
                            className={
                              program.deliveryMode === 'Online'
                                ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                                : 'border-amber-500/20 bg-amber-500/5 text-amber-400'
                            }
                          >
                            {program.deliveryMode}
                          </Badge>
                          {program.platform && <span className="text-xs font-medium text-slate-500">{program.platform}</span>}
                        </div>

                        <h3 className="text-sm font-semibold text-white">{program.title}</h3>
                        <p className="text-xs font-medium text-slate-300">{program.institution.displayName}</p>
                        <p className="text-xs leading-relaxed text-slate-400">{program.objective}</p>

                        {program.preferredExpertise && (
                          <div className="inline-block rounded-lg border border-cyan-500/10 bg-cyan-950/20 px-2.5 py-1 text-xs font-medium text-cyan-200">
                            Requested competence: {program.preferredExpertise}
                          </div>
                        )}
                      </div>

                      <div className="flex w-full shrink-0 items-center justify-between gap-2 border-t border-slate-800 pt-3 text-right sm:w-auto sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                        <div className="text-left sm:text-right">
                          <span className="block text-xs font-medium text-slate-500">Expected</span>
                          <span className="text-sm font-semibold text-white">{program.expectedParticipants} Guests</span>
                        </div>
                        {program.meetingLink && (
                          <a
                            href={program.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-xs font-semibold text-blue-400 hover:text-blue-300"
                          >
                            Join Meet <ExternalLink className="ml-1 h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 px-5 py-3 text-center text-xs text-slate-500">
            Looking for open assignments? Go to{' '}
            <Link to="/dashboard/mentor/marketplace" className="text-cyan-400 hover:underline">
              Opportunity Marketplace
            </Link>
          </div>
        </section>

        {/* Live activity feed */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
            <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
            <Badge className="border-slate-700 bg-slate-950 text-slate-300">{filteredActivities.length}</Badge>
          </div>

          <div className="flex gap-1.5 border-b border-slate-800 px-5 py-3">
            {[
              { id: 'all', label: 'All' },
              { id: 'score', label: 'Points' },
              { id: 'patents', label: 'Patents' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActivityFilter(tab.id as 'all' | 'score' | 'patents')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  activityFilter === tab.id
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {dashboardQuery.isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner />
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 py-10 text-center text-sm text-slate-400">
                <Activity className="mx-auto mb-2 h-7 w-7 text-slate-600" />
                No activity matches this filter.
              </div>
            ) : (
              <div className="relative space-y-4 pl-4 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-px before:bg-slate-800">
                {filteredActivities.map((activity) => (
                  <div key={`${activity.studentId}-${activity.timestamp}`} className="relative">
                    <div className="absolute -left-[17px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-indigo-500" />

                    <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white">
                        {activity.avatar ? (
                          <img src={activity.avatar} alt={activity.studentName} className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          activity.studentName.slice(0, 1).toUpperCase()
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-white">{activity.studentName}</span>
                          <span className="shrink-0 text-xs text-slate-500">
                            {new Date(activity.timestamp).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">
                          {activity.trigger.replace(/_/g, ' ')}
                        </p>

                        {activity.delta > 0 && (
                          <div className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                            +{activity.delta} pts
                          </div>
                        )}

                        <div className="pt-1">
                          <button
                            onClick={() => navigate(getStudentPortfolioViewPath(activity.studentId))}
                            className="inline-flex items-center text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                          >
                            View profile <ChevronRight className="ml-0.5 h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Patent showcase */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-white">Student Patent Submissions</h2>
          <Badge className="border-yellow-500/20 bg-yellow-500/10 text-yellow-400">IP Showcase</Badge>
        </div>
        <div className="p-5">
          <PatentShowcase />
        </div>
      </section>
    </div>
  );
}
