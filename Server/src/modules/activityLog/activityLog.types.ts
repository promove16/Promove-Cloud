import { Types } from 'mongoose';

export const ACTIVITY_ACTIONS = [
  'INTEREST_EXPRESSED',
  'INTEREST_WITHDRAWN',
  'BID_PLACED',
  'BID_VIEWED',
  'BID_COUNTERED',
  'BID_ACCEPTED',
  'BID_REJECTED',
  'BID_EXPIRED',
  'BID_CLOSED',
  'DEAL_CREATED',
  'DEAL_STAGE_CHANGED',
  'DEAL_NEGOTIATION_STARTED',
  'DEAL_TERMS_AGREED',
  'DEAL_FUND_TRANSFERRED',
  'DEAL_EQUITY_TRANSFERRED',
  'DEAL_CLOSED',
  'DEAL_CANCELLED',
  'STARTUP_VERIFIED',
  'STARTUP_REJECTED',
  'INVESTOR_VERIFIED',
  'INVESTOR_REJECTED',
  'FRAUD_FLAG_RAISED',
  'FRAUD_FLAG_CLEARED',
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export interface IActivityLog {
  _id: Types.ObjectId;
  actorId: Types.ObjectId;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}
