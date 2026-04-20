import { useQuery } from '@tanstack/react-query';
import {
  BriefcaseBusiness,
  FileCheck2,
  FolderKanban,
  Handshake,
  LineChart,
  type LucideIcon,
  Rocket,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react';
import { collegeApi } from '../../api/college.api';
import type { PlacementRecordView } from '../../types/placement.types';
import type {
  ComplianceAuditItem,
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

const buildCollegeActivityItems = ({
  placementRecords,
  recentProjects,
  auditTrail,
}: {
  placementRecords: PlacementRecordView[];
  recentProjects: RecentProject[];
  auditTrail: ComplianceAuditItem[];
}) =>
  [
    ...placementRecords.slice(0, 3).map(
      (record) =>
        ({
          id: `placement-${record._id}`,
          title: `${record.studentName} marked ${record.status}`,
          detail: `${record.companyName ?? record.recruiterName ?? 'Placement partner'} updated the hiring outcome for this student innovator.`,
          meta: `Placement tracker - ${formatDate(record.updatedAt)}`,
          icon: BriefcaseBusiness,
          to: '/dashboard/college/placement',
          iconClassName: 'text-emerald-200',
          sortTime: new Date(record.updatedAt).getTime(),
        }) satisfies SortableActivityItem,
    ),
    ...recentProjects.slice(0, 2).map(
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
    queryKey: ['college-dashboard'],
    queryFn: collegeApi.getDashboard,
  });
  const complianceOverviewQuery = useQuery({
    queryKey: ['college-compliance-overview'],
    queryFn: collegeApi.getComplianceOverview,
  });
  const latestReportQuery = useQuery({
    queryKey: ['college-latest-report'],
    queryFn: collegeApi.getLatestComplianceReport,
  });
  const investorsQuery = useQuery({
    queryKey: ['college-investors', 'dashboard'],
    queryFn: collegeApi.getInvestors,
  });
  const placementQuery = useQuery({
    queryKey: ['college-placement', 'dashboard'],
    queryFn: collegeApi.getPlacementTracker,
  });

  const data = dashboardQuery.data;
  const stats = data?.stats;
  const institutionProfile = data?.institutionProfile;
  const recentActivity = data?.recentActivityCounts;
  const complianceOverview = complianceOverviewQuery.data;
  const latestReport = latestReportQuery.data;
  const investors = investorsQuery.data ?? [];
  const placementData = placementQuery.data;
  const academicYear = institutionProfile?.academicYear ?? 'Current AY';
  const iicRating = institutionProfile?.iicStarRating ?? 0;

  return (
    <InstitutionOverviewDashboard
      institutionLabel="College Workspace"
      institutionName={institutionProfile?.institutionName ?? 'College Dashboard'}
      subtitle="Monitor innovation delivery, placement velocity, recruiter traction, and accreditation signals from a single workspace."
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
          helper: 'College students active in the innovation stack',
          icon: Users,
          iconClassName: 'text-cyan-200',
          accentClassName: 'bg-cyan-400',
          to: '/dashboard/college/students',
        },
        {
          label: 'Active Projects',
          value: stats?.activeProjects ?? 0,
          helper: `${recentActivity?.scoreEventsLast30Days ?? 0} score events recorded in 30 days`,
          icon: FolderKanban,
          iconClassName: 'text-blue-200',
          accentClassName: 'bg-blue-400',
          to: '/dashboard/college/projects',
        },
        {
          label: 'Placement Velocity',
          value: `${stats?.placementVelocity ?? 0}%`,
          helper: 'Current rate based on tracked placement outcomes',
          icon: TrendingUp,
          iconClassName: 'text-emerald-200',
          accentClassName: 'bg-emerald-400',
          to: '/dashboard/college/placement/velocity',
        },
        {
          label: 'Students Placed',
          value: stats?.studentsPlaced ?? 0,
          helper: `${placementData?.hiringPartners.length ?? 0} hiring partners active`,
          icon: BriefcaseBusiness,
          iconClassName: 'text-amber-200',
          accentClassName: 'bg-amber-400',
          to: '/dashboard/college/placement/students-placed',
        },
        {
          label: 'Startup Launches',
          value: stats?.startupsLaunched ?? 0,
          helper: `+${recentActivity?.startupsLast30Days ?? 0} startup updates in 30 days`,
          icon: Rocket,
          iconClassName: 'text-rose-200',
          accentClassName: 'bg-rose-400',
          to: '/dashboard/college/startups',
        },
        {
          label: 'Recruiter Partners',
          value: stats?.activeHRPartners ?? 0,
          helper: `${investors.length} investors visible to the college ecosystem`,
          icon: Handshake,
          iconClassName: 'text-violet-200',
          accentClassName: 'bg-violet-400',
          to: '/dashboard/college/recruiters',
        },
      ]}
      connectionTitle="Connected to ProMove Innovation Cloud"
      connectionDescription="Placement tracking, recruiter coordination, startup visibility, compliance monitoring, and student innovation operations are all active for this college workspace."
      connectionTag="Verified"
      connectionChips={[
        { label: 'Hiring Partners', value: String(placementData?.hiringPartners.length ?? 0) },
        { label: 'Investor Access', value: String(investors.length) },
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
      ratingSummary="The score combines the published IIC rating with project throughput, placement performance, startup launches, mentoring coverage, and employer engagement."
      ratingBreakdown={[
        {
          label: 'Innovation activities completed',
          value: stats?.totalInnovationActivities ?? 0,
          helper: 'Innovation activity captured across the college pipeline',
          icon: LineChart,
          to: '/dashboard/college/analytics',
          iconClassName: 'text-cyan-200',
        },
        {
          label: 'Students placed',
          value: stats?.studentsPlaced ?? 0,
          helper: 'Placement statuses verified in the hiring tracker',
          icon: BriefcaseBusiness,
          to: '/dashboard/college/placement/students-placed',
          iconClassName: 'text-emerald-200',
        },
        {
          label: 'Active projects',
          value: stats?.activeProjects ?? 0,
          helper: 'Innovation workspaces pushing through the pipeline',
          icon: FolderKanban,
          to: '/dashboard/college/projects',
          iconClassName: 'text-blue-200',
        },
        {
          label: 'Startup launches',
          value: stats?.startupsLaunched ?? 0,
          helper: 'College startups currently visible in the ecosystem',
          icon: Rocket,
          to: '/dashboard/college/startups',
          iconClassName: 'text-rose-200',
        },
        {
          label: 'Mentoring hours logged',
          value: stats?.totalMentoringHours ?? 0,
          helper: 'Structured mentor support recorded for innovators',
          icon: Handshake,
          to: '/dashboard/college/mentors',
          iconClassName: 'text-amber-200',
        },
      ]}
      ratingNote="Colleges with strong update cadence across placements, startup proof, and framework reviews usually move the rating faster."
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
      complianceAction={{ label: 'View all', to: '/dashboard/college/analytics' }}
      topInnovatorsTitle="Top Innovators"
      topInnovatorsAction={{ label: 'View all', to: '/dashboard/college/students' }}
      topInnovatorsEmptyMessage="No ranked student activity is available yet."
      topStudents={data?.topStudents ?? []}
      studentTo={(student) => getStudentPortfolioViewPath(student._id)}
      activityTitle="Recent Activity"
      activityAction={{ label: 'View all', to: '/dashboard/college/placement' }}
      activityItems={buildCollegeActivityItems({
        placementRecords: placementData?.placementTable ?? [],
        recentProjects: data?.recentProjects ?? [],
        auditTrail: complianceOverview?.auditTrail ?? [],
      })}
      activityEmptyMessage="No recent college activity is available yet."
      isLoading={
        dashboardQuery.isLoading ||
        complianceOverviewQuery.isLoading ||
        latestReportQuery.isLoading ||
        placementQuery.isLoading
      }
    />
  );
}
