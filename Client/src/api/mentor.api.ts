import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';

export interface MentorDashboardActivity {
  studentId: string;
  studentName: string;
  avatar?: string;
  trigger: string;
  newScore: number;
  delta: number;
  timestamp: string;
}

export interface MentorDashboardData {
  /** @deprecated use upcomingSessions */
  sessionsToday: number;
  /** @deprecated use pendingBids */
  pendingReviews: number;
  upcomingSessions: number;
  pendingBids: number;
  innovationScore: number;
  activeStudentCount: number;
  assignedProjectsCount: number;
  assignedProgramsCount: number;
  recentActivities: MentorDashboardActivity[];
  projectAssignments: MentorProjectAssignment[];
  institutionPrograms: MentorInstitutionProgram[];
}

export interface MentorFeedStudent {
  _id: string;
  workspaceId: string;
  studentId: string;
  displayName: string;
  avatar?: string;
  startupName: string;
  category: string;
  innovationScore: number;
  recentActivitySummary: string;
  isWatched: boolean;
  activeSince: string;
}

export interface MentorProjectAssignment {
  workspaceId: string;
  title: string;
  category: string;
  stage: string;
  progressPercent: number;
  updatedAt: string;
  startupName?: string;
  students: Array<{
    _id: string;
    displayName: string;
    avatar?: string;
    institutionName?: string;
  }>;
}

export interface MentorInstitutionProgram {
  _id: string;
  institution: {
    _id: string;
    displayName: string;
    type: 'school' | 'college';
  };
  title: string;
  objective: string;
  preferredDate: string;
  scheduledAt?: string;
  durationMinutes: number;
  expectedParticipants: number;
  deliveryMode: 'Online' | 'Offline';
  platform: 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Offline';
  meetingLink?: string;
  venue?: string;
  adminNotes?: string;
  preferredExpertise?: string;
  status: 'Assigned';
}

export interface MentorStudentProfile {
  student: {
    _id: string;
    displayName: string;
    avatar?: string;
    bio?: string;
    domain?: string;
    innovationScore: number;
    scoreBreakdown: {
      problemsClaimed: number;
      skillsCompleted: number;
      progressUploads: number;
      patentsSubmitted: number;
      patentsApproved: number;
      mvpsVerified: number;
      marketReadyVerified: number;
      startupsLaunched: number;
      awardsApproved: number;
    };
    institutionName?: string;
  };
  workspaces: Array<{
    _id: string;
    title: string;
    category: string;
    stage: string;
    progressPercent: number;
    updatedAt: string;
  }>;
  scoreEvents: Array<{
    _id: string;
    trigger: string;
    delta: number;
    scoreAfter: number;
    createdAt: string;
  }>;
  patents: Array<{
    _id: string;
    projectTitle: string;
    status: string;
    submittedAt: string;
  }>;
  startups: Array<{
    _id: string;
    name: string;
    category: string;
    stage: string;
    launchedAt?: string;
    innovationScoreAtLaunch: number;
  }>;
}

export interface MentorSessionItem {
  _id: string;
  mentor: { _id: string; displayName: string; avatar?: string };
  student: { _id: string; displayName: string; avatar?: string };
  workspaceId?: string;
  workspaceName?: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  meetLink?: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  mentorNotes?: string;
  studentFeedback?: string;
  createdAt: string;
  studentProfile?: {
    innovationScore: number;
    scoreBreakdown: MentorStudentProfile['student']['scoreBreakdown'];
  };
}

export interface MentorSessionsResponse {
  upcoming: MentorSessionItem[];
  completed: MentorSessionItem[];
  cancelled: MentorSessionItem[];
}

export interface CreateMentorSessionInput {
  studentId: string;
  workspaceId?: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  meetLink?: string;
}

export interface UpdateMentorSessionInput {
  status?: 'Scheduled' | 'Completed' | 'Cancelled';
  mentorNotes?: string;
  meetLink?: string;
}

export interface MentorWorkspaceDetail {
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
    completedBy?: string;
  }>;
  tasks: Array<{
    _id: string;
    title: string;
    priority: 'High' | 'Medium' | 'Low';
    done: boolean;
    dueDate?: string;
  }>;
  uploads: Array<{
    _id: string;
    fileUrl: string;
    fileType: 'pdf' | 'image';
    fileName: string;
    uploadedAt: string;
  }>;
  progressUpdates: Array<{
    _id: string;
    note: string;
    submittedAt: string;
  }>;
}

