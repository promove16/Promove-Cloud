import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';

export interface VerificationStats {
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

export interface FraudFlagResult {
  flagged: boolean;
  flags: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    evidence?: string[];
  }>;
}

export const verificationApi = {
  verifyInvestor: (investorId: string, decision: 'verified' | 'rejected', notes?: string) =>
    api.post<ApiSuccessResponse<{ investorId: string; status: string }>>(`/api/verification/investor/${investorId}`, { decision, notes }),

  verifyStartup: (startupId: string, decision: 'approved' | 'rejected', adminNotes?: string) =>
    api.post<ApiSuccessResponse<{ startupId: string; status: string }>>(`/api/verification/startup/${startupId}`, { decision, adminNotes }),

  runFraudCheck: (startupId: string) =>
    api.get<ApiSuccessResponse<FraudFlagResult>>(`/api/verification/fraud-check/${startupId}`),

  flagFraud: (startupId: string, severity: 'low' | 'medium' | 'high' | 'critical', description: string) =>
    api.post<ApiSuccessResponse<{ startupId: string; flag: unknown }>>(`/api/verification/fraud-check/${startupId}/flag`, { severity, description }),

  clearFraudFlag: (startupId: string, flagType: string, note?: string) =>
    api.post<ApiSuccessResponse<{ cleared: boolean }>>(`/api/verification/fraud-check/${startupId}/clear`, { flagType, note }),

  getStats: () =>
    api.get<ApiSuccessResponse<VerificationStats>>('/api/verification/stats'),
};
