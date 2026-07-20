import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import {
  RecruiterCollegeCard,
  RecruiterDashboardData,
  RecruiterHiringEventView,
  RecruiterJobDetail,
  RecruiterJobApplicantView,
  RecruiterJobApplicationStage,
  RecruiterJobPipelineView,
  RecruiterJobView,
  RecruiterListResponse,
  RecruiterMessageCheck,
  RecruiterPlacementRow,
  RecruiterStudentApplicationView,
  RecruiterTalentProfile,
  RecruiterTalentSummary,
} from '../types/recruiter.types';

const normalizeTalentSummary = (student: Partial<RecruiterTalentSummary>): RecruiterTalentSummary => ({
  _id: student._id ?? '',
  displayName: student.displayName ?? 'Student',
  ...(student.avatar ? { avatar: student.avatar } : {}),
  innovationScore: student.innovationScore ?? 0,
  scoreBreakdown: {
    problemsClaimed: student.scoreBreakdown?.problemsClaimed ?? 0,
    problemsCompleted: student.scoreBreakdown?.problemsCompleted ?? 0,
    skillsCompleted: student.scoreBreakdown?.skillsCompleted ?? 0,
    progressUploads: student.scoreBreakdown?.progressUploads ?? 0,
    patentsSubmitted: student.scoreBreakdown?.patentsSubmitted ?? 0,
    patentsApproved: student.scoreBreakdown?.patentsApproved ?? 0,
    mvpsVerified: student.scoreBreakdown?.mvpsVerified ?? 0,
    marketReadyVerified: student.scoreBreakdown?.marketReadyVerified ?? 0,
    startupsLaunched: student.scoreBreakdown?.startupsLaunched ?? 0,
  },
  skills: student.skills ?? [],
  ...(student.institution
    ? {
        institution: {
          _id: student.institution._id ?? '',
          name: student.institution.name ?? 'Institution',
          location: student.institution.location ?? '',
          ...(student.institution.academicYear ? { academicYear: student.institution.academicYear } : {}),
          ...(typeof student.institution.iicStarRating === 'number'
            ? { iicStarRating: student.institution.iicStarRating }
            : {}),
        },
      }
    : {}),
  ...(student.activeProject
    ? {
        activeProject: {
          title: student.activeProject.title ?? 'Active project',
          category: student.activeProject.category ?? 'General',
          stage: student.activeProject.stage ?? 'In progress',
          progressPercent: student.activeProject.progressPercent ?? 0,
        },
      }
    : {}),
  canContact: student.canContact ?? false,
  ...(student.bridgeType ? { bridgeType: student.bridgeType } : {}),
  ...(student.contactEmail ? { contactEmail: student.contactEmail } : {}),
  createdAt: student.createdAt ?? new Date(0).toISOString(),
});

const normalizeListResponse = <T>(response: Partial<RecruiterListResponse<T>> | undefined, mapItem: (item: T) => T) => ({
  items: (response?.items ?? []).map((item) => mapItem(item)),
  page: response?.page ?? 1,
  limit: response?.limit ?? ((response?.items?.length ?? 0) || 20),
  total: response?.total ?? response?.items?.length ?? 0,
  nextPage: response?.nextPage ?? null,
});

const normalizeJobDetail = (job: Partial<RecruiterJobDetail>): RecruiterJobDetail => ({
  _id: job._id ?? '',
  recruiterId: job.recruiterId ?? '',
  title: job.title ?? 'Untitled role',
  company: job.company ?? 'Recruiter',
  description: job.description ?? '',
  domain: job.domain ?? 'General',
  minimumInnovationScore: job.minimumInnovationScore ?? 0,
  type: job.type ?? 'Full-time',
  location: job.location ?? 'Remote',
  ...(job.workMode ? { workMode: job.workMode } : {}),
  ...(job.salaryExpectation ? { salaryExpectation: job.salaryExpectation } : {}),
  ...(job.experienceLevel ? { experienceLevel: job.experienceLevel } : {}),
  ...(typeof job.openings === 'number' ? { openings: job.openings } : {}),
  ...(job.companyOverview ? { companyOverview: job.companyOverview } : {}),
  ...(job.roleSummary ? { roleSummary: job.roleSummary } : {}),
  keyResponsibilities: job.keyResponsibilities ?? [],
  requirements: job.requirements ?? [],
  benefits: job.benefits ?? [],
  applicationSteps: job.applicationSteps ?? [],
  isActive: job.isActive ?? false,
  applicantCount: job.applicantCount ?? job.applicantIds?.length ?? 0,
  shortlistedCount: job.shortlistedCount ?? job.shortlistedIds?.length ?? 0,
  ...(typeof job.hasApplied === 'boolean' ? { hasApplied: job.hasApplied } : {}),
  ...(job.applicationStage ? { applicationStage: job.applicationStage } : {}),
  ...(job.applicationSource ? { applicationSource: job.applicationSource } : {}),
  ...(job.applicationUpdatedAt ? { applicationUpdatedAt: job.applicationUpdatedAt } : {}),
  createdAt: job.createdAt ?? new Date(0).toISOString(),
  ...(job.expiresAt ? { expiresAt: job.expiresAt } : {}),
  applicantIds: job.applicantIds ?? [],
  shortlistedIds: job.shortlistedIds ?? [],
});

