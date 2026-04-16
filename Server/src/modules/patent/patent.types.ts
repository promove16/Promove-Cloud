import { Types } from 'mongoose';

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

export type PatentStage = 'filed' | 'published' | 'granted';

export interface IPatent {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  coInventorIds: Types.ObjectId[];
  workspaceId?: Types.ObjectId;
  projectTitle: string;
  questionnaire: {
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
  };
  filingDocuments?: PatentFilingDocuments;
  supportingDocuments: PatentSupportingDocument[];
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
  submittedAt: Date;
  adminReviewedAt?: Date;
  adminReviewedBy?: Types.ObjectId;
  adminNotes?: string;
  scoreAwarded: boolean;
  showcasedInMarketplace: boolean;
  trackingTimeline?: Array<{
    status: string;
    note?: string;
    updatedAt: Date;
    updatedBy?: Types.ObjectId;
  }>;
  nextActionRequired?: string;

  // ── Patent Verification (already-filed patents) ────────────────────────────
  patentStage?: PatentStage;
  ipoApplicationNumber?: string;
  ipoFilingDate?: Date;
  publicationDate?: Date;
  grantNumber?: string;
  grantDate?: Date;

  createdAt: Date;
  updatedAt: Date;
}

// ─── Assisted Filing (ProMove files for the student) ─────────────────────────

export type PatentRequestStatus =
  | 'draft'
  | 'submitted'
  | 'documents_review'
  | 'ready_for_filing'
  | 'filed_with_ipo'
  | 'published'
  | 'examination_requested'
  | 'fer_issued'
  | 'fer_response_submitted'
  | 'granted'
  | 'rejected'
  | 'abandoned';

// Legacy status values that may exist in the database — mapped at read time
export const LEGACY_STATUS_MAP: Record<string, PatentRequestStatus> = {
  under_review: 'documents_review',
  in_progress: 'documents_review',
  filed: 'filed_with_ipo',
  completed: 'granted',
  cancelled: 'abandoned',
  filing_in_progress: 'ready_for_filing',
};

export type PatentRequestExaminationType = 'normal' | 'expedited';

export type PatentApplicantEntityType = 'individual' | 'startup' | 'institution' | 'small_entity';

export interface PatentRequestInventor {
  fullName: string;
  address: string;
  nationality: string;
  contribution: string;
}

export interface PatentRequestApplicant {
  fullName: string;
  address: string;
  entityType: PatentApplicantEntityType;
  dpiitNumber?: string;
  institutionName?: string;
}

export type PatentRequestDocCategory =
  | 'form1_application'
  | 'form2_specification'
  | 'form3_foreign_filing'
  | 'form5_inventorship'
  | 'form26_power_of_attorney'
  | 'form28_startup_status'
  | 'drawings'
  | 'prior_art_report'
  | 'assignment_deed'
  | 'priority_document'
  | 'other';

export interface PatentRequestDocument {
  uploadId?: Types.ObjectId;
  fileUrl: string;
  fileType: 'pdf' | 'image';
  fileName: string;
  fileSizeBytes: number;
  note?: string;
  documentCategory: PatentRequestDocCategory;
}

export interface IPatentRequest {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  workspaceId?: Types.ObjectId;

  // Simple support request fields (optional)
  projectTitle?: string;
  description?: string;
  patentType?: 'invention' | 'design' | 'trademark';

  // ── Form 1 — Application for grant of patent ──────────────────────────────
  inventionTitle: string;
  inventionCategory: PatentInventionCategory;
  applicantDetails: PatentRequestApplicant;
  inventors: PatentRequestInventor[];

  // ── Form 2 — Specification ──────────────────────────────────────────────
  specificationType: PatentSpecificationType;
  technicalField: string;
  backgroundArt: string;
  inventionDescription: string;
  abstractText: string;
  claimsText: string;
  drawingsDescription?: string;
  bestMode: string;

  // ── Form 3 — Foreign filing statement ────────────────────────────────────
  hasFiledAbroad: boolean;
  foreignFilingCountries?: string;
  foreignApplicationNumbers?: string;

  // ── Form 5 — Declaration of inventorship ─────────────────────────────────
  inventorDeclarationConfirmed: boolean;

  // ── Form 26 — Power of attorney ──────────────────────────────────────────
  powerOfAttorneyGranted: boolean;
  attorneyDetails?: string;

  // ── Form 28 — Startup / small entity / institution status ─────────────────
  claimingFeeReduction: boolean;
  feeReductionEntityType?: PatentApplicantEntityType;
  dpiitRecognitionNumber?: string;

  // ── Prior art & novelty ──────────────────────────────────────────────────
  priorArtSearchSummary: string;
  priorArtReferences?: string;
  noveltyStatement: string;

  // ── Examination plan ──────────────────────────────────────────────────────
  proposedExaminationType: PatentRequestExaminationType;
  publicDisclosureStatus: boolean;

  // ── Uploaded documents ──────────────────────────────────────────────────
  documents: PatentRequestDocument[];

  // ── Status & tracking ─────────────────────────────────────────────────────
  status: PatentRequestStatus;
  submittedAt?: Date;
  ipoApplicationNumber?: string;
  ipoFilingDate?: Date;
  ipoPriorityDate?: Date;
  adminAssignedTo?: Types.ObjectId;
  adminNotes?: string;
  scoreAwarded: boolean;
  trackingTimeline?: Array<{
    status: string;
    note?: string;
    updatedAt: Date;
    updatedBy?: Types.ObjectId;
  }>;
  nextActionRequired?: string;
  lastStatusUpdate?: Date;

  // ── Deadlines ──────────────────────────────────────────────────────────────
  completeSpecDeadline?: Date;
  examRequestDeadline?: Date;
  ferResponseDeadline?: Date;

  // ── Legal metadata ─────────────────────────────────────────────────────────
  publicationDate?: Date;
  grantDate?: Date;
  controllerOffice?: string;
  examRequestForm?: '18' | '18A';
  expeditedGround?: string;
  section39Check?: boolean;

  // ── Internal notes (admin-only) ────────────────────────────────────────────
  internalNotes?: Array<{
    text: string;
    createdAt: Date;
    createdBy: Types.ObjectId;
  }>;

  createdAt: Date;
  updatedAt: Date;
}
