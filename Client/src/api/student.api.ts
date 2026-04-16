import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import { AuthUser } from '../types/auth.types';

export interface StudentMentorSessionItem {
  _id: string;
  mentor: {
    _id: string;
    displayName: string;
    avatar?: string;
  };
  workspaceId?: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  meetLink?: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  mentorNotes?: string;
  studentFeedback?: string;
  createdAt: string;
}

export interface StudentInstitutionMentorshipProgramItem {
  _id: string;
  institution: {
    _id: string;
    displayName: string;
    type: 'school' | 'college';
  };
  mentor?: {
    _id: string;
    displayName: string;
    avatar?: string;
    domain?: string;
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
  preferredExpertise?: string;
  status: 'Pending' | 'Assigned' | 'Rejected';
  createdAt: string;
}

export const studentApi = {
  async getMentorSessions() {
    const response = await api.get<ApiSuccessResponse<StudentMentorSessionItem[]>>('/api/users/me/sessions');
    return response.data.data;
  },
  async getInstitutionMentorshipPrograms() {
    const response = await api.get<ApiSuccessResponse<StudentInstitutionMentorshipProgramItem[]>>(
      '/api/users/me/institution-mentorship-programs',
    );
    return response.data.data;
  },
  async launchToRecruiters() {
    const response = await api.post<ApiSuccessResponse<{ bridgesCreated: number; user: AuthUser }>>(
      '/api/users/me/launch-to-recruiters',
    );
    return response.data.data;
  },
};
