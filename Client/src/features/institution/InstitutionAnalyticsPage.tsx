import { useQuery } from '@tanstack/react-query';
import {
  BriefcaseBusiness,
  GraduationCap,
  Rocket,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '../../components/ui/chart';
import { Spinner } from '../../components/ui/Spinner';
import type { CollegeDashboardData } from '../../types/college.types';
import type { InstitutionMentorshipProgramView } from '../../types/mentorship.types';
import type { InstitutionStartup, SchoolDashboardData } from '../../types/school.types';
import {
  DashboardEmpty,
  DashboardMetricRail,
  DashboardRow,
  DashboardSection,
} from './dashboardSurface';
import { InstitutionWorkspaceHeader } from './InstitutionWorkspaceHeader';

type InstitutionAnalyticsPageProps = {
  mode: 'school' | 'college';
  institutionLabel: 'School' | 'College';
  basePath: string;
  fetchDashboard: () => Promise<SchoolDashboardData | CollegeDashboardData>;
  fetchStartups: () => Promise<InstitutionStartup[]>;
  fetchMentorshipPrograms: () => Promise<InstitutionMentorshipProgramView>;
};

const HEADER_PANEL_CLASS_NAME =
  'overflow-hidden border border-[#1b2942] bg-[#08111f] px-5 py-6 shadow-[0_24px_80px_rgba(2,6,23,0.4)] sm:px-7';

const PANEL_CLASS_NAME =
  'border border-[#1c2435] bg-[#0a1220] px-5 py-6 shadow-[0_24px_80px_rgba(2,6,23,0.32)] sm:px-7';

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const formatStatusLabel = (value?: string | null) => (value ?? 'draft').replace(/_/g, ' ');

const hasCollegePlacementStats = (
  value: SchoolDashboardData['stats'] | CollegeDashboardData['stats'] | undefined,
): value is CollegeDashboardData['stats'] =>
  Boolean(value && 'studentsPlaced' in value && 'activeHRPartners' in value);

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

  const topStudents = (dashboardData?.topStudents ?? []).slice(0, 8);
  const latestStartups = startups.slice(0, 6);
  const latestMentorshipPrograms = [...(mentorship?.items ?? [])]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);
  const totalDistributionStudents = scoreDistribution.reduce(
    (sum, bucket) => sum + bucket.count,
    0,
  );
  const topDistributionBucket = scoreDistribution.reduce<(typeof scoreDistribution)[number] | null>(
    (highest, bucket) => {
      if (!highest || bucket.count > highest.count) {
        return bucket;
      }

      return highest;
    },
    null,
  );

  const overviewItems = [
    {
      label: 'Students',
      value: stats?.totalStudents ?? 0,
      helper: `${stats?.activeProjects ?? 0} active projects`,
      icon: Users,
      toneClassName: 'text-cyan-300',
      cardClassName: 'border-[#13425c] bg-[#0d2433]',
    },
    {
      label: 'Activity',
      value: stats?.totalInnovationActivities ?? 0,
      helper: `${recent?.scoreEventsLast30Days ?? 0} events in 30 days`,
      icon: Target,
      toneClassName: 'text-violet-300',
      cardClassName: 'border-[#49317a] bg-[#24163f]',
    },
    {
      label: 'Startups',
      value: stats?.startupsLaunched ?? 0,
      helper: `${recent?.startupsLast30Days ?? 0} updated in 30 days`,
      icon: Rocket,
      toneClassName: 'text-amber-300',
      cardClassName: 'border-[#6c4b16] bg-[#33240d]',
    },
    {
      label: 'Mentoring',
      value: stats?.totalMentoringHours ?? 0,
      helper: `${mentorship?.stats.assigned ?? 0} assigned programs`,
      icon: GraduationCap,
      toneClassName: 'text-emerald-300',
      cardClassName: 'border-[#1f5b49] bg-[#0f2b24]',
    },
  ];

  if (hasCollegePlacementStats(stats)) {
    overviewItems.push({
      label: 'Placed',
      value: studentsPlaced,
      helper: `${activeHrPartners} hiring partners`,
      icon: BriefcaseBusiness,
      toneClassName: 'text-blue-300',
      cardClassName: 'border-[#1d4674] bg-[#0d2238]',
    });
  }

  if (dashboardQuery.isLoading && startupsQuery.isLoading && mentorshipQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className={HEADER_PANEL_CLASS_NAME}>
        <InstitutionWorkspaceHeader
          mode={mode}
          eyebrow={`${institutionLabel} Workspace`}
          title={`${institutionLabel} Analytics`}
          description={`${institutionLabel} performance at a glance.`}
          showMenu={false}
        />
      </div>

      <div className={PANEL_CLASS_NAME}>
        <DashboardMetricRail
          items={overviewItems}
          columnsClassName={
            overviewItems.length > 4
              ? 'md:grid-cols-2 xl:grid-cols-5'
              : 'md:grid-cols-2 xl:grid-cols-4'
          }
        />
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.45fr),minmax(280px,0.55fr)]">
        <div className={PANEL_CLASS_NAME}>
          <DashboardSection
            eyebrow="Scores"
            title="Score Bands"
            action={
              <Link
                to={`${basePath}/students`}
                className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
              >
                Open student roster
              </Link>
            }
            className="border-t-0 pt-0"
          >
            {totalDistributionStudents === 0 ? (
              <DashboardEmpty message="No student scores available yet." />
            ) : (
              <div className="space-y-5">
                <div className="border border-[#1a2233] bg-[#0b1221] p-4">
                  <ChartContainer
                    config={{
                      count: {
                        label: 'Students',
                        color: '#3b82f6',
                      },
                    }}
                    className="h-80 w-full"
                  >
                    <BarChart
                      data={scoreDistribution}
                      margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        vertical={false}
                        strokeDasharray="3 3"
                        stroke="rgba(148, 163, 184, 0.18)"
                      />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            formatter={(value) => <>{value} students</>}
                            labelFormatter={(label) => `Score band ${label}`}
                          />
                        }
                      />
                      <Bar
                        dataKey="count"
                        radius={[10, 10, 0, 0]}
                        fill="var(--color-count)"
                      />
                    </BarChart>
                  </ChartContainer>
                </div>

                <div className="grid gap-4 border border-[#1a2233] bg-[#0b1221] px-4 py-4 sm:grid-cols-3">
                  <InlineMetric
                    label="Scored"
                    value={String(totalDistributionStudents)}
                    helper="students in the current score model"
                  />
                  <InlineMetric
                    label="Largest band"
                    value={topDistributionBucket?.label ?? 'N/A'}
                    helper={
                      topDistributionBucket
                        ? `${topDistributionBucket.count} students`
                        : 'waiting for score activity'
                    }
                  />
                  <InlineMetric
                    label="Patents filed"
                    value={String(stats?.patentsFiled ?? 0)}
                    helper="institution total"
                  />
                </div>
              </div>
            )}
          </DashboardSection>
        </div>

        <section className={PANEL_CLASS_NAME}>
          <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">Quick Read</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Current Signals</h2>
          <div className="mt-6 border border-[#1a2233] bg-[#0b1221]">
            <DashboardRow className="px-4">
              <SignalRow
                label="Last 30 days"
                value={`${recent?.scoreEventsLast30Days ?? 0} score events`}
                detail={`${recent?.patentsLast30Days ?? 0} patents and ${recent?.startupsLast30Days ?? 0} startup updates`}
              />
            </DashboardRow>
            <DashboardRow className="px-4">
              <SignalRow
                label="Institution output"
                value={`${stats?.industryCollaborations ?? 0} collaborations`}
                detail={`${stats?.totalMentoringHours ?? 0} mentoring hours logged`}
              />
            </DashboardRow>
            <DashboardRow className="px-4">
              <SignalRow
                label={hasCollegePlacementStats(stats) ? 'Placement' : 'Projects'}
                value={
                  hasCollegePlacementStats(stats)
                    ? `${studentsPlaced} students placed`
                    : `${stats?.activeProjects ?? 0} active projects`
                }
                detail={
                  hasCollegePlacementStats(stats)
                    ? `${activeHrPartners} hiring partners active`
                    : `${stats?.totalInnovationActivities ?? 0} innovation activities tracked`
                }
              />
            </DashboardRow>
          </div>
        </section>
      </div>

      <div className={PANEL_CLASS_NAME}>
        <DashboardSection
          eyebrow="Students"
          title="Top Students"
          action={
            <Link
              to={`${basePath}/students`}
              className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
            >
              View leaderboard
            </Link>
          }
          className="border-t-0 pt-0"
        >
          {topStudents.length === 0 ? (
            <DashboardEmpty message="No student activity records available yet." />
          ) : (
            <div className="border border-[#1a2233] bg-[#0b1221]">
              {topStudents.map((student) => (
                <DashboardRow key={student._id} className="px-4 transition hover:bg-[#0b1323]">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr),120px,120px,120px] md:items-center">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-white">
                        {student.displayName}
                      </div>
                      <div className="truncate text-sm text-slate-400">
                        {student.activeProject?.title ?? 'No active workspace'}
                        {student.activeProject ? ` - ${student.activeProject.progressPercent}%` : ''}
                      </div>
                    </div>
                    <DataPoint label="Rank" value={`#${student.rank}`} />
                    <DataPoint label="Score" value={String(student.innovationScore)} />
                    <DataPoint
                      label="Outputs"
                      value={`${student.scoreBreakdown.patentsSubmitted}P / ${student.scoreBreakdown.startupsLaunched}S`}
                    />
                  </div>
                </DashboardRow>
              ))}
            </div>
          )}
        </DashboardSection>
      </div>

      <div className={PANEL_CLASS_NAME}>
        <DashboardSection
          eyebrow="Startups"
          title="Recent Startups"
          className="border-t-0 pt-0"
        >
          {startupsQuery.isLoading ? (
            <DashboardEmpty message="Loading startup activity..." />
          ) : latestStartups.length === 0 ? (
            <DashboardEmpty message="No startups linked yet." />
          ) : (
            <div className="border border-[#1a2233] bg-[#0b1221]">
              {latestStartups.map((startup) => (
                <DashboardRow key={startup._id} className="px-4 transition hover:bg-[#0b1323]">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr),120px,140px,1fr] md:items-center">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-white">
                        {startup.name}
                      </div>
                      <div className="truncate text-sm text-slate-400">
                        {startup.founderNames.join(', ') || 'Founders not mapped'}
                      </div>
                    </div>
                    <DataPoint label="Stage" value={startup.stage} />
                    <DataPoint label="Category" value={startup.category} />
                    <DataPoint label="Status" value={formatStatusLabel(startup.reviewStatus)} />
                  </div>
                </DashboardRow>
              ))}
            </div>
          )}
        </DashboardSection>
      </div>

      <div className={PANEL_CLASS_NAME}>
        <DashboardSection
          eyebrow="Mentorship"
          title="Program Queue"
          action={
            <Link
              to={`${basePath}/events?tab=mentorship`}
              className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
            >
              Open mentorship
            </Link>
          }
          className="border-t-0 pt-0"
        >
          <div className="border border-[#1a2233] bg-[#0b1221] px-4 py-4">
            <DashboardMetricRail
              items={[
                {
                  label: 'Requests',
                  value: mentorship?.stats.total ?? 0,
                  helper: 'total programs',
                  icon: GraduationCap,
                  toneClassName: 'text-cyan-300',
                },
                {
                  label: 'Pending',
                  value: mentorship?.stats.pending ?? 0,
                  helper: 'waiting for assignment',
                  icon: TrendingUp,
                  toneClassName: 'text-amber-300',
                },
                {
                  label: 'Assigned',
                  value: mentorship?.stats.assigned ?? 0,
                  helper: 'active programs',
                  icon: Users,
                  toneClassName: 'text-emerald-300',
                },
                {
                  label: 'Rejected',
                  value: mentorship?.stats.rejected ?? 0,
                  helper: 'closed requests',
                  icon: BriefcaseBusiness,
                  toneClassName: 'text-rose-300',
                },
              ]}
              columnsClassName="md:grid-cols-2 xl:grid-cols-4"
            />
          </div>

          <div className="mt-6">
            {latestMentorshipPrograms.length === 0 ? (
              <DashboardEmpty
                message={
                  mentorshipQuery.isLoading
                    ? 'Loading mentorship data...'
                    : 'No mentorship programs available yet.'
                }
              />
            ) : (
              <div className="border border-[#1a2233] bg-[#0b1221]">
                {latestMentorshipPrograms.map((program) => (
                  <DashboardRow key={program._id} className="px-4 transition hover:bg-[#0b1323]">
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr),120px,140px,140px] md:items-center">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-white">
                          {program.title}
                        </div>
                        <div className="truncate text-sm text-slate-400">{program.objective}</div>
                      </div>
                      <DataPoint label="Status" value={program.status} />
                      <DataPoint label="Mode" value={program.deliveryMode} />
                      <DataPoint
                        label="Next date"
                        value={program.preferredDate ? formatDate(program.preferredDate) : 'TBD'}
                      />
                    </div>
                  </DashboardRow>
                ))}
              </div>
            )}
          </div>
        </DashboardSection>
      </div>
    </div>
  );
}

function InlineMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500">{label}</div>
      <div className="text-3xl font-semibold text-white">{value}</div>
      <div className="text-sm text-slate-400">{helper}</div>
    </div>
  );
}

function SignalRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="text-sm text-slate-400">{detail}</div>
    </div>
  );
}

function DataPoint({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-200">{value}</div>
    </div>
  );
}
