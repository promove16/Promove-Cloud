import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import { CollegeEventRankingsResponse } from '../types/college.types';

export const eventApi = {
  async joinEvent(eventId: string) {
    const response = await api.post<ApiSuccessResponse<{ success: boolean }>>(
      `/api/events/${eventId}/join`,
    );
    return response.data.data;
  },
  async addSubmissionScore(eventId: string, studentId: string, score: number) {
    const response = await api.patch<ApiSuccessResponse<{ success: boolean }>>(
      `/api/events/${eventId}/participants/${studentId}/submission-score`,
      { score },
    );
    return response.data.data;
  },
  async computeRankings(eventId: string) {
    const response = await api.post<ApiSuccessResponse<{ rankings: CollegeEventRankingsResponse['rankings'] }>>(
      `/api/events/${eventId}/compute-rankings`,
    );
    return response.data.data;
  },
  async getRankings(eventId: string) {
    const response = await api.get<ApiSuccessResponse<CollegeEventRankingsResponse>>(
      `/api/events/${eventId}/rankings`,
    );
    return response.data.data;
  },
};
