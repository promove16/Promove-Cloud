import { Types } from 'mongoose';
import { UserRole } from '../../types/roles.types';

export const BIDDING_EXPIRY_DAYS = 30;
export const BIDDING_SOLE_AUTO_CLOSE_DAYS = 45;

export const BID_STATUSES = [
  'pending',
  'viewed',
  'negotiating',
  'countered',
  'accepted',
  'rejected',
  'expired',
  'closed',
] as const;

export type BidStatus = (typeof BID_STATUSES)[number];

export const BID_TYPES = ['penny', 'sole'] as const;
export type BidType = (typeof BID_TYPES)[number];

export type CounterOfferActor = 'founder' | 'investor';

export interface ICounterOfferEntry {
  _id?: Types.ObjectId;
  by: CounterOfferActor;
  actorId: Types.ObjectId;
  amount: number;
  equity: number;
  message?: string;
  at: Date;
}

export interface IBid {
  _id: Types.ObjectId;
  startupId: Types.ObjectId;
  investorId: Types.ObjectId;
  founderId: Types.ObjectId;
  status: BidStatus;
  bidType: BidType;
  proposedAmount: number;
  proposedEquity: number;
  counterAmount?: number;
  counterEquity?: number;
  finalAmount?: number;
  finalEquity?: number;
  coverLetter?: string;
  investorRole: 'shareholder' | 'director' | 'observer';
  counterOfferHistory: ICounterOfferEntry[];
  expiresAt?: Date;
  viewedAt?: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  expiredAt?: Date;
  closedAt?: Date;
  rejectionReason?: string;
  isRead: boolean;
  dealId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface CounterOfferEntryView {
  _id?: string;
  by: CounterOfferActor;
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
  status: BidStatus;
  bidType: BidType;
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

export interface BidListFilters {
  status?: BidStatus;
  bidType?: BidType;
  sortBy?: 'newest' | 'oldest' | 'amount_high' | 'amount_low';
  page?: number;
  limit?: number;
}

export interface BidListResponse {
  items: BidDetailView[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
