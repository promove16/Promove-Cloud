import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  Trophy,
  Sparkles,
  X,
} from "lucide-react";
import { userApi, type OnboardingStep } from "../../api/user.api";

const DISMISSED_KEY = "promove-onboarding-dismissed";

export function OnboardingChecklist() {
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === "true",
  );

  const { data: status, isLoading } = useQuery({
    queryKey: ["onboarding"],
    queryFn: userApi.getOnboarding,
    staleTime: 30_000,
    enabled: !dismissed,
  });

  const claimMutation = useMutation({
    mutationFn: (stepId: string) => userApi.claimOnboardingStep(stepId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["innovation-score"] });
    },
  });

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  }, []);

  if (dismissed || isLoading || !status) return null;

  const completedCount = status.steps.filter((s) => s.completed).length;
  const progress = completedCount / status.steps.length;

  if (status.allComplete && status.earnedPoints >= status.totalPoints) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-800/40 bg-gradient-to-br from-slate-900 via-cyan-950/20 to-slate-900 p-6">
      {/* Background decoration */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-cyan-500/5 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-purple-500/5 blur-2xl" />

      {/* Header */}
      <div className="relative mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Get Started</h2>
            <p className="text-sm text-slate-400">
              Complete these steps to earn{" "}
              <span className="font-semibold text-cyan-400">
                {status.totalPoints} bonus points
              </span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
          aria-label="Dismiss onboarding checklist"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="relative mb-6">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            {completedCount} of {status.steps.length} completed
          </span>
          <span className="font-semibold text-cyan-400">
            {status.earnedPoints}/{status.totalPoints} pts earned
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* Checklist items */}
      <div className="space-y-2">
        {status.steps.map((step) => (
          <ChecklistItem
            key={step.id}
            step={step}
            onClaim={() => claimMutation.mutate(step.id)}
            claiming={
              claimMutation.isPending &&
              claimMutation.variables === step.id
            }
          />
        ))}
      </div>

      {/* All complete celebration */}
      {status.allComplete && status.earnedPoints < status.totalPoints && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-700/40 bg-emerald-950/30 p-4">
          <Trophy className="h-6 w-6 flex-shrink-0 text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-emerald-300">
              All steps complete!
            </p>
            <p className="text-xs text-emerald-400/70">
              Claim your remaining points above
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ChecklistItem({
  step,
  onClaim,
  claiming,
}: {
  step: OnboardingStep;
  onClaim: () => void;
  claiming: boolean;
}) {
  const canClaim = step.completed && !step.claimed;

  return (
    <div
      className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
        step.completed
          ? step.claimed
            ? "border-emerald-800/30 bg-emerald-950/20"
            : "border-cyan-700/40 bg-cyan-950/20"
          : "border-slate-800 bg-slate-900 hover:border-slate-700"
      }`}
    >
      {/* Check icon */}
      <div className="flex-shrink-0">
        {step.completed ? (
          <CheckCircle2
            className={`h-5 w-5 ${step.claimed ? "text-emerald-400" : "text-cyan-400"}`}
          />
        ) : (
          <Circle className="h-5 w-5 text-slate-600" />
        )}
      </div>

      {/* Label & description */}
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${
            step.claimed
              ? "text-emerald-300/70 line-through"
              : step.completed
                ? "text-white"
                : "text-slate-300"
          }`}
        >
          {step.label}
        </p>
        {step.optional ? (
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-400">
            Optional
          </p>
        ) : null}
        {!step.completed && (
          <p className="mt-0.5 text-xs text-slate-500">{step.description}</p>
        )}
      </div>

      {/* Points badge or action */}
      <div className="flex flex-shrink-0 items-center gap-2">
        {canClaim ? (
          <button
            type="button"
            onClick={onClaim}
            disabled={claiming}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50"
          >
            {claiming ? "..." : `+${step.points} pts`}
          </button>
        ) : step.claimed ? (
          <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
            +{step.points}
          </span>
        ) : (
          <Link
            to={step.href}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <span>+{step.points} pts</span>
            <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
