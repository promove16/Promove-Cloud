import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';

export type BadgeId =
  | 'early_supporter'
  | 'top_investor'
  | 'trend_spotter'
  | 'most_funded'
  | 'fast_growing'
  | 'investor_favorite';

export interface Badge {
  id: BadgeId;
  label: string;
  description: string;
  earnedAt?: string;
}

export interface InvestorReputationData {
  kind: 'investor';
  userId: string;
  totalInterests: number;
  totalActiveBids: number;
  totalAcceptedBids: number;
  totalCommittedAmount: number;
  acceptanceRate: number;
  averageResponseHours: number | null;
  badges: Badge[];
}

export interface FounderReputationData {
  kind: 'founder';
  userId: string;
  totalStartups: number;
  totalAcceptedBids: number;
  totalFundedAmount: number;
  totalInterestedInvestors: number;
  badges: Badge[];
}

export type ReputationData = InvestorReputationData | FounderReputationData;

export const reputationApi = {
  me: () => api.get<ApiSuccessResponse<ReputationData>>(`/api/reputation/me`),
  forUser: (userId: string) =>
    api.get<ApiSuccessResponse<ReputationData>>(`/api/reputation/${userId}`),
};
