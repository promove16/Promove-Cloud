import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import { UserRole } from '../types/roles.types';

export type MarketplaceRole = 'mentor' | 'investor' | 'recruiter';

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

export const marketplaceApi = {
  async list(role: MarketplaceRole, params?: { domain?: string; page?: number; limit?: number }) {
    const response = await api.get<ApiSuccessResponse<MarketplaceProfile[]>>('/api/marketplace', {
      params: { role, ...params },
    });
    return (response.data.data ?? []).map((profile) => normalizeMarketplaceProfile(profile));
  },
  async getProfile(userId: string) {
    const response = await api.get<ApiSuccessResponse<MarketplaceProfile>>(`/api/marketplace/${userId}`);
    return normalizeMarketplaceProfile(response.data.data ?? {});
  },
};
