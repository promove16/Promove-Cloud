import api from './axiosInstance';
import {
  ApiSuccessResponse,
  InstitutionProfileInput,
  InstitutionVerificationProfile,
  RegistrationRequestStatus,
} from '../types/auth.types';
import {
  CapTableResponse,
  DealMediationStatus,
  DealRequestOrigin,
  DealRoyalty,
  DealStockDetails,
  DealStockTransfer,
} from '../types/deal.types';
import {
  AdminMentorListItem,
  AdminCreateMentorshipProgramInput,
  CreateMentorProfileInput,
  CreatedMentorProfileResult,
  InstitutionMentorshipProgram,
  InstitutionMentorshipProgramView,
  ProjectMentorshipAssignment,
  ProjectMentorshipView,
  ReviewProjectMentorAssignmentInput,
  ReviewMentorshipProgramInput,
} from '../types/mentorship.types';
import { PatentFilingDocuments, PatentSupportingDocument } from '../types/patent.types';
import { Problem } from '../types/problem.types';
import { UserRole } from '../types/roles.types';
import { StartupDocument, StartupReadiness, StartupRegistrationProfile, StartupReviewStatus } from '../types/startup.types';
import { MentorStudentProfile } from './mentor.api';
import { SCORE_BUCKETS } from '../constants/score';

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
  institutionProfile?: {
    institutionName?: string;
    location?: string;
    academicYear?: string;
    iicStarRating?: number;
  };
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
  email: string;
  displayName: string;
  role: UserRole;
  status: RegistrationRequestStatus;
  domain?: string;
  bio?: string;
  institutionProfile?: InstitutionProfileInput;
  institutionVerification?: InstitutionVerificationProfile;
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface AdminRegistrationRequestsResponse {
  items: AdminRegistrationRequestItem[];
  total: number;
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
    scoreBreakdown: MentorStudentProfile['student']['scoreBreakdown'];
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
  filingDocuments?: PatentFilingDocuments;
  supportingDocuments: PatentSupportingDocument[];
}

