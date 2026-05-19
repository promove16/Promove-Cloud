import { useQuery } from '@tanstack/react-query';
import {
  Award,
  CalendarClock,
  FileCheck2,
  FolderKanban,
  Handshake,
  Lightbulb,
  type LucideIcon,
  Rocket,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { schoolApi } from '../../api/school.api';
import type {
  ComplianceAuditItem,
  DashboardEvent,
  RecentProject,
} from '../../types/school.types';
import { InstitutionOverviewDashboard } from '../institution/InstitutionOverviewDashboard';
import { getStudentPortfolioViewPath } from '../marketplace/navigation';

type SortableActivityItem = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  icon: LucideIcon;
  to?: string;
  iconClassName?: string;
  sortTime: number;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const buildSchoolActivityItems = ({
  recentProjects,
  upcomingEvents,
  auditTrail,
}: {
  recentProjects: RecentProject[];
  upcomingEvents: DashboardEvent[];
  auditTrail: ComplianceAuditItem[];
}) =>
  [
    ...recentProjects.slice(0, 3).map(
      (project) =>
        ({
          id: `project-${project._id}`,
          title: project.title,
          detail: `${project.studentName} updated the ${project.stage.toLowerCase()} stage in ${project.category}.`,
          meta: `Project update - ${formatDate(project.updatedAt)}`,
          icon: FolderKanban,
          iconClassName: 'text-cyan-200',
          sortTime: new Date(project.updatedAt).getTime(),
        }) satisfies SortableActivityItem,
    ),
    ...upcomingEvents.slice(0, 2).map(
      (event) =>
        ({
          id: `event-${event._id}`,
          title: event.title,
          detail: `${event.type} is scheduled with ${event.participantsCount} participants.`,
          meta: `Upcoming event - ${formatDate(event.scheduledAt)}`,
          icon: CalendarClock,
          to: '/dashboard/school/events',
          iconClassName: 'text-violet-200',
          sortTime: new Date(event.scheduledAt).getTime(),
        }) satisfies SortableActivityItem,
    ),
    ...auditTrail.slice(0, 2).map(
      (entry) =>
        ({
          id: `audit-${entry._id}`,
          title: entry.title,
          detail: entry.detail,
          meta: `Compliance ${entry.type} - ${formatDate(entry.createdAt)}`,
          icon: ShieldAlert,
          iconClassName: 'text-amber-200',
          sortTime: new Date(entry.createdAt).getTime(),
        }) satisfies SortableActivityItem,
    ),
  ]
    .sort((left, right) => right.sortTime - left.sortTime)
    .slice(0, 6)
    .map(({ sortTime: _sortTime, ...item }) => item);

export default function Dashboard() {
  const dashboardQuery = useQuery({
    queryKey: ['school-dashboard'],
    queryFn: schoolApi.getDashboard,
  });
  const complianceOverviewQuery = useQuery({
    queryKey: ['school-compliance-overview'],
    queryFn: schoolApi.getComplianceOverview,
  });
  const latestReportQuery = useQuery({
    queryKey: ['school-latest-report'],
    queryFn: schoolApi.getLatestComplianceReport,
  });
  const investorsQuery = useQuery({
    queryKey: ['school-investors', 'dashboard'],
    queryFn: schoolApi.getInvestors,
  });

  const data = dashboardQuery.data;
  const stats = data?.stats;
  const recentActivity = data?.recentActivityCounts;
  const institutionProfile = data?.institutionProfile;
  const complianceOverview = complianceOverviewQuery.data;
  const latestReport = latestReportQuery.data;
  const investorCount = investorsQuery.data?.length ?? 0;
  const academicYear = institutionProfile?.academicYear ?? 'Current AY';
  const iicRating = institutionProfile?.iicStarRating ?? 0;

  return (
    <InstitutionOverviewDashboard
      institutionLabel="School Workspace"
      institutionName={institutionProfile?.institutionName ?? 'School Dashboard'}
      subtitle="Track innovation output, student roster momentum, and compliance readiness from one operational workspace."
      academicYear={academicYear}
      headerAction={
        latestReport
          ? {
              label: 'Download Compliance Report',
              onClick: () => window.open(latestReport.pdfUrl, '_blank', 'noopener,noreferrer'),
            }
          : undefined
      }
      statCards={[
        {
          label: 'Student Innovators',
          value: stats?.totalStudents ?? 0,
          helper: 'Verified and active in the institution workspace',
          icon: Users,
          iconClassName: 'text-cyan-200',
          accentClassName: 'bg-cyan-400',
          to: '/dashboard/school/students',
        },
        {
          label: 'Innovation Activities',
          value: stats?.totalInnovationActivities ?? 0,
          helper: `${recentActivity?.scoreEventsLast30Days ?? 0} score events recorded in 30 days`,
          icon: Lightbulb,
          iconClassName: 'text-fuchsia-200',
          accentClassName: 'bg-fuchsia-400',
          to: '/dashboard/school/projects',
        },
        {
          label: 'Patents Filed',
          value: stats?.patentsFiled ?? 0,
          helper: `+${recentActivity?.patentsLast30Days ?? 0} new patent records this month`,
          icon: FileCheck2,
          iconClassName: 'text-amber-200',
          accentClassName: 'bg-amber-400',
          to: '/dashboard/school/patents',
        },
        {
          label: 'Mentoring Hours',
          value: stats?.totalMentoringHours ?? 0,
          helper: 'Mentor guidance logged across the school pipeline',
          icon: Award,
          iconClassName: 'text-emerald-200',
          accentClassName: 'bg-emerald-400',
          to: '/dashboard/school/mentors',
        },
        {
          label: 'Startups Launched',
          value: stats?.startupsLaunched ?? 0,
          helper: `+${recentActivity?.startupsLast30Days ?? 0} startup updates in 30 days`,
          icon: Rocket,
          iconClassName: 'text-rose-200',
          accentClassName: 'bg-rose-400',
          to: '/dashboard/school/startups',
        },
        {
          label: 'Industry Links',
          value: stats?.industryCollaborations ?? 0,
          helper: `${investorCount} investors currently visible to the institution`,
          icon: Handshake,
          iconClassName: 'text-blue-200',
          accentClassName: 'bg-blue-400',
          to: '/dashboard/school/investors',
        },
      ]}
      connectionTitle="Connected to ProMove Innovation Cloud"
      connectionDescription="Roster intake, innovation tracking, project delivery, and compliance monitoring are all active for this school workspace."
      connectionTag="Verified"
      connectionChips={[
        { label: 'Investors', value: String(investorCount) },
        { label: 'Upcoming Events', value: String(data?.upcomingEvents.length ?? 0) },
        {
          label: 'Frameworks',
          value: String(
            complianceOverview?.frameworkSummary.total ??
              institutionProfile?.policies.length ??
              0,
          ),
        },
      ]}
      ratingValue={iicRating}
      ratingUpdatedAt={institutionProfile?.iicLastUpdated}
      ratingTitle="School Innovation Readiness Estimator"
      ratingCurrentLabel="Current school readiness score"
      ratingSummary="The score blends ATL/SQAAF-aligned activity, student project velocity, patent activity, mentorship coverage, and external collaboration signals."
      ratingBreakdown={[
        {
          label: 'Innovation activities completed',
          value: stats?.totalInnovationActivities ?? 0,
          helper: 'Signals influencing institutional innovation readiness',
          icon: Lightbulb,
          to: '/dashboard/school/projects',
          iconClassName: 'text-cyan-200',
        },
        {
          label: 'Student innovators onboarded',
          value: stats?.totalStudents ?? 0,
          helper: 'Active student roster with visible innovation participation',
          icon: Users,
          to: '/dashboard/school/students',
          iconClassName: 'text-blue-200',
        },
        {
          label: 'Patents filed',
          value: stats?.patentsFiled ?? 0,
          helper: 'Institution patent submissions captured in ProMove',
          icon: FileCheck2,
          to: '/dashboard/school/patents',
          iconClassName: 'text-amber-200',
        },
        {
          label: 'Mentoring hours logged',
          value: stats?.totalMentoringHours ?? 0,
          helper: 'Recorded support from the mentorship workflow',
          icon: Award,
          to: '/dashboard/school/mentors',
          iconClassName: 'text-emerald-200',
        },
        {
          label: 'Industry collaborations',
          value: stats?.industryCollaborations ?? 0,
          helper: 'Ecosystem partnerships attached to this campus',
          icon: Handshake,
          to: '/dashboard/school/investors',
          iconClassName: 'text-violet-200',
        },
      ]}
      ratingNote="The strongest gains usually come from consistent project updates, patent filings, and verified mentoring coverage."
      complianceFrameworks={complianceOverview?.frameworks ?? []}
      complianceSummary={
        complianceOverview
          ? {
              frameworkSummary: complianceOverview.frameworkSummary,
              incidentSummary: complianceOverview.incidentSummary,
              alertSummary: complianceOverview.alertSummary,
              actionSummary: complianceOverview.actionSummary,
            }
          : undefined
      }
      latestReport={latestReport}
      complianceAction={{ label: 'View all', to: '/dashboard/school/compliance' }}
      topInnovatorsTitle="Top Innovators"
      topInnovatorsAction={{ label: 'View all', to: '/dashboard/school/students' }}
      topInnovatorsEmptyMessage="No ranked student activity is available yet."
      topStudents={data?.topStudents ?? []}
      studentTo={(student) => getStudentPortfolioViewPath(student._id)}
      activityTitle="Recent Activity"
      activityAction={{ label: 'View all', to: '/dashboard/school/operations' }}
      activityItems={buildSchoolActivityItems({
        recentProjects: data?.recentProjects ?? [],
        upcomingEvents: data?.upcomingEvents ?? [],
        auditTrail: complianceOverview?.auditTrail ?? [],
      })}
      activityEmptyMessage="No recent school activity is available yet."
      isLoading={
        dashboardQuery.isLoading ||
        complianceOverviewQuery.isLoading ||
        latestReportQuery.isLoading
      }
    />
  );
}
