import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import {
  ComplianceActionRecord,
  ComplianceAlertRecord,
  ComplianceIncidentRecord,
  ComplianceOverviewData,
  BulkCredentialImportResult,
  ComplianceReportRecord,
  DirectoryInvestor,
  InstitutionPolicy,
  InstitutionPolicySubmissionRecord,
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
import { CollegeEvent, CollegeEventRankingsResponse } from '../types/college.types';
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
  async listEvents() {
    const response = await api.get<ApiSuccessResponse<CollegeEvent[]>>('/api/school/events');
    return response.data.data;
  },
  async createEvent(payload: {
    title: string;
    type: 'Industry Connect Session' | 'Placement Hackathon' | 'Innovation Drive' | 'Other';
    date: string;
    description: string;
    targetRoles?: Array<'student' | 'all'>;
  }) {
    const response = await api.post<ApiSuccessResponse<CollegeEvent>>('/api/school/events', payload);
    return response.data.data;
  },
  async getEventRankings(eventId: string) {
    const response = await api.get<ApiSuccessResponse<CollegeEventRankingsResponse>>(
      `/api/school/events/${eventId}/rankings`,
    );
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
  async getComplianceOverview() {
    const response = await api.get<ApiSuccessResponse<ComplianceOverviewData>>(
      '/api/school/compliance/overview',
    );
    return response.data.data;
  },
  async getComplianceSubmission() {
    const response = await api.get<ApiSuccessResponse<InstitutionPolicySubmissionRecord | null>>(
      '/api/school/compliance/submission',
    );
    return response.data.data;
  },
  async submitComplianceSubmission(payload: {
    policies: InstitutionPolicy[];
    summaryNote?: string;
  }) {
    const response = await api.put<ApiSuccessResponse<InstitutionPolicySubmissionRecord>>(
      '/api/school/compliance/submission',
      payload,
    );
    return response.data.data;
  },
  async getComplianceIncidents(params?: {
    status?: ComplianceIncidentRecord['status'];
    severity?: ComplianceIncidentRecord['severity'];
    limit?: number;
  }) {
    const response = await api.get<ApiSuccessResponse<ComplianceIncidentRecord[]>>(
      '/api/school/compliance/incidents',
      { params },
    );
    return response.data.data;
  },
  async createComplianceIncident(payload: {
    title: string;
    description?: string;
    category: ComplianceIncidentRecord['category'];
    severity?: ComplianceIncidentRecord['severity'];
    status?: ComplianceIncidentRecord['status'];
    source?: ComplianceIncidentRecord['source'];
    assignedTo?: string;
    dueAt?: string;
    relatedStudentId?: string;
  }) {
    const response = await api.post<ApiSuccessResponse<ComplianceIncidentRecord>>(
      '/api/school/compliance/incidents',
      payload,
    );
    return response.data.data;
  },
  async updateComplianceIncident(incidentId: string, payload: Partial<{
    title: string;
    description?: string;
    category: ComplianceIncidentRecord['category'];
    severity: ComplianceIncidentRecord['severity'];
    status: ComplianceIncidentRecord['status'];
    assignedTo?: string;
    dueAt?: string;
    relatedStudentId?: string;
  }>) {
    const response = await api.patch<ApiSuccessResponse<ComplianceIncidentRecord>>(
      `/api/school/compliance/incidents/${incidentId}`,
      payload,
    );
    return response.data.data;
  },
  async getComplianceAlerts(params?: { unreadOnly?: boolean; limit?: number }) {
    const response = await api.get<ApiSuccessResponse<ComplianceAlertRecord[]>>(
      '/api/school/compliance/alerts',
      { params },
    );
    return response.data.data;
  },
  async createComplianceAlert(payload: {
    title: string;
    message: string;
    level?: ComplianceAlertRecord['level'];
    incidentId?: string;
    ruleKey?: string;
  }) {
    const response = await api.post<ApiSuccessResponse<ComplianceAlertRecord>>(
      '/api/school/compliance/alerts',
      payload,
    );
    return response.data.data;
  },
  async markComplianceAlertRead(alertId: string) {
    const response = await api.patch<ApiSuccessResponse<ComplianceAlertRecord>>(
      `/api/school/compliance/alerts/${alertId}/read`,
    );
    return response.data.data;
  },
  async getComplianceActions() {
    const response = await api.get<ApiSuccessResponse<ComplianceActionRecord[]>>(
      '/api/school/compliance/actions',
    );
    return response.data.data;
  },
  async createComplianceAction(payload: {
    incidentId?: string;
    title: string;
    details?: string;
    ownerId?: string;
    dueAt?: string;
    status?: ComplianceActionRecord['status'];
    priority?: ComplianceActionRecord['priority'];
  }) {
    const response = await api.post<ApiSuccessResponse<ComplianceActionRecord>>(
      '/api/school/compliance/actions',
      payload,
    );
    return response.data.data;
  },
  async updateComplianceAction(actionId: string, payload: Partial<{
    title: string;
    details?: string;
    ownerId?: string;
    dueAt?: string;
    status: ComplianceActionRecord['status'];
    priority: ComplianceActionRecord['priority'];
    completionNote?: string;
  }>) {
    const response = await api.patch<ApiSuccessResponse<ComplianceActionRecord>>(
      `/api/school/compliance/actions/${actionId}`,
      payload,
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
