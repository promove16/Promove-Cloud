import { ChangeEvent, useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Download, FileText, Rocket, Send, ShieldCheck, Target, TrendingUp, Upload, Users, X } from "lucide-react";
import { dealApi } from "../../api/deal.api";
import { startupApi, StartupPayload } from "../../api/startup.api";
import { workspaceApi } from "../../api/workspace.api";
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
  registrationProfile: {
    legalStructure: "private_limited",
    registrationStage: "idea",
    proposedEntityName: "",
    registeredEntityName: "",
    businessObjective: "",
    incorporationDate: "",
    incorporationState: "",
    registeredOfficeAddress: "",
    registeredOfficeCity: "",
    registeredOfficeState: "",
    registeredOfficePincode: "",
    cinOrLlpin: "",
    companyPan: "",
    tanNumber: "",
    gstin: "",
    startupIndiaStatus: "not_started",
    startupIndiaRecognitionNumber: "",
    bankAccountOpened: false,
    bankName: "",
    dscReady: false,
    founderAgreementSigned: false,
    ndaReady: false,
    employmentContractsReady: false,
    operationalLicenses: "",
    trademarkStatus: "not_started",
    patentStatus: "not_started",
  },
});

const LEGAL_STRUCTURE_OPTIONS = [
  { value: "private_limited", label: "Private Limited Company" },
  { value: "llp", label: "Limited Liability Partnership (LLP)" },
  { value: "partnership", label: "Registered Partnership Firm" },
  { value: "opc", label: "One Person Company (OPC)" },
] as const;

const REGISTRATION_STAGE_OPTIONS = [
  { value: "idea", label: "Idea stage" },
  { value: "name_reserved", label: "Name reserved" },
  { value: "incorporation_in_progress", label: "Incorporation in progress" },
  { value: "incorporated", label: "Incorporated" },
  { value: "startup_india_recognized", label: "Startup India recognized" },
] as const;

const STARTUP_INDIA_STATUS_OPTIONS = [
  { value: "not_started", label: "Not started" },
  { value: "applied", label: "Applied" },
  { value: "recognized", label: "Recognized" },
] as const;

const IPR_STATUS_OPTIONS = [
  { value: "not_started", label: "Not started" },
  { value: "applied", label: "Applied" },
  { value: "registered", label: "Registered" },
] as const;

const PATENT_STATUS_OPTIONS = [
  { value: "not_started", label: "Not started" },
  { value: "drafting", label: "Drafting" },
  { value: "filed", label: "Filed" },
  { value: "granted", label: "Granted" },
] as const;

const STARTUP_DOCUMENT_SPECS: Array<{ category: StartupDocumentCategory; label: string; hint: string }> = [
  { category: "business_plan", label: "Business plan", hint: "Business plan, financial model, or operating plan" },
  { category: "founder_agreement", label: "Founder agreement", hint: "Roles, equity split, vesting, and dispute clauses" },
  { category: "incorporation_certificate", label: "Certificate of incorporation", hint: "MCA or firm registration certificate" },
  { category: "moa", label: "MOA", hint: "Memorandum of Association for private limited / OPC" },
  { category: "aoa", label: "AOA", hint: "Articles of Association for private limited / OPC" },
  { category: "llp_agreement", label: "LLP agreement", hint: "LLP deed or governing agreement" },
  { category: "partnership_deed", label: "Partnership deed", hint: "Registered partnership deed" },
  { category: "registered_office_proof", label: "Registered office proof", hint: "Rent agreement, ownership deed, or office proof" },
  { category: "office_noc_or_utility_bill", label: "Office NOC / utility bill", hint: "NOC, electricity bill, or address proof" },
  { category: "company_pan", label: "Company PAN", hint: "PAN card or PAN allotment proof" },
  { category: "tan_allotment", label: "TAN allotment", hint: "TAN proof if available" },
  { category: "gst_registration", label: "GST registration", hint: "GST certificate if registered" },
  { category: "startup_india_certificate", label: "Startup India certificate", hint: "DPIIT / Startup India recognition certificate" },
  { category: "trademark_certificate", label: "Trademark certificate", hint: "Trademark application or registration proof" },
  { category: "patent_proof", label: "Patent proof", hint: "Patent filing receipt or grant proof" },
  { category: "bank_account_proof", label: "Bank account proof", hint: "Cancelled cheque or bank letter" },
  { category: "regulatory_license", label: "Regulatory license", hint: "FSSAI, IEC, or sector-specific license" },
] as const;

