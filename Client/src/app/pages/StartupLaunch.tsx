import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Award,
  Banknote,
  Boxes,
  CheckCircle2,
  Clock,
  CircleDot,
  Edit3,
  FileText,
  Flag,
  FolderKanban,
  Loader2,
  Package,
  PieChart as PieIcon,
  Rocket,
  Save,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { startupApi, type StartupPayload } from "../../api/startup.api";
import { workspaceApi } from "../../api/workspace.api";
import { dealApi } from "../../api/deal.api";
import { DEFAULT_STARTUP_INIT_PROFILE } from "../../features/startup/iprIntake";
import {
  buildInnovationScorePreview,
  DEFAULT_STARTUP_INNOVATION_PROFILE,
  STARTUP_FUNDING_STATUS_OPTIONS,
  STARTUP_LEGAL_STRUCTURE_OPTIONS,
  STARTUP_PATENT_STATUS_OPTIONS,
  STARTUP_RUBRIC_DOCUMENT_MAX_BYTES,
  STARTUP_RUBRIC_DOCUMENT_SPECS,
  STARTUP_RUBRIC_PITCH_ACCEPT,
  STARTUP_RUBRIC_PITCH_MAX_BYTES,
  STARTUP_SCORING_STAGE_OPTIONS,
} from "../../features/startup/innovationRubric";
import {
  getStartupOverviewPath,
  normalizeStartupRouteId,
} from "../../features/startup/navigation";
import { Spinner } from "../../components/ui/Spinner";
import { toast } from "../components/ui/sonner";
import { getApiErrorMessage } from "../../utils/apiError";
import type {
  Startup,
  StartupBusinessProfile,
  StartupDocumentCategory,
  StartupInnovationProfile,
  StartupRegistrationProfile,
} from "../../types/startup.types";

const DEFAULT_BUSINESS_PROFILE: StartupBusinessProfile = {
  problemStatement: "",
  solutionSummary: "",
  targetCustomers: "",
  marketAnalysis: "",
  revenueModel: "",
  goToMarketPlan: "",
};

const DEFAULT_REGISTRATION_PROFILE: StartupRegistrationProfile = {
  problemStatement: "",
  solutionDifferentiation: "",
  coreInnovation: "",
  priorArtStatus: "",
  workingMechanism: "",
  keyComponents: "",
  developmentStage: "idea",
  documentationReadiness: "",
  inventorOwnership: "individual",
  developmentContext: "",
  targetMarkets: "",
  commercializationStrategy: "build_startup",
  publicDisclosureStatus: "",
  legalAgreements: "",
  ipProtectionType: "patent",
};

interface IdentityForm {
  name: string;
  tagline: string;
  category: string;
  teamSize: number;
  activeProducts: number;
  fundingNeeded: number;
}

const DEFAULT_IDENTITY: IdentityForm = {
  name: "",
  tagline: "",
  category: "",
  teamSize: 1,
  activeProducts: 0,
  fundingNeeded: 0,
};

const fieldCls =
  "w-full border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/60";

const REVIEW_BADGE: Record<
  Startup["reviewStatus"],
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "border-slate-700 bg-slate-900 text-slate-300",
  },
  review_requested: {
    label: "Under Review",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  },
  changes_requested: {
    label: "Changes Requested",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  },
  approved: {
    label: "Approved",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  },
};

