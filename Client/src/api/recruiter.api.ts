import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import {
  RecruiterCollegeCard,
  RecruiterDashboardData,
  RecruiterDriveView,
  RecruiterJobDetail,
  RecruiterJobView,
  RecruiterListResponse,
  RecruiterMessageCheck,
  RecruiterPlacementRow,
  RecruiterTalentProfile,
  RecruiterTalentSummary,
} from '../types/recruiter.types';

export const recruiterApi = {
  async getDashboard() {
    const response = await api.get<ApiSuccessResponse<RecruiterDashboardData>>('/api/recruiter/dashboard');
    return response.data.data;
  },
  async getTalentPipeline(params?: {
    minScore?: number;
    maxScore?: number;
    domain?: string;
    institution?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await api.get<ApiSuccessResponse<RecruiterListResponse<RecruiterTalentSummary>>>(
      '/api/recruiter/talent',
      { params },
    );
    return response.data.data;
  },
  async discoverTalent(params?: {
    minScore?: number;
    maxScore?: number;
    domain?: string;
    institution?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await api.get<ApiSuccessResponse<RecruiterListResponse<RecruiterTalentSummary>>>(
      '/api/recruiter/talent/search',
      { params },
    );
    return response.data.data;
  },
  async getTalentProfile(studentId: string) {
    const response = await api.get<ApiSuccessResponse<RecruiterTalentProfile>>(
      `/api/recruiter/talent/${studentId}`,
    );
    return response.data.data;
  },
  async shortlistStudent(studentId: string) {
    const response = await api.post<ApiSuccessResponse<{ bridgeCreated: boolean }>>(
      `/api/recruiter/shortlist/${studentId}`,
    );
    return response.data.data;
  },
  async removeShortlist(studentId: string) {
    const response = await api.delete<ApiSuccessResponse<{ bridgeCreated: boolean }>>(
      `/api/recruiter/shortlist/${studentId}`,
    );
    return response.data.data;
  },
  async getJobs() {
    const response = await api.get<ApiSuccessResponse<RecruiterJobDetail[]>>('/api/recruiter/jobs');
    return response.data.data;
  },
  async getPublicJobs(recruiterId: string) {
    const response = await api.get<ApiSuccessResponse<RecruiterJobView[]>>(
      `/api/recruiter/jobs/public/${recruiterId}`,
    );
    return response.data.data;
  },
  async getPublicJob(jobId: string) {
    const response = await api.get<ApiSuccessResponse<RecruiterJobView>>(
      `/api/recruiter/jobs/public/job/${jobId}`,
    );
    return response.data.data;
  },
  async createJob(payload: {
    title: string;
    company: string;
    description: string;
    domain: string;
    minimumInnovationScore: number;
    type: 'Full-time' | 'Internship' | 'Contract' | 'Part-time';
    location: string;
    workMode?: 'On-site' | 'Hybrid' | 'Remote';
    salaryExpectation?: string;
    experienceLevel?: string;
    openings?: number;
    companyOverview?: string;
    roleSummary?: string;
    keyResponsibilities?: string[];
    requirements?: string[];
    benefits?: string[];
    applicationSteps?: string[];
    expiresAt?: string;
  }) {
    const response = await api.post<ApiSuccessResponse<RecruiterJobView>>('/api/recruiter/jobs', payload);
    return response.data.data;
  },
  async updateJob(jobId: string, payload: Partial<{
    title: string;
    company: string;
    description: string;
    domain: string;
    minimumInnovationScore: number;
    type: 'Full-time' | 'Internship' | 'Contract' | 'Part-time';
    location: string;
    workMode: 'On-site' | 'Hybrid' | 'Remote';
    salaryExpectation: string;
    experienceLevel: string;
    openings: number;
    companyOverview: string;
    roleSummary: string;
    keyResponsibilities: string[];
    requirements: string[];
    benefits: string[];
    applicationSteps: string[];
    isActive: boolean;
    expiresAt: string;
  }>) {
    const response = await api.patch<ApiSuccessResponse<RecruiterJobView>>(
      `/api/recruiter/jobs/${jobId}`,
      payload,
    );
    return response.data.data;
  },
  async deleteJob(jobId: string) {
    const response = await api.delete<ApiSuccessResponse<RecruiterJobView>>(`/api/recruiter/jobs/${jobId}`);
    return response.data.data;
  },
  async applyToJob(jobId: string) {
    const response = await api.post<ApiSuccessResponse<{ applied: boolean; alreadyApplied: boolean }>>(
      `/api/recruiter/jobs/${jobId}/apply`,
    );
    return response.data.data;
  },
  async getDrives() {
    const response = await api.get<ApiSuccessResponse<RecruiterDriveView[]>>('/api/recruiter/drives');
    return response.data.data;
  },
  async createDrive(payload: {
    title: string;
    collegeId: string;
    type: 'Placement Drive' | 'Internship Drive' | 'Hackathon';
    scheduledAt: string;
    description: string;
    minimumInnovationScore: number;
  }) {
    const response = await api.post<ApiSuccessResponse<RecruiterDriveView>>('/api/recruiter/drives', payload);
    return response.data.data;
  },
  async registerForDrive(driveId: string) {
    const response = await api.post<ApiSuccessResponse<{ registered: boolean }>>(
      `/api/recruiter/drives/${driveId}/register`,
    );
    return response.data.data;
  },
  async submitDriveScore(
    driveId: string,
    payload: { studentId: string; submissionScore: number },
  ) {
    const response = await api.post<ApiSuccessResponse<{ updated: boolean }>>(
      `/api/recruiter/drives/${driveId}/submit-score`,
      payload,
    );
    return response.data.data;
  },
  async closeDrive(driveId: string) {
    const response = await api.patch<ApiSuccessResponse<{ updated: boolean }>>(
      `/api/recruiter/drives/${driveId}/close`,
    );
    return response.data.data;
  },
  async getColleges() {
    const response = await api.get<ApiSuccessResponse<RecruiterCollegeCard[]>>('/api/recruiter/colleges');
    return response.data.data;
  },
  async getOnboarding() {
    const response = await api.get<ApiSuccessResponse<RecruiterPlacementRow[]>>('/api/recruiter/onboarding');
    return response.data.data;
  },
  async markHired(studentId: string, companyName: string) {
    const response = await api.post<ApiSuccessResponse<{ updated: boolean }>>(
      `/api/recruiter/hired/${studentId}`,
      { companyName },
    );
    return response.data.data;
  },
  async getMessageCheck(studentId: string) {
    const response = await api.get<ApiSuccessResponse<RecruiterMessageCheck>>(
      `/api/recruiter/message-check/${studentId}`,
    );
    return response.data.data;
  },
  async sendMessage(studentId: string, body?: string) {
    const response = await api.post<ApiSuccessResponse<{ sent: boolean }>>(
      `/api/recruiter/message/${studentId}`,
      body ? { body } : {},
    );
    return response.data.data;
  },
  async sendOnboardingReminder(studentId: string, message?: string) {
    const response = await api.post<ApiSuccessResponse<{ sent: boolean }>>(
      `/api/recruiter/onboarding/${studentId}/reminder`,
      message ? { message } : {},
    );
    return response.data.data;
  },
  async requestPartnership(collegeId: string, message?: string) {
    const response = await api.post<ApiSuccessResponse<{ sent: boolean }>>(
      `/api/recruiter/colleges/${collegeId}/partnership-request`,
      message ? { message } : {},
    );
    return response.data.data;
  },
};
