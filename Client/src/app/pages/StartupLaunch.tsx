import { ChangeEvent, useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Download, Rocket, Send, Target, TrendingUp, Upload, Users, X } from "lucide-react";
import { dealApi } from "../../api/deal.api";
import { startupApi, StartupPayload } from "../../api/startup.api";
import { workspaceApi } from "../../api/workspace.api";
import { getStartupSectionPath } from "../../features/startup/navigation";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";

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

const getStartupActionErrorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError<{ error?: { message?: string } }>(error)) {
    return error.response?.data?.error?.message ?? fallback;
  }

  return error instanceof Error ? error.message : fallback;
};

export function StartupLaunch() {
  const maxPitchDeckSizeBytes = 10 * 1024 * 1024;
  const pdfFileNamePattern = /\.pdf$/i;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { startupId: paramId } = useParams<{ startupId: string }>();
  const context = useOutletContext<{ startupId?: string }>();
  const startupId = context?.startupId ?? (paramId === "new" ? undefined : paramId);
  const isNew = !startupId;

  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [launchTarget, setLaunchTarget] = useState<"investors" | "mentors" | "both">("both");
  const [toast, setToast] = useState("");
  const [pendingPitchDeckName, setPendingPitchDeckName] = useState("");
  const [form, setForm] = useState<StartupPayload>(emptyPayload);

  const workspaceQuery = useQuery({ queryKey: ["workspaces"], queryFn: () => workspaceApi.list() });
  const startupQuery = useQuery({
    queryKey: ["startup", startupId],
    queryFn: () => startupApi.getById(startupId!),
    enabled: Boolean(startupId),
  });
  const dealsQuery = useQuery({
    queryKey: ["student", "active-deals"],
    queryFn: dealApi.getMyDeals,
    refetchInterval: 60_000,
  });

  const startup = startupQuery.data;
  const activeWorkspace = workspaceQuery.data?.[0];
  const activeDeals = dealsQuery.data?.items ?? [];
  const teamSize = startup?.teamSize ?? activeWorkspace?.teamMembers?.length ?? activeWorkspace?.teamMemberIds?.length ?? 1;

  useEffect(() => {
    if (!startup) {
      return;
    }

    setForm({
      projectId: startup.projectId,
      name: startup.name,
      tagline: startup.tagline,
      category: startup.category,
      stage: startup.stage,
      fundingNeeded: startup.fundingNeeded,
      activeProducts: startup.activeProducts,
      teamSize: startup.teamSize,
      traction: startup.traction,
    });
  }, [startup]);

  useEffect(() => {
    if (startup) {
      return;
    }

    if (isNew) {
      setForm(emptyPayload);
    }

    setForm((current) => ({
      ...current,
      projectId: current.projectId ?? activeWorkspace?._id,
      teamSize: current.teamSize || teamSize,
    }));
  }, [activeWorkspace?._id, isNew, startup, teamSize]);

  const persistStartup = useMutation({
    mutationFn: async () => {
      if (startup?._id) {
        return startupApi.update(startup._id, form);
      }
      return startupApi.create({
        ...form,
        projectId: form.projectId ?? activeWorkspace?._id,
        teamSize: form.teamSize || teamSize,
      });
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(["startup", saved._id], saved);
      setToast("Startup profile saved.");
      await queryClient.invalidateQueries({ queryKey: ["startup"] });
      if (isNew && saved._id) {
        navigate(`/startup-launch/${saved._id}/overview`, { replace: true });
      }
    },
    onError: (error) => {
      setToast(getStartupActionErrorMessage(error, "Unable to save startup profile right now."));
    },
  });

  const requestReview = useMutation({
    mutationFn: async () => {
      const savedStartup = startup?._id ? startup : await persistStartup.mutateAsync();
      return startupApi.requestReview(savedStartup._id);
    },
    onSuccess: async (saved) => {
      setToast("Startup submitted for admin review.");
      await queryClient.invalidateQueries({ queryKey: ["startup"] });
      if (isNew && saved._id) {
        navigate(`/startup-launch/${saved._id}/overview`, { replace: true });
      }
    },
    onError: (error) => {
      setToast(getStartupActionErrorMessage(error, "Unable to submit startup for admin review."));
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
        queryClient.invalidateQueries({ queryKey: ["startup"] }),
        queryClient.invalidateQueries({ queryKey: ["score", "me"] }),
      ]);
    },
    onError: (error) => {
      setToast(getStartupActionErrorMessage(error, "Unable to launch startup right now."));
    },
  });

  const uploadPitch = useMutation({
    mutationFn: async (file: File) => {
      const savedStartup = startup?._id ? startup : await persistStartup.mutateAsync();
      return startupApi.uploadPitch(savedStartup._id, file);
    },
    onSuccess: async (savedStartup) => {
      setPendingPitchDeckName("");
      queryClient.setQueryData(["startup", savedStartup._id], savedStartup);
      setToast("Pitch deck uploaded.");
      await queryClient.invalidateQueries({ queryKey: ["startup"] });
    },
    onError: (error) => {
      setPendingPitchDeckName("");
      if (isAxiosError<{ error?: { message?: string } }>(error)) {
        setToast(error.response?.data?.error?.message ?? "Failed to upload pitch deck PDF. Please try again.");
        return;
      }
      setToast("Failed to upload pitch deck PDF. Please try again.");
    },
  });

  const handlePitchDeckSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (file.type !== "application/pdf" && !pdfFileNamePattern.test(file.name)) {
      setPendingPitchDeckName("");
      setToast("Only PDF files are allowed for the pitch deck.");
      return;
    }

    if (file.size > maxPitchDeckSizeBytes) {
      setPendingPitchDeckName("");
      setToast("Pitch deck PDF must be 10MB or smaller.");
      return;
    }

    setPendingPitchDeckName(file.name);
    uploadPitch.mutate(file);
  };

  const currentStartupId = startup?._id ?? startupId;
  const formTeamSize = startup ? form.teamSize : form.teamSize || teamSize;
  const canLaunch = Boolean(form.name.trim() && form.tagline.trim() && form.category.trim() && formTeamSize > 0);
  const reviewStatus = startup?.reviewStatus ?? "draft";
  const isApproved = reviewStatus === "approved";
  const isUnderReview = reviewStatus === "review_requested";
  const hasChangesRequested = reviewStatus === "changes_requested";
  const reviewTone =
    reviewStatus === "approved"
      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-200"
      : reviewStatus === "review_requested"
        ? "bg-amber-500/10 border-amber-500/20 text-amber-200"
        : reviewStatus === "changes_requested"
          ? "bg-rose-500/10 border-rose-500/20 text-rose-200"
          : "bg-slate-900 border-slate-800 text-slate-300";
  const reviewTitle =
    reviewStatus === "approved"
      ? "Admin review approved"
      : reviewStatus === "review_requested"
        ? "Awaiting admin review"
        : reviewStatus === "changes_requested"
          ? "Changes requested by admin"
          : "Draft startup profile";
  const reviewDescription =
    reviewStatus === "approved"
      ? "This startup is cleared for marketplace launch. Investors can discover it after you launch to investors."
      : reviewStatus === "review_requested"
        ? "The admin team is reviewing this startup profile before it goes live in the marketplace."
        : reviewStatus === "changes_requested"
          ? "Update the startup profile based on admin notes and submit it again for review."
          : "Complete the launch form and submit it for admin review before publishing it to investors or mentors.";

  if (!isNew && startupQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!isNew && startupQuery.isError) {
    return (
      <Card className="max-w-3xl p-8 text-sm text-red-200">
        {getStartupActionErrorMessage(startupQuery.error, "Unable to load this startup right now.")}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">{isNew ? "Create New Startup" : "Startup Launch Engine"}</h1>
            <p className="text-slate-400">{isNew ? "Fill in the details to create your startup" : "Transform your innovation into a startup"}</p>
          </div>
          <div className="flex gap-3">
            {!isNew ? (
              <button
                onClick={() => navigate(getStartupSectionPath(currentStartupId!, "investor-outreach"))}
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Investor Outreach
              </button>
            ) : null}
            <button onClick={() => persistStartup.mutate()} className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold">
              {isNew ? "Create Startup" : "Save Profile"}
            </button>
            {!isNew ? (
              <>
                <button
                  onClick={() => requestReview.mutate()}
                  disabled={!canLaunch || isUnderReview || requestReview.isPending || launchStartup.isPending}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {requestReview.isPending ? "Submitting..." : isApproved ? "Approved" : isUnderReview ? "Under Review" : "Submit for Review"}
                </button>
                <button onClick={() => setShowLaunchModal(true)} disabled={!canLaunch || !isApproved} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50">
                  <Rocket className="w-5 h-5" />
                  Launch
                </button>
              </>
            ) : null}
          </div>
        </div>

        {toast ? <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300 text-sm">{toast}</div> : null}

        <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-800/50 rounded-xl p-8">
          <div className="flex items-start gap-6 mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center">
              <Rocket className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-white mb-2">{form.name || "Your Startup"}</h2>
              <p className="text-xl text-blue-200 mb-4">{form.tagline || "Build your launch profile"}</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full">{form.category || "Category pending"}</span>
                <span className="text-slate-300">Stage: {form.stage}</span>
                <span className="text-slate-300">Team size: {formTeamSize}</span>
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-4 gap-6 pt-6 border-t border-blue-800/30">
            <div className="text-center"><Users className="w-8 h-8 text-blue-400 mx-auto mb-2" /><div className="text-2xl font-bold text-white mb-1">{formTeamSize}</div><div className="text-sm text-slate-400">Team Members</div></div>
            <div className="text-center"><TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-2" /><div className="text-2xl font-bold text-white mb-1">{startup?.innovationScoreAtLaunch ?? 0}</div><div className="text-sm text-slate-400">Launch Score Snapshot</div></div>
            <div className="text-center"><Target className="w-8 h-8 text-purple-400 mx-auto mb-2" /><div className="text-2xl font-bold text-white mb-1">{startup?.activeProducts ?? form.activeProducts}</div><div className="text-sm text-slate-400">Active Products</div></div>
            <div className="text-center"><CheckCircle className="w-8 h-8 text-yellow-400 mx-auto mb-2" /><div className="text-2xl font-bold text-white mb-1">{startup?.launchedAt ? "Live" : "Draft"}</div><div className="text-sm text-slate-400">Status</div></div>
          </div>
        </div>

        {!isNew ? (
          <div className={`border rounded-xl p-5 ${reviewTone}`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] mb-2">Marketplace Review</div>
                <h2 className="text-xl font-bold text-white">{reviewTitle}</h2>
                <p className="mt-2 text-sm leading-6">{reviewDescription}</p>
                {startup?.adminNotes ? (
                  <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
                    Admin notes: {startup.adminNotes}
                  </div>
                ) : null}
              </div>
              <div className="text-sm text-slate-300 lg:text-right">
                <div>Submitted: {startup?.reviewRequestedAt ? new Date(startup.reviewRequestedAt).toLocaleString("en-IN") : "Not submitted"}</div>
                <div className="mt-1">Reviewed: {startup?.adminReviewedAt ? new Date(startup.adminReviewedAt).toLocaleString("en-IN") : "Pending"}</div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Startup name</label>
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Tagline</label>
                <input value={form.tagline} onChange={(event) => setForm((current) => ({ ...current, tagline: event.target.value }))} className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Category</label>
                <input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="e.g. FinTech, Healthcare, EdTech, Food, Fashion..." className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Stage</label>
                <select value={form.stage} onChange={(event) => setForm((current) => ({ ...current, stage: event.target.value as StartupPayload["stage"] }))} className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white">
                  <option>Pre-Idea</option>
                  <option>Ideation</option>
                  <option>MVP</option>
                  <option>Pre-Launch</option>
                  <option>Launched</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Funding needed (INR)</label>
                <input type="number" value={form.fundingNeeded ?? ""} onChange={(event) => setForm((current) => ({ ...current, fundingNeeded: event.target.value ? Number(event.target.value) : undefined }))} className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Active products</label>
                <input type="number" value={form.activeProducts} onChange={(event) => setForm((current) => ({ ...current, activeProducts: Number(event.target.value) || 1 }))} className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white" />
              </div>
            </div>

            {!isNew ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Pitch Deck</h2>
                  {startup?.pitchDeckUrl ? <a href={startup.pitchDeckUrl} target="_blank" rel="noreferrer" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2"><Download className="w-4 h-4" />Open PDF</a> : null}
                </div>
                <label className="flex items-center gap-3 px-4 py-4 bg-slate-950 border border-slate-800 rounded-lg text-white cursor-pointer">
                  <Upload className="w-5 h-5 text-blue-400" />
                  {uploadPitch.isPending ? "Uploading pitch deck PDF..." : "Upload pitch deck PDF"}
                  <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={handlePitchDeckSelect} />
                </label>
                <div className="mt-3 text-sm text-slate-400">
                  {uploadPitch.isPending
                    ? `Uploading: ${pendingPitchDeckName || "selected PDF"}`
                    : startup?.pitchDeckName
                      ? `Uploaded file: ${startup.pitchDeckName}`
                      : "No PDF uploaded yet."}
                </div>
              </div>
            ) : null}

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
                      checked={form.traction[item.key as keyof StartupPayload["traction"]] as boolean}
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
                {isNew ? (
                  <li>Save the startup first, then submit for admin review</li>
                ) : (
                  <li>{isApproved ? "Admin review approved for marketplace launch" : isUnderReview ? "Admin review is in progress" : hasChangesRequested ? "Admin requested changes before launch" : "Submit the startup to admin review before marketplace launch"}</li>
                )}
                <li>Pitch deck upload is optional but recommended</li>
                <li>Investor Outreach lets you shortlist investors and send pitch requests for this startup directly</li>
                <li>Launch to recruiters is available from Leadership Profile too</li>
              </ul>
            </div>

            {!isNew ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white">Active Investor Deals</h3>
                  <span className="text-sm text-slate-400">{activeDeals.length} active deals</span>
                </div>
                {dealsQuery.isLoading ? (
                  <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950 p-6 text-center text-slate-400">
                    Loading deal flow...
                  </div>
                ) : activeDeals.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950 p-6 text-center text-slate-400">
                    No investor deals yet. Launch your startup to investors from this page to begin deal flow.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {activeDeals.map((deal, index) => (
                      <div key={deal._id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-white">
                              {deal.currentStage < 2 ? `Investor #${index + 1}` : deal.investorDisplayName}
                            </div>
                            <div className="text-sm text-slate-400">{deal.startupName}</div>
                          </div>
                          <span className="rounded bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-400">
                            Stage {deal.currentStage}
                          </span>
                        </div>
                        <div className="mt-3 text-sm text-slate-300">{deal.nextActionLabel}</div>
                        <div className="mt-2 text-xs text-slate-500">
                          {deal.currentStage === 1
                            ? "Due diligence in progress"
                            : deal.currentStage === 2
                              ? "Fund transfer in progress"
                              : deal.currentStage === 3
                                ? "Awaiting equity verification by admin"
                                : "Deal closed - check your portfolio!"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {showLaunchModal ? (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Launch Your Startup To:</h2>
                <button onClick={() => setShowLaunchModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="mb-5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                Approved startups launched to investors will appear in the investor marketplace. You can then continue outreach for this startup from Investor Outreach.
              </div>
              <div className="space-y-3 mb-6">
                {[
                  ["investors", "Launch to Investors"],
                  ["mentors", "Launch to Mentors"],
                  ["both", "Launch to Both (Recommended)"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLaunchTarget(value as "investors" | "mentors" | "both")}
                    className={`w-full text-left px-5 py-4 rounded-xl text-white transition ${
                      launchTarget === value
                        ? "border border-blue-500/50 bg-blue-500/10"
                        : "border border-slate-800 bg-slate-950 hover:border-blue-500/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowLaunchModal(false)} className="px-5 py-3 bg-slate-800 text-white rounded-lg font-semibold">Cancel</button>
                <button
                  onClick={() => launchStartup.mutate(launchTarget)}
                  disabled={launchStartup.isPending}
                  className="px-5 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold disabled:opacity-60"
                >
                  {launchStartup.isPending ? "Launching..." : "Launch Now"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
    </div>
  );
}
