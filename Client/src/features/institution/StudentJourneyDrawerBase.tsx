import { useState } from 'react';
import {
  Award,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Rocket,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { MAX_INNOVATION_SCORE } from '../../constants/score';
import { StudentJourney } from '../../types/school.types';

type Props = {
  journey?: StudentJourney;
  open: boolean;
  onClose: () => void;
};

const triggerLabel: Record<string, string> = {
  PROBLEM_CLAIMED: 'Claimed a problem',
  PROBLEM_COMPLETED: 'Completed a problem',
  PROGRESS_UPLOADED: 'Progress uploaded',
  PATENT_SUBMITTED: 'Patent submitted',
  PATENT_APPROVED: 'Patent approved',
  STARTUP_LAUNCHED: 'Startup launched',
};

const stages = ['Idea', 'Problem', 'Build', 'Patent', 'Launch'] as const;

const stageDotColor: Record<string, string> = {
  Idea: 'bg-violet-400',
  Problem: 'bg-blue-400',
  Build: 'bg-cyan-400',
  Patent: 'bg-amber-400',
  Launch: 'bg-emerald-400',
};

const stageIndex = (stage?: string) => {
  switch (stage) {
    case 'Problem': return 1;
    case 'Build': return 2;
    case 'Patent': return 3;
    case 'Launch': return 4;
    default: return 0;
  }
};

const metricCards = [
  { key: 'problemsCompleted', label: 'Problems', icon: Target },
  { key: 'skillsCompleted', label: 'Innovations', icon: Lightbulb },
  { key: 'progressUploads', label: 'Prototypes', icon: TrendingUp },
  { key: 'patentsSubmitted', label: 'Patents', icon: Award },
  { key: 'startupsLaunched', label: 'Startups', icon: Rocket },
] as const;

export function StudentJourneyDrawerBase({ journey, open, onClose }: Props) {
  const [showAllTimeline, setShowAllTimeline] = useState(false);
  if (!open || !journey) return null;

  const currentStage = journey.workspaces[0]?.stage;
  const currentStageIdx = stageIndex(currentStage);
  const scorePercent = Math.min(
    (journey.student.innovationScore / MAX_INNOVATION_SCORE) * 100,
    100,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/80"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-500 to-emerald-500 text-xl font-bold text-white">
              {journey.student.avatar ? (
                <img
                  src={journey.student.avatar}
                  alt={journey.student.displayName}
                  className="h-14 w-14 rounded-2xl object-cover"
                />
              ) : (
                journey.student.displayName.slice(0, 1).toUpperCase()
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{journey.student.displayName}</h2>
              <div className="mt-2 flex items-center gap-2">
                <Badge>{journey.student.innovationScore} / {MAX_INNOVATION_SCORE}</Badge>
                {currentStage ? (
                  <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                    {currentStage}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
          <Button variant="ghost" className="rounded-full p-2" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {/* Stage pipeline */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="relative flex items-center">
                {/* Connecting line */}
                <div className="absolute left-4 right-4 top-[18px] h-px bg-slate-800" />

                {stages.map((stage, idx) => {
                  const done = idx <= currentStageIdx;
                  const active = idx === currentStageIdx;
                  const dotCls = done
                    ? stageDotColor[stage]
                    : 'bg-slate-700';
                  return (
                    <div key={stage} className="relative z-10 flex flex-1 flex-col items-center gap-2">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${
                          active
                            ? 'border-white ' + dotCls + ' shadow-lg'
                            : done
                            ? 'border-transparent ' + dotCls
                            : 'border-slate-700 bg-slate-800'
                        }`}
                      >
                        {done && (
                          <div className="h-2.5 w-2.5 rounded-full bg-white/80" />
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-medium uppercase tracking-wide ${
                          done ? 'text-slate-200' : 'text-slate-600'
                        }`}
                      >
                        {stage}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Score bar */}
              <div className="mt-4 border-t border-slate-800 pt-4">
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
                    Innovation Score
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-slate-300">
                    {journey.student.innovationScore}
                    <span className="text-slate-600"> / {MAX_INNOVATION_SCORE}</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all"
                    style={{ width: `${scorePercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-5 gap-2">
              {metricCards.map((metric) => (
                <div
                  key={metric.key}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-2 py-3"
                >
                  <metric.icon className="h-4 w-4 text-cyan-400" />
                  <span className="text-lg font-bold tabular-nums text-white">
                    {journey.student.scoreBreakdown[metric.key]}
                  </span>
                  <span className="text-center text-[10px] leading-tight text-slate-500">
                    {metric.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Active workspace */}
            {journey.workspaces[0] ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Briefcase className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    Active Workspace
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">
                      {journey.workspaces[0].title}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {journey.workspaces[0].category}
                    </div>
                  </div>
                  <div className="w-28 flex-none">
                    <div className="mb-1 flex justify-between text-[10px] tabular-nums text-slate-500">
                      <span>Progress</span>
                      <span>{journey.workspaces[0].progressPercent}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                        style={{ width: `${journey.workspaces[0].progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Timeline */}
            {journey.scoreEvents.length > 0 ? (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    Timeline
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">{journey.scoreEvents.length} total</span>
                </div>
                <div className="divide-y divide-slate-800/60 space-y-1">
                  {(showAllTimeline ? journey.scoreEvents : journey.scoreEvents.slice(0, 5)).map((event) => (
                    <div
                      key={event._id}
                      className="flex items-center gap-3 py-2.5 px-2 rounded-xl transition-colors hover:bg-slate-900/50"
                    >
                      <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-cyan-500/10">
                        <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white">
                          {triggerLabel[event.trigger] ?? event.trigger.replace(/_/g, ' ')}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {new Date(event.createdAt).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      <Badge className="flex-none border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                        +{event.delta} pts
                      </Badge>
                    </div>
                  ))}
                </div>

                {journey.scoreEvents.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllTimeline((prev) => !prev)}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 py-2.5 text-xs font-semibold text-cyan-400 transition hover:bg-slate-800 hover:text-cyan-300"
                  >
                    {showAllTimeline ? (
                      <>
                        <span>Show Less</span>
                        <ChevronUp className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        <span>Read More ({journey.scoreEvents.length - 5} more)</span>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
