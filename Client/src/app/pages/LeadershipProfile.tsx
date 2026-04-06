import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, ArrowUpRight, Calendar, Download, Rocket, Share2, Star, Target, TrendingUp } from "lucide-react";
import { jsPDF } from "jspdf";
import { Link } from "react-router-dom";
import { studentApi } from "../../api/student.api";
import { scoreApi } from "../../api/score.api";
import { startupApi } from "../../api/startup.api";
import { workspaceApi } from "../../api/workspace.api";
import { DEFAULT_STARTUP_IPR_PROFILE } from "../../features/startup/iprIntake";
import { useInnovationScore } from "../../hooks/useInnovationScore";
import { useAuthStore } from "../../store/authStore";
import { MAX_INNOVATION_SCORE } from "../../constants/score";
import { DashboardLayout } from "../components/DashboardLayout";

const eventLabel: Record<string, string> = {
  PROBLEM_CLAIMED: "Claimed a new problem",
  PROBLEM_COMPLETED: "Completed a problem",
  SKILL_COMPLETED: "Completed a skill milestone",
  PROGRESS_UPLOADED: "Uploaded workspace progress",
  PATENT_SUBMITTED: "Patent filed",
  PATENT_APPROVED: "Patent approved",
  MVP_VERIFIED: "MVP verified",
  MARKET_READY_VERIFIED: "Market-ready verification awarded",
  STARTUP_LAUNCHED: "Startup launched",
  AWARD_APPROVED: "Award approved",
  GITHUB_CONNECTED: "Connected GitHub profile",
  LINKEDIN_CONNECTED: "Connected LinkedIn profile",
  RESUME_UPLOADED: "Uploaded resume",
  PROFILE_COMPLETE: "Completed profile",
  ONBOARDING_PROFILE: "Completed profile onboarding",
  ONBOARDING_PROJECT: "Completed project onboarding",
  ONBOARDING_GITHUB: "Completed GitHub onboarding",
  ONBOARDING_SHARE: "Shared portfolio",
};

const improvementTone: Record<string, string> = {
  quick_win: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
  milestone: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
  consistency: "border-violet-500/20 bg-violet-500/10 text-violet-200",
};

