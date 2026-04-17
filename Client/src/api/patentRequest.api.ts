import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import type {
  PatentRequestDocCategory,
  PatentRequestSubmission,
  PatentRequestApplicant,
  PatentRequestInventor,
  PatentRequestExaminationType,
  PatentApplicantEntityType,
  PatentConversationMessage,
  PatentRequestQuestionnaire,
} from '../types/patentRequest.types';
import type { PatentInventionCategory, PatentSpecificationType } from '../types/patent.types';

export interface PatentRequestPayload {
  workspaceId: string;
  inventionTitle: string;
  inventionCategory: PatentInventionCategory;
  applicantDetails: PatentRequestApplicant;
  inventors: PatentRequestInventor[];
  specificationType: PatentSpecificationType;
  technicalField: string;
  backgroundArt: string;
  inventionDescription: string;
  abstractText: string;
  claimsText: string;
  drawingsDescription?: string;
  bestMode: string;
  hasFiledAbroad: boolean;
  foreignFilingCountries?: string;
  foreignApplicationNumbers?: string;
  inventorDeclarationConfirmed: boolean;
  powerOfAttorneyGranted: boolean;
  attorneyDetails?: string;
  claimingFeeReduction: boolean;
  feeReductionEntityType?: PatentApplicantEntityType;
  dpiitRecognitionNumber?: string;
  priorArtSearchSummary: string;
  priorArtReferences?: string;
  noveltyStatement: string;
  proposedExaminationType: PatentRequestExaminationType;
  publicDisclosureStatus: boolean;
  documentUploads: { uploadId: string; category: PatentRequestDocCategory }[];
}

export interface PatentRequestCreatePayload {
  workspaceId: string;
  projectTitle: string;
  description: string;
  patentType: 'invention' | 'design' | 'trademark';
  questionnaire?: PatentRequestQuestionnaire;
}

export const patentRequestApi = {
  async create(payload: PatentRequestCreatePayload) {
    const response = await api.post<ApiSuccessResponse<PatentRequestSubmission>>(
      '/api/patents/requests',
      payload,
    );
    return response.data.data;
  },
  async submit(payload: PatentRequestPayload) {
    const response = await api.post<ApiSuccessResponse<PatentRequestSubmission>>(
      '/api/patents/requests/submit',
      payload,
    );
    return response.data.data;
  },
  async mine() {
    const response = await api.get<ApiSuccessResponse<PatentRequestSubmission[]>>('/api/patents/requests/mine');
    return response.data.data;
  },
  async getById(id: string) {
    const response = await api.get<ApiSuccessResponse<PatentRequestSubmission>>(`/api/patents/requests/${id}`);
    return response.data.data;
  },
  async uploadDocument(
    requestId: string,
    file: File,
    documentCategory: PatentRequestDocCategory,
    note?: string,
  ) {
    const body = new FormData();
    body.append('file', file);
    body.append('documentCategory', documentCategory);
    if (note) {
      body.append('note', note);
    }
    const response = await api.post<ApiSuccessResponse<PatentRequestSubmission>>(
      `/api/patents/requests/${requestId}/documents`,
      body,
    );
    return response.data.data;
  },
  async deleteDocument(requestId: string, documentId: string) {
    const response = await api.delete<ApiSuccessResponse<PatentRequestSubmission>>(
      `/api/patents/requests/${requestId}/documents/${documentId}`,
    );
    return response.data.data;
  },

  // ── Conversation ────────────────────────────────────────────────────────────
  async getMessages(requestId: string, params?: { before?: string; limit?: number }) {
    const response = await api.get<ApiSuccessResponse<PatentConversationMessage[]>>(
      `/api/patents/requests/${requestId}/messages`,
      { params },
    );
    return response.data.data;
  },
  async sendMessage(requestId: string, message: string) {
    const response = await api.post<ApiSuccessResponse<PatentConversationMessage>>(
      `/api/patents/requests/${requestId}/messages`,
      { message },
    );
    return response.data.data;
  },
  async markMessagesRead(requestId: string) {
    const response = await api.patch<ApiSuccessResponse<{ marked: boolean }>>(
      `/api/patents/requests/${requestId}/messages/read`,
    );
    return response.data.data;
  },
  async getUnreadCount(requestId: string) {
    const response = await api.get<ApiSuccessResponse<{ count: number }>>(
      `/api/patents/requests/${requestId}/messages/unread`,
    );
    return response.data.data;
  },
};
