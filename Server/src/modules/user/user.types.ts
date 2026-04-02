import { Types } from 'mongoose';
import { UserRole } from '../../types/roles.types';

export type AccessGrantedBy =
  | 'self_registered'
  | 'institution_token'
  | 'institution_roster'
  | 'institution_admin'
  | 'admin'
  | 'startup_school'
  | 'skill_dev';

export type StudentVerificationStatus = 'not_required' | 'pending' | 'verified' | 'rejected';
export type AdminApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected';
export type RegistrationStage =
  | 'basic'
  | 'profile_setup'
  | 'institution_pending'
  | 'institution_verified'
  | 'complete';
export type InstitutionVerificationStatus = 'none' | 'pending' | 'verified' | 'failed';
export type ConnectedAccountProvider = 'github' | 'google' | 'linkedin';
export type SkillCategory = 'programming' | 'design' | 'business' | 'research' | 'other';
export type SkillSource = 'platform' | 'github' | 'linkedin' | 'manual';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type ExperienceType =
  | 'full_time'
  | 'part_time'
  | 'internship'
  | 'freelance'
  | 'volunteer';
export type ExperienceSource = 'manual' | 'linkedin';
export type EducationSource = 'manual' | 'linkedin';
export type CertificationSource = 'manual' | 'linkedin';
export type PortfolioProjectSource = 'manual' | 'github';

export interface ScoreBreakdown {
  problemsClaimed: number;
  skillsCompleted: number;
  progressUploads: number;
  patentsSubmitted: number;
  patentsApproved: number;
  mvpsVerified: number;
  marketReadyVerified: number;
  startupsLaunched: number;
  awardsApproved: number;
}

export type InstitutionPolicyStatus = 'Active' | 'On Track' | 'Pending' | 'Inactive';

export interface InstitutionPolicy {
  name: string;
  status: InstitutionPolicyStatus;
  lastUpdated?: Date;
}

export interface InstitutionStats {
  totalInnovationActivities: number;
  patentsFiled: number;
  totalMentoringHours: number;
  startupsLaunched: number;
  industryCollaborations: number;
  totalHRConnections?: number;
  studentsPlaced?: number;
  directShortlistsThisQuarter?: number;
  topHiringSector?: string;
}

export interface InstitutionProfile {
  institutionName: string;
  location: string;
  totalStudentsEnrolled: number;
  academicYear: string;
  iicStarRating: number;
  iicLastUpdated?: Date;
  policies: InstitutionPolicy[];
  stats: InstitutionStats;
}

export interface ConnectedAccount {
  userId: string | null;
  username?: string | null;
  accessToken?: string | null;
  connectedAt: Date | null;
  lastSyncedAt: Date | null;
}

export interface ConnectedAccounts {
  github: ConnectedAccount;
  google: ConnectedAccount;
  linkedin: ConnectedAccount;
}

export interface SanitizedConnectedAccount {
  userId: string | null;
  username?: string | null;
  connectedAt: Date | null;
  lastSyncedAt: Date | null;
}

export interface SanitizedConnectedAccounts {
  github: SanitizedConnectedAccount;
  google: SanitizedConnectedAccount;
  linkedin: SanitizedConnectedAccount;
}

export interface SkillEntry {
  name: string;
  category: SkillCategory;
  source: SkillSource;
  level: SkillLevel;
  endorsements: number;
  addedAt: Date;
}

export interface ExperienceEntry {
  _id: Types.ObjectId;
  title: string;
  company: string;
  type: ExperienceType;
  location: string;
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
  description: string;
  skills: string[];
  source: ExperienceSource;
  linkedinId: string | null;
}

export interface EducationEntry {
  _id: Types.ObjectId;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startYear?: number;
  endYear: number | null;
  isCurrent: boolean;
  grade: string;
  activities: string;
  description: string;
  source: EducationSource;
}

export interface CertificationEntry {
  _id: Types.ObjectId;
  name: string;
  issuingOrganization: string;
  issueDate: Date | null;
  expiryDate: Date | null;
  credentialId: string;
  credentialUrl: string;
  source: CertificationSource;
}

export interface PortfolioProjectEntry {
  _id: Types.ObjectId;
  title: string;
  description: string;
  techStack: string[];
  repoUrl: string | null;
  liveUrl: string | null;
  coverImageUrl: string | null;
  startDate: Date | null;
  endDate: Date | null;
  isCurrent: boolean;
  source: PortfolioProjectSource;
  githubRepoId: string | null;
  stars: number;
  forks: number;
  languages: string[];
}

export interface ResumeInfo {
  fileUrl: string | null;
  fileName: string | null;
  uploadedAt: Date | null;
  isPublic: boolean;
}

export interface GithubLanguageStat {
  language: string;
  percentage: number;
}

export type GithubActivityType = 'push' | 'pull_request' | 'issue' | 'release' | 'fork' | 'watch' | 'other';

export interface GithubRecentCommit {
  sha: string;
  message: string;
  committedAt: Date;
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
  pushedAt: Date | null;
  importedAt: Date;
  recentCommits: GithubRecentCommit[];
}

