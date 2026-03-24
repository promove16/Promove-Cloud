import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import { ChatMessage } from '../types/workspace.types';

export const chatApi = {
  async getHistory(workspaceId: string, before?: string, limit = 50) {
    const response = await api.get<ApiSuccessResponse<ChatMessage[]>>(`/api/chat/workspace/${workspaceId}`, {
      params: { before, limit },
    });
    return response.data.data;
  },
};
