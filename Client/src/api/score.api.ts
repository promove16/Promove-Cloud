import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import { ScoreEvent, ScoreResponse } from '../types/score.types';

export const scoreApi = {
  async getMyScore() {
    const response = await api.get<ApiSuccessResponse<ScoreResponse>>('/api/score/me');
    return response.data.data;
  },
  async getScoreHistory(userId: string) {
    const response = await api.get<ApiSuccessResponse<ScoreEvent[]>>(`/api/score/history/${userId}`);
    return response.data.data;
  },
};
