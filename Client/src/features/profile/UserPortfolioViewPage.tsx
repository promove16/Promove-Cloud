import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Github,
  Linkedin,
  type LucideIcon,
  Link2,
  MapPin,
  MessageCircle,
} from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  type MarketplaceEntityType,
  type MarketplaceJobSummary,
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

const roleGradients: Record<string, string> = {
  student: 'from-blue-600 via-indigo-600 to-cyan-500',
  mentor: 'from-purple-600 via-violet-600 to-pink-500',
  recruiter: 'from-amber-500 via-orange-600 to-yellow-500',
  investor: 'from-emerald-600 via-teal-600 to-green-500',
  school: 'from-pink-600 via-rose-600 to-red-500',
  college: 'from-indigo-600 via-blue-600 to-violet-500',
};


function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

function getPortfolioStats(entity: MarketplaceUserDetail) {
  if (entity.entityType === "school" || entity.entityType === "college") {
    return [
      { label: "Students", value: entity.institutionProfile?.totalStudentsEnrolled ?? 0 },
      { label: "Alumni", value: entity.institutionProfile?.alumniCount ?? 0 },
      { label: "Startups", value: entity.institutionProfile?.stats?.startupsLaunched ?? 0 },
      { label: "Collaborations", value: entity.institutionProfile?.stats?.industryCollaborations ?? 0 },
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
      { label: "Skills", value: entity.insightCounts.skills },
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
    <article className="border-b border-slate-800 py-5 last:border-b-0">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_180px] xl:gap-8">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-slate-100">{job.title}</h3>
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
          <p className="mt-3 max-w-4xl whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-6 text-slate-300">{job.description}</p>
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
        <div className="grid grid-cols-3 gap-3 border-t border-slate-800 pt-4 xl:grid-cols-1 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Score</div>
            <div className="mt-1 text-2xl font-semibold text-white">{job.minimumInnovationScore}+</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Applicants</div>
            <div className="mt-1 text-2xl font-semibold text-white">{job.applicantCount}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Shortlisted</div>
            <div className="mt-1 text-2xl font-semibold text-white">{job.shortlistedCount}</div>
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
  const isInstitution = entityType === "school" || entityType === "college";

  const portfolioStats = useMemo(
    () => (entity ? getPortfolioStats(entity) : []),
    [entity],
  );

  const visibleLinks = useMemo(() => {
    if (!entity) return [];
    return [
      entity.links?.websiteUrl ? { label: "Website", url: entity.links.websiteUrl, icon: Link2 } : null,
      entity.links?.githubUrl ? { label: "GitHub", url: entity.links.githubUrl, icon: Github } : null,
      entity.links?.linkedinUrl ? { label: "LinkedIn", url: entity.links.linkedinUrl, icon: Linkedin } : null,
    ].filter((link): link is { label: string; url: string; icon: LucideIcon } => Boolean(link));
  }, [entity]);

  const experienceHighlights = entity?.experienceHighlights ?? [];
  const educationHighlights = entity?.educationHighlights ?? [];
  const skills = entity?.skills ?? [];
  const portfolioHighlights = entity?.portfolioHighlights ?? [];

  const previousEntries = useMemo(() => {
    if (!entity || isInstitution || entity.entityType === "investor") return [];
    return experienceHighlights.slice(0, 3).map((e) => ({
      company: e.company,
      role: e.title,
    }));
  }, [entity, isInstitution, experienceHighlights]);

  const handleMessage = (targetId: string) => {
    const storageKey = `dm_first_contact_${targetId}`;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, "true");
    }
    navigate(`/dashboard/messages/${targetId}`);
  };

  const handleApplyToJob = async (jobId: string) => {
    if (applyingJobId || appliedJobIds[jobId]) return;
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
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-6 py-6 text-sm text-rose-100">
          Invalid portfolio route.
        </div>
      </div>
    );
  }

  if (entityType === "student") {
    return <Navigate to={getStudentPortfolioViewPath(entityId)} replace />;
  }

  return (
    <div className="-mx-4 -my-6 min-h-[calc(100vh-5rem)] bg-[#050816] px-4 py-6 text-slate-100 lg:-mx-8 lg:px-8">
      <div className="mx-auto w-full max-w-[96rem] space-y-4">
        <Link
          to={getMarketplaceBasePath(authUser?.role)}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to marketplace
        </Link>

        {detailQuery.isLoading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
            Loading portfolio...
          </div>
        ) : null}

        {detailQuery.isError ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
            This portfolio is not available for your role or could not be loaded.
          </div>
        ) : null}

        {entity ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
            {/* ── Left area: Hero + Content ── */}
            <div className="space-y-4">
              {/* Hero */}
              <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-[0_24px_60px_rgba(3,7,18,0.4)]">
                <div className="grid gap-4 p-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center sm:gap-6 sm:p-6">
                  <div className="relative group/avatar mx-auto sm:mx-0 shrink-0">
                    {/* Ambient Glow */}
                    <div className={`absolute -inset-1.5 rounded-[2rem] bg-gradient-to-tr ${roleGradients[entity.entityType] ?? 'from-slate-600 to-slate-500'} opacity-30 blur-md transition duration-500 group-hover/avatar:opacity-60`} />
                    
                    {/* Gradient Squircle Frame */}
                    <div className={`relative h-40 w-40 rounded-3xl bg-gradient-to-tr ${roleGradients[entity.entityType] ?? 'from-slate-600 to-slate-500'} p-[3px] shadow-[0_24px_50px_rgba(0,0,0,0.4)] sm:h-44 sm:w-44`}>
                      {/* Inner Slate Gap */}
                      <div className="h-full w-full rounded-[21px] bg-[#0c1220] p-1">
                        {/* Content Box */}
                        <div className="h-full w-full overflow-hidden rounded-[17px] bg-slate-950 flex items-center justify-center">
                          {entity.avatar ? (
                            <img src={entity.avatar} alt={entity.displayName} className="h-full w-full object-cover transition duration-500 group-hover/avatar:scale-105" />
                          ) : (
                            <div className={`flex h-full w-full items-center justify-center bg-gradient-to-tr ${roleGradients[entity.entityType] ?? 'from-slate-600 to-slate-500'}/10`}>
                              <span className="bg-gradient-to-tr from-white to-slate-400 bg-clip-text text-5xl font-black tracking-tight text-transparent">
                                {entity.displayName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Pulse ring for active status */}
                    <span className="absolute -bottom-1 -right-1 flex h-6 w-6">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-6 w-6 border-2 border-[#0c1220] bg-emerald-500"></span>
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-[#0c1220] p-5 text-slate-300">
                    <div className="text-[30px] font-semibold leading-none text-slate-100">
                      {entity.displayName}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xl font-medium text-slate-100">
                      <span>{entity.headline || `${roleLabel[entity.entityType]} Profile`}</span>
                      <span className="text-slate-500">—</span>
                      <span className="text-base text-slate-400">
                        {isInstitution
                          ? entity.institutionProfile?.institutionName ?? entity.displayName
                          : entity.domain ?? entity.displayName}
                      </span>
                    </div>

                    <div className="mt-4 border-t border-slate-800 pt-4">
                      <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
                        {isInstitution ? "Key Facts" : "Previously"}
                      </div>
                      {isInstitution ? (
                        <div className="mt-3 space-y-1.5 text-sm">
                          {entity.institutionProfile?.location ? (
                            <div className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)] gap-3">
                              <span className="font-medium text-slate-200">Location</span>
                              <span className="text-slate-400">{entity.institutionProfile.location}</span>
                            </div>
                          ) : null}
                          {entity.institutionProfile?.foundedYear ? (
                            <div className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)] gap-3">
                              <span className="font-medium text-slate-200">Founded</span>
                              <span className="text-slate-400">{entity.institutionProfile.foundedYear}</span>
                            </div>
                          ) : null}
                          {entity.institutionProfile?.academicYear ? (
                            <div className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)] gap-3">
                              <span className="font-medium text-slate-200">Academic Year</span>
                              <span className="text-slate-400">{entity.institutionProfile.academicYear}</span>
                            </div>
                          ) : null}
                        </div>
                      ) : previousEntries.length > 0 ? (
                        <div className="mt-3 space-y-1.5 text-sm">
                          {previousEntries.map((entry) => (
                            <div key={`${entry.company}-${entry.role}`} className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)] gap-3">
                              <span className="font-medium text-slate-200">{entry.company}</span>
                              <span className="text-slate-400">as {entry.role}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-slate-400">No previous entries available.</div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                      <button
                        type="button"
                        onClick={() => handleMessage(entity._id)}
                        className="inline-flex items-center gap-2 rounded-full border border-cyan-400/70 px-4 py-1.5 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-400/10"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Message
                      </button>
                      {visibleLinks.map((link) => {
                        const Icon = link.icon;
                        return (
                          <a
                            key={link.label}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-full border border-cyan-400/70 px-4 py-1.5 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-400/10"
                          >
                            <Icon className="h-4 w-4" />
                            {link.label}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>

              {/* ── Content area ── */}
              {isInstitution ? (
                <div className="space-y-4">
                  {entity.bio ? (
                    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                      <h3 className="border-b border-slate-800 pb-3 text-[34px] font-semibold leading-none text-slate-100">About</h3>
                      <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-300">{entity.bio}</p>
                    </section>
                  ) : null}

                  <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                    <h3 className="border-b border-slate-800 pb-3 text-[34px] font-semibold leading-none text-slate-100">Details</h3>
                    <div className="mt-4 space-y-3">
                      {[
                        { label: "Institution Name", value: entity.institutionProfile?.institutionName ?? entity.displayName },
                        { label: "Organization Type", value: entity.institutionProfile?.organizationType ?? roleLabel[entity.entityType] },
                        { label: "Founded", value: entity.institutionProfile?.foundedYear ?? "Not added" },
                        { label: "IIC Rating", value: entity.institutionProfile?.iicStarRating ?? 0 },
                        { label: "Students Enrolled", value: entity.institutionProfile?.totalStudentsEnrolled ?? 0 },
                        { label: "Alumni Count", value: entity.institutionProfile?.alumniCount ?? 0 },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between border-b border-slate-800/50 pb-2 text-sm last:border-b-0 last:pb-0">
                          <span className="text-slate-400">{row.label}</span>
                          <span className="font-medium text-white">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  {(entity.institutionProfile?.specialties ?? []).length > 0 ? (
                    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                      <h3 className="border-b border-slate-800 pb-3 text-[34px] font-semibold leading-none text-slate-100">Specialties</h3>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(entity.institutionProfile?.specialties ?? []).map((specialty) => (
                          <span key={specialty} className="rounded-full border border-cyan-400/60 bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-100">
                            {specialty}
                          </span>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {(() => {
                    const locations = [
                      entity.institutionProfile?.location,
                      ...(entity.institutionProfile?.locations ?? []),
                    ].filter(
                      (loc, idx, arr): loc is string => Boolean(loc) && arr.indexOf(loc) === idx,
                    );
                    return locations.length > 0 ? (
                      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                        <h3 className="border-b border-slate-800 pb-3 text-[34px] font-semibold leading-none text-slate-100">Locations</h3>
                        <div className="mt-4 space-y-3">
                          {locations.map((loc) => (
                            <div key={loc} className="flex items-center gap-2 text-sm text-slate-200">
                              <MapPin className="h-4 w-4 text-slate-400" />
                              {loc}
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null;
                  })()}

                  {entity.institutionProfile?.stats ? (
                    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                      <h3 className="border-b border-slate-800 pb-3 text-[34px] font-semibold leading-none text-slate-100">Outcomes</h3>
                      <div className="mt-4 space-y-3">
                        {[
                          { label: "Innovation Activities", value: entity.institutionProfile.stats.totalInnovationActivities },
                          { label: "Patents Filed", value: entity.institutionProfile.stats.patentsFiled },
                          { label: "Mentoring Hours", value: entity.institutionProfile.stats.totalMentoringHours },
                          { label: "Startups Launched", value: entity.institutionProfile.stats.startupsLaunched },
                          { label: "Students Placed", value: entity.institutionProfile.stats.studentsPlaced ?? "Not added" },
                          { label: "HR Connections", value: entity.institutionProfile.stats.totalHRConnections ?? "Not added" },
                        ].map((row) => (
                          <div key={row.label} className="flex items-center justify-between border-b border-slate-800/50 pb-2 text-sm last:border-b-0 last:pb-0">
                            <span className="text-slate-400">{row.label}</span>
                            <span className="font-medium text-white">{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                    {entity.bio ? (
                      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                        <h3 className="border-b border-slate-800 pb-3 text-[34px] font-semibold leading-none text-slate-100">About</h3>
                        <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-300">{entity.bio}</p>
                      </section>
                    ) : null}

                    {entity.entityType !== "investor" ? (
                      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <h3 className="text-[34px] font-semibold leading-none text-slate-100">Experience</h3>
                          <span className="text-sm font-medium text-sky-600">Show Details</span>
                        </div>
                        {experienceHighlights.length > 0 ? (
                          <div className="relative mt-4 pl-10">
                            <div className="absolute bottom-2 left-3.5 top-2 w-px bg-slate-800" />
                            <div className="space-y-6">
                              {experienceHighlights.slice(0, 4).map((item, index) => (
                                <article key={`${item.company}-${item.title}-${index}`} className="relative border-b border-slate-800 pb-5 last:border-b-0 last:pb-0">
                                  <span className={`absolute -left-10 top-1 h-4 w-4 rounded-full border-2 ${index === 0 ? "border-cyan-400" : "border-slate-600"} bg-slate-950`} />
                                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                                    <div>
                                      <div className="text-2xl font-medium text-slate-100">
                                        {item.title} <span className="mx-2 text-slate-500">-</span>
                                        <span className="text-xl text-slate-400">{item.company}</span>
                                      </div>
                                      {item.location ? <div className="mt-1 text-sm text-slate-400">{item.location}</div> : null}
                                    </div>
                                    <div className="text-right text-sm font-medium text-slate-400">
                                      {formatDate(item.startDate)} - {item.isCurrent ? "currently" : formatDate(item.endDate ?? undefined)}
                                    </div>
                                  </div>
                                </article>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 text-sm text-slate-400">No experience has been added yet.</div>
                        )}
                      </section>
                    ) : null}

                    {/* Skills + Featured */}
                    <section className="grid gap-4 lg:grid-cols-2">
                      <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                        <h3 className="border-b border-slate-800 pb-3 text-[34px] font-semibold leading-none text-slate-100">Skills</h3>
                        {skills.length > 0 ? (
                          <ul className="mt-4 space-y-3 text-sm text-slate-400">
                            {skills.slice(0, 6).map((skill) => (
                              <li key={skill.name} className="flex items-center gap-2">
                                <span className="text-slate-500">*</span>
                                <span>{skill.name}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="mt-4 text-sm text-slate-400">No skills added yet.</div>
                        )}
                      </article>
                      <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                        <h3 className="border-b border-slate-800 pb-3 text-[34px] font-semibold leading-none text-slate-100">Featured</h3>
                        {portfolioHighlights.length > 0 ? (
                          <ul className="mt-4 space-y-3">
                            {portfolioHighlights.slice(0, 4).map((project, index) => (
                              <li key={`${project.title}-${index}`} className="text-sm">
                                <div className="flex items-start gap-2 text-slate-200">
                                  <span className="text-slate-500">*</span>
                                  <span>{project.title}</span>
                                </div>
                                <div className="ml-4 mt-0.5 text-xs text-slate-500">
                                  {project.description || project.techStack.slice(0, 3).join(", ")}
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="mt-4 text-sm text-slate-400">No featured work yet.</div>
                        )}
                      </article>
                    </section>

                    {/* Education */}
                    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                      <h3 className="border-b border-slate-800 pb-3 text-[34px] font-semibold leading-none text-slate-100">Education</h3>
                      {educationHighlights.length > 0 ? (
                        <div className="mt-4 space-y-6">
                          {educationHighlights.slice(0, 3).map((item, index) => (
                            <article key={`${item.institution}-${index}`} className="grid gap-2 sm:grid-cols-[90px_minmax(0,1fr)]">
                              <div className="text-xs text-slate-500">
                                {item.startYear ? `${item.startYear} - ${item.isCurrent ? "Present" : item.endYear ?? ""}` : ""}
                              </div>
                              <div>
                                <h4 className="text-2xl font-medium text-slate-100">{item.institution}</h4>
                                <p className="mt-1 text-sm text-slate-400">
                                  {[item.degree, item.fieldOfStudy].filter(Boolean).join(", ")}
                                </p>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4 text-sm text-slate-400">No education entries added yet.</div>
                      )}
                    </section>

                    {/* Open Roles — recruiter only */}
                    {entity.entityType === "recruiter" && entity.relatedJobs.length > 0 ? (
                      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                        <h3 className="border-b border-slate-800 pb-3 text-[34px] font-semibold leading-none text-slate-100">Open Roles</h3>
                        <div className="mt-2">
                          {entity.relatedJobs.map((job) => (
                            <RecruiterOpenRoleCard
                              key={job._id}
                              job={job}
                              canApply={dashboardRole === UserRole.STUDENT}
                              hasApplied={Boolean(appliedJobIds[job._id]) || Boolean(job.hasApplied)}
                              isApplying={applyingJobId === job._id}
                              applyError={applyErrorJobId === job._id ? applyErrorMessage : null}
                              onApply={() => void handleApplyToJob(job._id)}
                              onViewJob={() => navigate(`/marketplace/jobs/${job._id}`)}
                            />
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {/* Startups */}
                    {entity.relatedStartups.length > 0 ? (
                      <section className="rounded-2xl border border-slate-800 bg-slate-900">
                        <div className="border-b border-slate-800 px-5 py-3">
                          <h3 className="text-[34px] font-semibold leading-none text-slate-100">Startups</h3>
                        </div>
                        <div>
                          {entity.relatedStartups.slice(0, 3).map((startup) => (
                            <article key={startup._id} className="border-b border-slate-800 px-5 py-3 last:border-b-0">
                              <h4 className="text-lg font-semibold text-slate-100">{startup.name}</h4>
                              <p className="mt-1 text-sm text-slate-400">{startup.tagline}</p>
                              <div className="mt-2 flex items-center justify-between">
                                <div className="text-xs text-slate-500">
                                  {[startup.category, startup.stage, `${startup.teamSize} members`].filter(Boolean).join("  ·  ")}
                                </div>
                                <Link
                                  to={getMarketplaceDetailPath(dashboardRole, "startup", startup._id)}
                                  className="text-sm font-semibold text-cyan-200 hover:text-cyan-100"
                                >
                                  View
                                </Link>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>
                    ) : null}
                </div>
              )}
            </div>

            {/* ── Right Sidebar ── */}
            <aside className="space-y-4">
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="border-b border-slate-800 pb-3 text-base font-semibold text-slate-100">Profile strength</h3>
                <div className="mt-3 space-y-2.5">
                  {portfolioStats.map((stat) => (
                    <div key={stat.label} className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{stat.label}</span>
                      <span className="font-semibold text-white">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </section>

              {entity.githubStats ? (
                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <h3 className="border-b border-slate-800 pb-3 text-base font-semibold text-slate-100">GitHub signal</h3>
                  <div className="mt-3 space-y-2.5">
                    {[
                      { label: "Repositories", value: entity.githubStats.totalRepos },
                      { label: "Stars", value: entity.githubStats.totalStars },
                      { label: "Forks", value: entity.githubStats.totalForks },
                      { label: "Contributions/yr", value: entity.githubStats.contributionsLastYear },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">{row.label}</span>
                        <span className="font-semibold text-white">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {isInstitution ? (
                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <h3 className="border-b border-slate-800 pb-3 text-base font-semibold text-slate-100">Contact</h3>
                  <div className="mt-3 space-y-2.5">
                    {entity.institutionProfile?.contactEmail ? (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Email</span>
                        <span className="font-medium text-white">{entity.institutionProfile.contactEmail}</span>
                      </div>
                    ) : null}
                    {entity.institutionProfile?.contactPhone ? (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Phone</span>
                        <span className="font-medium text-white">{entity.institutionProfile.contactPhone}</span>
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {visibleLinks.length > 0 ? (
                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <h3 className="border-b border-slate-800 pb-3 text-base font-semibold text-slate-100">Links</h3>
                  <div className="mt-3 space-y-2">
                    {visibleLinks.map((link) => {
                      const Icon = link.icon;
                      return (
                        <a
                          key={link.label}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 text-sm text-cyan-200 hover:text-cyan-100"
                        >
                          <Icon className="h-4 w-4" />
                          {link.label}
                        </a>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </aside>
          </div>
        ) : null}
      </div>
    </div>
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
