import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import {
  PatentDocumentCategory,
  PatentFilingDocuments,
  PatentQuestionnaire,
  PatentSubmission,
} from '../types/patent.types';

export const patentApi = {
  async submit(payload: {
    projectTitle: string;
    workspaceId: string;
    documentUploads: { uploadId: string; category: PatentDocumentCategory }[];
    questionnaire: PatentQuestionnaire;
    filingDocuments: PatentFilingDocuments;
  }) {
    const response = await api.post<ApiSuccessResponse<PatentSubmission>>('/api/patents/submit', payload);
    return response.data.data;
  },
  async mine() {
    const response = await api.get<ApiSuccessResponse<PatentSubmission[]>>('/api/patents/mine');
    return response.data.data;
  },
};
