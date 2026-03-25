import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
  isAxiosError,
} from 'axios';
import { useAuthStore } from '../store/authStore';
import { ApiSuccessResponse, AuthPayload } from '../types/auth.types';

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api';

const redirectToLogin = () => {
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
};

export const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
});

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true,
});

let refreshPromise: Promise<string | null> | null = null;

const isAuthRequest = (url?: string) =>
  Boolean(
    url &&
      (url.includes('/api/auth/login') ||
        url.includes('/api/auth/register') ||
        url.includes('/api/auth/refresh')),
  );

axiosInstance.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
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

    if (!refreshPromise) {
      refreshPromise = refreshClient
        .post<ApiSuccessResponse<AuthPayload>>('/auth/refresh')
        .then((response) => {
          const payload = response.data.data;
          useAuthStore.getState().setAuth(payload.user, payload.accessToken);
          return payload.accessToken;
        })
        .catch((refreshError: unknown) => {
          useAuthStore.getState().clearAuth();
          redirectToLogin();

          if (isAxiosError(refreshError)) {
            throw refreshError;
          }

          throw error;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    const refreshedToken = await refreshPromise;

    if (!refreshedToken) {
      return Promise.reject(error);
    }

    originalRequest.headers.set('Authorization', `Bearer ${refreshedToken}`);
    return axiosInstance(originalRequest);
  },
);

export default axiosInstance;
