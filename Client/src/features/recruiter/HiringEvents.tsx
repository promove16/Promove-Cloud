import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness, Building2, CalendarDays, Link2, Trophy, Users } from 'lucide-react';
import { eventApi } from '../../api/event.api';
import { recruiterApi } from '../../api/recruiter.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import {
  RECRUITER_PAGE_CONTENT_CLASS,
  RecruiterSectionHeader,
  recruiterDriveSectionItems,
} from './RecruiterSectionNav';

const eventTypes = [
  'Industry Connect Session',
  'Placement Hackathon',
  'Innovation Drive',
  'Other',
] as const;

type HiringEventFormState = {
  title: string;
  collegeId: string;
  type: (typeof eventTypes)[number];
  date: string;
  description: string;
  linkedJobId: string;
  minimumInnovationScore: string;
};

const createInitialForm = (): HiringEventFormState => ({
  title: '',
  collegeId: '',
  type: eventTypes[0],
  date: '',
  description: '',
  linkedJobId: '',
  minimumInnovationScore: '0',
});

const formatEventDate = (value: string) =>
  new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

type HiringEventsProps = {
  embedded?: boolean;
};

type CreateMode = 'direct' | 'invite';

export default function HiringEvents({ embedded = false }: HiringEventsProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [scoreDraft, setScoreDraft] = useState({ studentId: '', score: '' });
  const [selectionDraft, setSelectionDraft] = useState({ studentId: '', jobId: '', note: '' });
  const [form, setForm] = useState<HiringEventFormState>(createInitialForm);
  const [createMode, setCreateMode] = useState<CreateMode>('direct');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteSentNotice, setInviteSentNotice] = useState('');

  const hiringEventsQuery = useQuery({
    queryKey: ['recruiter', 'hiring-events'],
    queryFn: recruiterApi.getHiringEvents,
  });
  const collegesQuery = useQuery({
    queryKey: ['recruiter', 'linked-colleges'],
    queryFn: recruiterApi.getLinkedColleges,
  });
  const jobsQuery = useQuery({
    queryKey: ['recruiter', 'jobs'],
    queryFn: recruiterApi.getJobs,
  });

  const availableColleges = collegesQuery.data ?? [];
  const events = hiringEventsQuery.data ?? [];
  const requestedEventId = searchParams.get('eventId');

  useEffect(() => {
    if (events.length === 0) {
      setSelectedEventId(null);
      return;
    }

    if (requestedEventId && events.some((event) => event._id === requestedEventId)) {
      setSelectedEventId(requestedEventId);
      return;
    }

    if (!selectedEventId || !events.some((event) => event._id === selectedEventId)) {
      setSelectedEventId(events[0]._id);
    }
  }, [events, requestedEventId, selectedEventId]);

  const selectedEvent = useMemo(
    () => events.find((event) => event._id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const activeJobs = useMemo(
    () => (jobsQuery.data ?? []).filter((job) => job.isActive),
    [jobsQuery.data],
  );

  const eventMetrics = useMemo(
    () => ({
      events: events.length,
      registrations: events.reduce((sum, event) => sum + event.participantsCount, 0),
      ranked: events.filter((event) => event.rankingsComputedAt).length,
    }),
    [events],
  );

  const refreshData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'hiring-events'] }),
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'linked-colleges'] }),
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'jobs'] }),
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'job-applications'] }),
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'onboarding'] }),
      queryClient.invalidateQueries({ queryKey: ['student', 'applications'] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: recruiterApi.createHiringEvent,
    onSuccess: async (createdEvent) => {
      setForm(createInitialForm());
      setSelectedEventId(createdEvent._id);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('eventId', createdEvent._id);
        return next;
      });
      await refreshData();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: ({ collegeId, payload }: {
      collegeId: string;
      payload: Parameters<typeof recruiterApi.sendHiringEventInvite>[1];
    }) => recruiterApi.sendHiringEventInvite(collegeId, payload),
    onSuccess: (result) => {
      setInviteSentNotice(
        result.alreadyPending
          ? 'An invite for this event title is already pending with this college.'
          : 'Invite sent! The college will see it in their invitations center.',
      );
      setForm(createInitialForm());
      setInviteMessage('');
    },
  });

  const scoreMutation = useMutation({
    mutationFn: ({ eventId, studentId, score }: { eventId: string; studentId: string; score: number }) =>
      eventApi.addSubmissionScore(eventId, studentId, score),
    onSuccess: async () => {
      setScoreDraft({ studentId: '', score: '' });
      await refreshData();
    },
  });

  const computeMutation = useMutation({
    mutationFn: eventApi.computeRankings,
    onSuccess: refreshData,
  });

  const pipelineMutation = useMutation({
    mutationFn: ({
      eventId,
      studentId,
      jobId,
      note,
    }: {
      eventId: string;
      studentId: string;
      jobId: string;
      note?: string;
    }) => recruiterApi.selectStudentFromEvent(eventId, studentId, { jobId, note }),
    onSuccess: async (_, variables) => {
      setSelectionDraft({ studentId: '', jobId: '', note: '' });
      await refreshData();
      navigate(`/dashboard/recruiter/applications/${variables.studentId}?jobId=${variables.jobId}`);
    },
  });

  const selectedParticipant =
    selectedEvent?.participants.find((participant) => participant.studentId === selectionDraft.studentId) ?? null;

  const canCreateEvent =
    Boolean(form.title.trim()) &&
    Boolean(form.collegeId) &&
    Boolean(form.date) &&
    Boolean(form.description.trim()) &&
    availableColleges.length > 0;

  return (
    <div className={`${RECRUITER_PAGE_CONTENT_CLASS} space-y-6`}>
      {!embedded ? (
        <RecruiterSectionHeader
          eyebrow="Drive Workspace"
          title="Run recruiter hiring events"
          description="Create college-linked hiring events, review participants, and push selected students into your hiring pipeline."
          navItems={recruiterDriveSectionItems}
        />
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[420px,minmax(0,1fr)]">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                {createMode === 'invite' ? 'Request Event Approval' : 'Create Event'}
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Launch a hiring event</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Events work best once a college partnership is active and at least one job is open.
              </p>
            </div>
            <Badge className="border-slate-700 bg-slate-950 text-slate-300">
              {availableColleges.length} colleges
            </Badge>
          </div>

          <div className="mt-4 inline-flex rounded-full border border-slate-800 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => { setCreateMode('direct'); setInviteSentNotice(''); }}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${createMode === 'direct' ? 'bg-slate-100 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              Create Directly
            </button>
            <button
              type="button"
              onClick={() => { setCreateMode('invite'); setInviteSentNotice(''); }}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${createMode === 'invite' ? 'bg-slate-100 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              Send Invite for Approval
            </button>
          </div>

          {createMode === 'invite' ? (
            <div className="mt-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-200">
              The college will receive this as an invitation in their invitations center. The event is only created after they accept.
            </div>
          ) : null}

          {availableColleges.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              No linked colleges yet. Ask a college to accept your partnership request before creating hiring events.
            </div>
          ) : null}

          {inviteSentNotice ? (
            <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {inviteSentNotice}
            </div>
          ) : null}

          <div className="mt-5 grid gap-4">
            <Input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Hiring event title"
            />
            <select
              value={form.collegeId}
              onChange={(event) => setForm((current) => ({ ...current, collegeId: event.target.value }))}
              className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            >
              <option value="">Select college</option>
              {availableColleges.map((college) => (
                <option key={college._id} value={college._id}>
                  {college.displayName}
                </option>
              ))}
            </select>
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
            <select
              value={form.linkedJobId}
              onChange={(event) => setForm((current) => ({ ...current, linkedJobId: event.target.value }))}
              className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            >
              <option value="">Link to a job later</option>
              {activeJobs.map((job) => (
                <option key={job._id} value={job._id}>
                  {job.title} | {job.company}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min={0}
              value={form.minimumInnovationScore}
              onChange={(event) =>
                setForm((current) => ({ ...current, minimumInnovationScore: event.target.value }))
              }
              placeholder="Minimum innovation score"
            />
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Describe the hiring event"
              className="min-h-32 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            />
            {createMode === 'invite' ? (
              <textarea
                value={inviteMessage}
                onChange={(event) => setInviteMessage(event.target.value)}
                placeholder="Optional message to the college (e.g. why this event benefits their students)"
                className="min-h-20 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              />
            ) : null}
            {createMode === 'direct' ? (
              <Button
                onClick={() =>
                  createMutation.mutate({
                    title: form.title,
                    collegeId: form.collegeId,
                    type: form.type,
                    date: new Date(form.date).toISOString(),
                    description: form.description,
                    minimumInnovationScore: Number(form.minimumInnovationScore || '0'),
                    ...(form.linkedJobId ? { linkedJobId: form.linkedJobId } : {}),
                  })
                }
                disabled={createMutation.isPending || !canCreateEvent}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Hiring Event'}
              </Button>
            ) : (
              <Button
                onClick={() =>
                  inviteMutation.mutate({
                    collegeId: form.collegeId,
                    payload: {
                      title: form.title,
                      type: form.type,
                      date: new Date(form.date).toISOString(),
                      description: form.description,
                      minimumInnovationScore: Number(form.minimumInnovationScore || '0'),
                      ...(form.linkedJobId ? { linkedJobId: form.linkedJobId } : {}),
                      ...(inviteMessage.trim() ? { message: inviteMessage.trim() } : {}),
                    },
                  })
                }
                disabled={inviteMutation.isPending || !canCreateEvent}
              >
                {inviteMutation.isPending ? 'Sending...' : 'Send Event Invite to College'}
              </Button>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-cyan-300" />
                <div>
                  <div className="text-2xl font-semibold text-white">{eventMetrics.events}</div>
                  <div className="text-sm text-slate-400">Events</div>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-emerald-300" />
                <div>
                  <div className="text-2xl font-semibold text-white">{eventMetrics.registrations}</div>
                  <div className="text-sm text-slate-400">Registrations</div>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <Trophy className="h-5 w-5 text-amber-300" />
                <div>
                  <div className="text-2xl font-semibold text-white">{eventMetrics.ranked}</div>
                  <div className="text-sm text-slate-400">Ranked events</div>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Event Workspace</div>
                <h2 className="mt-2 text-xl font-semibold text-white">Current hiring events</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Select an event to review participants, compute rankings, and push students into the recruiter pipeline.
                </p>
              </div>
              <Badge className="border-slate-700 bg-slate-950 text-slate-300">{events.length} total</Badge>
            </div>

            {hiringEventsQuery.isLoading ? (
              <div className="mt-5 text-sm text-slate-400">Loading hiring events...</div>
            ) : events.length ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {events.map((event) => {
                  const isSelected = event._id === selectedEventId;

                  return (
                    <Card
                      key={event._id}
                      className={`p-5 transition ${
                        isSelected ? 'border-cyan-400/40 bg-cyan-400/5' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold text-white">{event.title}</div>
                          <div className="mt-1 text-sm text-slate-400">{event.collegeName}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                              Hiring Event
                            </Badge>
                            <Badge className="border-slate-700 bg-slate-950 text-slate-300">
                              {event.type}
                            </Badge>
                            <Badge className="border-slate-700 bg-slate-950 text-slate-300">
                              {event.minimumInnovationScore}+ score
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSelectedEventId(event._id);
                            setSearchParams((current) => {
                              const next = new URLSearchParams(current);
                              next.set('eventId', event._id);
                              return next;
                            });
                          }}
                        >
                          {isSelected ? 'Viewing' : 'View'}
                        </Button>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
                        <span>{formatEventDate(event.scheduledAt)}</span>
                        <span>{event.participantsCount} participants</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-800 px-5 py-10">
                <div className="text-lg font-semibold text-white">No hiring events yet</div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Create your first event from the form on the left. Once colleges are linked, this workspace will show
                  event cards, participant counts, and ranking status here instead of an empty panel.
                </p>
              </div>
            )}
          </Card>
        </div>
      </section>

      {selectedEvent ? (
        <Card className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
                <Building2 className="h-4 w-4" />
                {selectedEvent.collegeName}
              </div>
              <h2 className="text-2xl font-semibold text-white">{selectedEvent.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{selectedEvent.description}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => computeMutation.mutate(selectedEvent._id)}>
                {computeMutation.isPending && computeMutation.variables === selectedEvent._id
                  ? 'Computing...'
                  : 'Compute Rankings'}
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <Card className="p-4">
              <div className="text-lg font-semibold text-white">{formatEventDate(selectedEvent.scheduledAt)}</div>
              <div className="mt-1 text-sm text-slate-400">Scheduled</div>
            </Card>
            <Card className="p-4">
              <div className="text-lg font-semibold text-white">{selectedEvent.participantsCount}</div>
              <div className="mt-1 text-sm text-slate-400">Registered students</div>
            </Card>
            <Card className="p-4">
              <div className="text-lg font-semibold text-white">{selectedEvent.minimumInnovationScore}</div>
              <div className="mt-1 text-sm text-slate-400">Minimum score</div>
            </Card>
            <Card className="p-4">
              <div className="text-lg font-semibold text-white">{selectedEvent.rankings.length}</div>
              <div className="mt-1 text-sm text-slate-400">Ranked students</div>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.3fr),360px]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                  Participants
                </div>
                {selectedEvent.participants.length === 0 ? (
                  <div className="text-sm text-slate-500">No students have registered yet.</div>
                ) : (
                  <div className="space-y-3">
                    {selectedEvent.participants.map((participant) => (
                      <div
                        key={participant.studentId}
                        className="flex flex-col gap-3 rounded-2xl border border-slate-800 px-4 py-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <div className="font-semibold text-white">{participant.studentName}</div>
                          <div className="mt-1 text-sm text-slate-400">
                            Innovation score {participant.innovationScore} | Joined{' '}
                            {new Date(participant.registeredAt).toLocaleDateString('en-IN')}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {typeof participant.submissionScore === 'number' ? (
                            <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                              Submission {participant.submissionScore}
                            </Badge>
                          ) : null}
                          <Button
                            variant="secondary"
                            onClick={() =>
                              setSelectionDraft({
                                studentId: participant.studentId,
                                jobId: selectedEvent.linkedJobId ?? activeJobs[0]?._id ?? '',
                                note: '',
                              })
                            }
                          >
                            Add to Pipeline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                  Rankings
                </div>
                {selectedEvent.rankings.length === 0 ? (
                  <div className="text-sm text-slate-500">Compute rankings after submission scores are saved.</div>
                ) : (
                  <div className="space-y-2">
                    {selectedEvent.rankings.map((ranking) => (
                      <div
                        key={`${selectedEvent._id}-${ranking.studentId}`}
                        className="grid grid-cols-1 gap-2 rounded-xl border border-slate-800 px-4 py-3 text-sm md:grid-cols-[70px,1fr,150px,150px]"
                      >
                        <div className="font-semibold text-white">#{ranking.rank}</div>
                        <div className="font-medium text-white">{ranking.studentName}</div>
                        <div className="text-slate-300">Composite {ranking.compositeScore}</div>
                        <div className="text-slate-400">Submission {ranking.submissionScore}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                  Submission Score
                </div>
                <div className="grid gap-3">
                  <select
                    value={scoreDraft.studentId}
                    onChange={(event) => setScoreDraft((current) => ({ ...current, studentId: event.target.value }))}
                    className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                  >
                    <option value="">Select participant</option>
                    {selectedEvent.participants.map((participant) => (
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
                    onChange={(event) => setScoreDraft((current) => ({ ...current, score: event.target.value }))}
                    placeholder="Submission score"
                  />
                  <Button
                    onClick={() =>
                      scoreMutation.mutate({
                        eventId: selectedEvent._id,
                        studentId: scoreDraft.studentId,
                        score: Number(scoreDraft.score),
                      })
                    }
                    disabled={
                      scoreMutation.isPending ||
                      !scoreDraft.studentId ||
                      scoreDraft.score.trim() === '' ||
                      Number(scoreDraft.score) < 0 ||
                      Number(scoreDraft.score) > 100
                    }
                  >
                    {scoreMutation.isPending ? 'Saving...' : 'Save Score'}
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                  <BriefcaseBusiness className="h-4 w-4" />
                  Pipeline Selection
                </div>
                {selectedParticipant ? (
                  <div className="mb-3 rounded-xl border border-slate-800 px-4 py-3 text-sm text-slate-300">
                    Selecting <span className="font-semibold text-white">{selectedParticipant.studentName}</span> for a recruiter job.
                  </div>
                ) : null}
                {!activeJobs.length ? (
                  <div className="rounded-xl border border-dashed border-slate-800 px-4 py-4 text-sm text-slate-500">
                    No active jobs available. Open a recruiter job before pushing event participants into the pipeline.
                  </div>
                ) : null}
                <div className="mt-3 grid gap-3">
                  <select
                    value={selectionDraft.jobId}
                    onChange={(event) => setSelectionDraft((current) => ({ ...current, jobId: event.target.value }))}
                    className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                  >
                    <option value="">Select recruiter job</option>
                    {activeJobs.map((job) => (
                      <option key={job._id} value={job._id}>
                        {job.title} | {job.company}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={selectionDraft.note}
                    onChange={(event) => setSelectionDraft((current) => ({ ...current, note: event.target.value }))}
                    placeholder="Optional note for the student"
                  />
                  <Button
                    onClick={() =>
                      pipelineMutation.mutate({
                        eventId: selectedEvent._id,
                        studentId: selectionDraft.studentId,
                        jobId: selectionDraft.jobId,
                        ...(selectionDraft.note.trim() ? { note: selectionDraft.note.trim() } : {}),
                      })
                    }
                    disabled={pipelineMutation.isPending || !selectionDraft.studentId || !selectionDraft.jobId}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    {pipelineMutation.isPending ? 'Adding...' : 'Add Student to Pipeline'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
