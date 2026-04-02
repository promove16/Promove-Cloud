import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  Briefcase,
  CheckCircle2,
  Clock,
  Calendar,
  Lightbulb,
  Rocket,
  Target,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { OnboardingChecklist } from "../../../components/onboarding/OnboardingChecklist";
import { StudentGithubProofPrompt } from "../../../components/onboarding/StudentGithubProofPrompt";
import { dealApi } from "../../../api/deal.api";
import { studentApi } from "../../../api/student.api";
import { workspaceApi } from "../../../api/workspace.api";
import { StudentWorkspaceTabs } from "../../../features/student/StudentWorkspaceTabs";
import { useInnovationScore } from "../../../hooks/useInnovationScore";
import { useAuthStore } from "../../../store/authStore";
import { Workspace } from "../../../types/workspace.types";

const MAX_INNOVATION_SCORE = 200;

const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not scheduled";

const getStageStatus = (stage: Workspace["stage"] | undefined, current: Workspace["stage"]) => {
  const order: Workspace["stage"][] = ["Ideation", "Problem", "Build", "Patent", "Launch"];
  const currentIndex = stage ? order.indexOf(stage) : -1;
  const stageIndex = order.indexOf(current);

  if (currentIndex === -1) return "upcoming";
  if (stageIndex < currentIndex) return "completed";
  if (stageIndex === currentIndex) return "active";
  return "upcoming";
};

