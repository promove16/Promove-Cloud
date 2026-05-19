import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';

export interface FounderAnalytics {
  totalStartups: number;
  totalBids: number;
  pendingBids: number;
  acceptedBids: number;
  rejectedBids: number;
  totalInvestmentAmount: number;
  totalEquityGiven: number;
  investorCount: number;
  soleInvestorCount: number;
  pennyInvestorCount: number;
  bidsOverTime: Array<{ date: string; count: number }>;
  topInvestors: Array<{ investorId: string; name: string; amount: number; equity: number }>;
}

export interface InvestorAnalytics {
  totalBids: number;
  activeBids: number;
  acceptedBids: number;
  rejectedBids: number;
  totalInvested: number;
  totalEquityHeld: number;
  portfolioSize: number;
  avgDealSize: number;
  bidsByStatus: Array<{ status: string; count: number }>;
}

export interface AdminPlatformAnalytics {
  totalUsers: number;
  usersByRole: Array<{ role: string; count: number }>;
  totalStartups: number;
  startupsByStatus: Array<{ status: string; count: number }>;
  totalBids: number;
  bidsByStatus: Array<{ status: string; count: number }>;
  totalDeals: number;
  dealsByStage: Array<{ stage: number; count: number }>;
  totalInvestmentVolume: number;
  activeInvestors: number;
  pendingVerifications: number;
  recentActivity: Array<Record<string, unknown>>;
  fraudFlags: number;
}

export interface StartupAnalytics {
  totalBids: number;
  pendingBids: number;
  negotiatingBids: number;
  acceptedBids: number;
  rejectedBids: number;
  soleBids: number;
  pennyBids: number;
  totalProposedAmount: number;
  highestBid: number;
  averageBidAmount: number;
  investorEngagement: number;
  bidsTimeline: Array<{ date: string; count: number }>;
}

export interface PlatformVerificationStats {
  startups: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    approvalRate: number;
  };
  investors: {
    total: number;
    verified: number;
    pending: number;
    verificationRate: number;
  };
  activity: {
    totalBids: number;
    totalDeals: number;
  };
}

export const analyticsApi = {
  getFounderAnalytics: () =>
    api.get<ApiSuccessResponse<FounderAnalytics>>('/api/analytics/founder'),

  getFounderStartupAnalytics: (startupId: string) =>
    api.get<ApiSuccessResponse<StartupAnalytics>>(`/api/analytics/founder/startup/${startupId}`),

  getInvestorAnalytics: () =>
    api.get<ApiSuccessResponse<InvestorAnalytics>>('/api/analytics/investor'),

  getAdminAnalytics: () =>
    api.get<ApiSuccessResponse<AdminPlatformAnalytics>>('/api/analytics/admin'),

  getVerificationStats: () =>
    api.get<ApiSuccessResponse<PlatformVerificationStats>>('/api/verification/stats'),
};
