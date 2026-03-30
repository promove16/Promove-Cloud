import api from './axiosInstance';
import { ApiSuccessResponse, InstitutionProfileInput, RegistrationRequestStatus } from '../types/auth.types';
import { PatentFilingDocuments, PatentSupportingDocument } from '../types/patent.types';
import { UserRole } from '../types/roles.types';
import { MentorStudentProfile } from './mentor.api';

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
  email: string;
  displayName: string;
  role: UserRole;
  status: RegistrationRequestStatus;
  domain?: string;
  bio?: string;
  institutionProfile?: InstitutionProfileInput;
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
    whatIsYourInnovation: string;
    noveltyExplanation: string;
    technicalDetails: string;
    marketUseCase: string;
    priorArtAwareness: string;
  };
  filingDocuments?: PatentFilingDocuments;
  supportingDocuments: PatentSupportingDocument[];
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

export const adminApi = {
  async getUsers(params?: { role?: UserRole; isActive?: boolean; page?: number; limit?: number }) {
    const response = await api.get<ApiSuccessResponse<AdminUsersResponse>>('/api/admin/users', { params });
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
  async getAwards() {
    const response = await api.get<ApiSuccessResponse<AdminAwardItem[]>>('/api/admin/awards');
    return response.data.data;
  },
  async approveAward(awardId: string) {
    const response = await api.patch<ApiSuccessResponse<{ approved: true; newScore: number }>>(
      `/api/admin/awards/${awardId}/approve`,
    );
    return response.data.data;
  },
  async rejectAward(awardId: string, adminNotes: string) {
    const response = await api.patch<ApiSuccessResponse<{ rejected: true }>>(
      `/api/admin/awards/${awardId}/reject`,
      { adminNotes },
    );
    return response.data.data;
  },
  async getDeals() {
    const response = await api.get<ApiSuccessResponse<AdminDealItem[]>>('/api/admin/deals');
    return response.data.data;
  },
  async getDeal(dealId: string) {
    const response = await api.get<ApiSuccessResponse<AdminDealItem>>(`/api/admin/deals/${dealId}`);
    return response.data.data;
  },
  async approveDealStage(dealId: string) {
    const response = await api.patch<ApiSuccessResponse<{ approved: true }>>(
      `/api/admin/deals/${dealId}/approve-stage`,
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
    const response = await api.get<ApiSuccessResponse<unknown>>(`/api/admin/startups/${startupId}/cap-table`);
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
  async getCapacity() {
    const response = await api.get<ApiSuccessResponse<AdminCapacityData>>('/api/admin/capacity');
    return response.data.data;
  },
};
