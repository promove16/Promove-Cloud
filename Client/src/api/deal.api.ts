import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import {
  CapTableResponse,
  DealCollectionResponse,
  DealDetailView,
  DealFounderDecisionPayload,
  DealGroupView,
  DealTransitionResponse,
  DealUpdateStagePayload,
  StartupInvestorItem,
} from '../types/deal.types';

export const dealApi = {
  async getMyDeals() {
    const response = await api.get<ApiSuccessResponse<DealCollectionResponse>>('/api/deals');
    return response.data.data;
  },
  async getMyDeal(dealId: string) {
    const response = await api.get<ApiSuccessResponse<DealDetailView>>(`/api/deals/${dealId}`);
    return response.data.data;
  },
  async getInvestorDeals() {
    const response = await api.get<ApiSuccessResponse<DealGroupView[]>>('/api/investor/deals');
    return response.data.data;
  },
  async getInvestorDeal(dealId: string) {
    const response = await api.get<ApiSuccessResponse<DealDetailView>>(`/api/investor/deals/${dealId}`);
    return response.data.data;
  },
  async advanceInvestorDealStage(dealId: string, payload: DealUpdateStagePayload) {
    const response = await api.patch<ApiSuccessResponse<DealTransitionResponse>>(
      `/api/investor/deals/${dealId}/stage`,
      payload,
    );
    return response.data.data;
  },
  async fundTransfer(dealId: string, amountINR: number) {
    const response = await api.post<ApiSuccessResponse<DealTransitionResponse>>(`/api/deals/${dealId}/fund-transfer`, {
      amountINR,
    });
    return response.data.data;
  },
  async respondToFounderDecision(dealId: string, payload: DealFounderDecisionPayload) {
    const response = await api.patch<ApiSuccessResponse<DealDetailView>>(
      `/api/deals/${dealId}/founder-decision`,
      payload,
    );
    return response.data.data;
  },
  async getStartupInvestors(startupId: string) {
    const response = await api.get<ApiSuccessResponse<{ items: StartupInvestorItem[] }>>(
      `/api/startups/${startupId}/investors`,
    );
    return response.data.data.items;
  },
  async getCapTable(startupId: string) {
    const response = await api.get<ApiSuccessResponse<CapTableResponse>>(`/api/startups/${startupId}/cap-table`);
    return response.data.data;
  },
};
