import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';

export interface SmartChatRequest {
  message: string;
  context?: {
    pathname?: string;
    routeLabel?: string;
  };
}

export interface SmartChatReply {
  reply: string;
}

export const smartChatApi = {
  async sendMessage(payload: SmartChatRequest) {
    const response = await api.post<ApiSuccessResponse<SmartChatReply>>(
      '/api/smart-chat',
      payload,
    );
    return response.data.data;
  },
};
