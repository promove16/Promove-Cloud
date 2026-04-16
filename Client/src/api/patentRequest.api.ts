import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import type {
  PatentRequestDocCategory,
  PatentRequestSubmission,
  PatentRequestApplicant,
  PatentRequestInventor,
  PatentRequestExaminationType,
  PatentApplicantEntityType,
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
};
