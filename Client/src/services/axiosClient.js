import axios from 'axios';
import { store } from '../app/store';
import { clearCredentials, setAccessToken, setCredentials } from '../features/auth/authSlice';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
const nonRefreshableAuthPaths = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
];

const axiosClient = axios.create({
  baseURL,
  withCredentials: true,
});

axiosClient.interceptors.request.use((requestConfig) => {
  const state = store.getState();
  const accessToken = state.auth.accessToken;

  if (accessToken) {
    requestConfig.headers.Authorization = `Bearer ${accessToken}`;
  }

  return requestConfig;
});

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || '';
    const shouldAttemptRefresh = error.response?.status === 401
      && originalRequest
      && !originalRequest._retry
      && !nonRefreshableAuthPaths.includes(requestUrl);

    if (shouldAttemptRefresh) {
      originalRequest._retry = true;

      try {
        const refreshResponse = await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true });
        const { accessToken, user } = refreshResponse.data;

        if (user) {
          store.dispatch(setCredentials({ user, accessToken }));
        } else {
          store.dispatch(setAccessToken(accessToken));
        }

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        store.dispatch(clearCredentials());
        if (typeof window !== 'undefined') {
          window.location.assign('/login');
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
