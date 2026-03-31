import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';

export type ReportReason = 'harassment' | 'spam' | 'inappropriate_content' | 'fake_profile' | 'privacy_violation' | 'other';

export interface UserReport {
  _id: string;
  reporterId: string;
  reportedUserId: string;
  reason: ReportReason;
  description: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: string;
  updatedAt: string;
}

export const reportApi = {
  async createReport(payload: {
    reportedUserId: string;
    reason: ReportReason;
    description?: string;
  }) {
    const response = await api.post<ApiSuccessResponse<UserReport>>('/api/report', payload);
    return response.data.data;
  },
  async getMyReports() {
    const response = await api.get<ApiSuccessResponse<UserReport[]>>('/api/report');
    return response.data.data;
  },
};
