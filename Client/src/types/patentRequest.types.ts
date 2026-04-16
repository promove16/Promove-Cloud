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
  | 'abandoned'
  // Legacy values (may exist in database)
  | 'under_review'
  | 'in_progress'
  | 'filed'
  | 'completed'
  | 'cancelled'
  | 'filing_in_progress';

export type PatentRequestExaminationType = 'normal' | 'expedited';

export type PatentApplicantEntityType = 'individual' | 'startup' | 'institution' | 'small_entity';

export type PatentSupportRequestPatentType = 'invention' | 'design' | 'trademark';

export interface PatentSupportRequest {
  _id: string;
  studentId: string;
  workspaceId?: string;
  projectTitle?: string;
  description?: string;
  patentType?: PatentSupportRequestPatentType;
  status: PatentRequestStatus;
  createdAt: string;
  updatedAt: string;
}

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
  uploadId?: string;
  fileUrl: string;
  fileType: 'pdf' | 'image';
  fileName: string;
  fileSizeBytes: number;
  note?: string;
  documentCategory: PatentRequestDocCategory;
}

export interface PatentRequestSubmission {
  _id: string;
  studentId: string;
  workspaceId?: string;
  
  // Simple support request fields (optional)
  projectTitle?: string;
  description?: string;
  patentType?: PatentSupportRequestPatentType;
  
  // Full patent request fields
  inventionTitle?: string;
  inventionCategory?: string;
  applicantDetails?: PatentRequestApplicant;
  inventors?: PatentRequestInventor[];
  specificationType?: 'provisional' | 'complete';
  technicalField?: string;
  backgroundArt?: string;
  inventionDescription?: string;
  abstractText?: string;
  claimsText?: string;
  drawingsDescription?: string;
  bestMode?: string;
  hasFiledAbroad?: boolean;
  foreignFilingCountries?: string;
  foreignApplicationNumbers?: string;
  inventorDeclarationConfirmed?: boolean;
  powerOfAttorneyGranted?: boolean;
  attorneyDetails?: string;
  claimingFeeReduction?: boolean;
  feeReductionEntityType?: PatentApplicantEntityType;
  dpiitRecognitionNumber?: string;
  priorArtSearchSummary?: string;
  priorArtReferences?: string;
  noveltyStatement?: string;
  proposedExaminationType?: PatentRequestExaminationType;
  publicDisclosureStatus?: boolean;
  documents?: PatentRequestDocument[];
  status: PatentRequestStatus;
  submittedAt?: string;
  ipoApplicationNumber?: string;
  ipoFilingDate?: string;
  ipoPriorityDate?: string;
  adminAssignedTo?: string;
  adminNotes?: string;
  scoreAwarded?: boolean;

  // Deadlines
  completeSpecDeadline?: string;
  examRequestDeadline?: string;
  ferResponseDeadline?: string;

  // Legal metadata
  publicationDate?: string;
  grantDate?: string;
  controllerOffice?: string;
  examRequestForm?: '18' | '18A';
  expeditedGround?: string;
  section39Check?: boolean;

  createdAt: string;
  updatedAt: string;
}