const isIncorporatedStage = (registrationStage: StartupRegistrationProfile["registrationStage"]) =>
  registrationStage === "incorporated" || registrationStage === "startup_india_recognized";

const getRequiredStartupDocumentCategories = (
  registrationProfile: StartupRegistrationProfile,
): StartupDocumentCategory[] => {
  const categories = new Set<StartupDocumentCategory>(["founder_agreement"]);

  if (isIncorporatedStage(registrationProfile.registrationStage)) {
    categories.add("business_plan");
    categories.add("incorporation_certificate");
    categories.add("registered_office_proof");
    categories.add("office_noc_or_utility_bill");
    categories.add("company_pan");

    if (registrationProfile.legalStructure === "private_limited" || registrationProfile.legalStructure === "opc") {
      categories.add("moa");
      categories.add("aoa");
    }

    if (registrationProfile.legalStructure === "llp") {
      categories.add("llp_agreement");
    }

    if (registrationProfile.legalStructure === "partnership") {
      categories.add("partnership_deed");
    }
  }

  if (
    registrationProfile.startupIndiaStatus === "recognized" ||
    registrationProfile.registrationStage === "startup_india_recognized"
  ) {
    categories.add("startup_india_certificate");
  }

  if (registrationProfile.trademarkStatus === "registered") {
    categories.add("trademark_certificate");
  }

  if (registrationProfile.patentStatus === "filed" || registrationProfile.patentStatus === "granted") {
    categories.add("patent_proof");
  }

  return Array.from(categories);
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
  const startupId = context?.startupId ?? normalizeStartupRouteId(paramId);
  const isNew = !startupId;

  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [launchTarget, setLaunchTarget] = useState<"investors" | "mentors" | "both">("both");
  const [toast, setToast] = useState("");
  const [pendingPitchDeckName, setPendingPitchDeckName] = useState("");
  const [pendingDocumentCategory, setPendingDocumentCategory] = useState<StartupDocumentCategory | null>(null);
  const [form, setForm] = useState<StartupPayload>(() => createEmptyPayload());

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
        incorporationDate: startup.registrationProfile?.incorporationDate ?? "",
      },
    });
  }, [startup]);

  useEffect(() => {
    if (startup) {
      return;
    }

    if (isNew) {
      setForm(createEmptyPayload());
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

  const uploadDocument = useMutation({
    mutationFn: async ({ file, category }: { file: File; category: StartupDocumentCategory }) => {
      const savedStartup = startup?._id ? startup : await persistStartup.mutateAsync();
      return startupApi.uploadDocument(savedStartup._id, file, category);
    },
    onSuccess: async (savedStartup, variables) => {
      setPendingDocumentCategory(null);
      queryClient.setQueryData(["startup", savedStartup._id], savedStartup);
      setToast(`${STARTUP_DOCUMENT_SPECS.find((item) => item.category === variables.category)?.label ?? "Startup document"} uploaded.`);
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

    if (file.size > maxPitchDeckSizeBytes) {
      setPendingDocumentCategory(null);
      setToast("Startup documents must be 10MB or smaller.");
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
  const formTeamSize = startup ? form.teamSize : form.teamSize || teamSize;
  const requiredDocumentCategories = getRequiredStartupDocumentCategories(form.registrationProfile);
  const currentDocuments = startup?.documents ?? [];
  const documentsByCategory = new Map(currentDocuments.map((document) => [document.category, document]));
  const canLaunch = Boolean(form.name.trim() && form.tagline.trim() && form.category.trim() && formTeamSize > 0);
  const reviewStatus = startup?.reviewStatus ?? "draft";
  const isApproved = reviewStatus === "approved";
  const isUnderReview = reviewStatus === "review_requested";
  const hasChangesRequested = reviewStatus === "changes_requested";
  const readiness = startup?.readiness;
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
          : "Complete the business plan, registration profile, and required legal documents before submitting for admin review.";
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
    { label: "Active products", value: String(startup?.activeProducts ?? form.activeProducts), icon: Target, tone: "text-violet-300" },
    { label: "Status", value: profileStatusLabel, icon: CheckCircle, tone: "text-amber-300" },
  ] as const;
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
      ? "Required registration fields and document categories are complete."
      : `Still missing: ${readiness?.missingItems.slice(0, 3).join(", ") || "registration details"}`,
    requiredDocumentCategories.length > 0
      ? `${requiredDocumentCategories.length} document categories are required at the current registration stage.`
      : "No mandatory legal uploads are required at the current stage yet.",
  ];
  const sectionClassName = "rounded-2xl border border-slate-800/70 bg-slate-900/40 p-6 sm:p-7";
  const fieldClassName =
    "w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-500";
  const textareaClassName = `${fieldClassName} min-h-28 resize-y`;

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
              ? "Start with the essentials, then build out registration and launch assets."
              : "Edit the profile, keep launch requirements visible, and submit only when the profile is ready."}
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
                    ? "All required registration fields and document categories are complete."
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

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.7fr)_320px]">
        <div className="space-y-8">
          <div className={`${sectionClassName} grid gap-4 md:grid-cols-2`}>
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
                <label className="block text-sm font-semibold text-white mb-2">Product stage</label>
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
                <label className="block text-sm font-semibold text-white mb-2">Active products</label>
                <input type="number" value={form.activeProducts} onChange={(event) => setForm((current) => ({ ...current, activeProducts: Number(event.target.value) || 1 }))} className={fieldClassName} />
              </div>
          </div>

          <div className={`${sectionClassName} space-y-4`}>
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">Business Plan</div>
                <h2 className="mt-2 text-xl font-semibold text-white">Founder narrative and market case</h2>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {[
                  ["problemStatement", "Problem statement", "What core problem are you solving?"],
                  ["solutionSummary", "Solution summary", "What does the startup do differently?"],
                  ["targetCustomers", "Target customers", "Who pays or benefits from the product?"],
                  ["marketAnalysis", "Market analysis", "Market size, competition, and positioning"],
                  ["revenueModel", "Revenue model", "How will the startup make money?"],
                  ["goToMarketPlan", "Go-to-market plan", "How will you acquire users and distribution?"],
                ].map(([key, label, placeholder]) => (
                  <div key={key}>
                    <label className="block text-sm font-semibold text-white mb-2">{label}</label>
                    <textarea
                      value={form.businessProfile[key as keyof StartupPayload["businessProfile"]]}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          businessProfile: { ...current.businessProfile, [key]: event.target.value },
                        }))
                      }
                      placeholder={placeholder}
                      className={textareaClassName}
                    />
                  </div>
                ))}
              </div>
          </div>

          <div className={`${sectionClassName} space-y-4`}>
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">Registration Flow</div>
                <h2 className="mt-2 text-xl font-semibold text-white">Entity, incorporation, and compliance details</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Legal structure</label>
                  <select
                    value={form.registrationProfile.legalStructure}
                    onChange={(event) => updateRegistrationField("legalStructure", event.target.value as StartupRegistrationProfile["legalStructure"])}
                    className={fieldClassName}
                  >
                    {LEGAL_STRUCTURE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Registration stage</label>
                  <select
                    value={form.registrationProfile.registrationStage}
                    onChange={(event) => updateRegistrationField("registrationStage", event.target.value as StartupRegistrationProfile["registrationStage"])}
                    className={fieldClassName}
                  >
                    {REGISTRATION_STAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Proposed entity name</label>
                  <input
                    value={form.registrationProfile.proposedEntityName}
                    onChange={(event) => updateRegistrationField("proposedEntityName", event.target.value)}
                    className={fieldClassName}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Registered entity name</label>
                  <input
                    value={form.registrationProfile.registeredEntityName ?? ""}
                    onChange={(event) => updateRegistrationField("registeredEntityName", event.target.value)}
                    className={fieldClassName}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-white mb-2">Business objective</label>
                  <textarea
                    value={form.registrationProfile.businessObjective}
                    onChange={(event) => updateRegistrationField("businessObjective", event.target.value)}
                    className={`${fieldClassName} min-h-24 resize-y`}
                    placeholder="Describe the purpose of the company and its planned commercial activity."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Incorporation date</label>
                  <input
                    type="date"
                    value={form.registrationProfile.incorporationDate ?? ""}
                    onChange={(event) => updateRegistrationField("incorporationDate", event.target.value)}
                    className={fieldClassName}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Incorporation state</label>
                  <input
                    value={form.registrationProfile.incorporationState}
                    onChange={(event) => updateRegistrationField("incorporationState", event.target.value)}
                    className={fieldClassName}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-white mb-2">Registered office address</label>
                  <textarea
                    value={form.registrationProfile.registeredOfficeAddress}
                    onChange={(event) => updateRegistrationField("registeredOfficeAddress", event.target.value)}
                    className={`${fieldClassName} min-h-24 resize-y`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">City</label>
                  <input value={form.registrationProfile.registeredOfficeCity} onChange={(event) => updateRegistrationField("registeredOfficeCity", event.target.value)} className={fieldClassName} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">State</label>
                  <input value={form.registrationProfile.registeredOfficeState} onChange={(event) => updateRegistrationField("registeredOfficeState", event.target.value)} className={fieldClassName} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Pincode</label>
                  <input value={form.registrationProfile.registeredOfficePincode} onChange={(event) => updateRegistrationField("registeredOfficePincode", event.target.value)} className={fieldClassName} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">CIN / LLPIN</label>
                  <input value={form.registrationProfile.cinOrLlpin ?? ""} onChange={(event) => updateRegistrationField("cinOrLlpin", event.target.value)} className={fieldClassName} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Company PAN</label>
                  <input value={form.registrationProfile.companyPan ?? ""} onChange={(event) => updateRegistrationField("companyPan", event.target.value.toUpperCase())} className={fieldClassName} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">TAN</label>
                  <input value={form.registrationProfile.tanNumber ?? ""} onChange={(event) => updateRegistrationField("tanNumber", event.target.value.toUpperCase())} className={fieldClassName} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">GSTIN</label>
                  <input value={form.registrationProfile.gstin ?? ""} onChange={(event) => updateRegistrationField("gstin", event.target.value.toUpperCase())} className={fieldClassName} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Startup India status</label>
                  <select
                    value={form.registrationProfile.startupIndiaStatus}
                    onChange={(event) => updateRegistrationField("startupIndiaStatus", event.target.value as StartupRegistrationProfile["startupIndiaStatus"])}
                    className={fieldClassName}
                  >
                    {STARTUP_INDIA_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Startup India recognition number</label>
                  <input value={form.registrationProfile.startupIndiaRecognitionNumber ?? ""} onChange={(event) => updateRegistrationField("startupIndiaRecognitionNumber", event.target.value)} className={fieldClassName} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Trademark status</label>
                  <select
                    value={form.registrationProfile.trademarkStatus}
                    onChange={(event) => updateRegistrationField("trademarkStatus", event.target.value as StartupRegistrationProfile["trademarkStatus"])}
                    className={fieldClassName}
                  >
                    {IPR_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Patent status</label>
                  <select
                    value={form.registrationProfile.patentStatus}
                    onChange={(event) => updateRegistrationField("patentStatus", event.target.value as StartupRegistrationProfile["patentStatus"])}
                    className={fieldClassName}
                  >
                    {PATENT_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ["dscReady", "Digital Signature Certificate ready"],
                  ["founderAgreementSigned", "Founder agreement signed"],
                  ["ndaReady", "NDA / confidentiality template ready"],
                  ["employmentContractsReady", "Employment / contractor agreements ready"],
                  ["bankAccountOpened", "Startup bank account opened"],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white">
                    <input
                      type="checkbox"
                      checked={Boolean(form.registrationProfile[key as keyof StartupRegistrationProfile])}
                      onChange={(event) => updateRegistrationField(key as keyof StartupRegistrationProfile, event.target.checked as never)}
                    />
                    {label}
                  </label>
                ))}
              </div>

              {form.registrationProfile.bankAccountOpened ? (
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Bank name</label>
                  <input value={form.registrationProfile.bankName ?? ""} onChange={(event) => updateRegistrationField("bankName", event.target.value)} className={fieldClassName} />
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-semibold text-white mb-2">Operational licenses / notes</label>
                <textarea
                  value={form.registrationProfile.operationalLicenses}
                  onChange={(event) => updateRegistrationField("operationalLicenses", event.target.value)}
                  className={`${fieldClassName} min-h-24 resize-y`}
                  placeholder="List FSSAI, IEC, sector approvals, or explain if none are needed yet."
                />
              </div>
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

          {!isNew ? (
            <div className={sectionClassName}>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Startup Registration Document Vault</h2>
                    <p className="mt-1 text-sm text-slate-400">Upload the legal, compliance, and IP documents needed for entity setup and admin review.</p>
                  </div>
                  <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100">
                    {requiredDocumentCategories.length} required document categories
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {STARTUP_DOCUMENT_SPECS.map((spec) => {
                    const uploadedDocument = documentsByCategory.get(spec.category);
                    const isRequired = requiredDocumentCategories.includes(spec.category);
                    const isUploading = pendingDocumentCategory === spec.category && uploadDocument.isPending;

                    return (
                      <div key={spec.category} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                          {spec.label}
                          {isRequired ? <span className="text-red-400">*</span> : null}
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
                          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-700 px-4 py-4 text-sm text-slate-300">
                            <Upload className="h-4 w-4 text-cyan-300" />
                            {isUploading ? "Uploading..." : "Upload PDF or image"}
                            <input type="file" accept="application/pdf,.pdf,image/*" className="hidden" onChange={(event) => handleStartupDocumentSelect(spec.category, event)} />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
            </div>
          ) : null}

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
        </div>

        <div className="space-y-8 xl:sticky xl:top-6 self-start">
          <div className="overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/40">
            <div className="border-b border-slate-800/70 px-6 py-5">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Founder Team</div>
              <h3 className="mt-2 font-semibold text-white">Active workspace members</h3>
            </div>
            <div className="px-6 py-5">
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
                <li>Launch to recruiters is available from Leadership Profile too</li>
              </ul>
              {!isNew && readiness?.requiredDocumentCategories.length ? (
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

          {!isNew ? (
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

        <div className="flex flex-col gap-4 border-t border-slate-800/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Save and submit at the end of the page.</p>
            <p className="mt-1 text-sm text-slate-400">
              {isNew
                ? "Create the startup first, then return here to submit it for review."
                : "Save changes after reviewing the full profile, then request review and launch from here."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            {!isNew ? (
              <>
                <button
                  type="button"
                  onClick={() => requestReview.mutate()}
                  disabled={!startup?.readiness?.isReviewReady || isUnderReview || requestReview.isPending || launchStartup.isPending}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:border-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {requestReview.isPending ? "Submitting..." : isApproved ? "Approved" : isUnderReview ? "Under Review" : "Submit for Review"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLaunchModal(true)}
                  disabled={!canLaunch || !isApproved}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
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
              {persistStartup.isPending ? "Saving..." : isNew ? "Create Startup" : "Save Profile"}
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
