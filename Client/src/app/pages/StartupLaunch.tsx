import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  Download,
  FileText,
  FolderKanban,
  Rocket,
  Send,
  ShieldCheck,
  Target,
  TrendingUp,
  Upload,
  Users,
  X,
} from "lucide-react";
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
import {
  getStartupSectionPath,
  normalizeStartupRouteId,
} from "../../features/startup/navigation";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import type {
  StartupDocumentCategory,
  StartupRegistrationProfile,
} from "../../types/startup.types";

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

const shortDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const shortDateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
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
  const [launchTarget, setLaunchTarget] = useState<
    "investors" | "mentors" | "both"
  >("both");
  const [toast, setToast] = useState("");
  const [pendingPitchDeckName, setPendingPitchDeckName] = useState("");
  const [pendingDocumentCategory, setPendingDocumentCategory] =
    useState<StartupDocumentCategory | null>(null);
  const [form, setForm] = useState<StartupPayload>(() => createEmptyPayload());
  const [isIprIntakeOpen, setIsIprIntakeOpen] = useState(true);
  const [activeIprSectionTitle, setActiveIprSectionTitle] = useState(
    STARTUP_IPR_QUESTION_SECTIONS[0]?.title ?? "",
  );

  const workspaceQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => workspaceApi.list(),
  });
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
  const activeWorkspace =
    workspaces.find((workspace) => workspace._id === selectedWorkspaceId) ??
    null;
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
      setToast("Startup draft saved. Submit it for admin review when ready.");
      await queryClient.invalidateQueries({ queryKey: ["startup"] });
      if (isNew && saved._id) {
        navigate(`/startup-launch/${saved._id}/overview`, { replace: true });
      }
    },
    onError: (error) => {
      setToast(
        getStartupActionErrorMessage(
          error,
          "Unable to save startup profile right now.",
        ),
      );
    },
  });

  const uploadDocument = useMutation({
    mutationFn: async ({
      file,
      category,
    }: {
      file: File;
      category: StartupDocumentCategory;
    }) => {
      const savedStartup = startup?._id
        ? startup
        : await persistStartup.mutateAsync();
      return startupApi.uploadDocument(savedStartup._id, file, category);
    },
    onSuccess: async (savedStartup, variables) => {
      setPendingDocumentCategory(null);
      queryClient.setQueryData(["startup", savedStartup._id], savedStartup);
      setToast(
        `${STARTUP_IPR_DOCUMENT_SPECS.find((item) => item.category === variables.category)?.label ?? "Startup document"} uploaded.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["startup"] });
    },
    onError: (error) => {
      setPendingDocumentCategory(null);
      setToast(
        getStartupActionErrorMessage(
          error,
          "Unable to upload startup document right now.",
        ),
      );
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async ({
      startupId: targetStartupId,
      documentId,
    }: {
      startupId: string;
      documentId: string;
    }) => startupApi.deleteDocument(targetStartupId, documentId),
    onSuccess: async (savedStartup) => {
      queryClient.setQueryData(["startup", savedStartup._id], savedStartup);
      setToast("Startup document removed.");
      await queryClient.invalidateQueries({ queryKey: ["startup"] });
    },
    onError: (error) => {
      setToast(
        getStartupActionErrorMessage(
          error,
          "Unable to remove startup document right now.",
        ),
      );
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
      setToast(
        getStartupActionErrorMessage(
          error,
          "Unable to submit startup for admin review.",
        ),
      );
    },
  });

  const launchStartup = useMutation({
    mutationFn: async (launchTo: "investors" | "mentors" | "both") => {
      const savedStartup = startup?._id
        ? startup
        : await persistStartup.mutateAsync();
      return startupApi.launch(savedStartup._id, launchTo);
    },
    onSuccess: async () => {
      setShowLaunchModal(false);
      setToast(
        "Your startup is now live! Investors and mentors can discover you.",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["startup"] }),
        queryClient.invalidateQueries({ queryKey: ["score", "me"] }),
      ]);
    },
    onError: (error) => {
      setToast(
        getStartupActionErrorMessage(
          error,
          "Unable to launch startup right now.",
        ),
      );
    },
  });

  const uploadPitch = useMutation({
    mutationFn: async (file: File) => {
      const savedStartup = startup?._id
        ? startup
        : await persistStartup.mutateAsync();
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
        setToast(
          error.response?.data?.error?.message ??
            "Failed to upload pitch deck PDF. Please try again.",
        );
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

    if (
      file.type !== "application/pdf" &&
      !pdfFileNamePattern.test(file.name)
    ) {
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

    const isPdf =
      file.type === "application/pdf" || pdfFileNamePattern.test(file.name);
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
  const formTeamSize =
    workspaceTeamSize || form.teamSize || startup?.teamSize || 1;
  const requiredDocumentCategories = getRequiredStartupDocumentCategories(
    form.registrationProfile,
  );
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
  const documentsByCategory = new Map(
    currentDocuments.map((document) => [document.category, document]),
  );
  const iprQuestionCount = STARTUP_IPR_QUESTION_SECTIONS.reduce(
    (total, section) => total + section.questions.length,
    0,
  );
  const iprAnsweredQuestionCount = STARTUP_IPR_QUESTION_SECTIONS.reduce(
    (total, section) =>
      total +
      section.questions.filter(
        (question) =>
          String(form.registrationProfile[question.key] ?? "").trim().length >
          0,
      ).length,
    0,
  );
  const iprSectionSummaries = STARTUP_IPR_QUESTION_SECTIONS.map((section) => ({
    title: section.title,
    answered: section.questions.filter(
      (question) =>
        String(form.registrationProfile[question.key] ?? "").trim().length > 0,
    ).length,
    total: section.questions.length,
  }));
  const iprSections = STARTUP_IPR_QUESTION_SECTIONS.map((section) => {
    const answered = section.questions.filter(
      (question) =>
        String(form.registrationProfile[question.key] ?? "").trim().length > 0,
    ).length;

    return {
      ...section,
      answered,
      total: section.questions.length,
      isComplete: answered === section.questions.length,
    };
  });
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
  const canLaunch = Boolean(
    form.name.trim() &&
    form.tagline.trim() &&
    form.category.trim() &&
    formTeamSize > 0,
  );
  const reviewStatus = startup?.reviewStatus ?? "draft";
  const isApproved = reviewStatus === "approved";
  const isUnderReview = reviewStatus === "review_requested";
  const hasChangesRequested = reviewStatus === "changes_requested";
  const editAccess = startup?.editAccess;
  const isEditingLocked = Boolean(!isNew && editAccess?.isLocked);
  const editLockReason = editAccess?.reason ?? "";
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
    {
      label: "Team members",
      value: String(formTeamSize),
      icon: Users,
      tone: "text-cyan-300",
    },
    {
      label: "Launch score",
      value: String(startup?.innovationScoreAtLaunch ?? 0),
      icon: TrendingUp,
      tone: "text-emerald-300",
    },
    {
      label: "Active offerings",
      value: String(startup?.activeProducts ?? form.activeProducts),
      icon: Target,
      tone: "text-violet-300",
    },
    {
      label: "Status",
      value: profileStatusLabel,
      icon: CheckCircle,
      tone: "text-amber-300",
    },
  ] as const;
  const investorPitchListed = Boolean(startup?.launchedToInvestors);
  const investorApprovalReceived = activeDeals.some(
    (deal) => deal.status === "active" || deal.status === "closed",
  );
  const marketplaceLive = Boolean(
    startup?.launchedToInvestors || startup?.launchedToMentors,
  );
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
      detail: canLaunch
        ? "Core startup identity is ready."
        : "Name, tagline, category, and team are required.",
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
      detail: readiness?.isReviewReady
        ? "Startup review requirements are complete."
        : `Still missing: ${readiness?.missingItems.slice(0, 3).join(", ") || "startup details"}`,
      status: readiness?.isReviewReady ? "complete" : "current",
    },
    {
      label: "Admin approval",
      detail: isApproved
        ? "Admin review is approved."
        : isUnderReview
          ? "Admin review is in progress."
          : "Submit the startup profile for admin review.",
      status: isApproved ? "complete" : isUnderReview ? "current" : "blocked",
    },
    {
      label: "Launch to marketplace",
      detail: marketplaceLive
        ? "Marketplace visibility is live."
        : "Choose investor or mentor visibility after approval.",
      status: marketplaceLive
        ? "complete"
        : canOpenLaunchModal
          ? "current"
          : "blocked",
    },
    {
      label: "Investor interest",
      detail: investorPitchListed
        ? "Investors can discover this startup."
        : "Investor discovery starts after you launch to investors.",
      status: investorPitchListed
        ? "complete"
        : canOpenLaunchModal
          ? "current"
          : "blocked",
    },
    {
      label: "Investor approval",
      detail: investorApprovalReceived
        ? "Investor interest is active for this startup."
        : "Investor approval appears after a pitch receives interest.",
      status: investorApprovalReceived
        ? "complete"
        : investorPitchListed
          ? "current"
          : "blocked",
    },
  ];
  const checklistItems = [
    canLaunch
      ? "Core basics are filled in for launch."
      : "Name, tagline, category, and at least one founder are required.",
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
      ? `Workspace tab linked: ${activeWorkspace.title}.`
      : "No product workspace is linked to this startup yet.",
    requiredDocumentCategories.length > 0
      ? `${requiredDocumentCategories.length} IPR supporting upload ${requiredDocumentCategories.length === 1 ? "is" : "are"} required at the current stage.`
      : "No mandatory IPR uploads are required at the current stage yet.",
  ];
  const completedWorkflowCount = workflowSteps.filter(
    (step) => step.status === "complete",
  ).length;
  const currentWorkflowStep =
    workflowSteps.find((step) => step.status === "current") ??
    workflowSteps.find((step) => step.status === "blocked") ??
    workflowSteps[workflowSteps.length - 1];
  const visibleChecklistItems = checklistItems.slice(0, 4);
  const sectionClassName = isNew
    ? "border-b border-slate-800/70 pb-8"
    : "border-t border-slate-800/70 pt-7";
  const fieldClassName =
    "w-full border border-slate-800 bg-slate-950/30 px-3 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition-colors focus:border-cyan-400";
  const textareaClassName = `${fieldClassName} min-h-28 resize-y`;
  const isRequestReviewBusy =
    requestReview.isPending || persistStartup.isPending;
  const isRequestReviewBlocked = Boolean(
    isEditingLocked || !readiness?.isReviewReady || isApproved || isUnderReview,
  );
  const requestReviewBlockedReason = isEditingLocked
    ? editLockReason
    : isApproved
      ? "Startup is already approved."
      : isUnderReview
        ? "Startup review is already pending."
        : formatReadinessActionMessage(readiness?.missingItems ?? []);
  const startupUnlockRequestPath = useMemo(() => {
    if (!currentStartupId) {
      return "/dashboard/help-desk/new?category=startup_patent";
    }

    const params = new URLSearchParams({
      category: "startup_patent",
      priority: "medium",
      relatedEntityType: "startup",
      relatedEntityId: currentStartupId,
      referenceText: form.name || startup?.name || "Startup profile lock",
      title: `Request startup edit unlock for ${form.name || startup?.name || "startup"}`,
      description:
        `The startup profile is locked after submission or approval and I need admin-approved access to update it.\n\n` +
        `Startup: ${form.name || startup?.name || "Unknown startup"}\n` +
        `Current review status: ${reviewStatus}\n` +
        `Reason shown: ${editLockReason || "Profile is locked for review governance."}\n\n` +
        `Please approve a temporary edit unlock so I can update the startup and resubmit it for review.`,
    });

    return `/dashboard/help-desk/new?${params.toString()}`;
  }, [
    currentStartupId,
    editLockReason,
    form.name,
    reviewStatus,
    startup?.name,
  ]);
  useEffect(() => {
    if (!isIprIntakeOpen) {
      return;
    }

    const nextSection =
      iprSections.find((section) => !section.isComplete)?.title ??
      iprSections[0]?.title ??
      "";

    if (
      !activeIprSectionTitle ||
      !iprSections.some((section) => section.title === activeIprSectionTitle)
    ) {
      setActiveIprSectionTitle(nextSection);
    }
  }, [activeIprSectionTitle, iprSections, isIprIntakeOpen]);

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
  const renderDocumentCard = (
    spec: (typeof STARTUP_IPR_DOCUMENT_SPECS)[number],
    isRequired: boolean,
  ) => {
    const uploadedDocument = documentsByCategory.get(spec.category);
    const isUploading =
      pendingDocumentCategory === spec.category && uploadDocument.isPending;
    const cardClassName = isNew
      ? "border-b border-slate-800/70 pb-5 last:border-b-0 last:pb-0"
      : `border-l-2 px-4 py-3 ${isRequired ? "border-cyan-400 bg-cyan-500/5" : "border-slate-700 bg-slate-950/20"}`;
    const uploadLabelClassName = isNew
      ? "mt-4 flex cursor-pointer items-center gap-3 border border-dashed border-slate-700 px-4 py-4 text-sm text-slate-200"
      : `mt-4 flex cursor-pointer items-center gap-3 border border-dashed px-4 py-4 text-sm ${isRequired ? "border-cyan-400/40 text-cyan-100" : "border-slate-700 text-slate-300"}`;

    return (
      <div key={spec.category} className={cardClassName}>
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          {spec.label}
          {isRequired ? <span className="text-cyan-300">*</span> : null}
        </div>
        <p className="mt-1 text-xs text-slate-500">{spec.hint}</p>

        {uploadedDocument ? (
          <div className="mt-4 border border-cyan-500/20 bg-cyan-500/10 p-3">
            <div className="text-sm font-medium text-white">
              {uploadedDocument.fileName}
            </div>
            <div className="mt-1 text-xs text-slate-300">
              Uploaded{" "}
              {shortDateFormatter.format(new Date(uploadedDocument.uploadedAt))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={uploadedDocument.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-slate-800 px-3 py-2 text-xs font-semibold text-white"
              >
                Open
              </a>
              <button
                type="button"
                onClick={() =>
                  deleteDocument.mutate({
                    startupId: startup!._id,
                    documentId: uploadedDocument._id,
                  })
                }
                disabled={isEditingLocked}
                className="border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <label className={uploadLabelClassName}>
            <Upload className="h-4 w-4 text-cyan-300" />
            {isEditingLocked
              ? "Uploads are locked"
              : isUploading
                ? "Uploading..."
                : "Upload PDF or image (max 3MB)"}
            <input
              type="file"
              accept="application/pdf,.pdf,image/*"
              className="hidden"
              disabled={isEditingLocked}
              onChange={(event) =>
                handleStartupDocumentSelect(spec.category, event)
              }
            />
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
        {getStartupActionErrorMessage(
          startupQuery.error,
          "Unable to load this startup right now.",
        )}
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-none space-y-7">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Startup Launch
          </div>
          <h1 className="text-2xl font-semibold text-white">
            {isNew ? "Create startup" : "Launch profile"}
          </h1>
          <p className="max-w-3xl text-sm text-slate-400">
            {isNew
              ? "Fill in the startup details, answer the IPR questions, and upload the required startup documents."
              : "Keep the overview lean, complete only what is missing, and move supporting work into the dedicated startup tabs."}
          </p>
        </div>

        {!isNew ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                navigate(
                  getStartupSectionPath(currentStartupId!, "investor-outreach"),
                )
              }
              className="inline-flex items-center gap-2 border border-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:border-slate-500"
            >
              <Send className="h-4 w-4" />
              Investor Outreach
            </button>
            <button
              type="button"
              onClick={() =>
                navigate(
                  getStartupSectionPath(currentStartupId!, "investor-deals"),
                )
              }
              className="inline-flex items-center gap-2 border border-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:border-slate-500"
            >
              <FileText className="h-4 w-4" />
              Investor Deals
            </button>
          </div>
        ) : null}
      </div>

      {toast ? (
        <div
          aria-live="polite"
          className="border border-blue-500/20 bg-blue-500/10 px-4 py-2.5 text-sm text-blue-300"
        >
          {toast}
        </div>
      ) : null}

      {!isNew ? (
        <section className="border-y border-slate-800/70 py-5">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    <span>Launch Profile</span>
                    <span className="h-1 w-1 bg-slate-700" />
                    <span>{profileStatusLabel}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2.5">
                    <h2 className="text-xl font-semibold text-white">
                      {form.name || "Your startup"}
                    </h2>
                    {form.tagline ? (
                      <span className="text-sm text-slate-400">
                        {form.tagline}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="border border-slate-700 px-2.5 py-1 text-slate-200">
                    {form.category || "Category pending"}
                  </span>
                  <span className="border border-slate-700 px-2.5 py-1 text-slate-200">
                    {form.stage}
                  </span>
                  <span className="border border-slate-700 px-2.5 py-1 text-slate-200">
                    {formTeamSize} team members
                  </span>
                </div>
              </div>

              <div className="grid gap-4 border-t border-slate-800/70 pt-4 sm:grid-cols-2 xl:grid-cols-4">
                {summaryStats.map(({ label, value, icon: Icon, tone }) => (
                  <div
                    key={label}
                    className="border-l border-slate-800/70 pl-4"
                  >
                    <div
                      className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${tone}`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5 border-t border-slate-800/70 pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
              <div className={`border-l-2 px-4 py-1 ${reviewTone}`}>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-cyan-300" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Marketplace Review
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      {reviewTitle}
                    </h3>
                    <p className="mt-1 text-sm leading-6">
                      {reviewDescription}
                    </p>
                    {startup?.adminNotes ? (
                      <div className="mt-3 border-l-2 border-white/10 pl-3 text-sm text-slate-200">
                        Admin notes: {startup.adminNotes}
                      </div>
                    ) : null}
                    {isEditingLocked ? (
                      <div className="mt-3 border-l-2 border-amber-400 pl-3 text-sm text-amber-100">
                        {editLockReason}
                        <button
                          type="button"
                          onClick={() => navigate(startupUnlockRequestPath)}
                          className="ml-3 font-semibold text-cyan-200 underline underline-offset-4"
                        >
                          Raise Smart Help request
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/70 pb-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                      Launch Progress
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      {completedWorkflowCount}/{workflowSteps.length} steps
                      complete
                    </div>
                  </div>
                  <div className="text-sm text-slate-400">
                    Next:{" "}
                    <span className="text-white">
                      {currentWorkflowStep?.label ?? "Launch"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {workflowSteps.map((step, index) => (
                    <div
                      key={step.label}
                      className="flex items-start justify-between gap-4 border-b border-slate-900 pb-2 text-sm last:border-b-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-white">
                          {index + 1}. {step.label}
                        </div>
                        <div className="mt-1 text-slate-400">{step.detail}</div>
                      </div>
                      <span
                        className={`shrink-0 border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${workflowStatusClassName[step.status]}`}
                      >
                        {workflowStatusLabel[step.status]}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
                  <div>
                    Submitted:{" "}
                    {startup?.reviewRequestedAt
                      ? shortDateTimeFormatter.format(
                          new Date(startup.reviewRequestedAt),
                        )
                      : "Not submitted"}
                  </div>
                  <div>
                    Reviewed:{" "}
                    {startup?.adminReviewedAt
                      ? shortDateTimeFormatter.format(
                          new Date(startup.adminReviewedAt),
                        )
                      : "Pending"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div
        className={
          isNew
            ? "space-y-8"
            : "grid gap-10 xl:grid-cols-[minmax(0,2.2fr)_340px]"
        }
      >
        <div className="space-y-8">
          <fieldset disabled={isEditingLocked} className="space-y-8">
            <div className={`${sectionClassName} grid gap-4 lg:grid-cols-3`}>
              <div>
                <label
                  htmlFor="startup-name"
                  className="mb-2 block text-sm font-semibold text-white"
                >
                  Startup name
                </label>
                <input
                  id="startup-name"
                  name="startupName"
                  autoComplete="organization"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className={fieldClassName}
                />
              </div>
              <div>
                <label
                  htmlFor="startup-tagline"
                  className="mb-2 block text-sm font-semibold text-white"
                >
                  Tagline
                </label>
                <input
                  id="startup-tagline"
                  name="startupTagline"
                  autoComplete="off"
                  value={form.tagline}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      tagline: event.target.value,
                    }))
                  }
                  className={fieldClassName}
                />
              </div>
              <div>
                <label
                  htmlFor="startup-category"
                  className="mb-2 block text-sm font-semibold text-white"
                >
                  Category
                </label>
                <input
                  id="startup-category"
                  name="startupCategory"
                  autoComplete="off"
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  placeholder="e.g. FinTech, Healthcare, EdTech, Climate…"
                  className={fieldClassName}
                />
              </div>
              <div>
                <label
                  htmlFor="startup-stage"
                  className="mb-2 block text-sm font-semibold text-white"
                >
                  Startup stage
                </label>
                <select
                  id="startup-stage"
                  name="startupStage"
                  value={form.stage}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      stage: event.target.value as StartupPayload["stage"],
                    }))
                  }
                  className={fieldClassName}
                >
                  <option>Pre-Idea</option>
                  <option>Ideation</option>
                  <option>MVP</option>
                  <option>Pre-Launch</option>
                  <option>Launched</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="startup-funding"
                  className="mb-2 block text-sm font-semibold text-white"
                >
                  Funding needed (INR)
                </label>
                <input
                  id="startup-funding"
                  name="fundingNeeded"
                  autoComplete="off"
                  inputMode="numeric"
                  type="number"
                  value={form.fundingNeeded ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      fundingNeeded: event.target.value
                        ? Number(event.target.value)
                        : undefined,
                    }))
                  }
                  className={fieldClassName}
                />
              </div>
              <div>
                <label
                  htmlFor="startup-offerings"
                  className="mb-2 block text-sm font-semibold text-white"
                >
                  Active offerings
                </label>
                <input
                  id="startup-offerings"
                  name="activeOfferings"
                  autoComplete="off"
                  inputMode="numeric"
                  type="number"
                  value={form.activeProducts}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      activeProducts: Number(event.target.value) || 1,
                    }))
                  }
                  className={fieldClassName}
                />
              </div>
            </div>

            {!isNew ? (
              <div className={sectionClassName}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">
                      Linked Product Workspace
                    </div>
                    <h2 className="mt-2 text-xl font-semibold text-white">
                      Keep workspace management in its own tab
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm text-slate-400">
                      The overview only shows linked status. Open the dedicated
                      workspace tab when you need to change the linked workspace
                      or review team sync details.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        getStartupSectionPath(startupId!, "product-workspace"),
                      )
                    }
                    className="inline-flex items-center gap-2 border border-cyan-500/30 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400/50 hover:bg-cyan-500/10"
                  >
                    <FolderKanban className="h-4 w-4" />
                    Open Workspace Tab
                  </button>
                </div>
                <div className="mt-5 grid gap-4 border-t border-slate-800/70 pt-4 md:grid-cols-3">
                  <div className="border-l border-slate-800/70 pl-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Workspace
                    </div>
                    <div className="mt-2 text-base font-semibold text-white">
                      {activeWorkspace?.title ?? "Not linked"}
                    </div>
                  </div>
                  <div className="border-l border-slate-800/70 pl-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Stage
                    </div>
                    <div className="mt-2 text-base font-semibold text-white">
                      {activeWorkspace?.stage ?? "Not linked"}
                    </div>
                  </div>
                  <div className="border-l border-slate-800/70 pl-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Team context
                    </div>
                    <div className="mt-2 text-base font-semibold text-white">
                      {activeWorkspace
                        ? `${activeWorkspace.teamMembers?.length ?? activeWorkspace.teamMemberIds?.length ?? 0} members`
                        : "No team synced"}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </fieldset>

          <div className={`${sectionClassName} space-y-5`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">
                  IPR Intake
                </div>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Startup innovation disclosure questionnaire
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-400">
                  Answer the required questions only. Keep the responses clear
                  and specific enough for startup IPR review.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">
                  {iprAnsweredQuestionCount}/{iprQuestionCount} answered
                </div>
                {isIprIntakeOpen ? (
                  <button
                    type="button"
                    onClick={() => setIsIprIntakeOpen(false)}
                    className="border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
                  >
                    Preview
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveIprSectionTitle(
                        iprSections.find((section) => !section.isComplete)
                          ?.title ??
                          iprSections[0]?.title ??
                          "",
                      );
                      setIsIprIntakeOpen(true);
                    }}
                    className="bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            {isIprIntakeOpen ? (
              <>
                {iprSections.map((section) => {
                  const isActive = activeIprSectionTitle === section.title;

                  return (
                    <div
                      key={section.title}
                      className="border-t border-slate-800/70 pt-5 first:border-t-0 first:pt-0"
                    >
                      <div className="flex flex-col gap-3 border-b border-slate-800/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                            {section.title}
                          </div>
                          <div className="mt-2 text-sm text-slate-400">
                            {section.answered}/{section.total} answered
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${section.isComplete ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-slate-700 text-slate-300"}`}
                          >
                            {section.isComplete ? "Complete" : "In Progress"}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveIprSectionTitle(
                                isActive ? "" : section.title,
                              )
                            }
                            className="border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
                          >
                            {isActive ? "Hide" : "Open"}
                          </button>
                        </div>
                      </div>

                      {isActive ? (
                        <div className="grid gap-4 pt-4 xl:grid-cols-2">
                          {section.questions.map((question) => (
                            <div
                              key={question.key}
                              className={
                                question.type === "select"
                                  ? ""
                                  : section.questions.length === 1
                                    ? "xl:col-span-2"
                                    : ""
                              }
                            >
                              <label
                                htmlFor={`ipr-${String(question.key)}`}
                                className="mb-2 block text-sm font-semibold text-white"
                              >
                                {question.label}
                              </label>
                              {question.type === "select" ? (
                                <select
                                  id={`ipr-${String(question.key)}`}
                                  name={String(question.key)}
                                  value={String(
                                    form.registrationProfile[question.key],
                                  )}
                                  onChange={(event) =>
                                    updateRegistrationField(
                                      question.key,
                                      event.target
                                        .value as StartupRegistrationProfile[typeof question.key],
                                    )
                                  }
                                  disabled={isEditingLocked}
                                  className={fieldClassName}
                                >
                                  {question.options.map((option) => (
                                    <option
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <textarea
                                  id={`ipr-${String(question.key)}`}
                                  name={String(question.key)}
                                  value={String(
                                    form.registrationProfile[question.key] ??
                                      "",
                                  )}
                                  onChange={(event) =>
                                    updateRegistrationField(
                                      question.key,
                                      event.target
                                        .value as StartupRegistrationProfile[typeof question.key],
                                    )
                                  }
                                  disabled={isEditingLocked}
                                  className={textareaClassName}
                                  placeholder="Add a concrete answer with enough technical detail for review…"
                                />
                              )}
                              {"minLength" in question ? (
                                <div className="mt-2 text-xs text-slate-500">
                                  Recommended minimum: {question.minLength}{" "}
                                  characters
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                <div className="flex flex-col gap-3 border-t border-cyan-500/20 bg-cyan-500/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      Save IPR intake
                    </div>
                    <div className="mt-1 text-xs text-cyan-100/80">
                      Saved answers are stored with this startup profile and
                      will load again after relogin.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => persistStartup.mutate()}
                    disabled={persistStartup.isPending || isEditingLocked}
                    className="bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {persistStartup.isPending
                      ? "Saving…"
                      : isNew
                        ? "Create & Save Intake"
                        : "Save IPR Intake"}
                  </button>
                </div>
              </>
            ) : (
              <div className="border-t border-slate-800/70 pt-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {iprSectionSummaries.map((section) => (
                    <div
                      key={section.title}
                      className="border-l border-slate-800/70 px-4 py-3"
                    >
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        {section.title}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white">
                        {section.answered}/{section.total} answered
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-3">
                  {iprPreviewAnswers.length > 0 ? (
                    iprPreviewAnswers.slice(0, 4).map((item) => (
                      <div
                        key={item.key}
                        className="border-l border-slate-800/70 px-4 py-3"
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {item.label}
                        </div>
                        <div className="mt-2 line-clamp-2 text-sm leading-6 text-slate-200">
                          {formatStartupIprValue(item.key, item.value)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="border border-dashed border-slate-800 px-4 py-5 text-sm text-slate-400">
                      No written intake answers have been saved yet. Use Edit to
                      complete the questionnaire.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <fieldset disabled={isEditingLocked} className="space-y-8">
            <div className={sectionClassName}>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">
                    Documents & Assets
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Pitch deck and IPR supporting files
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm text-slate-400">
                    Keep uploads lean. Add the pitch deck once, then upload only
                    the IPR files required for the current stage.
                    {isNew
                      ? " Your first upload will create the startup draft automatically."
                      : ""}
                  </p>
                </div>
                {!isNew ? (
                  <div className="border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100">
                    {requiredDocumentCategories.length} required upload{" "}
                    {requiredDocumentCategories.length === 1 ? "slot" : "slots"}
                  </div>
                ) : null}
              </div>

              <div
                className={`mt-5 grid gap-8 ${isNew ? "" : "xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"}`}
              >
                {!isNew ? (
                  <div className="space-y-4 border-b border-slate-800/70 pb-6 xl:border-b-0 xl:border-r xl:pb-0 xl:pr-8">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-lg font-semibold text-white">
                        Pitch Deck
                      </h3>
                      {startup?.pitchDeckUrl ? (
                        <a
                          href={startup.pitchDeckUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 border border-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:border-slate-500"
                        >
                          <Download className="w-4 h-4" />
                          Open PDF
                        </a>
                      ) : null}
                    </div>
                    <label className="flex cursor-pointer items-center gap-3 border border-dashed border-slate-700 px-4 py-4 text-white">
                      <Upload className="w-5 h-5 text-cyan-300" />
                      {isEditingLocked
                        ? "Pitch deck changes are locked"
                        : uploadPitch.isPending
                          ? "Uploading pitch deck PDF…"
                          : "Upload pitch deck PDF"}
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={handlePitchDeckSelect}
                      />
                    </label>
                    <div className="text-sm text-slate-400">
                      {uploadPitch.isPending
                        ? `Uploading: ${pendingPitchDeckName || "selected PDF"}`
                        : startup?.pitchDeckName
                          ? `Uploaded file: ${startup.pitchDeckName}`
                          : "No PDF uploaded yet."}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-6">
                  {(isNew ? newPageDocumentSpecs : requiredDocumentSpecs)
                    .length > 0 ? (
                    <div>
                      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                        {isNew ? "Required Upload" : "Mandatory Docs Upload"}
                      </div>
                      <div
                        className={
                          isNew ? "space-y-5" : "grid gap-4 md:grid-cols-2"
                        }
                      >
                        {(isNew
                          ? newPageDocumentSpecs
                          : requiredDocumentSpecs
                        ).map((spec) => renderDocumentCard(spec, true))}
                      </div>
                    </div>
                  ) : null}

                  {!isNew && optionalDocumentSpecs.length > 0 ? (
                    <div>
                      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Optional Supporting Uploads
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        {optionalDocumentSpecs.map((spec) =>
                          renderDocumentCard(spec, false),
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {!isNew ? (
              <div className={sectionClassName}>
                <h2 className="mb-4 text-xl font-semibold text-white">
                  Traction Indicators
                </h2>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { key: "patentFiled", label: "Patent Filed" },
                    { key: "mvpBuilt", label: "MVP Built" },
                    { key: "revenueGenerating", label: "Revenue Generating" },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-3 border border-slate-800 bg-slate-950/20 px-4 py-3 text-white"
                    >
                      <input
                        type="checkbox"
                        checked={
                          form.traction[
                            item.key as keyof StartupPayload["traction"]
                          ] as boolean
                        }
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            traction: {
                              ...current.traction,
                              [item.key]: event.target.checked,
                            },
                          }))
                        }
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </fieldset>
        </div>

        {!isNew ? (
          <aside className="self-start xl:sticky xl:top-6">
            <div className="space-y-8 border-l border-slate-800/70 pl-6">
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                    Next Actions
                  </div>
                  <h3 className="mt-2 font-semibold text-white">
                    What still needs attention
                  </h3>
                </div>
                <ul className="space-y-3 text-sm text-slate-300">
                  {visibleChecklistItems.map((item) => (
                    <li
                      key={item}
                      className="border-b border-slate-900 pb-3 last:border-b-0 last:pb-0"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
                {readiness?.requiredDocumentCategories.length ? (
                  <div className="border-l-2 border-slate-700 pl-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                      <FileText className="h-4 w-4" />
                      Required Docs
                    </div>
                    <div className="mt-2 text-sm text-slate-300">
                      {readiness.requiredDocumentCategories
                        .map((item) => item.replace(/_/g, " "))
                        .join(", ")}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-semibold text-white">
                    Investor Deal Flow
                  </h3>
                  <span className="text-sm text-slate-400">
                    {activeDeals.length} active deals
                  </span>
                </div>
                {dealsQuery.isLoading ? (
                  <div className="border border-dashed border-slate-700 px-4 py-5 text-sm text-slate-400">
                    Loading deal flow…
                  </div>
                ) : activeDeals.length === 0 ? (
                  <div className="border border-dashed border-slate-700 px-4 py-5 text-sm text-slate-400">
                    No investor deals yet. Launch to investors first, then
                    manage live conversations from the Investor Deals tab.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeDeals.slice(0, 3).map((deal, index) => (
                      <div
                        key={deal._id}
                        className="border-l-2 border-slate-700 pl-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-white">
                              {deal.currentStage < 2
                                ? `Investor #${index + 1}`
                                : deal.investorDisplayName}
                            </div>
                            <div className="text-sm text-slate-400">
                              {deal.nextActionLabel}
                            </div>
                          </div>
                          <span className="border border-blue-500/30 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300">
                            Stage {deal.currentStage}
                          </span>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          getStartupSectionPath(
                            currentStartupId!,
                            "investor-deals",
                          ),
                        )
                      }
                      className="border border-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:border-slate-500"
                    >
                      Open Investor Deals
                    </button>
                  </div>
                )}
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-800/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">
            Save and submit at the end of the page.
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {isNew
              ? "Create the startup first, then return here to submit it for review."
              : isEditingLocked
                ? `${editLockReason} Raise a Smart Help request if you need admin-approved edits.`
                : launchBlockedReason ||
                  "Save changes after reviewing the full profile, then launch to the marketplace from here."}
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
                title={
                  isRequestReviewBlocked
                    ? requestReviewBlockedReason
                    : "Save the latest profile and submit for admin review"
                }
                className={`border px-4 py-3 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
                  isRequestReviewBlocked
                    ? "cursor-help border-slate-800 bg-slate-900/70 text-slate-400"
                    : "border-slate-700 bg-slate-900 text-white hover:border-slate-600"
                }`}
              >
                {isRequestReviewBusy
                  ? "Submitting…"
                  : isApproved
                    ? "Approved"
                    : isUnderReview
                      ? "Under Review"
                      : "Submit for Review"}
              </button>
              {isEditingLocked ? (
                <button
                  type="button"
                  onClick={() => navigate(startupUnlockRequestPath)}
                  className="border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400/50 hover:bg-cyan-500/15"
                >
                  Request Edit Unlock
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleLaunchClick}
                aria-disabled={!canOpenLaunchModal}
                title={launchBlockedReason || "Launch to marketplace"}
                className={`inline-flex items-center gap-2 border border-cyan-500/30 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-50 ${
                  canOpenLaunchModal
                    ? "hover:border-cyan-400/50 hover:bg-cyan-500/15"
                    : "cursor-help opacity-50"
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
            disabled={persistStartup.isPending || isEditingLocked}
            className="bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {persistStartup.isPending
              ? "Saving…"
              : isNew
                ? "Create Startup Draft"
                : isEditingLocked
                  ? "Profile Locked"
                  : reviewStatus === "draft"
                    ? "Save Draft"
                    : "Save Profile"}
          </button>
        </div>
      </div>

      {showLaunchModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                Launch Your Startup To:
              </h2>
              <button
                type="button"
                aria-label="Close launch modal"
                onClick={() => setShowLaunchModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-5 border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
              Approved student-created startups can be launched to investors,
              mentors, or both. Use the dedicated workspace tab when this
              startup needs its own linked product workspace.
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
                  onClick={() =>
                    setLaunchTarget(value as "investors" | "mentors" | "both")
                  }
                  className={`w-full border px-5 py-4 text-left text-white transition ${
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
              <button
                type="button"
                onClick={() => setShowLaunchModal(false)}
                className="border border-slate-700 px-5 py-3 font-semibold text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => launchStartup.mutate(launchTarget)}
                disabled={launchStartup.isPending}
                className="border border-cyan-500/30 bg-cyan-500/10 px-5 py-3 font-semibold text-white disabled:opacity-60"
              >
                {launchStartup.isPending ? "Launching…" : "Launch Now"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
