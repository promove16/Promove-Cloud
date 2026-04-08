import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Download, FileText, Rocket, Send, ShieldCheck, Target, TrendingUp, Upload, Users, X } from "lucide-react";
import { dealApi } from "../../api/deal.api";
import { startupApi, StartupPayload } from "../../api/startup.api";
import { workspaceApi } from "../../api/workspace.api";
import {
  DEFAULT_STARTUP_IPR_PROFILE,
  STARTUP_IPR_QUESTION_SECTIONS,
  STARTUP_IPR_UPLOAD_MAX_BYTES,
  STARTUP_IPR_DOCUMENT_SPECS,
  buildStartupReviewReadiness,
  formatStartupIprValue,
  getRequiredStartupDocumentCategories,
} from "../../features/startup/iprIntake";
import { getStartupSectionPath, normalizeStartupRouteId } from "../../features/startup/navigation";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import type { StartupDocumentCategory, StartupRegistrationProfile } from "../../types/startup.types";

const createEmptyPayload = (): StartupPayload => ({
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

const getStartupActionErrorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError<{ error?: { message?: string } }>(error)) {
    return error.response?.data?.error?.message ?? fallback;
  }

  return error instanceof Error ? error.message : fallback;
};

const formatReadinessActionMessage = (missingItems: string[]) => {
  if (missingItems.length === 0) {
    return "Startup profile is incomplete for review.";
  }

  const topItems = missingItems.slice(0, 5).join(", ");
  return missingItems.length > 5
    ? `Complete before review: ${topItems}, and ${missingItems.length - 5} more.`
    : `Complete before review: ${topItems}.`;
};

type WorkflowStepStatus = "complete" | "current" | "blocked" | "optional";

const workflowStatusClassName: Record<WorkflowStepStatus, string> = {
  complete: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  current: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
  blocked: "border-slate-800 bg-slate-950/70 text-slate-400",
  optional: "border-amber-500/30 bg-amber-500/10 text-amber-100",
};

const workflowStatusLabel: Record<WorkflowStepStatus, string> = {
  complete: "Complete",
  current: "Next",
  blocked: "Blocked",
  optional: "Optional",
};

const hasIprIntakeDraft = (registrationProfile: StartupRegistrationProfile) =>
  STARTUP_IPR_QUESTION_SECTIONS.some((section) =>
    section.questions.some((question) => {
      if (question.type === "select") {
        return false;
      }

      return String(registrationProfile[question.key] ?? "").trim().length > 0;
    }),
  );

