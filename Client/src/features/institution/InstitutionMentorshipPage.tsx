import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarClock,
  Clock3,
  GraduationCap,
  MessageSquareText,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import { InstitutionWorkspaceHeader } from './InstitutionWorkspaceHeader';
import { MentorshipProgramPanel } from './MentorshipProgramPanel';
import {
  CreateInstitutionMentorshipProgramInput,
  InstitutionMentorshipProgramView,
} from '../../types/mentorship.types';

type InstitutionMentorshipPageProps = {
  queryKey: string;
  institutionLabel: 'School' | 'College';
  description: string;
  fetchPrograms: () => Promise<InstitutionMentorshipProgramView>;
  createProgram: (payload: CreateInstitutionMentorshipProgramInput) => Promise<unknown>;
};

export function InstitutionMentorshipPage({
  queryKey,
  institutionLabel,
  description,
  fetchPrograms,
  createProgram,
}: InstitutionMentorshipPageProps) {
  const mode = institutionLabel.toLowerCase() as 'school' | 'college';
  const programsQuery = useQuery({
    queryKey: [queryKey],
    queryFn: fetchPrograms,
  });
  const programs = programsQuery.data?.items ?? [];
  const stats = programsQuery.data?.stats;
  const scheduledPrograms = useMemo(
    () =>
      programs.filter(
        (program) =>
          program.status === 'Assigned' &&
          Boolean(program.scheduledAt) &&
          !Number.isNaN(new Date(program.scheduledAt as string).getTime()),
      ),
    [programs],
  );
  const upcomingPrograms = useMemo(
    () =>
      [...scheduledPrograms]
        .filter((program) => new Date(program.scheduledAt as string).getTime() >= Date.now())
        .sort(
          (left, right) =>
            new Date(left.scheduledAt as string).getTime() -
            new Date(right.scheduledAt as string).getTime(),
        ),
    [scheduledPrograms],
  );
  const previousPrograms = useMemo(
    () =>
      [...scheduledPrograms]
        .filter((program) => new Date(program.scheduledAt as string).getTime() < Date.now())
        .sort(
          (left, right) =>
            new Date(right.scheduledAt as string).getTime() -
            new Date(left.scheduledAt as string).getTime(),
        ),
    [scheduledPrograms],
  );
  const nextProgram = upcomingPrograms[0];
  const latestReviewedProgram = useMemo(
    () =>
      [...programs]
        .filter((program) => program.status !== 'Pending')
        .sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
        )[0],
    [programs],
  );
  const assignedRatio =
    stats?.total && stats.total > 0
      ? Math.round(((stats.assigned ?? 0) / stats.total) * 100)
      : 0;
  const formatDateTime = (value?: string) =>
    value
      ? new Date(value).toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : 'Awaiting schedule';
  const statusSignal = latestReviewedProgram
    ? latestReviewedProgram.status === 'Rejected'
      ? `Last review rejected ${latestReviewedProgram.title}.`
      : `Last review assigned ${latestReviewedProgram.title}.`
    : 'No reviewed mentorship requests yet.';
  const mentorshipStats = [
    {
      label: 'Pending Review',
      value: String(stats?.pending ?? 0),
      icon: MessageSquareText,
      accent: 'text-amber-300',
      surface: 'bg-[#0a1826]',
    },
    {
      label: 'Upcoming Sessions',
      value: String(upcomingPrograms.length),
      icon: CalendarClock,
      accent: 'text-cyan-300',
      surface: 'bg-[#0c1823]',
    },
    {
      label: 'Completed',
      value: String(previousPrograms.length),
      icon: UserCheck,
      accent: 'text-emerald-300',
      surface: 'bg-[#101725]',
    },
    {
      label: 'Coverage',
      value: `${assignedRatio}%`,
      icon: Users,
      accent: 'text-fuchsia-300',
      surface: 'bg-[#0b1720]',
    },
  ] as const;

  return (
    <div className="space-y-8">
      <InstitutionWorkspaceHeader
        mode={mode}
        eyebrow={`${institutionLabel} Workspace`}
        title="Mentorship Requests"
        description={description}
      />

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-800">
        <div className="grid gap-px lg:grid-cols-4">
          {mentorshipStats.map((stat) => (
            <div key={stat.label} className={`${stat.surface} px-4 py-5 sm:px-5`}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  {stat.label}
                </span>
                <stat.icon className={`h-4 w-4 ${stat.accent}`} />
              </div>
              <div className={`mt-4 text-2xl font-semibold ${stat.accent}`}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-slate-800 bg-[#07111d]">
        <div className="grid gap-px bg-slate-800 xl:grid-cols-[minmax(0,1.2fr)_420px]">
          <div className="bg-[#08121d] p-6 sm:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
              Mentorship Operations
            </div>
            <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-white">
              Review demand, track assignment flow, and monitor delivered sessions.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">
              Keep mentorship intake, review status, and session execution visible in one place for your {institutionLabel.toLowerCase()}.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-[#09131f] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Total Requests
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">
                  {stats?.total ?? 0}
                </div>
                <div className="mt-2 text-sm text-slate-400">
                  Submitted mentorship programs awaiting review or scheduling.
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-[#09131f] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Assigned Ratio
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">
                  {assignedRatio}%
                </div>
                <div className="mt-2 text-sm text-slate-400">
                  Portion of requests that already have an assigned mentor.
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-[#09131f] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Seats Planned
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">
                  {programs.reduce((total, program) => total + program.expectedParticipants, 0)}
                </div>
                <div className="mt-2 text-sm text-slate-400">
                  Expected student participation across all mentorship requests.
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#0b1623] p-6 sm:p-8">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" />
              Live Signal
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-[#09131f] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Next Scheduled Mentorship
              </div>
              <div className="mt-3 text-xl font-semibold text-white">
                {nextProgram ? nextProgram.title : 'No upcoming session yet'}
              </div>
              <div className="mt-3 text-sm leading-6 text-slate-400">
                {nextProgram
                  ? `${formatDateTime(nextProgram.scheduledAt)} / ${nextProgram.platform}`
                  : 'Once admin assigns and schedules a mentorship, the next live session will show here.'}
              </div>
              {nextProgram?.mentor ? (
                <div className="mt-4 inline-flex rounded-full border border-cyan-800 bg-cyan-950/50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  Mentor {nextProgram.mentor.displayName}
                </div>
              ) : null}
            </div>

            <div className="mt-5 space-y-4">
              {[
                {
                  step: '01',
                  title: 'Institution Request',
                  body: `Define the session objective, format, participation target, and preferred expertise for your ${institutionLabel.toLowerCase()}.`,
                  icon: GraduationCap,
                },
                {
                  step: '02',
                  title: 'Admin Review',
                  body: statusSignal,
                  icon: MessageSquareText,
                },
                {
                  step: '03',
                  title: 'Session Delivery',
                  body: `${upcomingPrograms.length} upcoming and ${previousPrograms.length} completed mentorship sessions are currently visible in the schedule feed.`,
                  icon: Clock3,
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="grid grid-cols-[48px,1fr] gap-4 rounded-2xl border border-slate-800 bg-[#09131f] p-4"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 text-sm font-semibold text-slate-300">
                    {item.step}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <item.icon className="h-4 w-4 text-cyan-300" />
                      {item.title}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-400">
                      {item.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <MentorshipProgramPanel
        queryKey={queryKey}
        heading={`${institutionLabel} mentorship requests`}
        description={`Track pending approvals, assigned mentors, and reviewed requests for your ${institutionLabel.toLowerCase()}.`}
        fetchPrograms={fetchPrograms}
        createProgram={createProgram}
      />
    </div>
  );
}
