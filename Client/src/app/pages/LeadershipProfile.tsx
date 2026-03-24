import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Calendar, Download, Rocket, Share2, Star, Target, TrendingUp } from "lucide-react";
import { jsPDF } from "jspdf";
import { DashboardLayout } from "../components/DashboardLayout";
import { scoreApi } from "../../api/score.api";
import { startupApi } from "../../api/startup.api";
import { workspaceApi } from "../../api/workspace.api";
import { useAuthStore } from "../../store/authStore";
import { useInnovationScore } from "../../hooks/useInnovationScore";

const eventLabel: Record<string, string> = {
  PROBLEM_CLAIMED: "Claimed a new problem",
  PROGRESS_UPLOADED: "Uploaded workspace progress",
  PATENT_SUBMITTED: "Patent filed",
  STARTUP_LAUNCHED: "Startup launched",
};

export function LeadershipProfile() {
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const [toast, setToast] = useState("");
  const score = useInnovationScore();
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: () => workspaceApi.list() });
  const scoreHistory = useQuery({
    queryKey: ["score", "history", authUser?._id],
    queryFn: () => scoreApi.getScoreHistory(authUser!._id),
    enabled: Boolean(authUser?._id),
  });
  const startup = useQuery({ queryKey: ["startup", "mine"], queryFn: () => startupApi.mine() });

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
      const profile = startup.data ?? (await startupApi.create({
        projectId: workspaces.data?.[0]?._id,
        name: workspaces.data?.[0]?.title ?? "Student Innovation Profile",
        tagline: "Leadership profile launch",
        category: workspaces.data?.[0]?.category ?? "Innovation",
        stage: "Pre-Launch",
        activeProducts: 1,
        teamSize: workspaces.data?.[0]?.teamMembers?.length ?? 1,
        traction: { patentFiled: false, mvpBuilt: false, revenueGenerating: false },
      }));
      await startupApi.launch(profile._id, "recruiters");
      setToast("Your profile is now visible to recruiters matching your skill set.");
      await queryClient.invalidateQueries({ queryKey: ["startup", "mine"] });
    } catch (error) {
      setToast((error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? "Unable to launch your profile to recruiters.");
    }
  };

  const downloadPdf = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(18);
    pdf.text(authUser?.displayName ?? "Leadership Profile", 14, 20);
    pdf.setFontSize(12);
    pdf.text(`Innovation Score: ${score.data?.score ?? 0}`, 14, 30);
    pdf.text(`Role: ${authUser?.role ?? "student"}`, 14, 38);
    pdf.text("Recent timeline", 14, 50);
    (scoreHistory.data ?? []).slice(0, 8).forEach((event, index) => {
      pdf.text(`${index + 1}. ${eventLabel[event.trigger] ?? event.trigger} (+${event.delta})`, 14, 60 + index * 8);
    });
    pdf.save("promove-leadership-profile.pdf");
  };

  return (
    <DashboardLayout role="student">
      <div className="space-y-8">
        {toast ? <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300 text-sm">{toast}</div> : null}

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-4xl text-white font-bold">
              {authUser?.displayName?.slice(0, 1).toUpperCase() ?? "S"}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{authUser?.displayName ?? "Student Innovator"}</h1>
              <p className="text-slate-400 mb-3 capitalize">{authUser?.role ?? "student"} • ProMove Innovation Cloud</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-500" />
                  <span className="text-white font-bold text-xl">Innovation Score: {score.data?.score ?? 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, index) => (
                    <Star key={index} className={`w-4 h-4 ${index < Math.max(1, Math.round((score.data?.score ?? 0) / 50)) ? "text-yellow-500 fill-yellow-500" : "text-slate-600"}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={launchToRecruiters} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              Launch to Recruiters
            </button>
            <button onClick={downloadPdf} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold transition-all flex items-center gap-2">
              <Download className="w-5 h-5" />
              Download PDF
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-5 gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <stat.icon className="w-7 h-7 text-white" />
              </div>
              <div className="text-3xl font-bold text-white mb-2">{stat.value}</div>
              <div className="text-sm text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-500" />
            Innovation Timeline
          </h2>
          <div className="space-y-5">
            {(scoreHistory.data ?? []).map((event) => (
              <div key={event._id} className="flex gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-blue-500/10">
                  <TrendingUp className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1 pb-5 border-l border-slate-800 pl-6 -ml-6">
                  <div className="text-sm text-slate-500 mb-1">{new Date(event.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                  <h3 className="text-lg font-bold text-white mb-1">{eventLabel[event.trigger] ?? event.trigger}</h3>
                  <p className="text-slate-400">Innovation score moved to {event.scoreAfter} with a +{event.delta} update.</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white mb-6">Projects Portfolio</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {(workspaces.data ?? []).map((project) => (
              <div key={project._id} className="bg-slate-950 border border-slate-800 rounded-lg p-5">
                <h3 className="font-bold text-white mb-2">{project.title}</h3>
                <p className="text-sm text-slate-400 mb-3">{project.category} • {project.stage}</p>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: `${project.progressPercent}%` }} />
                </div>
                <div className="text-xs text-slate-500">{project.progressPercent}% complete</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
