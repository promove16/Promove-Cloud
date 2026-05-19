import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';

export interface FundingSnapshot {
  startupId: string;
  fundingGoal?: number;
  currentFunding: number;
  availableEquity: number;
  investorCount: number;
  interestedInvestorCount: number;
  fundingStatus: 'open' | 'partial' | 'fully_funded' | 'closed';
  trendingScore: number;
  lastFundingUpdate?: string;
  percentFunded?: number;
  remaining?: number;
}

export const fundingApi = {
  snapshot: (startupId: string) =>
    api.get<ApiSuccessResponse<FundingSnapshot>>(`/api/startup/${startupId}/funding`),

  recompute: (startupId: string) =>
    api.post<ApiSuccessResponse<FundingSnapshot>>(
      `/api/startup/${startupId}/funding/recompute`,
    ),
};
