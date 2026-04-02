import api from './axiosInstance';
import { ApiSuccessResponse, AuthUser } from '../types/auth.types';

export const authApi = {
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
};
