import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CalendarDays, BriefcaseBusiness, Sparkles, Trophy, Users } from 'lucide-react';
import { eventApi } from '../../api/event.api';
import { recruiterApi } from '../../api/recruiter.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

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

export default function HiringEvents() {
  const queryClient = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [scoreDraft, setScoreDraft] = useState({ studentId: '', score: '' });
  const [selectionDraft, setSelectionDraft] = useState({ studentId: '', jobId: '', note: '' });
  const [form, setForm] = useState<HiringEventFormState>(createInitialForm);

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

  const selectedEvent = useMemo(
    () => hiringEventsQuery.data?.find((event) => event._id === selectedEventId) ?? null,
    [hiringEventsQuery.data, selectedEventId],
  );

  const refreshData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'hiring-events'] }),
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'linked-colleges'] }),
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'jobs'] }),
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'job-applications'] }),
      queryClient.invalidateQueries({ queryKey: ['student', 'applications'] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: recruiterApi.createHiringEvent,
    onSuccess: async (createdEvent) => {
      setForm(createInitialForm());
      setSelectedEventId(createdEvent._id);
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
    mutationFn: ({ eventId, studentId, jobId, note }: { eventId: string; studentId: string; jobId: string; note?: string }) =>
      recruiterApi.selectStudentFromEvent(eventId, studentId, { jobId, note }),
    onSuccess: async () => {
      setSelectionDraft({ studentId: '', jobId: '', note: '' });
      await refreshData();
    },
  });

  const activeJobs = useMemo(
    () => (jobsQuery.data ?? []).filter((job) => job.isActive),
    [jobsQuery.data],
  );

  const selectedParticipant =
    selectedEvent?.participants.find((participant) => participant.studentId === selectionDraft.studentId) ?? null;

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-800 pb-4">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
          <Sparkles className="h-4 w-4" />
          Hiring Events
        </div>
        <h1 className="text-2xl font-semibold text-white">Recruiter hiring events</h1>
        <p className="mt-1 text-sm text-slate-400">
          Create college-specific hiring events, review registrations, score submissions, and move students into your pipeline.
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,420px),minmax(0,1fr)]">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Create Event</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Launch a hiring event</h2>
            </div>
            <Badge className="border-slate-700 bg-slate-950 text-slate-300">
              {availableColleges.length} colleges
            </Badge>
          </div>

          {availableColleges.length === 0 ? (
            <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              No linked colleges yet. Ask a college to accept your partnership request before creating hiring events.
            </div>
          ) : null}

          <div className="grid gap-4">
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
              disabled={
                createMutation.isPending ||
                availableColleges.length === 0 ||
                !form.title ||
                !form.collegeId ||
                !form.date ||
                !form.description
              }
            >
              {createMutation.isPending ? 'Creating...' : 'Create Hiring Event'}
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-cyan-300" />
                <div>
                  <div className="text-2xl font-semibold text-white">{hiringEventsQuery.data?.length ?? 0}</div>
                  <div className="text-sm text-slate-400">Events</div>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-emerald-300" />
                <div>
                  <div className="text-2xl font-semibold text-white">
                    {(hiringEventsQuery.data ?? []).reduce((sum, event) => sum + event.participantsCount, 0)}
                  </div>
                  <div className="text-sm text-slate-400">Registrations</div>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <Trophy className="h-5 w-5 text-amber-300" />
                <div>
                  <div className="text-2xl font-semibold text-white">
                    {(hiringEventsQuery.data ?? []).filter((event) => event.rankingsComputedAt).length}
                  </div>
                  <div className="text-sm text-slate-400">Ranked events</div>
                </div>
              </div>
            </Card>
          </div>

          {hiringEventsQuery.isLoading ? <Card className="p-6 text-sm text-slate-400">Loading hiring events...</Card> : null}

          <div className="grid gap-4 md:grid-cols-2">
            {(hiringEventsQuery.data ?? []).map((event) => (
              <Card key={event._id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-white">{event.title}</div>
                    <div className="mt-1 text-sm text-slate-400">{event.collegeName}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">Hiring Event</Badge>
                      <Badge className="border-slate-700 bg-slate-950 text-slate-300">{event.type}</Badge>
                      <Badge className="border-slate-700 bg-slate-950 text-slate-300">
                        {event.minimumInnovationScore}+ score
                      </Badge>
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => setSelectedEventId(event._id)}>
                    View
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
                  <span>{new Date(event.scheduledAt).toLocaleString('en-IN')}</span>
                  <span>{event.participantsCount} participants</span>
                </div>
              </Card>
            ))}
          </div>
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
                {computeMutation.isPending && computeMutation.variables === selectedEvent._id ? 'Computing...' : 'Compute Rankings'}
              </Button>
              <Button variant="secondary" onClick={() => setSelectedEventId(null)}>
                Close
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Card className="p-4">
              <div className="text-2xl font-semibold text-white">{selectedEvent.participantsCount}</div>
              <div className="mt-1 text-sm text-slate-400">Registered students</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-semibold text-white">{selectedEvent.minimumInnovationScore}</div>
              <div className="mt-1 text-sm text-slate-400">Minimum score</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-semibold text-white">{selectedEvent.rankings.length}</div>
              <div className="mt-1 text-sm text-slate-400">Ranked students</div>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.3fr),360px]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
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

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
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
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
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

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                  <BriefcaseBusiness className="h-4 w-4" />
                  Pipeline Selection
                </div>
                {selectedParticipant ? (
                  <div className="mb-3 rounded-xl border border-slate-800 px-4 py-3 text-sm text-slate-300">
                    Selecting <span className="font-semibold text-white">{selectedParticipant.studentName}</span> for a recruiter job.
                  </div>
                ) : null}
                <div className="grid gap-3">
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
