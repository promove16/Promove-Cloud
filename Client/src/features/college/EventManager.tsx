import { useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Award,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Crown,
  Filter,
  Flame,
  Medal,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { collegeApi } from '../../api/college.api';
import { eventApi } from '../../api/event.api';
import { requestApi } from '../../api/request.api';
import { schoolApi } from '../../api/school.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toast } from '../../components/ui/sonner';
import { ApiErrorResponse } from '../../types/auth.types';
import type { CollegeEvent } from '../../types/college.types';
import type { WorkflowRequest } from '../../types/request.types';
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
type StatusFilter = 'all' | 'upcoming' | 'live' | 'scoring' | 'rankings';
type SortOption = 'date-desc' | 'date-asc' | 'participants-desc' | 'title-asc';

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
    mentorshipHeading: 'College Mentorship Requests',
    mentorshipDescription:
      'Request mentorship programs for your college, route them to admin for approval, and monitor mentor assignment decisions seamlessly.',
    fetchPrograms: collegeApi.getMentorshipPrograms,
    createProgram: collegeApi.createMentorshipProgram,
    createEvent: collegeApi.createEvent,
  },
  school: {
    headerMode: 'school',
    queryKey: 'school-events',
    listEvents: schoolApi.listEvents,
    mentorshipQueryKey: 'school-mentorship-programs',
    mentorshipHeading: 'School Mentorship Requests',
    mentorshipDescription:
      'Request mentorship programs for your school, send them to admin for approval, and track assigned mentors and scheduling decisions.',
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

  return mode === 'college' ? 'hiring' : 'internal';
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

const getRequestMetadataString = (request: WorkflowRequest, key: string) => {
  const value = request.metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const getRequestStatusClassName = (status: WorkflowRequest['status']) => {
  if (status === 'pending') return 'border-amber-500/40 bg-amber-950/60 text-amber-300';
  if (status === 'accepted' || status === 'completed') {
    return 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300';
  }
  if (status === 'declined') return 'border-rose-500/40 bg-rose-950/60 text-rose-300';
  return 'border-slate-700 bg-slate-900 text-slate-300';
};

function getEventStatusBadge(event: CollegeEvent) {
  const scheduledTime = new Date(event.scheduledAt).getTime();
  const now = Date.now();
  const isPast = scheduledTime < now;
  const isFinalized = Boolean(event.rankingsComputedAt);

  if (isFinalized) {
    return {
      label: 'Rankings Finalized',
      className:
        'border-emerald-500/40 bg-emerald-950/60 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
      icon: CheckCircle2,
    };
  }

  if (isPast) {
    if (event.participants.some((p) => typeof p.submissionScore === 'number')) {
      return {
        label: 'Needs Ranking',
        className:
          'border-amber-500/40 bg-amber-950/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]',
        icon: Trophy,
      };
    }
    return {
      label: 'Scoring Pending',
      className:
        'border-purple-500/40 bg-purple-950/60 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.15)]',
      icon: Flame,
    };
  }

  return {
    label: 'Upcoming Session',
    className:
      'border-cyan-500/40 bg-cyan-950/60 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.15)]',
    icon: Clock3,
  };
}

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateRequest, setShowCreateRequest] = useState(false);
  const [createError, setCreateError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [eventSubTabMap, setEventSubTabMap] = useState<
    Record<string, 'overview' | 'participants' | 'leaderboard'>
  >({});

  const [scoreModalEvent, setScoreModalEvent] = useState<CollegeEvent | null>(
    null,
  );
  const [scoreStudentId, setScoreStudentId] = useState('');
  const [scoreValue, setScoreValue] = useState<string>('');
  const [selectedEventRequest, setSelectedEventRequest] = useState<WorkflowRequest | null>(null);

  const focusedEventId = searchParams.get('eventId');
  const focusedRequestId = searchParams.get('requestId');
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

  const eventRequestsQuery = useQuery({
    queryKey: ['requests', 'incoming'],
    queryFn: requestApi.incoming,
    enabled: mode === 'college',
  });

  const eventInviteRequests = useMemo(
    () =>
      (eventRequestsQuery.data ?? []).filter(
        (request) => request.type === 'college_event_invite',
      ),
    [eventRequestsQuery.data],
  );

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
      setShowCreateModal(false);
      toast.success('Event created successfully!');
      await refreshEventQueries();
    },
    onError: (error) => {
      const msg = getErrorMessage(
        error,
        'Unable to create this event right now.',
      );
      setCreateError(msg);
      toast.error(msg);
    },
  });

  const computeMutation = useMutation({
    mutationFn: eventApi.computeRankings,
    onSuccess: async () => {
      toast.success('Event rankings computed successfully!');
      await refreshEventQueries();
    },
    onError: (error) => {
      toast.error(
        getErrorMessage(error, 'Failed to compute rankings for event.'),
      );
    },
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
      toast.success('Submission score saved!');
      setScoreModalEvent(null);
      setScoreStudentId('');
      setScoreValue('');
      await refreshEventQueries();
    },
    onError: (error) => {
      toast.error(
        getErrorMessage(error, 'Failed to update submission score.'),
      );
    },
  });

  const eventRequestMutation = useMutation({
    mutationFn: ({ requestId, action }: { requestId: string; action: 'accept' | 'decline' }) =>
      action === 'accept' ? requestApi.accept(requestId) : requestApi.decline(requestId),
    onSuccess: async (request, variables) => {
      await Promise.all([
        refreshEventQueries(),
        queryClient.invalidateQueries({ queryKey: ['requests'] }),
      ]);

      setSelectedEventRequest(null);
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set('tab', 'hiring');
      nextSearchParams.delete('requestId');
      const eventId = getRequestMetadataString(request, 'eventId');
      if (variables.action === 'accept' && eventId) {
        nextSearchParams.set('eventId', eventId);
        toast.success('Event added to the hiring calendar. The recruiter and eligible students were notified.');
      } else {
        nextSearchParams.delete('eventId');
        toast.success('Event request declined.');
      }
      setSearchParams(nextSearchParams, { replace: true });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Unable to update this event request.'));
    },
  });

  const rawEvents = useMemo(() => {
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

  const filteredEvents = useMemo(() => {
    let result = [...rawEvents];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (ev) =>
          ev.title.toLowerCase().includes(q) ||
          ev.description.toLowerCase().includes(q) ||
          ev.type.toLowerCase().includes(q) ||
          (ev.recruiterName && ev.recruiterName.toLowerCase().includes(q)) ||
          (ev.companyName && ev.companyName.toLowerCase().includes(q)) ||
          ev.participants.some((p) => p.studentName.toLowerCase().includes(q)),
      );
    }

    const now = Date.now();
    if (statusFilter === 'upcoming') {
      result = result.filter(
        (ev) => new Date(ev.scheduledAt).getTime() >= now,
      );
    } else if (statusFilter === 'live') {
      result = result.filter((ev) => {
        const time = new Date(ev.scheduledAt).getTime();
        return time <= now && !ev.rankingsComputedAt;
      });
    } else if (statusFilter === 'scoring') {
      result = result.filter(
        (ev) =>
          !ev.rankingsComputedAt &&
          ev.participants.some((p) => typeof p.submissionScore !== 'number'),
      );
    } else if (statusFilter === 'rankings') {
      result = result.filter((ev) => ev.rankingsComputedAt);
    }

    result.sort((a, b) => {
      if (sortBy === 'date-desc') {
        return (
          new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
        );
      }
      if (sortBy === 'date-asc') {
        return (
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        );
      }
      if (sortBy === 'participants-desc') {
        return b.participantsCount - a.participantsCount;
      }
      if (sortBy === 'title-asc') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });

    return result;
  }, [rawEvents, searchQuery, statusFilter, sortBy]);

  const workspaceStats = useMemo(() => {
    const participants = rawEvents.reduce(
      (total, event) => total + event.participantsCount,
      0,
    );
    const rankedParticipants = rawEvents.reduce(
      (total, event) => total + event.rankings.length,
      0,
    );
    const rankedEvents = rawEvents.filter(
      (event) => event.rankings.length > 0,
    ).length;

    return [
      {
        label: activeTab === 'hiring' ? 'Recruiter Sessions' : 'Live Sessions',
        value: String(rawEvents.length),
        accent: 'from-cyan-500/20 to-blue-600/10 text-cyan-300 border-cyan-500/30',
        icon: CalendarDays,
      },
      {
        label: 'Total Participants',
        value: String(participants),
        accent: 'from-emerald-500/20 to-teal-600/10 text-emerald-300 border-emerald-500/30',
        icon: Users,
      },
      {
        label: activeTab === 'hiring' ? 'Ranked Candidates' : 'Ranked Students',
        value: String(rankedParticipants),
        accent: 'from-amber-500/20 to-yellow-600/10 text-amber-300 border-amber-500/30',
        icon: Trophy,
      },
      {
        label: 'Leaderboards Ready',
        value: String(rankedEvents),
        accent: 'from-fuchsia-500/20 to-purple-600/10 text-fuchsia-300 border-fuchsia-500/30',
        icon: Sparkles,
      },
    ];
  }, [activeTab, rawEvents]);

  const canCreateInternalEvent = mode === 'school' || activeTab === 'internal';
  const isEventsLoading =
    activeTab !== 'mentorship' &&
    (eventsQuery.isLoading ||
      (mode === 'college' &&
        activeTab === 'hiring' &&
        hiringEventsQuery.isLoading));

  useEffect(() => {
    setActiveTab(getTabFromSearchParams(mode, searchParams));
  }, [mode, searchParams]);

  useEffect(() => {
    if (!focusedRequestId || eventRequestsQuery.isLoading) return;
    const request = eventInviteRequests.find((item) => item._id === focusedRequestId);
    if (request) setSelectedEventRequest(request);
  }, [eventInviteRequests, eventRequestsQuery.isLoading, focusedRequestId]);

  const openEventRequest = (request: WorkflowRequest) => {
    setSelectedEventRequest(request);
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('tab', 'hiring');
    nextSearchParams.set('requestId', request._id);
    nextSearchParams.delete('eventId');
    setSearchParams(nextSearchParams, { replace: true });
  };

  const closeEventRequest = () => {
    setSelectedEventRequest(null);
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('requestId');
    setSearchParams(nextSearchParams, { replace: true });
  };

  const selectTab = (tab: EventManagerTab) => {
    setActiveTab(tab);
    setShowCreateModal(false);
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

  const openScoreModal = (event: CollegeEvent) => {
    setScoreModalEvent(event);
    if (event.participants.length > 0) {
      const defaultStudent = event.participants[0];
      setScoreStudentId(defaultStudent.studentId);
      setScoreValue(
        typeof defaultStudent.submissionScore === 'number'
          ? String(defaultStudent.submissionScore)
          : '',
      );
    }
  };

  const getSubTab = (eventId: string) => {
    return eventSubTabMap[eventId] || 'overview';
  };

  const setSubTab = (
    eventId: string,
    tab: 'overview' | 'participants' | 'leaderboard',
  ) => {
    setEventSubTabMap((prev) => ({ ...prev, [eventId]: tab }));
  };

  return (
    <div className="space-y-6 pb-24 xl:pb-8">
      <InstitutionWorkspaceHeader
        mode={config.headerMode}
        eyebrow="Events Studio"
        title="Events Workspace"
        description={
          activeTab === 'mentorship'
            ? undefined
            : 'Manage campus hackathons, recruiter drives, student submissions, and automated rankings.'
        }
        showMenu={false}
        headerAction={
          <div className="flex flex-wrap items-center justify-end gap-3">
            {activeTab === 'mentorship' ? (
              <Button
                variant="secondary"
                onClick={() => setShowCreateRequest((current) => !current)}
                className="rounded-full border border-slate-700 bg-slate-900/90 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:border-cyan-500/50 hover:bg-slate-800"
              >
                {showCreateRequest ? 'Close Request' : 'Create Mentorship Request'}
              </Button>
            ) : canCreateInternalEvent ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setShowCreateModal(true);
                  setCreateError('');
                }}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-gradient-to-r from-cyan-600/90 to-blue-600/90 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_16px_rgba(6,182,212,0.25)] hover:from-cyan-500 hover:to-blue-500"
              >
                <Plus className="h-4 w-4" />
                Create Event
              </Button>
            ) : null}

            <div className="inline-flex items-center rounded-full border border-slate-800 bg-[#070e17]/90 p-1 backdrop-blur-md">
              {mode === 'college' ? (
                <button
                  type="button"
                  onClick={() => selectTab('hiring')}
                  className={`relative rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                    activeTab === 'hiring'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Hiring Events
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => selectTab('internal')}
                className={`relative rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  activeTab === 'internal'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Internal Sessions
              </button>
              <button
                type="button"
                onClick={() => selectTab('mentorship')}
                className={`relative rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  activeTab === 'mentorship'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Mentorship
              </button>
            </div>
          </div>
        }
      />

      {activeTab !== 'mentorship' ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {workspaceStats.map((stat) => (
            <div
              key={stat.label}
              className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 backdrop-blur-md transition-all duration-300 hover:scale-[1.01] ${stat.accent}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                  {stat.label}
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  <stat.icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 text-3xl font-extrabold tracking-tight">
                {stat.value}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {activeTab !== 'mentorship' ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-[#070f1b]/80 p-4 backdrop-blur-md lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, recruiter, company, or participant name..."
              className="w-full rounded-xl border border-slate-800 bg-[#0a1526] py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800 bg-[#0a1526] p-1">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'upcoming', label: 'Upcoming' },
                  { id: 'live', label: 'Live' },
                  { id: 'scoring', label: 'Needs Scoring' },
                  { id: 'rankings', label: 'Ranked' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    statusFilter === f.id
                      ? 'bg-slate-800 text-cyan-300 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-[#0a1526] px-3 py-2 text-xs text-slate-300">
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent font-semibold text-slate-200 focus:outline-none"
              >
                <option value="date-desc" className="bg-slate-900 text-white">
                  Newest Date
                </option>
                <option value="date-asc" className="bg-slate-900 text-white">
                  Oldest Date
                </option>
                <option
                  value="participants-desc"
                  className="bg-slate-900 text-white"
                >
                  Most Participants
                </option>
                <option value="title-asc" className="bg-slate-900 text-white">
                  Title A-Z
                </option>
              </select>
            </div>
          </div>
        </section>
      ) : null}

      {mode === 'college' && activeTab === 'hiring' ? (
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#070f1b]/90 backdrop-blur-md">
          <div className="flex flex-col gap-3 border-b border-slate-800 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Event Requests</div>
              <h2 className="mt-2 text-xl font-bold text-white">Recruiter invitations requiring review</h2>
              <p className="mt-1 text-sm text-slate-400">
                Open a request to review the sender, relationship record, and complete event proposal.
              </p>
            </div>
            <Badge className="border-amber-500/30 bg-amber-950/50 text-amber-300">
              {eventInviteRequests.filter((request) => request.status === 'pending').length} pending
            </Badge>
          </div>

          {eventRequestsQuery.isLoading ? (
            <div className="px-5 py-8 text-sm text-slate-400">Loading event requests...</div>
          ) : eventRequestsQuery.isError ? (
            <div className="px-5 py-8 text-sm text-rose-300">Unable to load event requests.</div>
          ) : eventInviteRequests.length === 0 ? (
            <div className="px-5 py-8 text-sm text-slate-500">No recruiter event requests yet.</div>
          ) : (
            <div className="divide-y divide-slate-800">
              {eventInviteRequests.map((request) => {
                const title = getRequestMetadataString(request, 'title') ?? 'Untitled event';
                const scheduledAt = getRequestMetadataString(request, 'date');
                return (
                  <div
                    key={request._id}
                    className="flex flex-col gap-4 px-5 py-4 transition hover:bg-slate-900/40 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white">{title}</span>
                        <Badge className={getRequestStatusClassName(request.status)}>
                          {request.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        From {request.fromUser?.displayName ?? request.fromUser?.email ?? 'Recruiter'}
                        {scheduledAt ? ` · ${formatDateTime(scheduledAt)}` : ''}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:border-cyan-500/50"
                      onClick={() => openEventRequest(request)}
                    >
                      View Details
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
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

      {isEventsLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl border border-slate-800 bg-[#07111e]/60"
            />
          ))}
        </div>
      ) : null}

      {activeTab !== 'mentorship' && !isEventsLoading && filteredEvents.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-800 bg-[#060e18]/80 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-400">
            <Filter className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-xl font-bold text-white">No Events Found</h3>
          <p className="mt-2 text-sm text-slate-400">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search query or filters.'
              : mode === 'college' && activeTab === 'hiring'
                ? 'No recruiter sessions or drives available yet.'
                : 'No live internal events created yet.'}
          </p>
          {(searchQuery || statusFilter !== 'all') && (
            <Button
              variant="secondary"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="mt-5 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200"
            >
              Clear Search & Filters
            </Button>
          )}
        </section>
      ) : null}

      {activeTab !== 'mentorship' && !isEventsLoading && filteredEvents.length > 0 ? (
        <div className="space-y-6">
          {filteredEvents.map((event) => {
            const badge = getEventStatusBadge(event);
            const computedAtLabel = event.rankingsComputedAt
              ? formatDateTime(event.rankingsComputedAt)
              : null;
            const rankingsFinalized = Boolean(event.rankingsComputedAt);
            const subTab = getSubTab(event._id);
            const BadgeIcon = badge.icon;
            const top3Rankings = event.rankings.slice(0, 3);
            const remainingRankings = event.rankings.slice(3);

            return (
              <article
                key={event._id}
                className={`overflow-hidden rounded-2xl border transition-all duration-300 ${
                  focusedEventId === event._id
                    ? 'border-cyan-500/60 bg-[#081525] shadow-[0_0_24px_rgba(6,182,212,0.15)]'
                    : 'border-slate-800/80 bg-[#07101b] hover:border-slate-700'
                }`}
              >
                <div className="p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${badge.className}`}
                      >
                        <BadgeIcon className="h-3.5 w-3.5" />
                        {badge.label}
                      </div>

                      <Badge
                        className={
                          event.category === 'hiring'
                            ? 'border-amber-500/40 bg-amber-950/60 text-amber-200'
                            : 'border-cyan-500/40 bg-cyan-950/60 text-cyan-200'
                        }
                      >
                        {event.category === 'hiring'
                          ? 'Hiring Event'
                          : 'Internal Event'}
                      </Badge>

                      <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs font-semibold text-slate-300">
                        <CalendarDays className="h-3.5 w-3.5 text-cyan-400" />
                        {event.type}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {!rankingsFinalized ? (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => openScoreModal(event)}
                            disabled={event.participants.length === 0}
                            className="rounded-full border border-slate-700 bg-slate-900/90 text-xs font-semibold text-slate-200 hover:border-cyan-500/50 hover:bg-slate-800"
                          >
                            {event.participants.length === 0
                              ? 'No Participants'
                              : 'Add / Edit Scores'}
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => computeMutation.mutate(event._id)}
                            disabled={computeMutation.isPending}
                            className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-gradient-to-r from-cyan-600/90 to-blue-600/90 text-xs font-semibold text-white shadow-[0_0_12px_rgba(6,182,212,0.2)] hover:from-cyan-500 hover:to-blue-500"
                          >
                            <Trophy className="h-3.5 w-3.5" />
                            {computeMutation.isPending
                              ? 'Computing...'
                              : 'Compute Rankings'}
                          </Button>
                        </>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Rankings Computed
                        </div>
                      )}
                    </div>
                  </div>

                  <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    {event.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {event.description}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-800/90 bg-[#091524] p-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        <Clock3 className="h-3.5 w-3.5 text-cyan-400" />
                        Schedule
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-100">
                        {formatDateTime(event.scheduledAt)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800/90 bg-[#091524] p-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        <Users className="h-3.5 w-3.5 text-emerald-400" />
                        Joined
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-100">
                        {event.participantsCount} Students
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800/90 bg-[#091524] p-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        <Trophy className="h-3.5 w-3.5 text-amber-400" />
                        Ranked
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-100">
                        {event.rankings.length > 0
                          ? `${event.rankings.length} Positions`
                          : 'Pending'}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800/90 bg-[#091524] p-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        <BriefcaseBusiness className="h-3.5 w-3.5 text-fuchsia-400" />
                        Host
                      </div>
                      <div className="mt-1 truncate text-xs font-medium text-slate-100">
                        {event.recruiterName
                          ? event.companyName || event.recruiterCompany || event.recruiterName
                          : 'Institution'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center border-t border-slate-800/80 bg-[#050b14] px-6">
                  <button
                    type="button"
                    onClick={() => setSubTab(event._id, 'overview')}
                    className={`border-b-2 px-4 py-3 text-xs font-semibold transition ${
                      subTab === 'overview'
                        ? 'border-cyan-400 text-cyan-300'
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    Event Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubTab(event._id, 'participants')}
                    className={`border-b-2 px-4 py-3 text-xs font-semibold transition ${
                      subTab === 'participants'
                        ? 'border-cyan-400 text-cyan-300'
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    Participants ({event.participants.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubTab(event._id, 'leaderboard')}
                    className={`border-b-2 px-4 py-3 text-xs font-semibold transition ${
                      subTab === 'leaderboard'
                        ? 'border-cyan-400 text-cyan-300'
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    Leaderboard & Podium ({event.rankings.length})
                  </button>
                </div>

                <div className="border-t border-slate-800/60 bg-[#08121f] p-6">
                  {subTab === 'overview' && (
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Host Information & Criteria
                        </h4>
                        <div className="rounded-xl border border-slate-800 bg-[#050d18] p-4 text-xs space-y-2">
                          <div className="flex justify-between border-b border-slate-800 pb-2">
                            <span className="text-slate-400">Host Type:</span>
                            <span className="font-semibold text-white">
                              {event.recruiterName
                                ? 'Recruiter Drive'
                                : 'Institution Managed'}
                            </span>
                          </div>
                          {event.recruiterName && (
                            <div className="flex justify-between border-b border-slate-800 pb-2">
                              <span className="text-slate-400">Recruiter:</span>
                              <span className="font-semibold text-cyan-300">
                                {event.recruiterName}
                              </span>
                            </div>
                          )}
                          {event.jobTitle && (
                            <div className="flex justify-between border-b border-slate-800 pb-2">
                              <span className="text-slate-400">Target Role:</span>
                              <span className="font-semibold text-emerald-300">
                                {event.jobTitle}
                              </span>
                            </div>
                          )}
                          {typeof event.minimumInnovationScore === 'number' && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">
                                Min Innovation Score:
                              </span>
                              <span className="font-semibold text-amber-300">
                                {event.minimumInnovationScore}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Scoring Formula & Weights
                        </h4>
                        <div className="rounded-xl border border-slate-800 bg-[#050d18] p-4 text-xs space-y-2 text-slate-300">
                          <p>
                            Composite rankings are computed automatically:
                          </p>
                          <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-900/90 px-3 py-2">
                            <span className="font-medium text-cyan-300">
                              Submission Score Weight
                            </span>
                            <span className="font-bold text-white">60%</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg bg-slate-900/90 px-3 py-2">
                            <span className="font-medium text-emerald-300">
                              Innovation Score Weight
                            </span>
                            <span className="font-bold text-white">40%</span>
                          </div>
                          {computedAtLabel && (
                            <div className="mt-2 text-[11px] text-slate-400 text-right">
                              Last computed on {computedAtLabel}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {subTab === 'participants' && (
                    <div>
                      {event.participants.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
                          No students have registered for this session yet.
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {event.participants.map((p) => {
                            const scoreSubmitted =
                              typeof p.submissionScore === 'number';

                            return (
                              <div
                                key={p.studentId}
                                className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-[#050d18] p-3.5"
                              >
                                <div>
                                  <div className="text-sm font-semibold text-white">
                                    {p.studentName}
                                  </div>
                                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                                    <span>Innov: {p.innovationScore}</span>
                                    <span>{formatDateOnly(p.registeredAt)}</span>
                                  </div>
                                </div>
                                <div>
                                  {scoreSubmitted ? (
                                    <span className="rounded-full border border-emerald-500/30 bg-emerald-950/60 px-2.5 py-1 text-xs font-bold text-emerald-300">
                                      Score: {p.submissionScore}
                                    </span>
                                  ) : (
                                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-400">
                                      Pending
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {subTab === 'leaderboard' && (
                    <div className="space-y-6">
                      {event.rankings.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center">
                          <Trophy className="mx-auto h-8 w-8 text-slate-600" />
                          <p className="mt-2 text-sm text-slate-400">
                            Rankings have not been computed yet.
                          </p>
                          {!rankingsFinalized && event.participants.length > 0 && (
                            <Button
                              variant="secondary"
                              onClick={() => computeMutation.mutate(event._id)}
                              className="mt-4 rounded-full border border-cyan-500/40 bg-cyan-950/60 text-xs font-semibold text-cyan-300 hover:bg-cyan-900"
                            >
                              Compute Rankings Now
                            </Button>
                          )}
                        </div>
                      ) : (
                        <>
                          {top3Rankings.length > 0 && (
                            <div>
                              <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                                Top Performers Podium
                              </h4>
                              <div className="grid gap-4 sm:grid-cols-3">
                                {top3Rankings[1] ? (
                                  <div className="relative overflow-hidden rounded-2xl border border-slate-400/30 bg-gradient-to-b from-slate-400/10 via-[#071322] to-[#040a14] p-5 shadow-lg">
                                    <div className="flex items-center justify-between">
                                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-300/20 text-slate-300 font-bold">
                                        #2
                                      </div>
                                      <Medal className="h-6 w-6 text-slate-300" />
                                    </div>
                                    <h5 className="mt-3 truncate text-lg font-bold text-white">
                                      {top3Rankings[1].studentName}
                                    </h5>
                                    <div className="mt-3 rounded-xl bg-slate-950/80 p-3 text-xs space-y-1.5">
                                      <div className="flex justify-between">
                                        <span className="text-slate-400">
                                          Composite:
                                        </span>
                                        <span className="font-bold text-slate-200">
                                          {top3Rankings[1].compositeScore}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-[11px] text-slate-400">
                                        <span>Submission:</span>
                                        <span>
                                          {top3Rankings[1].submissionScore}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-[11px] text-slate-400">
                                        <span>Innovation:</span>
                                        <span>
                                          {top3Rankings[1].innovationScore}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="hidden sm:block" />
                                )}

                                {top3Rankings[0] && (
                                  <div className="relative overflow-hidden rounded-2xl border border-amber-500/50 bg-gradient-to-b from-amber-500/20 via-[#08172b] to-[#050c18] p-5 shadow-[0_0_24px_rgba(245,158,11,0.15)] sm:-translate-y-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 font-extrabold text-amber-300">
                                        #1
                                      </div>
                                      <Crown className="h-7 w-7 text-amber-400 animate-pulse" />
                                    </div>
                                    <h5 className="mt-3 truncate text-xl font-extrabold text-white">
                                      {top3Rankings[0].studentName}
                                    </h5>
                                    <div className="mt-3 rounded-xl bg-slate-950/90 p-3 text-xs space-y-1.5">
                                      <div className="flex justify-between">
                                        <span className="text-slate-300 font-semibold">
                                          Composite Score:
                                        </span>
                                        <span className="font-extrabold text-amber-300 text-sm">
                                          {top3Rankings[0].compositeScore}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-[11px] text-slate-400">
                                        <span>Submission (60%):</span>
                                        <span className="text-white">
                                          {top3Rankings[0].submissionScore}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-[11px] text-slate-400">
                                        <span>Innovation (40%):</span>
                                        <span className="text-white">
                                          {top3Rankings[0].innovationScore}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {top3Rankings[2] ? (
                                  <div className="relative overflow-hidden rounded-2xl border border-amber-700/30 bg-gradient-to-b from-amber-700/10 via-[#071322] to-[#040a14] p-5 shadow-lg">
                                    <div className="flex items-center justify-between">
                                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-700/20 text-amber-500 font-bold">
                                        #3
                                      </div>
                                      <Award className="h-6 w-6 text-amber-600" />
                                    </div>
                                    <h5 className="mt-3 truncate text-lg font-bold text-white">
                                      {top3Rankings[2].studentName}
                                    </h5>
                                    <div className="mt-3 rounded-xl bg-slate-950/80 p-3 text-xs space-y-1.5">
                                      <div className="flex justify-between">
                                        <span className="text-slate-400">
                                          Composite:
                                        </span>
                                        <span className="font-bold text-amber-400">
                                          {top3Rankings[2].compositeScore}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-[11px] text-slate-400">
                                        <span>Submission:</span>
                                        <span>
                                          {top3Rankings[2].submissionScore}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-[11px] text-slate-400">
                                        <span>Innovation:</span>
                                        <span>
                                          {top3Rankings[2].innovationScore}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="hidden sm:block" />
                                )}
                              </div>
                            </div>
                          )}

                          {remainingRankings.length > 0 && (
                            <div className="mt-6">
                              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                                Other Ranked Students ({remainingRankings.length})
                              </h4>
                              <div className="divide-y divide-slate-800/60 rounded-xl border border-slate-800 bg-[#050d18]">
                                {remainingRankings.map((r) => (
                                  <div
                                    key={r.studentId}
                                    className="flex items-center justify-between p-3.5 text-xs"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="font-bold text-slate-500">
                                        #{r.rank}
                                      </span>
                                      <span className="font-semibold text-white">
                                        {r.studentName}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-slate-400">
                                      <span>
                                        Composite:{' '}
                                        <strong className="text-cyan-300">
                                          {r.compositeScore}
                                        </strong>
                                      </span>
                                      <span className="hidden sm:inline">
                                        Sub: {r.submissionScore}
                                      </span>
                                      <span className="hidden sm:inline">
                                        Innov: {r.innovationScore}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {selectedEventRequest && (() => {
        const request = selectedEventRequest;
        const recruiterEvents = rawEvents.filter((event) => event.recruiterId === request.fromUserId);
        const recruiterRequests = eventInviteRequests.filter((item) => item.fromUserId === request.fromUserId);
        const acceptedRequests = recruiterRequests.filter(
          (item) => item.status === 'accepted' || item.status === 'completed',
        ).length;
        const declinedRequests = recruiterRequests.filter((item) => item.status === 'declined').length;
        const totalParticipants = recruiterEvents.reduce((sum, event) => sum + event.participantsCount, 0);
        const title = getRequestMetadataString(request, 'title') ?? 'Untitled event';
        const eventType = getRequestMetadataString(request, 'type') ?? 'Hiring event';
        const scheduledAt = getRequestMetadataString(request, 'date');
        const description = getRequestMetadataString(request, 'description') ?? 'No event description supplied.';
        const linkedJobId = getRequestMetadataString(request, 'linkedJobId');
        const minimumScore = request.metadata?.minimumInnovationScore;
        const accountApproved =
          request.fromUser?.adminApprovalStatus === 'approved' || request.fromUser?.verificationStatus === 'verified';
        const isUpdating = eventRequestMutation.isPending && eventRequestMutation.variables?.requestId === request._id;

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md">
            <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-700 bg-[#071322] shadow-2xl">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-800 bg-[#071322]/95 px-6 py-5 backdrop-blur-md">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Event Request Review</div>
                  <h2 className="mt-2 text-2xl font-bold text-white break-words">{title}</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge className="border-amber-500/30 bg-amber-950/50 text-amber-300">{eventType}</Badge>
                    <Badge className={getRequestStatusClassName(request.status)}>{request.status}</Badge>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeEventRequest}
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                  aria-label="Close event request details"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
                <div className="space-y-6 min-w-0">
                  <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Proposal Details</div>
                    <p className="mt-4 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-7 text-slate-200">{description}</p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-800 bg-[#091525] p-4">
                        <div className="text-xs text-slate-500">Scheduled for</div>
                        <div className="mt-1 font-semibold text-white">{scheduledAt ? formatDateTime(scheduledAt) : 'Not provided'}</div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-[#091525] p-4">
                        <div className="text-xs text-slate-500">Minimum innovation score</div>
                        <div className="mt-1 font-semibold text-white">{typeof minimumScore === 'number' ? minimumScore : 'No minimum'}</div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-[#091525] p-4 sm:col-span-2">
                        <div className="text-xs text-slate-500">Linked recruiter job</div>
                        <div className="mt-1 break-all font-mono text-sm text-white">{linkedJobId ?? 'No linked job'}</div>
                      </div>
                    </div>
                    {request.message ? (
                      <div className="mt-5 rounded-xl border border-cyan-900/60 bg-cyan-950/20 p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-cyan-300">Recruiter note</div>
                        <p className="mt-2 text-sm leading-6 text-slate-200 break-words [overflow-wrap:anywhere]">{request.message}</p>
                      </div>
                    ) : null}
                  </section>

                  <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">College Relationship Record</div>
                        <h3 className="mt-2 text-lg font-bold text-white">Previous activity with this recruiter</h3>
                      </div>
                      <Badge className="border-slate-700 bg-slate-900 text-slate-300">{recruiterEvents.length} events</Badge>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      {[
                        ['Requests', recruiterRequests.length],
                        ['Accepted', acceptedRequests],
                        ['Declined', declinedRequests],
                        ['Participants', totalParticipants],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-slate-800 bg-[#091525] p-3 text-center">
                          <div className="text-xl font-bold text-white">{value}</div>
                          <div className="mt-1 text-xs text-slate-500">{label}</div>
                        </div>
                      ))}
                    </div>
                    {recruiterEvents.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {recruiterEvents.slice(0, 3).map((event) => (
                          <div key={event._id} className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-[#091525] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="font-semibold text-white break-words">{event.title}</div>
                              <div className="mt-1 text-xs text-slate-500">{formatDateOnly(event.scheduledAt)}</div>
                            </div>
                            <div className="text-xs text-slate-400">{event.participantsCount} participants</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">No completed or accepted events with this recruiter yet.</p>
                    )}
                  </section>
                </div>

                <aside className="space-y-5 min-w-0">
                  <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Sent By</div>
                    <div className="mt-4 flex items-center gap-3">
                      {request.fromUser?.avatar ? (
                        <img src={request.fromUser.avatar} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 font-bold text-white">
                          {(request.fromUser?.displayName ?? 'R').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold text-white">{request.fromUser?.displayName ?? 'Recruiter'}</div>
                        <div className="truncate text-sm text-slate-400">{request.fromUser?.email ?? 'Email unavailable'}</div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
                        <span className="shrink-0 text-slate-500">Company/domain</span>
                        <span className="min-w-0 text-right text-slate-200 break-all">{request.fromUser?.domain ?? 'Not provided'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
                        <span className="shrink-0 text-slate-500">Account review</span>
                        <span className={`shrink-0 text-right font-semibold ${accountApproved ? 'text-emerald-300' : 'text-amber-300'}`}>
                          {accountApproved ? 'Approved' : 'Not confirmed'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
                        <span className="shrink-0 text-slate-500">Recruiter ID</span>
                        <span className="min-w-0 text-right font-mono text-xs text-slate-300 break-all">{request.fromUserId}</span>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 text-sm">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Request Record</div>
                    <div className="mt-4 space-y-3">
                      <div><span className="text-slate-500">Submitted:</span> <span className="text-slate-200">{formatDateTime(request.createdAt)}</span></div>
                      <div><span className="text-slate-500">Expires:</span> <span className="text-slate-200">{formatDateTime(request.expiresAt)}</span></div>
                      <div className="break-all"><span className="text-slate-500">Request ID:</span> <span className="font-mono text-xs text-slate-300">{request._id}</span></div>
                    </div>
                  </section>
                </aside>
              </div>

              <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-[#071322]/95 px-6 py-4 backdrop-blur-md">
                <div className="max-w-2xl text-xs leading-5 text-slate-400">
                  Accepting adds this event to the college hiring calendar, makes it visible to eligible students,
                  notifies the recruiter and eligible students, and records the decision. It does not approve an
                  ongoing recruiter partnership.
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={closeEventRequest} disabled={isUpdating}>Close</Button>
                  {request.status === 'pending' ? (
                    <>
                      <Button
                        variant="secondary"
                        disabled={isUpdating}
                        onClick={() => eventRequestMutation.mutate({ requestId: request._id, action: 'decline' })}
                      >
                        {isUpdating && eventRequestMutation.variables?.action === 'decline' ? 'Declining...' : 'Decline'}
                      </Button>
                      <Button
                        disabled={isUpdating}
                        onClick={() => eventRequestMutation.mutate({ requestId: request._id, action: 'accept' })}
                      >
                        {isUpdating && eventRequestMutation.variables?.action === 'accept' ? 'Accepting...' : 'Accept Event'}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-800 bg-[#071322] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 p-5">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">Create New Event</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={onSubmit} noValidate className="p-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Event Title
                </label>
                <Input
                  placeholder="e.g. Annual Campus Innovation Hackathon 2026"
                  aria-invalid={Boolean(errors.title)}
                  className="bg-[#050d18] text-white"
                  {...register('title')}
                />
                {errors.title && (
                  <p className="mt-1 text-xs text-rose-400">{errors.title.message}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Event Type
                  </label>
                  <select
                    className="w-full rounded-xl border border-slate-800 bg-[#050d18] px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                    {...register('type')}
                  >
                    {eventTypes.map((t) => (
                      <option key={t} value={t} className="bg-slate-900">
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Scheduled Date & Time
                  </label>
                  <Input
                    type="datetime-local"
                    className="bg-[#050d18] text-white"
                    {...register('date')}
                  />
                  {errors.date && (
                    <p className="mt-1 text-xs text-rose-400">
                      {errors.date.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Description & Submission Requirements
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe the event scope, criteria, and what students are expected to submit..."
                  className="w-full rounded-xl border border-slate-800 bg-[#050d18] p-3 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  {...register('description')}
                />
                {errors.description && (
                  <p className="mt-1 text-xs text-rose-400">
                    {errors.description.message}
                  </p>
                )}
              </div>

              {createError && (
                <div className="rounded-xl border border-rose-800/60 bg-rose-950/60 p-3 text-xs text-rose-200">
                  {createError}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-full border border-cyan-500/40 bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-[0_0_12px_rgba(6,182,212,0.3)] hover:from-cyan-500 hover:to-blue-500"
                >
                  {createMutation.isPending ? 'Publishing...' : 'Publish Event'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {scoreModalEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-[#071322] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 p-5">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    Submit Student Score
                  </h3>
                  <p className="text-xs text-slate-400 truncate max-w-xs">
                    {scoreModalEvent.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScoreModalEvent(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Select Participant
                </label>
                <select
                  value={scoreStudentId}
                  onChange={(e) => {
                    const sid = e.target.value;
                    setScoreStudentId(sid);
                    const found = scoreModalEvent.participants.find(
                      (p) => p.studentId === sid,
                    );
                    setScoreValue(
                      found && typeof found.submissionScore === 'number'
                        ? String(found.submissionScore)
                        : '',
                    );
                  }}
                  className="w-full rounded-xl border border-slate-800 bg-[#050d18] px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                >
                  {scoreModalEvent.participants.map((p) => (
                    <option
                      key={p.studentId}
                      value={p.studentId}
                      className="bg-slate-900"
                    >
                      {p.studentName} (Innov: {p.innovationScore})
                      {typeof p.submissionScore === 'number'
                        ? ` - Score: ${p.submissionScore}`
                        : ' - Unscored'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Submission Score (0 - 100)
                  </label>
                  <span className="text-sm font-extrabold text-cyan-300">
                    {scoreValue !== '' ? `${scoreValue} pts` : 'Not set'}
                  </span>
                </div>

                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={scoreValue}
                  onChange={(e) => setScoreValue(e.target.value)}
                  placeholder="Enter score (0-100)"
                  className="bg-[#050d18] text-white"
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  {[25, 50, 75, 90, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setScoreValue(String(preset))}
                      className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300 hover:border-cyan-500 hover:text-white"
                    >
                      {preset} pts
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setScoreModalEvent(null)}
                  className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={
                    submissionMutation.isPending ||
                    !scoreStudentId ||
                    scoreValue.trim() === '' ||
                    Number(scoreValue) < 0 ||
                    Number(scoreValue) > 100
                  }
                  onClick={() =>
                    submissionMutation.mutate({
                      eventId: scoreModalEvent._id,
                      studentId: scoreStudentId,
                      score: Number(scoreValue),
                    })
                  }
                  className="rounded-full border border-cyan-500/40 bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-[0_0_12px_rgba(6,182,212,0.3)] hover:from-cyan-500 hover:to-blue-500"
                >
                  {submissionMutation.isPending
                    ? 'Saving Score...'
                    : 'Save Submission Score'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
