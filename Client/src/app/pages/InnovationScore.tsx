import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Gauge,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { scoreApi } from "../../api/score.api";
import { MAX_INNOVATION_SCORE } from "../../constants/score";
import { useInnovationScore } from "../../hooks/useInnovationScore";
import { type ScoreBreakdown, type ScoreEvent } from "../../types/score.types";

const eventLabel: Record<ScoreEvent["trigger"], string> = {
  PROBLEM_CLAIMED: "Claimed a problem",
  PROBLEM_COMPLETED: "Completed a problem",
  SKILL_COMPLETED: "Completed a skill milestone",
  PROGRESS_UPLOADED: "Uploaded workspace progress",
  PATENT_SUBMITTED: "Submitted a patent",
  PATENT_APPROVED: "Patent approved",
  MVP_VERIFIED: "MVP verified",
  MARKET_READY_VERIFIED: "Market-ready verification awarded",
  STARTUP_LAUNCHED: "Startup launched",
  AWARD_SUBMITTED: "Submitted an award",
  AWARD_APPROVED: "Award approved",
  GITHUB_CONNECTED: "Connected GitHub",
  LINKEDIN_CONNECTED: "Connected LinkedIn",
  RESUME_UPLOADED: "Uploaded resume",
  PROFILE_COMPLETE: "Completed profile",
  ONBOARDING_PROFILE: "Completed profile onboarding",
  ONBOARDING_PROJECT: "Completed project onboarding",
  ONBOARDING_GITHUB: "Completed GitHub onboarding",
  ONBOARDING_SHARE: "Shared portfolio",
};

const breakdownCards: Array<{
  key: keyof ScoreBreakdown;
  label: string;
}> = [
  { key: "problemsClaimed", label: "Problems Claimed" },
  { key: "skillsCompleted", label: "Skills Completed" },
  { key: "progressUploads", label: "Progress Uploads" },
  { key: "patentsSubmitted", label: "Patents Submitted" },
  { key: "patentsApproved", label: "Patents Approved" },
  { key: "mvpsVerified", label: "MVPs Verified" },
  { key: "marketReadyVerified", label: "Market Ready" },
  { key: "startupsLaunched", label: "Startups Launched" },
  { key: "awardsApproved", label: "Awards Approved" },
];

const earningRules: Array<{
  id: string;
  label: string;
  points: string;
  icon: LucideIcon;
  href?: string;
  count: (breakdown: ScoreBreakdown | undefined, triggerCounts: Partial<Record<ScoreEvent["trigger"], number>>) => number;
  completedText: (count: number) => string;
}> = [
  {
    id: "claim-problem",
    label: "Claim a problem",
    points: "+5 each",
    icon: Target,
    href: "/problem-bank",
    count: (breakdown, triggerCounts) => breakdown?.problemsClaimed ?? triggerCounts.PROBLEM_CLAIMED ?? 0,
    completedText: (count) => `${count} claimed`,
  },
  {
    id: "complete-problem",
    label: "Complete a problem",
    points: "+20 each",
    icon: Trophy,
    href: "/problem-bank",
    count: (_breakdown, triggerCounts) => triggerCounts.PROBLEM_COMPLETED ?? 0,
    completedText: (count) => `${count} completed`,
  },
  {
    id: "skill-milestones",
    label: "Complete skill milestones",
    points: "+8 each",
    icon: Sparkles,
    href: "/product-workspace",
    count: (breakdown) => breakdown?.skillsCompleted ?? 0,
    completedText: (count) => `${count} done`,
  },
  {
    id: "progress-uploads",
    label: "Upload workspace progress",
    points: "+3 each",
    icon: Upload,
    href: "/product-workspace",
    count: (breakdown) => breakdown?.progressUploads ?? 0,
    completedText: (count) => `${count} uploaded`,
  },
  {
    id: "patent-submission",
    label: "Submit a patent",
    points: "+15 each",
    icon: FileText,
    href: "/patent-support",
    count: (breakdown) => breakdown?.patentsSubmitted ?? 0,
    completedText: (count) => `${count} submitted`,
  },
  {
    id: "patent-approved",
    label: "Get a patent approved",
    points: "+25 each",
    icon: Trophy,
    href: "/patent-support",
    count: (breakdown) => breakdown?.patentsApproved ?? 0,
    completedText: (count) => `${count} approved`,
  },
  {
    id: "mvp-verified",
    label: "Get MVP verification",
    points: "+20 each",
    icon: Gauge,
    href: "/product-workspace",
    count: (breakdown) => breakdown?.mvpsVerified ?? 0,
    completedText: (count) => `${count} verified`,
  },
  {
    id: "market-ready",
    label: "Earn market-ready verification",
    points: "+30 each",
    icon: TrendingUp,
    href: "/startup-launch",
    count: (breakdown) => breakdown?.marketReadyVerified ?? 0,
    completedText: (count) => `${count} awarded`,
  },
  {
    id: "startup-launched",
    label: "Launch your startup",
    points: "+10 each",
    icon: Rocket,
    href: "/startup-launch",
    count: (breakdown) => breakdown?.startupsLaunched ?? 0,
    completedText: (count) => `${count} launched`,
  },
];

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const scoreBand = (score: number) => {
  if (score >= 750) return "Launch-ready momentum";
  if (score >= 500) return "Strong execution";
  if (score >= 250) return "Growing traction";
  return "Early build stage";
};

