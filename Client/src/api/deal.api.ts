import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import {
  CapTableResponse,
  DealCollectionResponse,
  DealCancelPayload,
  DealDetailView,
  DealFounderDecisionPayload,
  DealGroupView,
  DealTransitionResponse,
  DealUpdateStagePayload,
  PlaceBidPayload,
  StartupBidBoardResponse,
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
  async requestPaymentApproval(dealId: string) {
    const response = await api.post<ApiSuccessResponse<DealDetailView>>(
      `/api/deals/${dealId}/request-payment-approval`,
    );
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
  async linkWorkshopToDeal(dealId: string, workspaceId: string) {
    const response = await api.patch<ApiSuccessResponse<{ message: string; workspaceId: string; workspaceTitle: string }>>(
      `/api/deals/${dealId}/link-workshop`,
      { workspaceId },
    );
    return response.data.data;
  },
  async unlinkWorkshopFromDeal(dealId: string) {
    const response = await api.patch<ApiSuccessResponse<{ message: string }>>(
      `/api/deals/${dealId}/unlink-workshop`,
    );
    return response.data.data;
  },
  async sendNegotiationMessage(dealId: string, message: string) {
    const response = await api.post<ApiSuccessResponse<any>>(
      `/api/deals/${dealId}/negotiation-message`,
      { message },
    );
    return response.data.data;
  },
  async proposeNegotiationTerms(dealId: string, payload: { amountINR: number; equityPercent: number }) {
    const response = await api.post<ApiSuccessResponse<any>>(
      `/api/deals/${dealId}/negotiation-propose`,
      payload,
    );
    return response.data.data;
  },
  async agreeNegotiationTerms(dealId: string) {
    const response = await api.post<ApiSuccessResponse<any>>(
      `/api/deals/${dealId}/negotiation-agree`,
    );
    return response.data.data;
  },
  async cancelDeal(dealId: string, payload: DealCancelPayload = {}) {
    const response = await api.post<ApiSuccessResponse<DealDetailView>>(
      `/api/deals/${dealId}/cancel`,
      payload,
    );
    return response.data.data;
  },
  async counterOfferNegotiationTerms(dealId: string, payload: { amountINR: number; equityPercent: number }) {
    const response = await api.post<ApiSuccessResponse<any>>(
      `/api/deals/${dealId}/negotiation-propose`,
      payload,
    );
    return response.data.data;
  },
  async getStartupBidBoard(startupId: string) {
    const response = await api.get<ApiSuccessResponse<StartupBidBoardResponse>>(
      `/api/startups/${startupId}/bids`,
    );
    return response.data.data;
  },
  async placeBid(startupId: string, payload: PlaceBidPayload) {
    const response = await api.post<ApiSuccessResponse<DealDetailView>>(
      `/api/startups/${startupId}/bid`,
      payload,
    );
    return response.data.data;
  },
};