export function StartupLaunch() {
  const maxPitchDeckSizeBytes = 10 * 1024 * 1024;
  const maxIprUploadSizeBytes = STARTUP_IPR_UPLOAD_MAX_BYTES;
  const pdfFileNamePattern = /\.pdf$/i;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { startupId: paramId } = useParams<{ startupId: string }>();
  const context = useOutletContext<{ startupId?: string }>();
  const startupId = context?.startupId ?? normalizeStartupRouteId(paramId);
  const isNew = !startupId;

  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [launchTarget, setLaunchTarget] = useState<"investors" | "mentors" | "both" | "recruiters">("both");
  const [toast, setToast] = useState("");
  const [pendingPitchDeckName, setPendingPitchDeckName] = useState("");
  const [pendingDocumentCategory, setPendingDocumentCategory] = useState<StartupDocumentCategory | null>(null);
  const [form, setForm] = useState<StartupPayload>(() => createEmptyPayload());
  const [isIprIntakeOpen, setIsIprIntakeOpen] = useState(true);

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
  const workspaces = workspaceQuery.data ?? [];
  const selectedWorkspaceId = startup?.projectId ?? form.projectId ?? "";
  const activeWorkspace = workspaces.find((workspace) => workspace._id === selectedWorkspaceId) ?? null;
  const workspaceTeamSize =
    activeWorkspace?.teamMembers?.length ??
    activeWorkspace?.teamMemberIds?.length ??
    0;

  useEffect(() => {
    if (!startup) {
      return;
    }

    const defaultPayload = createEmptyPayload();

    setForm({
      ...defaultPayload,
      projectId: startup.projectId,
      name: startup.name ?? defaultPayload.name,
      tagline: startup.tagline ?? defaultPayload.tagline,
      category: startup.category ?? defaultPayload.category,
      stage: startup.stage ?? defaultPayload.stage,
      fundingNeeded: startup.fundingNeeded,
      activeProducts: startup.activeProducts ?? defaultPayload.activeProducts,
      teamSize: startup.teamSize ?? defaultPayload.teamSize,
      traction: {
        ...defaultPayload.traction,
        ...(startup.traction ?? {}),
      },
      businessProfile: {
        ...defaultPayload.businessProfile,
        ...(startup.businessProfile ?? {}),
      },
      registrationProfile: {
        ...defaultPayload.registrationProfile,
        ...(startup.registrationProfile ?? {}),
      },
    });
    setIsIprIntakeOpen(!hasIprIntakeDraft(startup.registrationProfile ?? defaultPayload.registrationProfile));
  }, [startup]);

  const persistStartup = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        projectId: selectedWorkspaceId || undefined,
        teamSize: workspaceTeamSize || form.teamSize || startup?.teamSize || 1,
      };

      if (startup?._id) {
        return startupApi.update(startup._id, payload);
      }
      return startupApi.create(payload);
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(["startup", saved._id], saved);
      setIsIprIntakeOpen(!hasIprIntakeDraft(saved.registrationProfile));
      setToast("Startup draft saved. Submit it for admin review when ready.");
      await queryClient.invalidateQueries({ queryKey: ["startup"] });
      if (isNew && saved._id) {
        navigate(`/startup-launch/${saved._id}/overview`, { replace: true });
      }
    },
    onError: (error) => {
      setToast(getStartupActionErrorMessage(error, "Unable to save startup profile right now."));
    },
  });

  const uploadDocument = useMutation({
    mutationFn: async ({ file, category }: { file: File; category: StartupDocumentCategory }) => {
      const savedStartup = startup?._id ? startup : await persistStartup.mutateAsync();
      return startupApi.uploadDocument(savedStartup._id, file, category);
    },
    onSuccess: async (savedStartup, variables) => {
      setPendingDocumentCategory(null);
      queryClient.setQueryData(["startup", savedStartup._id], savedStartup);
      setToast(`${STARTUP_IPR_DOCUMENT_SPECS.find((item) => item.category === variables.category)?.label ?? "Startup document"} uploaded.`);
      await queryClient.invalidateQueries({ queryKey: ["startup"] });
    },
    onError: (error) => {
      setPendingDocumentCategory(null);
      setToast(getStartupActionErrorMessage(error, "Unable to upload startup document right now."));
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async ({ startupId: targetStartupId, documentId }: { startupId: string; documentId: string }) =>
      startupApi.deleteDocument(targetStartupId, documentId),
    onSuccess: async (savedStartup) => {
      queryClient.setQueryData(["startup", savedStartup._id], savedStartup);
      setToast("Startup document removed.");
      await queryClient.invalidateQueries({ queryKey: ["startup"] });
    },
    onError: (error) => {
      setToast(getStartupActionErrorMessage(error, "Unable to remove startup document right now."));
    },
  });

  const requestReview = useMutation({
    mutationFn: async () => {
      const savedStartup = await persistStartup.mutateAsync();
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

  const handleStartupDocumentSelect = (
    category: StartupDocumentCategory,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const isPdf = file.type === "application/pdf" || pdfFileNamePattern.test(file.name);
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) {
      setPendingDocumentCategory(null);
      setToast("Only PDF or image files are allowed for startup documents.");
      return;
    }

    if (file.size > maxIprUploadSizeBytes) {
      setPendingDocumentCategory(null);
      setToast("IPR supporting files must be 3MB or smaller.");
      return;
    }

    setPendingDocumentCategory(category);
    uploadDocument.mutate({ file, category });
  };

  const handleWorkspaceChange = (workspaceId: string) => {
    const nextWorkspace = workspaces.find((workspace) => workspace._id === workspaceId);
    const nextTeamSize =
      nextWorkspace?.teamMembers?.length ??
      nextWorkspace?.teamMemberIds?.length ??
      1;

    setForm((current) => ({
      ...current,
      projectId: workspaceId || undefined,
      teamSize: nextTeamSize,
    }));
  };

  const updateRegistrationField = <K extends keyof StartupRegistrationProfile>(
    key: K,
    value: StartupRegistrationProfile[K],
  ) => {
    setForm((current) => ({
      ...current,
      registrationProfile: {
        ...current.registrationProfile,
        [key]: value,
      },
    }));
  };

  const currentStartupId = startup?._id ?? startupId;
  const activeDeals = (dealsQuery.data?.items ?? []).filter((deal) =>
    currentStartupId ? deal.startupId === currentStartupId : true,
  );
  const formTeamSize = workspaceTeamSize || form.teamSize || startup?.teamSize || 1;
  const requiredDocumentCategories = getRequiredStartupDocumentCategories(form.registrationProfile);
  const currentDocuments = startup?.documents ?? [];
  const currentReadiness = useMemo(
    () =>
      startup
        ? buildStartupReviewReadiness({
            name: form.name,
            tagline: form.tagline,
            category: form.category,
            founderIds: startup.founderIds,
            pitchDeckUrl: startup.pitchDeckUrl,
            documents: currentDocuments,
            registrationProfile: form.registrationProfile,
          })
        : undefined,
    [
      currentDocuments,
      form.category,
      form.name,
      form.registrationProfile,
      form.tagline,
      startup,
    ],
  );
  const documentsByCategory = new Map(currentDocuments.map((document) => [document.category, document]));
  const iprQuestionCount = STARTUP_IPR_QUESTION_SECTIONS.reduce(
    (total, section) => total + section.questions.length,
    0,
  );
  const iprAnsweredQuestionCount = STARTUP_IPR_QUESTION_SECTIONS.reduce(
    (total, section) =>
      total +
      section.questions.filter((question) =>
        String(form.registrationProfile[question.key] ?? "").trim().length > 0,
      ).length,
    0,
  );
  const iprSectionSummaries = STARTUP_IPR_QUESTION_SECTIONS.map((section) => ({
    title: section.title,
    answered: section.questions.filter((question) =>
      String(form.registrationProfile[question.key] ?? "").trim().length > 0,
    ).length,
    total: section.questions.length,
  }));
  const iprPreviewAnswers = STARTUP_IPR_QUESTION_SECTIONS.flatMap((section) =>
    section.questions.map((question) => ({
      key: question.key,
      label: question.label,
      value: String(form.registrationProfile[question.key] ?? "").trim(),
    })),
  ).filter((item) => item.value.length > 0);
  const requiredDocumentSpecs = STARTUP_IPR_DOCUMENT_SPECS.filter((spec) =>
    requiredDocumentCategories.includes(spec.category),
  );
  const optionalDocumentSpecs = STARTUP_IPR_DOCUMENT_SPECS.filter(
    (spec) => !requiredDocumentCategories.includes(spec.category),
  );
  const newPageDocumentSpecs = requiredDocumentSpecs;
  const canLaunch = Boolean(form.name.trim() && form.tagline.trim() && form.category.trim() && formTeamSize > 0);
  const reviewStatus = startup?.reviewStatus ?? "draft";
  const isApproved = reviewStatus === "approved";
  const isUnderReview = reviewStatus === "review_requested";
  const hasChangesRequested = reviewStatus === "changes_requested";
  const readiness = currentReadiness ?? startup?.readiness;
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
          : "Complete the business plan, the IPR intake questionnaire, and the required supporting files before submitting for admin review.";
  const founderMembers = activeWorkspace?.teamMembers ?? [];
  const profileStatusLabel = startup?.launchedAt
    ? "Live"
    : isApproved
      ? "Approved"
      : isUnderReview
        ? "Under review"
        : hasChangesRequested
          ? "Changes requested"
          : "Draft";
  const summaryStats = [
    { label: "Team members", value: String(formTeamSize), icon: Users, tone: "text-cyan-300" },
    { label: "Launch score", value: String(startup?.innovationScoreAtLaunch ?? 0), icon: TrendingUp, tone: "text-emerald-300" },
    { label: "Active offerings", value: String(startup?.activeProducts ?? form.activeProducts), icon: Target, tone: "text-violet-300" },
    { label: "Status", value: profileStatusLabel, icon: CheckCircle, tone: "text-amber-300" },
  ] as const;
  const investorPitchListed = Boolean(startup?.launchedToInvestors);
  const investorApprovalReceived = activeDeals.some((deal) => deal.status === "active" || deal.status === "closed");
  const marketplaceLive = Boolean(startup?.launchedToInvestors || startup?.launchedToMentors);
  const launchBlockedReason = !canLaunch
    ? "Complete the startup name, tagline, category, and founder team before launch."
    : !isApproved
      ? "Admin startup review must be approved before marketplace launch."
      : "";
  const canOpenLaunchModal = !launchBlockedReason;
  const workflowSteps: Array<{
    label: string;
    detail: string;
    status: WorkflowStepStatus;
  }> = [
    {
      label: "Create startup profile",
      detail: canLaunch ? "Core startup identity is ready." : "Name, tagline, category, and team are required.",
      status: canLaunch ? "complete" : "current",
    },
    {
      label: "Build founder team",
      detail:
        formTeamSize > 1
          ? `${formTeamSize} members are attached to this startup.`
          : "A solo founder can continue; add collaborators when the startup needs them.",
      status: formTeamSize > 1 ? "complete" : "optional",
    },
    {
      label: "Complete startup review",
      detail: readiness?.isReviewReady ? "Startup review requirements are complete." : `Still missing: ${readiness?.missingItems.slice(0, 3).join(", ") || "startup details"}`,
      status: readiness?.isReviewReady ? "complete" : "current",
    },
    {
      label: "Admin approval",
      detail: isApproved ? "Admin review is approved." : isUnderReview ? "Admin review is in progress." : "Submit the startup profile for admin review.",
      status: isApproved ? "complete" : isUnderReview ? "current" : "blocked",
    },
    {
      label: "Launch to marketplace",
      detail: marketplaceLive ? "Marketplace visibility is live." : "Choose investor, mentor, or recruiter visibility after approval.",
      status: marketplaceLive ? "complete" : canOpenLaunchModal ? "current" : "blocked",
    },
    {
      label: "Investor interest",
      detail: investorPitchListed ? "Investors can discover this startup." : "Investor discovery starts after you launch to investors.",
      status: investorPitchListed ? "complete" : canOpenLaunchModal ? "current" : "blocked",
    },
    {
      label: "Investor approval",
      detail: investorApprovalReceived ? "Investor interest is active for this startup." : "Investor approval appears after a pitch receives interest.",
      status: investorApprovalReceived ? "complete" : investorPitchListed ? "current" : "blocked",
    },
  ];
  const checklistItems = [
    canLaunch ? "Core basics are filled in for launch." : "Name, tagline, category, and at least one founder are required.",
    isNew
      ? "Create the startup first, then submit it for admin review."
      : isApproved
        ? "Admin review is approved and the startup can be launched."
        : isUnderReview
          ? "Admin review is in progress."
          : hasChangesRequested
            ? "Admin requested changes before launch."
            : "Submit the startup to admin review before marketplace launch.",
    readiness?.isReviewReady
      ? "Required IPR intake answers and document uploads are complete."
      : `Still missing: ${readiness?.missingItems.slice(0, 3).join(", ") || "IPR details"}`,
    activeWorkspace
      ? `Optional workspace link: ${activeWorkspace.title}.`
      : "No workspace is linked; this startup remains independent.",
    requiredDocumentCategories.length > 0
      ? `${requiredDocumentCategories.length} IPR supporting upload ${requiredDocumentCategories.length === 1 ? "is" : "are"} required at the current stage.`
      : "No mandatory IPR uploads are required at the current stage yet.",
  ];
  const sectionClassName = isNew
    ? "border-b border-slate-800/70 pb-8"
    : "rounded-2xl border border-slate-800/70 bg-slate-900/40 p-6 sm:p-7";
  const fieldClassName =
    "w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-500";
  const textareaClassName = `${fieldClassName} min-h-28 resize-y`;
  const isRequestReviewBusy = requestReview.isPending || persistStartup.isPending;
  const isRequestReviewBlocked = Boolean(!readiness?.isReviewReady || isApproved || isUnderReview);
  const requestReviewBlockedReason = isApproved
    ? "Startup is already approved."
    : isUnderReview
      ? "Startup review is already pending."
      : formatReadinessActionMessage(readiness?.missingItems ?? []);
  const handleRequestReviewClick = () => {
    if (isRequestReviewBusy) {
      return;
    }

    if (isRequestReviewBlocked) {
      setToast(requestReviewBlockedReason);
      return;
    }

    requestReview.mutate();
  };
  const handleLaunchClick = () => {
    if (launchBlockedReason) {
      setToast(launchBlockedReason);
      return;
    }

    setShowLaunchModal(true);
  };
  const renderDocumentCard = (spec: (typeof STARTUP_IPR_DOCUMENT_SPECS)[number], isRequired: boolean) => {
    const uploadedDocument = documentsByCategory.get(spec.category);
    const isUploading = pendingDocumentCategory === spec.category && uploadDocument.isPending;
    const cardClassName = isNew
      ? "border-b border-slate-800/70 pb-5 last:border-b-0 last:pb-0"
      : `rounded-2xl border p-4 ${isRequired ? "border-cyan-500/30 bg-cyan-500/5" : "border-slate-800 bg-slate-950/80"}`;
    const uploadLabelClassName = isNew
      ? "mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-700 px-4 py-4 text-sm text-slate-200"
      : `mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-4 text-sm ${isRequired ? "border-cyan-400/40 text-cyan-100" : "border-slate-700 text-slate-300"}`;

    return (
      <div key={spec.category} className={cardClassName}>
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          {spec.label}
          {isRequired ? <span className="text-cyan-300">*</span> : null}
        </div>
        <p className="mt-1 text-xs text-slate-500">{spec.hint}</p>

        {uploadedDocument ? (
          <div className="mt-4 rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3">
            <div className="text-sm font-medium text-white">{uploadedDocument.fileName}</div>
            <div className="mt-1 text-xs text-slate-300">
              Uploaded {new Date(uploadedDocument.uploadedAt).toLocaleDateString("en-IN")}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={uploadedDocument.fileUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white">
                Open
              </a>
              <button
                type="button"
                onClick={() => deleteDocument.mutate({ startupId: startup!._id, documentId: uploadedDocument._id })}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <label className={uploadLabelClassName}>
            <Upload className="h-4 w-4 text-cyan-300" />
            {isUploading ? "Uploading..." : "Upload PDF or image (max 3MB)"}
            <input type="file" accept="application/pdf,.pdf,image/*" className="hidden" onChange={(event) => handleStartupDocumentSelect(spec.category, event)} />
          </label>
        )}
      </div>
    );
  };

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
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Startup Launch
          </div>
          <h1 className="text-2xl font-semibold text-white">
            {isNew ? "Create startup" : "Launch profile"}
          </h1>
          <p className="max-w-2xl text-sm text-slate-400">
            {isNew
              ? "Fill in the startup details, answer the IPR questions, and upload the required startup documents."
              : "Edit the profile, keep the IPR review requirements visible, and submit only when the profile is ready."}
          </p>
        </div>

        {!isNew ? (
          <button
            type="button"
            onClick={() => navigate(getStartupSectionPath(currentStartupId!, "investor-outreach"))}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:border-slate-600"
          >
            <Send className="h-4 w-4" />
            Investor Outreach
          </button>
        ) : null}
      </div>

      {toast ? (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2.5 text-sm text-blue-300">
          {toast}
        </div>
      ) : null}

      {!isNew ? (
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                <span>Launch Profile</span>
                <span className="h-1 w-1 rounded-full bg-slate-700" />
                <span>{profileStatusLabel}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl font-semibold text-white">{form.name || "Your startup"}</h2>
                {form.tagline ? <span className="text-sm text-slate-400">{form.tagline}</span> : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-slate-200">
                  {form.category || "Category pending"}
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-slate-200">
                  {form.stage}
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-slate-200">
                  {formTeamSize} team members
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-5 gap-y-3 border-t border-slate-800/70 pt-4 sm:grid-cols-4 xl:min-w-[460px] xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
            {summaryStats.map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 ${tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {label}
                  </div>
                  <div className="text-base font-semibold text-white">{value}</div>
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>
      ) : null}

      {!isNew ? (
        <div className={`rounded-2xl border px-5 py-4 ${reviewTone}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.25em]">
                Marketplace Review
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-cyan-300" />
                <div>
                  <h3 className="text-lg font-semibold text-white">{reviewTitle}</h3>
                  <p className="mt-1 max-w-3xl text-sm leading-6">{reviewDescription}</p>
                </div>
              </div>
              {startup?.adminNotes ? (
                <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
                  Admin notes: {startup.adminNotes}
                </div>
              ) : null}
              {readiness ? (
                <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
                  {readiness.isReviewReady
                    ? "All required IPR intake answers and document uploads are complete."
                    : `${readiness.missingItems.slice(0, 4).join(", ")}${
                        readiness.missingItems.length > 4 ? `, and ${readiness.missingItems.length - 4} more` : ""
                      }`}
                </div>
              ) : null}
            </div>
            <div className="grid gap-1 text-sm text-slate-300 lg:min-w-[220px] lg:text-right">
              <div>
                Submitted: {startup?.reviewRequestedAt ? new Date(startup.reviewRequestedAt).toLocaleString("en-IN") : "Not submitted"}
              </div>
              <div>
                Reviewed: {startup?.adminReviewedAt ? new Date(startup.adminReviewedAt).toLocaleString("en-IN") : "Pending"}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!isNew ? (
        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
                Startup Workflow
              </div>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Startup to marketplace path
              </h2>
            </div>
            {launchBlockedReason ? (
              <div className="max-w-xl rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {launchBlockedReason}
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                Investor pitch listing is ready.
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {workflowSteps.map((step, index) => (
              <div
                key={step.label}
                className={`rounded-xl border px-4 py-4 ${workflowStatusClassName[step.status]}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Step {index + 1}
                  </div>
                  <span className="rounded-full border border-white/10 bg-slate-950/40 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em]">
                    {workflowStatusLabel[step.status]}
                  </span>
                </div>
                <div className="mt-3 font-semibold text-white">{step.label}</div>
                <div className="mt-2 text-sm leading-6">{step.detail}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className={isNew ? "space-y-8" : "grid gap-8 xl:grid-cols-[minmax(0,1.7fr)_320px]"}>
        <div className="space-y-8">
          <div className={`${sectionClassName} grid gap-4 md:grid-cols-2`}>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Optional workspace link</label>
                <select
                  value={selectedWorkspaceId}
                  onChange={(event) => handleWorkspaceChange(event.target.value)}
                  className={fieldClassName}
                  disabled={workspaceQuery.isLoading}
                >
                  <option value="">No linked workspace</option>
                  {workspaces.map((workspace) => (
                    <option key={workspace._id} value={workspace._id}>
                      {workspace.title}
                    </option>
                  ))}
                </select>
                <div className="mt-2 text-xs text-slate-500">
                  {activeWorkspace
                    ? `Team context will follow ${activeWorkspace.title}.`
                    : "Keep this empty when the startup is not based on an existing workspace."}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Startup name</label>
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={fieldClassName} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Tagline</label>
                <input value={form.tagline} onChange={(event) => setForm((current) => ({ ...current, tagline: event.target.value }))} className={fieldClassName} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Category</label>
                <input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="e.g. FinTech, Healthcare, EdTech, Climate..." className={fieldClassName} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Startup stage</label>
                <select value={form.stage} onChange={(event) => setForm((current) => ({ ...current, stage: event.target.value as StartupPayload["stage"] }))} className={fieldClassName}>
                  <option>Pre-Idea</option>
                  <option>Ideation</option>
                  <option>MVP</option>
                  <option>Pre-Launch</option>
                  <option>Launched</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Funding needed (INR)</label>
                <input type="number" value={form.fundingNeeded ?? ""} onChange={(event) => setForm((current) => ({ ...current, fundingNeeded: event.target.value ? Number(event.target.value) : undefined }))} className={fieldClassName} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Active offerings</label>
                <input type="number" value={form.activeProducts} onChange={(event) => setForm((current) => ({ ...current, activeProducts: Number(event.target.value) || 1 }))} className={fieldClassName} />
              </div>
          </div>

          <div className={`${sectionClassName} space-y-5`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">IPR Intake</div>
                  <h2 className="mt-2 text-xl font-semibold text-white">Startup innovation disclosure questionnaire</h2>
                  <p className="mt-2 max-w-3xl text-sm text-slate-400">
                    Answer the required questions only. Keep the responses clear and specific enough for startup IPR review.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">
                    {iprAnsweredQuestionCount}/{iprQuestionCount} answered
                  </div>
                  {isIprIntakeOpen ? (
                    <button
                      type="button"
                      onClick={() => setIsIprIntakeOpen(false)}
                      className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
                    >
                      Close
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsIprIntakeOpen(true)}
                      className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {isIprIntakeOpen ? (
                <>
                  {STARTUP_IPR_QUESTION_SECTIONS.map((section) => (
                    <div key={section.title} className={isNew ? "space-y-4 border-t border-slate-800/70 pt-5 first:border-t-0 first:pt-0" : "rounded-2xl border border-slate-800 bg-slate-950/60 p-5"}>
                      <div className="mb-4">
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{section.title}</div>
                      </div>
                      <div className="grid gap-4 xl:grid-cols-2">
                        {section.questions.map((question) => (
                          <div key={question.key} className={question.type === "select" ? "" : section.questions.length === 1 ? "xl:col-span-2" : ""}>
                            <label className="mb-2 block text-sm font-semibold text-white">{question.label}</label>
                            {question.type === "select" ? (
                              <select
                                value={String(form.registrationProfile[question.key])}
                                onChange={(event) => updateRegistrationField(question.key, event.target.value as StartupRegistrationProfile[typeof question.key])}
                                className={fieldClassName}
                              >
                                {question.options.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <textarea
                                value={String(form.registrationProfile[question.key] ?? "")}
                                onChange={(event) => updateRegistrationField(question.key, event.target.value as StartupRegistrationProfile[typeof question.key])}
                                className={textareaClassName}
                                placeholder="Add a concrete answer with enough technical detail for review."
                              />
                            )}
                            {"minLength" in question ? (
                              <div className="mt-2 text-xs text-slate-500">Recommended minimum: {question.minLength} characters</div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-col gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">Save IPR intake</div>
                      <div className="mt-1 text-xs text-cyan-100/80">
                        Saved answers are stored with this startup profile and will load again after relogin.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => persistStartup.mutate()}
                      disabled={persistStartup.isPending}
                      className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {persistStartup.isPending ? "Saving..." : isNew ? "Create & Save Intake" : "Save IPR Intake"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {iprSectionSummaries.map((section) => (
                      <div key={section.title} className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{section.title}</div>
                        <div className="mt-2 text-sm font-semibold text-white">
                          {section.answered}/{section.total} answered
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 space-y-3">
                    {iprPreviewAnswers.length > 0 ? (
                      iprPreviewAnswers.slice(0, 4).map((item) => (
                        <div key={item.key} className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                          <div className="mt-2 line-clamp-2 text-sm leading-6 text-slate-200">
                            {formatStartupIprValue(item.key, item.value)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950 px-4 py-5 text-sm text-slate-400">
                        No written intake answers have been saved yet. Use Edit to complete the questionnaire.
                      </div>
                    )}
                  </div>
                </div>
              )}
          </div>

          {!isNew ? (
            <div className={sectionClassName}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">Pitch Deck</h2>
                  {startup?.pitchDeckUrl ? <a href={startup.pitchDeckUrl} target="_blank" rel="noreferrer" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl flex items-center gap-2"><Download className="w-4 h-4" />Open PDF</a> : null}
                </div>
                <label className="flex items-center gap-3 px-4 py-4 bg-slate-950/70 border border-dashed border-slate-700 rounded-2xl text-white cursor-pointer">
                  <Upload className="w-5 h-5 text-cyan-300" />
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

          <div className={sectionClassName}>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">IPR Supporting Files</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Upload only the required supporting file for the current stage. PDF and image files up to 3MB are allowed.
                    {isNew ? " Your first upload will create the startup draft automatically." : ""}
                  </p>
                </div>
                {!isNew ? (
                  <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100">
                    {requiredDocumentCategories.length} required upload {requiredDocumentCategories.length === 1 ? "slot" : "slots"}
                  </div>
                ) : null}
              </div>

              {(isNew ? newPageDocumentSpecs : requiredDocumentSpecs).length > 0 ? (
                <div className="mb-6">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                    {isNew ? "Required Upload" : "Mandatory Docs Upload"}
                  </div>
                  <div className={isNew ? "space-y-5" : "grid gap-4 md:grid-cols-2"}>
                    {(isNew ? newPageDocumentSpecs : requiredDocumentSpecs).map((spec) => renderDocumentCard(spec, true))}
                  </div>
                </div>
              ) : null}

              {!isNew && optionalDocumentSpecs.length > 0 ? (
                <div>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Optional Supporting Uploads</div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {optionalDocumentSpecs.map((spec) => renderDocumentCard(spec, false))}
                  </div>
                </div>
              ) : null}
          </div>

          {!isNew ? (
          <div className={sectionClassName}>
              <h2 className="text-xl font-semibold text-white mb-4">Traction Indicators</h2>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { key: "patentFiled", label: "Patent Filed" },
                  { key: "mvpBuilt", label: "MVP Built" },
                  { key: "revenueGenerating", label: "Revenue Generating" },
                ].map((item) => (
                  <label key={item.key} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white">
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
          ) : null}
        </div>

        {!isNew ? (
          <div className="space-y-8 xl:sticky xl:top-6 self-start">
            <div className="overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/40">
              <div className="border-b border-slate-800/70 px-6 py-5">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Founder Team</div>
                <h3 className="mt-2 font-semibold text-white">Active workspace members</h3>
              </div>
              <div className="px-6 py-5">
                {founderMembers.length > 0 ? (
                  <div className="space-y-3">
                    {founderMembers.map((member) => (
                      <div key={member._id} className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 flex items-center gap-3">
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
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-sm text-slate-400">
                    {activeWorkspace
                      ? "No workspace members were returned for this startup yet."
                      : "Link a workspace to sync founders and team access for this startup."}
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/40">
              <div className="border-b border-slate-800/70 px-6 py-5">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Launch Checklist</div>
                <h3 className="mt-2 font-semibold text-white">What still needs attention</h3>
              </div>
              <div className="px-6 py-5">
                <ul className="space-y-3 text-sm text-slate-300">
                  {checklistItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                  <li>Investor Outreach lets you shortlist investors and send pitch requests for this startup directly</li>
                  <li>Launch to recruiters is available from your Portfolio too</li>
                </ul>
                {readiness?.requiredDocumentCategories.length ? (
                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                      <FileText className="h-4 w-4" />
                      Required Docs
                    </div>
                    <div className="mt-2 text-sm text-slate-300">
                      {readiness.requiredDocumentCategories.map((item) => item.replace(/_/g, " ")).join(", ")}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className={`${sectionClassName} xl:sticky xl:top-[32rem]`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Active Investor Deals</h3>
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
                            ? "Payment placeholder pending"
                            : deal.currentStage === 3
                              ? "Awaiting equity verification by admin"
                              : "Deal closed - check your portfolio!"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

        <div className="flex flex-col gap-4 border-t border-slate-800/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Save and submit at the end of the page.</p>
            <p className="mt-1 text-sm text-slate-400">
              {isNew
                ? "Create the startup first, then return here to submit it for review."
                : launchBlockedReason || "Save changes after reviewing the full profile, then launch to the marketplace from here."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            {!isNew ? (
              <>
                <button
                  type="button"
                  onClick={handleRequestReviewClick}
                  disabled={isRequestReviewBusy}
                  aria-disabled={isRequestReviewBlocked || isRequestReviewBusy}
                  title={isRequestReviewBlocked ? requestReviewBlockedReason : "Save the latest profile and submit for admin review"}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
                    isRequestReviewBlocked
                      ? "cursor-help border-slate-800 bg-slate-900/70 text-slate-400"
                      : "border-slate-700 bg-slate-900 text-white hover:border-slate-600"
                  }`}
                >
                  {isRequestReviewBusy ? "Submitting..." : isApproved ? "Approved" : isUnderReview ? "Under Review" : "Submit for Review"}
                </button>
                <button
                  type="button"
                  onClick={handleLaunchClick}
                  aria-disabled={!canOpenLaunchModal}
                  title={launchBlockedReason || "Launch to marketplace"}
                  className={`inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-sm font-semibold text-white ${
                    canOpenLaunchModal ? "hover:from-blue-500 hover:to-purple-500" : "cursor-help opacity-50"
                  }`}
                >
                  <Rocket className="h-4 w-4" />
                  Launch
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => persistStartup.mutate()}
              disabled={persistStartup.isPending}
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {persistStartup.isPending ? "Saving..." : isNew ? "Create Startup Draft" : reviewStatus === "draft" ? "Save Draft" : "Save Profile"}
            </button>
          </div>
        </div>

        {showLaunchModal ? (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Launch Your Startup To:</h2>
                <button type="button" onClick={() => setShowLaunchModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="mb-5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                Approved student-created startups can be launched to investors, mentors, or recruiters. Workspace links are optional and do not come from the Problem Bank unless you choose one.
              </div>
              <div className="space-y-3 mb-6">
                {[
                  ["investors", "Launch to Investors"],
                  ["mentors", "Launch to Mentors"],
                  ["both", "Launch to Both (Recommended)"],
                  ["recruiters", "Launch to Recruiters"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLaunchTarget(value as "investors" | "mentors" | "both" | "recruiters")}
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
                <button type="button" onClick={() => setShowLaunchModal(false)} className="px-5 py-3 bg-slate-800 text-white rounded-lg font-semibold">Cancel</button>
                <button
                  type="button"
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
