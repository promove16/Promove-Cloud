import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';

export interface InterestView {
  _id: string;
  startupId: string;
  startupName: string;
  startupTagline: string;
  startupCategory: string;
  investorId: string;
  investorName: string;
  investorAvatar?: string;
  founderId: string;
  status: 'active' | 'withdrawn';
  message?: string;
  createdAt: string;
  updatedAt: string;
  withdrawnAt?: string;
}

export interface StartupInterestSummary {
  interestedCount: number;
  isInterested: boolean;
  interestId?: string;
  interestedAt?: string;
}

export const interestApi = {
  express: (startupId: string, data?: { message?: string }) =>
    api.post<ApiSuccessResponse<InterestView>>(`/api/interests/startup/${startupId}`, data ?? {}),

  withdraw: (startupId: string) =>
    api.delete<ApiSuccessResponse<InterestView>>(`/api/interests/startup/${startupId}`),

  mine: () =>
    api.get<ApiSuccessResponse<{ items: InterestView[] }>>(`/api/interests/me`),

  summary: (startupId: string) =>
    api.get<ApiSuccessResponse<StartupInterestSummary>>(
      `/api/interests/startup/${startupId}/summary`,
    ),

  investorsForStartup: (startupId: string) =>
    api.get<ApiSuccessResponse<{ items: InterestView[] }>>(
      `/api/interests/startup/${startupId}/investors`,
    ),
};
