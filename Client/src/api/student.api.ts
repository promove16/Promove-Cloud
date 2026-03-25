import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';

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

export const studentApi = {
  async getMentorSessions() {
    const response = await api.get<ApiSuccessResponse<StudentMentorSessionItem[]>>('/api/users/me/sessions');
    return response.data.data;
  },
  async launchToRecruiters() {
    const response = await api.post<ApiSuccessResponse<{ bridgesCreated: number }>>(
      '/api/users/me/launch-to-recruiters',
    );
    return response.data.data;
  },
};

