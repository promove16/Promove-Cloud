import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';

export interface MentorResourceItem {
  _id: string;
  mentorId: {
    _id: string;
    displayName: string;
    avatar?: string;
    headline?: string;
  };
  title: string;
  description: string;
  type: 'case_study' | 'guide' | 'template';
  fileUrl: string;
  tags: string[];
  downloadCount: number;
  milestonesAwarded: number;
  savedCount: number;
  isCuratedByAdmin: boolean;
  createdAt: string;
}

export const mentorResourceApi = {
  async listResources(params?: { type?: string; tag?: string; curated?: boolean; page?: number }) {
    const res = await api.get<ApiSuccessResponse<{ resources: MentorResourceItem[]; total: number }>>(
      '/api/mentor-resources',
      { params },
    );
    return res.data.data;
  },

  async uploadResource(body: { title: string; description?: string; type: string; fileUrl: string; tags?: string[] }) {
    const res = await api.post<ApiSuccessResponse<MentorResourceItem>>('/api/mentor-resources', body);
    return res.data.data;
  },

  async downloadResource(id: string) {
    const res = await api.post<ApiSuccessResponse<{ fileUrl: string; title: string }>>(
      `/api/mentor-resources/${id}/download`,
    );
    return res.data.data;
  },

  async saveResource(id: string) {
    const res = await api.post<ApiSuccessResponse<{ saved: boolean; savedCount?: number }>>(
      `/api/mentor-resources/${id}/save`,
    );
    return res.data.data;
  },
};