const formatINR = (value?: number) => {
  if (!value) return "--";
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1)} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)} L`;
  return `₹${value.toLocaleString("en-IN")}`;
};

const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      })
    : "--";

const formatFileSize = (bytes: number) =>
  `${Math.round(bytes / (1024 * 1024))} MB max`;

const weekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const STARTUP_TRUST_PROOF_CATEGORIES: StartupDocumentCategory[] = [
  "incorporation_certificate",
  "startup_india_certificate",
  "dpiit_certificate",
  "udyam_certificate",
  "government_certificate_other",
  "business_plan",
  "dpr",
  "patent_proof",
  "itr_filing",
  "revenue_proof",
  "grant_certificate",
  "award_certificate",
  "funding_proof",
];

const STARTUP_LEGAL_STRUCTURE_LABELS: Record<string, string> = {
  sole_proprietorship: "Sole Proprietorship",
  partnership: "Partnership",
  llp: "LLP",
  private_limited: "Pvt Ltd",
  opc: "OPC",
  public_limited: "Public Ltd",
};

const STARTUP_FUNDING_STATUS_LABELS: Record<string, string> = {
  bootstrapped: "Bootstrapped",
  angel_seed: "Angel / Seed",
  vc: "VC Funded",
};

const hasStartupDocument = (
  startup: Startup,
  ...categories: StartupDocumentCategory[]
) =>
  categories.some((category) =>
    (startup.documents ?? []).some(
      (document) => document.category === category,
    ),
  );

const buildStartupTrustSummary = (startup: Startup) => {
  const companyProfile = startup.innovationProfile?.companyProfile;
  const tractionProfile = startup.innovationProfile?.tractionProfile;
  const legalStructure = companyProfile?.legalStructure;
  const legalStructureLabel =
    legalStructure && legalStructure !== "not_registered"
      ? (STARTUP_LEGAL_STRUCTURE_LABELS[legalStructure] ?? legalStructure)
      : undefined;
  const fundingStatus = tractionProfile?.fundingStatus;
  const fundingStatusLabel =
    fundingStatus && fundingStatus !== "none"
      ? (STARTUP_FUNDING_STATUS_LABELS[fundingStatus] ?? fundingStatus)
      : undefined;
  const patentLabel =
    tractionProfile?.patentStatus === "published"
      ? "Patent Published"
      : tractionProfile?.patentStatus === "filed" ||
          startup.traction?.patentFiled
        ? "Patent Filed"
        : undefined;
  const proofCount =
    STARTUP_TRUST_PROOF_CATEGORIES.filter((category) =>
      hasStartupDocument(startup, category),
    ).length + (startup.pitchDeckUrl ? 1 : 0);
  const signals = Array.from(
    new Set(
      [
        legalStructureLabel ? "Registered Entity" : "",
        companyProfile?.cinNumber ? "CIN Listed" : "",
        companyProfile?.dpiitRecognitionNumber ||
        hasStartupDocument(
          startup,
          "startup_india_certificate",
          "dpiit_certificate",
        )
          ? "DPIIT Recognized"
          : "",
        companyProfile?.msmeUdyamNumber ||
        hasStartupDocument(startup, "udyam_certificate")
          ? "Udyam Registered"
          : "",
        companyProfile?.otherGovernmentCertificationName ||
        companyProfile?.otherGovernmentCertificationNumber ||
        hasStartupDocument(startup, "government_certificate_other")
          ? "Govt Certified"
          : "",
        startup.pitchDeckUrl ? "Pitch Deck Ready" : "",
        hasStartupDocument(startup, "business_plan", "dpr") ? "DPR Ready" : "",
        companyProfile?.websiteUrl ? "Website Live" : "",
        companyProfile?.productDemoUrl ? "Demo Available" : "",
        companyProfile?.portfolioUrl ? "Portfolio Linked" : "",
        patentLabel,
        tractionProfile?.hasItrFiling ||
        hasStartupDocument(startup, "itr_filing")
          ? "ITR Filed"
          : "",
        tractionProfile?.hasRevenueProof ||
        hasStartupDocument(startup, "revenue_proof")
          ? "Revenue Verified"
          : "",
        tractionProfile?.hasGovernmentGrant ||
        hasStartupDocument(startup, "grant_certificate")
          ? "Grant Backed"
          : "",
        tractionProfile?.hasAwardRecognition ||
        hasStartupDocument(startup, "award_certificate")
          ? "Award Recognized"
          : "",
        fundingStatus === "bootstrapped"
          ? "Bootstrapped"
          : fundingStatus === "angel_seed"
            ? "Angel Backed"
            : fundingStatus === "vc"
              ? "VC Funded"
              : "",
        hasStartupDocument(startup, "funding_proof") ? "Funding Verified" : "",
      ].filter(Boolean),
    ),
  ) as string[];

  return {
    signals,
    proofCount,
    links: [
      { label: "Website", url: companyProfile?.websiteUrl },
      { label: "Product demo", url: companyProfile?.productDemoUrl },
      { label: "Portfolio", url: companyProfile?.portfolioUrl },
    ].filter((entry): entry is { label: string; url: string } =>
      Boolean(entry.url),
    ),
    credentialRows: [
      {
        label: "Legal entity",
        value: legalStructureLabel ?? "Not added",
        done: Boolean(legalStructureLabel),
      },
      {
        label: "CIN",
        value: companyProfile?.cinNumber || "Not added",
        done: Boolean(companyProfile?.cinNumber),
      },
      {
        label: "DPIIT",
        value:
          companyProfile?.dpiitRecognitionNumber ||
          (hasStartupDocument(
            startup,
            "startup_india_certificate",
            "dpiit_certificate",
          )
            ? "Proof uploaded"
            : "Not added"),
        done: Boolean(
          companyProfile?.dpiitRecognitionNumber ||
          hasStartupDocument(
            startup,
            "startup_india_certificate",
            "dpiit_certificate",
          ),
        ),
      },
      {
        label: "Udyam",
        value:
          companyProfile?.msmeUdyamNumber ||
          (hasStartupDocument(startup, "udyam_certificate")
            ? "Proof uploaded"
            : "Not added"),
        done: Boolean(
          companyProfile?.msmeUdyamNumber ||
          hasStartupDocument(startup, "udyam_certificate"),
        ),
      },
      {
        label: "Patent status",
        value: patentLabel ?? "No patent claim",
        done: Boolean(patentLabel),
      },
      {
        label: "Funding status",
        value: fundingStatusLabel ?? "Not disclosed",
        done: Boolean(fundingStatusLabel),
      },
    ],
    proofRows: [
      {
        label: "Pitch deck",
        done: Boolean(startup.pitchDeckUrl),
      },
      {
        label: "DPR",
        done: hasStartupDocument(startup, "business_plan", "dpr"),
      },
      {
        label: "ITR filing",
        done:
          Boolean(tractionProfile?.hasItrFiling) ||
          hasStartupDocument(startup, "itr_filing"),
      },
      {
        label: "Revenue proof",
        done:
          Boolean(tractionProfile?.hasRevenueProof) ||
          hasStartupDocument(startup, "revenue_proof"),
      },
      {
        label: "Grant proof",
        done:
          Boolean(tractionProfile?.hasGovernmentGrant) ||
          hasStartupDocument(startup, "grant_certificate"),
      },
      {
        label: "Award proof",
        done:
          Boolean(tractionProfile?.hasAwardRecognition) ||
          hasStartupDocument(startup, "award_certificate"),
      },
      {
        label: "Funding proof",
        done: hasStartupDocument(startup, "funding_proof"),
      },
    ],
  };
};

export function StartupLaunch() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { startupId: routeStartupId } = useParams<{ startupId?: string }>();
  const outletContext = useOutletContext<{ startupId?: string } | null>();
  const startupId = normalizeStartupRouteId(
    outletContext?.startupId ?? routeStartupId,
  );

  const startupQuery = useQuery({
    queryKey: ["startup", startupId],
    queryFn: () => startupApi.getById(startupId!),
    enabled: Boolean(startupId),
  });
  const startup = startupQuery.data;
  const hasSavedSetup = Boolean(
    startup && startup.name?.trim() && startup.category?.trim(),
  );
  const canEditSetup = !startupId || Boolean(startup?.editAccess?.canEdit);

  const [mode, setMode] = useState<"dashboard" | "edit">(
    startupId ? "dashboard" : "edit",
  );

  useEffect(() => {
    setMode(startupId ? "dashboard" : "edit");
  }, [startupId]);

  const [identity, setIdentity] = useState<IdentityForm>(DEFAULT_IDENTITY);
  const [innovationProfile, setInnovationProfile] =
    useState<StartupInnovationProfile>(DEFAULT_STARTUP_INNOVATION_PROFILE);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!startup) return;
    setIdentity({
      name: startup.name ?? "",
      tagline: startup.tagline ?? "",
      category: startup.category ?? "",
      teamSize: startup.teamSize ?? 1,
      activeProducts: startup.activeProducts ?? 0,
      fundingNeeded: startup.fundingNeeded ?? 0,
    });
    setInnovationProfile({
      ...DEFAULT_STARTUP_INNOVATION_PROFILE,
      ...(startup.innovationProfile ?? {}),
      companyProfile: {
        ...DEFAULT_STARTUP_INNOVATION_PROFILE.companyProfile,
        ...(startup.innovationProfile?.companyProfile ?? {}),
      },
      tractionProfile: {
        ...DEFAULT_STARTUP_INNOVATION_PROFILE.tractionProfile,
        ...(startup.innovationProfile?.tractionProfile ?? {}),
      },
    });
  }, [startup]);

  const basePayload = useMemo<StartupPayload>(
    () => ({
      name: identity.name.trim(),
      tagline: identity.tagline.trim(),
      category: identity.category.trim(),
      stage: startup?.stage ?? "Ideation",
      teamSize: Number(identity.teamSize) || 0,
      activeProducts: Number(identity.activeProducts) || 0,
      fundingNeeded: Number(identity.fundingNeeded) || 0,
      traction: {
        patentFiled: startup?.traction?.patentFiled ?? false,
        mvpBuilt: startup?.traction?.mvpBuilt ?? false,
        revenueGenerating: startup?.traction?.revenueGenerating ?? false,
        usersCount: startup?.traction?.usersCount,
        patentType: startup?.traction?.patentType,
        patentApplicationId: startup?.traction?.patentApplicationId,
      },
      businessProfile: startup?.businessProfile ?? DEFAULT_BUSINESS_PROFILE,
      registrationProfile:
        startup?.registrationProfile ?? DEFAULT_REGISTRATION_PROFILE,
      initializationProfile:
        startup?.initializationProfile ?? DEFAULT_STARTUP_INIT_PROFILE,
      innovationProfile,
    }),
    [identity, innovationProfile, startup],
  );

  const uploadedDocumentCategories = useMemo(
    () => (startup?.documents ?? []).map((document) => document.category),
    [startup?.documents],
  );

  const documentsByCategory = useMemo(
    () =>
      new Map(
        (startup?.documents ?? []).map((document) => [
          document.category,
          document,
        ]),
      ),
    [startup?.documents],
  );

  const scorePreview = useMemo(
    () =>
      buildInnovationScorePreview({
        innovationProfile,
        pitchDeckUploaded: Boolean(startup?.pitchDeckUrl),
        uploadedDocumentCategories,
      }),
    [innovationProfile, startup?.pitchDeckUrl, uploadedDocumentCategories],
  );

  const save = useMutation({
    mutationFn: async () => {
      if (startupId) {
        return startupApi.update(startupId, basePayload);
      }
      return startupApi.create(basePayload);
    },
    onSuccess: async (saved) => {
      toast.success(startupId ? "Startup updated." : "Startup created.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["startup"] }),
        queryClient.invalidateQueries({ queryKey: ["startup", saved._id] }),
      ]);
      if (!startupId) {
        navigate(getStartupOverviewPath(saved._id));
      } else {
        setMode("dashboard");
      }
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Unable to save startup."));
    },
  });

  const uploadPitch = useMutation({
    mutationFn: async (file: File) => startupApi.uploadPitch(startupId!, file),
    onMutate: () => {
      setUploadingKey("pitch");
    },
    onSuccess: async (saved) => {
      toast.success("Pitch deck uploaded.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["startup"] }),
        queryClient.invalidateQueries({ queryKey: ["startup", saved._id] }),
      ]);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Unable to upload pitch deck."));
    },
    onSettled: () => {
      setUploadingKey(null);
    },
  });

  const uploadDocument = useMutation({
    mutationFn: async ({
      file,
      category,
    }: {
      file: File;
      category: StartupDocumentCategory;
    }) => startupApi.uploadDocument(startupId!, file, category),
    onMutate: ({ category }) => {
      setUploadingKey(category);
    },
    onSuccess: async (saved) => {
      toast.success("Proof uploaded.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["startup"] }),
        queryClient.invalidateQueries({ queryKey: ["startup", saved._id] }),
      ]);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Unable to upload document."));
    },
    onSettled: () => {
      setUploadingKey(null);
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async ({
      category,
      documentId,
    }: {
      category: StartupDocumentCategory;
      documentId: string;
    }) => startupApi.deleteDocument(startupId!, documentId),
    onMutate: ({ category }) => {
      setUploadingKey(`delete-${category}`);
    },
    onSuccess: async (saved) => {
      toast.success("Document removed.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["startup"] }),
        queryClient.invalidateQueries({ queryKey: ["startup", saved._id] }),
      ]);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Unable to remove document."));
    },
    onSettled: () => {
      setUploadingKey(null);
    },
  });

  const canSubmit =
    canEditSetup &&
    identity.name.trim().length > 0 &&
    identity.category.trim().length > 0 &&
    !save.isPending;

  const canUpload = Boolean(startupId);

  const handlePitchSelected = (file: File | null) => {
    if (!file) return;
    if (!startupId) {
      toast.error("Save the startup once before uploading pitch files.");
      return;
    }
    if (file.size > STARTUP_RUBRIC_PITCH_MAX_BYTES) {
      toast.error(
        `Pitch deck must be ${formatFileSize(STARTUP_RUBRIC_PITCH_MAX_BYTES)} or less.`,
      );
      return;
    }
    uploadPitch.mutate(file);
  };

  const handleDocumentSelected = (
    category: StartupDocumentCategory,
    file: File | null,
  ) => {
    if (!file) return;
    if (!startupId) {
      toast.error("Save the startup once before uploading proof files.");
      return;
    }
    if (file.size > STARTUP_RUBRIC_DOCUMENT_MAX_BYTES) {
      toast.error(
        `Document must be ${formatFileSize(STARTUP_RUBRIC_DOCUMENT_MAX_BYTES)} or less.`,
      );
      return;
    }
    uploadDocument.mutate({ file, category });
  };

  if (startupId && startupQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (startupId && startupQuery.isError) {
    return (
      <div className="border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
        Unable to load startup.
      </div>
    );
  }

  const showDashboard = hasSavedSetup && mode === "dashboard" && startup;

  if (showDashboard) {
    return (
      <StartupDashboard
        startup={startup}
        onEdit={() => setMode("edit")}
        canEdit={canEditSetup}
      />
    );
  }

  const missingItems = startup?.readiness?.missingItems ?? [];

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        save.mutate();
      }}
      className="space-y-6"
    >
      {startup?.editAccess?.isLocked ? (
        <div className="border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          Editing is locked. {startup.editAccess.reason}
        </div>
      ) : null}
      {!startupId ? (
        <div className="border border-cyan-500/20 bg-cyan-500/5 px-4 py-2 text-sm text-cyan-100">
          Save the startup once to enable all proof uploads.
        </div>
      ) : null}

      {hasSavedSetup ? (
        <div className="flex items-center justify-between border border-slate-800 bg-slate-950 px-4 py-2.5">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Editing Setup
          </span>
          <button
            type="button"
            onClick={() => setMode("dashboard")}
            className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
          >
            Back to Dashboard
          </button>
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          <KpiCard
            icon={<Sparkles className="h-4 w-4" />}
            label="Score Preview"
            value={`${scorePreview.total}/1000`}
          />
          <KpiCard
            icon={<FileText className="h-4 w-4" />}
            label="Company Profile"
            value={`${scorePreview.companyProfile.total}/250`}
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Health & Traction"
            value={`${scorePreview.healthAndTraction.total}/750`}
          />
          <KpiCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Proofs Uploaded"
            value={String((startup?.documents ?? []).length)}
          />
        </div>
        <div className="border border-slate-800 bg-slate-950 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Readiness
            </h2>
            <span
              className={`border px-2 py-1 text-[11px] font-semibold uppercase ${
                startup?.readiness?.isReviewReady
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-200"
              }`}
            >
              {startup?.readiness?.isReviewReady ? "Ready" : "In Progress"}
            </span>
          </div>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            {missingItems.length > 0 ? (
              missingItems.slice(0, 6).map((item) => (
                <div
                  key={item}
                  className="border border-slate-800 bg-slate-900 px-3 py-2"
                >
                  {item}
                </div>
              ))
            ) : (
              <div className="border border-slate-800 bg-slate-900 px-3 py-2 text-emerald-200">
                No missing items detected in the current startup profile.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 border border-slate-800 bg-slate-950 p-5 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Startup Name
          </span>
          <input
            type="text"
            required
            disabled={!canEditSetup}
            value={identity.name}
            onChange={(event) =>
              setIdentity((prev) => ({ ...prev, name: event.target.value }))
            }
            className={fieldCls}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Sector / Category
          </span>
          <input
            type="text"
            required
            disabled={!canEditSetup}
            value={identity.category}
            onChange={(event) =>
              setIdentity((prev) => ({ ...prev, category: event.target.value }))
            }
            className={fieldCls}
          />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Tagline
          </span>
          <input
            type="text"
            disabled={!canEditSetup}
            value={identity.tagline}
            onChange={(event) =>
              setIdentity((prev) => ({ ...prev, tagline: event.target.value }))
            }
            className={fieldCls}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Team Size
          </span>
          <input
            type="number"
            min={1}
            disabled={!canEditSetup}
            value={identity.teamSize}
            onChange={(event) =>
              setIdentity((prev) => ({
                ...prev,
                teamSize: Number(event.target.value),
              }))
            }
            className={fieldCls}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Active Products
          </span>
          <input
            type="number"
            min={0}
            disabled={!canEditSetup}
            value={identity.activeProducts}
            onChange={(event) =>
              setIdentity((prev) => ({
                ...prev,
                activeProducts: Number(event.target.value),
              }))
            }
            className={fieldCls}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Funding Needed (INR)
          </span>
          <input
            type="number"
            min={0}
            disabled={!canEditSetup}
            value={identity.fundingNeeded}
            onChange={(event) =>
              setIdentity((prev) => ({
                ...prev,
                fundingNeeded: Number(event.target.value),
              }))
            }
            className={fieldCls}
          />
        </label>
      </section>

      <section className="space-y-4 border border-slate-800 bg-slate-950 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Category 1: Company Profile (250 Points)
          </h2>
          <span className="text-xs text-slate-400">
            Upload proofs after the first save
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Legal Structure
            </span>
            <select
              disabled={!canEditSetup}
              value={innovationProfile.companyProfile.legalStructure}
              onChange={(event) =>
                setInnovationProfile((prev) => ({
                  ...prev,
                  companyProfile: {
                    ...prev.companyProfile,
                    legalStructure: event.target
                      .value as StartupInnovationProfile["companyProfile"]["legalStructure"],
                  },
                }))
              }
              className={fieldCls}
            >
              {STARTUP_LEGAL_STRUCTURE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              CIN Number
            </span>
            <input
              type="text"
              disabled={!canEditSetup}
              value={innovationProfile.companyProfile.cinNumber}
              onChange={(event) =>
                setInnovationProfile((prev) => ({
                  ...prev,
                  companyProfile: {
                    ...prev.companyProfile,
                    cinNumber: event.target.value,
                  },
                }))
              }
              className={fieldCls}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              DPIIT Recognition Number
            </span>
            <input
              type="text"
              disabled={!canEditSetup}
              value={innovationProfile.companyProfile.dpiitRecognitionNumber}
              onChange={(event) =>
                setInnovationProfile((prev) => ({
                  ...prev,
                  companyProfile: {
                    ...prev.companyProfile,
                    dpiitRecognitionNumber: event.target.value,
                  },
                }))
              }
              className={fieldCls}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              MSME / Udyam Number
            </span>
            <input
              type="text"
              disabled={!canEditSetup}
              value={innovationProfile.companyProfile.msmeUdyamNumber}
              onChange={(event) =>
                setInnovationProfile((prev) => ({
                  ...prev,
                  companyProfile: {
                    ...prev.companyProfile,
                    msmeUdyamNumber: event.target.value,
                  },
                }))
              }
              className={fieldCls}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Other Government Certification
            </span>
            <input
              type="text"
              disabled={!canEditSetup}
              value={
                innovationProfile.companyProfile
                  .otherGovernmentCertificationName
              }
              onChange={(event) =>
                setInnovationProfile((prev) => ({
                  ...prev,
                  companyProfile: {
                    ...prev.companyProfile,
                    otherGovernmentCertificationName: event.target.value,
                  },
                }))
              }
              className={fieldCls}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Other Certification Number
            </span>
            <input
              type="text"
              disabled={!canEditSetup}
              value={
                innovationProfile.companyProfile
                  .otherGovernmentCertificationNumber
              }
              onChange={(event) =>
                setInnovationProfile((prev) => ({
                  ...prev,
                  companyProfile: {
                    ...prev.companyProfile,
                    otherGovernmentCertificationNumber: event.target.value,
                  },
                }))
              }
              className={fieldCls}
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1.5">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Website
            </span>
            <input
              type="url"
              disabled={!canEditSetup}
              value={innovationProfile.companyProfile.websiteUrl}
              onChange={(event) =>
                setInnovationProfile((prev) => ({
                  ...prev,
                  companyProfile: {
                    ...prev.companyProfile,
                    websiteUrl: event.target.value,
                  },
                }))
              }
              className={fieldCls}
              placeholder="https://"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Product Demo
            </span>
            <input
              type="url"
              disabled={!canEditSetup}
              value={innovationProfile.companyProfile.productDemoUrl}
              onChange={(event) =>
                setInnovationProfile((prev) => ({
                  ...prev,
                  companyProfile: {
                    ...prev.companyProfile,
                    productDemoUrl: event.target.value,
                  },
                }))
              }
              className={fieldCls}
              placeholder="https://"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Portfolio Link
            </span>
            <input
              type="url"
              disabled={!canEditSetup}
              value={innovationProfile.companyProfile.portfolioUrl}
              onChange={(event) =>
                setInnovationProfile((prev) => ({
                  ...prev,
                  companyProfile: {
                    ...prev.companyProfile,
                    portfolioUrl: event.target.value,
                  },
                }))
              }
              className={fieldCls}
              placeholder="https://"
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <PitchUploadSlot
            fileName={startup?.pitchDeckName}
            fileUrl={startup?.pitchDeckUrl}
            disabled={!canUpload}
            isUploading={uploadingKey === "pitch" || uploadPitch.isPending}
            onFileSelected={handlePitchSelected}
          />
          {STARTUP_RUBRIC_DOCUMENT_SPECS.slice(0, 5).map((spec) => (
            <DocumentUploadSlot
              key={spec.category}
              label={spec.label}
              hint={spec.hint}
              disabled={!canUpload}
              isUploading={
                uploadingKey === spec.category ||
                uploadingKey === `delete-${spec.category}`
              }
              document={documentsByCategory.get(spec.category)}
              onFileSelected={(file) =>
                handleDocumentSelected(spec.category, file)
              }
              onRemove={
                documentsByCategory.get(spec.category)
                  ? () =>
                      deleteDocument.mutate({
                        category: spec.category,
                        documentId: documentsByCategory.get(spec.category)!._id,
                      })
                  : undefined
              }
            />
          ))}
        </div>
      </section>

      <section className="space-y-4 border border-slate-800 bg-slate-950 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Category 2: Health & Traction (750 Points)
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Startup Stage
            </span>
            <select
              disabled={!canEditSetup}
              value={innovationProfile.tractionProfile.startupStage}
              onChange={(event) =>
                setInnovationProfile((prev) => ({
                  ...prev,
                  tractionProfile: {
                    ...prev.tractionProfile,
                    startupStage: event.target
                      .value as StartupInnovationProfile["tractionProfile"]["startupStage"],
                  },
                }))
              }
              className={fieldCls}
            >
              {STARTUP_SCORING_STAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.points})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Funding Status
            </span>
            <select
              disabled={!canEditSetup}
              value={innovationProfile.tractionProfile.fundingStatus}
              onChange={(event) =>
                setInnovationProfile((prev) => ({
                  ...prev,
                  tractionProfile: {
                    ...prev.tractionProfile,
                    fundingStatus: event.target
                      .value as StartupInnovationProfile["tractionProfile"]["fundingStatus"],
                  },
                }))
              }
              className={fieldCls}
            >
              {STARTUP_FUNDING_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <LongTextField
            label="Problem Clarity"
            value={innovationProfile.tractionProfile.problemClarity}
            disabled={!canEditSetup}
            onChange={(value) =>
              setInnovationProfile((prev) => ({
                ...prev,
                tractionProfile: {
                  ...prev.tractionProfile,
                  problemClarity: value,
                },
              }))
            }
          />
          <LongTextField
            label="Unique Solution"
            value={innovationProfile.tractionProfile.uniqueSolution}
            disabled={!canEditSetup}
            onChange={(value) =>
              setInnovationProfile((prev) => ({
                ...prev,
                tractionProfile: {
                  ...prev.tractionProfile,
                  uniqueSolution: value,
                },
              }))
            }
          />
          <LongTextField
            label="Market Differentiation"
            value={innovationProfile.tractionProfile.marketDifferentiation}
            disabled={!canEditSetup}
            onChange={(value) =>
              setInnovationProfile((prev) => ({
                ...prev,
                tractionProfile: {
                  ...prev.tractionProfile,
                  marketDifferentiation: value,
                },
              }))
            }
          />
          <label className="space-y-1.5">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Patent Status
            </span>
            <select
              disabled={!canEditSetup}
              value={innovationProfile.tractionProfile.patentStatus}
              onChange={(event) =>
                setInnovationProfile((prev) => ({
                  ...prev,
                  tractionProfile: {
                    ...prev.tractionProfile,
                    patentStatus: event.target
                      .value as StartupInnovationProfile["tractionProfile"]["patentStatus"],
                  },
                }))
              }
              className={fieldCls}
            >
              {STARTUP_PATENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <NumberField
            label="Active Users / Customers"
            value={innovationProfile.tractionProfile.activeUsersCustomers}
            disabled={!canEditSetup}
            onChange={(value) =>
              setInnovationProfile((prev) => ({
                ...prev,
                tractionProfile: {
                  ...prev.tractionProfile,
                  activeUsersCustomers: value,
                },
              }))
            }
          />
          <NumberField
            label="Monthly Growth Rate (%)"
            value={innovationProfile.tractionProfile.monthlyGrowthRate}
            disabled={!canEditSetup}
            onChange={(value) =>
              setInnovationProfile((prev) => ({
                ...prev,
                tractionProfile: {
                  ...prev.tractionProfile,
                  monthlyGrowthRate: value,
                },
              }))
            }
          />
          <NumberField
            label="Retention / Repeat Usage (%)"
            value={innovationProfile.tractionProfile.retentionRate}
            disabled={!canEditSetup}
            onChange={(value) =>
              setInnovationProfile((prev) => ({
                ...prev,
                tractionProfile: {
                  ...prev.tractionProfile,
                  retentionRate: value,
                },
              }))
            }
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {STARTUP_RUBRIC_DOCUMENT_SPECS.slice(5).map((spec) => (
            <DocumentUploadSlot
              key={spec.category}
              label={spec.label}
              hint={spec.hint}
              disabled={!canUpload}
              isUploading={
                uploadingKey === spec.category ||
                uploadingKey === `delete-${spec.category}`
              }
              document={documentsByCategory.get(spec.category)}
              onFileSelected={(file) =>
                handleDocumentSelected(spec.category, file)
              }
              onRemove={
                documentsByCategory.get(spec.category)
                  ? () =>
                      deleteDocument.mutate({
                        category: spec.category,
                        documentId: documentsByCategory.get(spec.category)!._id,
                      })
                  : undefined
              }
              controls={
                spec.category === "itr_filing" ? (
                  <ClaimToggle
                    checked={innovationProfile.tractionProfile.hasItrFiling}
                    disabled={!canEditSetup}
                    label="ITR filing available"
                    onChange={(checked) =>
                      setInnovationProfile((prev) => ({
                        ...prev,
                        tractionProfile: {
                          ...prev.tractionProfile,
                          hasItrFiling: checked,
                        },
                      }))
                    }
                  />
                ) : spec.category === "revenue_proof" ? (
                  <ClaimToggle
                    checked={innovationProfile.tractionProfile.hasRevenueProof}
                    disabled={!canEditSetup}
                    label="Revenue proof available"
                    onChange={(checked) =>
                      setInnovationProfile((prev) => ({
                        ...prev,
                        tractionProfile: {
                          ...prev.tractionProfile,
                          hasRevenueProof: checked,
                        },
                      }))
                    }
                  />
                ) : spec.category === "grant_certificate" ? (
                  <ClaimToggle
                    checked={
                      innovationProfile.tractionProfile.hasGovernmentGrant
                    }
                    disabled={!canEditSetup}
                    label="Government grant received"
                    onChange={(checked) =>
                      setInnovationProfile((prev) => ({
                        ...prev,
                        tractionProfile: {
                          ...prev.tractionProfile,
                          hasGovernmentGrant: checked,
                        },
                      }))
                    }
                  />
                ) : spec.category === "award_certificate" ? (
                  <ClaimToggle
                    checked={
                      innovationProfile.tractionProfile.hasAwardRecognition
                    }
                    disabled={!canEditSetup}
                    label="Award / recognition received"
                    onChange={(checked) =>
                      setInnovationProfile((prev) => ({
                        ...prev,
                        tractionProfile: {
                          ...prev.tractionProfile,
                          hasAwardRecognition: checked,
                        },
                      }))
                    }
                  />
                ) : spec.category === "funding_proof" ? (
                  <div className="text-xs text-slate-400">
                    Required for Angel / Seed and VC funding claims.
                  </div>
                ) : spec.category === "patent_proof" ? (
                  <div className="text-xs text-slate-400">
                    Required for patent filed or published claims.
                  </div>
                ) : undefined
              }
            />
          ))}
        </div>
      </section>

      <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {save.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {startupId ? "Save Changes" : "Create Startup"}
        </button>
      </div>
    </form>
  );
}

function LongTextField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5 md:col-span-2">
      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
        {label}
      </span>
      <textarea
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className={`${fieldCls} min-h-28 resize-y`}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
        {label}
      </span>
      <input
        type="number"
        min={0}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className={fieldCls}
      />
    </label>
  );
}

function ClaimToggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function PitchUploadSlot({
  fileName,
  fileUrl,
  disabled,
  isUploading,
  onFileSelected,
}: {
  fileName?: string;
  fileUrl?: string;
  disabled: boolean;
  isUploading: boolean;
  onFileSelected: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isDisabled = disabled || isUploading;

  return (
    <div className="border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">
            Pitch Deck Upload
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Accepts PDF, PPT, and PPTX.{" "}
            {formatFileSize(STARTUP_RUBRIC_PITCH_MAX_BYTES)}.
          </div>
        </div>
        {fileUrl ? (
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
          >
            View
          </a>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm text-slate-300">
          {fileName ?? "No pitch deck uploaded yet"}
        </div>
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          {fileName ? "Replace" : "Upload"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={STARTUP_RUBRIC_PITCH_ACCEPT}
          disabled={isDisabled}
          className="hidden"
          onChange={(event) => {
            onFileSelected(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />
      </div>
    </div>
  );
}

function DocumentUploadSlot({
  label,
  hint,
  document,
  disabled,
  isUploading,
  onFileSelected,
  onRemove,
  controls,
}: {
  label: string;
  hint: string;
  document?: Startup["documents"][number];
  disabled: boolean;
  isUploading: boolean;
  onFileSelected: (file: File | null) => void;
  onRemove?: () => void;
  controls?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isDisabled = disabled || isUploading;

  return (
    <div className="border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{label}</div>
          <div className="mt-1 text-xs text-slate-400">{hint}</div>
        </div>
        {document?.fileUrl ? (
          <a
            href={document.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
          >
            View
          </a>
        ) : null}
      </div>
      {controls ? <div className="mt-3">{controls}</div> : null}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm text-slate-300">
          {document?.fileName ?? "No proof uploaded yet"}
        </div>
        <div className="flex items-center gap-2">
          {document && onRemove ? (
            <button
              type="button"
              disabled={isDisabled}
              onClick={onRemove}
              className="border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Remove
            </button>
          ) : null}
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            {document ? "Replace" : "Upload"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,image/*"
            disabled={isDisabled}
            className="hidden"
            onChange={(event) => {
              onFileSelected(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </div>
    </div>
  );
}

function StartupDashboard({
  startup,
  onEdit,
  canEdit,
}: {
  startup: Startup;
  onEdit: () => void;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const reviewBadge = REVIEW_BADGE[startup.reviewStatus] ?? REVIEW_BADGE.draft;
  const isApproved = startup.reviewStatus === "approved";
  const isUnderReview = startup.reviewStatus === "review_requested";
  const canRequestReview =
    startup.reviewStatus === "draft" ||
    startup.reviewStatus === "changes_requested";

  const reviewMutation = useMutation({
    mutationFn: () => startupApi.requestReview(startup._id),
    onSuccess: async () => {
      toast.success("Startup submitted for admin review.");
      await queryClient.invalidateQueries({ queryKey: ["startup", startup._id] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Unable to submit for review."));
    },
  });

  const launchMutation = useMutation({
    mutationFn: (launchTo: "investors" | "mentors" | "recruiters") =>
      startupApi.launch(startup._id, launchTo),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["startup", startup._id] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Unable to launch right now."));
    },
  });

  const capTableQuery = useQuery({
    queryKey: ["startup", startup._id, "cap-table"],
    queryFn: () => dealApi.getCapTable(startup._id),
    retry: false,
  });

  const workspaceQuery = useQuery({
    queryKey: ["workspace", startup.projectId],
    queryFn: () => workspaceApi.getById(startup.projectId!),
    enabled: Boolean(startup.projectId),
  });

  const lifecycleQuery = useQuery({
    queryKey: ["startup", startup._id, "timeline"],
    queryFn: () => startupApi.getTimeline(startup._id, 12),
    refetchInterval: 30_000,
  });

  const pitchRequests = startup.pitchRequests ?? [];
  const pendingRequests = pitchRequests.filter(
    (req) => req.status === "pending",
  ).length;
  const acceptedRequests = pitchRequests.filter(
    (req) => req.status === "accepted",
  ).length;

  const activityData = useMemo(() => {
    const buckets = new Map<string, { new: number; cumulative: number }>();
    const today = new Date();
    const start = weekStart(today);
    start.setDate(start.getDate() - 7 * 7);
    for (let i = 0; i < 8; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i * 7);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { new: 0, cumulative: 0 });
    }
    pitchRequests.forEach((req) => {
      const bucketKey = weekStart(new Date(req.requestedAt))
        .toISOString()
        .slice(0, 10);
      const bucket = buckets.get(bucketKey);
      if (bucket) bucket.new += 1;
    });
    let running = 0;
    return Array.from(buckets.entries()).map(([key, value]) => {
      running += value.new;
      return {
        week: new Date(key).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        }),
        new: value.new,
        cumulative: running,
      };
    });
  }, [pitchRequests]);

  const totalRequestsInWindow = activityData.reduce(
    (sum, bucket) => sum + bucket.new,
    0,
  );

  const equityData = useMemo(() => {
    const cap = capTableQuery.data;
    if (!cap)
      return [] as Array<{ name: string; shares: number; color: string }>;
    const founder = cap.founderRetained?.sharesAllocated ?? 0;
    const sole = cap.soleInvestor?.sharesAllocated ?? 0;
    const penny = cap.pennyInvestors.reduce(
      (sum, row) => sum + (row.sharesAllocated ?? 0),
      0,
    );
    const available = cap.availableShares ?? 0;
    return [
      { name: "Founder", shares: founder, color: "#3b82f6" },
      { name: "Sole Investor", shares: sole, color: "#a855f7" },
      { name: "Penny Pool", shares: penny, color: "#f59e0b" },
      { name: "Available", shares: available, color: "#475569" },
    ].filter((entry) => entry.shares > 0);
  }, [capTableQuery.data]);

  const totalEquityShares =
    capTableQuery.data?.totalShares ??
    equityData.reduce((sum, row) => sum + row.shares, 0);

  const workspace = workspaceQuery.data;
  const completedMilestones =
    workspace?.milestones.filter((m) => m.isCompleted).length ?? 0;
  const totalMilestones = workspace?.milestones.length ?? 0;
  const completedTasks =
    workspace?.tasks.filter((task) => task.done).length ?? 0;
  const totalTasks = workspace?.tasks.length ?? 0;

  const tractionItems = [
    { label: "MVP built", done: startup.traction?.mvpBuilt },
    { label: "Patent filed", done: startup.traction?.patentFiled },
    { label: "Revenue generating", done: startup.traction?.revenueGenerating },
  ];

  const launchItems = [
    { label: "Investors", live: startup.launchedToInvestors },
    { label: "Mentors", live: startup.launchedToMentors },
    { label: "Recruiters", live: Boolean(startup.launchedToRecruiters) },
  ];
  const trustSummary = useMemo(
    () => buildStartupTrustSummary(startup),
    [startup],
  );

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border border-slate-800 bg-slate-950 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center bg-gradient-to-br from-cyan-500 to-purple-500 text-xl font-bold text-white">
            {startup.name?.slice(0, 1).toUpperCase() ?? (
              <Rocket className="h-6 w-6" />
            )}
          </div>
          <div className="min-w-0 space-y-2">
            <h1 className="truncate text-2xl font-semibold text-white">
              {startup.name}
            </h1>
            {startup.tagline ? (
              <p className="text-sm text-slate-400">{startup.tagline}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {startup.category ? (
                <span className="border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-300">
                  {startup.category}
                </span>
              ) : null}
              <span className="border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-300">
                {startup.stage}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 border px-2.5 py-1 font-semibold ${reviewBadge.className}`}
              >
                <CircleDot className="h-3 w-3" />
                {reviewBadge.label}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={!canEdit}
            className="inline-flex items-center gap-2 border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-500/60 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Edit3 className="h-4 w-4" />
            Edit Setup
          </button>

          {startup.launchedToInvestors ? (
            <span className="inline-flex items-center gap-1.5 border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200">
              <Rocket className="h-4 w-4" />
              Live on Marketplace
            </span>
          ) : isApproved ? (
            <button
              type="button"
              disabled={launchMutation.isPending}
              onClick={() => launchMutation.mutate("investors")}
              className="inline-flex items-center gap-2 border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Rocket className="h-4 w-4" />
              Launch to Marketplace
            </button>
          ) : isUnderReview ? (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Clock className="h-4 w-4" />
              Awaiting Admin Review
            </button>
          ) : canRequestReview ? (
            <button
              type="button"
              disabled={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate()}
              className="inline-flex items-center gap-2 border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {reviewMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Submit for Admin Review
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300">
              <Clock className="h-4 w-4" />
              Review Required
            </span>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Team Size"
          value={String(startup.teamSize ?? 0)}
        />
        <KpiCard
          icon={<Package className="h-4 w-4" />}
          label="Active Products"
          value={String(startup.activeProducts ?? 0)}
        />
        <KpiCard
          icon={<Banknote className="h-4 w-4" />}
          label="Funding Needed"
          value={formatINR(startup.fundingNeeded)}
        />
        <KpiCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Innovation Score"
          value={String(
            startup.innovationScoreAtLaunch ||
              startup.innovationScorePreview?.total ||
              0,
          )}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="border border-slate-800 bg-slate-950 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <TrendingUp className="h-4 w-4 text-cyan-300" />
              Investor Interest (last 8 weeks)
            </div>
            <div className="text-xs text-slate-400">
              {totalRequestsInWindow} investor outreach requests
            </div>
          </div>
          <div className="mt-4 h-64 min-h-64 min-w-0 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={256}>
              <AreaChart
                data={activityData}
                margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="colorCumulative"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="week"
                  stroke="#64748b"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #334155",
                    color: "#e2e8f0",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#94a3b8" }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
                  iconType="circle"
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  name="Cumulative"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#colorCumulative)"
                />
                <Line
                  type="monotone"
                  dataKey="new"
                  name="New / week"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center text-xs text-slate-400">
            <div className="border border-slate-800 bg-slate-900 py-2">
              <div className="text-lg font-semibold text-white">
                {pitchRequests.length}
              </div>
              <div>Total requests</div>
            </div>
            <div className="border border-slate-800 bg-slate-900 py-2">
              <div className="text-lg font-semibold text-amber-300">
                {pendingRequests}
              </div>
              <div>Pending</div>
            </div>
            <div className="border border-slate-800 bg-slate-900 py-2">
              <div className="text-lg font-semibold text-emerald-300">
                {acceptedRequests}
              </div>
              <div>Accepted</div>
            </div>
          </div>
        </div>

        <div className="border border-slate-800 bg-slate-950 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <PieIcon className="h-4 w-4 text-cyan-300" />
            Equity Distribution
          </div>
          {capTableQuery.isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Spinner />
            </div>
          ) : equityData.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center text-sm text-slate-500">
              <Award className="mb-2 h-6 w-6 opacity-50" />
              No cap table allocated yet.
            </div>
          ) : (
            <>
              <div className="mt-3 h-44 min-h-44 min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={176}>
                  <BarChart
                    data={equityData}
                    layout="vertical"
                    margin={{ left: 0, right: 10, top: 5, bottom: 5 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={90}
                      stroke="#64748b"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #334155",
                        color: "#e2e8f0",
                        fontSize: 12,
                      }}
                      formatter={(value) =>
                        `${Number(value).toLocaleString()} shares`
                      }
                    />
                    <Bar dataKey="shares" radius={[0, 4, 4, 0]}>
                      {equityData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-1 text-xs text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Total shares</span>
                  <span className="text-slate-200">
                    {totalEquityShares.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Investor equity</span>
                  <span className="text-slate-200">
                    {(capTableQuery.data?.totalInvestorEquity ?? 0).toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Founder equity</span>
                  <span className="text-slate-200">
                    {(
                      capTableQuery.data?.founderRetained?.equityPercent ?? 0
                    ).toFixed(2)}
                    %
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="border border-slate-800 bg-slate-950 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Flag className="h-4 w-4 text-cyan-300" />
            Traction
          </div>
          <ul className="mt-4 space-y-2">
            {tractionItems.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300"
              >
                <span>{item.label}</span>
                <CheckCircle2
                  className={`h-4 w-4 ${item.done ? "text-emerald-400" : "text-slate-600"}`}
                />
              </li>
            ))}
            {startup.traction?.usersCount ? (
              <li className="flex items-center justify-between border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300">
                <span>Users</span>
                <span className="text-white">
                  {startup.traction.usersCount.toLocaleString()}
                </span>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="border border-slate-800 bg-slate-950 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Rocket className="h-4 w-4 text-cyan-300" />
            Launch Visibility
          </div>
          <ul className="mt-4 space-y-2">
            {launchItems.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300"
              >
                <span>{item.label}</span>
                <span
                  className={`border px-2 py-0.5 text-[11px] font-semibold ${item.live ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-slate-700 bg-slate-900 text-slate-400"}`}
                >
                  {item.live ? "Live" : "Not live"}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300">
              <span>Launched at</span>
              <span className="text-white">
                {formatDate(startup.launchedAt)}
              </span>
            </li>
          </ul>
        </div>

        <div className="border border-slate-800 bg-slate-950 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <FolderKanban className="h-4 w-4 text-cyan-300" />
            Workspace Progress
          </div>
          {workspaceQuery.isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner />
            </div>
          ) : !workspace ? (
            <div className="mt-4 text-sm text-slate-500">
              No workspace linked yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                  <span>Overall</span>
                  <span className="text-white">
                    {workspace.progressPercent}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden bg-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                    style={{ width: `${workspace.progressPercent}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="border border-slate-800 bg-slate-900 p-2 text-center">
                  <div className="text-lg font-semibold text-white">
                    {completedMilestones}/{totalMilestones}
                  </div>
                  <div className="text-slate-400">Milestones</div>
                </div>
                <div className="border border-slate-800 bg-slate-900 p-2 text-center">
                  <div className="text-lg font-semibold text-white">
                    {completedTasks}/{totalTasks}
                  </div>
                  <div className="text-slate-400">Tasks</div>
                </div>
              </div>
              <div className="text-xs text-slate-400">
                Stage: <span className="text-slate-200">{workspace.stage}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="border border-slate-800 bg-slate-950 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="h-4 w-4 text-cyan-300" />
              Trust Signals
            </div>
            <div className="text-xs text-slate-400">
              {trustSummary.proofCount} proof
              {trustSummary.proofCount === 1 ? "" : "s"} attached
            </div>
          </div>

          {trustSummary.signals.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {trustSummary.signals.map((signal) => (
                <span
                  key={signal}
                  className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200"
                >
                  {signal}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-500">
              Add registration details, public links, and proof uploads to build
              marketplace trust.
            </div>
          )}

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {trustSummary.proofRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300"
              >
                <span>{row.label}</span>
                <CheckCircle2
                  className={`h-4 w-4 ${row.done ? "text-emerald-400" : "text-slate-600"}`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border border-slate-800 bg-slate-950 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Award className="h-4 w-4 text-cyan-300" />
            Credibility Snapshot
          </div>

          <div className="mt-4 space-y-2">
            {trustSummary.credentialRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300"
              >
                <span>{row.label}</span>
                <span className={row.done ? "text-white" : "text-slate-500"}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 border border-slate-800 bg-slate-900 p-3">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Public presence
            </div>
            {trustSummary.links.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {trustSummary.links.map((link) => (
                  <a
                    key={link.label}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:border-cyan-400/40 hover:text-cyan-100"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-slate-500">
                No public links added yet.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="border border-slate-800 bg-slate-950 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Boxes className="h-4 w-4 text-cyan-300" />
            Recent Pitch Requests
          </div>
          {pitchRequests.length === 0 ? (
            <div className="mt-4 text-sm text-slate-500">
              No investor outreach yet.
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-slate-800">
              {pitchRequests.slice(0, 5).map((request) => (
                <li
                  key={request._id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate text-white">
                      {request.startupName || "Pitch"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDate(request.requestedAt)}
                    </div>
                  </div>
                  <span
                    className={`border px-2 py-0.5 text-[11px] font-semibold uppercase ${
                      request.status === "accepted"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                        : request.status === "rejected"
                          ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                          : request.status === "withdrawn"
                            ? "border-slate-700 bg-slate-900 text-slate-400"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                    }`}
                  >
                    {request.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border border-slate-800 bg-slate-950 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Clock className="h-4 w-4 text-cyan-300" />
            Lifecycle Timeline
          </div>
          {lifecycleQuery.isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner />
            </div>
          ) : (lifecycleQuery.data ?? []).length === 0 ? (
            <div className="mt-4 text-sm text-slate-500">
              Timeline events will appear as startup, workspace, patent,
              investor, and launch activity happens.
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {(lifecycleQuery.data ?? []).slice(0, 6).map((event) => (
                <li key={event._id} className="border-l border-cyan-500/40 pl-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-white">{event.title}</div>
                    <span className="border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                      {event.source}
                    </span>
                  </div>
                  {event.description ? (
                    <div className="mt-1 text-xs text-slate-400">
                      {event.description}
                    </div>
                  ) : null}
                  <div className="mt-1 text-[11px] text-slate-500">
                    {formatDate(event.createdAt)}
                    {event.status ? ` · ${event.status}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="border border-slate-800 bg-slate-950 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <FileText className="h-4 w-4 text-cyan-300" />
            Documents
          </div>
          <div className="mt-4 text-sm text-slate-300">
            <div className="flex items-center justify-between border border-slate-800 bg-slate-900 px-3 py-2">
              <span>Pitch deck</span>
              {startup.pitchDeckUrl ? (
                <a
                  href={startup.pitchDeckUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
                >
                  View
                </a>
              ) : (
                <span className="text-xs text-slate-500">Not uploaded</span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between border border-slate-800 bg-slate-900 px-3 py-2">
              <span>Uploaded files</span>
              <span className="text-white">
                {(startup.documents ?? []).length}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between border border-slate-800 bg-slate-900 px-3 py-2">
              <span>Readiness</span>
              <span
                className={
                  startup.readiness?.isReviewReady
                    ? "text-emerald-300"
                    : "text-amber-300"
                }
              >
                {startup.readiness?.isReviewReady ? "Ready" : "Incomplete"}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
        <span className="text-cyan-300">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

export default StartupLaunch;
