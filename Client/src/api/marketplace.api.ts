import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import { UserRole } from '../types/roles.types';

export type MarketplaceRole = 'mentor' | 'investor' | 'recruiter';
export type MarketplaceEntityType = MarketplaceRole | 'startup';

export interface MarketplaceLinkSet {
  websiteUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
}

export interface MarketplaceSkill {
  name: string;
  level: string;
}

export interface MarketplaceExperienceHighlight {
  title: string;
  company: string;
  type: string;
  location?: string;
  startDate?: string;
  endDate?: string | null;
  isCurrent: boolean;
  skills: string[];
  description?: string;
}

export interface MarketplaceEducationHighlight {
  institution: string;
  degree?: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number | null;
  isCurrent: boolean;
  grade?: string;
}

export interface MarketplacePortfolioHighlight {
  title: string;
  description?: string;
  techStack: string[];
  repoUrl?: string;
  liveUrl?: string;
  stars: number;
  forks: number;
  languages: string[];
}

export interface MarketplaceGithubStats {
  totalRepos: number;
  totalStars: number;
  totalForks: number;
  contributionsLastYear: number;
  topLanguages: Array<{
    language: string;
    percentage: number;
  }>;
  lastSyncedAt?: string | null;
}

export interface MarketplaceInsightCounts {
  skills: number;
  experience: number;
  education: number;
  portfolioProjects: number;
}

export interface MarketplaceProfile {
  _id: string;
  entityType?: MarketplaceRole;
  displayName: string;
  avatar?: string;
  role: UserRole;
  domain?: string;
  bio?: string;
  headline?: string;
  location?: string;
  links?: MarketplaceLinkSet;
  skills?: MarketplaceSkill[];
  experienceHighlights?: MarketplaceExperienceHighlight[];
  educationHighlights?: MarketplaceEducationHighlight[];
  portfolioHighlights?: MarketplacePortfolioHighlight[];
  githubStats?: MarketplaceGithubStats;
  insightCounts: MarketplaceInsightCounts;
}

export interface MarketplaceRelatedCounts {
  jobs: number;
  startups: number;
}

export interface MarketplaceProjectSummary {
  _id: string;
  title: string;
  category: string;
  stage: string;
  progressPercent: number;
  updatedAt: string;
  completedMilestones: number;
  totalMilestones: number;
  openTasks: number;
  assetCount: number;
  repoCount: number;
  lastUpdate?: {
    note: string;
    submittedAt: string;
  };
}

export interface MarketplaceFounderSummary {
  _id: string;
  displayName: string;
  avatar?: string;
  innovationScore: number;
  headline?: string;
  domain?: string;
  location?: string;
  bio?: string;
}

export interface MarketplaceStartupTraction {
  patentFiled: boolean;
  mvpBuilt: boolean;
  revenueGenerating: boolean;
  usersCount?: number;
}

export interface MarketplaceStartupItem {
  _id: string;
  entityType: 'startup';
  name: string;
  tagline: string;
  category: string;
  stage: string;
  pitchDeckUrl?: string;
  teamSize: number;
  activeProducts: number;
  innovationScoreAtLaunch: number;
  fundingNeeded?: number;
  launchedAt?: string;
  traction: MarketplaceStartupTraction;
  launchTargets: string[];
  founders: MarketplaceFounderSummary[];
  primaryFounderId?: string;
  project?: MarketplaceProjectSummary;
}

export interface MarketplaceStartupDetail extends MarketplaceStartupItem {
  sharePool: {
    totalShares: number;
    availableShares: number;
    reservedForSole: number;
    currentPennyCount: number;
    maxPennyInvestors: number;
    hasSoleInvestor: boolean;
  };
}

