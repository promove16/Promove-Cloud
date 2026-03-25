export type DealStage = 1 | 2 | 3 | 4;
export type DealStatus = 'active' | 'closed' | 'cancelled';
export type InvestorRole = 'Shareholder' | 'Director' | 'Co-Founder';

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
