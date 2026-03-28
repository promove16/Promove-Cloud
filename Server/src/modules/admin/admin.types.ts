import { UserRole } from '../../types/roles.types';

export interface AdminUserListItem {
  _id: string;
  displayName: string;
  email: string;
  role: UserRole;
  innovationScore: number;
  isActive: boolean;
  accessGrantedBy: string;
  accessExpiresAt: string;
  createdAt: string;
}

export interface AdminUsersResponse {
  items: AdminUserListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminPatentItem {
  _id: string;
  studentId: string;
  projectTitle: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
  submittedAt: string;
  adminReviewedAt?: string;
  adminReviewedBy?: string;
  adminNotes?: string;
  scoreAwarded: boolean;
  student: {
    _id: string;
    displayName: string;
    innovationScore: number;
    avatar?: string;
    scoreBreakdown: {
      problemsClaimed: number;
      skillsCompleted: number;
      progressUploads: number;
      patentsSubmitted: number;
      patentsApproved: number;
      mvpsVerified: number;
      marketReadyVerified: number;
      startupsLaunched: number;
      awardsApproved: number;
    };
  };
  questionnaire: {
    whatIsYourInnovation: string;
    noveltyExplanation: string;
    technicalDetails: string;
    marketUseCase: string;
    priorArtAwareness: string;
  };
}

export interface AdminAwardItem {
  _id: string;
  studentId: string;
  title: string;
  description: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
  submittedAt: string;
  adminReviewedAt?: string;
  adminReviewedBy?: string;
  adminNotes?: string;
  scoreAwarded: boolean;
  student: {
    _id: string;
    displayName: string;
    innovationScore: number;
  };
}

export interface AdminDealItem {
  _id: string;
  investorId: string;
  startupId: string;
  studentId: string;
  stage: 1 | 2 | 3 | 4;
  amountINR?: number;
  equityPercent?: number;
  investorType?: 'penny' | 'sole';
  investorRole?: 'shareholder' | 'director' | 'observer';
  sharesAllocated?: number;
  votingWeight?: number;
  canVeto?: boolean;
  adminApprovalRequired: boolean;
  adminApprovedAt?: string;
  adminApprovedBy?: string;
  innovationScoreSnapshot: number;
  status: 'active' | 'closed' | 'cancelled';
  nextActionLabel: string;
  investorName: string;
  startupName: string;
  studentName: string;
}

export interface AdminAnalyticsData {
  totalUsers: number;
  usersByRole: Record<UserRole, number>;
  activeThisWeek: number;
  totalDeals: number;
  dealsByStage: Record<'1' | '2' | '3' | '4', number>;
  dealConversionRate: number;
  totalPatents: number;
  patentsByStatus: Record<'submitted' | 'under_review' | 'approved' | 'rejected', number>;
  scoreDistribution: Record<'0-50' | '51-100' | '101-150' | '151-200', number>;
  topInnovators: AdminUserListItem[];
  recentAdminActions: Array<{
    _id: string;
    adminId: string;
    action: string;
    targetId: string;
    targetModel: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
  }>;
  patentsPending: number;
  awardsPending: number;
  investmentTypeBreakdown: {
    pennyCount: number;
    soleCount: number;
    pennyCapitalDeployed: number;
    soleCapitalDeployed: number;
  };
}

export interface AdminCapacityData {
  current: number;
  max: number;
  percentUsed: number;
  remainingSlots: number;
  waitlistCount: number;
}
