import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';

export interface ForumAuthor {
  _id: string;
  displayName: string;
  avatar?: string;
  role: string;
  headline?: string;
}

export interface ForumPost {
  _id: string;
  authorId: ForumAuthor;
  authorRole: string;
  title: string;
  body: string;
  tags: string[];
  answerCount: number;
  viewCount: number;
  solved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ForumAnswer {
  _id: string;
  postId: string;
  authorId: ForumAuthor;
  authorRole: string;
  body: string;
  helpfulVotes: string[];
  helpfulCount: number;
  isVerifiedSolution: boolean;
  createdAt: string;
}

export const forumApi = {
  async listPosts(params?: { tag?: string; solved?: boolean; page?: number; limit?: number }) {
    const res = await api.get<ApiSuccessResponse<{ posts: ForumPost[]; total: number; page: number; limit: number }>>(
      '/api/forum',
      { params },
    );
    return res.data.data;
  },

  async getPost(id: string) {
    const res = await api.get<ApiSuccessResponse<{ post: ForumPost; answers: ForumAnswer[] }>>(
      `/api/forum/${id}`,
    );
    return res.data.data;
  },

  async createPost(body: { title: string; body: string; tags?: string[] }) {
    const res = await api.post<ApiSuccessResponse<ForumPost>>('/api/forum', body);
    return res.data.data;
  },

  async createAnswer(postId: string, body: string) {
    const res = await api.post<ApiSuccessResponse<ForumAnswer>>(`/api/forum/${postId}/answers`, { body });
    return res.data.data;
  },

  async markHelpful(answerId: string) {
    const res = await api.post<ApiSuccessResponse<{ helpful: boolean }>>(
      `/api/forum/answers/${answerId}/helpful`,
    );
    return res.data.data;
  },

  async markVerifiedSolution(answerId: string) {
    const res = await api.patch<ApiSuccessResponse<{ verified: boolean }>>(
      `/api/forum/answers/${answerId}/verify`,
    );
    return res.data.data;
  },
};
