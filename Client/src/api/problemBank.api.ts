import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import {
  Problem,
  ProblemLeaderboardResponse,
  ProblemListMeta,
} from '../types/problem.types';
import { Workspace } from '../types/workspace.types';

interface ProblemListResponse extends ApiSuccessResponse<Problem[]> {
  meta?: ProblemListMeta;
}

export interface ProblemQuery {
  search?: string;
  category?: string;
  difficulty?: string;
  domain?: string;
  page?: number;
  limit?: number;
}

export interface ProblemReviewRequestPayload {
  workspaceId: string;
  requestNote: string;
}

export const problemBankApi = {
  async list(params: ProblemQuery) {
    const response = await api.get<ProblemListResponse>('/api/problems', { params });
    return {
      items: response.data.data,
      meta: response.data.meta ?? { page: params.page ?? 1, limit: params.limit ?? 10, total: response.data.data.length },
    };
  },
  async getById(problemId: string) {
    const response = await api.get<ApiSuccessResponse<Problem>>(`/api/problems/${problemId}`);
    return response.data.data;
  },
  async claim(problemId: string) {
    const response = await api.post<ApiSuccessResponse<Workspace>>(`/api/problems/${problemId}/claim`);
    return response.data.data;
  },
  async requestReview(problemId: string, payload: ProblemReviewRequestPayload) {
    const response = await api.post<ApiSuccessResponse<{
      _id: string;
      reviewStatus: 'review_requested';
      requestedAt: string;
    }>>(`/api/problems/${problemId}/review-request`, payload);
    return response.data.data;
  },
  async getLeaderboard(problemId: string) {
    const response = await api.get<ApiSuccessResponse<ProblemLeaderboardResponse>>(
      `/api/problems/${problemId}/leaderboard`,
    );
    return response.data.data;
  },
};
