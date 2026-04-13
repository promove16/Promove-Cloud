import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { collegeApi } from '../../api/college.api';
import { eventApi } from '../../api/event.api';
import { schoolApi } from '../../api/school.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import type { CollegeEvent } from '../../types/college.types';
import { InstitutionWorkspaceHeader } from '../institution/InstitutionWorkspaceHeader';

const eventTypes = [
  'Industry Connect Session',
  'Placement Hackathon',
  'Innovation Drive',
  'Other',
] as const;

type InstitutionEventManagerMode = 'college' | 'school';
type CollegeEventTab = 'internal' | 'hiring';

type EventFormState = {
  title: string;
  type: (typeof eventTypes)[number];
  date: string;
  description: string;
};

type CreateEventPayload = {
  title: string;
  type: (typeof eventTypes)[number];
  date: string;
  description: string;
  targetRoles?: Array<'student' | 'all'>;
};

type ManagedInstitutionEvent = Awaited<ReturnType<typeof collegeApi.listEvents>>[number];

const EVENT_MANAGER_CONFIG: Record<
  InstitutionEventManagerMode,
  {
    headerMode: 'college' | 'school';
    queryKey: string;
    listEvents: () => Promise<ManagedInstitutionEvent[]>;
    createEvent: (payload: CreateEventPayload) => Promise<ManagedInstitutionEvent>;
  }
> = {
  college: {
    headerMode: 'college',
    queryKey: 'college-events',
    listEvents: collegeApi.listEvents,
    createEvent: collegeApi.createEvent,
  },
  school: {
    headerMode: 'school',
    queryKey: 'school-events',
    listEvents: schoolApi.listEvents,
    createEvent: schoolApi.createEvent,
  },
};

const createInitialForm = (): EventFormState => ({
  title: '',
  type: eventTypes[0],
  date: '',
  description: '',
});

const getDescription = (mode: InstitutionEventManagerMode, tab: CollegeEventTab) => {
  if (mode === 'school') {
    return 'Create and track internal school events, submissions, and rankings.';
  }

  return tab === 'internal'
    ? 'Create internal college events, collect submissions, and compute student rankings.'
    : 'Review recruiter-led hiring events hosted for your college students.';
};

const getCategoryBadgeClass = (event: CollegeEvent) =>
  event.category === 'hiring'
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';

