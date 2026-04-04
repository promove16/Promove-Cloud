import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import {
  BulkCredentialImportResult,
  ComplianceReportRecord,
  DashboardEvent,
  DirectoryInvestor,
  InstitutionPatent,
  InstitutionStartup,
  LeaderboardPage,
  PendingStudentVerification,
  RecentProject,
  SchoolDashboardData,
  StudentAccessToken,
  StudentJourney,
  StudentRosterEntry,
  StudentRosterImportResult,
  TemporaryStudentCredentials,
  StudentVerificationReviewResponse,
} from '../types/school.types';
import {
  CreateInstitutionMentorshipProgramInput,
  InstitutionMentorshipProgram,
  InstitutionMentorshipProgramView,
} from '../types/mentorship.types';

export const schoolApi = {
  async getDashboard() {
    const response = await api.get<ApiSuccessResponse<SchoolDashboardData>>('/api/school/dashboard');
    return response.data.data;
  },
  async getStudents(cursor?: string, limit = 50) {
    const response = await api.get<ApiSuccessResponse<LeaderboardPage>>('/api/school/students', {
      params: { cursor, limit },
    });
    return response.data.data;
  },
  async getStudentJourney(studentId: string) {
    const response = await api.get<ApiSuccessResponse<StudentJourney>>(
      `/api/school/students/${studentId}/journey`,
    );
    return response.data.data;
  },
  async getInvestors() {
    const response = await api.get<ApiSuccessResponse<DirectoryInvestor[]>>('/api/school/investors');
    return response.data.data;
  },
  async getProjects() {
    const response = await api.get<ApiSuccessResponse<RecentProject[]>>('/api/school/projects');
    return response.data.data;
  },
  async getPatents() {
    const response = await api.get<ApiSuccessResponse<InstitutionPatent[]>>('/api/school/patents');
    return response.data.data;
  },
  async getStartups() {
    const response = await api.get<ApiSuccessResponse<InstitutionStartup[]>>('/api/school/startups');
    return response.data.data;
  },
  async getEvents() {
    const response = await api.get<ApiSuccessResponse<DashboardEvent[]>>('/api/school/events');
    return response.data.data;
  },
  async generateComplianceReport() {
    const response = await api.post<ApiSuccessResponse<{ reportUrl: string }>>(
      '/api/school/compliance-report',
    );
    return response.data.data;
  },
  async getLatestComplianceReport() {
    const response = await api.get<ApiSuccessResponse<ComplianceReportRecord | null>>(
      '/api/school/compliance-report/latest',
    );
    return response.data.data;
  },
  async getStudentAccessTokens() {
    const response = await api.get<ApiSuccessResponse<StudentAccessToken[]>>(
      '/api/school/student-access-tokens',
    );
    return response.data.data;
  },
  async createStudentAccessToken(payload: { label?: string; expiresInDays?: number }) {
    const response = await api.post<ApiSuccessResponse<StudentAccessToken>>(
      '/api/school/student-access-tokens',
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
      '/api/school/student-temp-credentials',
      payload,
    );
    return response.data.data;
  },
  async getPendingStudentVerifications() {
    const response = await api.get<ApiSuccessResponse<PendingStudentVerification[]>>(
      '/api/school/student-verifications',
    );
    return response.data.data;
  },
  async reviewStudentVerification(
    studentId: string,
    payload: { decision: 'approved' | 'rejected'; reason?: string },
  ) {
    const response = await api.patch<ApiSuccessResponse<StudentVerificationReviewResponse>>(
      `/api/school/student-verifications/${studentId}`,
      payload,
    );
    return response.data.data;
  },
  async getStudentRoster(search?: string) {
    const response = await api.get<ApiSuccessResponse<StudentRosterEntry[]>>('/api/school/student-roster', {
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
      '/api/school/student-roster/manual',
      payload,
    );
    return response.data.data;
  },
  async cancelStudentInvite(rosterEntryId: string) {
    const response = await api.delete<ApiSuccessResponse<{ _id: string; cancelled: true; cancelledAt: string }>>(
      `/api/school/student-roster/${rosterEntryId}`,
    );
    return response.data.data;
  },
  async importStudentRoster(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<ApiSuccessResponse<StudentRosterImportResult>>(
      '/api/school/student-roster/import',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data.data;
  },
  async importStudentRosterWithCredentials(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<ApiSuccessResponse<BulkCredentialImportResult>>(
      '/api/school/student-roster/import-credentials',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data.data;
  },
  async getMentorshipPrograms() {
    const response = await api.get<ApiSuccessResponse<InstitutionMentorshipProgramView>>(
      '/api/school/mentorship-programs',
    );
    return response.data.data;
  },
  async createMentorshipProgram(payload: CreateInstitutionMentorshipProgramInput) {
    const response = await api.post<ApiSuccessResponse<InstitutionMentorshipProgram>>(
      '/api/school/mentorship-programs',
      payload,
    );
    return response.data.data;
  },
};
