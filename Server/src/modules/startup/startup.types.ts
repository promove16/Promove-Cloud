import { Types } from 'mongoose';

export type StartupReviewStatus = 'draft' | 'review_requested' | 'changes_requested' | 'approved';
export type StartupLegalStructure = 'private_limited' | 'llp' | 'partnership' | 'opc';
export type StartupRegistrationStage =
  | 'idea'
  | 'name_reserved'
  | 'incorporation_in_progress'
  | 'incorporated'
  | 'startup_india_recognized';
export type StartupIndiaStatus = 'not_started' | 'applied' | 'recognized';
export type StartupTrademarkStatus = 'not_started' | 'applied' | 'registered';
export type StartupPatentStatus = 'not_started' | 'drafting' | 'filed' | 'granted';
export type StartupDocumentCategory =
  | 'business_plan'
  | 'incorporation_certificate'
  | 'moa'
  | 'aoa'
  | 'llp_agreement'
  | 'partnership_deed'
  | 'founder_agreement'
  | 'company_pan'
  | 'tan_allotment'
  | 'gst_registration'
  | 'registered_office_proof'
  | 'office_noc_or_utility_bill'
  | 'startup_india_certificate'
  | 'trademark_certificate'
  | 'patent_proof'
  | 'bank_account_proof'
  | 'regulatory_license';

export interface StartupBusinessProfile {
  problemStatement: string;
  solutionSummary: string;
  targetCustomers: string;
  marketAnalysis: string;
  revenueModel: string;
  goToMarketPlan: string;
}

export interface StartupRegistrationProfile {
  legalStructure: StartupLegalStructure;
  registrationStage: StartupRegistrationStage;
  proposedEntityName: string;
  registeredEntityName?: string;
  businessObjective: string;
  incorporationDate?: Date;
  incorporationState: string;
  registeredOfficeAddress: string;
  registeredOfficeCity: string;
  registeredOfficeState: string;
  registeredOfficePincode: string;
  cinOrLlpin?: string;
  companyPan?: string;
  tanNumber?: string;
  gstin?: string;
  startupIndiaStatus: StartupIndiaStatus;
  startupIndiaRecognitionNumber?: string;
  bankAccountOpened: boolean;
  bankName?: string;
  dscReady: boolean;
  founderAgreementSigned: boolean;
  ndaReady: boolean;
  employmentContractsReady: boolean;
  operationalLicenses: string;
  trademarkStatus: StartupTrademarkStatus;
  patentStatus: StartupPatentStatus;
}

export interface StartupDocument {
  _id: Types.ObjectId;
  category: StartupDocumentCategory;
  fileUrl: string;
  fileType: 'pdf' | 'image';
  fileName: string;
  fileSizeBytes: number;
  uploadedAt: Date;
  uploadedBy: Types.ObjectId;
  note?: string;
  cloudinaryPublicId?: string;
}

export interface StartupReadiness {
  isReviewReady: boolean;
  missingItems: string[];
  requiredDocumentCategories: StartupDocumentCategory[];
  uploadedDocumentCategories: StartupDocumentCategory[];
}

export interface IStartup {
  _id: Types.ObjectId;
  founderIds: Types.ObjectId[];
  projectId?: Types.ObjectId;
  name: string;
  tagline: string;
  category: string;
  stage: 'Pre-Idea' | 'Ideation' | 'MVP' | 'Pre-Launch' | 'Launched';
  pitchDeckUrl?: string;
  pitchDeckName?: string;
  teamSize: number;
  fundingNeeded?: number;
  activeProducts: number;
  businessProfile: StartupBusinessProfile;
  registrationProfile: StartupRegistrationProfile;
  documents: StartupDocument[];
  launchedToInvestors: boolean;
  launchedToMentors: boolean;
  launchedToRecruiters: boolean;
  launchedAt?: Date;
  innovationScoreAtLaunch: number;
  totalShares: number;
  availableShares: number;
  reservedForSole: number;
  maxPennyInvestors: number;
  currentPennyCount: number;
  hasSoleInvestor: boolean;
  soleInvestorId?: Types.ObjectId | null;
  traction: {
    patentFiled: boolean;
    mvpBuilt: boolean;
    revenueGenerating: boolean;
    usersCount?: number;
  };
  reviewStatus: StartupReviewStatus;
  reviewRequestedAt?: Date;
  adminReviewedAt?: Date;
  adminReviewedBy?: Types.ObjectId | null;
  adminNotes?: string;
  readiness?: StartupReadiness;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
