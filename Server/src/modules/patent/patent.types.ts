import { Types } from 'mongoose';

export type PatentDocumentCategory =
  | 'inventor_journal'
  | 'prior_art_search'
  | 'specification_draft'
  | 'abstract_draft'
  | 'claims_draft'
  | 'drawings_diagrams'
  | 'examination_request'
  | 'form3_foreign_filing'
  | 'cost_management';

export type PatentInventionCategory =
  | 'mobile_app_backend'
  | 'iot_hardware_interface'
  | 'mechanical_improvement'
  | 'software_hardware_integration'
  | 'other';

export type PatentSpecificationType = 'provisional' | 'complete';
export type PatentPrototypeStatus =
  | 'concept_only'
  | 'partial_prototype'
  | 'working_prototype'
  | 'validated_prototype';

export interface PatentFilingDocuments {
  inventionCategory: PatentInventionCategory;
  specificationType: PatentSpecificationType;
  inventorJournalSummary: string;
  priorArtSearchSummary: string;
  prototypeStatus: PatentPrototypeStatus;
  specificationDraft: string;
  abstractDraft: string;
  claimsDraft: string;
  drawingsPrepared: boolean;
  drawingsNotes: string;
  form1ApplicantDetailsConfirmed: boolean;
  form3ForeignFilingDetails?: string;
  form5InventorshipConfirmed: boolean;
  form26PowerOfAttorneyRequired: boolean;
  form26PowerOfAttorneyDetails?: string;
  examinationRequestPlan: string;
  publicDisclosureChecked: boolean;
  professionalSupportNeeded: boolean;
  costManagementNotes?: string;
}

export interface PatentSupportingDocument {
  uploadId?: Types.ObjectId;
  fileUrl: string;
  fileType: 'pdf' | 'image';
  fileName: string;
  fileSizeBytes: number;
  note?: string;
  documentCategory?: PatentDocumentCategory;
}

export interface IPatent {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  workspaceId?: Types.ObjectId;
  projectTitle: string;
  questionnaire: {
    whatIsYourInnovation: string;
    noveltyExplanation: string;
    technicalDetails: string;
      marketUseCase: string;
      priorArtAwareness: string;
  };
  filingDocuments: PatentFilingDocuments;
  supportingDocuments: PatentSupportingDocument[];
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
  submittedAt: Date;
  adminReviewedAt?: Date;
  adminReviewedBy?: Types.ObjectId;
  adminNotes?: string;
  scoreAwarded: boolean;
  createdAt: Date;
  updatedAt: Date;
}
