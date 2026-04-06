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

export interface ProfileExperience {
  _id: string;
  title: string;
  company: string;
  type: 'full_time' | 'part_time' | 'internship' | 'freelance' | 'volunteer';
  location: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  description: string;
  skills: string[];
  source: 'manual' | 'linkedin';
  linkedinId: string | null;
}

export interface ProfileEducation {
  _id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startYear?: number;
  endYear: number | null;
  isCurrent: boolean;
  grade: string;
  activities: string;
  description: string;
  source: 'manual' | 'linkedin';
}

export interface ProfileCertification {
  _id: string;
  name: string;
  issuingOrganization: string;
  issueDate: string | null;
  expiryDate: string | null;
  credentialId: string;
  credentialUrl: string;
  source: 'manual' | 'linkedin';
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

export interface GithubRecentCommit {
  sha: string;
  message: string;
  committedAt: string;
  url: string | null;
}

export interface GithubImportedRepo {
  repoId: string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  owner: string;
  isPrivate: boolean;
  defaultBranch: string;
  primaryLanguage: string | null;
  languages: string[];
  stars: number;
  forks: number;
  openIssues: number;
  pushedAt: string | null;
  importedAt: string;
  recentCommits: GithubRecentCommit[];
}

export interface GithubActivityEvent {
  id: string;
  type: 'push' | 'pull_request' | 'issue' | 'release' | 'fork' | 'watch' | 'other';
  repoFullName: string;
  title: string;
  summary: string;
  url: string | null;
  occurredAt: string;
  commitCount: number;
  isPrivate: boolean;
}

export interface GithubProof {
  importedRepoIds: string[];
  importedRepos: GithubImportedRepo[];
  recentActivity: GithubActivityEvent[];
  commitCount30Days: number;
  activeDays30Days: number;
  pushEvents30Days: number;
  pullRequests30Days: number;
  issues30Days: number;
  lastSyncedAt: string | null;
}

export interface GithubRepositoryChoice {
  repoId: string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  primaryLanguage: string | null;
  stars: number;
  forks: number;
  isPrivate: boolean;
  pushedAt: string | null;
  imported: boolean;
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
  experience?: ProfileExperience[];
  education?: ProfileEducation[];
  certifications?: ProfileCertification[];
  portfolioProjects?: PortfolioProject[];
  githubStats?: GithubStats;
  githubProof?: GithubProof;
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

export interface GithubOauthStartResponse {
  authorizationUrl: string;
}

export interface GithubSyncResponse {
  user: UserProfile;
  repositoryCount: number;
}

export interface GithubImportResponse {
  user: UserProfile;
  importedCount: number;
}

export interface RecordUserActivityPayload {
  eventType: 'page_view' | 'navigation_click';
  path: string;
  label?: string;
  referrerPath?: string;
}

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  points: number;
  optional: boolean;
  completed: boolean;
  claimed: boolean;
  href: string;
}

export interface OnboardingStatus {
  steps: OnboardingStep[];
  totalPoints: number;
  earnedPoints: number;
  allComplete: boolean;
}

export interface PublicStudentProfile {
  _id: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  headline: string;
  location: string;
  websiteUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  profileSlug: string;
  domain?: string;
  innovationScore: number;
  institutionVerifiedAt: string | null;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
  skills: ProfileSkill[];
  experience: ProfileExperience[];
  education: ProfileEducation[];
  certifications: ProfileCertification[];
  portfolioProjects: PortfolioProject[];
  githubStats: GithubStats;
  githubProof: {
    importedRepos: GithubImportedRepo[];
    recentActivity: GithubActivityEvent[];
    commitCount30Days: number;
    activeDays30Days: number;
    pushEvents30Days: number;
    pullRequests30Days: number;
    issues30Days: number;
    lastSyncedAt: string | null;
  };
  institution: {
    _id: string;
    displayName: string;
  } | null;
}

export const userApi = {
  async getMe() {
    const response = await api.get<ApiSuccessResponse<UserProfile>>('/api/users/me');
    return response.data.data;
  },
  async getPublicStudentProfile(profileSlug: string) {
    const response = await api.get<ApiSuccessResponse<PublicStudentProfile>>(`/api/users/public/${profileSlug}`);
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
  async startGithubOauth(returnTo?: string) {
    const response = await api.get<ApiSuccessResponse<GithubOauthStartResponse>>('/api/users/me/github/oauth/start', {
      params: returnTo ? { returnTo } : undefined,
    });
    return response.data.data;
  },
  async syncGithubProof() {
    const response = await api.post<ApiSuccessResponse<GithubSyncResponse>>('/api/users/me/github/sync');
    return response.data.data;
  },
  async listGithubRepositories() {
    const response = await api.get<ApiSuccessResponse<GithubRepositoryChoice[]>>('/api/users/me/github/repositories');
    return response.data.data;
  },
  async importGithubRepositories(repoIds: string[]) {
    const response = await api.post<ApiSuccessResponse<GithubImportResponse>>('/api/users/me/github/import', {
      repoIds,
    });
    return response.data.data;
  },
  async trackActivity(payload: RecordUserActivityPayload) {
    const response = await api.post<ApiSuccessResponse<{ tracked: true }>>('/api/users/me/activity', payload);
    return response.data.data;
  },
  async getOnboarding() {
    const response = await api.get<ApiSuccessResponse<OnboardingStatus>>('/api/users/me/onboarding');
    return response.data.data;
  },
  async claimOnboardingStep(stepId: string) {
    const response = await api.post<ApiSuccessResponse<{ awarded: number }>>(`/api/users/me/onboarding/claim/${stepId}`);
    return response.data.data;
  },
  async acceptTerms(version: string) {
    const response = await api.post<ApiSuccessResponse<AuthUser>>('/api/users/me/terms-acceptance', {
      version,
    });
    return response.data.data;
  },
};
