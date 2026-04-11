import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { collegeApi } from '../../api/college.api';
import { InstitutionOverviewDashboard } from '../institution/InstitutionOverviewDashboard';
import { getStudentPortfolioViewPath } from '../marketplace/navigation';

export default function Dashboard() {
  const dashboardQuery = useQuery({
    queryKey: ['college-dashboard'],
    queryFn: collegeApi.getDashboard,
  });
  const investorsQuery = useQuery({
    queryKey: ['college-investors', 'showcase'],
    queryFn: collegeApi.getInvestors,
  });

  const data = dashboardQuery.data;
  const stats = data?.stats;
  const recentActivity = data?.recentActivityCounts;
  const institutionName = data?.institutionProfile?.institutionName ?? 'College Dashboard';
  const academicYear = data?.institutionProfile?.academicYear ?? 'Current academic year';
  const iicRating = (data?.institutionProfile?.iicStarRating ?? 0).toFixed(1);
  const investorConnections = investorsQuery.data?.length ?? 0;

  return (
    <InstitutionOverviewDashboard
      institutionLabel="College Overview"
      institutionName={institutionName}
      subtitle={`Track innovation output, placement momentum, and recruiter activity for ${academicYear}.`}
      statCards={[
        {
          label: 'Total Students',
          value: stats?.totalStudents ?? 0,
          badge: `${stats?.activeProjects ?? 0} active`,
          icon: Users,
          color: 'from-blue-500 to-cyan-500',
          to: '/dashboard/college/students',
        },
        {
          label: 'Active Projects',
          value: stats?.activeProjects ?? 0,
          badge: `${recentActivity?.scoreEventsLast30Days ?? 0} score events / 30d`,
          icon: Target,
          color: 'from-violet-500 to-fuchsia-500',
          to: '/dashboard/college/projects',
        },
        {
          label: 'Students Placed',
          value: stats?.studentsPlaced ?? 0,
          badge: `${stats?.placementVelocity ?? 0}% velocity`,
          icon: BriefcaseBusiness,
          color: 'from-emerald-500 to-teal-500',
          to: '/dashboard/college/placement',
        },
        {
          label: 'Active HR Partners',
          value: stats?.activeHRPartners ?? 0,
          badge: `${stats?.industryCollaborations ?? 0} collaborations`,
          icon: BarChart3,
          color: 'from-amber-500 to-orange-500',
          to: '/dashboard/college/recruiters',
        },
      ]}
      topInnovatorsTitle="Top Student Innovators"
      topInnovatorsAction={{ label: 'View Students', to: '/dashboard/college/students' }}
      topInnovatorsEmptyMessage="No ranked student activity is available yet."
      eventsTitle="Upcoming Events"
      eventsEmptyMessage="No upcoming events are scheduled yet."
      recentProjectsTitle="Recent Projects"
      recentProjectsAction={{ label: 'Open Operations', to: '/dashboard/college/students' }}
      recentProjectsEmptyMessage="No active student projects are available yet."
      announcementTitle="Placement pipeline is live"
      announcementBody={`${stats?.studentsPlaced ?? 0} students are already marked as placed, with ${stats?.activeHRPartners ?? 0} active hiring partners and ${recentActivity?.startupsLast30Days ?? 0} startup launches recorded in the last 30 days. Use the placement tracker for recruiter outcomes and the operations workspace for intake management.`}
      announcementAction={{ label: 'Open Placement Tracker', to: '/dashboard/college/placement' }}
      showcaseTitle="College Showcase"
      showcaseDescription="Showcase the college's innovation standing across rating, mentorship, startup momentum, and investor access."
      showcaseCards={[
        {
          title: 'IIC Rating',
          value: `${iicRating} / 5`,
          description: 'Institution innovation rating visible on public ecosystem profiles.',
          icon: BarChart3,
          color: 'from-cyan-500 to-blue-500',
        },
        {
          title: 'Mentorship Hours',
          value: String(stats?.totalMentoringHours ?? 0),
          description: 'Mentor engagement delivered across the student innovation pipeline.',
          icon: Users,
          color: 'from-violet-500 to-fuchsia-500',
          to: '/dashboard/college/mentors',
        },
        {
          title: 'Startup Launches',
          value: String(stats?.startupsLaunched ?? 0),
          description: 'Student startups launched and tracked from this college.',
          icon: TrendingUp,
          color: 'from-amber-500 to-orange-500',
        },
        {
          title: 'Investor Connections',
          value: String(investorConnections),
          description: 'Visible investor relationships available for college startup and innovation outreach.',
          icon: Building2,
          color: 'from-emerald-500 to-teal-500',
          to: '/dashboard/college/investors',
        },
      ]}
      quickStats={[
        { label: 'Placement Velocity', value: `${stats?.placementVelocity ?? 0}%` },
        { label: 'Innovation Activities', value: String(stats?.totalInnovationActivities ?? 0) },
        { label: 'Mentoring Hours', value: String(stats?.totalMentoringHours ?? 0) },
      ]}
      topStudents={data?.topStudents ?? []}
      upcomingEvents={data?.upcomingEvents ?? []}
      recentProjects={data?.recentProjects ?? []}
      studentTo={(student) => getStudentPortfolioViewPath(student._id)}
      eventTo={() => '/dashboard/college/events'}
      projectTo={(project) => `/dashboard/college/projects/${project._id}`}
      isLoading={dashboardQuery.isLoading}
    />
  );
}
