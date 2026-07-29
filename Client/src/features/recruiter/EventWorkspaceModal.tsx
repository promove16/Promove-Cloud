import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { BriefcaseBusiness, Building2, CheckCircle2, Circle, Link2, LockKeyhole, X, XCircle } from 'lucide-react';
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
  onClose: () => void;
  onComputeRankings: () => void;
  onSaveScore: () => void;
  onAddToPipeline: () => void;
  onCloseEvent: () => void;
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

const workflowStepClass: Record<WorkflowStepStatus, string> = {
  complete: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  active: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100',
  locked: 'border-slate-800 bg-slate-950/70 text-slate-500',
};

const WorkflowStepIcon = ({ status }: { status: WorkflowStepStatus }) => {
  if (status === 'complete') {
    return <CheckCircle2 className="h-5 w-5 text-emerald-300" />;
  }

  if (status === 'locked') {
    return <LockKeyhole className="h-5 w-5 text-slate-600" />;
  }

  return <Circle className="h-5 w-5 fill-cyan-400/20 text-cyan-300" />;
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
  onClose,
  onComputeRankings,
  onSaveScore,
  onAddToPipeline,
  onCloseEvent,
}: EventWorkspaceModalProps) {
  const rankingsFinalized = Boolean(event.rankingsComputedAt);
  const scoredParticipantsCount = event.participants.filter((participant) => typeof participant.submissionScore === 'number').length;
  const remainingScores = event.participants.length - scoredParticipantsCount;
  const allParticipantsScored = event.participants.length > 0 && remainingScores === 0;
  const selectedParticipant = event.participants.find((participant) => participant.studentId === selectionDraft.studentId) ?? null;
  const showScoringPanel = event.isActive && !rankingsFinalized;
  const showPipelinePanel = rankingsFinalized && Boolean(selectedParticipant);
  const showSidePanel = showScoringPanel || showPipelinePanel;

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
      detail: rankingsFinalized ? 'Choose from ranked students' : 'Unlocks after rankings',
      status: rankingsFinalized ? 'active' : 'locked',
    },
  ];

  const selectParticipantForScoring = (participant: RecruiterHiringEventParticipant) => {
    setScoreDraft({
      studentId: participant.studentId,
      score: typeof participant.submissionScore === 'number' ? String(participant.submissionScore) : '',
    });
  };

  const selectRankedCandidate = (studentId: string) => {
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
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

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
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Rankings</div>
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
                      return (
                        <div
                          key={`${event._id}-${ranking.studentId}`}
                          className="grid grid-cols-1 items-center gap-2 rounded-xl border border-slate-800 px-4 py-3 text-sm md:grid-cols-[70px,1fr,140px,140px,160px]"
                        >
                          <div className="font-semibold text-white">#{ranking.rank}</div>
                          <div className="font-medium text-white">{ranking.studentName}</div>
                          <div className="text-slate-300">Composite {ranking.compositeScore}</div>
                          <div className="text-slate-400">Submission {ranking.submissionScore}</div>
                          <Button
                            variant={isSelected ? 'outline' : 'secondary'}
                            size="sm"
                            className={isSelected ? 'border-cyan-500/50 text-cyan-300' : ''}
                            onClick={() => selectRankedCandidate(ranking.studentId)}
                          >
                            {isSelected ? 'Selected' : 'Select Candidate'}
                          </Button>
                        </div>
                      );
                    })}
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
    </div>
  );
}
