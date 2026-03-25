import { Types } from 'mongoose';
import { UserRole } from '../../types/roles.types';

export type DealStage = 1 | 2 | 3 | 4;
export type DealStatus = 'active' | 'closed' | 'cancelled';
export type InvestorRole = 'Shareholder' | 'Director' | 'Co-Founder';

export interface IDeal {
  _id: Types.ObjectId;
  investorId: Types.ObjectId;
  startupId: Types.ObjectId;
  studentId: Types.ObjectId;
  stage: DealStage;
  amountINR?: number;
  fundTransferInitiatedAt?: Date;
  equityPercent?: number;
  investorRole?: InvestorRole;
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

export interface DealSummaryView {
  _id: string;
  startupId: string;
  studentId: string;
  investorId: string;
  startupName: string;
  startupCategory: string;
  studentDisplayName: string;
  investorDisplayName: string;
  currentStage: DealStage;
  status: DealStatus;
  amountINR?: number;
  equityPercent?: number;
  investorRole?: InvestorRole;
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

export interface DealPortfolioItem {
  _id: string;
  dealId: string;
  startupId: string;
  startupName: string;
  startupCategory: string;
  investorRole?: InvestorRole;
  equityPercent?: number;
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
