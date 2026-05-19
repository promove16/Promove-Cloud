import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';

export interface CounterOfferEntryView {
  _id?: string;
  by: 'founder' | 'investor';
  actorId: string;
  actorName?: string;
  actorAvatar?: string;
  amount: number;
  equity: number;
  message?: string;
  at: string;
}

export interface BidDetailView {
  _id: string;
  startupId: string;
  startupName: string;
  startupTagline: string;
  startupCategory: string;
  investorId: string;
  investorName: string;
  investorAvatar?: string;
  investorInnovationScore: number;
  founderId: string;
  founderName: string;
  status: 'pending' | 'viewed' | 'negotiating' | 'countered' | 'accepted' | 'rejected' | 'expired' | 'closed';
  bidType: 'penny' | 'sole';
  proposedAmount: number;
  proposedEquity: number;
  counterAmount?: number;
  counterEquity?: number;
  finalAmount?: number;
  finalEquity?: number;
  coverLetter?: string;
  investorRole: string;
  expiresAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  isRead: boolean;
  dealId?: string;
  counterOfferHistory: CounterOfferEntryView[];
  createdAt: string;
  updatedAt: string;
}

export interface BidListResponse {
  items: BidDetailView[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BidFilters {
  status?: string;
  bidType?: string;
  sortBy?: string;
  page?: number;
  limit?: number;
}

const buildQuery = (filters?: BidFilters): string => {
  if (!filters) return '';
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.bidType) params.set('bidType', filters.bidType);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

export const biddingApi = {
  placeBid: (startupId: string, data: {
    bidType: 'penny' | 'sole';
    proposedAmount: number;
    proposedEquity: number;
    coverLetter?: string;
    investorRole?: string;
  }) => api.post<ApiSuccessResponse<BidDetailView>>(`/api/bids/startup/${startupId}`, data),

  getFounderBids: (filters?: BidFilters) =>
    api.get<ApiSuccessResponse<BidListResponse>>(`/api/bids/founder${buildQuery(filters)}`),

  getInvestorBids: (filters?: BidFilters) =>
    api.get<ApiSuccessResponse<BidListResponse>>(`/api/bids/investor${buildQuery(filters)}`),

  getStartupBids: (startupId: string) =>
    api.get<ApiSuccessResponse<{ items: BidDetailView[] }>>(`/api/bids/startup/${startupId}`),

  getBid: (bidId: string) =>
    api.get<ApiSuccessResponse<BidDetailView>>(`/api/bids/${bidId}`),

  markViewed: (bidId: string) =>
    api.patch<ApiSuccessResponse<BidDetailView>>(`/api/bids/${bidId}/view`),

  counterBid: (bidId: string, data: { counterAmount: number; counterEquity: number; message?: string }) =>
    api.post<ApiSuccessResponse<BidDetailView>>(`/api/bids/${bidId}/counter`, data),

  respondToBid: (bidId: string, data: { decision: 'accepted' | 'rejected'; rejectionReason?: string }) =>
    api.patch<ApiSuccessResponse<BidDetailView>>(`/api/bids/${bidId}/respond`, data),
};