export function StudentDashboard() {
  const { user } = useAuth();
  const authUser = useAuthStore((state) => state.user);
  const scoreQuery = useInnovationScore();

  const workspaceQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => workspaceApi.list(),
  });

  const mentorSessionsQuery = useQuery({
    queryKey: ["student", "mentor-sessions"],
    queryFn: studentApi.getMentorSessions,
    refetchInterval: 60_000,
  });

  const activeDealsQuery = useQuery({
    queryKey: ["student", "active-deals"],
    queryFn: dealApi.getMyDeals,
    refetchInterval: 60_000,
  });

  const workspaces = workspaceQuery.data ?? [];
  const activeWorkspace = workspaces[0];
  const mentorSessions = mentorSessionsQuery.data ?? [];
  const activeDeals = activeDealsQuery.data?.items ?? [];
  const innovationScore = Math.min(
    Math.max(scoreQuery.data?.score ?? authUser?.innovationScore ?? 0, 0),
    MAX_INNOVATION_SCORE,
  );
  const scoreProgress = innovationScore / MAX_INNOVATION_SCORE;
  const weeklyDelta = scoreQuery.data?.weeklyDelta ?? 0;
  const weeklyDeltaLabel = `${weeklyDelta > 0 ? "+" : ""}${weeklyDelta} this week`;
  const weeklyDeltaClass =
    weeklyDelta > 0 ? "text-green-400" : weeklyDelta < 0 ? "text-amber-300" : "text-blue-200";
  const rankPercentile = Math.min(Math.max(scoreQuery.data?.rankPercentile ?? 100, 1), 100);

  const stages = [
    { id: "Ideation", name: "Idea", icon: Lightbulb },
    { id: "Problem", name: "Problem", icon: Target },
    { id: "Build", name: "Build", icon: Rocket },
    { id: "Patent", name: "Patent", icon: Award },
    { id: "Launch", name: "Launch", icon: TrendingUp },
  ] as const;

  const stats = useMemo(
    () => [
      {
        label: "Innovation Score",
        value: String(innovationScore),
        helper: `Top ${rankPercentile}%`,
      },
      {
        label: "Problems Claimed",
        value: String(scoreQuery.data?.breakdown.problemsClaimed ?? 0),
        helper: "Validated from score breakdown",
      },
      {
        label: "Progress Uploads",
        value: String(scoreQuery.data?.breakdown.progressUploads ?? 0),
        helper: weeklyDeltaLabel,
      },
      {
        label: "Startups Launched",
        value: String(scoreQuery.data?.breakdown.startupsLaunched ?? 0),
        helper: "Launch engine connected",
      },
    ],
    [innovationScore, rankPercentile, scoreQuery.data, weeklyDeltaLabel],
  );

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="mb-2 text-4xl font-bold text-white">
          Welcome back, {user?.name || "Innovator"}!
        </h1>
        <p className="text-lg text-slate-400">Keep building amazing things</p>
      </div>

      <StudentWorkspaceTabs />

      <StudentGithubProofPrompt />
      <OnboardingChecklist />

      <div className="rounded-2xl border border-blue-800/30 bg-gradient-to-r from-blue-900/20 to-purple-900/20 p-8">
        <h2 className="mb-6 text-center text-xl font-bold text-white">Your Innovation Journey</h2>
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          {stages.map((stage, index) => {
            const status = getStageStatus(activeWorkspace?.stage, stage.id);
            return (
              <div key={stage.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`mb-3 flex h-16 w-16 items-center justify-center rounded-full transition-all ${
                      status === "completed"
                        ? "bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/50"
                        : status === "active"
                          ? "animate-pulse bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg shadow-blue-500/50"
                          : "border-2 border-slate-700 bg-slate-800"
                    }`}
                  >
                    {status === "completed" ? (
                      <CheckCircle2 className="h-8 w-8 text-white" />
                    ) : (
                      <stage.icon className={`h-8 w-8 ${status === "active" ? "text-white" : "text-slate-500"}`} />
                    )}
                  </div>
                  <span className={`text-sm font-semibold ${status === "upcoming" ? "text-slate-500" : "text-white"}`}>
                    {stage.name}
                  </span>
                </div>

                {index < stages.length - 1 ? (
                  <div
                    className={`mx-2 h-1 w-24 ${
                      status === "completed" ? "bg-gradient-to-r from-green-500 to-emerald-500" : "bg-slate-800"
                    }`}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-1 text-3xl font-bold text-white">{stat.value}</div>
            <div className="mb-2 text-sm text-slate-400">{stat.label}</div>
            <div className="text-xs text-blue-300">{stat.helper}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-blue-700 bg-gradient-to-br from-blue-900 to-purple-900 p-8 text-center">
          <h3 className="mb-4 text-lg font-semibold text-blue-200">Innovation Score</h3>
          <div className="relative mx-auto mb-4 h-40 w-40">
            <svg className="h-40 w-40 -rotate-90 transform">
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="12"
                fill="transparent"
                className="text-blue-900/50"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 70}`}
                strokeDashoffset={`${2 * Math.PI * 70 * (1 - scoreProgress)}`}
                className={`${
                  innovationScore > 150
                    ? "text-green-400"
                    : innovationScore >= 80
                      ? "text-blue-300"
                      : "text-amber-400"
                }`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div>
                <div className="text-5xl font-bold text-white">{innovationScore}</div>
                <div className="text-sm text-blue-200">of {MAX_INNOVATION_SCORE}</div>
              </div>
            </div>
          </div>
          <div className={`flex items-center justify-center gap-2 ${weeklyDeltaClass}`}>
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-semibold">{weeklyDeltaLabel}</span>
          </div>
          <p className="mt-3 text-xs text-blue-200">Top {rankPercentile}% of innovators</p>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">Active Project</h3>
            <Link
              to={activeWorkspace ? `/product-workspace/${activeWorkspace._id}` : "/problem-bank"}
              className="text-sm font-semibold text-blue-400 hover:text-blue-300"
            >
              {activeWorkspace ? "View Details" : "Browse Problems"}
            </Link>
          </div>
          {activeWorkspace ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h4 className="mb-2 text-2xl font-bold text-white">{activeWorkspace.title}</h4>
                  <p className="mb-3 text-slate-400">
                    {activeWorkspace.category} workspace in the {activeWorkspace.stage} stage
                  </p>
                  <div className="flex items-center gap-4">
                    <span className="rounded-full bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-400">
                      {activeWorkspace.stage}
                    </span>
                    <span className="flex items-center gap-1 text-sm text-slate-400">
                      <Clock className="h-4 w-4" />
                      Updated {formatDate(activeWorkspace.updatedAt)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="mb-1 text-4xl font-bold text-white">{activeWorkspace.progressPercent}%</div>
                  <div className="text-sm text-slate-400">Complete</div>
                </div>
              </div>

              <div className="mb-4">
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                    style={{ width: `${activeWorkspace.progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
                <Target className="h-5 w-5 flex-shrink-0 text-blue-500" />
                <div>
                  <div className="mb-1 text-xs text-slate-500">Next Milestone</div>
                  <div className="text-sm font-semibold text-white">
                    {activeWorkspace.milestones.find((milestone) => !milestone.isCompleted)?.name ?? "Ready to launch"}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center">
              <Briefcase className="mx-auto mb-4 h-10 w-10 text-slate-500" />
              <h4 className="mb-2 text-xl font-bold text-white">No active workspace yet</h4>
              <p className="mb-4 text-slate-400">Claim a problem to create your first student workspace.</p>
              <Link
                to="/problem-bank"
                className="inline-flex rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 font-semibold text-white"
              >
                Explore Problem Bank
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Your Portfolio</h3>
          <Link to="/leadership-profile" className="text-sm font-semibold text-blue-400 hover:text-blue-300">
            View Leadership Profile
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {workspaces.length > 0 ? (
            workspaces.map((project) => (
              <div key={project._id} className="group rounded-xl border border-slate-800 bg-slate-950 p-5 transition-all hover:border-blue-500/50">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="mb-2 font-bold text-white transition-colors group-hover:text-blue-400">{project.title}</h4>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">{project.category}</span>
                      <span className="rounded bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-400">
                        {project.stage}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mb-2">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                    <span>Progress</span>
                    <span>{project.progressPercent}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                      style={{ width: `${project.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="md:col-span-2 py-8 text-center text-slate-400">
              Your workspace portfolio will appear here once you claim a problem.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="mb-6 text-xl font-bold text-white">Upcoming Mentor Sessions</h3>
        {mentorSessionsQuery.isLoading ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center text-slate-400">
            Loading mentor sessions...
          </div>
        ) : mentorSessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center text-slate-400">
            No upcoming mentor sessions. Browse mentors in the Marketplace.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {mentorSessions.map((session) => (
              <div key={session._id} className="rounded-xl border border-slate-800 bg-slate-950 p-5 transition-all hover:border-purple-500/50">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
                    <span className="text-sm font-bold text-white">
                      {session.mentor.displayName
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h4 className="mb-1 font-bold text-white">{session.mentor.displayName}</h4>
                    <p className="mb-3 text-sm text-slate-400">{session.title}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(session.scheduledAt)}
                      </span>
                      <span>-</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(session.scheduledAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="mt-3">
                      {session.meetLink ? (
                        <a
                          href={session.meetLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded bg-purple-500/10 px-2 py-1 text-xs font-semibold text-purple-400"
                        >
                          Google Meet link
                        </a>
                      ) : (
                        <span className="rounded bg-purple-500/10 px-2 py-1 text-xs font-semibold text-purple-400">
                          Scheduled
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Active Investor Deals</h3>
          <span className="text-sm text-slate-400">{activeDeals.length} active deals</span>
        </div>
        {activeDealsQuery.isLoading ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center text-slate-400">
            Loading deal flow...
          </div>
        ) : activeDeals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center text-slate-400">
            No investor deals yet. Launch your startup to investors from the Startup Launch engine.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {activeDeals.map((deal, index) => (
              <div key={deal._id} className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="mb-1 font-bold text-white">
                      {deal.currentStage < 2 ? `Investor #${index + 1}` : deal.investorDisplayName}
                    </h4>
                    <p className="text-sm text-slate-400">Startup: {deal.startupName}</p>
                  </div>
                  <span className="rounded bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-400">
                    Stage {deal.currentStage}
                  </span>
                </div>
                <p className="mt-4 text-sm text-slate-300">{deal.nextActionLabel}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {deal.currentStage === 1
                    ? "Due diligence in progress"
                    : deal.currentStage === 2
                      ? "Fund transfer in progress"
                      : deal.currentStage === 3
                        ? "Awaiting equity verification by admin"
                        : "Deal closed - check your portfolio!"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
