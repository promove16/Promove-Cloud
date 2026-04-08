import api from './axiosInstance';
import { ApiSuccessResponse, AuthUser } from '../types/auth.types';

export const authApi = {
  async logout(accessToken?: string) {
    const response = await api.post<ApiSuccessResponse<{ message: string }>>(
      '/api/auth/logout',
      {},
      accessToken
        ? {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        : undefined,
    );

    return response.data.data;
  },

  async submitInstitutionToken(institutionToken: string) {
    const response = await api.post<
      ApiSuccessResponse<{
        message: string;
        user: AuthUser;
      }>
    >('/api/auth/submit-institution-token', {
      institutionToken,
    });

    return response.data.data;
  },

  async changePassword(payload: { currentPassword: string; newPassword: string }) {
    const response = await api.put<ApiSuccessResponse<{ message: string }>>(
      '/api/auth/change-password',
      payload,
    );

    return response.data.data;
  },
};
