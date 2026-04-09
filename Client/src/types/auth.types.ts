import { UserRole } from './roles.types';

export interface InstitutionProfileInput {
  institutionName: string;
  location: string;
  totalStudentsEnrolled: number;
  academicYear: string;
  iicStarRating?: number;
  organizationType?: string;
  foundedYear?: number;
  specialties?: string[];
  locations?: string[];
  alumniCount?: number;
  employeeCount?: number;
  contactEmail?: string;
  contactPhone?: string;
}

export type InstitutionRegulatoryBody =
  | 'AICTE'
  | 'UGC'
  | 'NAAC'
  | 'NBA'
  | 'CBSE'
  | 'ICSE'
  | 'STATE_BOARD'
  | 'STATE_EDUCATION_DEPARTMENT'
  | 'UDISE';

export type InstitutionVerificationDocumentCategory =
  | 'governing_body_registration_certificate'
  | 'authorized_signatory_letter'
  | 'address_proof'
  | 'pan_or_tax_registration'
  | 'recognition_certificate'
  | 'board_affiliation_certificate'
  | 'udise_certificate'
  | 'affiliation_letter'
  | 'aicte_approval_letter'
  | 'ugc_recognition_letter'
  | 'accreditation_certificate';

export interface InstitutionVerificationInput {
  regulatoryBodies: InstitutionRegulatoryBody[];
  affiliationName?: string;
  websiteUrl?: string;
  referenceCode?: string;
  notes?: string;
}

export interface InstitutionVerificationDocument {
  _id: string;
  category: InstitutionVerificationDocumentCategory;
  fileUrl: string;
  fileType: 'pdf' | 'image';
  fileName: string;
  fileSizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface InstitutionVerificationReadiness {
  isReadyForReview: boolean;
  requiredDocumentCategories: InstitutionVerificationDocumentCategory[];
  uploadedDocumentCategories: InstitutionVerificationDocumentCategory[];
  missingItems: string[];
}

export interface InstitutionVerificationProfile extends InstitutionVerificationInput {
  documents: InstitutionVerificationDocument[];
  readiness: InstitutionVerificationReadiness;
}

export type RegistrationRequestStatus = 'pending' | 'approved' | 'rejected';

export interface RegistrationRequestSummary {
  _id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: RegistrationRequestStatus;
  domain?: string;
  bio?: string;
  institutionProfile?: InstitutionProfileInput;
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface SocialConnection {
  userId: string | null;
  username?: string | null;
  connectedAt: string | null;
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

export interface TermsAcceptance {
  version: string;
  acceptedAt: string;
  sector: UserRole;
}

export interface AuthUser {
  _id: string;
  email: string;
  role: UserRole;
  displayName: string;
  githubOAuthAvailable: boolean;
  avatar?: string;
  avatarWallpaper?: string;
  bio?: string;
  isProfilePublic?: boolean;
  profileSlug?: string | null;
  domain?: string;
  headline?: string;
  location?: string;
  websiteUrl?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  youtubeUrl?: string | null;
  behanceUrl?: string | null;
  dribbbleUrl?: string | null;
  instagramUrl?: string | null;
  researchGateUrl?: string | null;
  mediumUrl?: string | null;
  profileComplete: boolean;
  innovationScore: number;
  accessGrantedBy?:
    | 'self_registered'
    | 'institution_token'
    | 'institution_roster'
    | 'institution_admin'
    | 'admin'
    | 'startup_school'
    | 'skill_dev';
  isActive?: boolean;
  discoverableToRecruiters?: boolean;
  adminApprovalStatus?: 'not_required' | 'pending' | 'approved' | 'rejected';
  adminApprovalRequestedAt?: string;
  adminApprovedAt?: string;
  adminApprovedBy?: string | null;
  adminApprovalRejectedAt?: string;
  adminApprovalRejectedReason?: string;
  institutionToken?: string | null;
  institutionProfile?: {
    institutionName?: string;
    location?: string;
    totalStudentsEnrolled?: number;
    academicYear?: string;
    iicStarRating?: number;
    organizationType?: string;
    foundedYear?: number;
    specialties?: string[];
    locations?: string[];
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
  };
  institutionVerification?: InstitutionVerificationProfile;
  institutionVerificationStatus?: 'none' | 'pending' | 'verified' | 'failed';
  verificationStatus?: 'not_required' | 'pending' | 'verified' | 'rejected';
  verificationRequestedAt?: string;
  institutionVerifiedAt?: string | null;
  verifiedAt?: string;
  verificationRejectedAt?: string;
  verificationRejectedReason?: string;
  institutionId?: string;
  mustChangePasswordOnNextLogin?: boolean;
  connectedAccounts?: {
    github: SocialConnection;
    google?: SocialConnection;
    linkedin: SocialConnection;
  };
  githubProof?: GithubProof;
  termsAcceptance: TermsAcceptance | null;
  termsCurrentVersion: string;
  hasAcceptedCurrentTerms: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthPayload {
  accessToken: string;
  user: AuthUser;
}

export interface PendingSignupPayload {
  pendingApproval: true;
  approvalType: 'institution' | 'admin';
  message: string;
  user: AuthUser;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SignupInput {
  displayName: string;
  email: string;
  password: string;
  role: UserRole;
  institutionToken?: string;
  accessCode?: string;
  domain?: string;
  bio?: string;
  institutionProfile?: InstitutionProfileInput;
  institutionVerification?: InstitutionVerificationInput;
}

export type SignupResponse = AuthPayload | PendingSignupPayload;

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ path?: string; message: string }>;
  };
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}
