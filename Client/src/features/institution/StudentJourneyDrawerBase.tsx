import {
  Award,
  Briefcase,
  Lightbulb,
  Rocket,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StudentJourney } from '../../types/school.types';

type Props = {
  journey?: StudentJourney;
  open: boolean;
  onClose: () => void;
};

const triggerLabel: Record<string, string> = {
  PROBLEM_CLAIMED: 'Claimed a new problem',
  PROBLEM_COMPLETED: 'Completed a problem',
  PROGRESS_UPLOADED: 'Uploaded workspace progress',
  PATENT_SUBMITTED: 'Patent submitted',
  PATENT_APPROVED: 'Patent approved',
  STARTUP_LAUNCHED: 'Startup launched',
};

const stages = ['Idea', 'Problem', 'Build', 'Patent', 'Launch'];

const stageIndex = (stage?: string) => {
  switch (stage) {
    case 'Problem':
      return 1;
    case 'Build':
      return 2;
    case 'Patent':
      return 3;
    case 'Launch':
      return 4;
    default:
      return 0;
  }
};

const metricCards = [
  { key: 'problemsClaimed', label: 'Problems Solved', icon: Target },
  { key: 'skillsCompleted', label: 'Innovations Created', icon: Lightbulb },
  { key: 'progressUploads', label: 'Prototypes Built', icon: TrendingUp },
  { key: 'patentsSubmitted', label: 'Patents Filed', icon: Award },
  { key: 'startupsLaunched', label: 'Startups Launched', icon: Rocket },
] as const;

export function StudentJourneyDrawerBase({ journey, open, onClose }: Props) {
  if (!open || !journey) {
    return null;
  }

  const currentStage = journey.workspaces[0]?.stage;
  const currentStageIndex = stageIndex(currentStage);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
      <div className="h-full w-full max-w-3xl overflow-y-auto border-l border-slate-800 bg-slate-950 px-6 py-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-500 to-emerald-500 text-2xl font-bold text-white">
              {journey.student.avatar ? (
                <img
                  src={journey.student.avatar}
                  alt={journey.student.displayName}
                  className="h-16 w-16 rounded-2xl object-cover"
                />
              ) : (
                journey.student.displayName.slice(0, 1).toUpperCase()
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{journey.student.displayName}</h2>
              <div className="mt-2 flex items-center gap-3">
                <Badge>{journey.student.innovationScore}/200</Badge>
                {currentStage ? <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">{currentStage}</Badge> : null}
              </div>
            </div>
          </div>
          <Button variant="ghost" className="rounded-full p-3" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <Card className="mb-6 p-5">
          <div className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Innovation Journey
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            {stages.map((stage, index) => {
              const complete = index <= currentStageIndex;
              return (
                <div
                  key={stage}
                  className={`rounded-2xl border px-3 py-4 text-center ${
                    complete
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                      : 'border-slate-800 bg-slate-900/80 text-slate-400'
                  }`}
                >
                  <div className="text-xs uppercase tracking-[0.2em]">{stage}</div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="mb-6 grid gap-4 md:grid-cols-5">
          {metricCards.map((metric) => (
            <Card key={metric.key} className="p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900">
                <metric.icon className="h-5 w-5 text-cyan-300" />
              </div>
              <div className="text-2xl font-bold text-white">
                {journey.student.scoreBreakdown[metric.key]}
              </div>
              <div className="mt-1 text-xs text-slate-400">{metric.label}</div>
            </Card>
          ))}
        </div>

        {journey.workspaces[0] ? (
          <Card className="mb-6 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              <Briefcase className="h-4 w-4" />
              Active Workspace
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xl font-semibold text-white">{journey.workspaces[0].title}</div>
                <div className="mt-1 text-sm text-slate-400">
                  {journey.workspaces[0].category}
                </div>
              </div>
              <div className="min-w-36">
                <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                  <span>Progress</span>
                  <span>{journey.workspaces[0].progressPercent}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                    style={{ width: `${journey.workspaces[0].progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        <Card className="p-5">
          <div className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Timeline
          </div>
          <div className="space-y-5">
            {journey.scoreEvents.map((event) => (
              <div key={event._id} className="flex gap-4">
                <div className="mt-1 flex h-11 w-11 flex-none items-center justify-center rounded-full bg-slate-900">
                  <TrendingUp className="h-5 w-5 text-cyan-300" />
                </div>
                <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="font-semibold text-white">
                      {triggerLabel[event.trigger] ?? event.trigger.replace(/_/g, ' ')}
                    </div>
                    <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                      +{event.delta} pts
                    </Badge>
                  </div>
                  <div className="text-sm text-slate-400">
                    {new Date(event.createdAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
