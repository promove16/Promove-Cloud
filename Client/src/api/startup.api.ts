import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import { CapTableResponse } from '../types/deal.types';
import {
  Startup,
  StartupBusinessProfile,
  StartupDocumentCategory,
  StartupInitializationProfile,
  StartupPitchRequest,
  StartupRegistrationProfile,
} from '../types/startup.types';

export interface StartupPayload {
  projectId?: string;
  name: string;
  tagline: string;
  category: string;
  stage: Startup['stage'];
  fundingNeeded?: number;
  activeProducts: number;
  teamSize: number;
  traction: {
    patentFiled: boolean;
    mvpBuilt: boolean;
    revenueGenerating: boolean;
    usersCount?: number;
    patentType?: 'self_filed' | 'promove_assisted';
    patentApplicationId?: string;
  };
  businessProfile: StartupBusinessProfile;
  registrationProfile: StartupRegistrationProfile;
  initializationProfile: StartupInitializationProfile;
}

export const startupApi = {
  async create(payload: StartupPayload) {
    const response = await api.post<ApiSuccessResponse<Startup>>('/api/startup', payload);
    return response.data.data;
  },
  async mine() {
    const response = await api.get<ApiSuccessResponse<Startup[]>>('/api/startup/mine');
    return response.data.data;
  },
  async getById(startupId: string) {
    const response = await api.get<ApiSuccessResponse<Startup>>(`/api/startup/${startupId}`);
    return response.data.data;
  },
  async update(startupId: string, payload: Partial<StartupPayload>) {
    const response = await api.patch<ApiSuccessResponse<Startup>>(`/api/startup/${startupId}`, payload);
    return response.data.data;
  },
  async requestReview(startupId: string) {
    const response = await api.post<ApiSuccessResponse<Startup>>(`/api/startup/${startupId}/request-review`);
    return response.data.data;
  },
  async launch(startupId: string, launchTo: 'investors' | 'mentors' | 'both' | 'recruiters') {
    const response = await api.post<ApiSuccessResponse<Startup>>(`/api/startup/${startupId}/launch`, { launchTo });
    return response.data.data;
  },
  async uploadPitch(startupId: string, file: File) {
    const body = new FormData();
    body.append('file', file);
    const response = await api.post<ApiSuccessResponse<Startup>>(`/api/startup/${startupId}/upload-pitch`, body);
    return response.data.data;
  },
  async uploadDocument(startupId: string, file: File, category: StartupDocumentCategory, note?: string) {
    const body = new FormData();
    body.append('file', file);
    body.append('category', category);
    if (note) {
      body.append('note', note);
    }
    const response = await api.post<ApiSuccessResponse<Startup>>(`/api/startup/${startupId}/documents`, body);
    return response.data.data;
  },
  async deleteDocument(startupId: string, documentId: string) {
    const response = await api.delete<ApiSuccessResponse<Startup>>(`/api/startup/${startupId}/documents/${documentId}`);
    return response.data.data;
  },
  async promoteToCoFounder(startupId: string, memberId: string) {
    const response = await api.post<ApiSuccessResponse<Startup>>(`/api/startup/${startupId}/members/${memberId}/promote`);
    return response.data.data;
  },
  async demoteFromCoFounder(startupId: string, memberId: string) {
    const response = await api.post<ApiSuccessResponse<Startup>>(`/api/startup/${startupId}/members/${memberId}/demote`);
    return response.data.data;
  },
  async sendPitchRequest(startupId: string, investorId: string) {
    const response = await api.post<ApiSuccessResponse<Startup>>(`/api/startup/${startupId}/pitch-request`, { investorId });
    return response.data.data;
  },
  async respondToPitchRequest(startupId: string, requestId: string, decision: 'accepted' | 'rejected', note?: string) {
    const response = await api.patch<ApiSuccessResponse<Startup>>(`/api/startup/${startupId}/pitch-request/${requestId}`, { decision, note });
    return response.data.data;
  },
  async getPitchRequests() {
    const response = await api.get<ApiSuccessResponse<StartupPitchRequest[]>>('/api/startup/pitch-requests');
    return response.data.data;
  },
  async getCapTable(startupId: string) {
    const response = await api.get<ApiSuccessResponse<CapTableResponse>>(`/api/startups/${startupId}/cap-table`);
    return response.data.data;
  },
};
