import { UserRole } from './roles.types';

export interface AuthUser {
  _id: string;
  email: string;
  role: UserRole;
  displayName: string;
  avatar?: string;
  profileComplete: boolean;
  innovationScore: number;
  accessGrantedBy?: 'self_registered' | 'institution_token';
  isActive?: boolean;
  verificationStatus?: 'not_required' | 'pending' | 'verified' | 'rejected';
  verificationRequestedAt?: string;
  verifiedAt?: string;
  verificationRejectedAt?: string;
  verificationRejectedReason?: string;
  institutionId?: string;
}

export interface AuthPayload {
  accessToken: string;
  user: AuthUser;
}

export interface PendingSignupPayload {
  requiresVerification: true;
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
  institutionProfile?: {
    institutionName: string;
    location: string;
    totalStudentsEnrolled: number;
    academicYear: string;
    iicStarRating?: number;
  };
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
