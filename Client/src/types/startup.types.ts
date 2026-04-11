export interface StartupTraction {
  patentFiled: boolean;
  mvpBuilt: boolean;
  revenueGenerating: boolean;
  usersCount?: number;
}

export type StartupReviewStatus = 'draft' | 'review_requested' | 'changes_requested' | 'approved';
export type StartupInnovationStage = 'idea' | 'prototype' | 'mvp' | 'market_ready';
export type StartupInventorOwnership = 'individual' | 'team' | 'organization';
export type StartupCommercializationStrategy = 'build_startup' | 'license' | 'sell' | 'partnership';
export type StartupIpProtectionType = 'patent' | 'copyright' | 'trademark' | 'design';
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
  | 'regulatory_license'
  | 'prototype_documentation'
  | 'technical_documentation'
  | 'drawings_diagrams'
  | 'design_plan_sketch'
  | 'prior_art_search';

export interface StartupBusinessProfile {
  problemStatement: string;
  solutionSummary: string;
  targetCustomers: string;
  marketAnalysis: string;
  revenueModel: string;
  goToMarketPlan: string;
}

export interface StartupRegistrationProfile {
  problemStatement: string;
  solutionDifferentiation: string;
  coreInnovation: string;
  priorArtStatus: string;
  workingMechanism: string;
  keyComponents: string;
  developmentStage: StartupInnovationStage;
  documentationReadiness: string;
  inventorOwnership: StartupInventorOwnership;
  developmentContext: string;
  targetMarkets: string;
  commercializationStrategy: StartupCommercializationStrategy;
  publicDisclosureStatus: string;
  legalAgreements: string;
  ipProtectionType: StartupIpProtectionType;
}

export interface StartupDocument {
  _id: string;
  category: StartupDocumentCategory;
  fileUrl: string;
  fileType: 'pdf' | 'image';
  fileName: string;
  fileSizeBytes: number;
  uploadedAt: string;
  note?: string;
}

export interface StartupReadiness {
  isReviewReady: boolean;
  missingItems: string[];
  requiredDocumentCategories: StartupDocumentCategory[];
  uploadedDocumentCategories: StartupDocumentCategory[];
}

export interface StartupEditAccess {
  isLocked: boolean;
  canEdit: boolean;
  requiresAdminUnlock: boolean;
  unlockedByAdmin: boolean;
  reason: string;
  unlockedAt?: string;
  unlockedBy?: string | null;
  unlockReason?: string;
  launchFormLocked: boolean;
  launchFormCanEdit: boolean;
  launchFormRequiresUnlock: boolean;
  launchFormUnlockedByAdmin: boolean;
  launchFormReason: string;
  launchFormUnlockedAt?: string;
  launchFormUnlockedBy?: string | null;
  launchFormUnlockReason?: string;
}

export interface Startup {
  _id: string;
  founderIds: string[];
  teamMemberIds: string[];
  projectId?: string;
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
  launchedToRecruiters?: boolean;
  launchedAt?: string;
  innovationScoreAtLaunch: number;
  totalShares: number;
  availableShares: number;
  reservedForSole: number;
  maxPennyInvestors: number;
  currentPennyCount: number;
  hasSoleInvestor: boolean;
  soleInvestorId?: string | null;
  traction: StartupTraction;
  reviewStatus: StartupReviewStatus;
  reviewRequestedAt?: string;
  adminReviewedAt?: string;
  adminReviewedBy?: string | null;
  adminNotes?: string;
  editAccess: StartupEditAccess;
  readiness: StartupReadiness;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
