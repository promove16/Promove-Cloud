import { UserRole } from '../../types/roles.types';
import {
  InstitutionRegulatoryBody,
  InstitutionVerificationDocumentCategory,
} from '../user/user.types';
import {
  DealMediationStatus,
  DealRequestOrigin,
  DealRoyalty,
  DealCancellationRequest,
  DealStockDetails,
  DealStockTransfer,
} from '../deal/deal.types';
import {
  ActivityRouteMetric,
  DailyUsagePoint,
  UsageInsight,
  UserActivityDetail,
  UserActivityFeedItem,
  UserActivitySummary,
  PlatformUsageSummary,
} from '../analytics/activity.types';
import {
  AdminCreateInstitutionMentorshipProgramInput,
  CreatedMentorProfileResult,
  InstitutionMentorshipProgramListResponse,
  InstitutionMentorshipProgramReviewInput,
  MentorshipAdminMentorItem,
} from '../mentor/mentor.types';

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
  institutionVerification?: {
    regulatoryBodies: InstitutionRegulatoryBody[];
    affiliationName?: string;
    websiteUrl?: string;
    referenceCode?: string;
    notes?: string;
    documents: Array<{
      _id: string;
      category: InstitutionVerificationDocumentCategory;
      fileUrl: string;
      fileType: 'pdf' | 'image' | 'doc' | 'docx' | 'ppt' | 'pptx' | 'xls' | 'xlsx' | 'video' | 'audio' | 'other';
      fileName: string;
      fileSizeBytes: number;
      uploadedAt: string;
      uploadedBy: string;
    }>;
    readiness: {
      isReadyForReview: boolean;
      requiredDocumentCategories: InstitutionVerificationDocumentCategory[];
      uploadedDocumentCategories: InstitutionVerificationDocumentCategory[];
      missingItems: string[];
    };
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
      problemsCompleted: number;
      skillsCompleted: number;
      progressUploads: number;
      patentsSubmitted: number;
      patentsApproved: number;
      mvpsVerified: number;
      marketReadyVerified: number;
      startupsLaunched: number;
    };
  };
  questionnaire: {
    problemStatement: string;
    solutionDifferentiation: string;
    coreInnovation: string;
    priorArtStatus: string;
    workingMechanism: string;
    keyComponents: string;
    developmentStage: string;
    documentationReadiness: string;
    inventorOwnership: string;
    developmentContext: string;
    targetMarkets: string;
    commercializationStrategy: string;
    publicDisclosureStatus: string;
    legalAgreements: string;
    ipProtectionType: string;
  };
  filingDocuments?: {
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
  patentStage?: 'filed' | 'published' | 'granted';
  ipoApplicationNumber?: string;
  ipoFilingDate?: string;
  publicationDate?: string;
  grantNumber?: string;
  grantDate?: string;
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
  student: {
    _id: string;
    displayName: string;
    innovationScore: number;
  };
}

export interface AdminStartupRecordInvestor {
  dealId: string;
  investorId: string;
  investorName: string;
  investorType: 'penny' | 'sole';
  amountINR?: number;
  equityPercent?: number;
  sharesAllocated?: number;
  stage: number;
  status: 'active' | 'closed' | 'cancelled';
  investorRole?: 'shareholder' | 'director' | 'observer';
  royaltyOwedINR?: number;
  createdAt: string;
}

