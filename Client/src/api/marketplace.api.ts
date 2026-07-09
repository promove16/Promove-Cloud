import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import { UserRole } from '../types/roles.types';

export type MarketplaceRole = 'student' | 'school' | 'college' | 'mentor' | 'investor' | 'recruiter';
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

export interface MarketplaceInstitutionProfile {
  institutionName: string;
  location: string;
  totalStudentsEnrolled: number;
  academicYear: string;
  iicStarRating: number;
  organizationType?: string;
  foundedYear?: number;
  specialties: string[];
  locations: string[];
  alumniCount?: number;
  employeeCount?: number;
  contactEmail?: string;
  contactPhone?: string;
  stats?: {
    totalInnovationActivities: number;
    patentsFiled: number;
    totalMentoringHours: number;
    startupsLaunched: number;
    industryCollaborations: number;
    totalHRConnections?: number;
    studentsPlaced?: number;
    directShortlistsThisQuarter?: number;
    topHiringSector?: string;
  };
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
  institutionProfile?: MarketplaceInstitutionProfile;
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

export interface MarketplaceStartupTrustProfile {
  signals: string[];
  proofCount: number;
  hasWebsite: boolean;
  hasProductDemo: boolean;
  hasPortfolio: boolean;
  legalStructure?: string;
  fundingStatus?: string;
}

export interface MarketplaceStartupPublicDetails {
  business?: {
    problemStatement?: string;
    solutionSummary?: string;
    targetCustomers?: string;
    marketAnalysis?: string;
    revenueModel?: string;
    goToMarketPlan?: string;
  };
  launch?: {
    vision?: string;
    mission?: string;
    productStage?: string;
    productOverview?: string;
    customerProfile?: string;
    marketOpportunity?: string;
    businessModel?: string;
    currentTraction?: string;
    upcomingMilestones?: string;
    fundingAsk?: string;
  };
  innovation?: {
    startupStage?: string;
    problemClarity?: string;
    uniqueSolution?: string;
    marketDifferentiation?: string;
    patentStatus?: string;
    fundingStatus?: string;
    hasItrFiling?: boolean;
    hasRevenueProof?: boolean;
    hasGovernmentGrant?: boolean;
    hasAwardRecognition?: boolean;
  };
  publicLinks?: {
    websiteUrl?: string;
    productDemoUrl?: string;
    portfolioUrl?: string;
  };
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
  trustProfile: MarketplaceStartupTrustProfile;
  publicDetails?: MarketplaceStartupPublicDetails;
  founders: MarketplaceFounderSummary[];
  primaryFounderId?: string;
  project?: MarketplaceProjectSummary;
}

export interface MarketplaceStartupDetail extends MarketplaceStartupItem {
  sharePool?: {
    totalShares: number;
    availableShares: number;
    reservedForSole: number;
    currentPennyCount: number;
    maxPennyInvestors: number;
    hasSoleInvestor: boolean;
  };
  acceptsPennyInvestors?: boolean;
  acceptsSoleInvestor?: boolean;
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

export interface MentorScoreSummary {
  total: number;
  phase1: number;
  phase2: number;
  phase3: number;
  rank: number;
}

export interface MarketplaceUserItem extends MarketplaceProfile {
  entityType: MarketplaceRole;
  relatedCounts: MarketplaceRelatedCounts;
  mentorScore?: MentorScoreSummary;
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
  ...(profile.institutionProfile ? { institutionProfile: profile.institutionProfile } : {}),
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
  displayName: founder.displayName || 'Founder',
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

const normalizeStartupTrustProfile = (
  trustProfile?: Partial<MarketplaceStartupTrustProfile>,
): MarketplaceStartupTrustProfile => ({
  signals: trustProfile?.signals ?? [],
  proofCount: trustProfile?.proofCount ?? 0,
  hasWebsite: trustProfile?.hasWebsite ?? false,
  hasProductDemo: trustProfile?.hasProductDemo ?? false,
  hasPortfolio: trustProfile?.hasPortfolio ?? false,
  ...(trustProfile?.legalStructure ? { legalStructure: trustProfile.legalStructure } : {}),
  ...(trustProfile?.fundingStatus ? { fundingStatus: trustProfile.fundingStatus } : {}),
});

const normalizeStartupPublicDetails = (
  publicDetails?: Partial<MarketplaceStartupPublicDetails>,
): MarketplaceStartupPublicDetails | undefined => {
  if (!publicDetails) return undefined;

  const normalized: MarketplaceStartupPublicDetails = {
    ...(publicDetails.business
      ? {
          business: {
            ...(publicDetails.business.problemStatement ? { problemStatement: publicDetails.business.problemStatement } : {}),
            ...(publicDetails.business.solutionSummary ? { solutionSummary: publicDetails.business.solutionSummary } : {}),
            ...(publicDetails.business.targetCustomers ? { targetCustomers: publicDetails.business.targetCustomers } : {}),
            ...(publicDetails.business.marketAnalysis ? { marketAnalysis: publicDetails.business.marketAnalysis } : {}),
            ...(publicDetails.business.revenueModel ? { revenueModel: publicDetails.business.revenueModel } : {}),
            ...(publicDetails.business.goToMarketPlan ? { goToMarketPlan: publicDetails.business.goToMarketPlan } : {}),
          },
        }
      : {}),
    ...(publicDetails.launch
      ? {
          launch: {
            ...(publicDetails.launch.vision ? { vision: publicDetails.launch.vision } : {}),
            ...(publicDetails.launch.mission ? { mission: publicDetails.launch.mission } : {}),
            ...(publicDetails.launch.productStage ? { productStage: publicDetails.launch.productStage } : {}),
            ...(publicDetails.launch.productOverview ? { productOverview: publicDetails.launch.productOverview } : {}),
            ...(publicDetails.launch.customerProfile ? { customerProfile: publicDetails.launch.customerProfile } : {}),
            ...(publicDetails.launch.marketOpportunity ? { marketOpportunity: publicDetails.launch.marketOpportunity } : {}),
            ...(publicDetails.launch.businessModel ? { businessModel: publicDetails.launch.businessModel } : {}),
            ...(publicDetails.launch.currentTraction ? { currentTraction: publicDetails.launch.currentTraction } : {}),
            ...(publicDetails.launch.upcomingMilestones ? { upcomingMilestones: publicDetails.launch.upcomingMilestones } : {}),
            ...(publicDetails.launch.fundingAsk ? { fundingAsk: publicDetails.launch.fundingAsk } : {}),
          },
        }
      : {}),
    ...(publicDetails.innovation
      ? {
          innovation: {
            ...(publicDetails.innovation.startupStage ? { startupStage: publicDetails.innovation.startupStage } : {}),
            ...(publicDetails.innovation.problemClarity ? { problemClarity: publicDetails.innovation.problemClarity } : {}),
            ...(publicDetails.innovation.uniqueSolution ? { uniqueSolution: publicDetails.innovation.uniqueSolution } : {}),
            ...(publicDetails.innovation.marketDifferentiation ? { marketDifferentiation: publicDetails.innovation.marketDifferentiation } : {}),
            ...(publicDetails.innovation.patentStatus ? { patentStatus: publicDetails.innovation.patentStatus } : {}),
            ...(publicDetails.innovation.fundingStatus ? { fundingStatus: publicDetails.innovation.fundingStatus } : {}),
            ...(typeof publicDetails.innovation.hasItrFiling === 'boolean' ? { hasItrFiling: publicDetails.innovation.hasItrFiling } : {}),
            ...(typeof publicDetails.innovation.hasRevenueProof === 'boolean' ? { hasRevenueProof: publicDetails.innovation.hasRevenueProof } : {}),
            ...(typeof publicDetails.innovation.hasGovernmentGrant === 'boolean' ? { hasGovernmentGrant: publicDetails.innovation.hasGovernmentGrant } : {}),
            ...(typeof publicDetails.innovation.hasAwardRecognition === 'boolean' ? { hasAwardRecognition: publicDetails.innovation.hasAwardRecognition } : {}),
          },
        }
      : {}),
    ...(publicDetails.publicLinks
      ? {
          publicLinks: {
            ...(publicDetails.publicLinks.websiteUrl ? { websiteUrl: publicDetails.publicLinks.websiteUrl } : {}),
            ...(publicDetails.publicLinks.productDemoUrl ? { productDemoUrl: publicDetails.publicLinks.productDemoUrl } : {}),
            ...(publicDetails.publicLinks.portfolioUrl ? { portfolioUrl: publicDetails.publicLinks.portfolioUrl } : {}),
          },
        }
      : {}),
  };

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const normalizeStartupItem = (
  startup: Partial<MarketplaceStartupItem>,
): MarketplaceStartupItem => {
  const publicDetails = normalizeStartupPublicDetails(startup.publicDetails);

  return {
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
    trustProfile: normalizeStartupTrustProfile(startup.trustProfile),
    ...(publicDetails ? { publicDetails } : {}),
    founders: (startup.founders ?? []).map((founder) => normalizeFounderSummary(founder)),
    ...(startup.primaryFounderId ? { primaryFounderId: startup.primaryFounderId } : {}),
    ...(startup.project ? { project: normalizeProjectSummary(startup.project) } : {}),
  };
};

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
      ...((item as Partial<MarketplaceStartupDetail>).sharePool
        ? {
            sharePool: {
              totalShares: (item as Partial<MarketplaceStartupDetail>).sharePool?.totalShares ?? 0,
              availableShares: (item as Partial<MarketplaceStartupDetail>).sharePool?.availableShares ?? 0,
              reservedForSole: (item as Partial<MarketplaceStartupDetail>).sharePool?.reservedForSole ?? 0,
              currentPennyCount: (item as Partial<MarketplaceStartupDetail>).sharePool?.currentPennyCount ?? 0,
              maxPennyInvestors: (item as Partial<MarketplaceStartupDetail>).sharePool?.maxPennyInvestors ?? 0,
              hasSoleInvestor: (item as Partial<MarketplaceStartupDetail>).sharePool?.hasSoleInvestor ?? false,
            },
          }
        : {}),
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
