import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock3, GraduationCap, MessageSquare, Monitor, Users } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  CreateInstitutionMentorshipProgramInput,
  InstitutionMentorshipProgram,
  InstitutionMentorshipProgramView,
} from '../../types/mentorship.types';

type FormState = {
  title: string;
  objective: string;
  preferredDate: string;
  durationMinutes: number;
  expectedParticipants: number;
  preferredExpertise: string;
  deliveryMode: 'Online' | 'Offline';
  platform: 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Offline';
  meetingLink: string;
  venue: string;
};

const emptyState = (): FormState => ({
  title: '',
  objective: '',
  preferredDate: '',
  durationMinutes: 60,
  expectedParticipants: 50,
  preferredExpertise: '',
  deliveryMode: 'Online',
  platform: 'Google Meet',
  meetingLink: '',
  venue: '',
});

const formatDateTime = (value?: string) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Awaiting schedule';

const getStatusBadgeClassName = (status: InstitutionMentorshipProgram['status']) => {
  switch (status) {
    case 'Assigned':
      return 'border-cyan-700 bg-cyan-950/60 text-cyan-200';
    case 'Rejected':
      return 'border-rose-700 bg-rose-950/60 text-rose-200';
    default:
      return 'border-amber-700 bg-amber-950/60 text-amber-200';
  }
};

const getFeedbackCopy = (program: InstitutionMentorshipProgram) => {
  if (program.status === 'Rejected') {
    return {
      eyebrow: 'Rejection Feedback',
      toneClassName: 'border-rose-800/70 bg-rose-950/40 text-rose-200',
      primary: program.rejectionReason ?? 'Admin declined this request without additional notes.',
      secondary: program.adminNotes,
    };
  }

  if (program.adminNotes) {
    return {
      eyebrow: 'Admin Feedback',
      toneClassName: 'border-cyan-800/70 bg-cyan-950/30 text-cyan-100',
      primary: program.adminNotes,
      secondary:
        program.status === 'Assigned'
          ? 'Your mentor and final session details are locked below.'
          : undefined,
    };
  }

  if (program.status === 'Assigned') {
    return {
      eyebrow: 'Assignment Update',
      toneClassName: 'border-cyan-800/70 bg-cyan-950/30 text-cyan-100',
      primary: program.mentor
        ? `${program.mentor.displayName} has been assigned to this session.`
        : 'This mentorship request has been approved and assigned.',
      secondary: program.scheduledAt
        ? `Scheduled for ${formatDateTime(program.scheduledAt)}.`
        : 'Final meeting time will appear here once locked.',
    };
  }

  return {
    eyebrow: 'Queue Update',
    toneClassName: 'border-slate-800 bg-slate-950/60 text-slate-300',
    primary: 'Admin review is pending. The request is waiting for mentor assignment and schedule confirmation.',
    secondary: program.preferredExpertise
      ? `Requested expertise: ${program.preferredExpertise}.`
      : undefined,
  };
};

