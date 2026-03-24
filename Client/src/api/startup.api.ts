import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import { Startup } from '../types/startup.types';

export interface StartupPayload {
  projectId?: string;
  name: string;
  tagline: string;
  category: string;
  stage: Startup['stage'];
  fundingNeeded?: number;
  activeProducts: number;
  teamSize: number;
  traction: Startup['traction'];
}

export const startupApi = {
  async create(payload: StartupPayload) {
    const response = await api.post<ApiSuccessResponse<Startup>>('/api/startup', payload);
    return response.data.data;
  },
  async mine() {
    const response = await api.get<ApiSuccessResponse<Startup | null>>('/api/startup/mine');
    return response.data.data;
  },
  async update(startupId: string, payload: Partial<StartupPayload>) {
    const response = await api.patch<ApiSuccessResponse<Startup>>(`/api/startup/${startupId}`, payload);
    return response.data.data;
  },
  async launch(startupId: string, launchTo: 'investors' | 'mentors' | 'both' | 'recruiters') {
    const response = await api.post<ApiSuccessResponse<Startup>>(`/api/startup/${startupId}/launch`, { launchTo });
    return response.data.data;
  },
  async uploadPitch(startupId: string, file: File) {
    const body = new FormData();
    body.append('file', file);
    const response = await api.post<ApiSuccessResponse<Startup>>(`/api/startup/${startupId}/upload-pitch`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },
};