export interface AdminDealItem {
  _id: string;
  investorId: string;
  startupId: string;
  studentId: string;
  mediatorLabel: string;
  requestOrigin: DealRequestOrigin;
  mediationStatus: DealMediationStatus;
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
  stockDetails: DealStockDetails;
  stockTransfer: DealStockTransfer;
  royalty: DealRoyalty;
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
      fileType: 'pdf' | 'image';
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

export interface AdminStartupReviewItem {
  _id: string;
  name: string;
  tagline: string;
  category: string;
  stage: string;
  fundingNeeded?: number;
  activeProducts: number;
  teamSize: number;
  launchedToInvestors: boolean;
  launchedToMentors: boolean;
  launchedAt?: string;
  reviewStatus: StartupReviewStatus;
  reviewRequestedAt?: string;
  adminReviewedAt?: string;
  adminReviewedBy?: string;
  adminNotes?: string;
  pitchDeckUrl?: string;
  pitchDeckName?: string;
  registrationProfile: StartupRegistrationProfile;
  readiness: StartupReadiness;
  documents: StartupDocument[];
  traction: {
    patentFiled: boolean;
    mvpBuilt: boolean;
    revenueGenerating: boolean;
    usersCount?: number;
  };
  founders: Array<{
    _id: string;
    displayName: string;
    avatar?: string;
    innovationScore: number;
    domain?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDealReviewPayload {
  stockTransferStatus?: 'pending_review' | 'under_review';
  reviewNotes?: string;
  royaltyPercentage?: number;
  royaltyStatus?: 'pending' | 'invoiced' | 'received';
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
  scoreDistribution: Record<(typeof SCORE_BUCKETS)[number], number>;
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

export interface PlatformUsageSummary {
  trackedEventsLast7Days: number;
  activeUsersLast7Days: number;
  pageViewsLast7Days: number;
  apiRequestsLast7Days: number;
  writeActionsLast7Days: number;
  avgEventsPerActiveUser: number;
}

export interface DailyUsagePoint {
  date: string;
  activeUsers: number;
  pageViews: number;
  apiRequests: number;
  writeActions: number;
}

export interface ActivityRouteMetric {
  path: string;
  label: string;
  feature: string;
  eventType: 'api_request' | 'page_view' | 'navigation_click';
  count: number;
  uniqueUsers: number;
}

export interface UserActivitySummary {
  userId: string;
  displayName: string;
  email: string;
  role: UserRole;
  totalEvents: number;
  pageViews: number;
  apiRequests: number;
  writeActions: number;
  activeDays: number;
  lastSeenAt?: string;
}

export interface UserActivityFeedItem {
  _id: string;
  userId: string;
  displayName: string;
  email: string;
  role: UserRole;
  eventType: 'login' | 'api_request' | 'page_view' | 'navigation_click';
  source: 'server' | 'client';
  path: string;
  label: string;
  feature: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  createdAt: string;
}

export interface UsageInsight {
  title: string;
  description: string;
  tone: 'info' | 'warning' | 'success';
}

export interface AdminUserActivitySearchResponse {
  items: UserActivitySummary[];
}

export interface AdminUserActivityDetail {
  summary: UserActivitySummary & {
    trackedSince?: string;
  };
  dailyUsage: DailyUsagePoint[];
  topRoutes: ActivityRouteMetric[];
  recentActivity: UserActivityFeedItem[];
}

export interface AdminProblem extends Problem {
  stats: Problem['stats'] & {
    reviewRequestedCount?: number;
  };
}

export interface AdminProblemPayload {
  title: string;
  description: string;
  category: Problem['category'];
  difficulty: Problem['difficulty'];
  domain: string;
  tags?: string[];
  isVerified?: boolean;
  sponsorName?: string;
  geography?: string;
  targetBeneficiaries?: string[];
  impactGoal?: string;
  expectedOutcome?: string;
  deliverables?: string[];
  acceptanceCriteria?: string[];
  constraints?: string[];
  resourceLinks?: string[];
  securityNotice?: string;
  publicationStatus?: Problem['publicationStatus'];
  submissionConfig?: Problem['submissionConfig'];
}

export interface AdminProblemReviewRequest {
  _id: string;
  reviewStatus: 'review_requested' | 'changes_requested' | 'approved';
  requestNote: string;
  requestedAt: string;
  adminReviewedAt?: string;
  adminNotes?: string;
  pointsAwarded: number;
  problem: {
    _id: string;
    title: string;
    category: Problem['category'];
    difficulty: Problem['difficulty'];
  };
  workspace: {
    _id: string;
    title: string;
    progressPercent: number;
    evidenceSummary: {
      uploadsCount: number;
      repoCount: number;
      codeCount: number;
      progressUpdatesCount: number;
    };
  };
  owner: {
    _id: string;
    displayName: string;
    avatar?: string;
  };
  submittedBy: {
    _id: string;
    displayName: string;
  };
  teamMembers: Array<{
    _id: string;
    displayName: string;
    avatar?: string;
  }>;
}

export interface AdminAnalyticsLogEntry {
  _id: string;
  level: string;
  message: string;
  source: 'http' | 'application';
  timestamp?: string;
}

export const adminApi = {
  async getUsers(params?: { role?: UserRole; isActive?: boolean; page?: number; limit?: number }) {
    const response = await api.get<ApiSuccessResponse<AdminUsersResponse>>('/api/admin/users', { params });
    return response.data.data;
  },
  async getProblems() {
    const response = await api.get<ApiSuccessResponse<AdminProblem[]>>('/api/admin/problems');
    return response.data.data;
  },
  async createProblem(payload: AdminProblemPayload) {
    const response = await api.post<ApiSuccessResponse<AdminProblem>>('/api/admin/problems', payload);
    return response.data.data;
  },
  async updateProblem(problemId: string, payload: Partial<AdminProblemPayload>) {
    const response = await api.patch<ApiSuccessResponse<AdminProblem>>(
      `/api/admin/problems/${problemId}`,
      payload,
    );
    return response.data.data;
  },
  async deleteProblem(problemId: string) {
    const response = await api.delete<ApiSuccessResponse<{ deleted: true }>>(
      `/api/admin/problems/${problemId}`,
    );
    return response.data.data;
  },
  async getProblemReviewRequests(params?: {
    status?: 'review_requested' | 'changes_requested' | 'approved';
  }) {
    const response = await api.get<ApiSuccessResponse<AdminProblemReviewRequest[]>>(
      '/api/admin/problems/review-requests',
      { params },
    );
    return response.data.data;
  },
  async reviewProblemSubmission(
    submissionId: string,
    payload: {
      decision: 'approved' | 'changes_requested';
      pointsAwarded?: number;
      adminNotes?: string;
    },
  ) {
    const response = await api.patch<ApiSuccessResponse<{
      _id: string;
      reviewStatus: 'approved' | 'changes_requested';
      pointsAwarded: number;
      adminNotes?: string;
      adminReviewedAt: string;
    }>>(`/api/admin/problems/review-requests/${submissionId}`, payload);
    return response.data.data;
  },
  async getRegistrationRequests(params?: { status?: RegistrationRequestStatus; role?: UserRole }) {
    const response = await api.get<ApiSuccessResponse<AdminRegistrationRequestsResponse>>(
      '/api/admin/registration-requests',
      { params },
    );
    return response.data.data;
  },
  async approveRegistrationRequest(requestId: string) {
    const response = await api.patch<ApiSuccessResponse<AdminRegistrationRequestItem>>(
      `/api/admin/registration-requests/${requestId}/approve`,
    );
    return response.data.data;
  },
  async rejectRegistrationRequest(requestId: string, rejectionReason: string) {
    const response = await api.patch<ApiSuccessResponse<AdminRegistrationRequestItem>>(
      `/api/admin/registration-requests/${requestId}/reject`,
      { rejectionReason },
    );
    return response.data.data;
  },
  async updateUserRole(userId: string, role: UserRole) {
    const response = await api.patch<ApiSuccessResponse<AdminUserListItem>>(`/api/admin/users/${userId}/role`, {
      role,
    });
    return response.data.data;
  },
  async updateUserAccess(userId: string, isActive: boolean) {
    const response = await api.patch<ApiSuccessResponse<AdminUserListItem>>(`/api/admin/users/${userId}/access`, {
      isActive,
    });
    return response.data.data;
  },
  async reviewRegistrationRequest(
    userId: string,
    payload: { decision: 'approved' | 'rejected'; reason?: string },
  ) {
    const response = await api.patch<ApiSuccessResponse<AdminUserListItem>>(
      `/api/admin/users/${userId}/registration-request`,
      payload,
    );
    return response.data.data;
  },
  async getPatents(status?: string) {
    const response = await api.get<ApiSuccessResponse<AdminPatentItem[]>>('/api/admin/patents', {
      params: { status },
    });
    return response.data.data;
  },
  async approvePatent(patentId: string) {
    const response = await api.patch<ApiSuccessResponse<{ approved: true; newScore: number }>>(
      `/api/admin/patents/${patentId}/approve`,
    );
    return response.data.data;
  },
  async rejectPatent(patentId: string, adminNotes: string) {
    const response = await api.patch<ApiSuccessResponse<{ rejected: true }>>(
      `/api/admin/patents/${patentId}/reject`,
      { adminNotes },
    );
    return response.data.data;
  },
  async getDeals() {
    const response = await api.get<ApiSuccessResponse<AdminDealItem[]>>('/api/admin/deals');
    return response.data.data;
  },
  async getStartupReviews(params?: { status?: StartupReviewStatus }) {
    const response = await api.get<ApiSuccessResponse<AdminStartupReviewItem[]>>('/api/admin/startups', {
      params,
    });
    return response.data.data;
  },
  async reviewStartup(
    startupId: string,
    payload: { decision: 'approved' | 'changes_requested'; adminNotes?: string },
  ) {
    const response = await api.patch<ApiSuccessResponse<AdminStartupReviewItem>>(
      `/api/admin/startups/${startupId}/review`,
      payload,
    );
    return response.data.data;
  },
  async getDeal(dealId: string) {
    const response = await api.get<ApiSuccessResponse<AdminDealReviewItem>>(`/api/admin/deals/${dealId}`);
    return response.data.data;
  },
  async approveDealStage(dealId: string) {
    const response = await api.patch<ApiSuccessResponse<{ approved: true }>>(
      `/api/admin/deals/${dealId}/approve-stage`,
    );
    return response.data.data;
  },
  async updateDealReview(dealId: string, payload: AdminDealReviewPayload) {
    const response = await api.patch<ApiSuccessResponse<AdminDealReviewItem>>(
      `/api/admin/deals/${dealId}/review`,
      payload,
    );
    return response.data.data;
  },
  async updateDealInvestorRole(dealId: string, investorRole: 'shareholder' | 'director' | 'observer') {
    const response = await api.patch<ApiSuccessResponse<AdminDealItem>>(`/api/admin/deals/${dealId}/investor-role`, {
      investorRole,
    });
    return response.data.data;
  },
  async getStartupCapTable(startupId: string) {
    const response = await api.get<ApiSuccessResponse<CapTableResponse>>(`/api/admin/startups/${startupId}/cap-table`);
    return response.data.data;
  },
  async resetSoleInvestor(startupId: string) {
    const response = await api.post<ApiSuccessResponse<{ reset: true }>>(
      `/api/admin/startups/${startupId}/reset-sole-investor`,
    );
    return response.data.data;
  },
  async getInvestmentTypeBreakdown() {
    const response = await api.get<
      ApiSuccessResponse<{
        pennyCount: number;
        soleCount: number;
        pennyCapitalDeployed: number;
        soleCapitalDeployed: number;
      }>
    >('/api/admin/investments/by-type');
    return response.data.data;
  },
  async getAnalytics() {
    const response = await api.get<ApiSuccessResponse<AdminAnalyticsData>>('/api/admin/analytics');
    return response.data.data;
  },
  async getAnalyticsLogs(params?: { limit?: number }) {
    const response = await api.get<ApiSuccessResponse<AdminAnalyticsLogEntry[]>>('/api/admin/analytics/logs', {
      params,
    });
    return response.data.data;
  },
  async getAnalyticsUsers(params?: { q?: string; limit?: number }) {
    const response = await api.get<ApiSuccessResponse<AdminUserActivitySearchResponse>>('/api/admin/analytics/users', {
      params,
    });
    return response.data.data;
  },
  async getAnalyticsUserDetail(userId: string) {
    const response = await api.get<ApiSuccessResponse<AdminUserActivityDetail>>(
      `/api/admin/analytics/users/${userId}`,
    );
    return response.data.data;
  },
  async getMentorshipPrograms(params?: { status?: 'Pending' | 'Assigned' | 'Rejected' }) {
    const response = await api.get<ApiSuccessResponse<InstitutionMentorshipProgramView>>(
      '/api/admin/mentorship-programs',
      { params },
    );
    return response.data.data;
  },
  async createMentorshipProgram(payload: AdminCreateMentorshipProgramInput) {
    const response = await api.post<ApiSuccessResponse<InstitutionMentorshipProgram>>(
      '/api/admin/mentorship-programs',
      payload,
    );
    return response.data.data;
  },
  async getProjectMentorships() {
    const response = await api.get<ApiSuccessResponse<ProjectMentorshipView>>('/api/admin/project-mentorships');
    return response.data.data;
  },
  async reviewMentorshipProgram(programId: string, payload: ReviewMentorshipProgramInput) {
    const response = await api.patch<ApiSuccessResponse<unknown>>(
      `/api/admin/mentorship-programs/${programId}`,
      payload,
    );
    return response.data.data;
  },
  async reviewProjectMentorship(workspaceId: string, payload: ReviewProjectMentorAssignmentInput) {
    const response = await api.patch<ApiSuccessResponse<ProjectMentorshipAssignment>>(
      `/api/admin/project-mentorships/${workspaceId}`,
      payload,
    );
    return response.data.data;
  },
  async getMentors() {
    const response = await api.get<ApiSuccessResponse<AdminMentorListItem[]>>('/api/admin/mentors');
    return response.data.data;
  },
  async createMentorProfile(payload: CreateMentorProfileInput) {
    const response = await api.post<ApiSuccessResponse<CreatedMentorProfileResult>>('/api/admin/mentors', payload);
    return response.data.data;
  },
};
