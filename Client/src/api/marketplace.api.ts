import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import { UserRole } from '../types/roles.types';

export type MarketplaceRole = 'mentor' | 'investor' | 'recruiter';

export interface MarketplaceProfile {
  _id: string;
  displayName: string;
  avatar?: string;
  role: UserRole;
  domain?: string;
  bio?: string;
}

export const marketplaceApi = {
  async list(role: MarketplaceRole, params?: { domain?: string; page?: number; limit?: number }) {
    const response = await api.get<ApiSuccessResponse<MarketplaceProfile[]>>('/api/marketplace', {
      params: { role, ...params },
    });
    return response.data.data;
  },
  async getProfile(userId: string) {
    const response = await api.get<ApiSuccessResponse<MarketplaceProfile>>(`/api/marketplace/${userId}`);
    return response.data.data;
  },
};
