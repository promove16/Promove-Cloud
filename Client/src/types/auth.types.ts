import { UserRole } from './roles.types';

export interface AuthUser {
  _id: string;
  email: string;
  role: UserRole;
  displayName: string;
  avatar?: string;
  profileComplete: boolean;
  innovationScore: number;
}

export interface AuthPayload {
  accessToken: string;
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
  accessCode: string;
}

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
