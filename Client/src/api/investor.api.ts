import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import { DealDetailView, InvestorAuthorityItem } from '../types/deal.types';
import {
  InvestorDashboardStats,
  InvestorInstitutionCard,
  InvestorPortfolioResponse,
  InvestorStartupDetailResponse,
  InvestorStartupListResponse,
} from '../types/investor.types';

export const investorApi = {
  async getDashboard() {
    const response = await api.get<ApiSuccessResponse<InvestorDashboardStats>>('/api/investor/dashboard');
    return response.data.data;
  },
  async getStartups(params?: {
    minScore?: number;
    maxScore?: number;
    category?: string;
    stage?: string;
    page?: number;
    limit?: number;
    acceptingPenny?: boolean;
    acceptingSole?: boolean;
  }) {
    const response = await api.get<ApiSuccessResponse<InvestorStartupListResponse>>('/api/investor/startups', {
      params,
    });
    return response.data.data;
  },
  async getStartup(startupId: string) {
    const response = await api.get<ApiSuccessResponse<InvestorStartupDetailResponse>>(
      `/api/investor/startups/${startupId}`,
    );
    return response.data.data;
  },
  async expressInterest(
    startupId: string,
    payload: {
      investorType: 'penny' | 'sole';
      proposedAmountINR: number;
      proposedEquityPercent: number;
      chosenRole?: 'shareholder' | 'director' | 'observer';
    },
  ) {
    const response = await api.post<ApiSuccessResponse<DealDetailView>>(
      `/api/investor/express-interest/${startupId}`,
      payload,
    );
    return response.data.data;
  },
  async expressSoleInterest(
    startupId: string,
    payload: {
      investorType: 'penny' | 'sole';
      proposedAmountINR: number;
      proposedEquityPercent: number;
      chosenRole?: 'shareholder' | 'director' | 'observer';
    },
  ) {
    const response = await api.post<ApiSuccessResponse<DealDetailView>>(
      `/api/startups/${startupId}/sole-investor`,
      { ...payload, investorType: 'sole' },
    );
    return response.data.data;
  },
  async getInstitutions(type: 'school' | 'college') {
    const response = await api.get<ApiSuccessResponse<InvestorInstitutionCard[]>>('/api/investor/institutions', {
      params: { type },
    });
    return response.data.data;
  },
  async getPortfolio() {
    const response = await api.get<ApiSuccessResponse<InvestorPortfolioResponse>>('/api/investor/portfolio');
    return response.data.data;
  },
  async getAuthorityPortfolio() {
    const response = await api.get<ApiSuccessResponse<{ items: InvestorAuthorityItem[] }>>(
      '/api/investor/portfolio/authority',
    );
    return response.data.data.items;
  },
};
