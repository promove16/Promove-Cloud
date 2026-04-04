import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  BriefcaseBusiness,
  Target,
  Users,
} from 'lucide-react';
import { collegeApi } from '../../api/college.api';
import { InstitutionOverviewDashboard } from '../institution/InstitutionOverviewDashboard';

export default function Dashboard() {
  const dashboardQuery = useQuery({
    queryKey: ['college-dashboard'],
    queryFn: collegeApi.getDashboard,
  });

  const data = dashboardQuery.data;
  const stats = data?.stats;
  const recentActivity = data?.recentActivityCounts;
  const institutionName = data?.institutionProfile?.institutionName ?? 'College Dashboard';
  const academicYear = data?.institutionProfile?.academicYear ?? 'Current academic year';

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
      recentProjectsAction={{ label: 'Open Operations', to: '/dashboard/college/operations' }}
      recentProjectsEmptyMessage="No active student projects are available yet."
      announcementTitle="Placement pipeline is live"
      announcementBody={`${stats?.studentsPlaced ?? 0} students are already marked as placed, with ${stats?.activeHRPartners ?? 0} active hiring partners and ${recentActivity?.startupsLast30Days ?? 0} startup launches recorded in the last 30 days. Use the placement tracker for recruiter outcomes and the operations workspace for intake management.`}
      announcementAction={{ label: 'Open Placement Tracker', to: '/dashboard/college/placement' }}
      quickStats={[
        { label: 'Placement Velocity', value: `${stats?.placementVelocity ?? 0}%` },
        { label: 'Innovation Activities', value: String(stats?.totalInnovationActivities ?? 0) },
        { label: 'Mentoring Hours', value: String(stats?.totalMentoringHours ?? 0) },
      ]}
      topStudents={data?.topStudents ?? []}
      upcomingEvents={data?.upcomingEvents ?? []}
      recentProjects={data?.recentProjects ?? []}
      studentTo={(student) => `/dashboard/college/students/${student._id}`}
      eventTo={() => '/dashboard/college/events'}
      projectTo={(project) => `/dashboard/college/projects/${project._id}`}
      isLoading={dashboardQuery.isLoading}
    />
  );
}
