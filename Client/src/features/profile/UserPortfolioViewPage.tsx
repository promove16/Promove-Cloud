import { type ReactNode, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Award,
  Briefcase,
  Building2,
  ExternalLink,
  FolderKanban,
  Github,
  GraduationCap,
  Linkedin,
  type LucideIcon,
  Link2,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  type MarketplaceEntityType,
  type MarketplaceJobSummary,
  type MarketplaceStartupItem,
  type MarketplaceUserDetail,
  marketplaceApi,
} from "../../api/marketplace.api";
import { recruiterApi } from "../../api/recruiter.api";
import { DashboardLayout } from "../../components/layouts/DashboardLayout";
import { useAuthStore } from "../../store/authStore";
import { UserRole } from "../../types/roles.types";
import {
  getMarketplaceBasePath,
  getMarketplaceDetailPath,
  getStudentPortfolioViewPath,
} from "../marketplace/navigation";
import {
  PortfolioViewerActionButton,
  PortfolioViewerEmpty as Empty,
  PortfolioViewerHero,
  PortfolioViewerPageShell,
  PortfolioViewerSection as Section,
  PortfolioViewerSidebarRow as SidebarRow,
  PortfolioViewerStatCard as StatCard,
} from "./PortfolioViewerShell";

const validUserEntityTypes = new Set<Exclude<MarketplaceEntityType, "startup">>([
  "student",
  "school",
  "college",
  "mentor",
  "investor",
  "recruiter",
]);

const roleLabel: Record<Exclude<MarketplaceEntityType, "startup">, string> = {
  student: "Student",
  school: "School",
  college: "College",
  mentor: "Mentor",
  investor: "Investor",
  recruiter: "Recruiter",
};

const experienceTypeLabel: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  internship: "Internship",
  freelance: "Freelance",
  volunteer: "Volunteer",
};

function LogoTile({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-200">
      {children}
    </div>
  );
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) {
    return "";
  }

  return new Date(dateStr).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

function getPortfolioStats(entity: MarketplaceUserDetail) {
  if (entity.entityType === "school" || entity.entityType === "college") {
    return [
      {
        label: "Students",
        value: entity.institutionProfile?.totalStudentsEnrolled ?? 0,
      },
      { label: "Alumni", value: entity.institutionProfile?.alumniCount ?? 0 },
      {
        label: "Startups",
        value: entity.institutionProfile?.stats?.startupsLaunched ?? 0,
      },
      {
        label: "Collaborations",
        value: entity.institutionProfile?.stats?.industryCollaborations ?? 0,
      },
    ];
  }

  if (entity.entityType === "recruiter") {
    return [
      { label: "Open Jobs", value: entity.relatedCounts.jobs },
      { label: "Startup Links", value: entity.relatedCounts.startups },
      { label: "Experience", value: entity.insightCounts.experience },
      { label: "Education", value: entity.insightCounts.education },
    ];
  }

  if (entity.entityType === "mentor") {
    return [
      { label: "Experience", value: entity.insightCounts.experience },
      { label: "Education", value: entity.insightCounts.education },
      { label: "Projects", value: entity.insightCounts.portfolioProjects },
      { label: "Startup Links", value: entity.relatedCounts.startups },
    ];
  }

  if (entity.entityType === "investor") {
    return [
      { label: "Portfolio", value: entity.relatedCounts.startups },
      { label: "Experience", value: entity.insightCounts.experience },
      { label: "Education", value: entity.insightCounts.education },
      { label: "Repos", value: entity.githubStats?.totalRepos ?? 0 },
    ];
  }

  return [
    { label: "Skills", value: entity.insightCounts.skills },
    { label: "Experience", value: entity.insightCounts.experience },
    { label: "Projects", value: entity.insightCounts.portfolioProjects },
    { label: "Startups", value: entity.relatedCounts.startups },
  ];
}

