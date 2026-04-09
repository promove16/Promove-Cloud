import { PropsWithChildren, ReactElement, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import axios, { isAxiosError } from "axios";
import api, { requestAccessTokenRefresh } from "../../api/axiosInstance";
import { authApi } from "../../api/auth.api";
import { useAuthStore } from "../../store/authStore";
import {
  ApiErrorResponse,
  ApiSuccessResponse,
  AuthPayload,
  LoginInput,
  SignupInput,
  SignupResponse,
} from "../../types/auth.types";
import { UserRole } from "../../types/roles.types";

const parseError = (error: unknown) => {
  if (isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.error;
  }

  return undefined;
};

let bootstrapPromise: Promise<AuthPayload | null> | null = null;

export const useLoginMutation = () => {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: async (payload: LoginInput) => {
      const response = await api.post<ApiSuccessResponse<AuthPayload>>(
        "/api/auth/login",
        payload,
      );
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
      const endpoint =
        payload.role === UserRole.STUDENT
          ? "/api/auth/register"
          : "/api/auth/register-request";
      const response = await api.post<ApiSuccessResponse<SignupResponse>>(
        endpoint,
        {
          ...payload,
          role: payload.role,
        },
      );
      return response.data.data;
    },
    onSuccess: (payload) => {
      if ("accessToken" in payload) {
        setAuth(payload.user, payload.accessToken);
      }
    },
    meta: {
      parseError,
    },
  });
};

export const useRegisterRequestMutation = () => {
  return useMutation({
    mutationFn: async (
      payload: Omit<SignupInput, "institutionToken"> | FormData,
    ) => {
      const response = await api.post<ApiSuccessResponse<SignupResponse>>(
        "/api/auth/register-request",
        payload,
      );
      return response.data.data;
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
        await authApi.logout(accessToken);
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
  const persistedUserId = useAuthStore((state) => state.user?._id ?? null);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      setLoading(true);

      if (!persistedUserId) {
        clearAuth();
        setLoading(false);
        return;
      }

      try {
        if (!bootstrapPromise) {
          bootstrapPromise = requestAccessTokenRefresh().finally(() => {
            bootstrapPromise = null;
          });
        }

        const payload = await bootstrapPromise;

        if (!active) {
          return;
        }

        if (payload) {
          setAuth(payload.user, payload.accessToken);
        } else {
          clearAuth();
        }
      } catch (_error) {
        if (active) {
          clearAuth();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [clearAuth, persistedUserId, setAuth, setLoading]);
};

export function AuthBootstrap({ children }: PropsWithChildren) {
  useBootstrapAuth();
  return children as ReactElement;
}
