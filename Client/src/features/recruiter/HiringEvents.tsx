import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness, Building2, CalendarDays, Link2, SendHorizontal, Trophy, Users } from 'lucide-react';
import { eventApi } from '../../api/event.api';
import { recruiterApi } from '../../api/recruiter.api';
import { requestApi } from '../../api/request.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import {
  RECRUITER_PAGE_CONTENT_CLASS,
  RecruiterSectionHeader,
  recruiterCampusSectionItems,
} from './RecruiterSectionNav';

const eventTypes = [
  'Placement Drive',
  'Internship Drive',
  'Hackathon',
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

  const minDateTime = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }, []);

  const hiringEventsQuery = useQuery({
    queryKey: ['recruiter', 'hiring-events'],
    queryFn: recruiterApi.getHiringEvents,
  });
  const collegesQuery = useQuery({
    queryKey: ['recruiter', 'linked-colleges'],
    queryFn: recruiterApi.getLinkedColleges,
  });
  const allCollegesQuery = useQuery({
    queryKey: ['recruiter', 'all-colleges'],
    queryFn: recruiterApi.getColleges,
  });
  const jobsQuery = useQuery({
    queryKey: ['recruiter', 'jobs'],
    queryFn: recruiterApi.getJobs,
  });
  const outgoingRequestsQuery = useQuery({
    queryKey: ['requests', 'outgoing'],
    queryFn: requestApi.outgoing,
  });

  const linkedColleges = collegesQuery.data ?? [];
  const allColleges = allCollegesQuery.data ?? [];
  const availableColleges = createMode === 'invite' ? allColleges : linkedColleges;
  const events = hiringEventsQuery.data ?? [];
  const outgoingRequests = outgoingRequestsQuery.data ?? [];
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
  const selectedEventRankingsFinalized = Boolean(selectedEvent?.rankingsComputedAt);

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
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'all-colleges'] }),
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'jobs'] }),
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'job-applications'] }),
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'onboarding'] }),
      queryClient.invalidateQueries({ queryKey: ['student', 'applications'] }),
      queryClient.invalidateQueries({ queryKey: ['requests'] }),
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
    onSuccess: async (result) => {
      setInviteSentNotice(
        result.alreadyPending
          ? 'An invite for this event title is already pending with this college.'
          : 'Invite sent! The college will see it in their invitations center.',
      );
      setForm(createInitialForm());
      setInviteMessage('');
      await refreshData();
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (requestId: string) => requestApi.withdraw(requestId),
    onSuccess: async () => {
      await refreshData();
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
          eyebrow="Campus Hiring"
          title="Run college hiring events"
          description="Create college-linked hiring events with scoring and rankings, then push selected students into your campus onboarding pipeline."
          navItems={recruiterCampusSectionItems}
        />
      ) : null}

      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,420px),minmax(0,1fr)]">
        <Card className="min-w-0 p-6">
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

          <div className="mt-4 flex w-full rounded-full border border-slate-800 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => { setCreateMode('direct'); setInviteSentNotice(''); setForm((current) => ({ ...current, collegeId: '' })); }}
              className={`min-w-0 flex-1 rounded-full px-4 py-1.5 text-center text-xs font-semibold leading-5 transition ${createMode === 'direct' ? 'bg-slate-100 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              Create Directly
            </button>
            <button
              type="button"
              onClick={() => { setCreateMode('invite'); setInviteSentNotice(''); setForm((current) => ({ ...current, collegeId: '' })); }}
              className={`min-w-0 flex-1 rounded-full px-4 py-1.5 text-center text-xs font-semibold leading-5 transition ${createMode === 'invite' ? 'bg-slate-100 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              Send Invite for Approval
            </button>
          </div>

          {createMode === 'invite' ? (
            <div className="mt-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-200">
              Pick any college, even one you haven't partnered with yet. The college will receive this as an invitation in their invitations center, and accepting it both creates the event and establishes your partnership so you can send campus drives to them afterward.
            </div>
          ) : null}

          {availableColleges.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {createMode === 'invite'
                ? 'No colleges found yet.'
                : "No linked colleges yet. Send an event invite from the 'Send Invite for Approval' tab — accepting it establishes the partnership needed to create events directly."}
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
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
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
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
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
              min={minDateTime}
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
            />
            <div className="grid gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Linked Job</span>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cyan-300">
                  Recommended
                </span>
              </div>
              <select
                value={form.linkedJobId}
                onChange={(event) => setForm((current) => ({ ...current, linkedJobId: event.target.value }))}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              >
                <option value="">Link to a job later</option>
                {activeJobs.map((job) => (
                  <option key={job._id} value={job._id}>
                    {job.title} | {job.company}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Minimum Innovation Score</span>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cyan-300">
                  Recommended
                </span>
              </div>
              <Input
                type="number"
                min={0}
                value={form.minimumInnovationScore}
                onChange={(event) =>
                  setForm((current) => ({ ...current, minimumInnovationScore: event.target.value }))
                }
                placeholder="Minimum innovation score"
              />
            </div>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Describe the hiring event"
              className="min-h-32 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            />
            {createMode === 'invite' ? (
              <textarea
                value={inviteMessage}
                onChange={(event) => setInviteMessage(event.target.value)}
                placeholder="Optional message to the college (e.g. why this event benefits their students)"
                className="min-h-20 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
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

        <div className="min-w-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
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
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <SendHorizontal className="h-5 w-5 text-sky-300" />
                <div>
                  <div className="text-2xl font-semibold text-white">{outgoingRequests.length}</div>
                  <div className="text-sm text-slate-400">Sent requests</div>
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
                  Select an event to review participants, compute rankings, and push students into the recruiter pipeline.{' '}
                  {selectedEvent ? (
                    <span className="text-cyan-400 font-medium block mt-1">
                      Currently viewing <strong className="text-cyan-300 underline underline-offset-4 decoration-cyan-500/40">{selectedEvent.title}</strong> below. Click 'Viewing' or scroll down to manage.
                    </span>
                  ) : null}
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
                          variant={isSelected ? 'outline' : 'secondary'}
                          className={isSelected ? 'border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10' : ''}
                          onClick={() => {
                            if (isSelected) {
                              const element = document.getElementById('selected-event-details');
                              element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            } else {
                              setSelectedEventId(event._id);
                              setSearchParams((current) => {
                                const next = new URLSearchParams(current);
                                next.set('eventId', event._id);
                                return next;
                              });
                              setTimeout(() => {
                                const element = document.getElementById('selected-event-details');
                                element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }, 100);
                            }
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

          <Card className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Outbound Requests</div>
                <h2 className="mt-2 text-xl font-semibold text-white">Sent Event Invites & Requests</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Track all invitations and event approval requests sent to colleges.
                </p>
              </div>
              <Badge className="border-slate-700 bg-slate-950 text-slate-300">
                {outgoingRequests.length} total
              </Badge>
            </div>

            {outgoingRequestsQuery.isLoading ? (
              <div className="mt-5 text-sm text-slate-400">Loading sent requests...</div>
            ) : outgoingRequests.length > 0 ? (
              <div className="mt-5 space-y-3">
                {outgoingRequests.map((request) => {
                  const title =
                    (request.metadata?.title as string) ||
                    (request.metadata?.subject as string) ||
                    request.targetEntityTitle ||
                    'Hiring Event Request';
                  const collegeName =
                    (request.metadata?.collegeName as string) ||
                    request.targetEntityTitle ||
                    'Target College';
                  const eventType = (request.metadata?.type as string) || 'Event Invite';
                  const isPending = request.status === 'pending';

                  let statusBadgeClass = 'border-slate-700 bg-slate-800 text-slate-300';
                  if (request.status === 'pending') {
                    statusBadgeClass = 'border-amber-500/30 bg-amber-500/10 text-amber-300';
                  } else if (request.status === 'accepted') {
                    statusBadgeClass = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
                  } else if (request.status === 'declined') {
                    statusBadgeClass = 'border-rose-500/30 bg-rose-500/10 text-rose-300';
                  }

                  return (
                    <div
                      key={request._id}
                      className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-white">{title}</span>
                          <Badge className={statusBadgeClass}>
                            {request.status.toUpperCase()}
                          </Badge>
                          <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                            {eventType}
                          </Badge>
                        </div>
                        <div className="text-sm text-slate-400">
                          College: <strong className="text-slate-200">{collegeName}</strong> • Sent{' '}
                          {new Date(request.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        {request.message ? (
                          <p className="mt-1 text-xs text-slate-400 italic">
                            "{request.message}"
                          </p>
                        ) : null}
                      </div>

                      {isPending ? (
                        <Button
                          variant="outline"
                          className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10 self-start md:self-center"
                          disabled={withdrawMutation.isPending}
                          onClick={() => withdrawMutation.mutate(request._id)}
                        >
                          {withdrawMutation.isPending && withdrawMutation.variables === request._id
                            ? 'Withdrawing...'
                            : 'Withdraw Request'}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-800 px-5 py-8 text-center">
                <div className="text-base font-semibold text-white">No sent requests yet</div>
                <p className="mt-1 text-sm text-slate-400">
                  When you send invitations for college event approval, all sent requests will appear here with live status updates.
                </p>
              </div>
            )}
          </Card>
        </div>
      </section>

      {selectedEvent ? (
        <Card id="selected-event-details" className="p-6 border-cyan-500/30 bg-[#0c1630] scroll-mt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
                <span>Active Event Workspace</span>
                <span>•</span>
                <Building2 className="h-4 w-4" />
                {selectedEvent.collegeName}
              </div>
              <h2 className="text-2xl font-semibold text-white">{selectedEvent.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{selectedEvent.description}</p>
            </div>
            {!selectedEventRankingsFinalized ? (
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => computeMutation.mutate(selectedEvent._id)}>
                  {computeMutation.isPending && computeMutation.variables === selectedEvent._id
                    ? 'Computing...'
                    : 'Compute Rankings'}
                </Button>
              </div>
            ) : null}
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
              {!selectedEventRankingsFinalized ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <div className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                    Submission Score
                  </div>
                  <div className="grid gap-3">
                    <select
                      value={scoreDraft.studentId}
                      onChange={(event) => setScoreDraft((current) => ({ ...current, studentId: event.target.value }))}
                      className="w-full max-w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
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
                      className="w-full justify-center"
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
              ) : null}

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
                    className="w-full max-w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
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
                    className="w-full justify-center"
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
