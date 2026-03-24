import { PropsWithChildren, ReactElement, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios, { isAxiosError } from 'axios';
import api, { refreshClient } from '../../api/axiosInstance';
import { useAuthStore } from '../../store/authStore';
import {
  ApiErrorResponse,
  ApiSuccessResponse,
  AuthPayload,
  LoginInput,
  SignupInput,
} from '../../types/auth.types';

const parseError = (error: unknown) => {
  if (isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.error;
  }

  return undefined;
};

export const useLoginMutation = () => {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: async (payload: LoginInput) => {
      const response = await api.post<ApiSuccessResponse<AuthPayload>>('/api/auth/login', payload);
      return response.data.data;
    },
    onSuccess: (payload) => {
      setAuth(payload.user, payload.accessToken);
    },
    meta: {
      parseError,
    },
  });
};

export const useSignupMutation = () => {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: async (payload: SignupInput) => {
      const response = await api.post<ApiSuccessResponse<AuthPayload>>('/api/auth/register', payload);
      return response.data.data;
    },
    onSuccess: (payload) => {
      setAuth(payload.user, payload.accessToken);
    },
    meta: {
      parseError,
    },
  });
};

export const useLogoutMutation = () => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  return useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        return;
      }

      try {
        await api.post(
          '/api/auth/logout',
          {},
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 401) {
          return;
        }

        throw error;
      }
    },
    onSettled: () => {
      clearAuth();
    },
  });
};

export const useBootstrapAuth = () => {
  const hasBootstrapped = useRef(false);
  const persistedUser = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    if (hasBootstrapped.current) {
      return;
    }

    hasBootstrapped.current = true;
    let cancelled = false;

    const bootstrap = async () => {
      setLoading(true);

      if (!persistedUser) {
        clearAuth();
        setLoading(false);
        return;
      }

      try {
        const response = await refreshClient.post<ApiSuccessResponse<AuthPayload>>('/api/auth/refresh');

        if (!cancelled) {
          setAuth(response.data.data.user, response.data.data.accessToken);
        }
      } catch (error) {
        if (!cancelled) {
          if (axios.isAxiosError(error) && error.response?.status !== 401) {
            clearAuth();
          } else {
            clearAuth();
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [clearAuth, persistedUser, setAuth, setLoading]);
};

export function AuthBootstrap({ children }: PropsWithChildren) {
  useBootstrapAuth();
  return children as ReactElement;
}
