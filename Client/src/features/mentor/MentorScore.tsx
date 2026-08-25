import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Clock3,
  Cpu,
  FlaskConical,
  Globe,
  MessageSquare,
  Mic2,
  Star,
  TrendingUp,
  Trophy,
  Users,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { mentorScoreApi, MentorScoreBreakdown, MentorScoreEvent, MentorVerificationTask } from '../../api/mentorScore.api';

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE1_CAP = 140;
const PHASE2_CAP = 245;
const TOTAL_GUIDED_MAX = 700;

const TRIGGER_LABEL: Record<string, string> = {
  TRAINING_MODULE_COMPLETED: 'Training module completed',
  QUIZ_PASSED: 'Quiz passed',
  LAB_HARDWARE_VERIFIED: 'Lab hardware verified',
  CURRICULUM_APPROVED: 'Curriculum PDF approved',
  CLASS_PHOTO_VERIFIED: 'Class photo verified',
  INDUSTRY_SESSION_VERIFIED: 'Industry session verified',
  STUDENT_PROTOTYPE_TRANSITION: 'Student reached prototype stage',
  DEMO_DAY_VERIFIED: 'Demo Day verified',
  RESOURCE_MILESTONE_REACHED: 'Resource hit 10 downloads',
  FORUM_ANSWER_HELPFUL: 'Forum answer marked helpful',
  FORUM_VERIFIED_SOLUTION: 'Forum answer verified solution',
  SESSION_TOKEN_RELEASED: 'Session token released',
  EQUITY_LOI_SIGNED: 'Equity LOI signed',
  MENTEE_OUTCOME_BONUS: 'Mentee won competition or funded',
  SCORE_DECAY: 'Inactivity decay',
  ADMIN_ADJUSTMENT: 'Admin adjustment',
};

const TASK_TYPE_LABEL: Record<MentorVerificationTask['type'], string> = {
  lab_sync: 'Lab Hardware Sync',
  curriculum_pdf: 'Curriculum PDF',
  class_photo: 'Class Photo',
  industry_session: 'Industry Session',
  prototype_velocity: 'Prototype Velocity',
  demo_day: 'Demo Day',
  outcome_bonus: 'Outcome Bonus',
};

const STATUS_STYLE: Record<MentorVerificationTask['status'], string> = {
  pending: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  approved: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  rejected: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
};

// ─── Earning rules (mirrors student InnovationScore checklist) ─────────────────

type EarningRule = {
  id: string;
  label: string;
  points: string;
  href?: string;
  icon: LucideIcon;
  count: (b: MentorScoreBreakdown) => number;
  completedText: (n: number) => string;
};