export function LeadershipProfile() {
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [toast, setToast] = useState("");
  const [showLaunchModal, setShowLaunchModal] = useState(false);

  const score = useInnovationScore();
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: () => workspaceApi.list() });
  const scoreHistory = useQuery({
    queryKey: ["score", "history", authUser?._id],
    queryFn: () => scoreApi.getScoreHistory(authUser!._id),
    enabled: Boolean(authUser?._id),
  });
  const startups = useQuery({ queryKey: ["startup", "mine"], queryFn: () => startupApi.mine() });

  const publicProfileUrl =
    authUser?.profileSlug && typeof window !== "undefined"
      ? `${window.location.origin}/students/${authUser.profileSlug}`
      : "";
  const launchSourceWorkspace = (workspaces.data ?? []).length === 1 ? workspaces.data?.[0] : null;
  const canShareProfile = Boolean(
    authUser?.verificationStatus === "verified" && authUser?.profileComplete && authUser?.profileSlug,
  );

  const innovationScore = Math.min(
    Math.max(score.data?.score ?? authUser?.innovationScore ?? 0, 0),
    MAX_INNOVATION_SCORE,
  );
  const scoreProgress = innovationScore / MAX_INNOVATION_SCORE;
  const weeklyDelta = score.data?.weeklyDelta ?? 0;
  const weeklyDeltaLabel = `${weeklyDelta > 0 ? "+" : ""}${weeklyDelta} this week`;
  const weeklyDeltaClass =
    weeklyDelta > 0 ? "text-emerald-300" : weeklyDelta < 0 ? "text-amber-300" : "text-blue-200";
  const rankPercentile = Math.min(Math.max(score.data?.rankPercentile ?? 100, 1), 100);
  const scoreBand =
    innovationScore >= 750
      ? "Launch-ready momentum"
      : innovationScore >= 400
        ? "Innovation momentum building"
        : "Early-stage portfolio";
  const breakdownDetails = score.data?.breakdownDetails ?? [];
  const improvementTips = score.data?.improvementTips ?? [];

  const stats = useMemo(
    () => [
      { label: "Problems Solved", value: score.data?.breakdown.problemsClaimed ?? 0, icon: Target },
      { label: "Innovations Created", value: workspaces.data?.length ?? 0, icon: Rocket },
      { label: "Prototypes Built", value: score.data?.breakdown.progressUploads ?? 0, icon: Rocket },
      { label: "Patents Filed", value: score.data?.breakdown.patentsSubmitted ?? 0, icon: Award },
      { label: "Startups Launched", value: score.data?.breakdown.startupsLaunched ?? 0, icon: TrendingUp },
    ],
    [score.data, workspaces.data],
  );

  const launchToRecruiters = async () => {
    try {
      if ((startups.data?.length ?? 0) === 0) {
        await startupApi.create({
          projectId: launchSourceWorkspace?._id,
          name: launchSourceWorkspace?.title ?? "Student Innovation Portfolio",
          tagline: "Portfolio launch",
          category: launchSourceWorkspace?.category ?? "Innovation",
          stage: "Pre-Launch",
          activeProducts: 1,
          teamSize: launchSourceWorkspace?.teamMembers?.length ?? 1,
          traction: { patentFiled: false, mvpBuilt: false, revenueGenerating: false },
          businessProfile: {
            problemStatement: "",
            solutionSummary: "",
            targetCustomers: "",
            marketAnalysis: "",
            revenueModel: "",
            goToMarketPlan: "",
          },
          registrationProfile: { ...DEFAULT_STARTUP_IPR_PROFILE },
        });
      }

      const result = await studentApi.launchToRecruiters();
      setUser(result.user);
      setToast("Your portfolio is now visible to recruiters matching your skill set.");
      setShowLaunchModal(false);

      await queryClient.invalidateQueries({ queryKey: ["startup", "mine"] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace"] });

      if (authUser?._id) {
        await queryClient.invalidateQueries({ queryKey: ["score", "history", authUser._id] });
      }
    } catch (error) {
      setToast(
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
          "Unable to launch your portfolio to recruiters.",
      );
    }
  };

  const copyShareLink = async () => {
    if (!publicProfileUrl) {
      setToast("Public portfolio link is not available yet.");
      return;
    }

    try {
      await navigator.clipboard.writeText(publicProfileUrl);
      setToast("Public portfolio link copied.");
    } catch (_error) {
      setToast("Unable to copy the public portfolio link.");
    }
  };

  const downloadPdf = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(18);
    pdf.text(authUser?.displayName ?? "Portfolio", 14, 20);
    pdf.setFontSize(12);
    pdf.text(`Innovation Score: ${innovationScore}`, 14, 30);
    pdf.text(`Role: ${authUser?.role ?? "student"}`, 14, 38);
    pdf.text("Recent score timeline", 14, 50);
    (scoreHistory.data ?? []).slice(0, 8).forEach((event, index) => {
      pdf.text(`${index + 1}. ${eventLabel[event.trigger] ?? event.trigger} (+${event.delta})`, 14, 60 + index * 8);
    });
    pdf.save("promove-portfolio.pdf");
  };

  return (
    <DashboardLayout role="student">
      <div className="space-y-8">
        {toast ? (
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-300">
            {toast}
          </div>
        ) : null}

        <div>
          <h1 className="text-3xl font-bold text-white">Portfolio</h1>
          <p className="mt-2 text-slate-400">
            Your public-facing innovation portfolio, score story, and recruiter-ready proof of work.
          </p>
        </div>

        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 text-4xl font-bold text-white">
              {authUser?.displayName?.slice(0, 1).toUpperCase() ?? "S"}
            </div>
            <div>
              <h2 className="mb-2 text-3xl font-bold text-white">
                {authUser?.displayName ?? "Student Innovator"}
              </h2>
              <p className="mb-3 text-slate-400 capitalize">
                {authUser?.role ?? "student"} • ProMove Innovation Cloud
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-yellow-500" />
                  <span className="text-xl font-bold text-white">
                    Innovation Score: {innovationScore}/{MAX_INNOVATION_SCORE}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, index) => (
                    <Star
                      key={index}
                      className={`h-4 w-4 ${
                        index < Math.max(1, Math.round((innovationScore / MAX_INNOVATION_SCORE) * 5))
                          ? "fill-yellow-500 text-yellow-500"
                          : "text-slate-600"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={copyShareLink}
              disabled={!canShareProfile}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-3 font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Share2 className="h-5 w-5" />
              Copy Public Link
            </button>
            <button
              onClick={() => setShowLaunchModal(true)}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-3 font-semibold text-white transition-colors hover:bg-slate-700"
            >
              <Share2 className="h-5 w-5" />
              Launch to Recruiters
            </button>
            <button
              onClick={downloadPdf}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-semibold text-white transition-all"
            >
              <Download className="h-5 w-5" />
              Download Portfolio PDF
            </button>
          </div>
        </div>

        {!canShareProfile ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
            Public sharing unlocks only after your profile is complete and your institution has verified your account.
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
                <stat.icon className="h-7 w-7 text-white" />
              </div>
              <div className="mb-2 text-3xl font-bold text-white">{stat.value}</div>
              <div className="text-sm text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-blue-700 bg-gradient-to-br from-blue-900 to-purple-900 p-8 text-center">
            <h2 className="text-lg font-semibold text-blue-200">Innovation Score</h2>
            <div className="relative mx-auto mt-5 h-44 w-44">
              <svg className="h-44 w-44 -rotate-90 transform">
                <circle
                  cx="88"
                  cy="88"
                  r="76"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  className="text-blue-900/50"
                />
                <circle
                  cx="88"
                  cy="88"
                  r="76"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 76}`}
                  strokeDashoffset={`${2 * Math.PI * 76 * (1 - scoreProgress)}`}
                  className={`${
                    innovationScore >= 750
                      ? "text-emerald-400"
                      : innovationScore >= 400
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
            <div className={`mt-5 flex items-center justify-center gap-2 ${weeklyDeltaClass}`}>
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-semibold">{weeklyDeltaLabel}</span>
            </div>
            <p className="mt-3 text-sm text-blue-100">{scoreBand}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.24em] text-blue-200">
              Top {rankPercentile}% of innovators
            </p>
            {score.data?.untrackedPoints ? (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-left">
                <div className="text-xs uppercase tracking-[0.22em] text-blue-200">Historical Score</div>
                <div className="mt-2 text-xl font-semibold text-white">
                  +{score.data.untrackedPoints} pts
                </div>
                <p className="mt-2 text-sm text-blue-100">
                  These points were already on your account before detailed score event tracking was captured.
                </p>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">Score Breakdown</div>
                <h2 className="mt-2 text-2xl font-bold text-white">Where your points come from</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Live score contributions are pulled from the same score engine that awards your points.
                </p>
              </div>
              <div className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                {breakdownDetails.length} tracked signals
              </div>
            </div>

            {breakdownDetails.length > 0 ? (
              <div className="mt-6 grid gap-3">
                {breakdownDetails.map((item) => (
                  <div
                    key={item.trigger}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-semibold text-white">{item.label}</div>
                        <p className="mt-1 text-sm text-slate-400">{item.description}</p>
                        <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                          {item.occurrences} event{item.occurrences === 1 ? "" : "s"}
                          {item.lastAwardedAt
                            ? ` • Last updated ${new Date(item.lastAwardedAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}`
                            : ""}
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="text-2xl font-bold text-white">+{item.totalPoints}</div>
                        <div className="text-xs text-slate-500">
                          {item.repeatable
                            ? `+${item.pointsPerOccurrence} each`
                            : `One-time +${item.pointsPerOccurrence}`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-sm text-slate-400">
                No tracked score events yet. Your first completed score action will start filling this breakdown.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">How To Improve Score</div>
            <h2 className="mt-2 text-2xl font-bold text-white">Next actions that move the needle</h2>
            <p className="mt-2 text-sm text-slate-400">
              These suggestions are ranked from the live scoring rules, not from static UI copy.
            </p>
          </div>

          {improvementTips.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {improvementTips.map((tip) => (
                <div key={tip.trigger} className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${
                        improvementTone[tip.category] ?? improvementTone.consistency
                      }`}
                    >
                      {tip.category.replace(/_/g, " ")}
                    </span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">+{tip.points}</div>
                      <div className="text-xs text-slate-500">points</div>
                    </div>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-white">{tip.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{tip.description}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      {tip.repeatable
                        ? `${tip.currentCount} earned so far`
                        : tip.alreadyClaimed
                          ? "Already claimed"
                          : "Not claimed yet"}
                    </div>
                    {tip.actionPath ? (
                      <Link
                        to={tip.actionPath}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                      >
                        Open
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-sm text-slate-400">
              No improvement suggestions are available yet. Keep interacting with your portfolio and workspace to generate new score paths.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-white">
            <Calendar className="h-6 w-6 text-blue-500" />
            Innovation Timeline
          </h2>
          <div className="space-y-5">
            {(scoreHistory.data ?? []).map((event) => (
              <div key={event._id} className="flex gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                  <TrendingUp className="h-6 w-6 text-blue-500" />
                </div>
                <div className="-ml-6 flex-1 border-l border-slate-800 pb-5 pl-6">
                  <div className="mb-1 text-sm text-slate-500">
                    {new Date(event.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                  <h3 className="mb-1 text-lg font-bold text-white">
                    {eventLabel[event.trigger] ?? event.trigger}
                  </h3>
                  <p className="text-slate-400">
                    Innovation score moved to {event.scoreAfter} with a +{event.delta} update.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-6 text-2xl font-bold text-white">Projects Portfolio</h2>
          {(workspaces.data ?? []).length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {(workspaces.data ?? []).map((project) => (
                <div key={project._id} className="rounded-lg border border-slate-800 bg-slate-950 p-5">
                  <h3 className="mb-2 font-bold text-white">{project.title}</h3>
                  <p className="mb-3 text-sm text-slate-400">
                    {project.category} • {project.stage}
                  </p>
                  <div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                      style={{ width: `${project.progressPercent}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500">{project.progressPercent}% complete</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-sm text-slate-400">
              Your workspace portfolio will appear here once you claim a problem and start building.
            </div>
          )}
        </div>

        {showLaunchModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-2xl font-bold text-white">Launch to Recruiters</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Confirm to make your portfolio visible to recruiters who match your innovation score and activity history.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowLaunchModal(false)}
                  className="rounded-lg bg-slate-800 px-5 py-3 font-semibold text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void launchToRecruiters()}
                  className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 font-semibold text-white"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
