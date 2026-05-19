import { Types } from 'mongoose';

export const INTEREST_STATUSES = ['active', 'withdrawn'] as const;
export type InterestStatus = (typeof INTEREST_STATUSES)[number];

export interface IInterest {
  _id: Types.ObjectId;
  startupId: Types.ObjectId;
  investorId: Types.ObjectId;
  founderId: Types.ObjectId;
  status: InterestStatus;
  message?: string;
  withdrawnAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterestView {
  _id: string;
  startupId: string;
  startupName: string;
  startupTagline: string;
  startupCategory: string;
  investorId: string;
  investorName: string;
  investorAvatar?: string;
  founderId: string;
  status: InterestStatus;
  message?: string;
  createdAt: string;
  updatedAt: string;
  withdrawnAt?: string;
}

export interface StartupInterestSummary {
  interestedCount: number;
  isInterested: boolean;
  interestId?: string;
  interestedAt?: string;
}
