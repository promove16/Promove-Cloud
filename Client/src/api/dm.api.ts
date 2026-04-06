import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';

export type QueryType = 'project_mentor' | 'project_join' | 'investor' | 'recruiter' | 'general';

export interface DMMessage {
  _id: string;
  senderId: string;
  recipientId: string;
  message: string;
  messageType: 'text' | 'interview_request';
  queryType?: QueryType;
  scheduledAt?: string;
  meetLink?: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'pdf';
  attachmentName?: string;
  readAt?: string | null;
  sentAt: string;
  isOptimistic?: boolean;
}

export interface AttachmentUpload {
  url: string;
  publicId: string;
  fileType: 'image' | 'pdf';
  fileName: string;
  fileSize: number;
}

export interface DMPartner {
  _id: string;
  displayName: string;
  avatar?: string;
  role: string;
  isOnline?: boolean;
}

export interface DMConversation {
  partnerId: string;
  partner: DMPartner | null;
  lastMessage: Pick<DMMessage, '_id' | 'message' | 'messageType' | 'sentAt' | 'senderId' | 'readAt'>;
  unreadCount: number;
  isOnline?: boolean;
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
  async getPartnerProfile(userId: string) {
    const response = await api.get<ApiSuccessResponse<DMPartner>>(`/api/dm/partner/${userId}`);
    return response.data.data;
  },
  async send(userId: string, payload: {
    message?: string;
    messageType?: 'text' | 'interview_request';
    scheduledAt?: string;
    meetLink?: string;
    queryType?: QueryType;
    attachmentUrl?: string;
    attachmentType?: 'image' | 'pdf';
    attachmentName?: string;
  }) {
    const response = await api.post<ApiSuccessResponse<DMMessage>>(`/api/dm/${userId}`, payload);
    return response.data.data;
  },
  async markAsRead(userId: string) {
    const response = await api.patch<ApiSuccessResponse<{ modifiedCount: number }>>(`/api/dm/${userId}/read`);
    return response.data.data;
  },
  async searchUsers(query: string) {
    const response = await api.get<ApiSuccessResponse<Array<{
      _id: string;
      displayName: string;
      avatar?: string;
      role: string;
    }>>>(`/api/users/search`, { params: { q: query } });
    return response.data.data;
  },
  async uploadAttachment(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<ApiSuccessResponse<AttachmentUpload>>('/api/dm/upload', formData);
    return response.data.data;
  },
};
