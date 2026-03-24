import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import { ChatMessage, Workspace, WorkspaceTask, WorkspaceUpload } from '../types/workspace.types';

export interface WorkspacePayload {
  title: string;
  category: string;
  claimedProblemId?: string;
}

export interface WorkspaceProgressPayload {
  note: string;
  milestoneRef?: string;
  completionPercent?: number;
}

export interface WorkspaceTaskPayload {
  title: string;
  priority: 'High' | 'Medium' | 'Low';
  assignedTo?: string;
  dueDate?: string;
}

export const workspaceApi = {
  async list() {
    const response = await api.get<ApiSuccessResponse<Workspace[]>>('/api/workspace');
    return response.data.data;
  },
  async create(payload: WorkspacePayload) {
    const response = await api.post<ApiSuccessResponse<Workspace>>('/api/workspace', payload);
    return response.data.data;
  },
  async getById(workspaceId: string) {
    const response = await api.get<ApiSuccessResponse<Workspace>>(`/api/workspace/${workspaceId}`);
    return response.data.data;
  },
  async update(workspaceId: string, payload: Partial<WorkspacePayload> & { stage?: Workspace['stage'] }) {
    const response = await api.patch<ApiSuccessResponse<Workspace>>(`/api/workspace/${workspaceId}`, payload);
    return response.data.data;
  },
  async addProgress(workspaceId: string, payload: WorkspaceProgressPayload) {
    const response = await api.post<ApiSuccessResponse<Workspace>>(`/api/workspace/${workspaceId}/progress`, payload);
    return response.data.data;
  },
  async upload(workspaceId: string, file: File, note?: string) {
    const body = new FormData();
    body.append('file', file);
    if (note) {
      body.append('note', note);
    }

    const response = await api.post<ApiSuccessResponse<WorkspaceUpload[]>>(
      `/api/workspace/${workspaceId}/upload`,
      body,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response.data.data;
  },
  async removeUpload(workspaceId: string, uploadId: string) {
    const response = await api.delete<ApiSuccessResponse<WorkspaceUpload[]>>(
      `/api/workspace/${workspaceId}/upload/${uploadId}`,
    );
    return response.data.data;
  },
  async addTask(workspaceId: string, payload: WorkspaceTaskPayload) {
    const response = await api.post<ApiSuccessResponse<WorkspaceTask[]>>(`/api/workspace/${workspaceId}/tasks`, payload);
    return response.data.data;
  },
  async updateTask(workspaceId: string, taskId: string, payload: Partial<WorkspaceTaskPayload> & { done?: boolean }) {
    const response = await api.patch<ApiSuccessResponse<WorkspaceTask[]>>(
      `/api/workspace/${workspaceId}/tasks/${taskId}`,
      payload,
    );
    return response.data.data;
  },
  async deleteTask(workspaceId: string, taskId: string) {
    const response = await api.delete<ApiSuccessResponse<WorkspaceTask[]>>(
      `/api/workspace/${workspaceId}/tasks/${taskId}`,
    );
    return response.data.data;
  },
  async invite(workspaceId: string, payload: { email?: string; userId?: string }) {
    const response = await api.post<ApiSuccessResponse<Workspace>>(`/api/workspace/${workspaceId}/invite`, payload);
    return response.data.data;
  },
  async removeMember(workspaceId: string, userId: string) {
    const response = await api.delete<ApiSuccessResponse<Workspace>>(
      `/api/workspace/${workspaceId}/members/${userId}`,
    );
    return response.data.data;
  },
  async getChatHistory(workspaceId: string, before?: string, limit = 50) {
    const response = await api.get<ApiSuccessResponse<ChatMessage[]>>(`/api/workspace/${workspaceId}/chat`, {
      params: { before, limit },
    });
    return response.data.data;
  },
};
