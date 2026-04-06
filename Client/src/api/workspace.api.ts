import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import { TemporaryMemoryMode } from '../lib/temporaryMemory';
import {
  ChatMessage,
  Workspace,
  WorkspaceTask,
  WorkspaceUpload,
} from '../types/workspace.types';

export interface AddChatParticipantPayload {
  email?: string;
  userId?: string;
  role: 'mentor' | 'investor';
}

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

export interface WorkspaceRepoSubmissionPayload {
  repoUrl: string;
  branch?: string;
  commitHash?: string;
  note?: string;
}

export interface WorkspaceCodeSubmissionPayload {
  title: string;
  language: string;
  summary?: string;
  codeSnippet: string;
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
  async upload(
    workspaceId: string,
    file: File,
    note?: string,
    category?: string,
    memoryMode?: TemporaryMemoryMode,
  ) {
    const body = new FormData();
    body.append('file', file);
    if (note) {
      body.append('note', note);
    }
    if (category) {
      body.append('category', category);
    }
    if (memoryMode) {
      body.append('memoryMode', memoryMode);
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
  async addRepoSubmission(workspaceId: string, payload: WorkspaceRepoSubmissionPayload) {
    const response = await api.post<ApiSuccessResponse<Workspace>>(`/api/workspace/${workspaceId}/repos`, payload);
    return response.data.data;
  },
  async removeRepoSubmission(workspaceId: string, repoId: string) {
    const response = await api.delete<ApiSuccessResponse<Workspace>>(`/api/workspace/${workspaceId}/repos/${repoId}`);
    return response.data.data;
  },
  async addCodeSubmission(workspaceId: string, payload: WorkspaceCodeSubmissionPayload) {
    const response = await api.post<ApiSuccessResponse<Workspace>>(`/api/workspace/${workspaceId}/code`, payload);
    return response.data.data;
  },
  async removeCodeSubmission(workspaceId: string, codeId: string) {
    const response = await api.delete<ApiSuccessResponse<Workspace>>(`/api/workspace/${workspaceId}/code/${codeId}`);
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
  async addChatParticipant(workspaceId: string, payload: AddChatParticipantPayload) {
    const response = await api.post<ApiSuccessResponse<Workspace>>(
      `/api/workspace/${workspaceId}/chat-participants`,
      payload,
    );
    return response.data.data;
  },
  async removeChatParticipant(workspaceId: string, participantUserId: string) {
    const response = await api.delete<ApiSuccessResponse<Workspace>>(
      `/api/workspace/${workspaceId}/chat-participants/${participantUserId}`,
    );
    return response.data.data;
  },
};