export interface MarketplaceJobSummary {
  _id: string;
  recruiterId: string;
  title: string;
  company: string;
  description: string;
  domain: string;
  minimumInnovationScore: number;
  type: 'Full-time' | 'Internship' | 'Contract' | 'Part-time';
  location: string;
  isActive: boolean;
  applicantCount: number;
  shortlistedCount: number;
  hasApplied?: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface MarketplaceUserItem extends MarketplaceProfile {
  entityType: MarketplaceRole;
  relatedCounts: MarketplaceRelatedCounts;
}

export interface MarketplaceUserDetail extends MarketplaceUserItem {
  relatedJobs: MarketplaceJobSummary[];
  relatedStartups: MarketplaceStartupItem[];
}

export type MarketplaceDirectoryItem = MarketplaceUserItem | MarketplaceStartupItem;
export type MarketplaceEntityDetail = MarketplaceUserDetail | MarketplaceStartupDetail;

const normalizeMarketplaceProfile = (profile: Partial<MarketplaceProfile>): MarketplaceProfile => ({
  _id: profile._id ?? '',
  displayName: profile.displayName ?? 'Unknown profile',
  ...(profile.avatar ? { avatar: profile.avatar } : {}),
  role: profile.role ?? UserRole.MENTOR,
  ...(profile.domain ? { domain: profile.domain } : {}),
  ...(profile.bio ? { bio: profile.bio } : {}),
  ...(profile.headline ? { headline: profile.headline } : {}),
  ...(profile.location ? { location: profile.location } : {}),
  ...(profile.links ? { links: profile.links } : {}),
  skills: profile.skills ?? [],
  experienceHighlights: profile.experienceHighlights ?? [],
  educationHighlights: profile.educationHighlights ?? [],
  portfolioHighlights: profile.portfolioHighlights ?? [],
  ...(profile.githubStats ? { githubStats: profile.githubStats } : {}),
  insightCounts: {
    skills: profile.insightCounts?.skills ?? profile.skills?.length ?? 0,
    experience: profile.insightCounts?.experience ?? profile.experienceHighlights?.length ?? 0,
    education: profile.insightCounts?.education ?? profile.educationHighlights?.length ?? 0,
    portfolioProjects:
      profile.insightCounts?.portfolioProjects ?? profile.portfolioHighlights?.length ?? 0,
  },
});

const normalizeProjectSummary = (
  project?: Partial<MarketplaceProjectSummary>,
): MarketplaceProjectSummary | undefined =>
  project
    ? {
        _id: project._id ?? '',
        title: project.title ?? 'Untitled project',
        category: project.category ?? 'General',
        stage: project.stage ?? 'Ideation',
        progressPercent: project.progressPercent ?? 0,
        updatedAt: project.updatedAt ?? new Date(0).toISOString(),
        completedMilestones: project.completedMilestones ?? 0,
        totalMilestones: project.totalMilestones ?? 0,
        openTasks: project.openTasks ?? 0,
        assetCount: project.assetCount ?? 0,
        repoCount: project.repoCount ?? 0,
        ...(project.lastUpdate
          ? {
              lastUpdate: {
                note: project.lastUpdate.note ?? '',
                submittedAt: project.lastUpdate.submittedAt ?? new Date(0).toISOString(),
              },
            }
          : {}),
      }
    : undefined;

const normalizeFounderSummary = (
  founder: Partial<MarketplaceFounderSummary>,
): MarketplaceFounderSummary => ({
  _id: founder._id ?? '',
  displayName: founder.displayName ?? 'Founder',
  ...(founder.avatar ? { avatar: founder.avatar } : {}),
  innovationScore: founder.innovationScore ?? 0,
  ...(founder.headline ? { headline: founder.headline } : {}),
  ...(founder.domain ? { domain: founder.domain } : {}),
  ...(founder.location ? { location: founder.location } : {}),
  ...(founder.bio ? { bio: founder.bio } : {}),
});

const normalizeStartupTraction = (
  traction?: Partial<MarketplaceStartupTraction>,
): MarketplaceStartupTraction => ({
  patentFiled: traction?.patentFiled ?? false,
  mvpBuilt: traction?.mvpBuilt ?? false,
  revenueGenerating: traction?.revenueGenerating ?? false,
  ...(typeof traction?.usersCount === 'number' ? { usersCount: traction.usersCount } : {}),
});

const normalizeStartupItem = (
  startup: Partial<MarketplaceStartupItem>,
): MarketplaceStartupItem => ({
  _id: startup._id ?? '',
  entityType: 'startup',
  name: startup.name ?? 'Startup',
  tagline: startup.tagline ?? 'No startup summary available.',
  category: startup.category ?? 'General',
  stage: startup.stage ?? 'Ideation',
  ...(startup.pitchDeckUrl ? { pitchDeckUrl: startup.pitchDeckUrl } : {}),
  teamSize: startup.teamSize ?? 0,
  activeProducts: startup.activeProducts ?? 0,
  innovationScoreAtLaunch: startup.innovationScoreAtLaunch ?? 0,
  ...(typeof startup.fundingNeeded === 'number' ? { fundingNeeded: startup.fundingNeeded } : {}),
  ...(startup.launchedAt ? { launchedAt: startup.launchedAt } : {}),
  traction: normalizeStartupTraction(startup.traction),
  launchTargets: startup.launchTargets ?? [],
  founders: (startup.founders ?? []).map((founder) => normalizeFounderSummary(founder)),
  ...(startup.primaryFounderId ? { primaryFounderId: startup.primaryFounderId } : {}),
  ...(startup.project ? { project: normalizeProjectSummary(startup.project) } : {}),
});

const normalizeJobSummary = (job: Partial<MarketplaceJobSummary>): MarketplaceJobSummary => ({
  _id: job._id ?? '',
  recruiterId: job.recruiterId ?? '',
  title: job.title ?? 'Untitled role',
  company: job.company ?? 'Recruiter',
  description: job.description ?? '',
  domain: job.domain ?? 'General',
  minimumInnovationScore: job.minimumInnovationScore ?? 0,
  type: job.type ?? 'Full-time',
  location: job.location ?? 'Remote',
  isActive: job.isActive ?? false,
  applicantCount: job.applicantCount ?? 0,
  shortlistedCount: job.shortlistedCount ?? 0,
  ...(typeof job.hasApplied === 'boolean' ? { hasApplied: job.hasApplied } : {}),
  createdAt: job.createdAt ?? new Date(0).toISOString(),
  ...(job.expiresAt ? { expiresAt: job.expiresAt } : {}),
});

const normalizeUserItem = (item: Partial<MarketplaceUserItem>): MarketplaceUserItem => ({
  ...normalizeMarketplaceProfile(item),
  entityType: (item.entityType ?? item.role ?? UserRole.MENTOR) as MarketplaceRole,
  relatedCounts: {
    jobs: item.relatedCounts?.jobs ?? 0,
    startups: item.relatedCounts?.startups ?? 0,
  },
});

const normalizeEntityDirectoryItem = (item: Partial<MarketplaceDirectoryItem>): MarketplaceDirectoryItem =>
  item.entityType === 'startup' || 'name' in item ? normalizeStartupItem(item as Partial<MarketplaceStartupItem>) : normalizeUserItem(item as Partial<MarketplaceUserItem>);

const normalizeEntityDetail = (item: Partial<MarketplaceEntityDetail>): MarketplaceEntityDetail => {
  if (item.entityType === 'startup' || 'name' in item) {
    return {
      ...normalizeStartupItem(item as Partial<MarketplaceStartupItem>),
      sharePool: {
        totalShares: (item as Partial<MarketplaceStartupDetail>).sharePool?.totalShares ?? 0,
        availableShares: (item as Partial<MarketplaceStartupDetail>).sharePool?.availableShares ?? 0,
        reservedForSole: (item as Partial<MarketplaceStartupDetail>).sharePool?.reservedForSole ?? 0,
        currentPennyCount: (item as Partial<MarketplaceStartupDetail>).sharePool?.currentPennyCount ?? 0,
        maxPennyInvestors: (item as Partial<MarketplaceStartupDetail>).sharePool?.maxPennyInvestors ?? 0,
        hasSoleInvestor: (item as Partial<MarketplaceStartupDetail>).sharePool?.hasSoleInvestor ?? false,
      },
    };
  }

  return {
    ...normalizeUserItem(item as Partial<MarketplaceUserItem>),
    relatedJobs: ((item as Partial<MarketplaceUserDetail>).relatedJobs ?? []).map((job) => normalizeJobSummary(job)),
    relatedStartups: ((item as Partial<MarketplaceUserDetail>).relatedStartups ?? []).map((startup) =>
      normalizeStartupItem(startup),
    ),
  };
};

function listMarketplaceEntities(role: "startup", params?: { domain?: string; page?: number; limit?: number }): Promise<MarketplaceStartupItem[]>;
function listMarketplaceEntities(role: MarketplaceRole, params?: { domain?: string; page?: number; limit?: number }): Promise<MarketplaceUserItem[]>;
function listMarketplaceEntities(
  role: MarketplaceEntityType,
  params?: { domain?: string; page?: number; limit?: number },
): Promise<MarketplaceDirectoryItem[]>;
async function listMarketplaceEntities(
  role: MarketplaceEntityType,
  params?: { domain?: string; page?: number; limit?: number },
) {
  const response = await api.get<ApiSuccessResponse<MarketplaceDirectoryItem[]>>('/api/marketplace', {
    params: { role, ...params },
  });
  return (response.data.data ?? []).map((profile) => normalizeEntityDirectoryItem(profile));
}

export const marketplaceApi = {
  list: listMarketplaceEntities,
  async getProfile(userId: string) {
    const response = await api.get<ApiSuccessResponse<MarketplaceProfile>>(`/api/marketplace/${userId}`);
    return normalizeMarketplaceProfile(response.data.data ?? {});
  },
  async getEntityDetail(entityType: MarketplaceEntityType, entityId: string) {
    const response = await api.get<ApiSuccessResponse<MarketplaceEntityDetail>>(
      `/api/marketplace/entities/${entityType}/${entityId}`,
    );
    return normalizeEntityDetail(response.data.data ?? {});
  },
};
