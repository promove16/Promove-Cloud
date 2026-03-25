import { ReactNode, createContext, useContext } from 'react';
import api from '../../api/axiosInstance';
import { useBootstrapAuth } from '../../features/auth/useAuth';
import { disconnectAll } from '../../lib/socket';
import { useAuthStore } from '../../store/authStore';
import {
  ApiErrorResponse,
  ApiSuccessResponse,
  AuthPayload,
  LoginInput,
  SignupResponse,
} from '../../types/auth.types';
import { UserRole } from '../../types/roles.types';

interface User {
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  login: (
    email: string,
    password: string,
    role: string,
  ) => Promise<{ success: boolean; error?: string; code?: string; redirectTo?: string }>;
  signup: (userData: {
    email: string;
    password: string;
    name: string;
    role: string;
  }) => Promise<{ success: boolean; error?: string; code?: string; redirectTo?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const roleHome: Record<string, string> = {
  student: '/student',
  school: '/school',
  college: '/college',
  mentor: '/mentor',
  investor: '/investor',
  recruiter: '/recruiter',
  company: '/recruiter',
  admin: '/admin',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  useBootstrapAuth();
  const { user: authUser, accessToken, isAuthenticated, isLoading, setAuth, clearAuth } =
    useAuthStore();

  const user = authUser
    ? {
        email: authUser.email,
        name: authUser.displayName,
        role: authUser.role,
      }
    : null;

  const login = async (email: string, password: string, role: string) => {
    try {
      const response = await api.post<ApiSuccessResponse<AuthPayload>>('/api/auth/login', {
        email,
        password,
        role: role as LoginInput['role'],
      });

      const payload = response.data.data;
      setAuth(payload.user, payload.accessToken);

      return {
        success: true,
        redirectTo: roleHome[payload.user.role] ?? '/dashboard',
      };
    } catch (error) {
      const apiError = (error as { response?: { data?: ApiErrorResponse } })?.response?.data?.error;
      return {
        success: false,
        error: apiError?.message ?? 'Invalid credentials',
        code: apiError?.code,
      };
    }
  };

  const signup = async (userData: {
    email: string;
    password: string;
    name: string;
    role: string;
  }) => {
    const normalizedRole = userData.role === 'company' ? 'recruiter' : userData.role;

    if (normalizedRole === UserRole.STUDENT) {
      return {
        success: false,
        error: 'Student signup now requires an institution token from a school or college.',
        code: 'INSTITUTION_TOKEN_REQUIRED',
      };
    }

    try {
      const response = await api.post<ApiSuccessResponse<SignupResponse>>('/api/auth/register', {
        email: userData.email,
        password: userData.password,
        displayName: userData.name,
        role: normalizedRole as UserRole,
      });

      const payload = response.data.data;
      if (!('accessToken' in payload)) {
        return {
          success: false,
          error: payload.message,
          code: 'INSTITUTION_VERIFICATION_PENDING',
        };
      }

      setAuth(payload.user, payload.accessToken);

      return {
        success: true,
        redirectTo: roleHome[payload.user.role] ?? '/dashboard',
      };
    } catch (error) {
      const apiError = (error as { response?: { data?: ApiErrorResponse } })?.response?.data?.error;
      return {
        success: false,
        error: apiError?.message ?? 'Failed to create account. Please try again.',
        code: apiError?.code,
      };
    }
  };

  const logout = async () => {
    try {
      if (accessToken) {
        await api.post(
          '/api/auth/logout',
          {},
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
      }
    } catch (_error) {
      // Clearing local state is enough for logout UX even if the token is already stale.
    } finally {
      disconnectAll();
      clearAuth();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        logout,
        isAuthenticated,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
