import { useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { collegeApi } from '../../api/college.api';
import { eventApi } from '../../api/event.api';
import { schoolApi } from '../../api/school.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ApiErrorResponse } from '../../types/auth.types';
import type { CollegeEvent } from '../../types/college.types';
import { MentorshipProgramPanel } from '../institution/MentorshipProgramPanel';
import { InstitutionWorkspaceHeader } from '../institution/InstitutionWorkspaceHeader';

const eventTypes = [
  'Industry Connect Session',
  'Placement Hackathon',
  'Innovation Drive',
  'Other',
] as const;

type InstitutionEventManagerMode = 'college' | 'school';
type EventManagerTab = 'internal' | 'hiring' | 'mentorship';

type CreateEventPayload = {
  title: string;
  type: (typeof eventTypes)[number];
  date: string;
  description: string;
  targetRoles?: Array<'student' | 'all'>;
};

type ManagedInstitutionEvent = Awaited<
  ReturnType<typeof collegeApi.listEvents>
>[number];

const EVENT_MANAGER_CONFIG: Record<
  InstitutionEventManagerMode,
  {
    headerMode: 'college' | 'school';
    queryKey: string;
    listEvents: () => Promise<ManagedInstitutionEvent[]>;
    mentorshipQueryKey: string;
    mentorshipHeading: string;
    mentorshipDescription: string;
    fetchPrograms: typeof collegeApi.getMentorshipPrograms;
    createProgram: typeof collegeApi.createMentorshipProgram;
    createEvent: (
      payload: CreateEventPayload,
    ) => Promise<ManagedInstitutionEvent>;
  }
> = {
  college: {
    headerMode: 'college',
    queryKey: 'college-events',
    listEvents: collegeApi.listEvents,
    mentorshipQueryKey: 'college-mentorship-programs',
    mentorshipHeading: 'College mentorship requests',
    mentorshipDescription:
      'Request mentorship programs for your college, route them to admin for approval, and monitor mentor assignment and scheduling decisions without leaving the events workspace.',
    fetchPrograms: collegeApi.getMentorshipPrograms,
    createProgram: collegeApi.createMentorshipProgram,
    createEvent: collegeApi.createEvent,
  },
  school: {
    headerMode: 'school',
    queryKey: 'school-events',
    listEvents: schoolApi.listEvents,
    mentorshipQueryKey: 'school-mentorship-programs',
    mentorshipHeading: 'School mentorship requests',
    mentorshipDescription:
      'Request mentorship programs for your school, send them to admin for approval, and track assigned mentors and scheduling decisions alongside school events.',
    fetchPrograms: schoolApi.getMentorshipPrograms,
    createProgram: schoolApi.createMentorshipProgram,
    createEvent: schoolApi.createEvent,
  },
};

const eventFormSchema = z.object({
  title: z.string().trim().min(2, 'Event title is required.').max(160),
  type: z.enum(eventTypes),
  date: z
    .string()
    .trim()
    .min(1, 'Event date and time are required.')
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: 'Enter a valid event date and time.',
    }),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters.')
    .max(2000),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

const defaultEventFormValues: EventFormValues = {
  title: '',
  type: eventTypes[0],
  date: '',
  description: '',
};

const fieldLabelClassName = 'mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400';
const fieldErrorClassName = 'mt-2 text-xs text-rose-300';
const inputErrorClassName =
  'border-rose-500/70 focus:border-rose-400 focus:ring-rose-500/20';
const studioPanelClassName =
  'overflow-hidden rounded-2xl border border-slate-800 bg-[#07111d]';
const insetPanelClassName = 'rounded-2xl border border-slate-800 bg-[#0c1728]';
const workspaceStatSurfaceClassNames = [
  'bg-[#0a1826]',
  'bg-[#0c1823]',
  'bg-[#101725]',
  'bg-[#0b1720]',
] as const;
const eventMetaSurfaceClassNames = [
  'bg-[#0a1320]',
  'bg-[#0b1624]',
  'bg-[#101421]',
  'bg-[#0b1720]',
] as const;

const getCategoryBadgeClass = (event: CollegeEvent) =>
  event.category === 'hiring'
    ? 'border-amber-700/80 bg-amber-950/60 text-amber-200'
    : 'border-cyan-700/80 bg-cyan-950/60 text-cyan-200';

function getErrorMessage(error: unknown, fallback: string) {
  return isAxiosError<ApiErrorResponse>(error) &&
    error.response?.data?.error?.message
    ? error.response.data.error.message
    : fallback;
}

const getTabFromSearchParams = (
  mode: InstitutionEventManagerMode,
  searchParams: URLSearchParams,
): EventManagerTab => {
  const tab = searchParams.get('tab');

  if (tab === 'mentorship') {
    return 'mentorship';
  }

  if (mode === 'college' && tab === 'hiring') {
    return 'hiring';
  }

  return 'internal';
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

const formatDateOnly = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const getTabButtonClassName = (active: boolean) =>
  `rounded-full px-4 py-2 text-sm font-medium transition ${
    active
      ? 'bg-slate-100 text-slate-950'
      : 'text-slate-400 hover:bg-slate-900 hover:text-white'
  }`;

export default function EventManager({
  mode = 'college',
}: {
  mode?: InstitutionEventManagerMode;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const config = EVENT_MANAGER_CONFIG[mode];
  const [activeTab, setActiveTab] = useState<EventManagerTab>(
    getTabFromSearchParams(mode, searchParams),
  );
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateRequest, setShowCreateRequest] = useState(false);
  const [createError, setCreateError] = useState('');
  const [scoringEventId, setScoringEventId] = useState<string | null>(null);
  const [scoreDraft, setScoreDraft] = useState<{
    studentId: string;
    score: string;
  }>({
    studentId: '',
    score: '',
  });
  const focusedEventId = searchParams.get('eventId');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: defaultEventFormValues,
  });

  const eventsQuery = useQuery({
    queryKey: [config.queryKey],
    queryFn: config.listEvents,
  });

  const hiringEventsQuery = useQuery({
    queryKey: [config.queryKey, 'hiring'],
    queryFn: collegeApi.listHiringEvents,
    enabled: mode === 'college',
  });

  const refreshEventQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: [config.queryKey] });
    if (mode === 'college') {
      await queryClient.invalidateQueries({
        queryKey: [config.queryKey, 'hiring'],
      });
    }
  };

  const createMutation = useMutation({
    mutationFn: config.createEvent,
    onSuccess: async () => {
      reset(defaultEventFormValues);
      setCreateError('');
      setShowCreate(false);
      await refreshEventQueries();
    },
    onError: (error) => {
      setCreateError(
        getErrorMessage(error, 'Unable to create this event right now.'),
      );
    },
  });

  const computeMutation = useMutation({
    mutationFn: eventApi.computeRankings,
    onSuccess: refreshEventQueries,
  });

  const submissionMutation = useMutation({
    mutationFn: ({
      eventId,
      studentId,
      score,
    }: {
      eventId: string;
      studentId: string;
      score: number;
    }) => eventApi.addSubmissionScore(eventId, studentId, score),
    onSuccess: async () => {
      setScoreDraft({ studentId: '', score: '' });
      await refreshEventQueries();
    },
  });

  const visibleEvents = useMemo(() => {
    if (mode === 'school') {
      return eventsQuery.data ?? [];
    }

    if (activeTab === 'hiring') {
      return hiringEventsQuery.data ?? [];
    }

    return (eventsQuery.data ?? []).filter(
      (event) => event.category !== 'hiring',
    );
  }, [activeTab, eventsQuery.data, hiringEventsQuery.data, mode]);

  const workspaceStats = useMemo(() => {
    const participants = visibleEvents.reduce(
      (total, event) => total + event.participantsCount,
      0,
    );
    const rankedParticipants = visibleEvents.reduce(
      (total, event) => total + event.rankings.length,
      0,
    );
    const rankedEvents = visibleEvents.filter(
      (event) => event.rankings.length > 0,
    ).length;

    return [
      {
        label: activeTab === 'hiring' ? 'Recruiter Sessions' : 'Live Sessions',
        value: String(visibleEvents.length),
        accent: 'text-cyan-300',
        icon: CalendarDays,
      },
      {
        label: 'Participants',
        value: String(participants),
        accent: 'text-emerald-300',
        icon: Users,
      },
      {
        label: activeTab === 'hiring' ? 'Ranked Candidates' : 'Ranked Students',
        value: String(rankedParticipants),
        accent: 'text-amber-300',
        icon: Trophy,
      },
      {
        label: 'Boards Ready',
        value: String(rankedEvents),
        accent: 'text-fuchsia-300',
        icon: Sparkles,
      },
    ];
  }, [activeTab, visibleEvents]);

  const canCreateInternalEvent = mode === 'school' || activeTab === 'internal';
  const isEventsLoading =
    activeTab !== 'mentorship' &&
    (eventsQuery.isLoading ||
      (mode === 'college' &&
        activeTab === 'hiring' &&
        hiringEventsQuery.isLoading));
  const hasNoVisibleEvents =
    activeTab !== 'mentorship' &&
    !isEventsLoading &&
    visibleEvents.length === 0;

  useEffect(() => {
    setActiveTab(getTabFromSearchParams(mode, searchParams));
  }, [mode, searchParams]);

  const selectTab = (tab: EventManagerTab) => {
    setActiveTab(tab);
    setShowCreate(false);
    setShowCreateRequest(false);
    setCreateError('');
    reset(defaultEventFormValues);

    const nextSearchParams = new URLSearchParams(searchParams);
    if (tab === 'internal') {
      nextSearchParams.delete('tab');
    } else {
      nextSearchParams.set('tab', tab);
    }
    setSearchParams(nextSearchParams, { replace: true });
  };

  const toggleCreateForm = () => {
    setShowCreate((current) => {
      const nextValue = !current;
      if (!nextValue) {
        reset(defaultEventFormValues);
        setCreateError('');
      }
      return nextValue;
    });
  };

  const onSubmit = handleSubmit(
    (values) => {
      setCreateError('');
      createMutation.mutate({
        ...values,
        date: new Date(values.date).toISOString(),
        targetRoles: ['student'],
      });
    },
    () => {
      setCreateError('Fill the highlighted fields before creating the event.');
    },
  );

  return (
    <div className="space-y-6">
      <InstitutionWorkspaceHeader
        mode={config.headerMode}
        eyebrow="Events Studio"
        title="Events"
        description={
          activeTab === 'mentorship'
            ? undefined
            : 'Manage sessions, participants, and rankings.'
        }
        showMenu={false}
        headerAction={
          <div className="flex flex-wrap items-center justify-end gap-4">
            {activeTab === 'mentorship' ? (
              <Button
                variant="secondary"
                onClick={() => setShowCreateRequest((current) => !current)}
                className="rounded-full border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:border-slate-600 hover:bg-slate-800"
              >
                {showCreateRequest ? 'Close Request' : 'Create Request'}
              </Button>
            ) : canCreateInternalEvent ? (
              <Button
                variant="secondary"
                onClick={toggleCreateForm}
                className="rounded-full border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:border-slate-600 hover:bg-slate-800"
              >
                {showCreate ? 'Close Form' : 'Create Event'}
              </Button>
            ) : null}

            <div className="inline-flex w-fit rounded-full border border-slate-800 bg-[#0a1524] p-1">
              <button
                type="button"
                onClick={() => selectTab('internal')}
                className={getTabButtonClassName(activeTab === 'internal')}
              >
                Internal Events
              </button>
              {mode === 'college' ? (
                <button
                  type="button"
                  onClick={() => selectTab('hiring')}
                  className={getTabButtonClassName(activeTab === 'hiring')}
                >
                  Hiring Events
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => selectTab('mentorship')}
                className={getTabButtonClassName(activeTab === 'mentorship')}
              >
                Mentorship
              </button>
            </div>
          </div>
        }
      />

      {activeTab !== 'mentorship' ? (
        <section className={studioPanelClassName}>
          <div className="grid gap-px overflow-hidden rounded-xl border border-slate-800 bg-slate-800 lg:grid-cols-4">
            {workspaceStats.map((stat, index) => (
              <div
                key={stat.label}
                className={`${workspaceStatSurfaceClassNames[index % workspaceStatSurfaceClassNames.length]} px-4 py-5 sm:px-5`}
              >
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
      ) : null}

      {activeTab === 'mentorship' ? (
        <MentorshipProgramPanel
          queryKey={config.mentorshipQueryKey}
          heading={config.mentorshipHeading}
          description={config.mentorshipDescription}
          fetchPrograms={config.fetchPrograms}
          createProgram={config.createProgram}
          compact
          showCreateRequest={showCreateRequest}
          onShowCreateRequestChange={setShowCreateRequest}
          hideCreateTrigger
        />
      ) : null}

      {showCreate && canCreateInternalEvent && activeTab !== 'mentorship' ? (
        <section className={studioPanelClassName}>
          <div className="grid gap-px bg-slate-800 xl:grid-cols-[minmax(0,1.45fr)_320px]">
            <div className="bg-[#08131f] p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Create Event
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    Add a new session
                  </div>
                </div>
                <div className="rounded-full border border-slate-700 bg-[#0d1828] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
                  Students
                </div>
              </div>

              <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label htmlFor="event-title" className={fieldLabelClassName}>
                      Event Title
                    </label>
                    <Input
                      id="event-title"
                      placeholder="Innovation Sprint"
                      aria-invalid={Boolean(errors.title)}
                      className={errors.title ? inputErrorClassName : undefined}
                      {...register('title')}
                    />
                    {errors.title ? (
                      <p className={fieldErrorClassName}>{errors.title.message}</p>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor="event-type" className={fieldLabelClassName}>
                      Event Type
                    </label>
                    <select
                      id="event-type"
                      aria-invalid={Boolean(errors.type)}
                      className={`w-full rounded-2xl border bg-slate-950 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 ${
                        errors.type ? inputErrorClassName : 'border-slate-700'
                      }`}
                      {...register('type')}
                    >
                      {eventTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {errors.type ? (
                      <p className={fieldErrorClassName}>{errors.type.message}</p>
                    ) : null}
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="event-date" className={fieldLabelClassName}>
                      Date And Time
                    </label>
                    <Input
                      id="event-date"
                      type="datetime-local"
                      aria-invalid={Boolean(errors.date)}
                      className={errors.date ? inputErrorClassName : undefined}
                      {...register('date')}
                    />
                    {errors.date ? (
                      <p className={fieldErrorClassName}>{errors.date.message}</p>
                    ) : null}
                  </div>

                  <div className="md:col-span-2">
                    <label
                      htmlFor="event-description"
                      className={fieldLabelClassName}
                    >
                      Description
                    </label>
                    <textarea
                      id="event-description"
                      placeholder="Add the event flow, goals, and what students submit."
                      aria-invalid={Boolean(errors.description)}
                      className={`min-h-36 w-full rounded-[24px] border bg-slate-950 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 ${
                        errors.description
                          ? inputErrorClassName
                          : 'border-slate-700'
                      }`}
                      {...register('description')}
                    />
                    {errors.description ? (
                      <p className={fieldErrorClassName}>
                        {errors.description.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                {createError ? (
                  <div className="rounded-2xl border border-rose-700 bg-rose-900 px-4 py-3 text-sm text-rose-200">
                    {createError}
                  </div>
                ) : null}

                <div className="flex justify-end">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create Event'}
                  </Button>
                </div>
              </form>
            </div>

            <div className="bg-[#0a1624] p-5 sm:p-7">
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Notes
              </div>
              <div className="mt-6 space-y-4">
                {[
                  'Keep the event name specific.',
                  'Set the exact schedule before publishing.',
                  'Explain what students need to submit.',
                  'Compute rankings after submissions are added.',
                ].map((item, index) => (
                  <div
                    key={item}
                    className={`${insetPanelClassName} flex items-center gap-4 px-4 py-4`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-[#08131f] text-sm font-semibold text-slate-300">
                      0{index + 1}
                    </div>
                    <div className="text-sm font-medium text-slate-200">
                      {item}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {isEventsLoading ? (
        <section className={`${studioPanelClassName} px-5 py-8 text-sm text-slate-400 sm:px-7`}>
          Loading events...
        </section>
      ) : null}

      {hasNoVisibleEvents ? (
        <section className={studioPanelClassName}>
          <div className="px-5 py-10 text-center sm:px-7">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              {mode === 'college' && activeTab === 'hiring'
                ? 'Hiring Board'
                : 'Event Feed'}
            </div>
            <div className="mt-4 text-2xl font-semibold text-white">
              {mode === 'college' && activeTab === 'hiring'
                ? 'No recruiter sessions yet'
                : 'No live events yet'}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab !== 'mentorship' && !isEventsLoading && visibleEvents.length > 0 ? (
        <div className={studioPanelClassName}>
          <div className="divide-y divide-slate-800">
            {visibleEvents.map((event) => {
              const computedAtLabel = event.rankingsComputedAt
                ? formatDateTime(event.rankingsComputedAt)
                : null;

              return (
                <article
                  key={event._id}
                  className={`transition ${
                    focusedEventId === event._id
                      ? 'bg-[#0b1726]'
                      : 'bg-[#08121e]'
                  }`}
                >
                  <div className="grid gap-8 p-5 sm:p-7 xl:grid-cols-[minmax(0,1.4fr)_minmax(250px,0.8fr)]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={getCategoryBadgeClass(event)}>
                          {event.category === 'hiring'
                            ? 'Hiring Event'
                            : 'Internal Event'}
                        </Badge>
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-[#0e1828] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {event.type}
                        </div>
                      </div>

                      <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">
                        {event.title}
                      </h2>
                      <div className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                        {event.description}
                      </div>

                      <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-slate-800 bg-slate-800 sm:grid-cols-2 xl:grid-cols-4">
                        <div className={`${eventMetaSurfaceClassNames[0]} px-4 py-4`}>
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                            <Clock3 className="h-3.5 w-3.5" />
                            Schedule
                          </div>
                          <div className="mt-3 text-sm font-medium text-slate-100">
                            {formatDateTime(event.scheduledAt)}
                          </div>
                        </div>
                        <div className={`${eventMetaSurfaceClassNames[1]} px-4 py-4`}>
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                            <Users className="h-3.5 w-3.5" />
                            Participants
                          </div>
                          <div className="mt-3 text-sm font-medium text-slate-100">
                            {event.participantsCount} joined
                          </div>
                        </div>
                        <div className={`${eventMetaSurfaceClassNames[2]} px-4 py-4`}>
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                            <Trophy className="h-3.5 w-3.5" />
                            Rankings
                          </div>
                          <div className="mt-3 text-sm font-medium text-slate-100">
                            {event.rankings.length > 0
                              ? `${event.rankings.length} positions ready`
                              : 'Waiting for compute'}
                          </div>
                        </div>
                        <div className={`${eventMetaSurfaceClassNames[3]} px-4 py-4`}>
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                            <BriefcaseBusiness className="h-3.5 w-3.5" />
                            Host
                          </div>
                          <div className="mt-3 text-sm font-medium text-slate-100">
                            {event.recruiterName ?? 'Institution managed'}
                          </div>
                          {typeof event.minimumInnovationScore === 'number' &&
                          event.category === 'hiring' ? (
                            <div className="mt-1 text-xs text-amber-300">
                              Minimum score {event.minimumInnovationScore}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 xl:items-end">
                      <Button
                        variant="secondary"
                        onClick={() => computeMutation.mutate(event._id)}
                        className="w-full rounded-full border border-slate-700 bg-slate-900 text-white hover:border-slate-600 hover:bg-slate-800 xl:w-auto"
                      >
                        Compute Rankings
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={event.participants.length === 0}
                        onClick={() => {
                          const isClosing = scoringEventId === event._id;
                          setScoringEventId(isClosing ? null : event._id);
                          setScoreDraft({
                            studentId: isClosing
                              ? ''
                              : event.participants[0]?.studentId ?? '',
                            score: '',
                          });
                        }}
                        className="w-full rounded-full border border-slate-700 bg-slate-900 text-white hover:border-slate-600 hover:bg-slate-800 xl:w-auto"
                      >
                        {event.participants.length === 0
                          ? 'No Participants Yet'
                          : scoringEventId === event._id
                            ? 'Hide Score Form'
                            : 'Add Submission Score'}
                      </Button>
                      {computedAtLabel ? (
                        <div className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500 xl:text-right">
                          Updated {computedAtLabel}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-px border-t border-slate-800 bg-slate-800 xl:grid-cols-2">
                    <section className="bg-[#081321] p-5 sm:p-7">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
                          Participants
                        </div>
                        <div className="text-sm text-slate-500">
                          {event.participants.length} entries
                        </div>
                      </div>

                      {event.participants.length === 0 ? (
                        <div className="mt-5 rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-500">
                          No students have joined this event yet.
                        </div>
                      ) : (
                        <div className="mt-5 divide-y divide-slate-800">
                          {event.participants.map((participant) => (
                            <div
                              key={`${event._id}-${participant.studentId}`}
                              className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto]"
                            >
                              <div>
                                <div className="text-base font-semibold text-white">
                                  {participant.studentName}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-400">
                                  <span>
                                    Innovation {participant.innovationScore}
                                  </span>
                                  <span>
                                    Joined {formatDateOnly(participant.registeredAt)}
                                  </span>
                                </div>
                              </div>
                              <div className="text-sm text-slate-300 md:text-right">
                                {typeof participant.submissionScore === 'number'
                                  ? `Submission ${participant.submissionScore}`
                                  : 'Submission pending'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {scoringEventId === event._id &&
                      event.participants.length > 0 ? (
                        <div className={`${insetPanelClassName} mt-6 p-4`}>
                          <div className="grid gap-4 lg:grid-cols-2">
                            <select
                              value={scoreDraft.studentId}
                              onChange={(currentEvent) =>
                                setScoreDraft((current) => ({
                                  ...current,
                                  studentId: currentEvent.target.value,
                                }))
                              }
                              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                            >
                              {event.participants.map((participant) => (
                                <option
                                  key={participant.studentId}
                                  value={participant.studentId}
                                >
                                  {participant.studentName}
                                </option>
                              ))}
                            </select>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={scoreDraft.score}
                              onChange={(currentEvent) =>
                                setScoreDraft((current) => ({
                                  ...current,
                                  score: currentEvent.target.value,
                                }))
                              }
                              placeholder="Submission score"
                            />
                          </div>
                          <div className="mt-4 flex justify-end">
                            <Button
                              onClick={() =>
                                submissionMutation.mutate({
                                  eventId: event._id,
                                  studentId: scoreDraft.studentId,
                                  score: Number(scoreDraft.score),
                                })
                              }
                              disabled={
                                submissionMutation.isPending ||
                                !scoreDraft.studentId ||
                                scoreDraft.score.trim() === '' ||
                                Number(scoreDraft.score) < 0 ||
                                Number(scoreDraft.score) > 100
                              }
                            >
                              {submissionMutation.isPending
                                ? 'Saving...'
                                : 'Save Submission Score'}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </section>

                    <section className="bg-[#0b1623] p-5 sm:p-7">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
                          Rankings
                        </div>
                        <div className="text-sm text-slate-500">
                          60% submission / 40% innovation
                        </div>
                      </div>

                      {event.rankings.length === 0 ? (
                        <div className="mt-5 rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-500">
                          Rankings will appear here after computation.
                        </div>
                      ) : (
                        <div className="mt-5 divide-y divide-slate-800">
                          {event.rankings.map((ranking) => (
                            <div
                              key={`${event._id}-${ranking.studentId}`}
                              className="grid gap-3 py-4 md:grid-cols-[72px,minmax(0,1fr),120px,120px,120px]"
                            >
                              <div className="text-lg font-semibold text-cyan-300">
                                #{ranking.rank}
                              </div>
                              <div className="font-semibold text-white">
                                {ranking.studentName}
                              </div>
                              <div className="text-sm text-slate-200">
                                Composite {ranking.compositeScore}
                              </div>
                              <div className="text-sm text-slate-400">
                                Innovation {ranking.innovationScore}
                              </div>
                              <div className="text-sm text-slate-400">
                                Submission {ranking.submissionScore}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
