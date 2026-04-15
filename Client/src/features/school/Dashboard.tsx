import { useQuery } from '@tanstack/react-query';
import {
  Award,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { schoolApi } from '../../api/school.api';
import { InstitutionOverviewDashboard } from '../institution/InstitutionOverviewDashboard';
import { getStudentPortfolioViewPath } from '../marketplace/navigation';

export default function Dashboard() {
  const dashboardQuery = useQuery({
    queryKey: ['school-dashboard'],
    queryFn: schoolApi.getDashboard,
  });

  const data = dashboardQuery.data;
  const stats = data?.stats;
  const recentActivity = data?.recentActivityCounts;
  const institutionName = data?.institutionProfile?.institutionName ?? 'School Dashboard';
  const academicYear = data?.institutionProfile?.academicYear ?? 'Current academic year';
  const iicRating = (data?.institutionProfile?.iicStarRating ?? 0).toFixed(1);

  return (
    <InstitutionOverviewDashboard
      institutionLabel="School Overview"
      institutionName={institutionName}
      subtitle={`Monitor student innovators, patent momentum, and live school activity for ${academicYear}.`}
      statCards={[
        {
          label: 'Total Students',
          value: stats?.totalStudents ?? 0,
          badge: `${stats?.activeProjects ?? 0} active`,
          icon: Users,
          color: 'from-blue-500 to-cyan-500',
          to: '/dashboard/school/students',
        },
        {
          label: 'Active Projects',
          value: stats?.activeProjects ?? 0,
          badge: `${recentActivity?.scoreEventsLast30Days ?? 0} score events / 30d`,
          icon: Target,
          color: 'from-violet-500 to-fuchsia-500',
          to: '/dashboard/school/projects',
        },
        {
          label: 'Patents Filed',
          value: stats?.patentsFiled ?? 0,
          badge: `+${recentActivity?.patentsLast30Days ?? 0} in 30d`,
          icon: Award,
          color: 'from-emerald-500 to-teal-500',
          to: '/dashboard/school/patents',
        },
        {
          label: 'Startups Launched',
          value: stats?.startupsLaunched ?? 0,
          badge: `+${recentActivity?.startupsLast30Days ?? 0} in 30d`,
          icon: TrendingUp,
          color: 'from-amber-500 to-orange-500',
          to: '/dashboard/school/startups',
        },
      ]}
      topInnovatorsTitle="Top Student Innovators"
      topInnovatorsAction={{ label: 'View Students', to: '/dashboard/school/students' }}
      topInnovatorsEmptyMessage="No ranked student activity is available yet."
      eventsTitle="Upcoming Events"
      eventsEmptyMessage="No upcoming events are scheduled yet."
      recentProjectsTitle="Recent Projects"
      recentProjectsAction={{ label: 'Open Operations', to: '/dashboard/school/operations' }}
      recentProjectsEmptyMessage="No active student projects are available yet."
      announcementTitle="Operations workspace is ready"
      announcementBody={`${recentActivity?.scoreEventsLast30Days ?? 0} score events, ${recentActivity?.patentsLast30Days ?? 0} patents, and ${recentActivity?.startupsLast30Days ?? 0} startups were recorded in the last 30 days. Use the operations workspace for tokens, roster intake, and verification review.`}
      announcementAction={{ label: 'Open Operations', to: '/dashboard/school/operations' }}
      showcaseTitle="School Showcase"
      showcaseDescription="Highlight the institution's innovation credibility through rating, mentorship, and startup delivery signals."
      showcasePlacement="after-hero"
      showcaseCards={[
        {
          title: 'IIC Rating',
          value: `${iicRating} / 5`,
          description: 'Current institution innovation rating visible to the ecosystem.',
          icon: Award,
          color: 'from-cyan-500 to-blue-500',
        },
        {
          title: 'Mentorship Hours',
          value: String(stats?.totalMentoringHours ?? 0),
          description: 'Recorded mentorship support delivered to student innovators.',
          icon: Users,
          color: 'from-violet-500 to-fuchsia-500',
          to: '/dashboard/school/mentors',
        },
        {
          title: 'Startup Launches',
          value: String(stats?.startupsLaunched ?? 0),
          description: 'Student startups launched from the school innovation pipeline.',
          icon: TrendingUp,
          color: 'from-amber-500 to-orange-500',
          to: '/dashboard/school/startups',
        },
      ]}
      quickStats={[
        { label: 'IIC Star Rating', value: `${iicRating} / 5` },
        { label: 'Mentoring Hours', value: String(stats?.totalMentoringHours ?? 0) },
        { label: 'Industry Collaborations', value: String(stats?.industryCollaborations ?? 0) },
      ]}
      topStudents={data?.topStudents ?? []}
      upcomingEvents={data?.upcomingEvents ?? []}
      recentProjects={data?.recentProjects ?? []}
      studentTo={(student) => getStudentPortfolioViewPath(student._id)}
      eventTo={(event) => `/dashboard/school/events/${event._id}`}
      projectTo={(project) => `/dashboard/school/projects/${project._id}`}
      isLoading={dashboardQuery.isLoading}
    />
  );
}
