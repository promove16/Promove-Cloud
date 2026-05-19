import { Types } from 'mongoose';

export const AGREEMENT_STATUSES = [
  'generated',
  'acknowledged_by_investor',
  'acknowledged_by_founder',
  'acknowledged_by_both',
  'voided',
] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

export interface IAgreementTermsSnapshot {
  bidType: 'penny' | 'sole';
  amount: number;
  equity: number;
  investorRole: 'shareholder' | 'director' | 'observer';
  startupName: string;
  founderName: string;
  investorName: string;
}

export interface IAgreement {
  _id: Types.ObjectId;
  bidId: Types.ObjectId;
  startupId: Types.ObjectId;
  investorId: Types.ObjectId;
  founderId: Types.ObjectId;
  dealId?: Types.ObjectId;
  agreementNumber: string;
  status: AgreementStatus;
  terms: IAgreementTermsSnapshot;
  bodyText: string;
  acknowledgedByInvestorAt?: Date;
  acknowledgedByFounderAt?: Date;
  voidedAt?: Date;
  voidReason?: string;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
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
  terms: IAgreementTermsSnapshot;
  bodyText: string;
  acknowledgedByInvestorAt?: string;
  acknowledgedByFounderAt?: string;
  voidedAt?: string;
  voidReason?: string;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}
