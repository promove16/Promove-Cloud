import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';

export interface DMMessage {
  _id: string;
  senderId: string;
  recipientId: string;
  message: string;
  messageType: 'text' | 'interview_request';
  scheduledAt?: string;
  meetLink?: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'pdf';
  readAt?: string;
  sentAt: string;
}

export interface DMConversation {
  partnerId: string;
  partner: {
    _id: string;
    displayName: string;
    avatar?: string;
    role: string;
  } | null;
  lastMessage: Pick<DMMessage, '_id' | 'message' | 'messageType' | 'sentAt' | 'senderId'>;
  unreadCount: number;
}

export const dmApi = {
  async listConversations() {
    const response = await api.get<ApiSuccessResponse<DMConversation[]>>('/api/dm/conversations');
    return response.data.data;
  },
  async getThread(userId: string) {
    const response = await api.get<ApiSuccessResponse<DMMessage[]>>(`/api/dm/${userId}`);
    return response.data.data;
  },
  async send(userId: string, payload: {
    message?: string;
    messageType?: 'text' | 'interview_request';
    scheduledAt?: string;
    meetLink?: string;
  }) {
    const response = await api.post<ApiSuccessResponse<DMMessage>>(`/api/dm/${userId}`, payload);
    return response.data.data;
  },
};