function MentorshipScheduleBucket({
  title,
  emptyLabel,
  programs,
  compact,
}: {
  title: string;
  emptyLabel: string;
  programs: InstitutionMentorshipProgram[];
  compact: boolean;
}) {
  const shellClassName = compact
    ? 'rounded-2xl border border-white/10 bg-white/[0.03] p-4'
    : 'rounded-2xl border border-slate-800 bg-slate-900 p-4';

  return (
    <section className={shellClassName}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
          {title}
        </div>
        <div className="text-sm text-slate-500">{programs.length}</div>
      </div>

      {programs.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-800 px-4 py-5 text-sm text-slate-500">
          {emptyLabel}
        </div>
      ) : (
        <div className="mt-4 divide-y divide-slate-800">
          {programs.map((program) => (
            <div key={`${title}-${program._id}`} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <div className="text-base font-semibold text-white">{program.title}</div>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-400">
                  <span>{formatDateTime(program.scheduledAt)}</span>
                  <span>{program.deliveryMode}</span>
                  <span>{program.expectedParticipants} students</span>
                </div>
                {program.mentor ? (
                  <div className="mt-2 text-sm text-slate-300">
                    Mentor: {program.mentor.displayName}
                  </div>
                ) : null}
              </div>
              <div className="text-sm text-slate-400 md:text-right">
                {program.platform}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CompactMentorshipScheduleList({
  title,
  emptyLabel,
  programs,
}: {
  title: string;
  emptyLabel: string;
  programs: InstitutionMentorshipProgram[];
}) {
  return (
    <section className="rounded-[24px] border border-slate-800/80 bg-[#07111d]/75 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300">
          {title}
        </div>
        <div className="text-[11px] text-slate-500">{programs.length}</div>
      </div>

      {programs.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <div className="mt-4 divide-y divide-slate-800/80">
          {programs.map((program) => (
            <article key={`${title}-${program._id}`} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{program.title}</div>
                  <div className="mt-1 text-sm text-slate-400">
                    {formatDateTime(program.scheduledAt)}
                  </div>
                </div>
                <div className="text-right text-xs uppercase tracking-[0.2em] text-slate-500">
                  {program.deliveryMode}
                  {program.platform ? ` / ${program.platform}` : ''}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>{program.durationMinutes} min</span>
                <span>{program.expectedParticipants} students</span>
                {program.mentor ? <span>Mentor: {program.mentor.displayName}</span> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CompactMentorshipRequestRow({
  program,
}: {
  program: InstitutionMentorshipProgram;
}) {
  const feedback = getFeedbackCopy(program);
  const summary =
    program.status === 'Assigned' && program.scheduledAt
      ? `Scheduled ${formatDateTime(program.scheduledAt)}${program.mentor ? ` / ${program.mentor.displayName}` : ''}`
      : program.status === 'Rejected'
        ? 'Needs resubmission'
        : 'Waiting for assignment';

  return (
    <article className="rounded-[22px] border border-slate-800/80 bg-[#06101a]/85 p-4 transition hover:border-slate-700 hover:bg-[#081321]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-base font-semibold text-white">{program.title}</h3>
            <div
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${getStatusBadgeClassName(program.status)}`}
            >
              {program.status}
            </div>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">{program.objective}</p>
        </div>
        <div className="text-right text-[11px] uppercase tracking-[0.24em] text-slate-500">
          {summary}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-300">
        <span className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1">
          {formatDateTime(program.preferredDate)}
        </span>
        <span className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1">
          {program.durationMinutes} min
        </span>
        <span className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1">
          {program.expectedParticipants} students
        </span>
        <span className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1">
          {program.deliveryMode}
          {program.platform ? ` / ${program.platform}` : ''}
        </span>
        {program.preferredExpertise ? (
          <span className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1">
            {program.preferredExpertise}
          </span>
        ) : null}
      </div>

      <div className="mt-4 text-sm text-slate-400">
        {program.status === 'Assigned' && program.scheduledAt ? (
          <span>
            {program.mentor ? `Mentor ${program.mentor.displayName}` : 'Mentor assigned'}
          </span>
        ) : (
          <span>{feedback.primary}</span>
        )}
      </div>
    </article>
  );
}

function MentorshipRequestCard({
  program,
  compact,
}: {
  program: InstitutionMentorshipProgram;
  compact: boolean;
}) {
  const feedback = getFeedbackCopy(program);
  const shellClassName = compact
    ? 'overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.03]'
    : 'overflow-hidden rounded-[26px] border border-slate-800 bg-slate-900';
  const tileClassName = compact
    ? 'bg-[#08121d]'
    : 'bg-slate-950';
  const sectionClassName = compact
    ? 'bg-[#09131f]'
    : 'bg-slate-950/70';

  return (
    <article className={shellClassName}>
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Mentorship Request
            </div>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              {program.title}
            </h3>
          </div>
          <div
            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${getStatusBadgeClassName(program.status)}`}
          >
            {program.status}
          </div>
        </div>

        <div className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
          {program.objective}
        </div>

        <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-slate-800 bg-slate-800 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`${tileClassName} px-4 py-4`}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              <CalendarDays className="h-3.5 w-3.5" />
              Preferred Date
            </div>
            <div className="mt-3 text-sm font-medium text-slate-100">
              {formatDateTime(program.preferredDate)}
            </div>
          </div>
          <div className={`${tileClassName} px-4 py-4`}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              <Clock3 className="h-3.5 w-3.5" />
              Duration
            </div>
            <div className="mt-3 text-sm font-medium text-slate-100">
              {program.durationMinutes} minutes
            </div>
          </div>
          <div className={`${tileClassName} px-4 py-4`}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              <Users className="h-3.5 w-3.5" />
              Participants
            </div>
            <div className="mt-3 text-sm font-medium text-slate-100">
              {program.expectedParticipants} expected
            </div>
          </div>
          <div className={`${tileClassName} px-4 py-4`}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              <Monitor className="h-3.5 w-3.5" />
              Delivery
            </div>
            <div className="mt-3 text-sm font-medium text-slate-100">
              {program.deliveryMode} / {program.platform}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {program.deliveryMode === 'Online'
                ? program.meetingLink
                  ? 'Meeting link available'
                  : 'Meeting link pending'
                : program.venue ?? 'Venue pending'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-px border-t border-slate-800 bg-slate-800 xl:grid-cols-2">
        <section className={`${sectionClassName} p-5 sm:p-6`}>
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
            Details
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Final Schedule
              </div>
              <div className="mt-2 text-sm text-slate-200">
                {program.scheduledAt ? formatDateTime(program.scheduledAt) : 'Waiting for admin confirmation'}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Mentor
              </div>
              {program.mentor ? (
                <div className="mt-2 space-y-2">
                  <div className="text-sm font-semibold text-white">
                    {program.mentor.displayName}
                  </div>
                  <div className="text-sm text-slate-300">
                    {program.mentor.domain ?? program.mentor.email}
                  </div>
                  {program.mentor.bio ? (
                    <div className="text-sm leading-6 text-slate-400">
                      {program.mentor.bio}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-2 text-sm text-slate-400">
                  A mentor has not been assigned yet.
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Expertise
              </div>
              <div className="mt-2 text-sm text-slate-200">
                {program.preferredExpertise ?? 'No specific expertise requested.'}
              </div>
            </div>

            {program.deliveryMode === 'Online' && program.meetingLink ? (
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Meeting Link
                </div>
                <a
                  href={program.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-sm text-cyan-300 hover:text-cyan-200"
                >
                  Open session link
                </a>
              </div>
            ) : null}
          </div>
        </section>

        <section className={`${sectionClassName} p-5 sm:p-6`}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
            <MessageSquare className="h-3.5 w-3.5" />
            Feedback
          </div>

          <div className={`mt-5 rounded-2xl border px-4 py-4 ${feedback.toneClassName}`}>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] opacity-80">
              {feedback.eyebrow}
            </div>
            <div className="mt-3 text-sm leading-6">
              {feedback.primary}
            </div>
            {feedback.secondary ? (
              <div className="mt-3 text-sm leading-6 opacity-80">
                {feedback.secondary}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </article>
  );
}

export function MentorshipProgramPanel({
  queryKey,
  heading,
  description,
  fetchPrograms,
  createProgram,
  compact = false,
  showCreateRequest,
  onShowCreateRequestChange,
  hideCreateTrigger = false,
}: {
  queryKey: string;
  heading: string;
  description: string;
  fetchPrograms: () => Promise<InstitutionMentorshipProgramView>;
  createProgram: (payload: CreateInstitutionMentorshipProgramInput) => Promise<unknown>;
  compact?: boolean;
  showCreateRequest?: boolean;
  onShowCreateRequestChange?: (open: boolean) => void;
  hideCreateTrigger?: boolean;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyState());
  const [internalShowCreateRequest, setInternalShowCreateRequest] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const isCreateRequestOpen = showCreateRequest ?? internalShowCreateRequest;

  const programsQuery = useQuery({
    queryKey: [queryKey],
    queryFn: fetchPrograms,
  });

  const createMutation = useMutation({
    mutationFn: createProgram,
    onMutate: () => {
      setSubmissionFeedback(null);
    },
    onSuccess: async () => {
      setForm(emptyState());
      if (onShowCreateRequestChange) {
        onShowCreateRequestChange(false);
      } else {
        setInternalShowCreateRequest(false);
      }
      setSubmissionFeedback({
        tone: 'success',
        message: 'Request submitted.',
      });
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (error) => {
      setSubmissionFeedback({
        tone: 'error',
        message: getApiErrorMessage(error, 'Unable to submit the mentorship request right now.'),
      });
    },
  });

  const programs = programsQuery.data?.items ?? [];
  const stats = programsQuery.data?.stats;
  const compactFormClassName =
    'rounded-[28px] border border-slate-800 bg-[#050d18] p-5 sm:p-6';

  const latestPrograms = useMemo(() => programs.slice(0, 4), [programs]);
  const compactRequests = useMemo(() => programs, [programs]);
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
        )
        .slice(0, 3),
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
        )
        .slice(0, 3),
    [scheduledPrograms],
  );
  const compactSummaryStats = [
    {
      label: 'Pending Review',
      value: String(stats?.pending ?? 0),
      icon: MessageSquare,
      accent: 'text-amber-300',
      surface: 'bg-[#0a1826]',
    },
    {
      label: 'Upcoming',
      value: String(upcomingPrograms.length),
      icon: CalendarDays,
      accent: 'text-cyan-300',
      surface: 'bg-[#0c1823]',
    },
    {
      label: 'Assigned',
      value: String(stats?.assigned ?? 0),
      icon: Users,
      accent: 'text-emerald-300',
      surface: 'bg-[#101725]',
    },
    {
      label: 'Requests',
      value: String(stats?.total ?? 0),
      icon: GraduationCap,
      accent: 'text-fuchsia-300',
      surface: 'bg-[#0b1720]',
    },
  ] as const;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    createMutation.mutate({
      title: form.title,
      objective: form.objective,
      preferredDate: new Date(form.preferredDate).toISOString(),
      durationMinutes: form.durationMinutes,
      expectedParticipants: form.expectedParticipants,
      ...(form.preferredExpertise.trim() ? { preferredExpertise: form.preferredExpertise.trim() } : {}),
      deliveryMode: form.deliveryMode,
      platform: form.platform,
      ...(form.deliveryMode === 'Online' && form.meetingLink.trim()
        ? { meetingLink: form.meetingLink.trim() }
        : {}),
      ...(form.deliveryMode === 'Offline' && form.venue.trim() ? { venue: form.venue.trim() } : {}),
    });
  };

  const toggleCreateRequest = () => {
    const nextValue = !isCreateRequestOpen;
    if (onShowCreateRequestChange) {
      onShowCreateRequestChange(nextValue);
    } else {
      setInternalShowCreateRequest(nextValue);
    }
  };

  const layoutClassName = isCreateRequestOpen
    ? 'grid items-start gap-6 xl:grid-cols-[1.7fr,0.7fr]'
    : 'space-y-6';

  return (
    <div className={layoutClassName}>
      {compact ? (
        <section className="space-y-6">
          <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-800">
            <div className="grid gap-px lg:grid-cols-4">
              {compactSummaryStats.map((stat) => (
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

          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-5">
              <CompactMentorshipScheduleList
                title="Upcoming"
                emptyLabel="No upcoming sessions."
                programs={upcomingPrograms}
              />
              <CompactMentorshipScheduleList
                title="Previous"
                emptyLabel="No completed sessions."
                programs={previousPrograms}
              />
            </div>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300">
                  Mentorship List
                </div>
                <div className="rounded-full border border-slate-800 bg-[#07111d] px-3 py-1 text-xs text-slate-400">
                  {compactRequests.length}
                </div>
              </div>

              {programsQuery.isLoading ? (
                <div className="rounded-[24px] border border-slate-800/80 bg-[#07111d]/75 px-4 py-6 text-sm text-slate-400">
                  Loading requests...
                </div>
              ) : compactRequests.length === 0 ? (
                <div className="rounded-[24px] border border-slate-800/80 bg-[#07111d]/75 px-4 py-6 text-sm text-slate-500">
                  No requests yet.
                </div>
              ) : (
                <div className="grid gap-3">
                  {compactRequests.map((program) => (
                    <CompactMentorshipRequestRow key={program._id} program={program} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      ) : (
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Mentorship Requests</div>
            <h2 className="mt-2 text-2xl font-bold text-white">{heading}</h2>
            <p className="mt-2 text-sm text-slate-400">{description}</p>
          </div>
          <div className="flex items-center gap-3">
              {!hideCreateTrigger ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={toggleCreateRequest}
                  className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-600 hover:bg-slate-800"
                >
                  {isCreateRequestOpen ? 'Close Request' : 'Create Request'}
                </Button>
              ) : null}
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
                <GraduationCap className="h-6 w-6 text-cyan-300" />
              </div>
            </div>
          </div>

          {!isCreateRequestOpen && submissionFeedback ? (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                submissionFeedback.tone === 'success'
                ? 'border-emerald-700 bg-emerald-900 text-emerald-200'
                : 'border-rose-700 bg-rose-900 text-rose-200'
            }`}
          >
            {submissionFeedback.message}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { label: 'Total Requests', value: stats?.total ?? 0, icon: CalendarDays },
            { label: 'Pending', value: stats?.pending ?? 0, icon: GraduationCap },
            { label: 'Assigned', value: stats?.assigned ?? 0, icon: Users },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950">
                <stat.icon className="h-5 w-5 text-cyan-300" />
              </div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <MentorshipScheduleBucket
            title="Upcoming Mentorships"
            emptyLabel="No upcoming mentorship sessions are scheduled yet."
            programs={upcomingPrograms}
            compact={false}
          />
          <MentorshipScheduleBucket
            title="Previous Mentorships"
            emptyLabel="No previous mentorship sessions have been completed yet."
            programs={previousPrograms}
            compact={false}
          />
        </div>

        <div className="mt-6 space-y-3">
          {programsQuery.isLoading ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
              Loading mentorship requests...
            </div>
          ) : latestPrograms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
              No mentorship requests yet. Submit one to let admin assign a mentor.
            </div>
          ) : (
            latestPrograms.map((program) => (
              <MentorshipRequestCard key={program._id} program={program} compact={false} />
            ))
          )}
        </div>
      </Card>
      )}

      {isCreateRequestOpen && compact ? (
        <div className={compactFormClassName}>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Request To Admin</div>
          <h2 className="mt-2 text-2xl font-bold text-white">Submit a mentorship request</h2>
          {submissionFeedback ? (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                submissionFeedback.tone === 'success'
                  ? 'border-emerald-700 bg-emerald-900 text-emerald-200'
                  : 'border-rose-700 bg-rose-900 text-rose-200'
              }`}
            >
              {submissionFeedback.message}
            </div>
          ) : null}
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Program title"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                required
              />
              <textarea
                value={form.objective}
                onChange={(event) => setForm((current) => ({ ...current, objective: event.target.value }))}
                placeholder="Program objective and expected outcomes"
                className="min-h-28 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                required
              />
              <input
                value={form.preferredExpertise}
                onChange={(event) => setForm((current) => ({ ...current, preferredExpertise: event.target.value }))}
                placeholder="Preferred mentor expertise"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              />
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  type="datetime-local"
                  value={form.preferredDate}
                  onChange={(event) => setForm((current) => ({ ...current, preferredDate: event.target.value }))}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                  required
                />
                <input
                  type="number"
                  min={30}
                  max={480}
                  value={form.durationMinutes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, durationMinutes: Number(event.target.value) || 60 }))
                  }
                  placeholder="Duration in minutes"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                  required
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  type="number"
                  min={1}
                  value={form.expectedParticipants}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, expectedParticipants: Number(event.target.value) || 1 }))
                  }
                  placeholder="Expected participants"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                  required
                />
                <select
                  value={form.deliveryMode}
                  onChange={(event) => {
                    const deliveryMode = event.target.value as FormState['deliveryMode'];
                    setForm((current) => ({
                      ...current,
                      deliveryMode,
                      platform: deliveryMode === 'Online' ? 'Google Meet' : 'Offline',
                      meetingLink: deliveryMode === 'Online' ? current.meetingLink : '',
                      venue: deliveryMode === 'Offline' ? current.venue : '',
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                >
                  <option value="Online">Online</option>
                  <option value="Offline">Offline</option>
                </select>
              </div>
              <select
                value={form.platform}
                onChange={(event) => setForm((current) => ({ ...current, platform: event.target.value as FormState['platform'] }))}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              >
                {form.deliveryMode === 'Online' ? (
                  <>
                    <option value="Google Meet">Google Meet</option>
                    <option value="Microsoft Teams">Microsoft Teams</option>
                    <option value="Zoom">Zoom</option>
                  </>
                ) : (
                  <option value="Offline">Offline</option>
                )}
              </select>
              {form.deliveryMode === 'Online' ? (
                <input
                  value={form.meetingLink}
                  onChange={(event) => setForm((current) => ({ ...current, meetingLink: event.target.value }))}
                  placeholder="Meeting link (optional)"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                />
              ) : (
                <input
                  value={form.venue}
                  onChange={(event) => setForm((current) => ({ ...current, venue: event.target.value }))}
                  placeholder="Venue / campus location"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                />
              )}
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Submitting...' : 'Submit Mentorship Request'}
              </Button>
          </form>
        </div>
      ) : isCreateRequestOpen ? (
      <Card className="p-6">
        <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Request To Admin</div>
        <h2 className="mt-2 text-2xl font-bold text-white">Submit a mentorship request</h2>
        <p className="mt-2 text-sm text-slate-400">
          Admin will review the request, approve it, and assign an available mentor without schedule conflicts.
        </p>
        {submissionFeedback ? (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
              submissionFeedback.tone === 'success'
                ? 'border-emerald-700 bg-emerald-900 text-emerald-200'
                : 'border-rose-700 bg-rose-900 text-rose-200'
            }`}
          >
            {submissionFeedback.message}
          </div>
        ) : null}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Program title"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              required
            />
            <textarea
              value={form.objective}
              onChange={(event) => setForm((current) => ({ ...current, objective: event.target.value }))}
              placeholder="Program objective and expected outcomes"
              className="min-h-28 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              required
            />
            <input
              value={form.preferredExpertise}
              onChange={(event) => setForm((current) => ({ ...current, preferredExpertise: event.target.value }))}
              placeholder="Preferred mentor expertise"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <input
                type="datetime-local"
                value={form.preferredDate}
                onChange={(event) => setForm((current) => ({ ...current, preferredDate: event.target.value }))}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                required
              />
              <input
                type="number"
                min={30}
                max={480}
                value={form.durationMinutes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, durationMinutes: Number(event.target.value) || 60 }))
                }
                placeholder="Duration in minutes"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                type="number"
                min={1}
                value={form.expectedParticipants}
                onChange={(event) =>
                  setForm((current) => ({ ...current, expectedParticipants: Number(event.target.value) || 1 }))
                }
                placeholder="Expected participants"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                required
              />
              <select
                value={form.deliveryMode}
                onChange={(event) => {
                  const deliveryMode = event.target.value as FormState['deliveryMode'];
                  setForm((current) => ({
                    ...current,
                    deliveryMode,
                    platform: deliveryMode === 'Online' ? 'Google Meet' : 'Offline',
                    meetingLink: deliveryMode === 'Online' ? current.meetingLink : '',
                    venue: deliveryMode === 'Offline' ? current.venue : '',
                  }));
                }}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              >
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
              </select>
            </div>
            <select
              value={form.platform}
              onChange={(event) => setForm((current) => ({ ...current, platform: event.target.value as FormState['platform'] }))}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            >
              {form.deliveryMode === 'Online' ? (
                <>
                  <option value="Google Meet">Google Meet</option>
                  <option value="Microsoft Teams">Microsoft Teams</option>
                  <option value="Zoom">Zoom</option>
                </>
              ) : (
                <option value="Offline">Offline</option>
              )}
            </select>
            {form.deliveryMode === 'Online' ? (
              <input
                value={form.meetingLink}
                onChange={(event) => setForm((current) => ({ ...current, meetingLink: event.target.value }))}
                placeholder="Meeting link (optional)"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              />
            ) : (
              <input
                value={form.venue}
                onChange={(event) => setForm((current) => ({ ...current, venue: event.target.value }))}
                placeholder="Venue / campus location"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              />
            )}
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Submitting...' : 'Submit Mentorship Request'}
            </Button>
        </form>
      </Card>
      ) : null}
    </div>
  );
}

