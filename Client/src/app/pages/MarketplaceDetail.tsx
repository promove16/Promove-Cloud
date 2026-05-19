import { type ReactNode, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  ExternalLink,
  FileText,
  FolderKanban,
  Globe,
  GraduationCap,
  Handshake,
  Lightbulb,
  MapPin,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  MarketplaceEntityDetail,
  MarketplaceEntityType,
  MarketplaceJobSummary,
  MarketplaceProfile,
  MarketplaceStartupDetail,
  MarketplaceStartupItem,
  MarketplaceUserDetail,
  marketplaceApi,
} from "../../api/marketplace.api";
import { requestApi } from "../../api/request.api";
import { toast } from "../components/ui/sonner";
import {
  buildCollegeHiringRequestPayload,
  CollegeHiringRequestFormState,
  CollegeHiringRequestModal,
} from "../../features/marketplace/CollegeHiringRequestModal";
import {
  getCollegeHiringRequestCooldownState,
  getLatestCollegeHiringRequest,
  isCollegeHiringRequest,
} from "../../features/marketplace/collegeHiringRequestCooldown";
import {
  getStartupInviteActionLabel,
  isStartupInviteTargetType,
  StartupInviteModal,
  StartupInviteTarget,
} from "../../features/marketplace/StartupInviteModal";
import { recruiterApi } from "../../api/recruiter.api";
import { investorApi } from "../../api/investor.api";
import { useAuthStore } from "../../store/authStore";
import { UserRole } from "../../types/roles.types";
import {
  getMarketplaceBasePath,
  getMarketplaceDetailPath,
  getStudentPortfolioViewPath,
  getUserPortfolioViewPath,
} from "../../features/marketplace/navigation";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const validEntityTypes = new Set<MarketplaceEntityType>([
  "student",
  "school",
  "college",
  "mentor",
  "investor",
  "recruiter",
  "startup",
]);

const getDashboardRole = (role?: UserRole) => role ?? UserRole.STUDENT;

const formatDate = (value?: string) => (value ? dateFormatter.format(new Date(value)) : "Not specified");

const formatRole = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const formatLabel = (value?: string) =>
  value
    ? value
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "Not specified";
const formatFundingStatus = (value?: string) => {
  if (!value || value === "none") return "No funding yet";
  if (value === "angel_seed") return "Angel / Seed";
  if (value === "vc") return "VC Funded";
  return formatLabel(value);
};
const formatPatentStatus = (value?: string) => {
  if (!value || value === "none") return "Not filed";
  return formatLabel(value);
};

const isStartupDetail = (entity: MarketplaceEntityDetail): entity is MarketplaceStartupDetail => entity.entityType === "startup";
const isInstitutionEntityType = (entityType: MarketplaceEntityType) => entityType === "school" || entityType === "college";

const linkList = (profile: MarketplaceProfile) =>
  [
    profile.links?.websiteUrl ? { label: "Website", href: profile.links.websiteUrl, icon: Globe } : null,
    profile.links?.githubUrl ? { label: "GitHub", href: profile.links.githubUrl, icon: ArrowUpRight } : null,
    profile.links?.linkedinUrl ? { label: "LinkedIn", href: profile.links.linkedinUrl, icon: ArrowUpRight } : null,
  ].filter((entry): entry is { label: string; href: string; icon: typeof Globe } => Boolean(entry));

const projectStats = (project: NonNullable<MarketplaceStartupItem["project"]>) => [
  { label: "Progress", value: `${project.progressPercent}%` },
  { label: "Milestones", value: `${project.completedMilestones}/${project.totalMilestones}` },
  { label: "Open Tasks", value: String(project.openTasks) },
  { label: "Repos", value: String(project.repoCount) },
];

const jobStats = (job: MarketplaceJobSummary) => [
  { label: "Innovation Score", value: `${job.minimumInnovationScore}+` },
  { label: "Applicants", value: String(job.applicantCount) },
  { label: "Shortlisted", value: String(job.shortlistedCount) },
];

const getJobActionLabel = (hasApplied: boolean) => (hasApplied ? "Applied" : "Apply now");
const marketplaceDetailShellClassName =
  "min-h-[calc(100vh-7rem)] bg-[#060814] bg-[radial-gradient(circle_at_20%_0%,rgba(20,184,166,0.14),transparent_34%),radial-gradient(circle_at_88%_10%,rgba(59,130,246,0.12),transparent_30%)] text-slate-100";
const marketplaceDetailContentClassName = "w-full px-3 py-5 sm:px-4 lg:px-5 xl:px-6";

