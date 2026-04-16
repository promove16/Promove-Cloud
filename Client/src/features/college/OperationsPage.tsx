import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  FolderKanban,
  GraduationCap,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { collegeApi } from '../../api/college.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { InstitutionWorkspaceHeader } from '../institution/InstitutionWorkspaceHeader';

type OperationsPageProps = {
  onBackToOverview?: () => void;
};

type HubCard = {
  title: string;
  description: string;
  to: string;
  icon: typeof Users;
  tone: string;
  metric: string;
  metricLabel: string;
};

export default function OperationsPage({
  onBackToOverview,
}: OperationsPageProps) {
  const dashboardQuery = useQuery({
    queryKey: ['college-dashboard'],
    queryFn: collegeApi.getDashboard,
  });
  const investorsQuery = useQuery({
    queryKey: ['college-investors'],
    queryFn: collegeApi.getInvestors,
  });
  const recruitersQuery = useQuery({
    queryKey: ['college-recruiters'],
    queryFn: collegeApi.getRecruiters,
  });
  const mentorshipQuery = useQuery({
    queryKey: ['college-mentorship-programs'],
    queryFn: collegeApi.getMentorshipPrograms,
  });

  const dashboardData = dashboardQuery.data;
  const hubCards: HubCard[] = [
    {
      title: 'Student Innovators',
      description:
        'Manage the student roster, issue access tokens, review verification requests, and inspect innovation leaders.',
      to: '/dashboard/college/students',
      icon: Users,
      tone: 'from-cyan-500 to-blue-500',
      metric: String(dashboardData?.stats.totalStudents ?? 0),
      metricLabel: 'students tracked',
    },
    {
      title: 'Projects',
      description:
        'Track student workspaces, project stages, and the latest execution updates across the college.',
      to: '/dashboard/college/projects',
      icon: FolderKanban,
      tone: 'from-violet-500 to-fuchsia-500',
      metric: String(dashboardData?.stats.activeProjects ?? 0),
      metricLabel: 'active projects',
    },
    {
      title: 'Investors',
      description:
        'Review investor relationships connected to your institution and route startup outreach where it fits.',
      to: '/dashboard/college/investors',
      icon: Building2,
      tone: 'from-emerald-500 to-teal-500',
      metric: String(investorsQuery.data?.length ?? 0),
      metricLabel: 'investor profiles',
    },
    {
      title: 'Recruiters',
      description:
        'Open the recruiter directory, inspect active campus hiring activity, and monitor recruiting coverage.',
      to: '/dashboard/college/recruiters',
      icon: BriefcaseBusiness,
      tone: 'from-amber-500 to-orange-500',
      metric: String(recruitersQuery.data?.length ?? 0),
      metricLabel: 'recruiter partners',
    },
    {
      title: 'Mentorship',
      description:
        'Create mentorship requests, track program approvals, and keep mentor coordination in one workspace.',
      to: '/dashboard/college/mentors',
      icon: GraduationCap,
      tone: 'from-sky-500 to-cyan-500',
      metric: String(mentorshipQuery.data?.stats.total ?? 0),
      metricLabel: 'programs tracked',
    },
    {
      title: 'Events',
      description:
        'Create internal campus events, review recruiter-hosted hiring events, and keep participation visible.',
      to: '/dashboard/college/events',
      icon: CalendarDays,
      tone: 'from-rose-500 to-pink-500',
      metric: String(dashboardData?.upcomingEvents.length ?? 0),
      metricLabel: 'upcoming events',
    },
    {
      title: 'Compliance',
      description:
        'Open the college compliance workspace for alerts, incidents, actions, and downloadable audit reports.',
      to: '/dashboard/college/compliance',
      icon: ShieldCheck,
      tone: 'from-cyan-500 to-sky-500',
      metric: String(dashboardData?.institutionProfile?.policies.length ?? 0),
      metricLabel: 'policy frameworks',
    },
  ];

  const institutionName =
    dashboardData?.institutionProfile?.institutionName ?? 'College Operations Hub';

  return (
    <div className="space-y-8 pb-8">
      <InstitutionWorkspaceHeader
        mode="college"
        eyebrow="Operations Hub"
        title={institutionName}
        description="Use Operations as the college command center for students, projects, investors, recruiters, mentorship, and events."
        tabsAction={
          onBackToOverview ? (
            <Button variant="secondary" onClick={onBackToOverview}>
              Back to overview
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {hubCards.map((card) => (
          <Link key={card.title} to={card.to} className="block">
            <Card className="h-full border-slate-800 bg-slate-900/85 p-6 transition hover:border-slate-700">
              <div className="flex items-start justify-between gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.tone}`}
                >
                  <card.icon className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">{card.metric}</div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {card.metricLabel}
                  </div>
                </div>
              </div>

              <h2 className="mt-5 text-xl font-semibold text-white">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {card.description}
              </p>

              <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300">
                Open workspace
                <ArrowRight className="h-4 w-4" />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-cyan-900/40 bg-gradient-to-r from-cyan-950/25 via-slate-900/90 to-slate-950 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">
              Student Onboarding
            </div>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Access tokens now live under Student Innovators
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              The student workspace now carries issue-access-token, verification,
              roster import, and temporary-login flows so onboarding stays attached
              to the student record system described in the college manual. Approval
              ownership stays with the college here; the platform admin queue only
              covers institution and operator registration requests.
            </p>
          </div>

          <Link to="/dashboard/college/students" className="shrink-0">
            <Button>
              Open Student Innovators
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
