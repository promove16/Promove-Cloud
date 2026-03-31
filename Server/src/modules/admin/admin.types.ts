import { UserRole } from '../../types/roles.types';

export interface AdminUserListItem {
  _id: string;
  displayName: string;
  email: string;
  role: UserRole;
  innovationScore: number;
  isActive: boolean;
  profileComplete: boolean;
  registrationStage: string;
  adminApprovalStatus: 'not_required' | 'pending' | 'approved' | 'rejected';
  adminApprovalRequestedAt?: string;
  adminApprovedAt?: string;
  adminApprovalRejectedAt?: string;
  adminApprovalRejectedReason?: string;
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

export interface AdminRegistrationRequestItem {
  _id: string;
  displayName: string;
  email: string;
  role: Exclude<UserRole, UserRole.STUDENT>;
  status: 'pending' | 'approved' | 'rejected';
  isActive: boolean;
  createdAt: string;
  requestedAt: string;
  domain?: string;
  bio?: string;
  institutionProfile?: {
    institutionName: string;
    location: string;
    totalStudentsEnrolled: number;
    academicYear: string;
    iicStarRating: number;
  };
  reviewedAt?: string;
  rejectionReason?: string;
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
  filingDocuments: {
    inventionCategory:
      | 'mobile_app_backend'
      | 'iot_hardware_interface'
      | 'mechanical_improvement'
      | 'software_hardware_integration'
      | 'other';
    specificationType: 'provisional' | 'complete';
    inventorJournalSummary: string;
    priorArtSearchSummary: string;
    prototypeStatus: 'concept_only' | 'partial_prototype' | 'working_prototype' | 'validated_prototype';
    specificationDraft: string;
    abstractDraft: string;
    claimsDraft: string;
    drawingsPrepared: boolean;
    drawingsNotes: string;
    form1ApplicantDetailsConfirmed: boolean;
    form3ForeignFilingDetails?: string;
    form5InventorshipConfirmed: boolean;
    form26PowerOfAttorneyRequired: boolean;
    form26PowerOfAttorneyDetails?: string;
    examinationRequestPlan: string;
    publicDisclosureChecked: boolean;
    professionalSupportNeeded: boolean;
    costManagementNotes?: string;
  };
  supportingDocuments: Array<{
    fileUrl: string;
    fileType: 'pdf' | 'image';
    fileName: string;
    fileSizeBytes: number;
    note?: string;
    documentCategory?: string;
  }>;
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

export interface AdminDealReviewItem extends AdminDealItem {
  createdAt: string;
  updatedAt: string;
  fundTransferInitiatedAt?: string;
  closedAt?: string;
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
    role: UserRole;
    innovationScore: number;
  };
  investor: {
    _id: string;
    displayName: string;
    avatar?: string;
    role: UserRole;
    innovationScore: number;
  };
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
