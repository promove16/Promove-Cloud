import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
  isAxiosError,
} from "axios";
import { useAuthStore } from "../store/authStore";
import { ApiSuccessResponse, AuthPayload } from "../types/auth.types";
import { buildLoginRedirectPath } from "../utils/authRedirect";

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "/api";

const normalizeApiUrl = (base: string | undefined, url: string | undefined) => {
  if (!base || !url) {
    return url;
  }

  const baseEndsWithApi = /\/api\/?$/.test(base);
  if (!baseEndsWithApi) {
    return url;
  }

  // Avoid /api/api/... when endpoint constants already include /api.
  return url.replace(/^\/api(?=\/|$)/, "");
};

const redirectToLogin = () => {
  if (window.location.pathname !== "/login") {
    const nextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.assign(
      buildLoginRedirectPath({
        message: "session_expired",
        next: nextPath,
        intent: "session_restore",
      }),
    );
  }
};

export const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
});

refreshClient.interceptors.request.use((config) => {
  config.url = normalizeApiUrl(config.baseURL, config.url);
  return config;
});

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true,
});

let refreshPromise: Promise<AuthPayload | null> | null = null;
let refreshBlocked = false;

const isAuthRequest = (url?: string) =>
  Boolean(
    url &&
    (/\/(?:api\/)?auth\/login(?:\?|$)/.test(url) ||
      /\/(?:api\/)?auth\/register(?:\?|$)/.test(url) ||
      /\/(?:api\/)?auth\/refresh(?:\?|$)/.test(url)),
  );

const isRefreshBlocked = () => refreshBlocked && !useAuthStore.getState().accessToken;

export const requestAccessTokenRefresh = async (): Promise<AuthPayload | null> => {
  if (isRefreshBlocked()) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post<ApiSuccessResponse<AuthPayload>>("/api/auth/refresh")
      .then((response) => {
        const payload = response.data.data;
        refreshBlocked = false;
        useAuthStore.getState().setAuth(payload.user, payload.accessToken);
        return payload;
      })
      .catch((refreshError: unknown) => {
        refreshBlocked = true;
        useAuthStore.getState().clearAuth();
        redirectToLogin();

        if (isAxiosError(refreshError) && refreshError.response?.status === 401) {
          return null;
        }

        if (isAxiosError(refreshError)) {
          throw refreshError;
        }

        throw refreshError;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

axiosInstance.interceptors.request.use((config) => {
  config.url = normalizeApiUrl(config.baseURL, config.url);
  const token = useAuthStore.getState().accessToken;

  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    if (!originalRequest || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    if (isAuthRequest(originalRequest.url)) {
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      useAuthStore.getState().clearAuth();
      redirectToLogin();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const payload = await requestAccessTokenRefresh();

    if (!payload?.accessToken) {
      return Promise.reject(error);
    }

    originalRequest.headers.set("Authorization", `Bearer ${payload.accessToken}`);
    return axiosInstance(originalRequest);
  },
);

export default axiosInstance;