export interface GithubActivityEvent {
  id: string;
  type: GithubActivityType;
  repoFullName: string;
  title: string;
  summary: string;
  url: string | null;
  occurredAt: Date;
  commitCount: number;
  isPrivate: boolean;
}

export interface GithubStats {
  totalRepos: number;
  totalStars: number;
  totalForks: number;
  topLanguages: GithubLanguageStat[];
  contributionsLastYear: number;
  lastSyncedAt: Date | null;
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
  lastSyncedAt: Date | null;
}

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  role: UserRole;
  displayName: string;
  avatar?: string;
  bio?: string;
  headline: string;
  location: string;
  websiteUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  domain?: string;
  profileComplete: boolean;
  registrationStage: RegistrationStage;
  innovationScore: number;
  scoreBreakdown: ScoreBreakdown;
  accessGrantedBy: AccessGrantedBy;
  accessExpiresAt: Date;
  isActive: boolean;
  isProfilePublic: boolean;
  profileSlug?: string | null;
  lastLogin?: Date;
  discoverableToRecruiters?: boolean;
  mustChangePasswordOnNextLogin?: boolean;
  institutionToken: string | null;
  institutionId?: Types.ObjectId | null;
  institutionProfile?: InstitutionProfile;
  institutionVerifiedAt: Date | null;
  institutionVerificationStatus: InstitutionVerificationStatus;
  verificationStatus: StudentVerificationStatus;
  verificationRequestedAt?: Date;
  verifiedAt?: Date;
  verificationRejectedAt?: Date;
  verificationRejectedReason?: string;
  adminApprovalStatus: AdminApprovalStatus;
  adminApprovalRequestedAt?: Date;
  adminApprovedAt?: Date;
  adminApprovedBy?: Types.ObjectId | null;
  adminApprovalRejectedAt?: Date;
  adminApprovalRejectedReason?: string;
  connectedAccounts: ConnectedAccounts;
  skills: SkillEntry[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  certifications: CertificationEntry[];
  portfolioProjects: PortfolioProjectEntry[];
  resume: ResumeInfo;
  githubStats: GithubStats;
  githubProof: GithubProof;
  teamRequestsSent: Types.ObjectId[];
  teamRequestsReceived: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SanitizedUser {
  _id: string;
  email: string;
  role: UserRole;
  displayName: string;
  githubOAuthAvailable: boolean;
  avatar?: string;
  bio?: string;
  headline: string;
  location: string;
  websiteUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  isProfilePublic: boolean;
  profileSlug?: string | null;
  domain?: string;
  profileComplete: boolean;
  registrationStage: RegistrationStage;
  innovationScore: number;
  scoreBreakdown: ScoreBreakdown;
  accessGrantedBy: AccessGrantedBy;
  accessExpiresAt: Date;
  isActive: boolean;
  lastLogin?: Date;
  discoverableToRecruiters?: boolean;
  mustChangePasswordOnNextLogin?: boolean;
  institutionToken?: string | null;
  institutionId?: string | null;
  institutionProfile?: InstitutionProfile;
  institutionVerifiedAt: Date | null;
  institutionVerificationStatus: InstitutionVerificationStatus;
  verificationStatus: StudentVerificationStatus;
  verificationRequestedAt?: Date;
  verifiedAt?: Date;
  verificationRejectedAt?: Date;
  verificationRejectedReason?: string;
  adminApprovalStatus: AdminApprovalStatus;
  adminApprovalRequestedAt?: Date;
  adminApprovedAt?: Date;
  adminApprovedBy?: string | null;
  adminApprovalRejectedAt?: Date;
  adminApprovalRejectedReason?: string;
  connectedAccounts: SanitizedConnectedAccounts;
  skills: SkillEntry[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  certifications: CertificationEntry[];
  portfolioProjects: PortfolioProjectEntry[];
  resume: ResumeInfo;
  githubStats: GithubStats;
  githubProof: GithubProof;
  teamRequestsSent: string[];
  teamRequestsReceived: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MentorSessionMentor {
  _id: string;
  displayName: string;
  avatar?: string;
}

export interface StudentMentorSessionView {
  _id: string;
  mentor: MentorSessionMentor;
  workspaceId?: string;
  title: string;
  scheduledAt: Date;
  durationMinutes: number;
  meetLink?: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  mentorNotes?: string;
  studentFeedback?: string;
  createdAt: Date;
}

export interface LaunchToRecruitersResult {
  bridgesCreated: number;
  user: SanitizedUser;
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
  institutionVerifiedAt: Date | null;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  skills: SkillEntry[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  certifications: CertificationEntry[];
  portfolioProjects: PortfolioProjectEntry[];
  githubStats: GithubStats;
  githubProof: {
    importedRepos: GithubImportedRepo[];
    recentActivity: GithubActivityEvent[];
    commitCount30Days: number;
    activeDays30Days: number;
    pushEvents30Days: number;
    pullRequests30Days: number;
    issues30Days: number;
    lastSyncedAt: Date | null;
  };
  institution: {
    _id: string;
    displayName: string;
  } | null;
}