export function MarketplaceDetail() {
  const navigate = useNavigate();
  const authUser = useAuthStore((state) => state.user);
  const { entityType: entityTypeParam, entityId } = useParams();

  const entityType = useMemo(
    () =>
      entityTypeParam && validEntityTypes.has(entityTypeParam as MarketplaceEntityType)
        ? (entityTypeParam as MarketplaceEntityType)
        : null,
    [entityTypeParam],
  );

  const detailQuery = useQuery({
    queryKey: ["marketplace", "detail", entityType, entityId],
    queryFn: () => marketplaceApi.getEntityDetail(entityType!, entityId!),
    enabled: Boolean(entityType === "startup" && entityId),
  });

  const entity = detailQuery.data;
  const dashboardRole = getDashboardRole(authUser?.role);

  const handleMessage = (targetId: string) => {
    const storageKey = `dm_first_contact_${targetId}`;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, "true");
    }
    navigate(`/dashboard/messages/${targetId}`);
  };

  if (!entityType || !entityId) {
    return (
      <div className={marketplaceDetailShellClassName}>
        <div className={marketplaceDetailContentClassName}>
          <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 px-6 py-6 text-sm text-rose-100">
            Invalid marketplace detail route.
          </div>
        </div>
      </div>
    );
  }

  if (entityType === "student") {
    return <Navigate to={getStudentPortfolioViewPath(entityId)} replace />;
  }

  if (entityType !== "startup") {
    return (
      <Navigate
        to={getUserPortfolioViewPath(
          entityType as "school" | "college" | "mentor" | "investor" | "recruiter",
          entityId,
        )}
        replace
      />
    );
  }

  return (
    <div className={marketplaceDetailShellClassName}>
      <div className={marketplaceDetailContentClassName}>
        <div className="space-y-8 sm:space-y-10">
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 sm:pt-2">
            <Link
              to={`${getMarketplaceBasePath(dashboardRole)}?role=${entityType}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/55 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to marketplace
            </Link>
          </div>

          {detailQuery.isLoading ? (
            <div className="rounded-[32px] border border-white/10 bg-[#090d1b] px-6 py-10 text-sm text-slate-400">
              Loading detail view...
            </div>
          ) : null}

          {detailQuery.isError ? (
            <div className="rounded-[32px] border border-rose-500/20 bg-rose-500/10 px-6 py-6 text-sm text-rose-100">
              Unable to load this marketplace record right now.
            </div>
          ) : null}

          {entity ? (
            isStartupDetail(entity) ? (
              <StartupDetailView entity={entity} onMessage={handleMessage} />
            ) : (
              <ProfileDetailView entity={entity} onMessage={handleMessage} dashboardRole={dashboardRole} />
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StartupDetailView({
  entity,
  onMessage,
}: {
  entity: MarketplaceStartupDetail;
  onMessage: (targetId: string) => void;
}) {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const isOwnStartup = currentUser
    ? entity.founders.some((founder) => founder._id === currentUser._id) || entity.primaryFounderId === currentUser._id
    : false;
  const messageFounderId =
    !isOwnStartup && entity.primaryFounderId ? entity.primaryFounderId : null;
  const isInvestorView = currentUser?.role === UserRole.INVESTOR;
  const canShowInvestorButton = isInvestorView && (entity.acceptsPennyInvestors || entity.acceptsSoleInvestor);
  const primaryLocation = entity.founders.map((founder) => founder.location).find(Boolean);
  const fundingLabel = typeof entity.fundingNeeded === "number" ? money.format(entity.fundingNeeded) : "Undisclosed";
  const launchTarget = entity.launchTargets[0];
  const publicDetails = entity.publicDetails ?? {};

  const tags = Array.from(
    new Set(
      [
        entity.category,
        entity.traction.mvpBuilt ? "MVP Ready" : "",
        entity.traction.revenueGenerating ? "Revenue Generating" : "",
        entity.traction.patentFiled ? "Patent Filed" : "",
        entity.launchTargets.includes("Investors") ? "Open for Investment" : "",
        ...entity.trustProfile.signals.slice(0, 4),
      ].filter(Boolean) as string[],
    ),
  );

  const stats = [
    { label: "Launch Score", value: String(entity.innovationScoreAtLaunch) },
    { label: "Team Size", value: String(entity.teamSize) },
    { label: "Products", value: String(entity.activeProducts) },
    { label: "Funding Needed", value: fundingLabel },
  ];

  const snapshotRows: { label: string; value: string; icon: LucideIcon }[] = [
    { label: "Startup Stage", value: formatLabel(publicDetails.innovation?.startupStage), icon: Sparkles },
    { label: "Funding Status", value: formatFundingStatus(publicDetails.innovation?.fundingStatus), icon: ShieldCheck },
    { label: "Patent Status", value: formatPatentStatus(publicDetails.innovation?.patentStatus), icon: FileText },
  ];

  const narrativeRows = (
    [
      { label: "Problem Clarity", value: publicDetails.innovation?.problemClarity, icon: Target },
      { label: "Unique Solution", value: publicDetails.innovation?.uniqueSolution, icon: Lightbulb },
      { label: "Market Differentiation", value: publicDetails.innovation?.marketDifferentiation, icon: Globe },
    ] as { label: string; value: string | undefined; icon: LucideIcon }[]
  ).filter((row): row is { label: string; value: string; icon: LucideIcon } => Boolean(row.value));

  const proofItems = [
    { label: "Website live", active: entity.trustProfile.hasWebsite },
    { label: "Product demo", active: entity.trustProfile.hasProductDemo },
    { label: "Portfolio linked", active: entity.trustProfile.hasPortfolio },
    { label: "ITR filing", active: Boolean(publicDetails.innovation?.hasItrFiling) },
    { label: "Revenue proof", active: Boolean(publicDetails.innovation?.hasRevenueProof) },
    { label: "Government grant", active: Boolean(publicDetails.innovation?.hasGovernmentGrant) },
    { label: "Award recognition", active: Boolean(publicDetails.innovation?.hasAwardRecognition) },
  ];
  const publicLinks = [
    publicDetails.publicLinks?.websiteUrl
      ? { label: "Website", href: publicDetails.publicLinks.websiteUrl, icon: Globe }
      : null,
    publicDetails.publicLinks?.productDemoUrl
      ? { label: "Product demo", href: publicDetails.publicLinks.productDemoUrl, icon: ExternalLink }
      : null,
    publicDetails.publicLinks?.portfolioUrl
      ? { label: "Portfolio", href: publicDetails.publicLinks.portfolioUrl, icon: ArrowUpRight }
      : null,
  ].filter((link): link is { label: string; href: string; icon: LucideIcon } => Boolean(link));

  const handleExpressInterest = () => {
    navigate('/dashboard/investor/startups', { state: { highlightStartupId: entity._id } });
  };

  return (
    <div className="space-y-10 pb-10">
      <header className="relative isolate border-b border-white/10 px-4 pb-10 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-0 -z-10 bg-[radial-gradient(circle_at_18%_20%,rgba(45,212,191,0.14),transparent_48%),radial-gradient(circle_at_82%_28%,rgba(59,130,246,0.12),transparent_52%)] [mask-image:linear-gradient(to_bottom,black_0%,black_62%,transparent_100%)]" />
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 sm:tracking-[0.32em]">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-xs font-bold text-white ring-1 ring-white/10">
            {entity.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="text-teal-300">Startup</span>
          <span className="hidden h-px flex-1 bg-white/10 sm:block" />
          <span className="text-slate-400">{entity.stage}</span>
          {entity.trustProfile.legalStructure ? (
            <>
              <span className="hidden h-px w-6 bg-white/10 sm:block" />
              <span className="text-slate-400">{entity.trustProfile.legalStructure}</span>
            </>
          ) : null}
        </div>

        <div className="mt-7 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="max-w-5xl break-words text-4xl font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl">
              {entity.name}
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-300 [text-wrap:pretty]">
              {entity.tagline}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-400">
              {primaryLocation ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-teal-300" />
                  {primaryLocation}
                </span>
              ) : null}
              <span>{entity.category}</span>
              {launchTarget ? <span>Targeting {launchTarget}</span> : null}
              <span>
                Score <span className="text-white">{entity.innovationScoreAtLaunch}</span>
              </span>
              <span>{entity.teamSize} on team</span>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto lg:justify-end">
            {entity.pitchDeckUrl ? (
              <a
                href={entity.pitchDeckUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 active:scale-[0.98] sm:w-auto"
              >
                <FileText className="h-4 w-4" />
                Pitch Deck
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
            {canShowInvestorButton ? (
              <button
                onClick={handleExpressInterest}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-5 py-2.5 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400/60 hover:bg-cyan-400/15 active:scale-[0.98] sm:w-auto"
              >
                <Handshake className="h-4 w-4" />
                Express Interest
              </button>
            ) : null}
            {messageFounderId ? (
              <button
                onClick={() => onMessage(messageFounderId)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/5 active:scale-[0.98] sm:w-auto"
              >
                <MessageCircle className="h-4 w-4" />
                Message Founder
              </button>
            ) : null}
          </div>
        </div>

        {tags.length > 0 ? (
          <div className="mt-7 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-500">
            {tags.map((tag) => (
              <span key={tag} className="max-w-full [overflow-wrap:anywhere]">
                <span className="text-slate-600">#</span>
                {tag.toLowerCase().replace(/\s+/g, "")}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-y-6 border-b border-white/10 px-4 pb-8 sm:grid-cols-4 sm:gap-y-0 sm:divide-x sm:divide-white/10 sm:px-6 lg:px-8">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`min-w-0 ${index > 0 ? "sm:pl-8" : ""} ${index < stats.length - 1 ? "sm:pr-8" : ""}`}
          >
            <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">{stat.label}</div>
            <div className="mt-2 break-words text-2xl font-semibold text-white tabular-nums sm:text-3xl">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-12 px-4 sm:px-6 lg:px-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-12">
        <div className="min-w-0 space-y-12">
          {narrativeRows.length > 0 ? (
            <DetailSection title="About this startup">
              <div className="space-y-7">
                {narrativeRows.map((row) => {
                  const Icon = row.icon;
                  return (
                    <div key={row.label}>
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-slate-500">
                        <Icon className="h-3.5 w-3.5 text-teal-300" />
                        {row.label}
                      </div>
                      <p className="mt-2 max-w-[72ch] whitespace-pre-wrap text-base leading-7 text-slate-200 [overflow-wrap:anywhere]">
                        {row.value}
                      </p>
                    </div>
                  );
                })}
              </div>
            </DetailSection>
          ) : null}

          <DetailSection title="Innovation snapshot" icon={ShieldCheck}>
            <dl className="grid gap-x-10 gap-y-5 sm:grid-cols-3">
              {snapshotRows.map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.label}>
                    <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                      <Icon className="h-3.5 w-3.5 text-teal-300" />
                      {row.label}
                    </dt>
                    <dd className="mt-2 text-base font-semibold text-white [overflow-wrap:anywhere]">{row.value || "-"}</dd>
                  </div>
                );
              })}
            </dl>
          </DetailSection>

          <DetailSection title="Founder team" icon={Users}>
            {entity.founders.length === 0 ? (
              <p className="text-sm text-slate-500">No founder profiles linked to this startup yet.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {entity.founders.map((founder) => (
                  <li
                    key={founder._id || founder.displayName}
                    className="flex items-start gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-sm font-semibold text-white ring-1 ring-white/10">
                      {(founder.displayName || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="min-w-0 text-base font-semibold text-white [overflow-wrap:anywhere]">
                          {founder.displayName || "Unknown Founder"}
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                          Score {founder.innovationScore}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-slate-400">
                        {founder.headline ? <span className="[overflow-wrap:anywhere]">{founder.headline}</span> : null}
                        {founder.location ? <span className="[overflow-wrap:anywhere]">{founder.location}</span> : null}
                        {founder.domain ? <span className="[overflow-wrap:anywhere]">{founder.domain}</span> : null}
                      </div>
                      {founder.bio ? (
                        <p className="mt-2 text-sm leading-6 text-slate-300 [overflow-wrap:anywhere]">{founder.bio}</p>
                      ) : null}
                    </div>
                    {founder._id && founder._id !== currentUser?._id ? (
                      <button
                        onClick={() => onMessage(founder._id)}
                        className="mt-1 inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-cyan-200"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Message
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>

          {entity.project ? (
            <DetailSection
              title="Related project"
              icon={FolderKanban}
              action={
                <span className="text-xs text-slate-500">
                  Updated {formatDate(entity.project.updatedAt)}
                </span>
              }
            >
              <h3 className="text-xl font-semibold text-white [overflow-wrap:anywhere]">{entity.project.title}</h3>
              <p className="mt-1 text-sm text-cyan-200">
                {entity.project.category} - {entity.project.stage}
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
                {projectStats(entity.project).map((stat) => (
                  <div key={stat.label}>
                    <dt className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                      {stat.label}
                    </dt>
                    <dd className="mt-1 break-words text-lg font-semibold text-white tabular-nums">{stat.value}</dd>
                  </div>
                ))}
              </dl>
              {entity.project.lastUpdate ? (
                <div className="mt-6 border-l-2 border-teal-400/40 pl-4">
                  <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                    Latest update
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300 [overflow-wrap:anywhere]">
                    {entity.project.lastUpdate.note}
                  </p>
                  <div className="mt-2 text-xs text-slate-500">
                    {formatDate(entity.project.lastUpdate.submittedAt)}
                  </div>
                </div>
              ) : null}
            </DetailSection>
          ) : null}
        </div>

        <aside className="space-y-10 xl:border-l xl:border-white/10 xl:pl-8">
          <DetailSection title="Traction" compact>
            <dl>
              <DefRow
                label="Patent Filed"
                value={entity.traction.patentFiled ? "Yes" : "No"}
                tone={entity.traction.patentFiled ? "positive" : "muted"}
              />
              <DefRow
                label="Patent Status"
                value={formatLabel(publicDetails.innovation?.patentStatus)}
              />
              <DefRow
                label="MVP Built"
                value={entity.traction.mvpBuilt ? "Yes" : "No"}
                tone={entity.traction.mvpBuilt ? "positive" : "muted"}
              />
              <DefRow
                label="Revenue Generating"
                value={entity.traction.revenueGenerating ? "Yes" : "No"}
                tone={entity.traction.revenueGenerating ? "positive" : "muted"}
              />
              <DefRow
                label="Users"
                value={
                  typeof entity.traction.usersCount === "number"
                    ? String(entity.traction.usersCount)
                    : "Not shared"
                }
              />
            </dl>
          </DetailSection>

          <DetailSection title="Trust proof" compact>
            <dl>
              <DefRow label="Proof items" value={String(entity.trustProfile.proofCount)} />
              <DefRow
                label="Funding status"
                value={entity.trustProfile.fundingStatus ?? "Not disclosed"}
              />
              {proofItems.map((item) => (
                <DefRow
                  key={item.label}
                  label={item.label}
                  value={item.active ? "Yes" : "No"}
                  tone={item.active ? "positive" : "muted"}
                />
              ))}
            </dl>
            {publicLinks.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                {publicLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <a
                      key={`${link.label}-${link.href}`}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-200 transition hover:text-cyan-100"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {link.label}
                    </a>
                  );
                })}
              </div>
            ) : null}
          </DetailSection>

          {entity.sharePool ? (
            <DetailSection title="Equity window" compact>
              <dl>
                <DefRow label="Total Shares" value={String(entity.sharePool.totalShares)} />
                <DefRow
                  label="Available Shares"
                  value={String(entity.sharePool.availableShares)}
                />
                <DefRow
                  label="Reserved For Sole"
                  value={String(entity.sharePool.reservedForSole)}
                />
                <DefRow
                  label="Penny Investors"
                  value={`${entity.sharePool.currentPennyCount}/${entity.sharePool.maxPennyInvestors}`}
                />
                <DefRow
                  label="Sole Investor"
                  value={entity.sharePool.hasSoleInvestor ? "Assigned" : "Open"}
                  tone={entity.sharePool.hasSoleInvestor ? "muted" : "positive"}
                />
                <DefRow label="Launched" value={formatDate(entity.launchedAt)} />
              </dl>
            </DetailSection>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function DetailSection({
  title,
  icon: Icon,
  action,
  compact = false,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  action?: ReactNode;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-2.5">
        <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 sm:tracking-[0.3em]">
          {Icon ? <Icon className="h-3.5 w-3.5 text-teal-300" /> : null}
          <span className="min-w-0 [overflow-wrap:anywhere]">{title}</span>
        </div>
        {action}
      </div>
      <div className={compact ? "mt-3" : "mt-6"}>{children}</div>
    </section>
  );
}

function DefRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "muted";
}) {
  const valueClass =
    tone === "positive"
      ? "text-emerald-300"
      : tone === "muted"
        ? "text-slate-500"
        : "text-white";
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 py-2.5 last:border-b-0">
      <span className="min-w-0 text-sm text-slate-400 [overflow-wrap:anywhere]">{label}</span>
      <span className={`max-w-[58%] text-right text-sm font-medium tabular-nums [overflow-wrap:anywhere] ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

export function ProfileDetailView({
  entity,
  onMessage,
  dashboardRole,
}: {
  entity: MarketplaceUserDetail;
  onMessage: (targetId: string) => void;
  dashboardRole: UserRole;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const currentUserId = authUser?._id;
  const links = linkList(entity);
  const isInstitution = isInstitutionEntityType(entity.entityType);
  const institutionProfile = entity.institutionProfile;
  const isStudentRecruiterView =
    dashboardRole === UserRole.STUDENT && entity.entityType === "recruiter";
  const [appliedJobIds, setAppliedJobIds] = useState<Record<string, boolean>>({});
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [applyErrorJobId, setApplyErrorJobId] = useState<string | null>(null);
  const [applyErrorMessage, setApplyErrorMessage] = useState<string | null>(null);
  const [inviteTarget, setInviteTarget] = useState<StartupInviteTarget | null>(
    null,
  );
  const [hiringRequestTarget, setHiringRequestTarget] =
    useState<MarketplaceUserDetail | null>(null);
  const [inviteFeedback, setInviteFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const inviteEntityType = isStartupInviteTargetType(entity.entityType)
    ? entity.entityType
    : null;
  const outgoingRequestsQuery = useQuery({
    queryKey: ["requests", "outgoing", "college-hiring"],
    queryFn: requestApi.outgoing,
    enabled:
      dashboardRole === UserRole.COLLEGE &&
      entity.entityType === "recruiter" &&
      entity._id !== currentUserId,
  });
  const latestCollegeHiringRequest = useMemo(
    () =>
      getLatestCollegeHiringRequest(
        (outgoingRequestsQuery.data ?? []).filter(isCollegeHiringRequest),
        entity._id,
      ),
    [entity._id, outgoingRequestsQuery.data],
  );
  const hiringRequestState = getCollegeHiringRequestCooldownState(
    latestCollegeHiringRequest,
  );

  const requestHiringEventMutation = useMutation({
    mutationFn: async ({
      form,
      target,
    }: {
      form: CollegeHiringRequestFormState;
      target: MarketplaceUserDetail;
    }) =>
      requestApi.create(
        buildCollegeHiringRequestPayload({
          collegeUser: authUser,
          form,
          requestOrigin: "college_marketplace_detail",
          target,
        }),
      ),
    onSuccess: async (_request, { target }) => {
      const message = `Hiring request sent to ${target.displayName}.`;
      setInviteFeedback({
        tone: "success",
        message,
      });
      toast.success(message);
      setHiringRequestTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["requests", "outgoing"] });
    },
    onError: (error) => {
      const message = isAxiosError<{ error?: { message?: string } }>(error)
        ? error.response?.data?.error?.message ??
          "Unable to send the hiring event request right now."
        : error instanceof Error
          ? error.message
          : "Unable to send the hiring event request right now.";
      setInviteFeedback({
        tone: "error",
        message,
      });
      toast.error(message);
    },
  });

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

  const canInviteToStartup =
    Boolean(inviteEntityType) &&
    inviteEntityType !== "investor" &&
    entity._id !== currentUserId;
  const canRequestHiringEvent =
    dashboardRole === UserRole.COLLEGE &&
    entity.entityType === "recruiter" &&
    entity._id !== currentUserId;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#070816] px-6 py-7 shadow-[0_30px_120px_rgba(15,23,42,0.45)] sm:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.15),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(250,204,21,0.12),transparent_38%)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[28px] bg-gradient-to-br from-cyan-500/25 via-sky-500/10 to-fuchsia-500/20 text-3xl font-semibold text-white ring-1 ring-white/10">
              {entity.avatar ? (
                <img src={entity.avatar} alt={entity.displayName} className="h-20 w-20 object-cover" />
              ) : (
                entity.displayName.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
                {formatRole(entity.entityType)} View
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">{entity.displayName}</h1>
                <p className="mt-2 max-w-3xl text-base leading-7 text-slate-300">
                  {entity.bio ?? "This public profile does not have an overview yet."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[formatRole(entity.entityType), entity.domain ?? "", entity.location ?? "", entity.headline ?? ""]
                  .filter(Boolean)
                  .map((chip) => (
                    <span key={chip} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
                      {chip}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onMessage(entity._id)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
            >
              <MessageCircle className="h-4 w-4" />
              Message
            </button>
            {canInviteToStartup ? (
              <button
                onClick={() => {
                  setInviteFeedback(null);
                  setInviteTarget({
                    _id: entity._id,
                    entityType: inviteEntityType!,
                    displayName: entity.displayName,
                    headline: entity.headline,
                    domain: entity.domain,
                    location: entity.location,
                  });
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
              >
                <Send className="h-4 w-4" />
                {getStartupInviteActionLabel(inviteEntityType!)}
              </button>
            ) : null}
            {canRequestHiringEvent ? (
              <button
                onClick={() => {
                  if (hiringRequestState.isCoolingDown) {
                    return;
                  }

                  setInviteFeedback(null);
                  setHiringRequestTarget(entity);
                }}
                disabled={hiringRequestState.isCoolingDown}
                title={hiringRequestState.helperText ?? undefined}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                  hiringRequestState.isCoolingDown
                    ? "cursor-not-allowed border-white/5 bg-white/[0.03] text-slate-500"
                    : "border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10"
                }`}
              >
                <CalendarDays className="h-4 w-4" />
                {hiringRequestState.buttonLabel}
              </button>
            ) : null}
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </a>
              );
            })}
          </div>
        </div>
        {canRequestHiringEvent && hiringRequestState.isCoolingDown ? (
          <div className="relative mt-4 text-sm text-slate-400">
            {hiringRequestState.helperText}
          </div>
        ) : null}
      </section>

      {inviteFeedback ? (
        <div
          className={`rounded-[24px] px-4 py-3 text-sm ${
            inviteFeedback.tone === "success"
              ? "border border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
              : "border border-rose-500/30 bg-rose-500/10 text-rose-100"
          }`}
        >
          {inviteFeedback.message}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr),360px]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/10 bg-[#090d1b] p-6">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Profile depth</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {isInstitution ? (
                <>
                  <MetricCard label="Students" value={String(institutionProfile?.totalStudentsEnrolled ?? 0)} />
                  <MetricCard label="Alumni" value={String(institutionProfile?.alumniCount ?? 0)} />
                  <MetricCard label="Startups" value={String(institutionProfile?.stats?.startupsLaunched ?? 0)} />
                  <MetricCard label="Collaborations" value={String(institutionProfile?.stats?.industryCollaborations ?? 0)} />
                </>
              ) : (
                <>
                  <MetricCard label="Skills" value={String(entity.insightCounts.skills)} />
                  <MetricCard label="Experience" value={String(entity.insightCounts.experience)} />
                  <MetricCard label="Education" value={String(entity.insightCounts.education)} />
                  <MetricCard
                    label={entity.entityType === "recruiter" ? "Open Jobs" : "Projects"}
                    value={
                      entity.entityType === "recruiter"
                        ? String(entity.relatedCounts.jobs)
                        : String(entity.insightCounts.portfolioProjects)
                    }
                  />
                </>
              )}
            </div>
          </div>

          {isInstitution ? (
            <>
              <div className="rounded-[28px] border border-white/10 bg-[#090d1b] p-6">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500">
                  <GraduationCap className="h-4 w-4" />
                  Institution details
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <MetricCard label="Type" value={institutionProfile?.organizationType ?? formatRole(entity.entityType)} />
                  <MetricCard label="Founded" value={institutionProfile?.foundedYear ? String(institutionProfile.foundedYear) : "Not added"} />
                  <MetricCard label="Academic Year" value={institutionProfile?.academicYear ?? "Not added"} />
                  <MetricCard label="IIC Rating" value={typeof institutionProfile?.iicStarRating === "number" ? institutionProfile.iicStarRating.toFixed(1) : "Not added"} />
                  <MetricCard label="Faculty / Staff" value={typeof institutionProfile?.employeeCount === "number" ? String(institutionProfile.employeeCount) : "Not added"} />
                  <MetricCard label="Top Hiring Sector" value={institutionProfile?.stats?.topHiringSector ?? "Not added"} />
                </div>
              </div>

              {(institutionProfile?.specialties?.length ?? 0) > 0 ? (
                <div className="rounded-[28px] border border-white/10 bg-[#090d1b] p-6">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500">
                    <Sparkles className="h-4 w-4" />
                    Specialties
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(institutionProfile?.specialties ?? []).map((specialty) => (
                      <span key={specialty} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                        {specialty}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {(institutionProfile?.location || (institutionProfile?.locations?.length ?? 0) > 0) ? (
                <div className="rounded-[28px] border border-white/10 bg-[#090d1b] p-6">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500">
                    <MapPin className="h-4 w-4" />
                    Locations
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {[institutionProfile?.location, ...(institutionProfile?.locations ?? [])]
                      .filter((location, index, items): location is string => Boolean(location) && items.indexOf(location) === index)
                      .map((location) => (
                        <div key={location} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-200">
                          {location}
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}

              {institutionProfile?.stats ? (
                <div className="rounded-[28px] border border-white/10 bg-[#090d1b] p-6">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500">
                    <FolderKanban className="h-4 w-4" />
                    Outcomes
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Innovation Activities" value={String(institutionProfile.stats.totalInnovationActivities)} />
                    <MetricCard label="Patents Filed" value={String(institutionProfile.stats.patentsFiled)} />
                    <MetricCard label="Mentoring Hours" value={String(institutionProfile.stats.totalMentoringHours)} />
                    <MetricCard label="Startups Launched" value={String(institutionProfile.stats.startupsLaunched)} />
                    <MetricCard label="HR Connections" value={typeof institutionProfile.stats.totalHRConnections === "number" ? String(institutionProfile.stats.totalHRConnections) : "Not added"} />
                    <MetricCard label="Students Placed" value={typeof institutionProfile.stats.studentsPlaced === "number" ? String(institutionProfile.stats.studentsPlaced) : "Not added"} />
                    <MetricCard label="Shortlists This Quarter" value={typeof institutionProfile.stats.directShortlistsThisQuarter === "number" ? String(institutionProfile.stats.directShortlistsThisQuarter) : "Not added"} />
                    <MetricCard label="Industry Collaborations" value={String(institutionProfile.stats.industryCollaborations)} />
                  </div>
                </div>
              ) : null}
            </>
          ) : entity.skills && entity.skills.length > 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-[#090d1b] p-6">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500">
                <Sparkles className="h-4 w-4" />
                Skills
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {entity.skills.map((skill) => (
                  <span key={skill.name} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                    {skill.name} - {skill.level}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {!isInstitution && entity.experienceHighlights && entity.experienceHighlights.length > 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-[#090d1b] p-6">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500">
                <CalendarDays className="h-4 w-4" />
                Experience
              </div>
              <div className="mt-4 space-y-3">
                {entity.experienceHighlights.map((experience) => (
                  <div key={`${experience.company}-${experience.title}`} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-lg font-semibold text-white">{experience.title}</div>
                        <div className="mt-1 text-sm text-cyan-200">
                          {experience.company} - {experience.type.split("_").join(" ")}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                          {experience.location ? <span>{experience.location}</span> : null}
                          <span>
                            {formatDate(experience.startDate)} -{" "}
                            {experience.isCurrent ? "Present" : formatDate(experience.endDate ?? undefined)}
                          </span>
                        </div>
                        {experience.description ? (
                          <p className="mt-3 text-sm leading-6 text-slate-300">{experience.description}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {experience.skills.map((skill) => (
                          <span key={skill} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!isInstitution && entity.educationHighlights && entity.educationHighlights.length > 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-[#090d1b] p-6">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500">
                <GraduationCap className="h-4 w-4" />
                Education
              </div>
              <div className="mt-4 space-y-3">
                {entity.educationHighlights.map((education) => (
                  <div key={education.institution} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-lg font-semibold text-white">{education.institution}</div>
                    <div className="mt-1 text-sm text-cyan-200">
                      {[education.degree, education.fieldOfStudy].filter(Boolean).join(" - ")}
                    </div>
                    <div className="mt-2 text-sm text-slate-400">
                      {[education.startYear, education.isCurrent ? "Present" : education.endYear ?? ""]
                        .filter(Boolean)
                        .join(" - ")}
                    </div>
                    {education.grade ? <div className="mt-2 text-sm text-slate-300">Grade: {education.grade}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!isInstitution && entity.portfolioHighlights && entity.portfolioHighlights.length > 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-[#090d1b] p-6">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500">
                <FolderKanban className="h-4 w-4" />
                Projects
              </div>
              <div className="mt-4 space-y-3">
                {entity.portfolioHighlights.map((project) => (
                  <div key={project.title} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-lg font-semibold text-white">{project.title}</div>
                        {project.description ? <p className="mt-2 text-sm leading-6 text-slate-300">{project.description}</p> : null}
                      </div>
                      <div className="text-sm text-slate-400">
                        {project.stars} stars - {project.forks} forks
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[...project.techStack, ...project.languages].slice(0, 8).map((tech) => (
                        <span key={`${project.title}-${tech}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                          {tech}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {project.repoUrl ? (
                        <a
                          href={project.repoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-medium text-cyan-200 hover:text-cyan-100"
                        >
                          Repository
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                      {project.liveUrl ? (
                        <a
                          href={project.liveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-medium text-cyan-200 hover:text-cyan-100"
                        >
                          Live Preview
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {entity.entityType === "recruiter" && entity.relatedJobs.length > 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-[#090d1b] p-6">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500">
                <BriefcaseBusiness className="h-4 w-4" />
                Open Roles
              </div>
              <div className="mt-4 space-y-3">
                {entity.relatedJobs.map((job) => {
                  const hasApplied = Boolean(appliedJobIds[job._id]) || Boolean(job.hasApplied);
                  const isApplying = applyingJobId === job._id;

                  return (
                  <div key={job._id} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-lg font-semibold text-white">{job.title}</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-sm text-cyan-200">
                          <span>{job.company}</span>
                          <span>{job.type}</span>
                          <span>{job.domain}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {job.location}
                          </span>
                          <span>Created {formatDate(job.createdAt)}</span>
                          {job.expiresAt ? <span>Closes {formatDate(job.expiresAt)}</span> : null}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-300">{job.description}</p>
                        {isStudentRecruiterView ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleApplyToJob(job._id)}
                              disabled={hasApplied || isApplying || !job.isActive}
                              className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                            >
                              {isApplying ? "Applying..." : getJobActionLabel(hasApplied)}
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/marketplace/jobs/${job._id}`)}
                              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
                            >
                              View job
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          </div>
                        ) : null}
                        {applyErrorJobId === job._id && applyErrorMessage ? (
                          <div className="mt-3 text-sm text-rose-300">{applyErrorMessage}</div>
                        ) : null}
                      </div>
                      <div className="grid gap-2 sm:w-44">
                        {jobStats(job).map((stat) => (
                          <div key={`${job._id}-${stat.label}`} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{stat.label}</div>
                            <div className="mt-1 font-semibold text-white">{stat.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          ) : null}

          {entity.relatedStartups.length > 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-[#090d1b] p-6">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500">
                <Sparkles className="h-4 w-4" />
                Related Startups
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {entity.relatedStartups.map((startup) => (
                  <div key={startup._id} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-lg font-semibold text-white">{startup.name}</div>
                    <div className="mt-1 text-sm text-cyan-200">
                      {startup.category} - {startup.stage}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{startup.tagline}</p>
                    <Link
                      to={getMarketplaceDetailPath(dashboardRole, "startup", startup._id)}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-200 hover:text-cyan-100"
                    >
                      View startup
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="space-y-6">
          <div className="rounded-[28px] border border-white/10 bg-[#090d1b] p-6">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Quick facts</div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <SidebarRow label="Role" value={formatRole(entity.entityType)} />
              <SidebarRow label="Domain" value={entity.domain ?? "Not specified"} />
              <SidebarRow label="Location" value={institutionProfile?.location ?? entity.location ?? "Not specified"} />
              <SidebarRow label={isInstitution ? "Organization Type" : "Skills"} value={isInstitution ? institutionProfile?.organizationType ?? "Not specified" : String(entity.insightCounts.skills)} />
              <SidebarRow label={isInstitution ? "Students" : "Projects"} value={isInstitution ? String(institutionProfile?.totalStudentsEnrolled ?? 0) : String(entity.insightCounts.portfolioProjects)} />
              {isInstitution ? (
                <SidebarRow
                  label="Contact"
                  value={institutionProfile?.contactEmail ?? institutionProfile?.contactPhone ?? "Not specified"}
                />
              ) : null}
              <SidebarRow
                label="Recruiter Jobs"
                value={entity.entityType === "recruiter" ? String(entity.relatedCounts.jobs) : "Not applicable"}
              />
            </div>
          </div>

          {entity.githubStats ? (
            <div className="rounded-[28px] border border-white/10 bg-[#090d1b] p-6">
              <div className="text-xs uppercase tracking-[0.28em] text-slate-500">GitHub footprint</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MetricCard label="Repos" value={String(entity.githubStats.totalRepos)} />
                <MetricCard label="Stars" value={String(entity.githubStats.totalStars)} />
                <MetricCard label="Forks" value={String(entity.githubStats.totalForks)} />
                <MetricCard label="Last Year Contributions" value={String(entity.githubStats.contributionsLastYear)} />
              </div>
            </div>
          ) : null}
        </aside>
      </section>

      <StartupInviteModal
        isOpen={Boolean(inviteTarget)}
        onClose={() => setInviteTarget(null)}
        target={inviteTarget}
        onSent={(message) =>
          setInviteFeedback({
            tone: "success",
            message,
          })
        }
      />

      {hiringRequestTarget ? (
        <CollegeHiringRequestModal
          collegeUser={authUser}
          isSubmitting={requestHiringEventMutation.isPending}
          onClose={() => {
            if (requestHiringEventMutation.isPending) return;
            setHiringRequestTarget(null);
          }}
          onSubmit={(form) =>
            requestHiringEventMutation.mutate({
              form,
              target: hiringRequestTarget,
            })
          }
          target={hiringRequestTarget}
        />
      ) : null}
    </div>
  );
}

function MetricCard({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={compact ? "rounded-2xl border border-white/10 px-3 py-2.5" : "rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3"}>
      <div className={compact ? "text-[11px] uppercase tracking-[0.24em] text-slate-500" : "text-xs uppercase tracking-[0.25em] text-slate-500"}>{label}</div>
      <div className={compact ? "mt-1.5 text-base font-semibold text-white" : "mt-2 text-lg font-semibold text-white"}>{value}</div>
    </div>
  );
}

function SidebarRow({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={compact ? "flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-3 py-2.5" : "flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"}>
      <span className={compact ? "text-sm text-slate-400" : "text-slate-400"}>{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
    </div>
  );
}

function SignalPill({
  label,
  active,
  value,
  compact = false,
}: {
  label: string;
  active?: boolean;
  value?: string;
  compact?: boolean;
}) {
  const displayValue = typeof value === "string" ? value : active ? "Yes" : "No";

  return (
    <div className={compact ? "flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-3 py-2.5" : "flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"}>
      <span className={compact ? "text-sm text-slate-300" : "text-slate-300"}>{label}</span>
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          displayValue === "Yes"
            ? "bg-emerald-400/15 text-emerald-200"
            : displayValue === "No"
              ? "bg-slate-700/60 text-slate-300"
              : "bg-cyan-400/15 text-cyan-100"
        }`}
      >
        {displayValue}
      </span>
    </div>
  );
}
