import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import {
  ComplianceReportRecord,
  DirectoryInvestor,
  LeaderboardPage,
  PendingStudentVerification,
  SchoolDashboardData,
  StudentAccessToken,
  StudentJourney,
  StudentVerificationReviewResponse,
} from '../types/school.types';

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
};
