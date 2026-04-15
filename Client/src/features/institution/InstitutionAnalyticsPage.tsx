import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, BriefcaseBusiness, GraduationCap, Rocket, Target, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '../../app/components/ui/chart';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import type { CollegeDashboardData } from '../../types/college.types';
import type { InstitutionMentorshipProgramView } from '../../types/mentorship.types';
import type { InstitutionStartup, SchoolDashboardData } from '../../types/school.types';
import { DashboardEmpty, DashboardSection } from './dashboardSurface';
import { InstitutionWorkspaceHeader } from './InstitutionWorkspaceHeader';

type InstitutionAnalyticsPageProps = {
  mode: 'school' | 'college';
  institutionLabel: 'School' | 'College';
  basePath: string;
  fetchDashboard: () => Promise<SchoolDashboardData | CollegeDashboardData>;
  fetchStartups: () => Promise<InstitutionStartup[]>;
  fetchMentorshipPrograms: () => Promise<InstitutionMentorshipProgramView>;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const formatStatusLabel = (value?: string | null) => (value ?? 'draft').replace(/_/g, ' ');

const hasCollegePlacementStats = (
  value: SchoolDashboardData['stats'] | CollegeDashboardData['stats'] | undefined,
): value is CollegeDashboardData['stats'] => Boolean(value && 'studentsPlaced' in value && 'activeHRPartners' in value);

export function InstitutionAnalyticsPage({
  mode,
  institutionLabel,
  basePath,
  fetchDashboard,
  fetchStartups,
  fetchMentorshipPrograms,
}: InstitutionAnalyticsPageProps) {
  const dashboardQuery = useQuery({
    queryKey: [`${mode}-analytics-dashboard`],
    queryFn: fetchDashboard,
  });

  const startupsQuery = useQuery({
    queryKey: [`${mode}-analytics-startups`],
    queryFn: fetchStartups,
  });

  const mentorshipQuery = useQuery({
    queryKey: [`${mode}-analytics-mentorship`],
    queryFn: fetchMentorshipPrograms,
  });

  const dashboardData = dashboardQuery.data;
  const stats = dashboardData?.stats;
  const recent = dashboardData?.recentActivityCounts;
  const startups = startupsQuery.data ?? [];
  const mentorship = mentorshipQuery.data;
  const scoreDistribution = dashboardData?.innovationScoreDistribution ?? [];
  const studentsPlaced = hasCollegePlacementStats(stats) ? stats.studentsPlaced ?? 0 : 0;
  const activeHrPartners = hasCollegePlacementStats(stats) ? stats.activeHRPartners ?? 0 : 0;

  const topStudents = useMemo(() => (dashboardData?.topStudents ?? []).slice(0, 8), [dashboardData?.topStudents]);
  const latestStartups = useMemo(() => startups.slice(0, 6), [startups]);
  const latestMentorshipPrograms = useMemo(
    () =>
      [...(mentorship?.items ?? [])]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 6),
    [mentorship?.items],
  );
  const totalDistributionStudents = useMemo(
    () => scoreDistribution.reduce((sum, bucket) => sum + bucket.count, 0),
    [scoreDistribution],
  );
  const topDistributionBucket = useMemo(
    () =>
      scoreDistribution.reduce<(typeof scoreDistribution)[number] | null>(
        (highest, bucket) => {
          if (!highest || bucket.count > highest.count) {
            return bucket;
          }

          return highest;
        },
        null,
      ),
    [scoreDistribution],
  );

  if (dashboardQuery.isLoading && startupsQuery.isLoading && mentorshipQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <InstitutionWorkspaceHeader
        mode={mode}
        eyebrow={`${institutionLabel} Workspace`}
        title={`${institutionLabel} Analytics`}
        description={`Live student activity, startup momentum, and mentorship pipeline insights for your ${institutionLabel.toLowerCase()}.`}
        showMenu={false}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-cyan-300">
            <Users className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.22em]">Students</span>
          </div>
          <div className="mt-3 text-3xl font-semibold text-white">{stats?.totalStudents ?? 0}</div>
          <div className="mt-1 text-sm text-slate-400">{stats?.activeProjects ?? 0} active projects</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-violet-300">
            <Target className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.22em]">Activity</span>
          </div>
          <div className="mt-3 text-3xl font-semibold text-white">{stats?.totalInnovationActivities ?? 0}</div>
          <div className="mt-1 text-sm text-slate-400">{recent?.scoreEventsLast30Days ?? 0} score events in 30d</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-amber-300">
            <Rocket className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.22em]">Startups</span>
          </div>
          <div className="mt-3 text-3xl font-semibold text-white">{stats?.startupsLaunched ?? 0}</div>
          <div className="mt-1 text-sm text-slate-400">{recent?.startupsLast30Days ?? 0} launched in 30d</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-emerald-300">
            <GraduationCap className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.22em]">Mentorship</span>
          </div>
          <div className="mt-3 text-3xl font-semibold text-white">{stats?.totalMentoringHours ?? 0}</div>
          <div className="mt-1 text-sm text-slate-400">{mentorship?.stats.assigned ?? 0} assigned programs</div>
        </Card>
      </section>

      <DashboardSection
        eyebrow="Innovation Score"
        title="Innovation Score Distribution"
        description="See how the full institution roster is distributed across score bands, not just the top-ranked students."
        action={<Link to={`${basePath}/students`} className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">Open student roster</Link>}
      >
        {totalDistributionStudents === 0 ? (
          <DashboardEmpty message="No student scores are available yet." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr),minmax(280px,0.6fr)]">
            <Card className="p-5">
              <ChartContainer
                config={{
                  count: {
                    label: 'Students',
                    color: '#22d3ee',
                  },
                }}
                className="h-80 w-full"
              >
                <BarChart data={scoreDistribution} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent formatter={(value) => <>{value} students</>} labelFormatter={(label) => `Score band ${label}`} />}
                  />
                  <Bar dataKey="count" radius={[12, 12, 0, 0]} fill="var(--color-count)" />
                </BarChart>
              </ChartContainer>
            </Card>

            <div className="grid gap-4">
              <Card className="p-5">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Scored Students</div>
                <div className="mt-2 text-3xl font-semibold text-white">{totalDistributionStudents}</div>
                <div className="mt-2 text-sm text-slate-400">Students currently included in institution-wide innovation scoring.</div>
              </Card>
              <Card className="p-5">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Largest Band</div>
                <div className="mt-2 text-3xl font-semibold text-white">{topDistributionBucket?.label ?? 'N/A'}</div>
                <div className="mt-2 text-sm text-slate-400">
                  {topDistributionBucket ? `${topDistributionBucket.count} students currently sit in this score range.` : 'Score distribution will appear once students start generating activity.'}
                </div>
              </Card>
            </div>
          </div>
        )}
      </DashboardSection>

      <DashboardSection
        eyebrow="Student Activity"
        title="Top Innovators Snapshot"
        description="Current student performance by innovation score, patents, startup launches, and recent project progress."
        action={<Link to={`${basePath}/students`} className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">View full leaderboard</Link>}
      >
        {topStudents.length === 0 ? (
          <DashboardEmpty message="No student activity records are available yet." />
        ) : (
          <div className="grid gap-3">
            {topStudents.map((student) => (
              <Card key={student._id} className="p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-base font-semibold text-white">{student.displayName}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {student.activeProject?.title ?? 'No active workspace'} {student.activeProject ? `(${student.activeProject.progressPercent}% progress)` : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">Rank #{student.rank}</span>
                    <span className="rounded-full border border-cyan-900/60 bg-cyan-500/10 px-3 py-1 text-cyan-200">Score {student.innovationScore}</span>
                    <span className="rounded-full border border-emerald-900/60 bg-emerald-500/10 px-3 py-1 text-emerald-200">Patents {student.scoreBreakdown.patentsSubmitted}</span>
                    <span className="rounded-full border border-amber-900/60 bg-amber-500/10 px-3 py-1 text-amber-200">Startups {student.scoreBreakdown.startupsLaunched}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </DashboardSection>

      <DashboardSection
        eyebrow="Startup Pipeline"
        title="Recent Startup Activity"
        description="Track newly linked startups, review status, founder coverage, and launch stage progress."
        action={<Link to={`${basePath}/startups`} className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">Open startups workspace</Link>}
      >
        {startupsQuery.isLoading ? (
          <DashboardEmpty message="Loading startup analytics..." />
        ) : latestStartups.length === 0 ? (
          <DashboardEmpty message="No startup records are available for this institution." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {latestStartups.map((startup) => (
              <Card key={startup._id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold text-white">{startup.name}</div>
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{startup.stage}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-400">{startup.tagline}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">{startup.category}</span>
                  <span className="rounded-full border border-violet-900/60 bg-violet-500/10 px-2 py-1 text-violet-200">{formatStatusLabel(startup.reviewStatus)}</span>
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  Founders: {startup.founderNames.join(', ') || 'Not mapped'}
                </div>
              </Card>
            ))}
          </div>
        )}
      </DashboardSection>

      <DashboardSection
        eyebrow="Mentorship"
        title="Mentorship Program Details"
        description="Pending vs assigned program status, mentor mapping, and next scheduled requests."
        action={<Link to={`${basePath}/mentors`} className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">Open mentorship workspace</Link>}
      >
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Total Requests</div>
            <div className="mt-2 text-2xl font-semibold text-white">{mentorship?.stats.total ?? 0}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Pending</div>
            <div className="mt-2 text-2xl font-semibold text-amber-300">{mentorship?.stats.pending ?? 0}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Assigned</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-300">{mentorship?.stats.assigned ?? 0}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Rejected</div>
            <div className="mt-2 text-2xl font-semibold text-rose-300">{mentorship?.stats.rejected ?? 0}</div>
          </Card>
        </div>
        <div className="mt-4 grid gap-3">
          {latestMentorshipPrograms.length === 0 ? (
            <DashboardEmpty message={mentorshipQuery.isLoading ? 'Loading mentorship data...' : 'No mentorship programs available yet.'} />
          ) : (
            latestMentorshipPrograms.map((program) => (
              <Card key={program._id} className="p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-base font-semibold text-white">{program.title}</div>
                    <div className="mt-1 text-sm text-slate-400">{program.objective}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      Preferred: {formatDate(program.preferredDate)} • Participants: {program.expectedParticipants}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">{program.status}</span>
                    <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">{program.deliveryMode}</span>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </DashboardSection>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-cyan-300">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.22em]">Last 30 Days</span>
          </div>
          <div className="mt-3 text-sm text-slate-300">{recent?.scoreEventsLast30Days ?? 0} student score events</div>
          <div className="mt-1 text-sm text-slate-300">{recent?.patentsLast30Days ?? 0} patent submissions</div>
          <div className="mt-1 text-sm text-slate-300">{recent?.startupsLast30Days ?? 0} startup launches</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-violet-300">
            <BarChart3 className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.22em]">Institution Output</span>
          </div>
          <div className="mt-3 text-sm text-slate-300">Patents filed: {stats?.patentsFiled ?? 0}</div>
          <div className="mt-1 text-sm text-slate-300">Industry collaborations: {stats?.industryCollaborations ?? 0}</div>
          <div className="mt-1 text-sm text-slate-300">Mentoring hours: {stats?.totalMentoringHours ?? 0}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-emerald-300">
            <BriefcaseBusiness className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.22em]">Placement Signals</span>
          </div>
          <div className="mt-3 text-sm text-slate-300">Students placed: {studentsPlaced}</div>
          <div className="mt-1 text-sm text-slate-300">Active HR partners: {activeHrPartners}</div>
          <div className="mt-1 text-sm text-slate-300">Innovation activities: {stats?.totalInnovationActivities ?? 0}</div>
        </Card>
      </section>
    </div>
  );
}