export interface AdminStartupRecordAuditEntry {
  _id: string;
  action: string;
  adminId: string;
  adminName: string;
  targetModel: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminStartupRecord {
  startupId: string;
  funds: {
    totalRaisedINR: number;
    totalRoyaltyOwedINR: number;
    activeDealCount: number;
    closedDealCount: number;
    cancelledDealCount: number;
    pennyInvestorCount: number;
    soleInvestorCount: number;
    capTable: {
      totalShares: number;
      availableShares: number;
      founderRetainedEquity: number;
      totalInvestorEquity: number;
    };
  };
  marketReach: {
    launchedToInvestors: boolean;
    launchedToMentors: boolean;
    launchedAt?: string;
    innovationScoreAtLaunch: number;
    traction: {
      patentFiled: boolean;
      mvpBuilt: boolean;
      revenueGenerating: boolean;
      usersCount?: number;
    };
  };
  investors: AdminStartupRecordInvestor[];
  auditTrail: AdminStartupRecordAuditEntry[];
}

export interface AdminDealItem {
  _id: string;
  investorId: string;
  startupId: string;
  studentId: string;
  mediatorLabel: string;
  requestOrigin: DealRequestOrigin;
  mediationStatus: DealMediationStatus;
  stage: 0 | 1 | 2 | 3 | 4;
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
  stockDetails: DealStockDetails & {
    sharePriceInr: number;
    transferValueInr: number;
    totalSharesConsidered: number;
  };
  stockTransfer: Omit<DealStockTransfer, 'requestedAt' | 'reviewedAt' | 'reviewedBy'> & {
    status: 'not_started' | 'pending_review' | 'under_review' | 'approved' | 'rejected';
    requestedAt?: string;
    reviewedAt?: string;
    reviewedBy?: string;
  };
  royalty: Omit<DealRoyalty, 'settledAt'> & {
    status: 'pending' | 'invoiced' | 'received';
    settledAt?: string;
  };
  cancellationRequest?: Omit<
    DealCancellationRequest,
    'requestedAt' | 'reviewedAt' | 'requestedBy' | 'reviewedBy'
  > & {
    requestedBy?: string;
    requestedAt?: string;
    reviewedBy?: string;
    reviewedAt?: string;
  };
  paymentApproval?: {
    status: 'none' | 'requested' | 'approved' | 'rejected';
    requestedAt?: string;
    requestedBy?: string;
    reviewedAt?: string;
    reviewedBy?: string;
    reviewNotes?: string;
  };
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
    pitchDeckName?: string;
    projectId?: string;
    teamSize: number;
    fundingNeeded?: number;
    activeProducts: number;
    launchedAt?: string;
    innovationScoreAtLaunch: number;
    traction: {
      patentFiled: boolean;
      mvpBuilt: boolean;
      revenueGenerating: boolean;
      usersCount?: number;
    };
    sharePool: {
      totalShares: number;
      availableShares: number;
      reservedForSole: number;
      maxPennyInvestors: number;
      currentPennyCount: number;
      hasSoleInvestor: boolean;
    };
    founders: Array<{
      _id: string;
      displayName: string;
      avatar?: string;
      innovationScore: number;
      scoreBreakdown: Record<string, number>;
      domain?: string;
    }>;
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
  scoreEvents: Array<{
    _id: string;
    trigger: string;
    delta: number;
    scoreAfter: number;
    createdAt: string;
  }>;
  workspace?: {
    _id: string;
    title: string;
    category: string;
    stage: string;
    progressPercent: number;
    milestones: Array<{
      _id: string;
      name: string;
      isCompleted: boolean;
      completionPercent: number;
      completedAt?: string;
    }>;
    evidenceSummary: {
      uploadsCount: number;
      repoCount: number;
      codeCount: number;
      progressUpdatesCount: number;
    };
    uploads: Array<{
      _id: string;
      fileUrl: string;
      fileType: 'pdf' | 'image' | 'doc' | 'docx' | 'ppt' | 'pptx' | 'xls' | 'xlsx' | 'video' | 'audio' | 'other';
      fileName: string;
      fileSizeBytes: number;
      uploadedAt: string;
      note?: string;
      category?: string;
    }>;
    repoSubmissions: Array<{
      _id: string;
      provider: 'github';
      repoUrl: string;
      displayName: string;
      branch?: string;
      commitHash?: string;
      note?: string;
      uploadedAt: string;
    }>;
    progressUpdates: Array<{
      _id: string;
      note: string;
      milestoneRef?: string;
      submittedAt: string;
    }>;
    updatedAt: string;
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
  usageSummary: PlatformUsageSummary;
  dailyUsage: DailyUsagePoint[];
  topRoutes: ActivityRouteMetric[];
  mostActiveUsers: UserActivitySummary[];
  recentUserActivity: UserActivityFeedItem[];
  insights: UsageInsight[];
}

export interface AdminAnalyticsLogEntry {
  _id: string;
  level: string;
  message: string;
  source: 'http' | 'application';
  timestamp?: string;
}

export interface AdminAnalyticsLogsResponse {
  logs: AdminAnalyticsLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminUserActivitySearchResponse {
  items: UserActivitySummary[];
}

export type AdminUserActivityDetail = UserActivityDetail;

export interface AdminDealReviewPayload {
  stockTransferStatus?: 'pending_review' | 'under_review' | 'rejected';
  reviewNotes?: string;
  royaltyPercentage?: number;
  royaltyStatus?: 'pending' | 'invoiced' | 'received';
}

export interface AdminDealCancellationReviewPayload {
  decision: 'approved' | 'rejected';
  reviewNotes?: string;
}

export type AdminMentorshipProgramsResponse = InstitutionMentorshipProgramListResponse;
export type AdminCreateMentorshipProgramPayload = AdminCreateInstitutionMentorshipProgramInput;
export type AdminMentorshipProgramReviewPayload = InstitutionMentorshipProgramReviewInput;
export type AdminMentorListItem = MentorshipAdminMentorItem;
export type AdminCreatedMentorProfile = CreatedMentorProfileResult;

export interface AdminOnboardedAccount {
  user: {
    _id: string;
    displayName: string;
    email: string;
    role: UserRole;
    domain?: string;
    headline?: string;
    bio?: string;
    institutionName?: string;
    createdAt: string;
  };
  temporaryPassword: string;
}
