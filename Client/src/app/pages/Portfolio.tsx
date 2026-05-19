import { useState, type CSSProperties, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { DashboardLayout } from "../components/DashboardLayout";
import {
  EditButton,
  PortfolioSectionEditorModal,
  type PortfolioEditorKey,
} from "../../features/profile/PortfolioSectionEditors";
import {
  type PublicStudentProfile,
  PortfolioBlogPost,
  UserProfile,
  PortfolioProject,
  PortfolioService,
  PortfolioTestimonial,
  ProfileSkill,
  ProfileExperience,
  ProfileEducation,
  ProfileCertification,
  userApi,
} from "../../api/user.api";
import {
  type MarketplaceEntityType,
  type MarketplaceJobSummary,
  type MarketplacePortfolioHighlight,
  type MarketplaceStartupItem,
  type MarketplaceUserDetail,
  marketplaceApi,
} from "../../api/marketplace.api";
import { investorApi } from "../../api/investor.api";
import { requestApi } from "../../api/request.api";
import type { QueryType } from "../../api/dm.api";
import { startupApi } from "../../api/startup.api";
import { workspaceApi } from "../../api/workspace.api";
import type { InvestorPortfolioResponse } from "../../types/investor.types";
import type { Startup } from "../../types/startup.types";
import type { Workspace } from "../../types/workspace.types";
import { UserRole } from "../../types/roles.types";
import { getStartupOverviewPath } from "../../features/startup/navigation";
import { QueryTypeModal } from "../../components/messaging";
import { getApiErrorMessage } from "../../utils/apiError";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SKILL_LEVEL_PERCENT: Record<string, number> = {
  beginner: 25,
  intermediate: 50,
  advanced: 75,
  expert: 92,
};

const SKILL_CATEGORY_ICON: Record<string, string> = {
  programming: "< >",
  design: "Ds",
  business: "Bz",
  research: "Rs",
  other: "Sk",
};

const APP_FONT_STACK =
  "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

type PortfolioRole = Exclude<MarketplaceEntityType, "startup">;

type PortfolioProfile = Pick<
  UserProfile,
  | "_id"
  | "displayName"
  | "avatar"
  | "bio"
  | "domain"
  | "headline"
  | "location"
  | "websiteUrl"
  | "githubUrl"
  | "linkedinUrl"
  | "twitterUrl"
  | "youtubeUrl"
  | "behanceUrl"
  | "dribbbleUrl"
  | "instagramUrl"
  | "researchGateUrl"
  | "mediumUrl"
  | "skills"
  | "experience"
  | "education"
  | "certifications"
  | "portfolioProjects"
  | "portfolioServices"
  | "portfolioTestimonials"
  | "portfolioBlogPosts"
  | "portfolioContent"
> & {
  profileSlug?: string | null;
  role?: string | null;
  innovationScore?: number;
  email?: string;
  institution?: PublicStudentProfile["institution"];
  relatedCounts?: MarketplaceUserDetail["relatedCounts"];
  insightCounts?: MarketplaceUserDetail["insightCounts"];
  institutionProfile?: MarketplaceUserDetail["institutionProfile"];
  githubStats?: MarketplaceUserDetail["githubStats"];
  relatedJobs?: MarketplaceUserDetail["relatedJobs"];
  relatedStartups?: MarketplaceUserDetail["relatedStartups"];
};

type PortfolioSections = {
  about: boolean;
  projects: boolean;
  resume: boolean;
  services: boolean;
  skills: boolean;
  certifications: boolean;
  testimonials: boolean;
  achievements: boolean;
  blog: boolean;
  contact: boolean;
};

type PortfolioCopy = {
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  statLabels: [string, string, string, string];
  aboutEyebrow: string;
  aboutTitle: string;
  projectsTitle: string;
  resumeTitle: string;
  experienceTitle: string;
  educationTitle: string;
  skillsTitle: string;
  certificationsTitle: string;
  contactHeading: string;
  contactCardEyebrow: string;
  contactCardTitle: string;
  contactCardCopy: string;
  contactChecklist: [string, string, string];
  ownerHint: string;
  guestHint: string;
};

type InvestorPortfolioItem = InvestorPortfolioResponse["items"][number];

const PORTFOLIO_ROLE_SET = new Set<PortfolioRole>([
  "student",
  "school",
  "college",
  "mentor",
  "investor",
  "recruiter",
]);

const normalizePortfolioRole = (role?: string | null): PortfolioRole => {
  if (!role) return "student";
  const normalized = role.toLowerCase();
  return PORTFOLIO_ROLE_SET.has(normalized as PortfolioRole)
    ? (normalized as PortfolioRole)
    : "student";
};

const PORTFOLIO_ROLE_LABELS: Record<PortfolioRole, string> = {
  student: "Student",
  school: "School",
  college: "College",
  mentor: "Mentor",
  investor: "Investor",
  recruiter: "Recruiter",
};

const getProfileDisplayName = (profile: PortfolioProfile) =>
  profile.displayName?.trim() || "";

const getProfileFirstName = (profile: PortfolioProfile) => {
  const displayName = getProfileDisplayName(profile);
  return displayName.split(" ")[0] || "there";
};

const getIndividualPortfolioNavbarTitle = (
  profile: PortfolioProfile,
  role: PortfolioRole,
) =>
  getProfileDisplayName(profile) ||
  profile.headline?.trim() ||
  profile.domain?.trim() ||
  `${PORTFOLIO_ROLE_LABELS[role]} Portfolio`;

const getPortfolioEntityName = (profile: PortfolioProfile, role: PortfolioRole) =>
  profile.domain?.trim() ||
  profile.displayName?.trim() ||
  `${PORTFOLIO_ROLE_LABELS[role]} Portfolio`;

const getRoleCopy = (profile: PortfolioProfile): PortfolioCopy => {
  const role = normalizePortfolioRole(profile.role);
  const entityName = getPortfolioEntityName(profile, role);
  const displayName = getProfileDisplayName(profile);
  const firstName = getProfileFirstName(profile);
  const headline = profile.headline?.trim();
  const domain = profile.domain?.trim();
  const bio = profile.bio?.trim();

  if (role === "recruiter") {
    return {
      heroEyebrow: headline || domain || "Recruiter",
      heroTitle: displayName || headline || entityName,
      heroDescription:
        bio ||
        "I focus on hiring, team building, and connecting strong talent with the right opportunities.",
      statLabels: ["Open Roles", "Experience", "Education", "Startup Links"],
      aboutEyebrow: "About me",
      aboutTitle: "About Me",
      projectsTitle: "Open Roles",
      resumeTitle: "My Hiring Journey",
      experienceTitle: "Hiring Experience",
      educationTitle: "Education",
      skillsTitle: "My Core Capabilities",
      certificationsTitle: "My Credentials",
      contactHeading: "Let's connect",
      contactCardEyebrow: "Direct message",
      contactCardTitle: "Send me a message on ProMove",
      contactCardCopy:
        "Share what you want to discuss, send a structured request, and continue the conversation with me once it is accepted.",
      contactChecklist: [
        "Choose the conversation type that best matches your hiring or partnership intent",
        "Send the request through the shared messaging flow",
        "Continue the discussion with me inside ProMove inbox",
      ],
      ownerHint:
        "This is my public portfolio preview. Open the inbox to manage incoming outreach.",
      guestHint: "Sign in to send me a message through ProMove.",
    };
  }

  if (role === "investor") {
    return {
      heroEyebrow: headline || domain || "Investor",
      heroTitle: displayName || headline || entityName,
      heroDescription:
        bio ||
        "I work with founders and teams on growth, conviction, and long-term company building.",
      statLabels: ["Portfolio", "Experience", "Education", "Skills"],
      aboutEyebrow: "About me",
      aboutTitle: "About Me",
      projectsTitle: "Portfolio Companies",
      resumeTitle: "My Track Record",
      experienceTitle: "Operating Experience",
      educationTitle: "Education",
      skillsTitle: "My Investment Focus",
      certificationsTitle: "My Credentials",
      contactHeading: "Let's connect",
      contactCardEyebrow: "Direct message",
      contactCardTitle: "Send me a message on ProMove",
      contactCardCopy:
        "Share your intent clearly, send a structured request, and continue the conversation with me once it is accepted.",
      contactChecklist: [
        "Choose the conversation type that matches your funding or partnership ask",
        "Send the message request through ProMove",
        "Track replies and continue the conversation with me in your inbox",
      ],
      ownerHint:
        "This is my public portfolio preview. Open the inbox to manage incoming conversations.",
      guestHint: "Sign in to send me a message through ProMove.",
    };
  }

  if (role === "mentor") {
    return {
      heroEyebrow: headline || domain || "Mentor",
      heroTitle: displayName || headline || entityName,
      heroDescription:
        bio ||
        "I support founders, students, and teams with practical guidance across execution, growth, and career decisions.",
      statLabels: ["Experience", "Education", "Projects", "Startup Links"],
      aboutEyebrow: "About me",
      aboutTitle: "About Me",
      projectsTitle: "Supported Startups",
      resumeTitle: "My Professional Journey",
      experienceTitle: "Mentoring Experience",
      educationTitle: "Education",
      skillsTitle: "My Advisory Expertise",
      certificationsTitle: "My Credentials",
      contactHeading: "Let's connect",
      contactCardEyebrow: "Direct message",
      contactCardTitle: "Send me a message on ProMove",
      contactCardCopy:
        "Send a structured request with your intent and continue the conversation with me once it is accepted.",
      contactChecklist: [
        "Pick the conversation type that best matches your mentorship need",
        "Send the request through the shared messaging flow",
        "Continue the discussion with me in ProMove inbox",
      ],
      ownerHint:
        "This is my public portfolio preview. Open the inbox to manage incoming requests.",
      guestHint: "Sign in to send me a message through ProMove.",
    };
  }

  if (role === "school" || role === "college") {
    const institutionLabel = role === "school" ? "School" : "College";
    return {
      heroEyebrow: `${institutionLabel.toLowerCase()} profile`,
      heroTitle:
        headline && profile.domain?.trim()
          ? `${headline} | ${profile.domain.trim()}`
          : headline || `Innovation Programs & Outcomes | ${entityName}`,
      heroDescription:
        bio ||
        `Review public programs, ecosystem strengths, and institutional outcomes for this ${institutionLabel.toLowerCase()}.`,
      statLabels: ["Students", "Alumni", "Startups", "Collaborations"],
      aboutEyebrow: "Institution overview",
      aboutTitle: `About This ${institutionLabel}`,
      projectsTitle: "Programs & Initiatives",
      resumeTitle: "Institution Profile",
      experienceTitle: "Experience",
      educationTitle: "Education",
      skillsTitle: "Focus Areas",
      certificationsTitle: "Accreditations",
      contactHeading: `Connect with this ${institutionLabel.toLowerCase()}`,
      contactCardEyebrow: "Institution outreach",
      contactCardTitle: "Use the ProMove inbox to start an institutional conversation",
      contactCardCopy:
        "Send a structured message request for partnerships, programs, or ecosystem conversations.",
      contactChecklist: [
        "Choose the request type that matches your collaboration goal",
        "Send the request through ProMove",
        "Continue the conversation in the shared inbox",
      ],
      ownerHint:
        "This is your institution portfolio preview. Open your inbox to manage incoming requests.",
      guestHint: `Sign in to message this ${institutionLabel.toLowerCase()} through ProMove.`,
    };
  }

  return {
    heroEyebrow: headline || domain || `Hello, I'm ${firstName}`,
    heroTitle:
      displayName ||
      headline ||
      domain ||
      "Portfolio",
    heroDescription:
      bio ||
      "This portfolio highlights my work, experience, and the things I am building.",
    statLabels: ["Skills", "Projects", "Experiences", "Certifications"],
    aboutEyebrow: "About me",
    aboutTitle: "About Me",
    projectsTitle: "Projects",
    resumeTitle: "Resume",
    experienceTitle: "Experience",
    educationTitle: "Education",
    skillsTitle: "Skills",
    certificationsTitle: "Certifications",
    contactHeading: "Let's connect",
    contactCardEyebrow: "Message request",
    contactCardTitle: "Send me a message on ProMove",
    contactCardCopy:
      "Choose what you want to discuss, send a structured request, and continue in messages once it is accepted.",
    contactChecklist: [
      "Pick a conversation type that matches your intent",
      "Send the request through the shared messaging flow",
      "Track the request status in your inbox",
    ],
    ownerHint:
      "This is your portfolio preview. Open your inbox to manage incoming requests.",
    guestHint: "Sign in to send a conversation request through ProMove.",
  };
};

const normalizeExperienceType = (value?: string | null): ProfileExperience["type"] => {
  const normalized = value ? value.toLowerCase().replace(/\s+/g, "_") : "";
  if (
    normalized === "full_time" ||
    normalized === "part_time" ||
    normalized === "internship" ||
    normalized === "freelance" ||
    normalized === "volunteer"
  ) {
    return normalized;
  }
  return "full_time";
};

const normalizeSkillLevel = (value?: string | null): ProfileSkill["level"] => {
  const normalized = value ? value.toLowerCase() : "";
  if (
    normalized === "beginner" ||
    normalized === "intermediate" ||
    normalized === "advanced" ||
    normalized === "expert"
  ) {
    return normalized;
  }
  return "intermediate";
};

const mapMarketplaceProjectHighlight = (
  entityId: string,
  project: MarketplacePortfolioHighlight,
  index: number,
): PortfolioProject => ({
  _id: `${entityId}-project-${index}`,
  title: project.title,
  description: project.description ?? "",
  techStack: project.techStack ?? [],
  repoUrl: project.repoUrl ?? null,
  liveUrl: project.liveUrl ?? null,
  coverImageUrl: null,
  startDate: null,
  endDate: null,
  isCurrent: false,
  source: "manual",
  githubRepoId: null,
  stars: project.stars ?? 0,
  forks: project.forks ?? 0,
  languages: project.languages ?? [],
});

const mapRecruiterJobToPortfolioProject = (
  job: MarketplaceJobSummary,
): PortfolioProject => ({
  _id: job._id,
  title: job.title,
  description:
    job.description ||
    `${job.company} is hiring for a ${job.type.toLowerCase()} role in ${job.domain}.`,
  techStack: [job.domain, job.type, job.location].filter(Boolean),
  repoUrl: null,
  liveUrl: null,
  coverImageUrl: null,
  startDate: job.createdAt ?? null,
  endDate: job.expiresAt ?? null,
  isCurrent: job.isActive,
  source: "manual",
  githubRepoId: null,
  stars: job.applicantCount ?? 0,
  forks: job.shortlistedCount ?? 0,
  languages: [job.isActive ? "Actively Hiring" : "Closed"].filter(Boolean),
});

const mapStartupToPortfolioProject = (
  startup: MarketplaceStartupItem,
): PortfolioProject => ({
  _id: startup._id,
  title: startup.name,
  description:
    startup.tagline ||
    `${startup.category} startup at ${startup.stage} stage with ${startup.teamSize} team members.`,
  techStack: [startup.category, startup.stage, ...startup.launchTargets].filter(Boolean),
  repoUrl: null,
  liveUrl: startup.pitchDeckUrl ?? null,
  coverImageUrl: null,
  startDate: startup.launchedAt ?? null,
  endDate: null,
  isCurrent: true,
  source: "manual",
  githubRepoId: null,
  stars: startup.innovationScoreAtLaunch ?? 0,
  forks: startup.teamSize ?? 0,
  languages: [`${startup.activeProducts} Products`],
});

const formatInvestorRole = (role: InvestorPortfolioItem["investorRole"]) =>
  role.charAt(0).toUpperCase() + role.slice(1);

const mapInvestorPortfolioItemToPortfolioProject = (
  item: InvestorPortfolioItem,
): PortfolioProject => {
  const scoreTrendLabel = `${item.scoreTrend >= 0 ? "+" : ""}${item.scoreTrend}`;
  const summary = [
    item.startupCategory,
    `${formatInvestorRole(item.investorRole)} role`,
    `${item.equityPercent}% equity`,
    `Live score ${item.liveInnovationScore} (${scoreTrendLabel})`,
  ].join(" | ");

  return {
    _id: item._id,
    title: item.startupName,
    description: `${summary}. Founded by ${item.studentDisplayName}.`,
    techStack: [
      item.startupCategory,
      item.investorType === "sole" ? "Sole Investor" : "Penny Investor",
      item.canVeto ? "Veto Rights" : "Board Access",
    ],
    repoUrl: null,
    liveUrl: null,
    coverImageUrl: null,
    startDate: item.closedAt ?? null,
    endDate: null,
    isCurrent: true,
    source: "manual",
    githubRepoId: null,
    stars: item.liveInnovationScore,
    forks: item.sharesAllocated,
    languages: [
      `${item.sharesAllocated} shares`,
      `${item.votingWeight}% voting weight`,
      item.canAccessFinancials ? "Financial access" : "Limited financial access",
    ],
  };
};

const enrichInvestorOwnerProfile = (
  profile: PortfolioProfile,
  investorPortfolio?: InvestorPortfolioResponse,
): PortfolioProfile => {
  if (normalizePortfolioRole(profile.role) !== "investor") {
    return profile;
  }

  const mappedProjects = (investorPortfolio?.items ?? []).map(
    mapInvestorPortfolioItemToPortfolioProject,
  );
  const portfolioCount =
    mappedProjects.length ||
    profile.relatedCounts?.startups ||
    profile.portfolioProjects?.length ||
    0;

  return {
    ...profile,
    portfolioProjects:
      mappedProjects.length > 0 ? mappedProjects : profile.portfolioProjects ?? [],
    relatedCounts: {
      jobs: profile.relatedCounts?.jobs ?? 0,
      startups: portfolioCount,
    },
    insightCounts: {
      skills: profile.insightCounts?.skills ?? profile.skills?.length ?? 0,
      experience:
        profile.insightCounts?.experience ?? profile.experience?.length ?? 0,
      education:
        profile.insightCounts?.education ?? profile.education?.length ?? 0,
      portfolioProjects:
        profile.insightCounts?.portfolioProjects ?? portfolioCount,
    },
  };
};

const buildRolePortfolioProjects = (entity: MarketplaceUserDetail): PortfolioProject[] => {
  if (entity.entityType === "recruiter" && entity.relatedJobs.length > 0) {
    return entity.relatedJobs.map(mapRecruiterJobToPortfolioProject);
  }

  if (
    (entity.entityType === "investor" || entity.entityType === "mentor") &&
    entity.relatedStartups.length > 0
  ) {
    return entity.relatedStartups.map(mapStartupToPortfolioProject);
  }

  return (entity.portfolioHighlights ?? []).map((project, index) =>
    mapMarketplaceProjectHighlight(entity._id, project, index),
  );
};

const mapMarketplaceDetailToPortfolioProfile = (
  entity: MarketplaceUserDetail,
): PortfolioProfile => ({
  _id: entity._id,
  displayName: entity.displayName,
  ...(entity.avatar ? { avatar: entity.avatar } : {}),
  ...(entity.bio ? { bio: entity.bio } : {}),
  ...(entity.domain ? { domain: entity.domain } : {}),
  ...(entity.headline ? { headline: entity.headline } : {}),
  ...(entity.location || entity.institutionProfile?.location
    ? { location: entity.institutionProfile?.location ?? entity.location ?? "" }
    : {}),
  websiteUrl: entity.links?.websiteUrl ?? null,
  githubUrl: entity.links?.githubUrl ?? null,
  linkedinUrl: entity.links?.linkedinUrl ?? null,
  twitterUrl: null,
  youtubeUrl: null,
  behanceUrl: null,
  dribbbleUrl: null,
  instagramUrl: null,
  researchGateUrl: null,
  mediumUrl: null,
  skills: (entity.skills ?? []).map((skill) => ({
    name: skill.name,
    category: "other",
    source: "manual",
    level: normalizeSkillLevel(skill.level),
    endorsements: 0,
    addedAt: new Date().toISOString(),
  })),
  experience: (entity.experienceHighlights ?? []).map((item, index) => ({
    _id: `${entity._id}-exp-${index}`,
    title: item.title,
    company: item.company,
    type: normalizeExperienceType(item.type),
    location: item.location ?? "",
    startDate: item.startDate ?? "",
    endDate: item.endDate ?? null,
    isCurrent: item.isCurrent,
    description: item.description ?? "",
    skills: item.skills ?? [],
    source: "manual",
    linkedinId: null,
  })),
  education: (entity.educationHighlights ?? []).map((item, index) => ({
    _id: `${entity._id}-edu-${index}`,
    institution: item.institution,
    degree: item.degree ?? "",
    fieldOfStudy: item.fieldOfStudy ?? "",
    ...(item.startYear ? { startYear: item.startYear } : {}),
    endYear: item.endYear ?? null,
    isCurrent: item.isCurrent,
    grade: item.grade ?? "",
    activities: "",
    description: "",
    source: "manual",
  })),
  certifications: [],
  portfolioProjects: buildRolePortfolioProjects(entity),
  portfolioServices: [],
  portfolioTestimonials: [],
  portfolioBlogPosts: [],
  relatedCounts: entity.relatedCounts,
  insightCounts: entity.insightCounts,
  ...(entity.institutionProfile ? { institutionProfile: entity.institutionProfile } : {}),
  ...(entity.githubStats ? { githubStats: entity.githubStats } : {}),
  relatedJobs: entity.relatedJobs,
  relatedStartups: entity.relatedStartups,
  ...(entity.role ? { role: entity.role } : entity.entityType ? { role: entity.entityType } : {}),
});

const getPortfolioSections = (
  profile: PortfolioProfile,
  role: PortfolioRole,
): PortfolioSections => {
  const isStudent = role === "student";
  const hasProjects =
    (profile.portfolioProjects?.length ?? 0) > 0 ||
    (profile.insightCounts?.portfolioProjects ?? 0) > 0 ||
    (profile.relatedJobs?.length ?? 0) > 0 ||
    (profile.relatedStartups?.length ?? 0) > 0;
  const hasExperience =
    (profile.experience?.length ?? 0) > 0 ||
    (profile.insightCounts?.experience ?? 0) > 0;
  const hasEducation =
    (profile.education?.length ?? 0) > 0 ||
    (profile.insightCounts?.education ?? 0) > 0;
  const hasSkills =
    (profile.skills?.length ?? 0) > 0 ||
    (profile.insightCounts?.skills ?? 0) > 0;
  const hasCertifications = (profile.certifications?.length ?? 0) > 0;
  const hasServices = (profile.portfolioServices?.length ?? 0) > 0;
  const hasTestimonials = (profile.portfolioTestimonials?.length ?? 0) > 0;
  const hasBlogPosts = (profile.portfolioBlogPosts?.length ?? 0) > 0;

  return {
    about: Boolean(profile.bio),
    projects: hasProjects,
    resume: hasExperience || hasEducation,
    services: isStudent && hasServices,
    skills: hasSkills,
    certifications: hasCertifications,
    testimonials: isStudent && hasTestimonials,
    achievements: isStudent,
    blog: isStudent && hasBlogPosts,
    contact: true,
  };
};

const THEME = {
  bg: "var(--dashboard-bg)",
  header: "var(--dashboard-header-bg)",
  surface: "var(--dashboard-surface)",
  surfaceSolid: "var(--dashboard-surface-solid)",
  border: "var(--dashboard-border)",
  borderStrong: "var(--dashboard-border-strong)",
  text: "var(--dashboard-text)",
  muted: "var(--dashboard-text-muted)",
  subtle: "var(--dashboard-text-subtle)",
  faint: "var(--dashboard-text-faint)",
  accent: "var(--dashboard-active-text)",
  accentBg: "var(--dashboard-active-bg)",
  accentRing: "var(--dashboard-active-ring)",
  accentGradient: "linear-gradient(135deg, #3b82f6 0%, #0ea5e9 55%, #2563eb 100%)",
  accentGradientSoft:
    "linear-gradient(160deg, rgba(12, 74, 110, 0.92), rgba(2, 6, 23, 0.98))",
  accentGlow:
    "radial-gradient(ellipse at 50% 80%, rgba(59, 130, 246, 0.18) 0%, transparent 72%)",
};

const formatDateRange = (
  start: string | null | undefined,
  end: string | null | undefined,
  isCurrent: boolean,
) => {
  const fmt = (d: string) => {
    const date = new Date(d);
    return Number.isNaN(date.getTime()) ? "" : date.getFullYear().toString();
  };
  const s = start ? fmt(start) : "";
  const e = isCurrent ? "Present" : end ? fmt(end) : "";
  if (s && e) return `${s} – ${e}`;
  if (s) return `${s} – Present`;
  if (e) return e;
  return "";
};

const formatYear = (
  start?: number,
  end?: number | null,
  isCurrent?: boolean,
) => {
  const s = start ? String(start) : "";
  const e = isCurrent ? "Present" : end ? String(end) : "";
  if (s && e) return `${s} – ${e}`;
  if (s) return `${s} – Present`;
  if (e) return e;
  return "";
};

const socialEntries = (profile: PortfolioProfile) =>
  [
    { key: "twitter", url: profile.twitterUrl, icon: "𝕏" },
    { key: "linkedin", url: profile.linkedinUrl, icon: "in" },
    { key: "github", url: profile.githubUrl, icon: "gh" },
    { key: "behance", url: profile.behanceUrl, icon: "be" },
    { key: "dribbble", url: profile.dribbbleUrl, icon: "dr" },
    { key: "instagram", url: profile.instagramUrl, icon: "ig" },
    { key: "youtube", url: profile.youtubeUrl, icon: "yt" },
    { key: "website", url: profile.websiteUrl, icon: "🌐" },
    { key: "medium", url: profile.mediumUrl, icon: "M" },
    { key: "researchGate", url: profile.researchGateUrl, icon: "RG" },
  ].filter((e) => e.url);

type RecentWork = {
  id: string;
  kind: "workspace" | "startup";
  title: string;
  description: string;
  meta: string[];
  href: string;
  updatedAt: string;
};

const toRecentWorkspace = (workspace: Workspace): RecentWork => ({
  id: workspace._id,
  kind: "workspace",
  title: workspace.title || "Untitled Workspace",
  description:
    workspace.progressUpdates[0]?.note ||
    `${workspace.category} workspace in ${workspace.stage} stage.`,
  meta: [
    workspace.category,
    workspace.stage,
    `${workspace.progressPercent}% complete`,
  ].filter(Boolean),
  href: `/product-workspace/${workspace._id}`,
  updatedAt: workspace.updatedAt,
});

const toRecentStartup = (startup: Startup): RecentWork => ({
  id: startup._id,
  kind: "startup",
  title: startup.name || "Untitled Startup",
  description:
    startup.tagline ||
    startup.businessProfile.solutionSummary ||
    `${startup.category} startup in ${startup.stage} stage.`,
  meta: [
    startup.category,
    startup.stage,
    `${startup.teamSize} members`,
  ].filter(Boolean),
  href: getStartupOverviewPath(startup._id),
  updatedAt: startup.updatedAt,
});

// ─── Sub-components ───────────────────────────────────────────────────────────

function Navbar({
  profile,
  isOwnerView,
  sections,
}: {
  profile: PortfolioProfile;
  isOwnerView: boolean;
  sections: PortfolioSections;
  }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const pc = profile.portfolioContent;
    const roleCopy = getRoleCopy(profile);
    const role = normalizePortfolioRole(profile.role);
    const initial = (profile.displayName ?? "P")[0].toUpperCase();
    const logoTitle =
      role === "school" || role === "college"
        ? profile.domain || profile.displayName || "Portfolio"
        : getIndividualPortfolioNavbarTitle(profile, role);
    const navRightStyle: CSSProperties = isOwnerView
      ? styles.navRight
      : {
          ...styles.navRight,
          flex: "1 1 auto",
          justifyContent: "center",
          marginLeft: 0,
        };
    const navLinksStyle: CSSProperties = isOwnerView
      ? styles.navLinks
      : {
          ...styles.navLinks,
          justifyContent: "center",
          flexWrap: "wrap",
        };

  const links = [
    ...(sections.about
      ? [{ label: pc?.aboutTitle?.trim() || roleCopy.aboutTitle, href: "#about" }]
      : []),
    ...(sections.projects
      ? [{ label: pc?.projectsTitle?.trim() || roleCopy.projectsTitle, href: "#projects" }]
      : []),
    ...(sections.resume
      ? [{ label: roleCopy.resumeTitle, href: "#resume" }]
      : []),
    ...(sections.services ? [{ label: "Services", href: "#services" }] : []),
    ...(sections.skills
      ? [{ label: pc?.skillsTitle?.trim() || roleCopy.skillsTitle, href: "#skills" }]
      : []),
    ...(sections.testimonials ? [{ label: "Testimonials", href: "#testimonials" }] : []),
    ...(sections.blog ? [{ label: "Blog", href: "#blog" }] : []),
    ...(sections.contact ? [{ label: "Contact", href: "#contact" }] : []),
  ];

  return (
    <nav style={styles.nav}>
      <div style={styles.navInner}>
        <div style={styles.logoBlock}>
          <div style={styles.logo}>
            <div style={styles.logoCircle}>{initial}</div>
            <span style={styles.logoText}>
              {logoTitle}
            </span>
          </div>
        </div>

          <div style={navRightStyle}>
            <ul style={navLinksStyle}>
              {links.map((l) => (
                <li key={l.label}>
                  <a href={l.href} style={styles.navLink}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

        <button onClick={() => setMenuOpen(!menuOpen)} style={styles.hamburger}>
          ☰
        </button>
      </div>

      {menuOpen && (
        <div style={styles.mobileMenu}>
          {links.map((l) => (
            <a key={l.label} href={l.href} style={styles.mobileLink}>
              {l.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}

function HeroSection({
  profile,
  isOwnerView,
  onEdit,
}: {
  profile: PortfolioProfile;
  isOwnerView: boolean;
  onEdit?: (key: PortfolioEditorKey) => void;
}) {
  const pc = profile.portfolioContent;
  const roleCopy = getRoleCopy(profile);
  const socials = socialEntries(profile);
  const heroTitleSource =
    pc?.heroTitle?.trim() ||
    roleCopy.heroTitle;
  const heroTitleParts = heroTitleSource
    .split(/\r?\n|\s*[|+]\s*/g)
    .map((part) => part.trim())
    .filter(Boolean);
  const primaryHeroTitle = heroTitleParts[0] ?? heroTitleSource;
  const accentHeroTitleParts = heroTitleParts.slice(1);

  return (
    <section style={{ ...styles.hero, position: "relative" }}>
      {isOwnerView && onEdit ? (
        <div style={{ position: "absolute", top: 16, right: 24, zIndex: 2 }}>
          <EditButton onClick={() => onEdit("intro")} label="Edit intro" />
        </div>
      ) : null}
      <div style={styles.heroContent}>
        <p style={styles.heroSub}>{pc?.heroEyebrow || roleCopy.heroEyebrow}</p>
        <h1 style={styles.heroHeading}>
          {primaryHeroTitle}
          {accentHeroTitleParts.map((line, index) => (
            <span key={`${line}-${index}`}>
              <br />
              <span style={styles.heroAccent}>{line}</span>
            </span>
          ))}
        </h1>
        <p style={styles.heroDesc}>
          {pc?.heroDescription || roleCopy.heroDescription}
        </p>
        <div style={styles.heroActions}>
          {profile.websiteUrl ? (
            <a
              href={profile.websiteUrl}
              target="_blank"
              rel="noreferrer"
              style={styles.downloadBtn}
            >
              {pc?.primaryButtonLabel || "Visit Website ↗"}
            </a>
            ) : isOwnerView && onEdit ? (
              <button
                type="button"
                onClick={() => onEdit("intro")}
                style={{ ...styles.downloadBtn, cursor: "pointer" }}
              >
                {pc?.primaryButtonLabel || "Edit Profile"}
              </button>
            ) : null}
          {socials.length > 0 && (
            <div style={styles.socialIcons}>
              {socials.slice(0, 5).map((s) => (
                <a
                  key={s.key}
                  href={s.url!}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.socialIcon}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={styles.heroAvatar}>
        <div style={styles.avatarInner}>
          <div style={styles.avatarGradient} />
          {profile.avatar ? (
            <img
              src={profile.avatar}
              alt={profile.displayName}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                position: "absolute",
                inset: 0,
                zIndex: 1,
              }}
            />
          ) : (
            <div style={styles.avatarFace}>
              {(profile.displayName ?? "U")[0].toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatsBar({ profile }: { profile: PortfolioProfile }) {
  const pc = profile.portfolioContent;
  const role = normalizePortfolioRole(profile.role);
  const roleCopy = getRoleCopy(profile);
  const stats = (() => {
    if (
      (role === "school" || role === "college") &&
      profile.institutionProfile
    ) {
      return [
        {
          value: String(profile.institutionProfile.totalStudentsEnrolled ?? 0),
          label: pc?.statOneLabel || roleCopy.statLabels[0],
        },
        {
          value: String(profile.institutionProfile.alumniCount ?? 0),
          label: pc?.statTwoLabel || roleCopy.statLabels[1],
        },
        {
          value: String(profile.institutionProfile.stats?.startupsLaunched ?? 0),
          label: pc?.statThreeLabel || roleCopy.statLabels[2],
        },
        {
          value: String(
            profile.institutionProfile.stats?.industryCollaborations ?? 0,
          ),
          label: pc?.statFourLabel || roleCopy.statLabels[3],
        },
      ];
    }

    if (role === "recruiter") {
      return [
        {
          value: String(profile.relatedCounts?.jobs ?? 0),
          label: pc?.statOneLabel || roleCopy.statLabels[0],
        },
        {
          value: String(profile.insightCounts?.experience ?? 0),
          label: pc?.statTwoLabel || roleCopy.statLabels[1],
        },
        {
          value: String(profile.insightCounts?.education ?? 0),
          label: pc?.statThreeLabel || roleCopy.statLabels[2],
        },
        {
          value: String(profile.relatedCounts?.startups ?? 0),
          label: pc?.statFourLabel || roleCopy.statLabels[3],
        },
      ];
    }

    if (role === "mentor") {
      return [
        {
          value: String(profile.insightCounts?.experience ?? profile.experience?.length ?? 0),
          label: pc?.statOneLabel || roleCopy.statLabels[0],
        },
        {
          value: String(profile.insightCounts?.education ?? profile.education?.length ?? 0),
          label: pc?.statTwoLabel || roleCopy.statLabels[1],
        },
        {
          value: String(
            profile.insightCounts?.portfolioProjects ??
              profile.portfolioProjects?.length ??
              0,
          ),
          label: pc?.statThreeLabel || roleCopy.statLabels[2],
        },
        {
          value: String(profile.relatedCounts?.startups ?? 0),
          label: pc?.statFourLabel || roleCopy.statLabels[3],
        },
      ];
    }

    if (role === "investor") {
      return [
        {
          value: String(
            profile.relatedCounts?.startups ?? profile.portfolioProjects?.length ?? 0,
          ),
          label: pc?.statOneLabel || roleCopy.statLabels[0],
        },
        {
          value: String(profile.insightCounts?.experience ?? profile.experience?.length ?? 0),
          label: pc?.statTwoLabel || roleCopy.statLabels[1],
        },
        {
          value: String(profile.insightCounts?.education ?? profile.education?.length ?? 0),
          label: pc?.statThreeLabel || roleCopy.statLabels[2],
        },
        {
          value: String(profile.insightCounts?.skills ?? profile.skills?.length ?? 0),
          label: pc?.statFourLabel || roleCopy.statLabels[3],
        },
      ];
    }

    return [
      {
        value: String(profile.skills?.length ?? 0),
        label: pc?.statOneLabel || roleCopy.statLabels[0],
      },
      {
        value: String(profile.portfolioProjects?.length ?? 0),
        label: pc?.statTwoLabel || roleCopy.statLabels[1],
      },
      {
        value: String(profile.experience?.length ?? 0),
        label: pc?.statThreeLabel || roleCopy.statLabels[2],
      },
      {
        value: String(profile.certifications?.length ?? 0),
        label: pc?.statFourLabel || roleCopy.statLabels[3],
      },
    ];
  })();

  return (
    <div style={styles.statsBar}>
      {stats.map((s, i) => (
        <div key={i} style={styles.statItem}>
          <span style={styles.statValue}>{s.value}</span>
          <span style={styles.statLabel}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

const INSTITUTION_FIELD_ICON: Record<string, string> = {
  foundedYear: "📅",
  organizationType: "🏛️",
  academicYear: "🗓️",
  location: "📍",
  iicStarRating: "⭐",
  totalStudentsEnrolled: "🎓",
  alumniCount: "👥",
  employeeCount: "👔",
  contactEmail: "✉️",
  contactPhone: "📞",
};

function SectionDecorator() {
  return (
    <div
      aria-hidden
      style={{
        margin: "0 auto 28px",
        width: 64,
        height: 3,
        borderRadius: 2,
        background: THEME.accentGradient,
        boxShadow: "0 0 18px rgba(14, 165, 233, 0.45)",
      }}
    />
  );
}

function EmptyStateCard({
  icon,
  title,
  description,
  ctaLabel,
  onCta,
  variant = "panel",
}: {
  icon: string;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
  variant?: "panel" | "grid";
}) {
  const isGrid = variant === "grid";
  return (
    <div
      style={{
        position: "relative",
        marginTop: isGrid ? 12 : 8,
        padding: "clamp(28px, 4vw, 44px)",
        border: `1px dashed ${THEME.accentRing}`,
        borderRadius: 18,
        background:
          "linear-gradient(160deg, rgba(14, 165, 233, 0.10) 0%, rgba(15, 23, 42, 0.55) 55%, rgba(2, 6, 23, 0.92) 100%)",
        display: "flex",
        flexDirection: isGrid ? "row" : "column",
        alignItems: "center",
        textAlign: isGrid ? "left" : "center",
        gap: 20,
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 220,
          height: 220,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(59, 130, 246, 0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          width: 64,
          height: 64,
          minWidth: 64,
          borderRadius: 18,
          background:
            "linear-gradient(135deg, rgba(14, 165, 233, 0.25), rgba(37, 99, 235, 0.18))",
          border: `1px solid ${THEME.accentRing}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 30,
          boxShadow: "0 12px 28px rgba(8, 47, 73, 0.35)",
          zIndex: 1,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, zIndex: 1 }}>
        <h4
          style={{
            color: THEME.text,
            fontFamily: APP_FONT_STACK,
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 8,
            lineHeight: 1.3,
          }}
        >
          {title}
        </h4>
        <p
          style={{
            color: THEME.muted,
            fontSize: 14,
            lineHeight: 1.7,
            maxWidth: 520,
            margin: isGrid ? 0 : "0 auto",
          }}
        >
          {description}
        </p>
      </div>
      {ctaLabel && onCta ? (
        <button
          type="button"
          onClick={onCta}
          style={{
            zIndex: 1,
            padding: "12px 22px",
            background: THEME.accentGradient,
            color: "#f8fafc",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: 0.4,
            fontFamily: APP_FONT_STACK,
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            boxShadow: "0 14px 30px rgba(14, 165, 233, 0.32)",
            whiteSpace: "nowrap",
          }}
        >
          {ctaLabel} →
        </button>
      ) : null}
    </div>
  );
}

function AboutSection({
  profile,
  isOwnerView,
  onEdit,
}: {
  profile: PortfolioProfile;
  isOwnerView?: boolean;
  onEdit?: (key: PortfolioEditorKey) => void;
}) {
  const pc = profile.portfolioContent;
  const roleCopy = getRoleCopy(profile);
  const role = normalizePortfolioRole(profile.role);
  if (!profile.bio && !isOwnerView) return null;

  const details: { label: string; value: string }[] = [];
  if (profile.domain) details.push({ label: "Domain", value: profile.domain });
  if (profile.headline) details.push({ label: "Role", value: profile.headline });
  if (profile.location) details.push({ label: "Location", value: profile.location });
  if (role === "recruiter") {
    details.push({
      label: "Open Roles",
      value: `${profile.relatedCounts?.jobs ?? profile.relatedJobs?.length ?? 0} active listings`,
    });
    details.push({
      label: "Startup Links",
      value: `${profile.relatedCounts?.startups ?? 0} startup connections`,
    });
    details.push({
      label: "Experience",
      value: `${profile.insightCounts?.experience ?? profile.experience?.length ?? 0} roles`,
    });
    details.push({
      label: "Education",
      value: `${profile.insightCounts?.education ?? profile.education?.length ?? 0} entries`,
    });
  } else if (role === "investor") {
    details.push({
      label: "Portfolio",
      value: `${
        profile.relatedCounts?.startups ??
        profile.relatedStartups?.length ??
        profile.portfolioProjects?.length ??
        0
      } startup relationships`,
    });
    details.push({
      label: "Experience",
      value: `${profile.insightCounts?.experience ?? profile.experience?.length ?? 0} roles`,
    });
    details.push({
      label: "Education",
      value: `${profile.insightCounts?.education ?? profile.education?.length ?? 0} entries`,
    });
    details.push({
      label: "Skills",
      value: `${profile.insightCounts?.skills ?? profile.skills?.length ?? 0} focus areas`,
    });
  } else if (role === "mentor") {
    details.push({
      label: "Startup Links",
      value: `${profile.relatedCounts?.startups ?? profile.relatedStartups?.length ?? 0} founder connections`,
    });
    details.push({
      label: "Experience",
      value: `${profile.insightCounts?.experience ?? profile.experience?.length ?? 0} roles`,
    });
    details.push({
      label: "Education",
      value: `${profile.insightCounts?.education ?? profile.education?.length ?? 0} entries`,
    });
    details.push({
      label: "Projects",
      value: `${profile.insightCounts?.portfolioProjects ?? profile.portfolioProjects?.length ?? 0} public highlights`,
    });
  } else {
    if (profile.skills?.length)
      details.push({ label: "Skills", value: `${profile.skills.length} proficiencies` });
    if (profile.experience?.length)
      details.push({ label: "Experience", value: `${profile.experience.length} roles` });
    if (profile.certifications?.length)
      details.push({ label: "Certifications", value: `${profile.certifications.length} earned` });
  }
  const socials = socialEntries(profile);
  if (socials.length > 0)
    details.push({ label: "Social", value: `${socials.length} profiles linked` });

  return (
    <section id="about" style={styles.section}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={styles.sectionEyebrow}>{roleCopy.aboutEyebrow}</p>
          <h2 style={styles.sectionTitle}>
            {pc?.aboutTitle || (
              <>
                {roleCopy.aboutTitle.split(" ")[0]}{" "}
                <span style={styles.accentText}>
                  {roleCopy.aboutTitle.split(" ").slice(1).join(" ")}
                </span>
              </>
            )}
          </h2>
        </div>
        {isOwnerView && onEdit ? (
          <EditButton onClick={() => onEdit("about")} label="Edit about" />
        ) : null}
      </div>
      <SectionDecorator />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: details.length > 0
            ? "repeat(auto-fit, minmax(280px, 1fr))"
            : "1fr",
          gap: 48,
          marginTop: 16,
          alignItems: "start",
        }}
      >
        <div
          style={{
            position: "relative",
            padding: "28px 32px",
            border: `1px solid ${THEME.border}`,
            borderRadius: 16,
            background:
              "linear-gradient(160deg, rgba(15, 23, 42, 0.7), rgba(2, 6, 23, 0.95))",
            boxShadow: "0 20px 50px rgba(2, 6, 23, 0.35)",
            overflow: "hidden",
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 4,
              height: "100%",
              background: THEME.accentGradient,
            }}
          />
          <p
            style={{
              color: profile.bio ? THEME.text : THEME.subtle,
              fontSize: 16,
              lineHeight: 1.9,
              letterSpacing: 0.2,
              fontStyle: profile.bio ? "normal" : "italic",
            }}
          >
            {profile.bio ||
              "Share an overview of your institution — your mission, ecosystem strengths, and what makes your campus a launchpad for innovation."}
          </p>
          {socials.length > 0 && (
            <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
              {socials.map((s) => (
                <a
                  key={s.key}
                  href={s.url!}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    width: 38,
                    height: 38,
                    border: `1px solid ${THEME.borderStrong}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: THEME.accent,
                    fontSize: 12,
                    textDecoration: "none",
                    background: THEME.surface,
                  }}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          )}
        </div>
        {details.length > 0 && (
          <div
            style={{
              borderLeft: `1px solid ${THEME.border}`,
              paddingLeft: 32,
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            {details.map((d, i) => (
              <div
                key={d.label}
                style={{
                  padding: "16px 0",
                  borderBottom:
                    i < details.length - 1
                      ? `1px solid ${THEME.border}`
                      : "none",
                }}
              >
                <p
                  style={{
                    color: THEME.subtle,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    marginBottom: 6,
                    fontWeight: 600,
                  }}
                >
                  {d.label}
                </p>
                <p
                  style={{
                    color: THEME.text,
                    fontSize: 15,
                    fontWeight: 600,
                    fontFamily: APP_FONT_STACK,
                  }}
                >
                  {d.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function RecentWorksSection({ works }: { works: RecentWork[] }) {
  if (works.length === 0) return null;

  return (
    <section id="projects" style={styles.section}>
      <h2 style={styles.sectionTitle}>
        My <span style={styles.accentText}>Recent Works</span>
      </h2>
      <p style={styles.sectionDesc}>
        This section is auto-synced from Product Workspace and Startup activity.
      </p>
      <div style={styles.worksGrid}>
        {works.map((work) => (
          <Link
            key={`${work.kind}-${work.id}`}
            to={work.href}
            style={{
              ...styles.workCard,
              textDecoration: "none",
            }}
          >
            <div
              style={{
                ...styles.mockCard,
                background:
                  work.kind === "workspace"
                    ? `linear-gradient(135deg, rgba(59, 130, 246, 0.16), ${THEME.surfaceSolid})`
                    : `linear-gradient(135deg, rgba(59, 130, 246, 0.16), ${THEME.surfaceSolid})`,
                minHeight: 260,
              }}
            >
              <div style={styles.recentWorkTopRow}>
                <span
                  style={{
                    ...styles.workCategory,
                    color: work.kind === "workspace" ? "#3b82f6" : "#60a5fa",
                  }}
                >
                  {work.kind === "workspace" ? "Product Workspace" : "Startup"}
                </span>
                <span style={styles.recentWorkDate}>
                  Updated {new Date(work.updatedAt).toLocaleDateString("en-IN")}
                </span>
              </div>
              <h3 style={styles.recentWorkTitle}>{work.title}</h3>
              <p style={styles.recentWorkDesc}>{work.description}</p>
              <div style={styles.recentWorkMeta}>
                {work.meta.map((item) => (
                  <span key={item} style={styles.recentWorkMetaChip}>
                    {item}
                  </span>
                ))}
              </div>
              <span style={styles.recentWorkCta}>
                Open {work.kind === "workspace" ? "Workspace" : "Startup"} ↗
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function QualityServicesSection({
  services,
  isOwnerView,
  onEdit,
}: {
  services: PortfolioService[];
  isOwnerView?: boolean;
  onEdit?: (key: PortfolioEditorKey) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  if (services.length === 0 && !isOwnerView) return null;
  const resolvedActiveIndex =
    services.length === 0 ? 0 : Math.min(activeIndex, services.length - 1);

  return (
    <section id="services" style={styles.section}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={styles.sectionEyebrow}>My Quality Services</p>
          <h2 style={styles.sectionTitle}>
            My <span style={styles.accentText}>Quality Services</span>
          </h2>
        </div>
        {isOwnerView && onEdit ? (
          <EditButton onClick={() => onEdit("services")} label="Edit services" />
        ) : null}
      </div>
      <SectionDecorator />
      <p style={styles.sectionDesc}>
        We put your ideas and thus your stories in the form of a unique web
        project that inspires you and your customers.
      </p>
      {services.length === 0 ? (
        <EmptyStateCard
          icon="✨"
          title="Showcase the services your institution offers"
          description="Add programs, partnerships, or capabilities you provide — incubation, mentoring, research labs, accelerators, or industry collaborations."
          ctaLabel={isOwnerView && onEdit ? "Add a service" : undefined}
          onCta={isOwnerView && onEdit ? () => onEdit("services") : undefined}
        />
      ) : null}
      <div style={styles.servicesList}>
        {services.map((service, index) => (
          <button
            key={service._id || `${service.title}-${index}`}
            type="button"
            onClick={() => setActiveIndex(index)}
            aria-expanded={index === resolvedActiveIndex}
            style={{
              ...styles.serviceRow,
              ...(index === resolvedActiveIndex ? styles.serviceRowActive : {}),
              borderBottom:
                index < services.length - 1
                  ? `1px solid ${THEME.border}`
                  : "none",
            }}
          >
            <span style={styles.serviceIconWrap}>
              <span style={styles.serviceIcon}>
                {service.icon || (index + 1).toString().padStart(2, "0")}
              </span>
            </span>
            <div style={styles.serviceInfo}>
              <div style={styles.serviceTopRow}>
                <h3 style={styles.serviceTitle}>
                  {service.title || `Service ${index + 1}`}
                </h3>
                <span style={styles.serviceArrow}>↗</span>
              </div>
              {index === resolvedActiveIndex ? (
                <p style={styles.serviceDesc}>
                  {service.description || "Service description coming soon."}
                </p>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function TestimonialsSection({
  testimonials,
  isOwnerView,
  onEdit,
}: {
  testimonials: PortfolioTestimonial[];
  isOwnerView?: boolean;
  onEdit?: (key: PortfolioEditorKey) => void;
}) {
  if (testimonials.length === 0 && !isOwnerView) return null;

  return (
    <section id="testimonials" style={styles.section}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={styles.sectionTitle}>
          Client <span style={styles.accentText}>Testimonials</span>
        </h2>
        {isOwnerView && onEdit ? (
          <EditButton
            onClick={() => onEdit("testimonials")}
            label="Edit testimonials"
          />
        ) : null}
      </div>
      <p style={styles.sectionDesc}>
        Feedback from collaborators, founders, and teams I have shipped with.
      </p>
      {testimonials.length === 0 ? (
        <EmptyStateCard
          icon="''"
          title="Add collaborator feedback"
          description="Show concise feedback from clients, founders, teammates, mentors, or collaborators who can speak to your work."
          ctaLabel={isOwnerView && onEdit ? "Add a testimonial" : undefined}
          onCta={isOwnerView && onEdit ? () => onEdit("testimonials") : undefined}
        />
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
          gap: "0 32px",
        }}
      >
        {testimonials.map((testimonial, idx) => (
          <article
            key={testimonial._id}
            style={{
              ...styles.testimonialCard,
              borderBottom:
                idx < testimonials.length - 1
                  ? `1px solid ${THEME.border}`
                  : "none",
              borderLeft: `3px solid ${THEME.accent}`,
            }}
          >
            <div
              style={{
                color: THEME.accent,
                fontSize: 36,
                lineHeight: 1,
                fontFamily: "Georgia, serif",
                marginBottom: 12,
                opacity: 0.5,
              }}
            >
              "
            </div>
              <p style={styles.testimonialText}>{testimonial.text}</p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginTop: 20,
              }}
            >
              <div>
                <p style={styles.testimonialName}>{testimonial.name}</p>
                <p style={styles.testimonialRole}>{testimonial.role}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function BlogSection({
  posts,
  isOwnerView,
  onEdit,
}: {
  posts: PortfolioBlogPost[];
  isOwnerView?: boolean;
  onEdit?: (key: PortfolioEditorKey) => void;
}) {
  if (posts.length === 0 && !isOwnerView) return null;

  return (
    <section id="blog" style={styles.section}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={styles.sectionTitle}>
          Recent <span style={styles.accentText}>Writing</span>
        </h2>
        {isOwnerView && onEdit ? (
          <EditButton onClick={() => onEdit("blog")} label="Edit recent writing" />
        ) : null}
      </div>
      <p style={styles.sectionDesc}>
        Short posts on product thinking, AI execution, and building with clarity.
      </p>
      {posts.length === 0 ? (
        <EmptyStateCard
          icon="W"
          title="Add recent writing"
          description="Link articles, launch notes, technical posts, or short reflections that support your portfolio story."
          ctaLabel={isOwnerView && onEdit ? "Add writing" : undefined}
          onCta={isOwnerView && onEdit ? () => onEdit("blog") : undefined}
        />
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
          columnGap: 32,
        }}
      >
        {posts.map((post, idx) => (
          <article
            key={post._id}
            style={{
              padding: "28px 0",
              borderTop: `1px solid ${THEME.border}`,
              borderBottom: `1px solid ${THEME.border}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              {post.tag && (
                <span
                  style={{
                    color: post.tagColor || "#7c3aed",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1.5,
                    padding: "2px 8px",
                    border: `1px solid ${post.tagColor || "#7c3aed"}`,
                  }}
                >
                  {post.tag}
                </span>
              )}
              {post.publishedAt && (
                <span style={{ color: THEME.subtle, fontSize: 11 }}>
                  {new Date(post.publishedAt).toLocaleDateString("en-IN")}
                </span>
              )}
            </div>
            <h4
              style={{
                color: THEME.text,
                fontFamily: APP_FONT_STACK,
                fontWeight: 700,
                fontSize: 16,
                lineHeight: 1.5,
                marginBottom: 8,
              }}
            >
              {post.url ? (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {post.title} ↗
                </a>
              ) : (
                post.title
              )}
            </h4>
            {post.excerpt && (
              <p
                style={{
                  color: THEME.subtle,
                  fontSize: 13,
                  lineHeight: 1.8,
                }}
              >
                {post.excerpt}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function ProjectsSection({
  projects,
  title,
  isOwnerView,
  onEdit,
}: {
  projects: PortfolioProject[];
  title: string;
  isOwnerView?: boolean;
  onEdit?: (key: PortfolioEditorKey) => void;
}) {
  const [activeTab, setActiveTab] = useState("All");
  const techTabs = useMemo(() => {
    const tags = new Set<string>();
    projects.forEach((p) => p.techStack.forEach((t) => tags.add(t)));
    return ["All", ...Array.from(tags).slice(0, 4)];
  }, [projects]);

  const filtered =
    activeTab === "All"
      ? projects
      : projects.filter((p) => p.techStack.includes(activeTab));

  if (projects.length === 0 && !isOwnerView) return null;

  return (
    <section id="projects" style={styles.section}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={styles.sectionTitle}>
          My <span style={styles.accentText}>{title}</span>
        </h2>
        {isOwnerView && onEdit ? (
          <EditButton onClick={() => onEdit("projects")} label="Edit projects" />
        ) : null}
      </div>
      <SectionDecorator />
      {projects.length === 0 ? (
        <EmptyStateCard
          icon="🚀"
          title="Highlight your flagship programs & initiatives"
          description="Add innovation programs, research projects, accelerator cohorts, or initiatives that define your institution's contribution to the ecosystem."
          ctaLabel={isOwnerView && onEdit ? "Add an initiative" : undefined}
          onCta={isOwnerView && onEdit ? () => onEdit("projects") : undefined}
        />
      ) : null}
      {techTabs.length > 1 && (
        <div style={styles.workTabs}>
          {techTabs.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                ...styles.workTab,
                ...(activeTab === t ? styles.workTabActive : {}),
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      <div style={styles.worksGrid}>
        {filtered.map((project) => (
          <div
            key={project._id}
            style={{
              ...styles.workCard,
              minHeight: 220,
            }}
          >
            <div
              style={{
                ...styles.mockCard,
                background: project.coverImageUrl
                  ? `url(${project.coverImageUrl}) center/cover`
                  : `linear-gradient(135deg, rgba(14, 165, 233, 0.14), ${THEME.surfaceSolid})`,
              }}
            >
              {!project.coverImageUrl && (
                <>
                  <div
                    style={{ color: THEME.accent, fontSize: 11, marginBottom: 8 }}
                  >
                    {project.techStack.join(" · ") || "Project"}
                  </div>
                  <div
                    style={{
                      color: THEME.text,
                      fontWeight: 700,
                      fontSize: 20,
                      lineHeight: 1.2,
                      fontFamily: APP_FONT_STACK,
                    }}
                  >
                    {project.title}
                  </div>
                  {project.description && (
                    <div
                      style={{
                        color: THEME.muted,
                        fontSize: 12,
                        marginTop: 8,
                        lineHeight: 1.5,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {project.description}
                    </div>
                  )}
                  <div
                    style={{
                      marginTop: "auto",
                      display: "flex",
                      gap: 12,
                      paddingTop: 12,
                    }}
                  >
                    {project.repoUrl && (
                      <a
                        href={project.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: THEME.accent, fontSize: 11 }}
                      >
                        Repository ↗
                      </a>
                    )}
                    {project.liveUrl && (
                      <a
                        href={project.liveUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: THEME.accent, fontSize: 11 }}
                      >
                        Live ↗
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>
            {project.coverImageUrl ? (
              <div style={styles.workCardOverlay}>
                <span style={styles.workCategory}>
                  {project.techStack[0] || project.source}
                </span>
                <h4 style={styles.workTitle}>{project.title}</h4>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function ResumeSection({
  experience,
  education,
  sectionTitle,
  experienceTitle,
  educationTitle,
  isOwnerView,
  onEdit,
}: {
  experience: ProfileExperience[];
  education: ProfileEducation[];
  sectionTitle: string;
  experienceTitle: string;
  educationTitle: string;
  isOwnerView?: boolean;
  onEdit?: (key: PortfolioEditorKey) => void;
}) {
  if (experience.length === 0 && education.length === 0 && !isOwnerView)
    return null;

  const TimelineDot = () => (
    <div
      style={{
        position: "absolute",
        left: -7,
        top: 20,
        width: 12,
        height: 12,
        background: THEME.bg,
        border: `2px solid ${THEME.accent}`,
      }}
    />
  );

  return (
    <section
      id="resume"
      style={{ ...styles.section, background: "transparent" }}
    >
      <h2 style={{ ...styles.sectionTitle, marginBottom: 48 }}>
        <span style={styles.accentText}>{sectionTitle}</span>
      </h2>
      <div style={styles.resumeGrid}>
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <h3 style={styles.resumeHeading}>
              <span style={styles.resumeIcon}>🏆</span>{" "}
              <span style={styles.accentText}>{experienceTitle}</span>
            </h3>
            {isOwnerView && onEdit ? (
              <EditButton
                onClick={() => onEdit("experience")}
                label="Edit experience"
              />
            ) : null}
          </div>
          {experience.length > 0 ? (
            experience.map((e, idx) => (
              <div key={e._id} style={styles.timelineCard}>
                <TimelineDot />
                <p style={styles.timelinePeriod}>
                  {formatDateRange(e.startDate, e.endDate, e.isCurrent)}
                </p>
                <h4 style={styles.timelineTitle}>{e.title}</h4>
                <p style={styles.timelinePlace}>
                  {e.company}
                  {e.location ? ` — ${e.location}` : ""}
                </p>
                {e.description && (
                  <p
                    style={{
                      color: THEME.subtle,
                      fontSize: 13,
                      lineHeight: 1.7,
                      marginTop: 8,
                    }}
                  >
                    {e.description}
                  </p>
                )}
                {idx < experience.length - 1 && (
                  <div
                    style={{
                      borderBottom: `1px solid ${THEME.border}`,
                      marginTop: 16,
                      marginLeft: -24,
                      width: "calc(100% + 24px)",
                    }}
                  />
                )}
              </div>
            ))
          ) : (
            <div style={styles.timelineCard}>
              <TimelineDot />
              <p style={styles.timelinePlace}>No experience added yet.</p>
            </div>
          )}
        </div>
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <h3 style={styles.resumeHeading}>
              <span style={styles.resumeIcon}>🎓</span>{" "}
              <span style={styles.accentText}>{educationTitle}</span>
            </h3>
            {isOwnerView && onEdit ? (
              <EditButton
                onClick={() => onEdit("education")}
                label="Edit education"
              />
            ) : null}
          </div>
          {education.length > 0 ? (
            education.map((e, idx) => (
              <div key={e._id} style={styles.timelineCard}>
                <TimelineDot />
                <p style={styles.timelinePeriod}>
                  {formatYear(e.startYear, e.endYear, e.isCurrent)}
                </p>
                <h4 style={styles.timelineTitle}>
                  {e.degree || e.fieldOfStudy || "Studies"}
                </h4>
                <p style={styles.timelinePlace}>{e.institution}</p>
                {e.description && (
                  <p
                    style={{
                      color: THEME.subtle,
                      fontSize: 13,
                      lineHeight: 1.7,
                      marginTop: 8,
                    }}
                  >
                    {e.description}
                  </p>
                )}
                {idx < education.length - 1 && (
                  <div
                    style={{
                      borderBottom: `1px solid ${THEME.border}`,
                      marginTop: 16,
                      marginLeft: -24,
                      width: "calc(100% + 24px)",
                    }}
                  />
                )}
              </div>
            ))
          ) : (
            <div style={styles.timelineCard}>
              <TimelineDot />
              <p style={styles.timelinePlace}>No education added yet.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SkillsSection({
  skills,
  title,
  isOwnerView,
  onEdit,
}: {
  skills: ProfileSkill[];
  title: string;
  isOwnerView?: boolean;
  onEdit?: (key: PortfolioEditorKey) => void;
}) {
  if (skills.length === 0 && !isOwnerView) return null;

  const grouped = useMemo(() => {
    const map: Record<string, ProfileSkill[]> = {};
    for (const sk of skills) {
      const cat = sk.category || "other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(sk);
    }
    return Object.entries(map);
  }, [skills]);

  return (
    <section id="skills" style={styles.section}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={styles.sectionTitle}>
          My <span style={styles.accentText}>{title}</span>
        </h2>
        {isOwnerView && onEdit ? (
          <EditButton onClick={() => onEdit("skills")} label="Edit skills" />
        ) : null}
      </div>
      <SectionDecorator />
      <p style={styles.sectionDesc}>
        Skills I have developed and refined across my career.
      </p>
      {skills.length === 0 ? (
        <EmptyStateCard
          icon="🎯"
          title="Define your institution's focus areas"
          description="List the disciplines, research themes, or domains where your institution drives impact — AI, sustainability, biotech, social innovation, and more."
          ctaLabel={isOwnerView && onEdit ? "Add a focus area" : undefined}
          onCta={isOwnerView && onEdit ? () => onEdit("skills") : undefined}
        />
      ) : null}
      {grouped.map(([category, catSkills]) => (
        <div key={category} style={{ marginBottom: 40 }}>
          <p
            style={{
              color: THEME.accent,
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 2,
              marginBottom: 20,
              paddingBottom: 10,
              borderBottom: `1px solid ${THEME.border}`,
            }}
          >
            {SKILL_CATEGORY_ICON[category] ?? "Sk"} &nbsp;{category}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "16px 48px",
            }}
          >
            {catSkills.map((sk, i) => {
              const percent = SKILL_LEVEL_PERCENT[sk.level] ?? 50;
              return (
                <div key={`${sk.name}-${i}`}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        color: THEME.text,
                        fontSize: 14,
                        fontWeight: 600,
                        fontFamily: APP_FONT_STACK,
                      }}
                    >
                      {sk.name}
                    </span>
                    <span
                      style={{
                        color: THEME.subtle,
                        fontSize: 11,
                        textTransform: "capitalize",
                      }}
                    >
                      {sk.level}
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: 4,
                      background: THEME.borderStrong,
                    }}
                  >
                    <div
                      style={{
                        width: `${percent}%`,
                        height: "100%",
                        background: THEME.accentGradient,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

function InstitutionProfileSection({
  profile,
  isOwnerView,
  onEdit,
}: {
  profile: PortfolioProfile;
  isOwnerView?: boolean;
  onEdit?: (key: PortfolioEditorKey) => void;
}) {
  const ip = profile.institutionProfile;
  if (!ip && !isOwnerView) return null;

  const rows: { label: string; value: string; iconKey: string }[] = [];
  if (ip?.foundedYear)
    rows.push({ label: "Established", value: String(ip.foundedYear), iconKey: "foundedYear" });
  if (ip?.organizationType)
    rows.push({ label: "Organization type", value: ip.organizationType, iconKey: "organizationType" });
  if (ip?.academicYear)
    rows.push({ label: "Academic year", value: ip.academicYear, iconKey: "academicYear" });
  if (ip?.location) rows.push({ label: "Location", value: ip.location, iconKey: "location" });
  if (ip?.iicStarRating)
    rows.push({ label: "IIC star rating", value: String(ip.iicStarRating), iconKey: "iicStarRating" });
  if (ip?.totalStudentsEnrolled)
    rows.push({
      label: "Students enrolled",
      value: String(ip.totalStudentsEnrolled),
      iconKey: "totalStudentsEnrolled",
    });
  if (ip?.alumniCount)
    rows.push({ label: "Alumni", value: String(ip.alumniCount), iconKey: "alumniCount" });
  if (ip?.employeeCount)
    rows.push({ label: "Employees", value: String(ip.employeeCount), iconKey: "employeeCount" });
  if (ip?.contactEmail)
    rows.push({ label: "Contact email", value: ip.contactEmail, iconKey: "contactEmail" });
  if (ip?.contactPhone)
    rows.push({ label: "Contact phone", value: ip.contactPhone, iconKey: "contactPhone" });

  const specialties = ip?.specialties?.filter(Boolean) ?? [];
  const locations = ip?.locations?.filter(Boolean) ?? [];

  return (
    <section
      id="resume"
      style={{ ...styles.section, background: "transparent" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <h2 style={{ ...styles.sectionTitle, marginBottom: 0 }}>
          <span style={styles.accentText}>Institution Profile</span>
        </h2>
        {isOwnerView && onEdit ? (
          <EditButton
            onClick={() => onEdit("institution")}
            label="Edit institution"
          />
        ) : null}
      </div>
      <SectionDecorator />
      {rows.length === 0 && specialties.length === 0 && locations.length === 0 ? (
        <EmptyStateCard
          icon="🏛️"
          title="Tell visitors about your institution"
          description="Add your establishment date, organization type, IIC star rating, student strength, campuses, and contact details to give a complete profile."
          ctaLabel={isOwnerView && onEdit ? "Add institution details" : undefined}
          onCta={isOwnerView && onEdit ? () => onEdit("institution") : undefined}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 18,
          }}
        >
          {rows.map((row) => (
            <div
              key={row.label}
              style={{
                position: "relative",
                padding: "20px 20px 20px 20px",
                border: `1px solid ${THEME.border}`,
                borderRadius: 14,
                background:
                  "linear-gradient(160deg, rgba(15, 23, 42, 0.85) 0%, rgba(2, 6, 23, 0.95) 100%)",
                boxShadow: "0 10px 30px rgba(2, 6, 23, 0.28)",
                overflow: "hidden",
                transition: "transform 0.2s ease, border-color 0.2s ease",
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: 2,
                  background: THEME.accentGradient,
                  opacity: 0.85,
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background:
                      "linear-gradient(135deg, rgba(14, 165, 233, 0.22), rgba(37, 99, 235, 0.16))",
                    border: `1px solid ${THEME.accentRing}`,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                  }}
                >
                  {INSTITUTION_FIELD_ICON[row.iconKey] || "•"}
                </span>
                <p
                  style={{
                    color: THEME.subtle,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 1.6,
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  {row.label}
                </p>
              </div>
              <p
                style={{
                  color: THEME.text,
                  fontSize: 17,
                  fontWeight: 700,
                  fontFamily: APP_FONT_STACK,
                  lineHeight: 1.35,
                  wordBreak: "break-word",
                }}
              >
                {row.value}
              </p>
            </div>
          ))}
        </div>
      )}
      {specialties.length > 0 || locations.length > 0 ? (
        <div style={{ marginTop: 28, display: "grid", gap: 18 }}>
          {specialties.length > 0 ? (
            <div>
              <p
                style={{
                  color: THEME.accent,
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  marginBottom: 10,
                }}
              >
                Specialties
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {specialties.map((s) => (
                  <span
                    key={s}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 999,
                      border: `1px solid ${THEME.accentRing}`,
                      background:
                        "linear-gradient(135deg, rgba(14, 165, 233, 0.14), rgba(37, 99, 235, 0.08))",
                      color: THEME.text,
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: 0.3,
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {locations.length > 0 ? (
            <div>
              <p
                style={{
                  color: THEME.accent,
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  marginBottom: 10,
                }}
              >
                Campuses
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {locations.map((l) => (
                  <span
                    key={l}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 999,
                      border: `1px solid ${THEME.accentRing}`,
                      background:
                        "linear-gradient(135deg, rgba(14, 165, 233, 0.14), rgba(37, 99, 235, 0.08))",
                      color: THEME.text,
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: 0.3,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    📍 {l}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function CertificationsSection({
  certifications,
  title,
  isOwnerView,
  onEdit,
}: {
  certifications: ProfileCertification[];
  title: string;
  isOwnerView?: boolean;
  onEdit?: (key: PortfolioEditorKey) => void;
}) {
  if (certifications.length === 0 && !isOwnerView) return null;

  return (
    <section style={styles.section}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={styles.sectionTitle}>
          <span style={styles.accentText}>{title}</span>
        </h2>
        {isOwnerView && onEdit ? (
          <EditButton
            onClick={() => onEdit("certifications")}
            label="Edit certifications"
          />
        ) : null}
      </div>
      <SectionDecorator />
      {certifications.length === 0 ? (
        <EmptyStateCard
          icon="🏅"
          title="Showcase accreditations & recognitions"
          description="Highlight NAAC grades, NBA approvals, NIRF rankings, ISO certifications, or any recognitions that validate your institution's credibility."
          ctaLabel={isOwnerView && onEdit ? "Add an accreditation" : undefined}
          onCta={isOwnerView && onEdit ? () => onEdit("certifications") : undefined}
        />
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
          columnGap: 32,
        }}
      >
        {certifications.map((cert) => (
          <div
            key={cert._id}
            style={{
              display: "flex",
              gap: 18,
              padding: "24px 0",
              borderTop: `1px solid ${THEME.border}`,
              borderBottom: `1px solid ${THEME.border}`,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: 40,
                minWidth: 40,
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                border: `1px solid ${THEME.border}`,
                background: THEME.surface,
              }}
            >
              🏅
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    color: THEME.accent,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1.5,
                  }}
                >
                  {cert.issuingOrganization}
                </span>
                {cert.issueDate && (
                  <span style={{ color: THEME.subtle, fontSize: 11 }}>
                    {new Date(cert.issueDate).toLocaleDateString()}
                  </span>
                )}
              </div>
              <h4
                style={{
                  color: THEME.text,
                  fontFamily: APP_FONT_STACK,
                  fontWeight: 700,
                  fontSize: 14,
                  lineHeight: 1.4,
                }}
              >
                {cert.credentialUrl ? (
                  <a
                    href={cert.credentialUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    {cert.name} ↗
                  </a>
                ) : (
                  cert.name
                )}
              </h4>
              {cert.credentialId && (
                <p style={{ color: THEME.subtle, fontSize: 11, marginTop: 4 }}>
                  ID: {cert.credentialId}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AchievementsSection({ profile }: { profile: PortfolioProfile }) {
  const certifications = profile.certifications ?? [];
  const education = profile.education ?? [];
  const achievementCards = [
    {
      id: "innovation-score",
      tag: "Score",
      icon: "⚡",
      meta: `Current score: ${profile.innovationScore ?? 0}`,
      title: "Innovation Score",
      description:
        "A live measure of your innovation momentum across portfolio depth, execution, and platform activity.",
      href: null as string | null,
    },
    ...education.slice(0, 2).map((item) => ({
      id: `education-${item._id}`,
      tag: "Course",
      icon: "🎓",
      meta:
        formatYear(item.startYear, item.endYear, item.isCurrent) ||
        "Learning milestone",
      title: item.degree || item.fieldOfStudy || "Course Achievement",
      description:
        item.description ||
        item.activities ||
        `Completed academic work at ${item.institution}.`,
      href: null as string | null,
    })),
    ...certifications.slice(0, 4).map((cert) => ({
      id: cert._id,
      tag: "Certification",
      icon: "🏅",
      meta: cert.issueDate
        ? new Date(cert.issueDate).toLocaleDateString()
        : "Credential added",
      title: cert.name,
      description: cert.credentialId
        ? `Credential ID: ${cert.credentialId}`
        : `Issued by ${cert.issuingOrganization}`,
      href: cert.credentialUrl || null,
    })),
  ];

  if (achievementCards.length === 0) return null;

  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>
        Recent <span style={styles.accentText}>Achievements</span>
      </h2>
      <p style={styles.sectionDesc}>
        Milestones across courses, certifications, and measurable innovation progress.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
          columnGap: 32,
        }}
      >
        {achievementCards.map((item, idx) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              gap: 20,
              padding: "28px 0",
              borderTop: `1px solid ${THEME.border}`,
              borderBottom: `1px solid ${THEME.border}`,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: 44,
                minWidth: 44,
                height: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                background: THEME.surface,
                border: `1px solid ${THEME.border}`,
              }}
            >
              {item.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    color: THEME.accent,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1.5,
                  }}
                >
                  {item.tag}
                </span>
                <span style={{ color: THEME.subtle, fontSize: 11 }}>
                  {item.meta}
                </span>
              </div>
              <h4
                style={{
                  color: THEME.text,
                  fontFamily: APP_FONT_STACK,
                  fontWeight: 700,
                  fontSize: 15,
                  lineHeight: 1.4,
                  marginBottom: 6,
                }}
              >
                {item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    {item.title} ↗
                  </a>
                ) : (
                  item.title
                )}
              </h4>
              <p
                style={{
                  color: THEME.subtle,
                  fontSize: 13,
                  lineHeight: 1.7,
                }}
              >
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ContactSection({
  profile,
  isOwnerView,
  isAuthenticated,
  currentUserRole,
}: {
  profile: PortfolioProfile;
  isOwnerView: boolean;
  isAuthenticated: boolean;
  currentUserRole?: string | null;
}) {
  const navigate = useNavigate();
  const socials = socialEntries(profile);
  const roleCopy = getRoleCopy(profile);
  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false);
  const [requestFeedback, setRequestFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const recipientId = profile._id;
  const recipientRole = profile.role ?? "student";
  const shortBio = profile.bio
    ? `${profile.bio.slice(0, 120)}${profile.bio.length > 120 ? "..." : ""}`
    : "Start with a structured conversation request and continue the discussion inside ProMove.";

  const requestMessageMutation = useMutation({
    mutationFn: async ({
      queryType,
      customMessage,
    }: {
      queryType: QueryType;
      customMessage?: string;
    }) => {
      if (!recipientId) {
        throw new Error("Portfolio owner is not available for messaging.");
      }

      return requestApi.create({
        requestType: "generic",
        actionType: "connect",
        toUserId: recipientId,
        targetEntityType: "conversation",
        targetEntityId: recipientId,
        targetEntityTitle: profile.displayName || "User",
        message: customMessage?.trim() || "",
        deepLink: `/dashboard/messages/${recipientId}`,
        acceptRedirect: `/dashboard/messages/${recipientId}`,
        metadata: { queryType },
      });
    },
    onSuccess: () => {
      setRequestFeedback({
        type: "success",
        message: `Conversation request sent to ${profile.displayName || "this user"}.`,
      });
    },
    onError: (error) => {
      setRequestFeedback({
        type: "error",
        message: getApiErrorMessage(
          error,
          "Unable to send the conversation request right now.",
        ),
      });
    },
  });

  const handleOpenInbox = () => {
    if (!recipientId) {
      navigate("/dashboard/messages");
      return;
    }

    navigate(`/dashboard/messages/${recipientId}`);
  };

  const handleOpenRequestModal = () => {
    setRequestFeedback(null);
    setIsQueryModalOpen(true);
  };

  const handleQuerySelect = (queryType: QueryType, customMessage?: string) => {
    requestMessageMutation.mutate({ queryType, customMessage });
    setIsQueryModalOpen(false);
  };

  return (
    <section id="contact" style={styles.contactSection}>
      <div style={styles.contactInner}>
        <div style={styles.contactLeft}>
          <h2 style={styles.contactHeading}>
            {roleCopy.contactHeading.split(" ").slice(0, -1).join(" ")}{" "}
            <span style={styles.accentText}>
              {roleCopy.contactHeading.split(" ").slice(-1).join(" ")}
            </span>
          </h2>
          <p style={styles.contactDesc}>{shortBio}</p>
          <div style={styles.contactRequestCard}>
            <p style={styles.contactCardEyebrow}>{roleCopy.contactCardEyebrow}</p>
            <h3 style={styles.contactCardTitle}>{roleCopy.contactCardTitle}</h3>
            <p style={styles.contactCardCopy}>{roleCopy.contactCardCopy}</p>

            <div style={styles.contactChecklist}>
              {roleCopy.contactChecklist.map((item, index) => (
                <div key={item} style={styles.contactChecklistItem}>
                  <span style={styles.contactChecklistBullet}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {requestFeedback ? (
              <div
                style={{
                  ...styles.contactFeedback,
                  ...(requestFeedback.type === "success"
                    ? styles.contactFeedbackSuccess
                    : styles.contactFeedbackError),
                }}
              >
                {requestFeedback.message}
              </div>
            ) : null}

            {isOwnerView ? (
              <div style={styles.contactActionGroup}>
                <p style={styles.contactHint}>{roleCopy.ownerHint}</p>
                <button
                  type="button"
                  style={styles.sendBtn}
                  onClick={handleOpenInbox}
                >
                  Open Inbox
                </button>
              </div>
            ) : isAuthenticated && recipientId ? (
              <div style={styles.contactActionGroup}>
                <button
                  type="button"
                  style={{
                    ...styles.sendBtn,
                    ...(requestMessageMutation.isPending
                      ? styles.buttonDisabled
                      : null),
                  }}
                  onClick={handleOpenRequestModal}
                  disabled={requestMessageMutation.isPending}
                >
                  {requestMessageMutation.isPending
                    ? "Sending..."
                    : "Request Message"}
                </button>
                {requestFeedback?.type === "success" ? (
                  <button
                    type="button"
                    style={styles.secondaryBtn}
                    onClick={handleOpenInbox}
                  >
                    Open Inbox
                  </button>
                ) : null}
              </div>
            ) : (
              <div style={styles.contactActionGroup}>
                <p style={styles.contactHint}>{roleCopy.guestHint}</p>
                <Link to="/login" style={styles.secondaryLinkBtn}>
                  Sign In to Message
                </Link>
              </div>
            )}
          </div>
        </div>
        <div style={styles.contactRight}>
          {profile.email && (
            <div style={styles.contactInfoItem}>
              <span style={styles.contactInfoIcon}>✉️</span>
              <div>
                <p style={styles.contactInfoLabel}>Email</p>
                <p style={styles.contactInfoValue}>{profile.email}</p>
              </div>
            </div>
          )}
          {profile.location && (
            <div style={styles.contactInfoItem}>
              <span style={styles.contactInfoIcon}>📍</span>
              <div>
                <p style={styles.contactInfoLabel}>Location</p>
                <p style={styles.contactInfoValue}>{profile.location}</p>
              </div>
            </div>
          )}
          {profile.websiteUrl && (
            <div style={styles.contactInfoItem}>
              <span style={styles.contactInfoIcon}>🌐</span>
              <div>
                <p style={styles.contactInfoLabel}>Website</p>
                <p style={styles.contactInfoValue}>
                  <a
                    href={profile.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: THEME.accent, textDecoration: "none" }}
                  >
                    {profile.websiteUrl}
                  </a>
                </p>
              </div>
            </div>
          )}
          {profile.domain && (
            <div style={styles.contactInfoItem}>
              <span style={styles.contactInfoIcon}>💼</span>
              <div>
                <p style={styles.contactInfoLabel}>Domain</p>
                <p style={styles.contactInfoValue}>{profile.domain}</p>
              </div>
            </div>
          )}
          {socials.length > 0 && (
            <div>
              <p style={styles.contactInfoLabel}>Find me on</p>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 10,
                  flexWrap: "wrap",
                }}
              >
                {socials.map((s) => (
                  <a
                    key={s.key}
                    href={s.url!}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      width: 40,
                      height: 40,
                      border: `1px solid ${THEME.borderStrong}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: THEME.accent,
                      fontSize: 13,
                      textDecoration: "none",
                      background: THEME.bg,
                    }}
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {recipientId ? (
        <QueryTypeModal
          isOpen={isQueryModalOpen}
          onClose={() => setIsQueryModalOpen(false)}
          onSelect={handleQuerySelect}
          recipientName={profile.displayName || "User"}
          recipientRole={recipientRole}
          currentUserRole={currentUserRole ?? undefined}
          initialQueryType="general"
        />
      ) : null}
    </section>
  );
}

function Footer({
  profile,
  sections,
}: {
  profile: PortfolioProfile;
  sections: PortfolioSections;
}) {
  const pc = profile.portfolioContent;
  const initial = (profile.displayName ?? "P")[0].toUpperCase();
  const footerLinks = [
    ...(sections.about ? ["About"] : []),
    ...(sections.projects ? ["Projects"] : []),
    ...(sections.skills ? ["Skills"] : []),
    ...(sections.resume ? ["Resume"] : []),
    ...(sections.contact ? ["Contact"] : []),
  ];

  return (
    <footer style={styles.footer}>
      <div style={styles.logoCircle}>{initial}</div>
      <div style={styles.footerLinks}>
        {footerLinks.map((l) => (
          <a key={l} href={`#${l.toLowerCase()}`} style={styles.footerLink}>
            {l}
          </a>
        ))}
      </div>
      <p style={styles.footerCopy}>
        {pc?.footerNote ||
          `\u00A9 ${new Date().getFullYear()} ${profile.displayName ?? "Portfolio"}. All rights reserved.`}
      </p>
    </footer>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function Portfolio() {
  const { userId, profileSlug, entityType, entityId } = useParams<{
    userId?: string;
    profileSlug?: string;
    entityType?: string;
    entityId?: string;
  }>();
  const authUser = useAuthStore((state) => state.user);
  const [activeEditor, setActiveEditor] = useState<PortfolioEditorKey | null>(
    null,
  );
  const normalizedEntityType =
    entityType && PORTFOLIO_ROLE_SET.has(entityType as PortfolioRole)
      ? (entityType as PortfolioRole)
      : null;
  const hasEntityParams = Boolean(entityType || entityId);
  const isStudentEntityView = normalizedEntityType === "student" && Boolean(entityId);
  const isMarketplaceUserView =
    Boolean(normalizedEntityType && normalizedEntityType !== "student" && entityId);
  const isPublicSlugView = Boolean(profileSlug);
  const studentId = userId ?? (isStudentEntityView ? entityId : undefined);
  const isGuestUserView = Boolean(studentId);
  const isOwnerView =
    !isPublicSlugView && !isGuestUserView && !isMarketplaceUserView && !hasEntityParams;
  const shouldUseDashboardLayout = !isPublicSlugView;

  const ownProfileQuery = useQuery({
    queryKey: ["profile", "me"],
    queryFn: userApi.getMe,
    enabled: isOwnerView && Boolean(authUser),
  });

  const investorPortfolioQuery = useQuery({
    queryKey: ["investor", "portfolio"],
    queryFn: investorApi.getPortfolio,
    enabled: isOwnerView && authUser?.role === UserRole.INVESTOR,
    refetchInterval: 60_000,
  });

  const guestProfileQuery = useQuery({
    queryKey: ["portfolio", "student", "viewer", studentId],
    queryFn: () => userApi.getStudentPortfolioView(studentId!),
    enabled: Boolean(studentId),
  });

  const marketplaceProfileQuery = useQuery({
    queryKey: ["portfolio", "marketplace", normalizedEntityType, entityId],
    queryFn: async () => {
      const detail = await marketplaceApi.getEntityDetail(
        normalizedEntityType!,
        entityId!,
      );
      if (detail.entityType === "startup") {
        throw new Error("Startup profiles are not available in portfolio view.");
      }
      return mapMarketplaceDetailToPortfolioProfile(detail as MarketplaceUserDetail);
    },
    enabled: isMarketplaceUserView,
  });

  const publicProfileQuery = useQuery({
    queryKey: ["portfolio", "student", "public", profileSlug],
    queryFn: () => userApi.getPublicStudentProfile(profileSlug!),
    enabled: isPublicSlugView,
  });

  const ownerProfile = useMemo(() => {
    const baseProfile = (ownProfileQuery.data ?? authUser ?? null) as PortfolioProfile | null;
    if (!baseProfile) {
      return null;
    }

    return authUser?.role === UserRole.INVESTOR && isOwnerView
      ? enrichInvestorOwnerProfile(baseProfile, investorPortfolioQuery.data)
      : baseProfile;
  }, [
    authUser,
    investorPortfolioQuery.data,
    isOwnerView,
    ownProfileQuery.data,
  ]);

  const profile = (
    isPublicSlugView
      ? publicProfileQuery.data
      : isMarketplaceUserView
        ? marketplaceProfileQuery.data
        : isGuestUserView
        ? guestProfileQuery.data
        : ownerProfile
  ) as PortfolioProfile | null;

  const isLoading = isPublicSlugView
    ? publicProfileQuery.isLoading
    : isMarketplaceUserView
      ? marketplaceProfileQuery.isLoading
      : isGuestUserView
        ? guestProfileQuery.isLoading
        : (ownProfileQuery.isLoading && !profile) ||
          (isOwnerView &&
            authUser?.role === UserRole.INVESTOR &&
            investorPortfolioQuery.isLoading &&
            !investorPortfolioQuery.data);

  const hasError = isPublicSlugView
    ? publicProfileQuery.isError
    : isMarketplaceUserView
      ? marketplaceProfileQuery.isError
      : isGuestUserView
        ? guestProfileQuery.isError
        : ownProfileQuery.isError;

  if (isOwnerView && !authUser) {
    return null;
  }

  const roleFallback =
    isPublicSlugView || isGuestUserView || isStudentEntityView
      ? UserRole.STUDENT
      : authUser?.role;
  const portfolioRole = normalizePortfolioRole(
    profile?.role ?? normalizedEntityType ?? roleFallback,
  );

  const content = isLoading ? (
    <div
      style={{
        ...styles.root,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p style={{ color: THEME.accent, fontSize: 16 }}>Loading portfolio...</p>
    </div>
  ) : hasError || !profile ? (
    <div
      style={{
        ...styles.root,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
      }}
    >
      <p style={{ color: THEME.muted, fontSize: 16 }}>
        This portfolio is not available right now.
      </p>
    </div>
  ) : (
    (() => {
      const pc = profile.portfolioContent;
      const sections = getPortfolioSections(profile, portfolioRole);
      const roleCopy = getRoleCopy(profile);

      return (
        <div style={styles.root}>
          <style>{`
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { background: ${THEME.bg}; }
            a { text-decoration: none; }
            button { border: none; cursor: pointer; }
            ::selection { background: ${THEME.accentBg}; color: ${THEME.text}; }
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-track { background: ${THEME.bg}; }
            ::-webkit-scrollbar-thumb { background: ${THEME.borderStrong}; }
          `}</style>
          <div style={styles.firstFold}>
            <Navbar
              profile={profile}
              isOwnerView={isOwnerView}
              sections={sections}
            />
            <HeroSection
              profile={profile}
              isOwnerView={isOwnerView}
              onEdit={isOwnerView ? setActiveEditor : undefined}
            />
            <StatsBar profile={profile} />
          </div>
          {sections.about || isOwnerView ? (
            <AboutSection
              profile={profile}
              isOwnerView={isOwnerView}
              onEdit={isOwnerView ? setActiveEditor : undefined}
            />
          ) : null}
          {sections.services || isOwnerView ? (
            <QualityServicesSection
              services={profile.portfolioServices ?? []}
              isOwnerView={isOwnerView}
              onEdit={isOwnerView ? setActiveEditor : undefined}
            />
          ) : null}
          {sections.projects || isOwnerView ? (
            <ProjectsSection
              projects={profile.portfolioProjects ?? []}
              title={pc?.projectsTitle || roleCopy.projectsTitle}
              isOwnerView={isOwnerView}
              onEdit={isOwnerView ? setActiveEditor : undefined}
            />
          ) : null}
          {portfolioRole === "school" || portfolioRole === "college" ? (
            <InstitutionProfileSection
              profile={profile}
              isOwnerView={isOwnerView}
              onEdit={isOwnerView ? setActiveEditor : undefined}
            />
          ) : sections.resume || isOwnerView ? (
            <ResumeSection
              experience={profile.experience ?? []}
              education={profile.education ?? []}
              sectionTitle={roleCopy.resumeTitle}
              experienceTitle={pc?.experienceTitle || roleCopy.experienceTitle}
              educationTitle={pc?.educationTitle || roleCopy.educationTitle}
              isOwnerView={isOwnerView}
              onEdit={isOwnerView ? setActiveEditor : undefined}
            />
          ) : null}
          {sections.skills || isOwnerView ? (
            <SkillsSection
              skills={profile.skills ?? []}
              title={pc?.skillsTitle || roleCopy.skillsTitle}
              isOwnerView={isOwnerView}
              onEdit={isOwnerView ? setActiveEditor : undefined}
            />
          ) : null}
          {portfolioRole !== "investor" && (sections.certifications || isOwnerView) ? (
            <CertificationsSection
              certifications={profile.certifications ?? []}
              title={pc?.certificationsTitle || roleCopy.certificationsTitle}
              isOwnerView={isOwnerView}
              onEdit={isOwnerView ? setActiveEditor : undefined}
            />
          ) : null}
          {portfolioRole === "student" && (sections.testimonials || isOwnerView) ? (
            <TestimonialsSection
              testimonials={profile.portfolioTestimonials ?? []}
              isOwnerView={isOwnerView}
              onEdit={isOwnerView ? setActiveEditor : undefined}
            />
          ) : null}
          {sections.achievements ? <AchievementsSection profile={profile} /> : null}
          {portfolioRole === "student" && (sections.blog || isOwnerView) ? (
            <BlogSection
              posts={profile.portfolioBlogPosts ?? []}
              isOwnerView={isOwnerView}
              onEdit={isOwnerView ? setActiveEditor : undefined}
            />
          ) : null}
          {sections.contact ? (
            <ContactSection
              profile={profile}
              isOwnerView={isOwnerView}
              isAuthenticated={Boolean(authUser)}
              currentUserRole={authUser?.role}
            />
          ) : null}
          <Footer profile={profile} sections={sections} />
          {isOwnerView ? (
            <PortfolioSectionEditorModal
              editorKey={activeEditor}
              profile={ownProfileQuery.data ?? null}
              onClose={() => setActiveEditor(null)}
            />
          ) : null}
        </div>
      );
    })()
  );

  if (!shouldUseDashboardLayout) {
    return content;
  }

  if (!authUser) {
    return null;
  }

  return <DashboardLayout role={authUser.role}>{content}</DashboardLayout>;
}

export default Portfolio;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, CSSProperties> = {
  root: {
    fontFamily: APP_FONT_STACK,
    background: THEME.bg,
    color: THEME.text,
    minHeight: "100%",
    height: "100%",
    width: "100%",
    overflowX: "hidden",
  },
  firstFold: {
    height: "100svh",
    minHeight: "100svh",
    display: "flex",
    flexDirection: "column",
  },

  // Navbar
  nav: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: THEME.header,
    backdropFilter: "blur(16px)",
    borderTop: `1px solid ${THEME.border}`,
    borderBottom: `1px solid ${THEME.border}`,
    boxShadow: "0 10px 40px rgba(2, 6, 23, 0.18)",
  },
  navInner: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "0 28px",
    minHeight: 92,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 24,
  },
  logoBlock: {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
    flex: "0 1 auto",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    minWidth: 0,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: THEME.accentGradient,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#f8fafc",
    fontFamily: APP_FONT_STACK,
    fontWeight: 800,
    fontSize: 18,
    boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 12px 24px rgba(14,165,233,0.24)",
  },
  logoText: {
    color: THEME.muted,
    fontSize: 14,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  },
  navRight: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 28,
    marginLeft: "auto",
  },
  navLinks: {
    display: "flex",
    alignItems: "center",
    gap: 34,
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  navLink: {
    color: THEME.muted,
    fontSize: 15,
    fontWeight: 600,
    transition: "color 0.2s ease, opacity 0.2s ease",
    opacity: 0.94,
  },
  hireMeBtn: {
    background: THEME.accentGradient,
    color: "#f8fafc",
    padding: "12px 30px",
    fontSize: 15,
    fontWeight: 700,
    fontFamily: APP_FONT_STACK,
    boxShadow: "0 14px 30px rgba(14,165,233,0.28)",
    whiteSpace: "nowrap",
    textDecoration: "none",
  },
  hamburger: {
    display: "none",
    background: "transparent",
    color: THEME.accent,
    fontSize: 22,
  },
  mobileMenu: {
    display: "flex",
    flexDirection: "column",
    padding: "12px 24px",
    gap: 12,
    background: THEME.surfaceSolid,
  },
  mobileLink: { color: THEME.accent, fontSize: 15 },

  // Hero
  hero: {
    maxWidth: 1200,
    margin: "0 auto",
    width: "100%",
    flex: "1 1 auto",
    minHeight: 0,
    padding: "clamp(20px, 3vw, 36px) 24px clamp(24px, 3vw, 40px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 40,
    flexWrap: "wrap",
  },
  heroContent: { flex: "1 1 400px", maxWidth: 560 },
  heroSub: {
    color: THEME.subtle,
    fontSize: 14,
    marginBottom: 8,
    letterSpacing: 1,
  },
  heroHeading: {
    fontFamily: APP_FONT_STACK,
    fontSize: "clamp(36px, 5vw, 60px)",
    fontWeight: 800,
    lineHeight: 1.1,
    color: THEME.text,
    marginBottom: 20,
  },
  heroAccent: { color: THEME.accent },
  heroDesc: {
    color: THEME.muted,
    fontSize: 15,
    lineHeight: 1.7,
    marginBottom: 32,
    maxWidth: 400,
  },
  heroActions: {
    display: "flex",
    alignItems: "center",
    gap: 20,
    flexWrap: "wrap",
  },
  downloadBtn: {
    background: THEME.accentGradient,
    color: "#f8fafc",
    padding: "12px 28px",
    fontWeight: 600,
    fontSize: 14,
    fontFamily: APP_FONT_STACK,
    textDecoration: "none",
  },
  socialIcons: { display: "flex", gap: 10 },
  socialIcon: {
    width: 36,
    height: 36,
    border: `1px solid ${THEME.borderStrong}`,
    background: THEME.surface,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: THEME.accent,
    fontSize: 12,
    textDecoration: "none",
  },
  heroAvatar: { flex: "0 0 auto" },
  avatarInner: {
    width: 300,
    height: 340,
    borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
    background: THEME.accentGradientSoft,
    border: `1px solid ${THEME.accentRing}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  avatarGradient: {
    position: "absolute",
    inset: 0,
    background: THEME.accentGlow,
  },
  avatarFace: {
    fontSize: 120,
    position: "relative",
    zIndex: 1,
    fontFamily: APP_FONT_STACK,
    fontWeight: 800,
    color: THEME.accent,
  },

  // Stats
  statsBar: {
    background: THEME.surfaceSolid,
    borderTop: `1px solid ${THEME.border}`,
    borderBottom: `1px solid ${THEME.border}`,
    display: "flex",
    justifyContent: "center",
    gap: 0,
    flexWrap: "wrap",
    flexShrink: 0,
  },
  statItem: {
    padding: "22px clamp(28px, 4vw, 60px)",
    textAlign: "center",
    borderRight: `1px solid ${THEME.border}`,
  },
  statValue: {
    display: "block",
    fontFamily: APP_FONT_STACK,
    fontSize: 32,
    fontWeight: 800,
    color: THEME.accent,
  },
  statLabel: { display: "block", color: THEME.subtle, fontSize: 12, marginTop: 4 },

  // Section
  section: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "80px 24px",
    scrollMarginTop: 104,
  },
  sectionEyebrow: {
    color: THEME.accent,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 2,
    textAlign: "center",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: APP_FONT_STACK,
    fontSize: "clamp(26px, 3vw, 40px)",
    fontWeight: 800,
    textAlign: "center",
    color: THEME.text,
    marginBottom: 12,
  },
  sectionDesc: {
    textAlign: "center",
    color: THEME.muted,
    fontSize: 14,
    maxWidth: 480,
    margin: "0 auto 48px",
    lineHeight: 1.7,
  },
  accentText: { color: THEME.accent },

  // Services
  servicesList: {
    maxWidth: 920,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderTop: `1px solid ${THEME.border}`,
    borderBottom: `1px solid ${THEME.border}`,
  },
  serviceRow: {
    width: "100%",
    background: "transparent",
    color: THEME.text,
    display: "flex",
    alignItems: "flex-start",
    gap: 18,
    padding: "24px 28px",
    textAlign: "left",
    transition: "background 0.2s ease, box-shadow 0.2s ease",
  },
  serviceRowActive: {
    background:
      "linear-gradient(90deg, rgba(14, 165, 233, 0.18), rgba(8, 47, 73, 0.18) 42%, rgba(15, 23, 42, 0.08) 100%)",
    boxShadow: "inset 3px 0 0 rgba(59, 130, 246, 0.95)",
  },
  serviceIconWrap: {
    width: 34,
    minWidth: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
  },
  serviceIcon: {
    color: THEME.accent,
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1,
  },
  serviceInfo: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  serviceTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  serviceArrow: {
    color: THEME.accent,
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1,
  },
  serviceTitle: {
    color: THEME.text,
    fontFamily: APP_FONT_STACK,
    fontSize: "clamp(18px, 2.4vw, 28px)",
    fontWeight: 700,
    lineHeight: 1.2,
  },
  serviceDesc: {
    color: THEME.muted,
    fontSize: 14,
    lineHeight: 1.8,
    marginTop: 12,
    maxWidth: 640,
  },

  // Works / Projects
  workTabs: {
    display: "flex",
    justifyContent: "center",
    gap: 8,
    marginBottom: 36,
    flexWrap: "wrap",
  },
  workTab: {
    padding: "8px 22px",
    background: "transparent",
    color: THEME.subtle,
    fontSize: 13,
    fontWeight: 500,
    border: `1px solid ${THEME.border}`,
    transition: "all 0.2s",
  },
  workTabActive: {
    background: THEME.accentBg,
    color: THEME.accent,
    border: `1px solid ${THEME.accentRing}`,
  },
  worksGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 16,
  },
  workCard: {
    overflow: "hidden",
    position: "relative",
    cursor: "pointer",
    border: `1px solid ${THEME.border}`,
    minHeight: 220,
  },
  workCardOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: "20px",
    background:
      "linear-gradient(to top, rgba(2, 6, 23, 0.92), rgba(2, 6, 23, 0.28), transparent)",
    zIndex: 2,
  },
  workCategory: {
    color: THEME.accent,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  workTitle: {
    color: THEME.text,
    fontFamily: APP_FONT_STACK,
    fontSize: 15,
    fontWeight: 700,
    marginTop: 4,
  },
  mockCard: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    padding: 20,
  },

  // Resume
  resumeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 48,
    maxWidth: 1100,
    margin: "0 auto",
  },
  resumeHeading: {
    fontFamily: APP_FONT_STACK,
    fontSize: 22,
    fontWeight: 800,
    color: THEME.text,
    marginBottom: 24,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  resumeIcon: { fontSize: 20 },
  timelineCard: {
    borderLeft: `2px solid ${THEME.accent}`,
    padding: "16px 0 16px 24px",
    marginBottom: 0,
    marginLeft: 12,
    position: "relative" as const,
  },
  timelinePeriod: {
    color: THEME.accent,
    fontSize: 11,
    fontWeight: 600,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  timelineTitle: {
    color: THEME.text,
    fontFamily: APP_FONT_STACK,
    fontWeight: 700,
    fontSize: 15,
    marginBottom: 4,
  },
  timelinePlace: { color: THEME.muted, fontSize: 12 },

  // Testimonials (styles moved inline)
  testimonialCard: {
    borderLeft: `3px solid ${THEME.accent}`,
    padding: "32px 0 32px 32px",
    position: "relative" as const,
  },
  testimonialText: {
    color: THEME.text,
    fontSize: 15,
    lineHeight: 1.8,
    marginBottom: 20,
  },
  testimonialName: {
    color: THEME.text,
    fontFamily: APP_FONT_STACK,
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 2,
  },
  testimonialRole: {
    color: THEME.subtle,
    fontSize: 12,
  },

  // (Blog/Certifications styles moved inline)

  // Contact
  contactSection: {
    background: THEME.surfaceSolid,
    borderTop: `1px solid ${THEME.border}`,
    padding: "80px 24px",
    scrollMarginTop: 104,
  },
  contactInner: {
    maxWidth: 1100,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 64,
    alignItems: "start",
  },
  contactLeft: {},
  contactHeading: {
    fontFamily: APP_FONT_STACK,
    fontSize: "clamp(28px, 3vw, 44px)",
    fontWeight: 800,
    color: THEME.text,
    marginBottom: 12,
  },
  contactDesc: {
    color: THEME.muted,
    fontSize: 14,
    lineHeight: 1.7,
    marginBottom: 32,
    maxWidth: 400,
  },
  contactRequestCard: {
    border: `1px solid ${THEME.border}`,
    background:
      "linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(3, 7, 18, 0.98))",
    padding: "28px",
    display: "flex",
    flexDirection: "column",
    gap: 18,
    boxShadow: "0 22px 44px rgba(2, 6, 23, 0.24)",
  },
  contactCardEyebrow: {
    color: THEME.accent,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    fontWeight: 700,
  },
  contactCardTitle: {
    color: THEME.text,
    fontFamily: APP_FONT_STACK,
    fontSize: 24,
    fontWeight: 800,
    lineHeight: 1.25,
  },
  contactCardCopy: {
    color: THEME.muted,
    fontSize: 13,
    lineHeight: 1.8,
  },
  contactChecklist: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  contactChecklistItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    color: THEME.text,
    fontSize: 13,
    lineHeight: 1.6,
  },
  contactChecklistBullet: {
    minWidth: 34,
    height: 34,
    border: `1px solid ${THEME.accentRing}`,
    background: THEME.accentBg,
    color: THEME.accent,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
  },
  contactFeedback: {
    padding: "12px 14px",
    fontSize: 13,
    lineHeight: 1.6,
    border: `1px solid ${THEME.border}`,
  },
  contactFeedbackSuccess: {
    background: "rgba(16, 185, 129, 0.12)",
    border: "1px solid rgba(16, 185, 129, 0.32)",
    color: "#bbf7d0",
  },
  contactFeedbackError: {
    background: "rgba(248, 113, 113, 0.12)",
    border: "1px solid rgba(248, 113, 113, 0.32)",
    color: "#fecaca",
  },
  contactActionGroup: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  contactHint: {
    color: THEME.subtle,
    fontSize: 13,
    lineHeight: 1.7,
    flexBasis: "100%",
  },
  sendBtn: {
    background: THEME.accentGradient,
    color: "#f8fafc",
    padding: "14px",
    fontWeight: 700,
    fontSize: 14,
    fontFamily: APP_FONT_STACK,
    letterSpacing: 0.5,
    alignSelf: "flex-start",
    width: "auto",
    minWidth: 160,
  },
  secondaryBtn: {
    background: "transparent",
    color: THEME.text,
    padding: "13px 18px",
    fontWeight: 600,
    fontSize: 13,
    fontFamily: APP_FONT_STACK,
    border: `1px solid ${THEME.borderStrong}`,
  },
  secondaryLinkBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    color: THEME.text,
    padding: "13px 18px",
    fontWeight: 600,
    fontSize: 13,
    fontFamily: APP_FONT_STACK,
    border: `1px solid ${THEME.borderStrong}`,
    textDecoration: "none",
  },
  buttonDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
  },
  contactRight: {
    display: "flex",
    flexDirection: "column",
    gap: 28,
    paddingTop: 16,
  },
  contactInfoItem: { display: "flex", gap: 16, alignItems: "flex-start" },
  contactInfoIcon: { fontSize: 22 },
  contactInfoLabel: {
    color: THEME.subtle,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  contactInfoValue: { color: THEME.text, fontSize: 14, lineHeight: 1.6 },

  // Footer
  footer: {
    background: THEME.bg,
    borderTop: `1px solid ${THEME.border}`,
    padding: "32px 24px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 20,
  },
  footerLinks: {
    display: "flex",
    gap: 28,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  footerLink: { color: THEME.muted, fontSize: 13, transition: "color 0.2s" },
  footerCopy: { color: THEME.faint, fontSize: 12 },

  // Recent Works
  recentWorkTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  recentWorkDate: {
    color: THEME.subtle,
    fontSize: 11,
  },
  recentWorkTitle: {
    color: THEME.text,
    fontFamily: APP_FONT_STACK,
    fontWeight: 700,
    fontSize: 18,
    lineHeight: 1.3,
    marginBottom: 8,
  },
  recentWorkDesc: {
    color: THEME.muted,
    fontSize: 13,
    lineHeight: 1.7,
    marginBottom: 14,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
  },
  recentWorkMeta: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  recentWorkMetaChip: {
    color: THEME.subtle,
    fontSize: 11,
    padding: "3px 10px",
    border: `1px solid ${THEME.border}`,
    background: THEME.surface,
  },
  recentWorkCta: {
    color: THEME.accent,
    fontSize: 12,
    fontWeight: 600,
    marginTop: "auto",
  },
};