function getQuickFacts(entity: MarketplaceUserDetail) {
  if (entity.entityType === "school" || entity.entityType === "college") {
    return [
      { label: "Role", value: roleLabel[entity.entityType] },
      {
        label: "Organization Type",
        value: entity.institutionProfile?.organizationType ?? "Not specified",
      },
      {
        label: "Location",
        value:
          entity.institutionProfile?.location ??
          entity.location ??
          "Not specified",
      },
      {
        label: "Academic Year",
        value: entity.institutionProfile?.academicYear ?? "Not specified",
      },
      {
        label: "Contact",
        value:
          entity.institutionProfile?.contactEmail ??
          entity.institutionProfile?.contactPhone ??
          "Not specified",
      },
    ];
  }

  return [
    { label: "Role", value: roleLabel[entity.entityType] },
    { label: "Domain", value: entity.domain ?? "Not specified" },
    { label: "Location", value: entity.location ?? "Not specified" },
    { label: "Skills", value: entity.insightCounts.skills },
    {
      label: entity.entityType === "recruiter" ? "Open Jobs" : "Projects",
      value:
        entity.entityType === "recruiter"
          ? entity.relatedCounts.jobs
          : entity.insightCounts.portfolioProjects,
    },
  ];
}

function StartupCard({
  startup,
  dashboardRole,
}: {
  startup: MarketplaceStartupItem;
  dashboardRole: UserRole;
}) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-start gap-3">
        <LogoTile>
          <Sparkles className="h-5 w-5" />
        </LogoTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-white">{startup.name}</h3>
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
              {startup.stage}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{startup.tagline}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
            <span>{startup.category}</span>
            <span>{startup.teamSize} team</span>
            <span>{startup.activeProducts} products</span>
          </div>
          <Link
            to={getMarketplaceDetailPath(dashboardRole, "startup", startup._id)}
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition hover:text-cyan-100"
          >
            View startup
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function RecruiterOpenRoleCard({
  job,
  canApply,
  hasApplied,
  isApplying,
  applyError,
  onApply,
  onViewJob,
}: {
  job: MarketplaceJobSummary;
  canApply: boolean;
  hasApplied: boolean;
  isApplying: boolean;
  applyError: string | null;
  onApply: () => void;
  onViewJob: () => void;
}) {
  return (
    <article className="py-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_220px] xl:gap-8">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-white">{job.title}</h3>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-200">
            <span>{job.company}</span>
            <span>{job.type}</span>
            <span>{job.domain}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {job.location}
            </span>
            <span>Created {formatDate(job.createdAt)}</span>
            {job.expiresAt ? <span>Closes {formatDate(job.expiresAt)}</span> : null}
          </div>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">{job.description}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {canApply ? (
              <button
                type="button"
                onClick={onApply}
                disabled={hasApplied || isApplying || !job.isActive}
                className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
              >
                {isApplying ? "Applying..." : hasApplied ? "Applied" : "Apply now"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onViewJob}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
            >
              View job
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {applyError ? <div className="mt-3 text-sm text-rose-300">{applyError}</div> : null}
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-slate-800/80 pt-4 sm:grid-cols-3 xl:grid-cols-1 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
              Innovation Score
            </div>
            <div className="mt-2 text-3xl font-semibold text-white">
              {job.minimumInnovationScore}+
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Applicants</div>
            <div className="mt-2 text-3xl font-semibold text-white">{job.applicantCount}</div>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Shortlisted</div>
            <div className="mt-2 text-3xl font-semibold text-white">{job.shortlistedCount}</div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function UserPortfolioViewContent({
  entityType: entityTypeOverride,
  entityId: entityIdOverride,
}: {
  entityType?: Exclude<MarketplaceEntityType, "startup">;
  entityId?: string;
} = {}) {
  const { entityType: entityTypeParam, entityId: entityIdParam } = useParams<{
    entityType?: string;
    entityId?: string;
  }>();
  const navigate = useNavigate();
  const authUser = useAuthStore((state) => state.user);
  const dashboardRole = authUser?.role ?? UserRole.STUDENT;
  const entityType = useMemo(
    () =>
      (entityTypeOverride ?? entityTypeParam) &&
      validUserEntityTypes.has(
        (entityTypeOverride ?? entityTypeParam) as Exclude<MarketplaceEntityType, "startup">,
      )
        ? ((entityTypeOverride ?? entityTypeParam) as Exclude<MarketplaceEntityType, "startup">)
        : null,
    [entityTypeOverride, entityTypeParam],
  );
  const entityId = entityIdOverride ?? entityIdParam;
  const [appliedJobIds, setAppliedJobIds] = useState<Record<string, boolean>>({});
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [applyErrorJobId, setApplyErrorJobId] = useState<string | null>(null);
  const [applyErrorMessage, setApplyErrorMessage] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["portfolio", "view", entityType, entityId],
    queryFn: async () => {
      const detail = await marketplaceApi.getEntityDetail(entityType!, entityId!);
      if (detail.entityType === "startup") {
        throw new Error("Startup profiles are not supported on the portfolio route.");
      }
      return detail as MarketplaceUserDetail;
    },
    enabled: Boolean(entityType && entityId && entityType !== "student"),
  });

  const entity = detailQuery.data;
  const portfolioStats = useMemo(
    () => (entity ? getPortfolioStats(entity) : []),
    [entity],
  );
  const quickFacts = useMemo(
    () => (entity ? getQuickFacts(entity) : []),
    [entity],
  );
  const visibleLinks = useMemo(() => {
    if (!entity) {
      return [] as Array<{ label: string; url: string; icon: LucideIcon }>;
    }

    return [
      entity.links?.websiteUrl
        ? { label: "Website", url: entity.links.websiteUrl, icon: Link2 }
        : null,
      entity.links?.githubUrl
        ? { label: "GitHub", url: entity.links.githubUrl, icon: Github }
        : null,
      entity.links?.linkedinUrl
        ? { label: "LinkedIn", url: entity.links.linkedinUrl, icon: Linkedin }
        : null,
    ].filter(
      (
        link,
      ): link is { label: string; url: string; icon: LucideIcon } =>
        Boolean(link),
    );
  }, [entity]);
  const experienceHighlights = entity?.experienceHighlights ?? [];
  const educationHighlights = entity?.educationHighlights ?? [];
  const skills = entity?.skills ?? [];
  const portfolioHighlights = entity?.portfolioHighlights ?? [];
  const heroHighlights = useMemo(() => {
    if (!entity) {
      return [] as Array<{ icon: LucideIcon; value: string }>;
    }

    if (entity.entityType === "school" || entity.entityType === "college") {
      return [
        {
          icon: Building2,
          value: entity.institutionProfile?.institutionName ?? entity.displayName,
        },
        {
          icon: Sparkles,
          value: `${entity.institutionProfile?.stats?.startupsLaunched ?? 0} startups launched`,
        },
      ];
    }

    if (entity.entityType === "recruiter") {
      return [
        { icon: Briefcase, value: `${entity.relatedCounts.jobs} open jobs` },
        { icon: Users, value: `${entity.relatedCounts.startups} startup links` },
      ];
    }

    if (entity.entityType === "investor") {
      return [
        { icon: Users, value: `${entity.relatedCounts.startups} portfolio startups` },
        { icon: Briefcase, value: `${entity.insightCounts.experience} experience` },
      ];
    }

    return [
      { icon: Briefcase, value: `${entity.insightCounts.experience} experience` },
      { icon: Users, value: `${entity.relatedCounts.startups} startup links` },
    ];
  }, [entity]);
  const featuredItems = useMemo(() => {
    if (!entity) {
      return [] as Array<{
        key: string;
        kind: string;
        title: string;
        body: string;
        url?: string;
      }>;
    }

    if (entity.entityType === "school" || entity.entityType === "college") {
      return [
        {
          key: "institution-specialty",
          kind: "Specialty",
          title: entity.institutionProfile?.specialties?.[0] ?? "Institution profile",
          body:
            entity.headline ??
            entity.domain ??
            "Specialties and institution highlights will appear here.",
          url: entity.links?.websiteUrl,
        },
        {
          key: "institution-location",
          kind: "Location",
          title: entity.institutionProfile?.location ?? entity.location ?? "Primary campus",
          body:
            entity.institutionProfile?.locations?.slice(0, 3).join(" . ") ||
            "Additional campus or branch locations will appear here.",
        },
        {
          key: "institution-outcome",
          kind: "Outcome",
          title: `${entity.institutionProfile?.stats?.startupsLaunched ?? 0} startups launched`,
          body: `${entity.institutionProfile?.stats?.industryCollaborations ?? 0} industry collaborations`,
        },
      ];
    }

    return [
      ...portfolioHighlights.slice(0, 2).map((project, index) => ({
        key: `project-${index}`,
        kind: "Project",
        title: project.title,
        body:
          (project.description ?? project.techStack.slice(0, 4).join(" . ")) ||
          "Portfolio project",
        url: project.liveUrl ?? project.repoUrl,
      })),
      ...educationHighlights.slice(0, 1).map((education, index) => ({
        key: `education-${index}`,
        kind: "Education",
        title: education.institution,
        body: [education.degree, education.fieldOfStudy].filter(Boolean).join(", ") || "Education record",
      })),
      ...entity.relatedStartups.slice(0, 1).map((startup) => ({
        key: `startup-${startup._id}`,
        kind: "Startup",
        title: startup.name,
        body: startup.tagline,
        url: getMarketplaceDetailPath(dashboardRole, "startup", startup._id),
      })),
    ].slice(0, 3);
  }, [dashboardRole, educationHighlights, entity, portfolioHighlights]);

  const handleMessage = (targetId: string) => {
    const storageKey = `dm_first_contact_${targetId}`;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, "true");
    }
    navigate(`/dashboard/messages/${targetId}`);
  };

  const handleApplyToJob = async (jobId: string) => {
    if (applyingJobId || appliedJobIds[jobId]) {
      return;
    }

    setApplyingJobId(jobId);
    setApplyErrorJobId(null);
    setApplyErrorMessage(null);

    try {
      await recruiterApi.applyToJob(jobId);
      setAppliedJobIds((current) => ({ ...current, [jobId]: true }));
    } catch {
      setApplyErrorJobId(jobId);
      setApplyErrorMessage("Unable to apply to this job right now.");
    } finally {
      setApplyingJobId(null);
    }
  };

  if (!entityType || !entityId) {
    return (
      <div className="-mx-4 -my-6 min-h-[calc(100vh-5rem)] bg-[#050816] px-4 py-5 text-slate-100 lg:-mx-8 lg:px-8">
        <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 px-6 py-6 text-sm text-rose-100">
          Invalid portfolio route.
        </div>
      </div>
    );
  }

  if (entityType === "student") {
    return <Navigate to={getStudentPortfolioViewPath(entityId)} replace />;
  }

  return (
    <PortfolioViewerPageShell
      backTo={getMarketplaceBasePath(authUser?.role)}
      loading={detailQuery.isLoading}
      loadingLabel="Loading portfolio..."
      error={detailQuery.isError}
      errorLabel="This portfolio is not available for your role or could not be loaded."
    >
      {entity ? (
        <>
          <PortfolioViewerHero
            cover={(
              <div className="relative h-48 overflow-hidden rounded-t-[28px] bg-[linear-gradient(135deg,_#243a8f_0%,_#0a66c2_46%,_#0b5cab_64%,_#f5b841_65%,_#f59e0b_78%,_#0a66c2_79%,_#0f4c81_100%)]">
                <div className="absolute inset-0 bg-[linear-gradient(120deg,_transparent_0%,_transparent_42%,_rgba(255,255,255,0.24)_43%,_rgba(255,255,255,0.24)_50%,_transparent_51%)]" />
              </div>
            )}
            avatar={(
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-slate-900 bg-slate-800 text-4xl font-semibold text-cyan-200 shadow-sm sm:h-40 sm:w-40 sm:text-5xl">
                {entity.avatar ? (
                  <img
                    src={entity.avatar}
                    alt={entity.displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  entity.displayName
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                )}
              </div>
            )}
            title={entity.displayName}
            badges={(
              <>
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
                  Read-only portfolio
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {roleLabel[entity.entityType]}
                </span>
              </>
            )}
            subtitle={entity.headline || entity.domain || `${roleLabel[entity.entityType]} portfolio`}
            meta={(
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
                {entity.domain ? <span>{entity.domain}</span> : null}
                {(entity.institutionProfile?.location || entity.location) ? (
                  <>
                    <span aria-hidden="true">.</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {entity.institutionProfile?.location ?? entity.location}
                    </span>
                  </>
                ) : null}
                {entity.entityType === "school" || entity.entityType === "college" ? (
                  entity.institutionProfile?.institutionName ? (
                    <>
                      <span aria-hidden="true">.</span>
                      <span>{entity.institutionProfile.institutionName}</span>
                    </>
                  ) : null
                ) : null}
              </div>
            )}
            actions={(
              <>
                <PortfolioViewerActionButton onClick={() => handleMessage(entity._id)}>
                  <MessageCircle className="h-4 w-4" />
                  Message
                </PortfolioViewerActionButton>
                {visibleLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <PortfolioViewerActionButton key={link.label} href={link.url}>
                      <Icon className="h-4 w-4" />
                      {link.label}
                    </PortfolioViewerActionButton>
                  );
                })}
              </>
            )}
            aside={(
              <div className="space-y-3 text-sm">
                {heroHighlights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.value} className="flex items-center gap-2 font-semibold text-slate-200">
                      <Icon className="h-5 w-5 text-slate-400" />
                      {item.value}
                    </div>
                  );
                })}
              </div>
            )}
          />

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
                <main className="space-y-5">
                  <Section title="About">
                    {entity.bio ? (
                      <p className="whitespace-pre-line text-sm leading-6 text-slate-200">{entity.bio}</p>
                    ) : (
                      <Empty>No about summary has been added yet.</Empty>
                    )}
                  </Section>

                  <Section title="Featured">
                    {featuredItems.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-3">
                        {featuredItems.map((item) => (
                          <article key={item.key} className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70">
                            <div className="flex h-24 items-center justify-center bg-cyan-500/10 text-cyan-200">
                              {item.kind === "Project" ? (
                                <FolderKanban className="h-8 w-8" />
                              ) : item.kind === "Education" ? (
                                <GraduationCap className="h-8 w-8" />
                              ) : item.kind === "Startup" ? (
                                <Users className="h-8 w-8" />
                              ) : item.kind === "Outcome" ? (
                                <Sparkles className="h-8 w-8" />
                              ) : item.kind === "Location" ? (
                                <MapPin className="h-8 w-8" />
                              ) : (
                                <Award className="h-8 w-8" />
                              )}
                            </div>
                            <div className="p-3">
                              <div className="text-xs text-slate-400">{item.kind}</div>
                              <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-white">{item.title}</h3>
                              <p className="mt-1 line-clamp-2 text-xs text-slate-400">{item.body}</p>
                              {item.url ? (
                                item.url.startsWith("/") ? (
                                  <Link
                                    to={item.url}
                                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-200 hover:underline"
                                  >
                                    View
                                    <ExternalLink className="h-3 w-3" />
                                  </Link>
                                ) : (
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-200 hover:underline"
                                  >
                                    View
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty>Featured work will appear here when portfolio highlights are available.</Empty>
                    )}
                  </Section>
                  {entity.entityType === "school" || entity.entityType === "college" ? (
                    <>
                      <Section title="Institution Details">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <StatCard
                            label="Institution Name"
                            value={entity.institutionProfile?.institutionName ?? entity.displayName}
                          />
                          <StatCard
                            label="Organization Type"
                            value={entity.institutionProfile?.organizationType ?? roleLabel[entity.entityType]}
                          />
                          <StatCard
                            label="Founded"
                            value={entity.institutionProfile?.foundedYear ?? "Not added"}
                          />
                          <StatCard
                            label="IIC Rating"
                            value={entity.institutionProfile?.iicStarRating ?? 0}
                          />
                        </div>
                      </Section>

                      <Section title="Specialties">
                        {(entity.institutionProfile?.specialties ?? []).length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {(entity.institutionProfile?.specialties ?? []).map((specialty) => (
                              <span
                                key={specialty}
                                className="rounded-full border border-cyan-400/60 bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-100"
                              >
                                {specialty}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <Empty>No specialties have been added yet.</Empty>
                        )}
                      </Section>

                      <Section title="Locations">
                        {[
                          entity.institutionProfile?.location,
                          ...(entity.institutionProfile?.locations ?? []),
                        ].filter(
                          (location, index, items): location is string =>
                            Boolean(location) && items.indexOf(location) === index,
                        ).length > 0 ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            {[
                              entity.institutionProfile?.location,
                              ...(entity.institutionProfile?.locations ?? []),
                            ]
                              .filter(
                                (location, index, items): location is string =>
                                  Boolean(location) && items.indexOf(location) === index,
                              )
                              .map((location) => (
                                <article
                                  key={location}
                                  className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                                >
                                  <LogoTile>
                                    <MapPin className="h-5 w-5" />
                                  </LogoTile>
                                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                                    {location}
                                  </div>
                                </article>
                              ))}
                          </div>
                        ) : (
                          <Empty>No campus or branch locations have been added yet.</Empty>
                        )}
                      </Section>

                      <Section title="Outcomes">
                        {entity.institutionProfile?.stats ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <StatCard
                              label="Innovation Activities"
                              value={entity.institutionProfile.stats.totalInnovationActivities}
                            />
                            <StatCard
                              label="Patents Filed"
                              value={entity.institutionProfile.stats.patentsFiled}
                            />
                            <StatCard
                              label="Mentoring Hours"
                              value={entity.institutionProfile.stats.totalMentoringHours}
                            />
                            <StatCard
                              label="Startups Launched"
                              value={entity.institutionProfile.stats.startupsLaunched}
                            />
                            <StatCard
                              label="Students Placed"
                              value={entity.institutionProfile.stats.studentsPlaced ?? "Not added"}
                            />
                            <StatCard
                              label="HR Connections"
                              value={entity.institutionProfile.stats.totalHRConnections ?? "Not added"}
                            />
                          </div>
                        ) : (
                          <Empty>No institution outcomes have been added yet.</Empty>
                        )}
                      </Section>
                    </>
                  ) : (
                    <>
                      <Section title="Experience">
                        {experienceHighlights.length > 0 ? (
                          <div className="divide-y divide-slate-800">
                            {experienceHighlights.map((experience, index) => (
                              <article
                                key={`${experience.company}-${experience.title}-${index}`}
                                className="flex gap-3 py-4 first:pt-0 last:pb-0"
                              >
                                <LogoTile>
                                  <Briefcase className="h-5 w-5" />
                                </LogoTile>
                                <div className="min-w-0">
                                  <h3 className="font-semibold text-white">{experience.title}</h3>
                                  <div className="text-sm text-slate-200">{experience.company}</div>
                                  <div className="mt-0.5 text-sm text-slate-400">
                                    {formatDate(experience.startDate)} -{" "}
                                    {experience.isCurrent
                                      ? "Present"
                                      : formatDate(experience.endDate ?? undefined)}
                                    {experience.location ? ` . ${experience.location}` : ""}
                                    {experience.type
                                      ? ` . ${experienceTypeLabel[experience.type] ?? experience.type}`
                                      : ""}
                                  </div>
                                  {experience.description ? (
                                    <p className="mt-2 text-sm leading-6 text-slate-300">
                                      {experience.description}
                                    </p>
                                  ) : null}
                                  {experience.skills.length > 0 ? (
                                    <div className="mt-2 text-sm font-semibold text-slate-300">
                                      {experience.skills.slice(0, 6).join(" . ")}
                                    </div>
                                  ) : null}
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <Empty>No experience has been added yet.</Empty>
                        )}
                      </Section>

                      <Section title="Education">
                        {educationHighlights.length > 0 ? (
                          <div className="divide-y divide-slate-800">
                            {educationHighlights.map((education, index) => (
                              <article
                                key={`${education.institution}-${index}`}
                                className="flex gap-3 py-4 first:pt-0 last:pb-0"
                              >
                                <LogoTile>
                                  <GraduationCap className="h-5 w-5" />
                                </LogoTile>
                                <div className="min-w-0">
                                  <h3 className="font-semibold text-white">{education.institution}</h3>
                                  <div className="text-sm text-slate-200">
                                    {[education.degree, education.fieldOfStudy]
                                      .filter(Boolean)
                                      .join(", ")}
                                  </div>
                                  <div className="mt-0.5 text-sm text-slate-400">
                                    {education.startYear ? `${education.startYear} - ` : ""}
                                    {education.isCurrent ? "Present" : education.endYear ?? ""}
                                    {education.grade ? ` . Grade: ${education.grade}` : ""}
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <Empty>No education entries have been added yet.</Empty>
                        )}
                      </Section>

                      <Section title="Skills">
                        {skills.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {skills.map((skill) => (
                              <span
                                key={`${skill.name}-${skill.level}`}
                                className="rounded-full border border-cyan-400/60 bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-100"
                              >
                                {skill.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <Empty>No skills have been added yet.</Empty>
                        )}
                      </Section>

                      <Section title="Projects">
                        {portfolioHighlights.length > 0 ? (
                          <div className="divide-y divide-slate-800">
                            {portfolioHighlights.map((project, index) => (
                              <article
                                key={`${project.title}-${index}`}
                                className="flex gap-3 py-4 first:pt-0 last:pb-0"
                              >
                                <LogoTile>
                                  <FolderKanban className="h-5 w-5" />
                                </LogoTile>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <h3 className="font-semibold text-white">{project.title}</h3>
                                      {project.description ? (
                                        <p className="mt-1 text-sm leading-6 text-slate-300">
                                          {project.description}
                                        </p>
                                      ) : null}
                                    </div>
                                    {project.stars > 0 ? (
                                      <span className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-semibold text-amber-300">
                                        <Star className="h-3.5 w-3.5 fill-current" />
                                        {project.stars}
                                      </span>
                                    ) : null}
                                  </div>
                                  {[...project.techStack, ...project.languages].length > 0 ? (
                                    <div className="mt-2 text-sm font-semibold text-slate-300">
                                      {[...project.techStack, ...project.languages]
                                        .slice(0, 8)
                                        .join(" . ")}
                                    </div>
                                  ) : null}
                                  <div className="mt-2 flex flex-wrap gap-4 text-sm font-semibold text-cyan-200">
                                    {project.repoUrl ? (
                                      <a
                                        href={project.repoUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="hover:underline"
                                      >
                                        Repository
                                      </a>
                                    ) : null}
                                    {project.liveUrl ? (
                                      <a
                                        href={project.liveUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="hover:underline"
                                      >
                                        Live demo
                                      </a>
                                    ) : null}
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <Empty>No portfolio projects are available yet.</Empty>
                        )}
                      </Section>
                    </>
                  )}

                  {entity.entityType === "recruiter" ? (
                    <Section title="Open Roles">
                      {entity.relatedJobs.length > 0 ? (
                        <div className="divide-y divide-slate-800/80">
                          {entity.relatedJobs.map((job) => (
                            <RecruiterOpenRoleCard
                              key={job._id}
                              job={job}
                              canApply={dashboardRole === UserRole.STUDENT}
                              hasApplied={Boolean(appliedJobIds[job._id]) || Boolean(job.hasApplied)}
                              isApplying={applyingJobId === job._id}
                              applyError={
                                applyErrorJobId === job._id ? applyErrorMessage : null
                              }
                              onApply={() => void handleApplyToJob(job._id)}
                              onViewJob={() => navigate(`/marketplace/jobs/${job._id}`)}
                            />
                          ))}
                        </div>
                      ) : (
                        <Empty>No open roles are available yet.</Empty>
                      )}
                    </Section>
                  ) : null}

                  <Section title="Startups">
                    {entity.relatedStartups.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {entity.relatedStartups.map((startup) => (
                          <StartupCard
                            key={startup._id}
                            startup={startup}
                            dashboardRole={dashboardRole}
                          />
                        ))}
                      </div>
                    ) : (
                      <Empty>No startups are linked to this portfolio yet.</Empty>
                    )}
                  </Section>
                </main>
                <aside className="space-y-5">
                  <Section title="Profile strength">
                    <div className="space-y-3">
                      {portfolioStats.map((stat) => (
                        <SidebarRow key={stat.label} label={stat.label} value={stat.value} />
                      ))}
                    </div>
                  </Section>

                  <Section title="Quick facts">
                    <div className="space-y-3">
                      {quickFacts.map((fact) => (
                        <SidebarRow key={fact.label} label={fact.label} value={fact.value} />
                      ))}
                    </div>
                  </Section>

                  {entity.githubStats ? (
                    <Section title="GitHub signal">
                      <div className="grid grid-cols-2 gap-3">
                        <StatCard label="Repos" value={entity.githubStats.totalRepos} />
                        <StatCard label="Stars" value={entity.githubStats.totalStars} />
                        <StatCard label="Forks" value={entity.githubStats.totalForks} />
                        <StatCard
                          label="Contributions"
                          value={entity.githubStats.contributionsLastYear}
                        />
                      </div>
                    </Section>
                  ) : null}
                </aside>
              </div>
        </>
      ) : null}
    </PortfolioViewerPageShell>
  );
}

export function UserPortfolioViewPage() {
  const authUser = useAuthStore((state) => state.user);

  return (
    <DashboardLayout role={authUser?.role}>
      <UserPortfolioViewContent />
    </DashboardLayout>
  );
}
