import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Download, Rocket, Target, TrendingUp, Upload, Users, X } from "lucide-react";
import { DashboardLayout } from "../components/DashboardLayout";
import { startupApi, StartupPayload } from "../../api/startup.api";
import { workspaceApi } from "../../api/workspace.api";

const emptyPayload: StartupPayload = {
  name: "",
  tagline: "",
  category: "",
  stage: "Pre-Idea",
  activeProducts: 1,
  teamSize: 1,
  traction: {
    patentFiled: false,
    mvpBuilt: false,
    revenueGenerating: false,
  },
};

export function StartupLaunch() {
  const queryClient = useQueryClient();
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [toast, setToast] = useState("");
  const [form, setForm] = useState<StartupPayload>(emptyPayload);

  const workspaceQuery = useQuery({ queryKey: ["workspaces"], queryFn: () => workspaceApi.list() });
  const startupQuery = useQuery({ queryKey: ["startup", "mine"], queryFn: () => startupApi.mine() });

  const startup = startupQuery.data;
  const activeWorkspace = workspaceQuery.data?.[0];
  const teamSize = activeWorkspace?.teamMembers?.length ?? activeWorkspace?.teamMemberIds.length ?? 1;

  const hydratedForm = useMemo(
    () =>
      startup
        ? {
            projectId: startup.projectId,
            name: startup.name,
            tagline: startup.tagline,
            category: startup.category,
            stage: startup.stage,
            fundingNeeded: startup.fundingNeeded,
            activeProducts: startup.activeProducts,
            teamSize: startup.teamSize,
            traction: startup.traction,
          }
        : { ...form, projectId: activeWorkspace?._id, teamSize },
    [activeWorkspace?._id, form, startup, teamSize],
  );

  const persistStartup = useMutation({
    mutationFn: async () => {
      if (startup?._id) {
        return startupApi.update(startup._id, hydratedForm);
      }
      return startupApi.create(hydratedForm);
    },
    onSuccess: async () => {
      setToast("Startup profile saved.");
      await queryClient.invalidateQueries({ queryKey: ["startup", "mine"] });
    },
  });

  const launchStartup = useMutation({
    mutationFn: async (launchTo: "investors" | "mentors" | "both" | "recruiters") => {
      const savedStartup = startup?._id ? startup : await persistStartup.mutateAsync();
      return startupApi.launch(savedStartup._id, launchTo);
    },
    onSuccess: async (_value, launchTo) => {
      setShowLaunchModal(false);
      setToast(launchTo === "recruiters" ? "Your profile is now visible to recruiters matching your skill set." : "Your startup is now live! Investors and mentors can discover you.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["startup", "mine"] }),
        queryClient.invalidateQueries({ queryKey: ["score", "me"] }),
      ]);
    },
  });

  const uploadPitch = useMutation({
    mutationFn: async (file: File) => {
      const savedStartup = startup?._id ? startup : await persistStartup.mutateAsync();
      return startupApi.uploadPitch(savedStartup._id, file);
    },
    onSuccess: async () => {
      setToast("Pitch deck uploaded.");
      await queryClient.invalidateQueries({ queryKey: ["startup", "mine"] });
    },
  });

  const canLaunch = Boolean(hydratedForm.name.trim() && hydratedForm.tagline.trim() && hydratedForm.category.trim() && teamSize > 0);

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Startup Launch Engine</h1>
            <p className="text-slate-400">Transform your innovation into a startup</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => persistStartup.mutate()} className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold">
              Save Profile
            </button>
            <button onClick={() => setShowLaunchModal(true)} disabled={!canLaunch} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50">
              <Rocket className="w-5 h-5" />
              Launch
            </button>
          </div>
        </div>

        {toast ? <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300 text-sm">{toast}</div> : null}

        <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-800/50 rounded-xl p-8">
          <div className="flex items-start gap-6 mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center">
              <Rocket className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-white mb-2">{startup?.name || hydratedForm.name || "Your Startup"}</h2>
              <p className="text-xl text-blue-200 mb-4">{startup?.tagline || hydratedForm.tagline || "Build your launch profile"}</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full">{startup?.category || hydratedForm.category || "Category pending"}</span>
                <span className="text-slate-300">Stage: {startup?.stage || hydratedForm.stage}</span>
                <span className="text-slate-300">Team size: {teamSize}</span>
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-4 gap-6 pt-6 border-t border-blue-800/30">
            <div className="text-center"><Users className="w-8 h-8 text-blue-400 mx-auto mb-2" /><div className="text-2xl font-bold text-white mb-1">{teamSize}</div><div className="text-sm text-slate-400">Team Members</div></div>
            <div className="text-center"><TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-2" /><div className="text-2xl font-bold text-white mb-1">{startup?.innovationScoreAtLaunch ?? 0}</div><div className="text-sm text-slate-400">Launch Score Snapshot</div></div>
            <div className="text-center"><Target className="w-8 h-8 text-purple-400 mx-auto mb-2" /><div className="text-2xl font-bold text-white mb-1">{startup?.activeProducts ?? hydratedForm.activeProducts}</div><div className="text-sm text-slate-400">Active Products</div></div>
            <div className="text-center"><CheckCircle className="w-8 h-8 text-yellow-400 mx-auto mb-2" /><div className="text-2xl font-bold text-white mb-1">{startup?.launchedAt ? "Live" : "Draft"}</div><div className="text-sm text-slate-400">Status</div></div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Startup name</label>
                <input value={hydratedForm.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Tagline</label>
                <input value={hydratedForm.tagline} onChange={(event) => setForm((current) => ({ ...current, tagline: event.target.value }))} className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Category</label>
                <input value={hydratedForm.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Stage</label>
                <select value={hydratedForm.stage} onChange={(event) => setForm((current) => ({ ...current, stage: event.target.value as StartupPayload["stage"] }))} className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white">
                  <option>Pre-Idea</option>
                  <option>Ideation</option>
                  <option>MVP</option>
                  <option>Pre-Launch</option>
                  <option>Launched</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Funding needed (INR)</label>
                <input type="number" value={hydratedForm.fundingNeeded ?? ""} onChange={(event) => setForm((current) => ({ ...current, fundingNeeded: event.target.value ? Number(event.target.value) : undefined }))} className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Active products</label>
                <input type="number" value={hydratedForm.activeProducts} onChange={(event) => setForm((current) => ({ ...current, activeProducts: Number(event.target.value) || 1 }))} className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Pitch Deck</h2>
                {startup?.pitchDeckUrl ? <a href={startup.pitchDeckUrl} target="_blank" rel="noreferrer" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2"><Download className="w-4 h-4" />Open PDF</a> : null}
              </div>
              <label className="flex items-center gap-3 px-4 py-4 bg-slate-950 border border-slate-800 rounded-lg text-white cursor-pointer">
                <Upload className="w-5 h-5 text-blue-400" />
                Upload pitch deck PDF
                <input type="file" accept=".pdf" className="hidden" onChange={(event) => event.target.files?.[0] ? uploadPitch.mutate(event.target.files[0]) : undefined} />
              </label>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Traction Indicators</h2>
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  { key: "patentFiled", label: "Patent Filed" },
                  { key: "mvpBuilt", label: "MVP Built" },
                  { key: "revenueGenerating", label: "Revenue Generating" },
                ].map((item) => (
                  <label key={item.key} className="flex items-center gap-3 px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white">
                    <input
                      type="checkbox"
                      checked={hydratedForm.traction[item.key as keyof StartupPayload["traction"]] as boolean}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          traction: { ...current.traction, [item.key]: event.target.checked },
                        }))
                      }
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="font-bold text-white mb-4">Founder Team</h3>
              <div className="space-y-3">
                {(activeWorkspace?.teamMembers ?? []).map((member) => (
                  <div key={member._id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                      {member.avatar ? <img src={member.avatar} alt={member.displayName} className="w-10 h-10 rounded-full object-cover" /> : member.displayName.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{member.displayName}</div>
                      <div className="text-sm text-slate-400">{member.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-800/30 rounded-xl p-6">
              <h3 className="font-bold text-white mb-2">Launch checklist</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>{canLaunch ? "Ready to launch" : "Name, tagline, category, and at least one founder are required"}</li>
                <li>Pitch deck upload is optional but recommended</li>
                <li>Launch to recruiters is available from Leadership Profile too</li>
              </ul>
            </div>
          </div>
        </div>

        {showLaunchModal ? (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Launch Your Startup To:</h2>
                <button onClick={() => setShowLaunchModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3 mb-6">
                {[
                  ["investors", "Launch to Investors"],
                  ["mentors", "Launch to Mentors"],
                  ["both", "Launch to Both (Recommended)"],
                ].map(([value, label]) => (
                  <button key={value} onClick={() => launchStartup.mutate(value as "investors" | "mentors" | "both")} className="w-full text-left px-5 py-4 bg-slate-950 border border-slate-800 rounded-xl text-white hover:border-blue-500/40">
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex justify-end"><button onClick={() => setShowLaunchModal(false)} className="px-5 py-3 bg-slate-800 text-white rounded-lg font-semibold">Cancel</button></div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
