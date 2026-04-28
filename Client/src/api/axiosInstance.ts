import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
  isAxiosError,
} from "axios";
import { toast } from "../app/components/ui/sonner";
import { useAuthStore } from "../store/authStore";
import { ApiErrorResponse, ApiSuccessResponse, AuthPayload } from "../types/auth.types";
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

refreshClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    showServiceUnavailableToast(error as AxiosError<ApiErrorResponse>);
    return Promise.reject(error);
  },
);

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true,
});

let refreshPromise: Promise<AuthPayload | null> | null = null;
let refreshBlocked = false;
const SUPPORT_EMAIL = "charan.f.sde@gmail.com";
const SERVICE_TOAST_DEBOUNCE_MS = 30_000;
const serviceToastLastShownAt = new Map<string, number>();

const isAuthRequest = (url?: string) =>
  Boolean(
    url &&
    (/\/(?:api\/)?auth\/login(?:\?|$)/.test(url) ||
      /\/(?:api\/)?auth\/register(?:\?|$)/.test(url) ||
      /\/(?:api\/)?auth\/refresh(?:\?|$)/.test(url)),
  );

const isRefreshBlocked = () => refreshBlocked && !useAuthStore.getState().accessToken;

const getServiceUnavailableDetails = (error: AxiosError<ApiErrorResponse>) => {
  const apiError = error.response?.data?.error;
  const firstDetail = apiError?.details?.find((detail) => detail.service || detail.serviceName);

  if (!error.response) {
    return {
      serviceName: "API service",
      message: "API service is not reachable right now.",
      supportEmail: SUPPORT_EMAIL,
    };
  }

  if (error.response.status !== 503) {
    return null;
  }

  return {
    serviceName:
      firstDetail?.serviceName ||
      firstDetail?.service ||
      (apiError?.code === "AUTH_SESSION_STORE_UNAVAILABLE"
        ? "Authentication session store"
        : "Application service"),
    message: apiError?.message || "A required service is temporarily unavailable.",
    supportEmail: firstDetail?.supportEmail || SUPPORT_EMAIL,
  };
};

const showServiceUnavailableToast = (error: AxiosError<ApiErrorResponse>) => {
  const details = getServiceUnavailableDetails(error);
  if (!details) {
    return;
  }

  const now = Date.now();
  const toastKey = details.serviceName;
  const lastShownAt = serviceToastLastShownAt.get(toastKey) ?? 0;
  if (now - lastShownAt < SERVICE_TOAST_DEBOUNCE_MS) {
    return;
  }

  serviceToastLastShownAt.set(toastKey, now);
  toast.error(`${details.serviceName} is not working`, {
    id: `service-unavailable:${toastKey}`,
    description: `${details.message} Contact ${details.supportEmail}.`,
    duration: 12_000,
    action: {
      label: "Email support",
      onClick: () => {
        window.location.href = `mailto:${details.supportEmail}?subject=${encodeURIComponent(
          `${details.serviceName} unavailable`,
        )}`;
      },
    },
  });
};

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
    showServiceUnavailableToast(error as AxiosError<ApiErrorResponse>);

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
