import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import {
  CollegeDashboardData,
  CollegeEvent,
  CollegeEventRankingsResponse,
  PendingStudentVerification,
  PlacementStatusUpdateResponse,
  RecruiterDirectoryItem,
  StudentRosterEntry,
  StudentRosterImportResult,
  StudentAccessToken,
  StudentLeaderboardItem,
  StudentVerificationReviewResponse,
} from '../types/college.types';
import { BulkCredentialImportResult } from '../types/school.types';
import {
  ComplianceReportRecord,
  DirectoryInvestor,
  LeaderboardPage,
  StudentJourney,
  TemporaryStudentCredentials,
} from '../types/school.types';
import { PlacementTrackerData, PlacementStatus } from '../types/placement.types';

export const collegeApi = {
  async getDashboard() {
    const response = await api.get<ApiSuccessResponse<CollegeDashboardData>>('/api/college/dashboard');
    return response.data.data;
  },
  async getStudents(cursor?: string, limit = 50) {
    const response = await api.get<ApiSuccessResponse<LeaderboardPage>>('/api/college/students', {
      params: { cursor, limit },
    });
    return response.data.data;
  },
  async getStudentJourney(studentId: string) {
    const response = await api.get<ApiSuccessResponse<StudentJourney>>(
      `/api/college/students/${studentId}/journey`,
    );
    return response.data.data;
  },
  async getInvestors() {
    const response = await api.get<ApiSuccessResponse<DirectoryInvestor[]>>('/api/college/investors');
    return response.data.data;
  },
  async getRecruiters() {
    const response = await api.get<ApiSuccessResponse<RecruiterDirectoryItem[]>>(
      '/api/college/recruiters',
    );
    return response.data.data;
  },
  async getPlacementTracker() {
    const response = await api.get<ApiSuccessResponse<PlacementTrackerData>>('/api/college/placement');
    return response.data.data;
  },
  async updatePlacementStatus(studentId: string, status: Exclude<PlacementStatus, 'Discovered' | 'In Progress'>) {
    const response = await api.patch<ApiSuccessResponse<PlacementStatusUpdateResponse>>(
      `/api/college/placement/${studentId}/status`,
      { status },
    );
    return response.data.data;
  },
  async listEvents() {
    const response = await api.get<ApiSuccessResponse<CollegeEvent[]>>('/api/college/events');
    return response.data.data;
  },
  async createEvent(payload: {
    title: string;
    type: 'Industry Connect Session' | 'Placement Hackathon' | 'Innovation Drive' | 'Other';
    date: string;
    description: string;
    targetRoles?: Array<'student' | 'all'>;
  }) {
    const response = await api.post<ApiSuccessResponse<CollegeEvent>>('/api/college/events', payload);
    return response.data.data;
  },
  async getEventRankings(eventId: string) {
    const response = await api.get<ApiSuccessResponse<CollegeEventRankingsResponse>>(
      `/api/college/events/${eventId}/rankings`,
    );
    return response.data.data;
  },
  async generateComplianceReport() {
    const response = await api.post<ApiSuccessResponse<{ reportUrl: string }>>(
      '/api/college/compliance-report',
    );
    return response.data.data;
  },
  async getLatestComplianceReport() {
    const response = await api.get<ApiSuccessResponse<ComplianceReportRecord | null>>(
      '/api/college/compliance-report/latest',
    );
    return response.data.data;
  },
  async getStudentAccessTokens() {
    const response = await api.get<ApiSuccessResponse<StudentAccessToken[]>>(
      '/api/college/student-access-tokens',
    );
    return response.data.data;
  },
  async createStudentAccessToken(payload: { label?: string; expiresInDays?: number }) {
    const response = await api.post<ApiSuccessResponse<StudentAccessToken>>(
      '/api/college/student-access-tokens',
      payload,
    );
    return response.data.data;
  },
  async createTemporaryStudentCredentials(payload: {
    displayName: string;
    email: string;
    domain?: string;
    bio?: string;
    gradeOrProgram?: string;
    rollNumber?: string;
    notes?: string;
  }) {
    const response = await api.post<ApiSuccessResponse<TemporaryStudentCredentials>>(
      '/api/college/student-temp-credentials',
      payload,
    );
    return response.data.data;
  },
  async getPendingStudentVerifications() {
    const response = await api.get<ApiSuccessResponse<PendingStudentVerification[]>>(
      '/api/college/student-verifications',
    );
    return response.data.data;
  },
  async reviewStudentVerification(
    studentId: string,
    payload: { decision: 'approved' | 'rejected'; reason?: string },
  ) {
    const response = await api.patch<ApiSuccessResponse<StudentVerificationReviewResponse>>(
      `/api/college/student-verifications/${studentId}`,
      payload,
    );
    return response.data.data;
  },
  async getStudentRoster(search?: string) {
    const response = await api.get<ApiSuccessResponse<StudentRosterEntry[]>>('/api/college/student-roster', {
      params: search ? { search } : undefined,
    });
    return response.data.data;
  },
  async createStudentRosterEntry(payload: {
    displayName: string;
    email: string;
    gradeOrProgram?: string;
    rollNumber?: string;
    notes?: string;
  }) {
    const response = await api.post<ApiSuccessResponse<StudentRosterEntry>>(
      '/api/college/student-roster/manual',
      payload,
    );
    return response.data.data;
  },
  async cancelStudentInvite(rosterEntryId: string) {
    const response = await api.delete<ApiSuccessResponse<{ _id: string; cancelled: true; cancelledAt: string }>>(
      `/api/college/student-roster/${rosterEntryId}`,
    );
    return response.data.data;
  },
  async importStudentRoster(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<ApiSuccessResponse<StudentRosterImportResult>>(
      '/api/college/student-roster/import',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data.data;
  },
  async importStudentRosterWithCredentials(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<ApiSuccessResponse<BulkCredentialImportResult>>(
      '/api/college/student-roster/import-credentials',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data.data;
  },
};