const normalizeHiringEventView = (event: Partial<RecruiterHiringEventView>): RecruiterHiringEventView => ({
  _id: event._id ?? '',
  title: event.title ?? 'Hiring event',
  type: event.type ?? 'Hiring event',
  category: 'hiring',
  description: event.description ?? '',
  scheduledAt: event.scheduledAt ?? new Date(0).toISOString(),
  isActive: event.isActive ?? false,
  institutionId: event.institutionId ?? '',
  collegeName: event.collegeName ?? 'College',
  recruiterId: event.recruiterId ?? '',
  ...(event.linkedJobId ? { linkedJobId: event.linkedJobId } : {}),
  ...(event.jobTitle ? { jobTitle: event.jobTitle } : {}),
  ...(event.companyName ? { companyName: event.companyName } : {}),
  minimumInnovationScore: event.minimumInnovationScore ?? 0,
  participantsCount: event.participantsCount ?? event.participants?.length ?? 0,
  participants: event.participants ?? [],
  ...(event.rankingsComputedAt ? { rankingsComputedAt: event.rankingsComputedAt } : {}),
  rankings: event.rankings ?? [],
});

const normalizeCollegeCard = (college: Partial<RecruiterCollegeCard>): RecruiterCollegeCard => ({
  _id: college._id ?? '',
  displayName: college.displayName ?? 'College',
  location: college.location ?? '',
  studentCount: college.studentCount ?? 0,
  placementVelocity: college.placementVelocity ?? 0,
  iicStarRating: college.iicStarRating ?? 0,
  focusLabel: college.focusLabel ?? 'Innovation',
});

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
    return normalizeListResponse(response.data.data, normalizeTalentSummary);
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
    return normalizeListResponse(response.data.data, normalizeTalentSummary);
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
    return (response.data.data ?? []).map((job) => normalizeJobDetail(job));
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
  async inviteStudentToJob(jobId: string, studentId: string, payload?: { note?: string }) {
    const response = await api.post<
      ApiSuccessResponse<{ invited: boolean; alreadyApplied: boolean; alreadyInvited: boolean }>
    >(`/api/recruiter/jobs/${jobId}/invite/${studentId}`, payload ?? {});
    return response.data.data;
  },
  async getJobApplications(jobId: string) {
    const response = await api.get<ApiSuccessResponse<RecruiterJobPipelineView>>(
      `/api/recruiter/jobs/${jobId}/applications`,
    );
    return response.data.data;
  },
  async getMyApplications() {
    const response = await api.get<ApiSuccessResponse<RecruiterStudentApplicationView[]>>(
      '/api/recruiter/applications/me',
    );
    return response.data.data;
  },
  async updateJobApplication(
    jobId: string,
    studentId: string,
    payload: {
      stage: RecruiterJobApplicationStage;
      note?: string;
    },
  ) {
    const response = await api.patch<ApiSuccessResponse<RecruiterJobApplicantView>>(
      `/api/recruiter/jobs/${jobId}/applications/${studentId}`,
      payload,
    );
    return response.data.data;
  },
  async getHiringEvents() {
    const response = await api.get<ApiSuccessResponse<RecruiterHiringEventView[]>>('/api/events/hiring');
    return (response.data.data ?? []).map((event) => normalizeHiringEventView(event));
  },
  async selectStudentFromEvent(
    eventId: string,
    studentId: string,
    payload: { jobId: string; note?: string },
  ) {
    const response = await api.post<ApiSuccessResponse<{ selected: boolean }>>(
      `/api/events/hiring/${eventId}/select/${studentId}`,
      payload,
    );
    return response.data.data;
  },
  async sendHiringEventInvite(
    collegeId: string,
    payload: {
      title: string;
      type:
      | 'Placement Drive'
      | 'Internship Drive'
      | 'Hackathon'
      | 'Industry Connect Session'
      | 'Placement Hackathon'
      | 'Innovation Drive'
      | 'Other'
      | 'Walk-in Drive';
      date: string;
      description: string;
      linkedJobId?: string;
      minimumInnovationScore: number;
      message?: string;
    },
  ) {
    const response = await api.post<ApiSuccessResponse<{ sent: boolean; alreadyPending?: boolean }>>(
      `/api/events/hiring-invite/${collegeId}`,
      payload,
    );
    return response.data.data;
  },
  async closeEvent(eventId: string) {
    const response = await api.patch<ApiSuccessResponse<{ updated: boolean }>>(
      `/api/events/${eventId}/close`,
    );
    return response.data.data;
  },
  async getColleges() {
    const response = await api.get<ApiSuccessResponse<RecruiterCollegeCard[]>>('/api/recruiter/colleges');
    return (response.data.data ?? []).map((college) => normalizeCollegeCard(college));
  },
  async getLinkedColleges() {
    const response = await api.get<ApiSuccessResponse<RecruiterCollegeCard[]>>('/api/recruiter/colleges/linked');
    return (response.data.data ?? []).map((college) => normalizeCollegeCard(college));
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