export default function EventManager({
  mode = 'college',
}: {
  mode?: InstitutionEventManagerMode;
}) {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const config = EVENT_MANAGER_CONFIG[mode];
  const [activeTab, setActiveTab] = useState<CollegeEventTab>(
    mode === 'college' && searchParams.get('tab') === 'hiring' ? 'hiring' : 'internal',
  );
  const [showCreate, setShowCreate] = useState(false);
  const [scoringEventId, setScoringEventId] = useState<string | null>(null);
  const [scoreDraft, setScoreDraft] = useState<{ studentId: string; score: string }>({
    studentId: '',
    score: '',
  });
  const [form, setForm] = useState<EventFormState>(createInitialForm);
  const focusedEventId = searchParams.get('eventId');

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
      await queryClient.invalidateQueries({ queryKey: [config.queryKey, 'hiring'] });
    }
  };

  const createMutation = useMutation({
    mutationFn: config.createEvent,
    onSuccess: async () => {
      setForm(createInitialForm());
      setShowCreate(false);
      await refreshEventQueries();
    },
  });

  const computeMutation = useMutation({
    mutationFn: eventApi.computeRankings,
    onSuccess: refreshEventQueries,
  });

  const submissionMutation = useMutation({
    mutationFn: ({ eventId, studentId, score }: { eventId: string; studentId: string; score: number }) =>
      eventApi.addSubmissionScore(eventId, studentId, score),
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

    return (eventsQuery.data ?? []).filter((event) => event.category !== 'hiring');
  }, [activeTab, eventsQuery.data, hiringEventsQuery.data, mode]);

  const canCreateInternalEvent = mode === 'school' || activeTab === 'internal';

  useEffect(() => {
    if (mode !== 'college') {
      return;
    }

    setActiveTab(searchParams.get('tab') === 'hiring' ? 'hiring' : 'internal');
  }, [mode, searchParams]);

  return (
    <div className="space-y-6">
      <InstitutionWorkspaceHeader
        mode={config.headerMode}
        eyebrow="Events"
        title="Events"
        description={getDescription(mode, activeTab)}
        tabsAction={
          <div className="flex flex-wrap gap-3">
            {mode === 'college' ? (
              <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('internal');
                    setShowCreate(false);
                  }}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    activeTab === 'internal'
                      ? 'bg-cyan-500/10 text-cyan-300'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Internal Events
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('hiring');
                    setShowCreate(false);
                  }}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    activeTab === 'hiring'
                      ? 'bg-amber-500/10 text-amber-300'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Hiring Events
                </button>
              </div>
            ) : null}

            {canCreateInternalEvent ? (
              <Button onClick={() => setShowCreate((value) => !value)}>
                {showCreate ? 'Close Form' : '+ Create Event'}
              </Button>
            ) : null}
          </div>
        }
      />

      {showCreate && canCreateInternalEvent ? (
        <Card className="p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Event title"
            />
            <select
              value={form.type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  type: event.target.value as (typeof eventTypes)[number],
                }))
              }
              className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            >
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <Input
              type="datetime-local"
              value={form.date}
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
            />
            <div />
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Describe the event"
              className="min-h-32 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white md:col-span-2"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() =>
                createMutation.mutate({
                  ...form,
                  date: new Date(form.date).toISOString(),
                  targetRoles: ['student'],
                })
              }
              disabled={createMutation.isPending || !form.title || !form.date || !form.description}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Event'}
            </Button>
          </div>
        </Card>
      ) : null}

      {(eventsQuery.isLoading || (mode === 'college' && activeTab === 'hiring' && hiringEventsQuery.isLoading)) ? (
        <Card className="p-6 text-sm text-slate-400">Loading events...</Card>
      ) : null}

      {!eventsQuery.isLoading && visibleEvents.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-lg font-semibold text-white">
            {mode === 'college' && activeTab === 'hiring' ? 'No hiring events yet' : 'No events yet'}
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {mode === 'college' && activeTab === 'hiring'
              ? 'Recruiter-hosted hiring events for this college will appear here.'
              : 'Create your first event to start registrations and rankings.'}
          </p>
        </Card>
      ) : null}

      <div className="space-y-4">
        {visibleEvents.map((event) => (
          <Card
            key={event._id}
            className={`p-6 ${focusedEventId === event._id ? 'border-cyan-400/40 bg-cyan-400/5' : ''}`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
                  <CalendarDays className="h-4 w-4" />
                  <span>{event.type}</span>
                  <Badge className={getCategoryBadgeClass(event)}>
                    {event.category === 'hiring' ? 'Hiring Event' : 'Internal Event'}
                  </Badge>
                </div>
                <h2 className="text-2xl font-semibold text-white">{event.title}</h2>
                <p className="mt-3 max-w-3xl text-slate-400">{event.description}</p>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
                  <span>{new Date(event.scheduledAt).toLocaleString('en-IN')}</span>
                  <span>{event.participantsCount} participants</span>
                  {event.recruiterName ? <span>Hosted by {event.recruiterName}</span> : null}
                  {typeof event.minimumInnovationScore === 'number' && event.category === 'hiring' ? (
                    <span>Minimum score {event.minimumInnovationScore}</span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => computeMutation.mutate(event._id)}>
                  Compute Rankings
                </Button>
                <Button
                  variant="secondary"
                  disabled={event.participants.length === 0}
                  onClick={() => {
                    const isClosing = scoringEventId === event._id;
                    setScoringEventId(isClosing ? null : event._id);
                    setScoreDraft({
                      studentId: isClosing ? '' : event.participants[0]?.studentId ?? '',
                      score: '',
                    });
                  }}
                >
                  {event.participants.length === 0
                    ? 'No Participants Yet'
                    : scoringEventId === event._id
                      ? 'Hide Score Form'
                      : 'Add Submission Score'}
                </Button>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                Participants
              </div>
              {event.participants.length === 0 ? (
                <div className="text-sm text-slate-500">No students have joined this event yet.</div>
              ) : (
                <div className="space-y-3">
                  {event.participants.map((participant) => (
                    <div
                      key={`${event._id}-${participant.studentId}`}
                      className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <div className="font-semibold text-white">{participant.studentName}</div>
                        <div className="mt-1 text-sm text-slate-400">
                          Score {participant.innovationScore} | Joined{' '}
                          {new Date(participant.registeredAt).toLocaleDateString('en-IN')}
                        </div>
                      </div>
                      <div className="text-sm text-slate-400">
                        {typeof participant.submissionScore === 'number'
                          ? `Submission score: ${participant.submissionScore}`
                          : 'Submission score pending'}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {scoringEventId === event._id && event.participants.length > 0 ? (
                <>
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <select
                      value={scoreDraft.studentId}
                      onChange={(currentEvent) =>
                        setScoreDraft((current) => ({ ...current, studentId: currentEvent.target.value }))
                      }
                      className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                    >
                      {event.participants.map((participant) => (
                        <option key={participant.studentId} value={participant.studentId}>
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
                        setScoreDraft((current) => ({ ...current, score: currentEvent.target.value }))
                      }
                      placeholder="Submission score"
                    />
                  </div>
                  <div className="mt-3 text-sm text-slate-400">
                    Save the participant score first, then recompute rankings to refresh the leaderboard.
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
                      {submissionMutation.isPending ? 'Saving...' : 'Save Submission Score'}
                    </Button>
                  </div>
                </>
              ) : null}
            </div>

            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                Event Rankings
              </div>
              <div className="mb-4 text-sm text-slate-400">
                Composite = (Submission x 60%) + (Innovation Score x 40%)
              </div>
              <div className="space-y-3">
                {event.rankings.length === 0 ? (
                  <div className="text-sm text-slate-500">Rankings will appear here after computation.</div>
                ) : (
                  event.rankings.map((ranking) => (
                    <div
                      key={`${event._id}-${ranking.studentId}`}
                      className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 text-sm md:grid-cols-[80px,1fr,140px,140px,140px]"
                    >
                      <div className="font-semibold text-white">#{ranking.rank}</div>
                      <div className="font-semibold text-white">{ranking.studentName}</div>
                      <div className="text-slate-300">Composite {ranking.compositeScore}</div>
                      <div className="text-slate-400">Innovation {ranking.innovationScore}</div>
                      <div className="text-slate-400">Submission {ranking.submissionScore}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