export function InnovationScorePage() {
  const scoreQuery = useInnovationScore();
  const historyQuery = useQuery({
    queryKey: ["score", "history", "me"],
    queryFn: () => scoreApi.getScoreHistory("me"),
  });

  const score = Math.min(
    Math.max(scoreQuery.data?.score ?? 0, 0),
    MAX_INNOVATION_SCORE,
  );
  const breakdown = scoreQuery.data?.breakdown;
  const weeklyDelta = scoreQuery.data?.weeklyDelta ?? 0;
  const rankPercentile = scoreQuery.data?.rankPercentile ?? 100;
  const progress = score / MAX_INNOVATION_SCORE;
  const historyEvents = historyQuery.data ?? [];

  const triggerCounts = useMemo(
    () =>
      historyEvents.reduce<Partial<Record<ScoreEvent["trigger"], number>>>((counts, event) => {
        counts[event.trigger] = (counts[event.trigger] ?? 0) + 1;
        return counts;
      }, {}),
    [historyEvents],
  );

  const earningChecklist = useMemo(
    () =>
      earningRules.map((rule) => {
        const completedCount = rule.count(breakdown, triggerCounts);
        return { ...rule, completedCount, isCompleted: completedCount > 0 };
      }),
    [breakdown, triggerCounts],
  );

  const completedChecklistCount = earningChecklist.filter((item) => item.isCompleted).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link
          to="/dashboard/student"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">Innovation Score</h1>
        <p className="mt-1 text-sm text-slate-400">
          Track how your work, progress, patents, and launches contribute to your score.
        </p>
      </div>

      {/* Score hero + quick stats */}
      <div className="rounded-2xl border border-blue-700/60 bg-gradient-to-br from-blue-950 via-slate-950 to-purple-950 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          {/* Circular gauge */}
          <div className="relative h-32 w-32 flex-shrink-0">
            <svg className="h-32 w-32 -rotate-90 transform">
              <circle cx="64" cy="64" r="54" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-slate-800" />
              <circle
                cx="64" cy="64" r="54"
                stroke="currentColor" strokeWidth="10" fill="transparent"
                strokeDasharray={`${2 * Math.PI * 54}`}
                strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress)}`}
                className="text-cyan-400"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl font-bold text-white">{score}</div>
                <div className="text-xs text-cyan-200">of {MAX_INNOVATION_SCORE}</div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex-1 space-y-3">
            <div className="text-base font-semibold text-white">{scoreBand(score)}</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                <div className="text-xs text-slate-400">Weekly</div>
                <div className="mt-0.5 text-lg font-bold text-white">{weeklyDelta > 0 ? "+" : ""}{weeklyDelta}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                <div className="text-xs text-slate-400">Percentile</div>
                <div className="mt-0.5 text-lg font-bold text-white">Top {rankPercentile}%</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                <div className="text-xs text-slate-400">Checklist</div>
                <div className="mt-0.5 text-lg font-bold text-white">{completedChecklistCount}/{earningChecklist.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How To Earn — compact list */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-white">Ways to Earn Score</h2>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-medium text-emerald-300">
            {completedChecklistCount}/{earningChecklist.length} done
          </span>
        </div>
        <div className="divide-y divide-slate-800/60">
          {earningChecklist.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-5 py-3">
              {item.isCompleted ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" />
              ) : (
                <div className="h-4 w-4 flex-shrink-0 rounded-full border border-slate-600" />
              )}
              <item.icon className={`h-4 w-4 flex-shrink-0 ${item.isCompleted ? "text-emerald-300" : "text-slate-500"}`} />
              <span className={`flex-1 text-sm ${item.isCompleted ? "text-white" : "text-slate-400"}`}>
                {item.label}
              </span>
              <span className={`text-xs font-medium ${item.isCompleted ? "text-emerald-300" : "text-slate-500"}`}>
                {item.isCompleted ? item.completedText(item.completedCount) : item.points}
              </span>
              {item.href && !item.isCompleted ? (
                <Link
                  to={item.href}
                  className="flex-shrink-0 text-slate-500 transition hover:text-cyan-400"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* Breakdown + History side by side on wide screens */}
      <div className="grid gap-5 xl:grid-cols-2">
        {/* Breakdown */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-5 py-3">
            <h2 className="text-sm font-semibold text-white">Score Breakdown</h2>
          </div>
          {breakdown ? (
            <div className="divide-y divide-slate-800/60">
              {breakdownCards.map((item) => (
                <div key={item.key} className="flex items-center justify-between px-5 py-2.5">
                  <span className="text-sm text-slate-400">{item.label}</span>
                  <span className="text-sm font-semibold text-white">{breakdown[item.key]}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-4 text-sm text-slate-400">
              {scoreQuery.isLoading ? "Loading..." : "Breakdown unavailable."}
            </div>
          )}
        </section>

        {/* History */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-5 py-3">
            <h2 className="text-sm font-semibold text-white">Recent Score Events</h2>
          </div>
          {historyQuery.isLoading ? (
            <div className="px-5 py-4 text-sm text-slate-400">Loading...</div>
          ) : historyEvents.length > 0 ? (
            <div className="divide-y divide-slate-800/60">
              {historyEvents.slice(0, 12).map((event) => (
                <div key={event._id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-white">{eventLabel[event.trigger] ?? event.trigger}</div>
                    <div className="text-xs text-slate-500">{formatDate(event.createdAt)}</div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm font-semibold text-cyan-300">
                      {event.delta > 0 ? "+" : ""}{event.delta} pts
                    </div>
                    <div className="text-xs text-slate-500">{event.scoreAfter}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-4 text-sm text-slate-400">No score events yet.</div>
          )}
        </section>
      </div>
    </div>
  );
}
