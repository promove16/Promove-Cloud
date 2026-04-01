import api from './axiosInstance';
import { ApiSuccessResponse, AuthUser } from '../types/auth.types';

export interface SocialConnection {
  userId: string | null;
  username?: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
}

export interface ProfileSkill {
  name: string;
  category: 'programming' | 'design' | 'business' | 'research' | 'other';
  source: 'platform' | 'github' | 'linkedin' | 'manual';
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  endorsements: number;
  addedAt: string;
}

export interface PortfolioProject {
  _id: string;
  title: string;
  description: string;
  techStack: string[];
  repoUrl: string | null;
  liveUrl: string | null;
  coverImageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  source: 'manual' | 'github';
  githubRepoId: string | null;
  stars: number;
  forks: number;
  languages: string[];
}

export interface GithubLanguageStat {
  language: string;
  percentage: number;
}

export interface GithubStats {
  totalRepos: number;
  totalStars: number;
  totalForks: number;
  topLanguages: GithubLanguageStat[];
  contributionsLastYear: number;
  lastSyncedAt: string | null;
}

export interface UserProfile extends AuthUser {
  bio?: string;
  domain?: string;
  avatar?: string;
  headline?: string;
  location?: string;
  websiteUrl?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  isActive?: boolean;
  accessExpiresAt?: string;
  discoverableToRecruiters?: boolean;
  institutionProfile?: {
    institutionName?: string;
    location?: string;
    academicYear?: string;
    iicStarRating?: number;
  };
  connectedAccounts?: {
    github: SocialConnection;
    linkedin: SocialConnection;
  };
  skills?: ProfileSkill[];
  portfolioProjects?: PortfolioProject[];
  githubStats?: GithubStats;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateUserProfilePayload {
  displayName?: string;
  avatar?: string;
  bio?: string;
  domain?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  profileComplete?: boolean;
  discoverableToRecruiters?: boolean;
}

export interface SocialEnrichPayload {
  githubUrl?: string;
  linkedinUrl?: string;
  confirmLinkedinFetch?: boolean;
}

export interface SocialEnrichSummary {
  githubImported: boolean;
  linkedinImported: boolean;
  warnings: string[];
  importedSkills: number;
  importedProjects: number;
  importedProfileFields: number;
  importedExperience: number;
  importedEducation: number;
  importedCertifications: number;
}

export interface SocialEnrichResponse {
  user: UserProfile;
  summary: SocialEnrichSummary;
}

export interface RecordUserActivityPayload {
  eventType: 'page_view' | 'navigation_click';
  path: string;
  label?: string;
  referrerPath?: string;
}

export const userApi = {
  async getMe() {
    const response = await api.get<ApiSuccessResponse<UserProfile>>('/api/users/me');
    return response.data.data;
  },
  async updateMe(payload: UpdateUserProfilePayload) {
    const response = await api.patch<ApiSuccessResponse<UserProfile>>('/api/users/me', payload);
    return response.data.data;
  },
  async enrichFromSocialLinks(payload: SocialEnrichPayload) {
    const response = await api.post<ApiSuccessResponse<SocialEnrichResponse>>('/api/users/me/social-enrich', payload);
    return response.data.data;
  },
  async trackActivity(payload: RecordUserActivityPayload) {
    const response = await api.post<ApiSuccessResponse<{ tracked: true }>>('/api/users/me/activity', payload);
    return response.data.data;
  },
};