export interface CreateMentorFeedbackInput {
  workspaceId?: string;
  feedbackText: string;
  rating: 1 | 2 | 3 | 4 | 5;
}

export type MentorBidOpportunityKind = 'startup' | 'problem_bank';
export type MentorBidStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface MentorBidOpportunity {
  _id: string;
  kind: MentorBidOpportunityKind;
  title: string;
  description: string;
  domain: string;
  stage?: string;
  /** For startup kind */
  startupName?: string;
  /** For problem_bank kind */
  problemCode?: string;
  institution?: string;
  preferredExpertise?: string[];
  sessionsRequested?: number;
  postedAt: string;
  hasBid: boolean;
}

export interface MentorBid {
  _id: string;
  opportunityId: string;
  opportunityTitle: string;
  kind: MentorBidOpportunityKind;
  expertise: string;
  hoursPerWeek: number;
  proposedDurationWeeks: number;
  coverNote: string;
  status: MentorBidStatus;
  createdAt: string;
}

export interface SubmitMentorBidPayload {
  opportunityId: string;
  kind: MentorBidOpportunityKind;
  expertise: string;
  hoursPerWeek: number;
  proposedDurationWeeks: number;
  coverNote: string;
}

export const mentorApi = {
  async getDashboard() {
    const response = await api.get<ApiSuccessResponse<MentorDashboardData>>('/api/mentor/dashboard');
    return response.data.data;
  },
  async getStudents() {
    const response = await api.get<ApiSuccessResponse<MentorFeedStudent[]>>('/api/mentor/students');
    return response.data.data;
  },
  async getStudent(studentId: string) {
    const response = await api.get<ApiSuccessResponse<MentorStudentProfile>>(`/api/mentor/students/${studentId}`);
    return response.data.data;
  },
  async getWorkspace(studentId: string, workspaceId: string) {
    const response = await api.get<ApiSuccessResponse<MentorWorkspaceDetail>>(
      `/api/mentor/students/${studentId}/workspace/${workspaceId}`,
    );
    return response.data.data;
  },
  async createSession(payload: CreateMentorSessionInput) {
    const response = await api.post<ApiSuccessResponse<unknown>>('/api/mentor/sessions', payload);
    return response.data.data;
  },
  async getSessions() {
    const response = await api.get<ApiSuccessResponse<MentorSessionsResponse>>('/api/mentor/sessions');
    return response.data.data;
  },
  async getSession(sessionId: string) {
    const response = await api.get<ApiSuccessResponse<MentorSessionItem>>(`/api/mentor/sessions/${sessionId}`);
    return response.data.data;
  },
  async updateSession(sessionId: string, payload: UpdateMentorSessionInput) {
    const response = await api.patch<ApiSuccessResponse<MentorSessionItem>>(
      `/api/mentor/sessions/${sessionId}`,
      payload,
    );
    return response.data.data;
  },
  async deleteSession(sessionId: string) {
    const response = await api.delete<ApiSuccessResponse<{ updated: true }>>(`/api/mentor/sessions/${sessionId}`);
    return response.data.data;
  },
  async submitFeedback(studentId: string, payload: CreateMentorFeedbackInput) {
    const response = await api.post<ApiSuccessResponse<{ createdAt: string }>>(
      `/api/mentor/feedback/${studentId}`,
      payload,
    );
    return response.data.data;
  },
  async getBidOpportunities() {
    const response = await api.get<ApiSuccessResponse<MentorBidOpportunity[]>>('/api/mentor/bid-opportunities');
    return response.data.data;
  },
  async getMyBids() {
    const response = await api.get<ApiSuccessResponse<MentorBid[]>>('/api/mentor/bids');
    return response.data.data;
  },
  async submitBid(payload: SubmitMentorBidPayload) {
    const response = await api.post<ApiSuccessResponse<MentorBid>>('/api/mentor/bids', payload);
    return response.data.data;
  },
  async withdrawBid(bidId: string) {
    const response = await api.delete<ApiSuccessResponse<{ updated: true }>>(`/api/mentor/bids/${bidId}`);
    return response.data.data;
  },
};
