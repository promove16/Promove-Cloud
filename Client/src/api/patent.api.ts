import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import {
  PatentDocumentCategory,
  PatentFilingDocuments,
  PatentQuestionnaire,
  PatentSubmission,
  ShowcasedPatent,
} from '../types/patent.types';

export const patentApi = {
  async submit(payload: {
    projectTitle: string;
    workspaceId: string;
    documentUploads: { uploadId: string; category: PatentDocumentCategory }[];
    questionnaire: PatentQuestionnaire;
    filingDocuments?: PatentFilingDocuments;
    patentStage?: "filed" | "published" | "granted";
    ipoApplicationNumber?: string;
    ipoFilingDate?: string;
    grantNumber?: string;
    grantDate?: string;
  }) {
    const response = await api.post<ApiSuccessResponse<PatentSubmission>>('/api/patents/submit', payload);
    return response.data.data;
  },
  async mine() {
    const response = await api.get<ApiSuccessResponse<PatentSubmission[]>>('/api/patents/mine');
    return response.data.data;
  },
  async toggleShowcase(patentId: string) {
    const response = await api.patch<ApiSuccessResponse<{ showcasedInMarketplace: boolean }>>(
      `/api/patents/${patentId}/showcase`,
    );
    return response.data.data;
  },
  async getShowcased() {
    const response = await api.get<ApiSuccessResponse<ShowcasedPatent[]>>('/api/patents/showcased');
    return response.data.data;
  },
};
