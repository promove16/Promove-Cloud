import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Lightbulb, Target, Rocket, Award, TrendingUp, Calendar, Clock, CheckCircle2, Briefcase } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { workspaceApi } from "../../../api/workspace.api";
import { useInnovationScore } from "../../../hooks/useInnovationScore";
import { useAuthStore } from "../../../store/authStore";
import { Workspace } from "../../../types/workspace.types";

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

  if (currentIndex === -1) {
    return "upcoming";
  }
  if (stageIndex < currentIndex) {
    return "completed";
  }
  if (stageIndex === currentIndex) {
    return "active";
  }
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

  const workspaces = workspaceQuery.data ?? [];
  const activeWorkspace = workspaces[0];

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
        value: String(scoreQuery.data?.score ?? authUser?.innovationScore ?? 0),
        helper: `Top ${scoreQuery.data?.rankPercentile ?? 100}%`,
      },
      {
        label: "Problems Claimed",
        value: String(scoreQuery.data?.breakdown.problemsClaimed ?? 0),
        helper: "Validated from score breakdown",
      },
      {
        label: "Progress Uploads",
        value: String(scoreQuery.data?.breakdown.progressUploads ?? 0),
        helper: `${scoreQuery.data?.weeklyDelta ?? 0} points this week`,
      },
      {
        label: "Startups Launched",
        value: String(scoreQuery.data?.breakdown.startupsLaunched ?? 0),
        helper: "Launch engine connected",
      },
    ],
    [authUser?.innovationScore, scoreQuery.data],
  );

  const mentorSessions = [
    { mentor: "ProMove Mentor Desk", topic: "Workspace review support", date: activeWorkspace?.updatedAt, time: "Next available slot", type: "Support" },
    { mentor: "Patent Guidance Team", topic: "Patent filing readiness", date: activeWorkspace?.progressUpdates[0]?.submittedAt, time: "On request", type: "IPR" },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2">
          Welcome back, {user?.name || "Innovator"}! 🚀
        </h1>
        <p className="text-slate-400 text-lg">Keep building amazing things</p>
      </div>

      <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-800/30 rounded-2xl p-8">
        <h2 className="text-xl font-bold text-white mb-6 text-center">Your Innovation Journey</h2>
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {stages.map((stage, index) => {
            const status = getStageStatus(activeWorkspace?.stage, stage.id);
            return (
              <div key={stage.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-all ${
                      status === "completed"
                        ? "bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/50"
                        : status === "active"
                          ? "bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg shadow-blue-500/50 animate-pulse"
                          : "bg-slate-800 border-2 border-slate-700"
                    }`}
                  >
                    {status === "completed" ? (
                      <CheckCircle2 className="w-8 h-8 text-white" />
                    ) : (
                      <stage.icon className={`w-8 h-8 ${status === "active" ? "text-white" : "text-slate-500"}`} />
                    )}
                  </div>
                  <span className={`text-sm font-semibold ${status === "upcoming" ? "text-slate-500" : "text-white"}`}>
                    {stage.name}
                  </span>
                </div>

                {index < stages.length - 1 ? (
                  <div
                    className={`w-24 h-1 mx-2 ${
                      status === "completed" ? "bg-gradient-to-r from-green-500 to-emerald-500" : "bg-slate-800"
                    }`}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
            <div className="text-sm text-slate-400 mb-2">{stat.label}</div>
            <div className="text-xs text-blue-300">{stat.helper}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-900 to-purple-900 border border-blue-700 rounded-2xl p-8 text-center">
          <h3 className="text-lg font-semibold text-blue-200 mb-4">Innovation Score</h3>
          <div className="relative w-40 h-40 mx-auto mb-4">
            <svg className="transform -rotate-90 w-40 h-40">
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
                strokeDashoffset={`${2 * Math.PI * 70 * (1 - (scoreQuery.data?.score ?? 0) / 200)}`}
                className={`${
                  (scoreQuery.data?.score ?? 0) > 150
                    ? "text-green-400"
                    : (scoreQuery.data?.score ?? 0) >= 80
                      ? "text-blue-300"
                      : "text-amber-400"
                }`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div>
                <div className="text-5xl font-bold text-white">{scoreQuery.data?.score ?? 0}</div>
                <div className="text-sm text-blue-200">of 200</div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 text-green-400">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-semibold">+{scoreQuery.data?.weeklyDelta ?? 0} this week</span>
          </div>
          <p className="text-xs text-blue-200 mt-3">Top {scoreQuery.data?.rankPercentile ?? 100}% of innovators</p>
        </div>

        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Active Project</h3>
            <Link to={activeWorkspace ? `/product-workspace/${activeWorkspace._id}` : "/problem-bank"} className="text-blue-400 hover:text-blue-300 text-sm font-semibold">
              {activeWorkspace ? "View Details →" : "Browse Problems →"}
            </Link>
          </div>
          {activeWorkspace ? (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4 gap-4">
                <div>
                  <h4 className="text-2xl font-bold text-white mb-2">{activeWorkspace.title}</h4>
                  <p className="text-slate-400 mb-3">
                    {activeWorkspace.category} workspace in the {activeWorkspace.stage} stage
                  </p>
                  <div className="flex items-center gap-4">
                    <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-sm font-semibold">
                      {activeWorkspace.stage}
                    </span>
                    <span className="flex items-center gap-1 text-slate-400 text-sm">
                      <Clock className="w-4 h-4" />
                      Updated {formatDate(activeWorkspace.updatedAt)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-white mb-1">{activeWorkspace.progressPercent}%</div>
                  <div className="text-sm text-slate-400">Complete</div>
                </div>
              </div>

              <div className="mb-4">
                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all" style={{ width: `${activeWorkspace.progressPercent}%` }} />
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-900 rounded-lg border border-slate-800">
                <Target className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div>
                  <div className="text-xs text-slate-500 mb-1">Next Milestone</div>
                  <div className="text-sm font-semibold text-white">
                    {activeWorkspace.milestones.find((milestone) => !milestone.isCompleted)?.name ?? "Ready to launch"}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950 border border-dashed border-slate-700 rounded-xl p-8 text-center">
              <Briefcase className="w-10 h-10 text-slate-500 mx-auto mb-4" />
              <h4 className="text-xl font-bold text-white mb-2">No active workspace yet</h4>
              <p className="text-slate-400 mb-4">Claim a problem to create your first student workspace.</p>
              <Link to="/problem-bank" className="inline-flex px-5 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold">
                Explore Problem Bank
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Your Portfolio</h3>
          <Link to="/leadership-profile" className="text-blue-400 hover:text-blue-300 text-sm font-semibold">
            View Leadership Profile →
          </Link>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {workspaces.length > 0 ? (
            workspaces.map((project) => (
              <div key={project._id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-blue-500/50 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                      {project.title}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300">{project.category}</span>
                      <span className="px-2 py-1 bg-blue-500/10 rounded text-xs font-semibold text-blue-400">
                        {project.stage}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Progress</span>
                    <span>{project.progressPercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: `${project.progressPercent}%` }} />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="md:col-span-2 text-center py-8 text-slate-400">Your workspace portfolio will appear here once you claim a problem.</div>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6">Upcoming Mentor Sessions</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {mentorSessions.map((session, index) => (
            <div key={index} className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-purple-500/50 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">
                    {session.mentor
                      .split(" ")
                      .map((part) => part[0])
                      .join("")}
                  </span>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-white mb-1">{session.mentor}</h4>
                  <p className="text-sm text-slate-400 mb-3">{session.topic}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(session.date)}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {session.time}
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="px-2 py-1 bg-purple-500/10 text-purple-400 rounded text-xs font-semibold">
                      {session.type}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
