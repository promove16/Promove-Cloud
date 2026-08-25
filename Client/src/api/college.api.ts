import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import {
  ComplianceActionRecord,
  ComplianceAlertRecord,
  ComplianceIncidentRecord,
  CollegeDashboardData,
  CollegeEvent,
  CollegeEventRankingsResponse,
  InstitutionPatent,
  InstitutionStartup,
  PendingStudentVerification,
  PlacementStatusUpdateResponse,
  RecruiterDirectoryItem,
  RecentProject,
  StudentRosterEntry,
  StudentRosterImportResult,
  StudentAccessToken,
  StudentLeaderboardItem,
  StudentVerificationReviewResponse,
} from '../types/college.types';
import { BulkCredentialImportResult, ManagedStudentCredentialPreview } from '../types/school.types';
import {
  ComplianceReportRecord,
  ComplianceOverviewData,
  ComplianceEvidenceUploadResponse,
  DirectoryInvestor,
  InstitutionPolicy,
  InstitutionPolicySubmissionRecord,
  LeaderboardPage,
  StudentJourney,
  TemporaryStudentCredentials,
} from '../types/school.types';
import {
  CreateInstitutionMentorshipProgramInput,
  InstitutionMentorshipProgram,
  InstitutionMentorshipProgramView,
} from '../types/mentorship.types';
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
  async getProjects() {
    const response = await api.get<ApiSuccessResponse<RecentProject[]>>('/api/college/projects');
    return response.data.data;
  },
  async getPatents() {
    const response = await api.get<ApiSuccessResponse<InstitutionPatent[]>>('/api/college/patents');
    return response.data.data;
  },
  async getStartups() {
    const response = await api.get<ApiSuccessResponse<InstitutionStartup[]>>('/api/college/startups');
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
  async listHiringEvents() {
    const response = await api.get<ApiSuccessResponse<CollegeEvent[]>>('/api/college/events/hiring');
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
  async getComplianceOverview() {
    const response = await api.get<ApiSuccessResponse<ComplianceOverviewData>>(
      '/api/college/compliance/overview',
    );
    return response.data.data;
  },
  async getComplianceSubmission() {
    const response = await api.get<ApiSuccessResponse<InstitutionPolicySubmissionRecord | null>>(
      '/api/college/compliance/submission',
    );
    return response.data.data;
  },
  async submitComplianceSubmission(payload: {
    policies: InstitutionPolicy[];
    summaryNote?: string;
  }) {
    const response = await api.put<ApiSuccessResponse<InstitutionPolicySubmissionRecord>>(
      '/api/college/compliance/submission',
      payload,
    );
    return response.data.data;
  },
  async requestComplianceEvidenceEdit(payload: {
    submissionId: string;
    policyName: string;
    evidenceTitle: string;
    evidenceUrl: string;
  }) {
    const response = await api.post<ApiSuccessResponse<{ requestedAt: string; submissionId: string }>>(
      '/api/college/compliance/submission/evidence-edit-request',
      payload,
    );
    return response.data.data;
  },
  async uploadComplianceEvidence(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<ApiSuccessResponse<ComplianceEvidenceUploadResponse>>(
      '/api/college/compliance/evidence',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data.data;
  },
  async getComplianceIncidents(params?: {
    status?: ComplianceIncidentRecord['status'];
    severity?: ComplianceIncidentRecord['severity'];
    limit?: number;
  }) {
    const response = await api.get<ApiSuccessResponse<ComplianceIncidentRecord[]>>(
      '/api/college/compliance/incidents',
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
      '/api/college/compliance/incidents',
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
      `/api/college/compliance/incidents/${incidentId}`,
      payload,
    );
    return response.data.data;
  },
  async getComplianceAlerts(params?: { unreadOnly?: boolean; limit?: number }) {
    const response = await api.get<ApiSuccessResponse<ComplianceAlertRecord[]>>(
      '/api/college/compliance/alerts',
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
      '/api/college/compliance/alerts',
      payload,
    );
    return response.data.data;
  },
  async markComplianceAlertRead(alertId: string) {
    const response = await api.patch<ApiSuccessResponse<ComplianceAlertRecord>>(
      `/api/college/compliance/alerts/${alertId}/read`,
    );
    return response.data.data;
  },
  async getComplianceActions() {
    const response = await api.get<ApiSuccessResponse<ComplianceActionRecord[]>>(
      '/api/college/compliance/actions',
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
      '/api/college/compliance/actions',
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
      `/api/college/compliance/actions/${actionId}`,
      payload,
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
  async previewStudentRosterWithCredentials(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<ApiSuccessResponse<ManagedStudentCredentialPreview>>(
      '/api/college/student-roster/preview-credentials',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data.data;
  },
  async getMentorshipPrograms() {
    const response = await api.get<ApiSuccessResponse<InstitutionMentorshipProgramView>>(
      '/api/college/mentorship-programs',
    );
    return response.data.data;
  },
  async createMentorshipProgram(payload: CreateInstitutionMentorshipProgramInput) {
    const response = await api.post<ApiSuccessResponse<InstitutionMentorshipProgram>>(
      '/api/college/mentorship-programs',
      payload,
    );
    return response.data.data;
  },
  async getCollegeEvents() {
    const response = await api.get<ApiSuccessResponse<CollegeEvent[]>>('/api/college/events');
    return response.data.data;
  },
};
