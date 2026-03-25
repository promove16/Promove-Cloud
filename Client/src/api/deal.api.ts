import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import {
  DealCollectionResponse,
  DealDetailView,
  DealGroupView,
  DealTransitionResponse,
  DealUpdateStagePayload,
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
};

