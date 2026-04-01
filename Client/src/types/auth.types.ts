import { UserRole } from './roles.types';

export interface InstitutionProfileInput {
  institutionName: string;
  location: string;
  totalStudentsEnrolled: number;
  academicYear: string;
  iicStarRating?: number;
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

export interface AuthUser {
  _id: string;
  email: string;
  role: UserRole;
  displayName: string;
  avatar?: string;
  bio?: string;
  isProfilePublic?: boolean;
  domain?: string;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
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
  institutionProfile?: {
    institutionName?: string;
    location?: string;
    academicYear?: string;
    iicStarRating?: number;
  };
  verificationStatus?: 'not_required' | 'pending' | 'verified' | 'rejected';
  verificationRequestedAt?: string;
  verifiedAt?: string;
  verificationRejectedAt?: string;
  verificationRejectedReason?: string;
  institutionId?: string;
  mustChangePasswordOnNextLogin?: boolean;
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
  role: UserRole;
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
