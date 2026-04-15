import { Types } from 'mongoose';
import { UserRole } from '../../types/roles.types';

export type DealStage = 0 | 1 | 2 | 3 | 4;
export type DealStatus = 'active' | 'closed' | 'cancelled';
export type InvestorType = 'penny' | 'sole';
export type InvestorRole = 'shareholder' | 'director' | 'observer';
export type DealRequestOrigin = 'investor' | 'student';
export type DealMediationStatus = 'intake' | 'under_review' | 'approved' | 'rejected';
export type StockTransferStatus = 'not_started' | 'pending_review' | 'under_review' | 'approved' | 'rejected';
export type RoyaltyStatus = 'pending' | 'invoiced' | 'received';
export type FounderDecisionStatus = 'pending' | 'accepted' | 'rejected';
export type NegotiationStatus = 'initial' | 'terms_proposed' | 'counter_offer' | 'terms_agreed' | 'stalled' | 'cancelled';

export interface DealNegotiation {
  status: NegotiationStatus;
  investorProposedAmount?: number;
  investorProposedEquity?: number;
  studentCounterAmount?: number;
  studentCounterEquity?: number;
  finalAgreedAmount?: number;
  finalAgreedEquity?: number;
  messages: Array<{
    _id?: Types.ObjectId;
    id?: string;
    senderId: Types.ObjectId;
    senderRole: 'investor' | 'student';
    message: string;
    timestamp?: Date;
    createdAt?: Date;
    updatedAt?: Date;
    attachments?: string[];
  }>;
  lastUpdatedAt?: Date;
  termsAgreedAt?: Date;
  notes?: string;
}

export interface DealStockDetails {
  shareClassLabel: string;
  sharePriceInr: number;
  transferValueInr: number;
  totalSharesConsidered: number;
}

export interface DealStockTransfer {
  status: StockTransferStatus;
  requestedAt?: Date;
  requestedByRole?: DealRequestOrigin | 'admin';
  requestSummary?: string;
  reviewNotes?: string;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
}

export interface DealRoyalty {
  promovePercentage: number;
  promoveAmountINR: number;
  status: RoyaltyStatus;
  settledAt?: Date;
}

export interface DealFounderDecision {
  status: FounderDecisionStatus;
  respondedAt?: Date;
  respondedBy?: Types.ObjectId;
  note?: string;
}

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
  mediatorLabel: string;
  requestOrigin: DealRequestOrigin;
  mediationStatus: DealMediationStatus;
  investorType: InvestorType;
  stage: DealStage;
  negotiation: DealNegotiation;
  amountINR: number;
  proposedAmountINR?: number;
  equityPercent: number;
  proposedEquityPercent?: number;
  sharesAllocated: number;
  coverLetter?: string;
  stockDetails: DealStockDetails;
  stockTransfer: DealStockTransfer;
  royalty: DealRoyalty;
  founderDecision: DealFounderDecision;
  fundTransferInitiatedAt?: Date;
  adminApprovalRequired: boolean;
  adminApprovedAt?: Date;
  adminApprovedBy?: Types.ObjectId;
  closedAt?: Date;
  linkedWorkspaceId?: Types.ObjectId;
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

export interface DealProductWorkshopSummary {
  workspaceId: string;
  title: string;
  category: string;
  stage: string;
  progressPercent: number;
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
  mediatorLabel: string;
  requestOrigin: DealRequestOrigin;
  mediationStatus: DealMediationStatus;
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
  stockDetails: {
    shareClassLabel: string;
    sharePriceInr: number;
    transferValueInr: number;
    totalSharesConsidered: number;
  };
  stockTransfer: {
    status: StockTransferStatus;
    requestedAt?: string;
    requestedByRole?: DealRequestOrigin | 'admin';
    requestSummary?: string;
    reviewNotes?: string;
    reviewedAt?: string;
    reviewedBy?: string;
  };
  royalty: {
    promovePercentage: number;
    promoveAmountINR: number;
    status: RoyaltyStatus;
    settledAt?: string;
  };
  founderDecision: {
    status: FounderDecisionStatus;
    respondedAt?: string;
    respondedBy?: string;
    note?: string;
  };
  negotiation?: {
    status: NegotiationStatus;
    investorProposedAmount?: number;
    investorProposedEquity?: number;
    studentCounterAmount?: number;
    studentCounterEquity?: number;
    finalAgreedAmount?: number;
    finalAgreedEquity?: number;
    messages: Array<{
      _id: string;
      senderId: string;
      senderRole: 'investor' | 'student';
      message: string;
      timestamp: string;
      attachments?: string[];
    }>;
    lastUpdatedAt?: string;
    termsAgreedAt?: string;
    notes?: string;
  };
  innovationScoreSnapshot: number;
  nextActionLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface DealDetailView extends DealSummaryView {
  startup: DealStartupSummary;
  student: DealParticipantSummary;
  investor: DealParticipantSummary;
  productWorkshop?: DealProductWorkshopSummary;
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
  productWorkshop?: DealProductWorkshopSummary;
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

export interface BidBoardContributor {
  bidId: string;
  investorId: string;
  name: string;
  avatar?: string;
  innovationScore: number;
  amountINR: number;
  equityPercent: number;
  placedAt: string;
  isCurrentUser: boolean;
}

export interface BidBoardSoleBid {
  bidId: string;
  investorId: string;
  name: string;
  avatar?: string;
  innovationScore: number;
  amountINR: number;
  equityPercent: number;
  coverLetter?: string;
  role: InvestorRole;
  founderDecisionStatus: FounderDecisionStatus;
  isCurrentUser: boolean;
  placedAt: string;
}

export interface StartupBidBoardResponse {
  startupId: string;
  startupName: string;
  startupTagline: string;
  fundingTarget?: number;
  acceptsPennyInvestors: boolean;
  acceptsSoleInvestor: boolean;
  pennyPool: {
    totalRaised: number;
    investorCount: number;
    maxInvestors: number;
    contributors: BidBoardContributor[];
  };
  soleBids: BidBoardSoleBid[];
  hasSoleInvestorAccepted: boolean;
  currentUserBid?: {
    bidId: string;
    investorType: InvestorType;
    status: FounderDecisionStatus;
  };
}
