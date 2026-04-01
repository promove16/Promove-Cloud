export type DealStage = 1 | 2 | 3 | 4;
export type DealStatus = 'active' | 'closed' | 'cancelled';
export type InvestorType = 'penny' | 'sole';
export type InvestorRole = 'shareholder' | 'director' | 'observer';
export type DealRequestOrigin = 'investor' | 'student';
export type DealMediationStatus = 'intake' | 'under_review' | 'approved';
export type StockTransferStatus = 'not_started' | 'pending_review' | 'under_review' | 'approved';
export type RoyaltyStatus = 'pending' | 'invoiced' | 'received';

export interface DealStockDetails {
  shareClassLabel: string;
  sharePriceInr: number;
  transferValueInr: number;
  totalSharesConsidered: number;
}

export interface DealStockTransfer {
  status: StockTransferStatus;
  requestedAt?: string;
  requestedByRole?: DealRequestOrigin | 'admin';
  requestSummary?: string;
  reviewNotes?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface DealRoyalty {
  promovePercentage: number;
  promoveAmountINR: number;
  status: RoyaltyStatus;
  settledAt?: string;
}

export interface DealSummaryView {
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
  investorRole: InvestorRole;
  votingWeight: number;
  canVeto: boolean;
  canAccessFinancials: boolean;
  canRequestUpdates: boolean;
  adminApprovalRequired: boolean;
  adminApprovedAt?: string;
  stockDetails: DealStockDetails;
  stockTransfer: DealStockTransfer;
  royalty: DealRoyalty;
  innovationScoreSnapshot: number;
  nextActionLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface DealDetailView extends DealSummaryView {
  startup: {
    _id: string;
    name: string;
    tagline: string;
    category: string;
    stage: string;
    pitchDeckUrl?: string;
  };
  student: {
    _id: string;
    displayName: string;
    avatar?: string;
    role: string;
    innovationScore: number;
  };
  investor: {
    _id: string;
    displayName: string;
    avatar?: string;
    role: string;
    innovationScore: number;
  };
  fundTransferInitiatedAt?: string;
  closedAt?: string;
}

export interface DealGroupView {
  stage: DealStage;
  label: string;
  deals: DealSummaryView[];
}

export interface DealTransitionResponse {
  requiresAdminApproval?: true;
  message?: string;
  deal?: DealDetailView;
}

export interface DealCollectionResponse {
  items: DealSummaryView[];
}

export interface DealUpdateStagePayload {
  newStage: 2 | 3 | 4;
  stageData?: {
    amountINR?: number;
    equityPercent?: number;
    investorRole?: InvestorRole;
  };
}

export interface InvestorAuthorityItem {
  dealId: string;
  startupId: string;
  startupName: string;
  investorType: InvestorType;
  equityPercent: number;
  sharesAllocated: number;
  stage: DealStage;
  investorRole: InvestorRole;
  votingWeight: number;
  canVeto: boolean;
  canAccessFinancials: boolean;
  canRequestUpdates: boolean;
}

export interface StartupInvestorItem {
  dealId: string;
  investorId: string;
  name: string;
  investorType: InvestorType;
  equityPercent: number;
  sharesAllocated: number;
  amountINR: number;
  stage: DealStage;
  investorRole: InvestorRole;
  votingWeight: number;
  canVeto: boolean;
  canAccessFinancials: boolean;
  canRequestUpdates: boolean;
  closedAt?: string;
}

export interface CapTableInvestorRow {
  dealId: string;
  investorId?: string;
  name?: string;
  investorType: InvestorType;
  equityPercent: number;
  sharesAllocated: number;
  investorRole: InvestorRole;
  votingWeight: number;
  canVeto: boolean;
  canAccessFinancials: boolean;
  canRequestUpdates: boolean;
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