const earningRules: EarningRule[] = [
  {
    id: 'training',
    label: 'Complete mentor training & certification quizzes',
    points: 'up to 60 pts',
    icon: BookOpen,
    count: (b) => b.phase1Breakdown.training,
    completedText: (n) => `${n} pts earned`,
  },
  {
    id: 'lab-sync',
    label: 'Sync lab hardware (admin-verified photo)',
    points: '+40 pts',
    href: '/dashboard/mentor/evidence-center',
    icon: Cpu,
    count: (b) => b.phase1Breakdown.labSync,
    completedText: () => 'Verified',
  },
  {
    id: 'curriculum',
    label: 'Map curriculum & submit class photos',
    points: '+40 pts total',
    href: '/dashboard/mentor/evidence-center',
    icon: FlaskConical,
    count: (b) => b.phase1Breakdown.curriculumMapping,
    completedText: (n) => `${n} pts earned`,
  },
  {
    id: 'industry',
    label: 'Host verified industry/founder sessions',
    points: '+10 pts each (max 95)',
    href: '/dashboard/mentor/evidence-center',
    icon: Mic2,
    count: (b) => b.phase2Breakdown.industryConnects,
    completedText: (n) => `${n} pts earned`,
  },
  {
    id: 'prototype',
    label: 'Guide students to prototype stage',
    points: '+10 pts each (max 100)',
    href: '/dashboard/mentor/students',
    icon: Zap,
    count: (b) => b.phase2Breakdown.prototypeVelocity,
    completedText: (n) => `${n} pts earned`,
  },
  {
    id: 'demo-day',
    label: 'Run a Local Demo Day (video + winners)',
    points: '+50 pts once/year',
    href: '/dashboard/mentor/evidence-center',
    icon: Trophy,
    count: (b) => b.phase2Breakdown.demoDay,
    completedText: (n) => `${n} pts earned`,
  },
  {
    id: 'resources',
    label: 'Publish resources that reach 10 downloads',
    points: '+20 pts per milestone',
    href: '/dashboard/mentor/resources',
    icon: Globe,
    count: (b) => b.phase3Breakdown.resourceLibrary,
    completedText: (n) => `${n} pts earned`,
  },
  {
    id: 'forum',
    label: 'Answer forum questions (helpful votes + solutions)',
    points: '+5 helpful / +15 verified',
    href: '/dashboard/mentor/forum',
    icon: MessageSquare,
    count: (b) => b.phase3Breakdown.forum,
    completedText: (n) => `${n} pts earned`,
  },
  {
    id: 'sessions',
    label: 'Complete mentoring sessions (student releases token)',
    points: '+10 pts per 30 min (max 30)',
    href: '/dashboard/mentor/students',
    icon: Clock3,
    count: (b) => b.phase3Breakdown.sessions,
    completedText: (n) => `${n} pts earned`,
  },
  {
    id: 'loi',
    label: 'Sign Equity Letter of Intent with a startup',
    points: '+15 pts per LOI',
    href: '/dashboard/mentor/marketplace',
    icon: Award,
    count: (b) => b.phase3Breakdown.equityLOIs,
    completedText: (n) => `${n} pts earned`,
  },
  {
    id: 'outcome',
    label: 'Mentee wins a competition or gets funded',
    points: '+50 pts per outcome',
    href: '/dashboard/mentor/students',
    icon: Users,
    count: (b) => b.phase3Breakdown.outcomeBonuses,
    completedText: (n) => `${n} pts earned`,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const mentorBand = (total: number) => {
  if (total >= 600) return 'Master Mentor';
  if (total >= 400) return 'Advanced Mentor';
  if (total >= 200) return 'Emerging Mentor';
  return 'Building foundation';
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PhaseBreakdownRow({
  label,
  value,
  cap,
}: {
  label: string;
  value: number;
  cap: number | null;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-white">
        {value}{cap !== null ? <span className="text-xs font-normal text-slate-500"> / {cap}</span> : ' pts'}
      </span>
    </div>
  );
}

function EventRow({ event }: { event: MentorScoreEvent }) {
  const isNeg = event.delta < 0;
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-sm text-white">{TRIGGER_LABEL[event.trigger] ?? event.trigger}</div>
        <div className="text-xs text-slate-500">{fmt(event.createdAt)}</div>
      </div>
      <div className="flex-shrink-0 text-right">
        <div className={`text-sm font-semibold ${isNeg ? 'text-rose-400' : 'text-violet-300'}`}>
          {event.delta > 0 ? '+' : ''}{event.delta} pts
        </div>
        <div className="text-xs text-slate-500">{event.scoreAfter} total</div>
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: MentorVerificationTask }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">{TASK_TYPE_LABEL[task.type]}</div>
        <div className="text-xs text-slate-500 mt-0.5">{fmt(task.createdAt)}</div>
        {task.status === 'rejected' && task.rejectionNote && (
          <div className="text-xs text-rose-400 mt-1 truncate">{task.rejectionNote}</div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[task.status]}`}>
          {task.status === 'approved' && <CheckCircle2 className="h-3 w-3" />}
          {task.status === 'rejected' && <XCircle className="h-3 w-3" />}
          {task.status === 'pending' && <Clock3 className="h-3 w-3" />}
          {task.status}
        </span>
        <span className="text-xs text-slate-500">{task.pointsToAward} pts</span>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MentorScore() {
  const scoreQuery = useQuery({
    queryKey: ['mentor-score', 'me'],
    queryFn: mentorScoreApi.getMyScore,
  });

  const historyQuery = useQuery({
    queryKey: ['mentor-score', 'history'],
    queryFn: mentorScoreApi.getMyHistory,
  });

  const submissionsQuery = useQuery({
    queryKey: ['mentor-score', 'submissions'],
    queryFn: () => mentorScoreApi.getMySubmissions(),
  });

  const score = scoreQuery.data;
  const total = score?.totalScore ?? 0;
  const p1 = score?.phase1Score ?? 0;
  const p2 = score?.phase2Score ?? 0;
  const p3 = score?.phase3Score ?? 0;
  const rank = score?.rank ?? 0;
  const rating = score?.mentorshipRating ?? 0;
  const progress = total / TOTAL_GUIDED_MAX;

  const earningChecklist = useMemo(
    () =>
      earningRules.map((rule) => {
        const earned = score ? rule.count(score) : 0;
        return { ...rule, earned, isStarted: earned > 0 };
      }),
    [score],
  );

  const startedCount = earningChecklist.filter((item) => item.isStarted).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link
          to="/dashboard/mentor"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">Mentor Score</h1>
        <p className="mt-1 text-sm text-slate-400">
          Track your empowerment, incubation, and mentorship impact across all three phases.
        </p>
      </div>

      {/* Score hero */}
      <div className="rounded-2xl border border-violet-700/60 bg-gradient-to-br from-violet-950 via-slate-950 to-indigo-950 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          {/* Circular gauge */}
          <div className="relative h-32 w-32 flex-shrink-0 mx-auto sm:mx-0">
            <svg className="h-32 w-32 -rotate-90 transform">
              <circle cx="64" cy="64" r="54" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-slate-800" />
              <circle
                cx="64" cy="64" r="54"
                stroke="currentColor" strokeWidth="10" fill="transparent"
                strokeDasharray={`${2 * Math.PI * 54}`}
                strokeDashoffset={`${2 * Math.PI * 54 * (1 - Math.min(1, progress))}`}
                className="text-violet-400"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl font-bold text-white">{total}</div>
                <div className="text-xs text-violet-300">of {TOTAL_GUIDED_MAX}</div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex-1 space-y-3">
            <div className="text-base font-semibold text-white">{mentorBand(total)}</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                <div className="text-xs text-slate-400">Global Rank</div>
                <div className="mt-0.5 text-lg font-bold text-white">{rank > 0 ? `#${rank}` : '—'}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                <div className="text-xs text-slate-400">Rating</div>
                <div className="mt-0.5 flex items-center justify-center gap-1 text-lg font-bold text-amber-300">
                  <Star className="h-3.5 w-3.5 fill-amber-300" />
                  {rating > 0 ? rating.toFixed(1) : '—'}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                <div className="text-xs text-slate-400">Checklist</div>
                <div className="mt-0.5 text-lg font-bold text-white">{startedCount}/{earningChecklist.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ways to Earn — mirrors student checklist */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-white">Ways to Earn Score</h2>
          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-0.5 text-xs font-medium text-violet-300">
            {startedCount}/{earningChecklist.length} started
          </span>
        </div>
        <div className="divide-y divide-slate-800/60">
          {earningChecklist.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-5 py-3">
              {item.isStarted ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-violet-400" />
              ) : (
                <div className="h-4 w-4 flex-shrink-0 rounded-full border border-slate-600" />
              )}
              <item.icon className={`h-4 w-4 flex-shrink-0 ${item.isStarted ? 'text-violet-300' : 'text-slate-500'}`} />
              <span className={`flex-1 text-sm ${item.isStarted ? 'text-white' : 'text-slate-400'}`}>
                {item.label}
              </span>
              <span className={`text-xs font-medium ${item.isStarted ? 'text-violet-300' : 'text-slate-500'}`}>
                {item.isStarted ? item.completedText(item.earned) : item.points}
              </span>
              {item.href && (
                <Link
                  to={item.href}
                  aria-label={`Open ${item.label}`}
                  className="flex-shrink-0 text-slate-500 transition hover:text-violet-400"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Breakdown + History side-by-side (mirrors student layout) */}
      <div className="grid gap-5 xl:grid-cols-2">
        {/* Score Breakdown */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-5 py-3">
            <h2 className="text-sm font-semibold text-white">Score Breakdown</h2>
          </div>
          {score ? (
            <div className="divide-y divide-slate-800/60">
              {/* Phase 1 header */}
              <div className="flex items-center gap-2 bg-slate-800/40 px-5 py-2">
                <Zap className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-cyan-400">Phase 1 — Empowerment</span>
                <span className="ml-auto text-xs font-semibold text-cyan-300">{p1} / {PHASE1_CAP}</span>
              </div>
              <PhaseBreakdownRow label="Training Completion" value={score.phase1Breakdown.training} cap={60} />
              <PhaseBreakdownRow label="Lab Hardware Sync" value={score.phase1Breakdown.labSync} cap={40} />
              <PhaseBreakdownRow label="Curriculum Mapping" value={score.phase1Breakdown.curriculumMapping} cap={40} />
              {/* Phase 2 header */}
              <div className="flex items-center gap-2 bg-slate-800/40 px-5 py-2">
                <TrendingUp className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-violet-400">Phase 2 — Incubation</span>
                <span className="ml-auto text-xs font-semibold text-violet-300">{p2} / {PHASE2_CAP}</span>
              </div>
              <PhaseBreakdownRow label="Industry Connects" value={score.phase2Breakdown.industryConnects} cap={95} />
              <PhaseBreakdownRow label="Prototype Velocity" value={score.phase2Breakdown.prototypeVelocity} cap={100} />
              <PhaseBreakdownRow label="Demo Day" value={score.phase2Breakdown.demoDay} cap={50} />
              {/* Phase 3 header */}
              <div className="flex items-center gap-2 bg-slate-800/40 px-5 py-2">
                <Globe className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Phase 3 — Global</span>
                <span className="ml-auto text-xs font-semibold text-emerald-300">{p3} pts</span>
              </div>
              <PhaseBreakdownRow label="Resource Library" value={score.phase3Breakdown.resourceLibrary} cap={null} />
              <PhaseBreakdownRow label="Forum" value={score.phase3Breakdown.forum} cap={null} />
              <PhaseBreakdownRow label="Session Tokens" value={score.phase3Breakdown.sessions} cap={null} />
              <PhaseBreakdownRow label="Equity LOIs" value={score.phase3Breakdown.equityLOIs} cap={null} />
              <PhaseBreakdownRow label="Outcome Bonuses" value={score.phase3Breakdown.outcomeBonuses} cap={null} />
              <PhaseBreakdownRow label="Content Creator Bonus" value={score.phase3Breakdown.contentCreatorBonus ?? 0} cap={null} />
            </div>
          ) : (
            <div className="px-5 py-4 text-sm text-slate-400">
              {scoreQuery.isLoading ? 'Loading...' : 'No breakdown yet.'}
            </div>
          )}
        </section>

        {/* Recent Score Events */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-5 py-3">
            <h2 className="text-sm font-semibold text-white">Recent Score Events</h2>
          </div>
          {historyQuery.isLoading ? (
            <div className="px-5 py-4 text-sm text-slate-400">Loading...</div>
          ) : (historyQuery.data?.length ?? 0) > 0 ? (
            <div className="divide-y divide-slate-800/60">
              {historyQuery.data!.slice(0, 12).map((event) => (
                <EventRow key={event._id} event={event} />
              ))}
            </div>
          ) : (
            <div className="px-5 py-4 text-sm text-slate-400">No score events yet.</div>
          )}
        </section>
      </div>

      {/* Submissions */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-white">My Submissions</h2>
          {(submissionsQuery.data?.filter((t) => t.status === 'pending').length ?? 0) > 0 && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-0.5 text-xs font-medium text-amber-300">
              {submissionsQuery.data!.filter((t) => t.status === 'pending').length} pending
            </span>
          )}
        </div>
        {submissionsQuery.isLoading ? (
          <div className="px-5 py-6 text-center text-sm text-slate-400">Loading...</div>
        ) : (submissionsQuery.data?.length ?? 0) === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-slate-400">
            No submissions yet — lab syncs, curriculum PDFs, industry sessions, and demo days appear here.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {submissionsQuery.data!.map((task) => (
              <TaskRow key={task._id} task={task} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
