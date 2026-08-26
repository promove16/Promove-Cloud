import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { BriefcaseBusiness, Building2, CalendarClock, CheckCircle2, Circle, Edit, Link2, LockKeyhole, X, XCircle } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import type { RecruiterHiringEventParticipant, RecruiterHiringEventView, RecruiterJobView } from '../../types/recruiter.types';

type ScoreDraft = {
  studentId: string;
  score: string;
};

type SelectionDraft = {
  studentId: string;
  jobId: string;
  note: string;
};

type EventWorkspaceModalProps = {
  event: RecruiterHiringEventView;
  activeJobs: RecruiterJobView[];
  scoreDraft: ScoreDraft;
  setScoreDraft: Dispatch<SetStateAction<ScoreDraft>>;
  selectionDraft: SelectionDraft;
  setSelectionDraft: Dispatch<SetStateAction<SelectionDraft>>;
  isComputingRankings: boolean;
  isSavingScore: boolean;
  isAddingToPipeline: boolean;
  isClosingEvent: boolean;
  isPostponingEvent: boolean;
  isEditingEvent: boolean;
  onClose: () => void;
  onComputeRankings: () => void;
  onSaveScore: () => void;
  onAddToPipeline: () => void;
  onCloseEvent: () => void;
  onPostponeEvent: (payload: { newDate: string; reason: string }) => Promise<void>;
  onUpdateEvent: (payload: {
    title?: string;
    type?: string;
    description?: string;
    linkedJobId?: string | null;
    minimumInnovationScore?: number;
  }) => Promise<void>;
};

type WorkflowStepStatus = 'complete' | 'active' | 'locked';

const formatEventDate = (value: string) =>
  new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const toLocalDateTimeInput = (value: Date) => {
  const offsetMs = value.getTimezoneOffset() * 60 * 1000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
};

const workflowStepClass: Record<WorkflowStepStatus, string> = {
  complete: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200 shadow-sm shadow-emerald-500/10',
  active: 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-400/30',
  locked: 'border-slate-800 bg-slate-950/70 text-slate-500',
};

const WorkflowStepIcon = ({ status }: { status: WorkflowStepStatus }) => {
  if (status === 'complete') {
    return <CheckCircle2 className="h-5 w-5 text-emerald-300 shrink-0" />;
  }

  if (status === 'locked') {
    return <LockKeyhole className="h-5 w-5 text-slate-600 shrink-0" />;
  }

  return <Circle className="h-5 w-5 fill-cyan-400/30 text-cyan-300 shrink-0" />;
};

