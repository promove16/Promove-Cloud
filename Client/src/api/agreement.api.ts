import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';

export type AgreementStatus =
  | 'generated'
  | 'acknowledged_by_investor'
  | 'acknowledged_by_founder'
  | 'acknowledged_by_both'
  | 'voided';

export interface AgreementTerms {
  bidType: 'penny' | 'sole';
  amount: number;
  equity: number;
  investorRole: 'shareholder' | 'director' | 'observer';
  startupName: string;
  founderName: string;
  investorName: string;
}

export interface AgreementView {
  _id: string;
  bidId: string;
  startupId: string;
  investorId: string;
  founderId: string;
  dealId?: string;
  agreementNumber: string;
  status: AgreementStatus;
  terms: AgreementTerms;
  bodyText: string;
  acknowledgedByInvestorAt?: string;
  acknowledgedByFounderAt?: string;
  voidedAt?: string;
  voidReason?: string;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export const agreementApi = {
  list: () =>
    api.get<ApiSuccessResponse<{ items: AgreementView[] }>>(`/api/agreements/me`),

  get: (agreementId: string) =>
    api.get<ApiSuccessResponse<AgreementView>>(`/api/agreements/${agreementId}`),

  getByBid: (bidId: string) =>
    api.get<ApiSuccessResponse<AgreementView | null>>(`/api/agreements/bid/${bidId}`),

  acknowledge: (agreementId: string) =>
    api.post<ApiSuccessResponse<AgreementView>>(`/api/agreements/${agreementId}/acknowledge`),
};
