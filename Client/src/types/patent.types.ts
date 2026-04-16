export type PatentDocumentCategory =
  | 'inventor_journal'
  | 'prior_art_search'
  | 'specification_draft'
  | 'abstract_draft'
  | 'claims_draft'
  | 'drawings_diagrams'
  | 'design_plan_sketch'
  | 'examination_request'
  | 'form3_foreign_filing'
  | 'cost_management';

export interface PatentQuestionnaire {
  problemStatement: string;
  solutionDifferentiation: string;
  coreInnovation: string;
  priorArtStatus: string;
  workingMechanism: string;
  keyComponents: string;
  developmentStage: string;
  documentationReadiness: string;
  inventorOwnership: string;
  developmentContext: string;
  targetMarkets: string;
  commercializationStrategy: string;
  publicDisclosureStatus: string;
  legalAgreements: string;
  ipProtectionType: string;
}

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
  uploadId?: string;
  fileUrl: string;
  fileType: 'pdf' | 'image';
  fileName: string;
  fileSizeBytes: number;
  note?: string;
  documentCategory?: PatentDocumentCategory;
}

export type PatentStage = 'filed' | 'published' | 'granted';

export interface PatentSubmission {
  _id: string;
  studentId: string;
  coInventorIds: string[];
  workspaceId?: string;
  projectTitle: string;
  questionnaire: PatentQuestionnaire;
  filingDocuments?: PatentFilingDocuments;
  supportingDocuments: PatentSupportingDocument[];
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
  submittedAt: string;
  adminReviewedAt?: string;
  adminReviewedBy?: string;
  adminNotes?: string;
  scoreAwarded: boolean;
  showcasedInMarketplace: boolean;
  patentStage?: PatentStage;
  ipoApplicationNumber?: string;
  ipoFilingDate?: string;
  publicationDate?: string;
  grantNumber?: string;
  grantDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShowcasedPatent {
  _id: string;
  studentId: string;
  projectTitle: string;
  inventionCategory?: string;
  specificationType?: string;
  abstract?: string;
  patentStage?: PatentStage;
  ipoApplicationNumber?: string;
  submittedAt: string;
  adminReviewedAt?: string;
  student: {
    _id: string;
    displayName: string;
    avatar?: string;
    domain?: string;
    bio?: string;
    headline?: string;
  };
}