export function EventWorkspaceModal({
  event,
  activeJobs,
  scoreDraft,
  setScoreDraft,
  selectionDraft,
  setSelectionDraft,
  isComputingRankings,
  isSavingScore,
  isAddingToPipeline,
  isClosingEvent,
  isPostponingEvent,
  isEditingEvent,
  onClose,
  onComputeRankings,
  onSaveScore,
  onAddToPipeline,
  onCloseEvent,
  onPostponeEvent,
  onUpdateEvent,
}: EventWorkspaceModalProps) {
  const [isPostponeOpen, setIsPostponeOpen] = useState(false);
  const [postponeDate, setPostponeDate] = useState('');
  const [postponeReason, setPostponeReason] = useState('');

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: event.title,
    type: event.type,
    description: event.description,
    linkedJobId: event.linkedJobId ?? '',
    minimumInnovationScore: String(event.minimumInnovationScore ?? 0),
  });
  const canSubmitEdit = Boolean(editForm.title.trim()) && Boolean(editForm.description.trim());
  const rankingsFinalized = Boolean(event.rankingsComputedAt);
  const scoredParticipantsCount = event.participants.filter((participant) => typeof participant.submissionScore === 'number').length;
  const remainingScores = event.participants.length - scoredParticipantsCount;
  const allParticipantsScored = event.participants.length > 0 && remainingScores === 0;
  const selectedParticipant = event.participants.find((participant) => participant.studentId === selectionDraft.studentId) ?? null;
  const hiredParticipants = new Map(
    event.participants.filter((participant) => participant.selectedJobId).map((participant) => [participant.studentId, participant]),
  );
  const selectableRankings = event.rankings.filter((ranking) => !hiredParticipants.has(ranking.studentId));
  const showScoringPanel = event.isActive && !rankingsFinalized;
  const showPipelinePanel = rankingsFinalized && Boolean(selectedParticipant) && !selectedParticipant?.selectedJobId;
  const showSidePanel = showScoringPanel || showPipelinePanel;
  const minimumPostponeDate = toLocalDateTimeInput(
    new Date(Math.max(Date.now(), new Date(event.scheduledAt).getTime()) + 60 * 1000),
  );
  const canSubmitPostponement =
    postponeReason.trim().length >= 5 &&
    Boolean(postponeDate) &&
    new Date(postponeDate).getTime() > new Date(event.scheduledAt).getTime();

  const workflowSteps: Array<{
    label: string;
    detail: string;
    status: WorkflowStepStatus;
  }> = [
    {
      label: 'Score participants',
      detail: `${scoredParticipantsCount} of ${event.participants.length} scored`,
      status: rankingsFinalized || allParticipantsScored ? 'complete' : event.isActive ? 'active' : 'locked',
    },
    {
      label: 'Finalize rankings',
      detail: rankingsFinalized ? 'Rankings computed' : allParticipantsScored ? 'Ready to compute' : 'Complete scoring first',
      status: rankingsFinalized ? 'complete' : allParticipantsScored && event.isActive ? 'active' : 'locked',
    },
    {
      label: 'Select candidates',
      detail: !rankingsFinalized
        ? 'Unlocks after rankings'
        : event.rankings.length === 0
          ? 'No ranked students'
          : selectableRankings.length === 0
            ? `All ${event.rankings.length} ranked student${event.rankings.length === 1 ? '' : 's'} selected`
            : `${selectableRankings.length} of ${event.rankings.length} still available`,
      status: !rankingsFinalized
        ? 'locked'
        : event.rankings.length > 0 && selectableRankings.length === 0
          ? 'complete'
          : 'active',
    },
  ];

  const selectParticipantForScoring = (participant: RecruiterHiringEventParticipant) => {
    setScoreDraft({
      studentId: participant.studentId,
      score: typeof participant.submissionScore === 'number' ? String(participant.submissionScore) : '',
    });
  };

  const selectRankedCandidate = (studentId: string) => {
    if (hiredParticipants.has(studentId)) {
      return;
    }

    const validJobId =
      event.linkedJobId && activeJobs.some((j) => j._id === event.linkedJobId)
        ? event.linkedJobId
        : activeJobs[0]?._id ?? '';
    setSelectionDraft({
      studentId,
      jobId: validJobId,
      note: '',
    });
    window.requestAnimationFrame(() => {
      document.getElementById('pipeline-selection-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape') {
        if (isPostponeOpen) {
          setIsPostponeOpen(false);
        } else {
          onClose();
        }
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPostponeOpen, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-workspace-title"
        className="max-h-[94vh] w-full max-w-[1440px] overflow-y-auto rounded-3xl border border-cyan-500/30 bg-[#0c1630] shadow-2xl shadow-black/60"
      >
        <div className="sticky top-0 z-10 flex flex-col gap-4 border-b border-slate-800 bg-[#0c1630]/95 p-5 backdrop-blur-xl lg:flex-row lg:items-start lg:justify-between sm:p-6">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
              </span>
              <span>{event.isActive ? 'Active Event Workspace' : 'Closed Event Workspace'}</span>
              <span aria-hidden="true">&bull;</span>
              <Building2 className="h-4 w-4" />
              <span>{event.collegeName}</span>
            </div>
            <h2 id="event-workspace-title" className="text-2xl font-semibold text-white">
              {event.title}
            </h2>
            <p className="mt-2 max-w-3xl whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-6 text-slate-400">{event.description}</p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-3">
              {event.isActive && !rankingsFinalized ? (
                <Button
                  variant="secondary"
                  onClick={onComputeRankings}
                  disabled={isComputingRankings || !allParticipantsScored}
                  title={
                    event.participants.length === 0
                      ? 'At least one participant must register first.'
                      : !allParticipantsScored
                        ? `Save ${remainingScores} remaining participant score${remainingScores === 1 ? '' : 's'} first.`
                        : 'Finalize rankings and unlock candidate selection.'
                  }
                >
                  {isComputingRankings ? 'Computing...' : 'Compute Rankings'}
                </Button>
              ) : null}
              {event.isActive ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPostponeDate(minimumPostponeDate);
                    setPostponeReason('');
                    setIsPostponeOpen(true);
                  }}
                  disabled={isPostponingEvent || rankingsFinalized}
                  title={rankingsFinalized ? 'An event with finalized rankings cannot be postponed.' : undefined}
                >
                  <CalendarClock className="mr-2 h-4 w-4" />
                  Postpone Event
                </Button>
              ) : null}
              {event.isActive && !rankingsFinalized ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditForm({
                      title: event.title,
                      type: event.type,
                      description: event.description,
                      linkedJobId: event.linkedJobId ?? '',
                      minimumInnovationScore: String(event.minimumInnovationScore ?? 0),
                    });
                    setIsEditOpen(true);
                  }}
                  disabled={isEditingEvent || rankingsFinalized}
                  title={rankingsFinalized ? 'An event with finalized rankings cannot be edited.' : undefined}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Event
                </Button>
              ) : null}
              {event.isActive ? (
                <Button variant="secondary" className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10" onClick={onCloseEvent} disabled={isClosingEvent}>
                  <XCircle className="mr-2 h-4 w-4" />
                  {isClosingEvent ? 'Closing...' : 'Close Event'}
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" className="h-10 w-10 rounded-full p-0" aria-label="Close event workspace" autoFocus onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            {event.isActive && !rankingsFinalized ? (
              <p className={`max-w-sm text-right text-xs ${allParticipantsScored ? 'text-emerald-300' : 'text-slate-500'}`}>
                {event.participants.length === 0
                  ? 'Waiting for at least one registered participant.'
                  : allParticipantsScored
                    ? 'All scores are saved. Computing rankings unlocks candidate selection.'
                    : `${remainingScores} participant score${remainingScores === 1 ? '' : 's'} remaining before rankings can be computed.`}
              </p>
            ) : null}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="p-4">
              <div className="text-lg font-semibold text-white">{formatEventDate(event.scheduledAt)}</div>
              <div className="mt-1 text-sm text-slate-400">Scheduled</div>
            </Card>
            <Card className="p-4">
              <div className="text-lg font-semibold text-white">{event.participantsCount}</div>
              <div className="mt-1 text-sm text-slate-400">Registered students</div>
            </Card>
            <Card className="p-4">
              <div className="text-lg font-semibold text-white">{event.minimumInnovationScore}</div>
              <div className="mt-1 text-sm text-slate-400">Minimum score</div>
            </Card>
            <Card className="p-4">
              <div className="text-lg font-semibold text-white">{event.rankings.length}</div>
              <div className="mt-1 text-sm text-slate-400">Ranked students</div>
            </Card>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {workflowSteps.map((step, index) => (
              <div key={step.label} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${workflowStepClass[step.status]}`}>
                <WorkflowStepIcon status={step.status} />
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em]">Step {index + 1}</div>
                  <div className="mt-0.5 font-semibold">{step.label}</div>
                  <div className="mt-0.5 text-xs opacity-75">{step.detail}</div>
                </div>
              </div>
            ))}
          </div>

          <div className={`mt-6 grid gap-6 ${showSidePanel ? 'xl:grid-cols-[minmax(0,1.3fr),360px]' : ''}`}>
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Participants</div>
                  {!rankingsFinalized && event.participants.length > 0 ? (
                    <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                      {scoredParticipantsCount}/{event.participants.length} scored
                    </Badge>
                  ) : null}
                </div>
                {event.participants.length === 0 ? (
                  <div className="text-sm text-slate-500">No students have registered yet. Scoring begins after the first registration.</div>
                ) : (
                  <div className="space-y-3">
                    {event.participants.map((participant) => {
                      const participantRanking = event.rankings.find((ranking) => ranking.studentId === participant.studentId);
                      const hasScore = typeof participant.submissionScore === 'number';

                      return (
                        <div
                          key={participant.studentId}
                          className="flex flex-col gap-3 rounded-2xl border border-slate-800 px-4 py-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <div className="font-semibold text-white">{participant.studentName}</div>
                            <div className="mt-1 text-sm text-slate-400">
                              Innovation score {participant.innovationScore} | Joined {new Date(participant.registeredAt).toLocaleDateString('en-IN')}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {participant.selectedJobId ? (
                              <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                Selected{participant.selectedJobTitle ? ` — ${participant.selectedJobTitle}` : ''}
                              </Badge>
                            ) : null}
                            {participantRanking ? (
                              <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-200">Rank #{participantRanking.rank}</Badge>
                            ) : null}
                            {hasScore ? (
                              <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Submission {participant.submissionScore}</Badge>
                            ) : (
                              <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">Score pending</Badge>
                            )}
                            {event.isActive && !rankingsFinalized ? (
                              <Button variant="secondary" onClick={() => selectParticipantForScoring(participant)}>
                                {hasScore ? 'Edit Score' : 'Enter Score'}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Rankings</div>
                  {rankingsFinalized && event.rankings.length > 0 ? (
                    <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                      {selectableRankings.length} available to select
                    </Badge>
                  ) : null}
                </div>
                {event.rankings.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-800 px-4 py-5 text-sm text-slate-500">
                    {event.participants.length === 0
                      ? 'Rankings will become available after students register and receive submission scores.'
                      : remainingScores > 0
                        ? `Save the remaining ${remainingScores} participant score${remainingScores === 1 ? '' : 's'} to unlock rankings.`
                        : 'All scores are ready. Use Compute Rankings to finalize the order and unlock candidate selection.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {event.rankings.map((ranking) => {
                      const isSelected = selectionDraft.studentId === ranking.studentId;
                      const hiredParticipant = hiredParticipants.get(ranking.studentId);
                      return (
                        <div
                          key={`${event._id}-${ranking.studentId}`}
                          className={`grid grid-cols-1 items-center gap-2 rounded-xl border px-4 py-3 text-sm md:grid-cols-[70px,1fr,140px,140px,160px] ${
                            hiredParticipant ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-slate-800'
                          }`}
                        >
                          <div className="font-semibold text-white">#{ranking.rank}</div>
                          <div className="font-medium text-white">{ranking.studentName}</div>
                          <div className="text-slate-300">Composite {ranking.compositeScore}</div>
                          <div className="text-slate-400">Submission {ranking.submissionScore}</div>
                          {hiredParticipant ? (
                            <Badge
                              className="justify-center border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              title={`Already selected for ${hiredParticipant.selectedJobTitle ?? 'a role'} in this event`}
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              <span className="truncate">{hiredParticipant.selectedJobTitle ?? 'Already selected'}</span>
                            </Badge>
                          ) : (
                            <Button
                              variant={isSelected ? 'outline' : 'secondary'}
                              size="sm"
                              className={isSelected ? 'border-cyan-500/50 text-cyan-300' : ''}
                              onClick={() => selectRankedCandidate(ranking.studentId)}
                            >
                              {isSelected ? 'Selected' : 'Select Candidate'}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    {rankingsFinalized && selectableRankings.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-800 px-4 py-3 text-xs text-slate-500">
                        Every ranked student is already selected for a role in this event. A student can hold only one role per event.
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            {showScoringPanel ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-cyan-500/20 bg-slate-950 p-4">
                  <div className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Step 1 &mdash; Submission Score</div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Score each participant from 0 to 100. Rankings stay locked until every score is saved.
                  </p>
                  <div className="mt-4 grid gap-3">
                    <select
                      value={scoreDraft.studentId}
                      onChange={(changeEvent) => {
                        const participant = event.participants.find((item) => item.studentId === changeEvent.target.value);
                        setScoreDraft({
                          studentId: changeEvent.target.value,
                          score: typeof participant?.submissionScore === 'number' ? String(participant.submissionScore) : '',
                        });
                      }}
                      className="w-full max-w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                    >
                      <option value="">Select participant</option>
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
                      onChange={(changeEvent) => setScoreDraft((current) => ({ ...current, score: changeEvent.target.value }))}
                      placeholder="Submission score (0-100)"
                    />
                    <Button
                      className="w-full justify-center"
                      onClick={onSaveScore}
                      disabled={
                        isSavingScore ||
                        !scoreDraft.studentId ||
                        scoreDraft.score.trim() === '' ||
                        Number(scoreDraft.score) < 0 ||
                        Number(scoreDraft.score) > 100
                      }
                    >
                      {isSavingScore ? 'Saving...' : 'Save Participant Score'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {showPipelinePanel ? (
              <div id="pipeline-selection-panel" className="space-y-4">
                <div className="rounded-2xl border border-cyan-500/20 bg-slate-950 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                    <BriefcaseBusiness className="h-4 w-4" />
                    Step 3 &mdash; Pipeline Selection
                  </div>
                  <div className="mt-3 rounded-xl border border-slate-800 px-4 py-3 text-sm text-slate-300">
                    Adding <span className="font-semibold text-white">{selectedParticipant?.studentName}</span> creates a hiring-event application and notifies
                    the student.
                    <span className="mt-2 block text-xs text-slate-500">
                      This locks the student to the chosen role for this event — they stay available for your other events.
                    </span>
                  </div>
                  {!activeJobs.length ? (
                    <div className="mt-3 rounded-xl border border-dashed border-slate-800 px-4 py-4 text-sm text-slate-500">
                      No active jobs are available. Create or reopen a recruiter job before selecting this candidate.
                    </div>
                  ) : null}
                  <div className="mt-3 grid gap-3">
                    <select
                      value={selectionDraft.jobId}
                      onChange={(changeEvent) => setSelectionDraft((current) => ({ ...current, jobId: changeEvent.target.value }))}
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
                      onChange={(changeEvent) => setSelectionDraft((current) => ({ ...current, note: changeEvent.target.value }))}
                      placeholder="Optional note for the student"
                    />
                    <Button
                      className="w-full justify-center"
                      onClick={onAddToPipeline}
                      disabled={isAddingToPipeline || !selectionDraft.studentId || !selectionDraft.jobId}
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      {isAddingToPipeline ? 'Adding...' : 'Add Ranked Candidate to Pipeline'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {isPostponeOpen ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.target === mouseEvent.currentTarget && !isPostponingEvent) {
              setIsPostponeOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="postpone-event-title"
            className="w-full max-w-lg rounded-2xl border border-cyan-500/30 bg-[#0c1630] p-6 shadow-2xl shadow-black/60"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">College approval required</div>
                <h3 id="postpone-event-title" className="mt-2 text-xl font-semibold text-white">Postpone {event.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  The current date remains unchanged until {event.collegeName} accepts this request.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 rounded-full p-0"
                aria-label="Close postponement request"
                onClick={() => setIsPostponeOpen(false)}
                disabled={isPostponingEvent}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-sm text-slate-300">
                New date and time
                <Input
                  type="datetime-local"
                  min={minimumPostponeDate}
                  value={postponeDate}
                  onChange={(changeEvent) => setPostponeDate(changeEvent.target.value)}
                  className="mt-2"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Reason
                <textarea
                  value={postponeReason}
                  onChange={(changeEvent) => setPostponeReason(changeEvent.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder="Explain why the event needs to move"
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setIsPostponeOpen(false)} disabled={isPostponingEvent}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await onPostponeEvent({
                      newDate: new Date(postponeDate).toISOString(),
                      reason: postponeReason.trim(),
                    });
                    setIsPostponeOpen(false);
                  } catch {
                    // The parent mutation reports the API error and keeps this form open for correction.
                  }
                }}
                disabled={isPostponingEvent || !canSubmitPostponement}
              >
                <CalendarClock className="mr-2 h-4 w-4" />
                {isPostponingEvent ? 'Sending...' : 'Send for Approval'}
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {isEditOpen ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.target === mouseEvent.currentTarget && !isEditingEvent) {
              setIsEditOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-event-title"
            className="w-full max-w-lg rounded-2xl border border-cyan-500/30 bg-[#0c1630] p-6 shadow-2xl shadow-black/60"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Edit Event Details</div>
                <h3 id="edit-event-title" className="mt-2 text-xl font-semibold text-white">Edit {event.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Changes take effect immediately. Date changes require college approval via Postpone Event.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 rounded-full p-0"
                aria-label="Close edit event"
                onClick={() => setIsEditOpen(false)}
                disabled={isEditingEvent}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-sm text-slate-300">
                Event Title
                <Input
                  value={editForm.title}
                  onChange={(changeEvent) => setEditForm((current) => ({ ...current, title: changeEvent.target.value }))}
                  className="mt-2"
                  maxLength={160}
                />
              </label>
              <label className="block text-sm text-slate-300">
                Event Type
                <select
                  value={editForm.type}
                  onChange={(changeEvent) => setEditForm((current) => ({ ...current, type: changeEvent.target.value }))}
                  className="mt-2 w-full max-w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                >
                  <option value="Placement Drive">Placement Drive</option>
                  <option value="Internship Drive">Internship Drive</option>
                  <option value="Hackathon">Hackathon</option>
                  <option value="Industry Connect Session">Industry Connect Session</option>
                  <option value="Placement Hackathon">Placement Hackathon</option>
                  <option value="Innovation Drive">Innovation Drive</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <label className="block text-sm text-slate-300">
                Description
                <textarea
                  value={editForm.description}
                  onChange={(changeEvent: React.ChangeEvent<HTMLTextAreaElement>) => setEditForm((current) => ({ ...current, description: changeEvent.target.value }))}
                  rows={4}
                  maxLength={2000}
                  placeholder="Describe the hiring event, roles, expectations..."
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Linked Job (Optional)
                <select
                  value={editForm.linkedJobId}
                  onChange={(changeEvent) => setEditForm((current) => ({ ...current, linkedJobId: changeEvent.target.value }))}
                  className="mt-2 w-full max-w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                >
                  <option value="">No linked job</option>
                  {activeJobs.map((job) => (
                    <option key={job._id} value={job._id}>
                      {job.title} | {job.company}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-300">
                Minimum Innovation Score
                <Input
                  type="number"
                  min="0"
                  value={editForm.minimumInnovationScore}
                  onChange={(changeEvent) => setEditForm((current) => ({ ...current, minimumInnovationScore: changeEvent.target.value }))}
                  className="mt-2"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setIsEditOpen(false)} disabled={isEditingEvent}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await onUpdateEvent({
                      title: editForm.title.trim(),
                      type: editForm.type,
                      description: editForm.description.trim(),
                      linkedJobId: editForm.linkedJobId || null,
                      minimumInnovationScore: Number(editForm.minimumInnovationScore) || 0,
                    });
                    setIsEditOpen(false);
                  } catch {
                    // The parent mutation reports the API error and keeps this form open for correction.
                  }
                }}
                disabled={isEditingEvent || !canSubmitEdit}
              >
                <Edit className="mr-2 h-4 w-4" />
                {isEditingEvent ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
