import { Types } from 'mongoose';
import { UserRole } from '../../types/roles.types';

export type DealStage = 1 | 2 | 3 | 4;
export type DealStatus = 'active' | 'closed' | 'cancelled';
export type InvestorType = 'penny' | 'sole';
export type InvestorRole = 'shareholder' | 'director' | 'observer';

export interface InvestmentAuthority {
  investorRole: InvestorRole;
  votingWeight: number;
  canVeto: boolean;
  canAccessFinancials: boolean;
  canRequestUpdates: boolean;
}

export interface IInvestment extends InvestmentAuthority {
  _id: Types.ObjectId;
  startupId: Types.ObjectId;
  investorId: Types.ObjectId;
  studentId: Types.ObjectId;
  investorType: InvestorType;
  stage: DealStage;
  amountINR: number;
  proposedAmountINR?: number;
  equityPercent: number;
  proposedEquityPercent?: number;
  sharesAllocated: number;
  fundTransferInitiatedAt?: Date;
  adminApprovalRequired: boolean;
  adminApprovedAt?: Date;
  adminApprovedBy?: Types.ObjectId;
  closedAt?: Date;
  innovationScoreSnapshot: number;
  status: DealStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DealParticipantSummary {
  _id: string;
  displayName: string;
  avatar?: string;
  role: UserRole;
  innovationScore: number;
}

export interface DealStartupSummary {
  _id: string;
  name: string;
  tagline: string;
  category: string;
  stage: string;
  pitchDeckUrl?: string;
}

export interface DealSummaryView extends InvestmentAuthority {
  _id: string;
  startupId: string;
  studentId: string;
  investorId: string;
  startupName: string;
  startupCategory: string;
  studentDisplayName: string;
  investorDisplayName: string;
  investorType: InvestorType;
  currentStage: DealStage;
  status: DealStatus;
  amountINR: number;
  equityPercent: number;
  sharesAllocated: number;
  adminApprovalRequired: boolean;
  adminApprovedAt?: string;
  innovationScoreSnapshot: number;
  nextActionLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface DealDetailView extends DealSummaryView {
  startup: DealStartupSummary;
  student: DealParticipantSummary;
  investor: DealParticipantSummary;
  fundTransferInitiatedAt?: string;
  closedAt?: string;
}

export interface DealGroupView {
  stage: DealStage;
  label: string;
  deals: DealSummaryView[];
}

export interface DealPortfolioItem extends InvestmentAuthority {
  _id: string;
  dealId: string;
  startupId: string;
  startupName: string;
  startupCategory: string;
  investorType: InvestorType;
  equityPercent: number;
  sharesAllocated: number;
  currentStage: 4;
  innovationScoreSnapshot: number;
  liveInnovationScore: number;
  scoreTrend: number;
  closedAt?: string;
  studentDisplayName: string;
  studentAvatar?: string;
}

export interface DealTransitionResponse {
  requiresAdminApproval?: true;
  message?: string;
  deal?: DealDetailView;
}

export interface InvestorAuthorityView extends InvestmentAuthority {
  dealId: string;
  startupId: string;
  startupName: string;
  investorType: InvestorType;
  equityPercent: number;
  sharesAllocated: number;
  stage: DealStage;
}

export interface StartupInvestorView extends InvestmentAuthority {
  dealId: string;
  investorId: string;
  name: string;
  investorType: InvestorType;
  equityPercent: number;
  sharesAllocated: number;
  amountINR: number;
  stage: DealStage;
  closedAt?: string;
}

export interface CapTableInvestorRow extends InvestmentAuthority {
  dealId: string;
  investorId?: string;
  name?: string;
  investorType: InvestorType;
  equityPercent: number;
  sharesAllocated: number;
}

export interface CapTableResponse {
  startupId: string;
  totalShares: number;
  availableShares: number;
  visibility: 'full' | 'limited';
  soleInvestor: CapTableInvestorRow | null;
  pennyInvestors: CapTableInvestorRow[];
  founderRetained: {
    equityPercent: number;
    sharesAllocated: number;
  };
  totalInvestorEquity: number;
}

export interface InvestmentTypeAnalytics {
  pennyCount: number;
  soleCount: number;
  pennyCapitalDeployed: number;
  soleCapitalDeployed: number;
}
