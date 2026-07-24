import { Types } from 'mongoose';
import { z } from 'zod';
import { notificationQueue } from '../../config/bullmq';
import { applyScoreAsync } from '../../services/scoreEngine';
import { deleteStoredAsset, extractS3KeyFromUrl, generatePresignedUrl, uploadFile } from '../../services/fileStorageService';
import { generateSignedCloudinaryUrl } from '../../services/cloudinaryService';
import { User } from '../user/user.model';
import { Startup } from './startup.model';
import { ApiError } from '../../utils/ApiError';
import { PlacementRecord } from '../college/placementRecord.model';
import { UserRole } from '../../types/roles.types';
import { normalizeInnovationScore } from '../innovationScore/score.utils';
import { Workspace } from '../workspace/workspace.model';
import { ensureDirectWorkspaceChatAccess } from '../workspace/workspace.service';
import { Deal } from '../deal/deal.model';
import { AdminAuditLog } from '../admin/adminAuditLog.model';
import { recordStartupLifecycleEvent } from '../startupLifecycle/startupLifecycle.service';
import { DirectMessage } from '../dm/dm.model';
import { serializeDirectMessage } from '../dm/dm.serializer';
import { NotificationService } from '../notification/notification.service';
import { RequestRecord } from '../request/request.model';
import { Patent } from '../patent/patent.model';
import { PatentRequest } from '../patent/patentRequest.model';
import { io } from '../../config/socket';
import type {
  StartupDocumentCategory,
  StartupEditAccess,
  StartupInnovationProfile,
  StartupInnovationScoreBreakdown,
  StartupReadiness,
} from './startup.types';

const pitchDeckFileNamePattern = /\.(pdf|ppt|pptx)$/i;
const MIN_UPLOAD_FILE_BYTES = 1;
const NOTIFICATION_BODY_MAX_LENGTH = 500;

const truncateNotificationBody = (value: string) =>
  value.length > NOTIFICATION_BODY_MAX_LENGTH
    ? `${value.slice(0, NOTIFICATION_BODY_MAX_LENGTH - 3)}...`
    : value;

const deleteRequestsLinkedToStartup = async (startupId: string) => {
  await RequestRecord.deleteMany({
    $or: [
      { targetEntityType: 'startup', targetEntityId: startupId },
      { 'metadata.startupId': startupId },
    ],
  });
};

const startupHasPatentWorkflow = async (startup: InstanceType<typeof Startup>) => {
  if (startup.traction?.patentApplicationId) {
    return true;
  }

  if (!startup.projectId) {
    return false;
  }

  const [existingPatent, existingPatentRequest] = await Promise.all([
    Patent.exists({ workspaceId: startup.projectId }),
    PatentRequest.exists({ workspaceId: startup.projectId }),
  ]);

  return Boolean(existingPatent || existingPatentRequest);
};

const STARTUP_DOCUMENT_CATEGORIES = [
  'business_plan',
  'incorporation_certificate',
  'moa',
  'aoa',
  'llp_agreement',
  'partnership_deed',
  'founder_agreement',
  'company_pan',
  'tan_allotment',
  'gst_registration',
  'registered_office_proof',
  'office_noc_or_utility_bill',
  'startup_india_certificate',
  'trademark_certificate',
  'patent_proof',
  'bank_account_proof',
  'regulatory_license',
  'prototype_documentation',
  'technical_documentation',
  'drawings_diagrams',
  'design_plan_sketch',
  'prior_art_search',
  'dpiit_certificate',
  'udyam_certificate',
  'government_certificate_other',
  'dpr',
  'itr_filing',
  'revenue_proof',
  'grant_certificate',
  'award_certificate',
  'funding_proof',
] as const satisfies readonly StartupDocumentCategory[];

const startupDocumentCategorySchema = z.enum(STARTUP_DOCUMENT_CATEGORIES);

const DEFAULT_BUSINESS_PROFILE = {
  problemStatement: '',
  solutionSummary: '',
  targetCustomers: '',
  marketAnalysis: '',
  revenueModel: '',
  goToMarketPlan: '',
} as const;

const DEFAULT_REGISTRATION_PROFILE = {
  problemStatement: '',
  solutionDifferentiation: '',
  coreInnovation: '',
  priorArtStatus: '',
  workingMechanism: '',
  keyComponents: '',
  developmentStage: 'idea',
  documentationReadiness: '',
  inventorOwnership: 'individual',
  developmentContext: '',
  targetMarkets: '',
  commercializationStrategy: 'build_startup',
  publicDisclosureStatus: '',
  legalAgreements: '',
  ipProtectionType: 'patent',
} as const;

const DEFAULT_INITIALIZATION_PROFILE = {
  vision: '',
  mission: '',
  foundingStory: '',
  teamComposition: '',
  productStage: 'idea',
  productOverview: '',
  customerProfile: '',
  marketOpportunity: '',
  businessModel: 'subscription',
  pricingStrategy: '',
  competitiveLandscape: '',
  defensibleMoat: '',
  currentTraction: '',
  upcomingMilestones: '',
  fundingAsk: '',
  legalEntityType: 'not_registered',
  risksAndMitigation: '',
} as const;

const DEFAULT_INNOVATION_PROFILE = {
  companyProfile: {
    legalStructure: 'not_registered',
    cinNumber: '',
    dpiitRecognitionNumber: '',
    msmeUdyamNumber: '',
    otherGovernmentCertificationName: '',
    otherGovernmentCertificationNumber: '',
    websiteUrl: '',
    productDemoUrl: '',
    portfolioUrl: '',
  },
  tractionProfile: {
    startupStage: 'idea',
    problemClarity: '',
    uniqueSolution: '',
    marketDifferentiation: '',
    patentStatus: 'none',
    hasItrFiling: false,
    hasRevenueProof: false,
    hasGovernmentGrant: false,
    hasAwardRecognition: false,
    fundingStatus: 'none',
    activeUsersCustomers: 0,
    monthlyGrowthRate: 0,
    retentionRate: 0,
  },
} as const satisfies Omit<StartupInnovationProfile, 'rubricVersion'>;

const MARKETPLACE_LAUNCH_TERMS_VERSION = 'marketplace-launch-v1';

const REGISTERED_ENTITY_TYPES = new Set(['llp', 'private_limited', 'opc']);

const documentLabelMap: Record<StartupDocumentCategory, string> = {
  business_plan: 'business plan or financial model',
  incorporation_certificate: 'certificate of incorporation',
  moa: 'Memorandum of Association (MOA)',
  aoa: 'Articles of Association (AOA)',
  llp_agreement: 'LLP agreement',
  partnership_deed: 'partnership deed',
  founder_agreement: 'founder agreement',
  company_pan: 'company PAN card',
  tan_allotment: 'TAN allotment proof',
  gst_registration: 'GST registration proof',
  registered_office_proof: 'registered office proof',
  office_noc_or_utility_bill: 'office NOC or utility bill',
  startup_india_certificate: 'Startup India recognition certificate',
  trademark_certificate: 'trademark certificate',
  patent_proof: 'patent proof',
  bank_account_proof: 'bank account proof',
  regulatory_license: 'regulatory license document',
  prototype_documentation: 'prototype documentation',
  technical_documentation: 'technical documentation',
  drawings_diagrams: 'drawings or diagrams',
  design_plan_sketch: 'design, plan, or pen-paper sketch',
  prior_art_search: 'prior art search notes',
  dpiit_certificate: 'DPIIT certificate',
  udyam_certificate: 'MSME or Udyam certificate',
  government_certificate_other: 'other government certification proof',
  dpr: 'detailed project report (DPR)',
  itr_filing: 'ITR filing proof',
  revenue_proof: 'revenue proof',
  grant_certificate: 'government grant proof',
  award_certificate: 'award or recognition proof',
  funding_proof: 'funding proof',
};

const buildTextField = (max: number) => z.string().trim().max(max).default('');

const startupBusinessProfileSchema = z
  .object({
    problemStatement: buildTextField(2000),
    solutionSummary: buildTextField(2000),
    targetCustomers: buildTextField(1000),
    marketAnalysis: buildTextField(2000),
    revenueModel: buildTextField(1500),
    goToMarketPlan: buildTextField(1500),
  })
  .default(DEFAULT_BUSINESS_PROFILE);

const startupRegistrationProfileSchema = z
  .object({
    problemStatement: buildTextField(2500),
    solutionDifferentiation: buildTextField(2500),
    coreInnovation: buildTextField(2000),
    priorArtStatus: buildTextField(2000),
    workingMechanism: buildTextField(2500),
    keyComponents: buildTextField(2000),
    developmentStage: z.enum(['idea', 'prototype', 'mvp', 'market_ready']).default('idea'),
    documentationReadiness: buildTextField(1500),
    inventorOwnership: z.enum(['individual', 'team', 'organization']).default('individual'),
    developmentContext: buildTextField(2000),
    targetMarkets: buildTextField(2000),
    commercializationStrategy: z.enum(['build_startup', 'license', 'sell', 'partnership']).default('build_startup'),
    publicDisclosureStatus: buildTextField(1500),
    legalAgreements: buildTextField(1500),
    ipProtectionType: z.enum(['patent', 'copyright', 'trademark', 'design']).default('patent'),
  })
  .default(DEFAULT_REGISTRATION_PROFILE);

const startupInitializationProfileSchema = z
  .object({
    vision: buildTextField(2000),
    mission: buildTextField(1500),
    foundingStory: buildTextField(2500),
    teamComposition: buildTextField(2000),
    productStage: z.enum(['idea', 'prototype', 'mvp', 'market_ready']).default('idea'),
    productOverview: buildTextField(2500),
    customerProfile: buildTextField(2000),
    marketOpportunity: buildTextField(2500),
    businessModel: z
      .enum([
        'subscription',
        'transactional',
        'marketplace',
        'freemium',
        'advertising',
        'services',
        'hardware',
        'hybrid',
      ])
      .default('subscription'),
    pricingStrategy: buildTextField(1500),
    competitiveLandscape: buildTextField(2000),
    defensibleMoat: buildTextField(2000),
    currentTraction: buildTextField(2000),
    upcomingMilestones: buildTextField(2000),
    fundingAsk: buildTextField(1500),
    legalEntityType: z
      .enum([
        'not_registered',
        'sole_proprietorship',
        'partnership',
        'llp',
        'private_limited',
        'opc',
      ])
      .default('not_registered'),
    risksAndMitigation: buildTextField(2000),
  })
  .default(DEFAULT_INITIALIZATION_PROFILE);

const startupInnovationProfileSchema = z
  .object({
    rubricVersion: z.enum(['startup_innovation_1000']).optional(),
    companyProfile: z
      .object({
        legalStructure: z
          .enum([
            'not_registered',
            'sole_proprietorship',
            'partnership',
            'llp',
            'private_limited',
            'opc',
          ])
          .default('not_registered'),
        cinNumber: buildTextField(50),
        dpiitRecognitionNumber: buildTextField(80),
        msmeUdyamNumber: buildTextField(80),
        otherGovernmentCertificationName: buildTextField(120),
        otherGovernmentCertificationNumber: buildTextField(80),
        websiteUrl: buildTextField(300),
        productDemoUrl: buildTextField(300),
        portfolioUrl: buildTextField(300),
      })
      .default(DEFAULT_INNOVATION_PROFILE.companyProfile),
    tractionProfile: z
      .object({
        startupStage: z
          .enum(['idea', 'mvp_ready', 'market_ready', 'revenue_generating'])
          .default('idea'),
        problemClarity: buildTextField(2000),
        uniqueSolution: buildTextField(2000),
        marketDifferentiation: buildTextField(2000),
        patentStatus: z.enum(['none', 'filed', 'published']).default('none'),
        hasItrFiling: z.boolean().default(false),
        hasRevenueProof: z.boolean().default(false),
        hasGovernmentGrant: z.boolean().default(false),
        hasAwardRecognition: z.boolean().default(false),
        fundingStatus: z.enum(['none', 'bootstrapped', 'angel_seed', 'vc']).default('none'),
        activeUsersCustomers: z.number().int().min(0).default(0),
        monthlyGrowthRate: z.number().min(0).default(0),
        retentionRate: z.number().min(0).max(100).default(0),
      })
      .default(DEFAULT_INNOVATION_PROFILE.tractionProfile),
  })
  .default(DEFAULT_INNOVATION_PROFILE);

export const startupSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().trim().min(0).max(120).default(''),
  tagline: z.string().trim().min(0).max(200).default(''),
  category: z.string().trim().min(0).max(100).default(''),
  stage: z.enum(['Pre-Idea', 'Ideation', 'MVP', 'Pre-Launch', 'Launched']).default('Pre-Idea'),
  phase: z.enum(['creation', 'building', 'launched']).default('creation'),
  fundingNeeded: z.number().optional(),
  fundingGoal: z.number().min(0).optional(),
  activeProducts: z.number().int().min(0).default(1),
  teamSize: z.number().int().min(1).default(1),
  traction: z
    .object({
      patentFiled: z.boolean().default(false),
      mvpBuilt: z.boolean().default(false),
      revenueGenerating: z.boolean().default(false),
      usersCount: z.number().int().min(0).optional(),
    })
    .default({
      patentFiled: false,
      mvpBuilt: false,
      revenueGenerating: false,
    }),
  businessProfile: startupBusinessProfileSchema,
  registrationProfile: startupRegistrationProfileSchema,
  initializationProfile: startupInitializationProfileSchema,
  innovationProfile: startupInnovationProfileSchema.optional(),
});

export const launchSchema = z.object({
  launchTo: z.enum(['investors', 'mentors', 'both', 'recruiters']),
  termsAccepted: z.literal(true, {
    errorMap: () => ({
      message: 'You must accept the marketplace launch terms before launching this startup.',
    }),
  }),
});

export const reviewStartupSubmissionSchema = z
  .object({
    decision: z.enum(['approved', 'changes_requested']),
    adminNotes: z.string().trim().max(1500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === 'changes_requested' && (!value.adminNotes || value.adminNotes.length < 10)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['adminNotes'],
        message: 'Admin notes are required when requesting changes.',
      });
    }
  });

export const startupDocumentUploadSchema = z.object({
  category: startupDocumentCategorySchema,
  note: z.string().trim().max(300).optional(),
});

type StartupSchemaInput = z.input<typeof startupSchema>;
type StartupBusinessProfileInput = z.input<typeof startupBusinessProfileSchema>;
type StartupRegistrationProfileInput = z.input<typeof startupRegistrationProfileSchema>;
type StartupInitializationProfileInput = z.input<typeof startupInitializationProfileSchema>;
type StartupInnovationProfileInput = z.input<typeof startupInnovationProfileSchema>;

type StartupLinkedWorkspace = {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  teamMemberIds: Types.ObjectId[];
  isActive?: boolean;
};

const clearReviewMetadata = (startup: InstanceType<typeof Startup>) => {
  startup.reviewRequestedAt = undefined;
  startup.adminReviewedAt = undefined;
  startup.adminReviewedBy = null;
  startup.adminNotes = undefined;
};

const clearAdminEditUnlock = (startup: InstanceType<typeof Startup>) => {
  startup.adminEditUnlockActive = false;
  startup.adminEditUnlockApprovedAt = undefined;
  startup.adminEditUnlockApprovedBy = null;
  startup.adminEditUnlockReason = undefined;
};

export const buildStartupEditAccess = (startup: Record<string, any>): StartupEditAccess => {
  const reviewStatus = startup.reviewStatus ?? 'draft';
  const unlockedByAdmin = Boolean(startup.adminEditUnlockActive);
  const isLocked = reviewStatus === 'review_requested' && !unlockedByAdmin;

  let reason = 'Startup profile can be edited.';
  if (unlockedByAdmin && (reviewStatus === 'review_requested' || reviewStatus === 'approved')) {
    reason = 'Admin approved a temporary edit unlock. Save your changes and submit again for review.';
  } else if (reviewStatus === 'review_requested') {
    reason = 'Startup profile is locked while admin review is pending.';
  } else if (reviewStatus === 'approved') {
    reason = 'Startup is approved.';
  } else if (reviewStatus === 'changes_requested') {
    reason = 'Admin requested changes. Update the startup and submit it again for review.';
  }

  const launchFormLocked = Boolean(startup.launchFormLocked);
  const launchFormUnlockedByAdmin = Boolean(startup.launchFormUnlockedByAdmin);
  const isLaunchFormLocked = launchFormLocked && !launchFormUnlockedByAdmin;

  let launchFormReason = 'Launch form can be edited.';
  if (launchFormUnlockedByAdmin && launchFormLocked) {
    launchFormReason = 'Admin approved temporary edit unlock for launch form.';
  } else if (launchFormLocked) {
    launchFormReason = 'Launch form is locked after submission. Raise a Smart Help request to edit.';
  }

  return {
    isLocked,
    canEdit: !isLocked,
    requiresAdminUnlock: isLocked,
    unlockedByAdmin,
    reason,
    phase: startup.phase || autoAdvancePhase(startup),
    launchFormLocked: isLaunchFormLocked,
    launchFormCanEdit: !isLaunchFormLocked,
    launchFormRequiresUnlock: isLaunchFormLocked,
    launchFormUnlockedByAdmin,
    launchFormReason,
    ...(startup.adminEditUnlockApprovedAt ? { unlockedAt: startup.adminEditUnlockApprovedAt } : {}),
    ...(startup.adminEditUnlockApprovedBy ? { unlockedBy: startup.adminEditUnlockApprovedBy } : {}),
    ...(startup.adminEditUnlockReason ? { unlockReason: startup.adminEditUnlockReason } : {}),
    ...(startup.launchFormUnlockedAt ? { launchFormUnlockedAt: startup.launchFormUnlockedAt } : {}),
    ...(startup.launchFormUnlockedBy ? { launchFormUnlockedBy: startup.launchFormUnlockedBy } : {}),
    ...(startup.launchFormUnlockReason ? { launchFormUnlockReason: startup.launchFormUnlockReason } : {}),
  };
};

const assertStartupEditable = (startup: Record<string, any>) => {
  const editAccess = buildStartupEditAccess(startup);
  if (editAccess.isLocked) {
    throw new ApiError(423, 'STARTUP_PROFILE_LOCKED', editAccess.reason);
  }
};

const assertLaunchFormEditable = (startup: Record<string, any>) => {
  const editAccess = buildStartupEditAccess(startup);
  if (editAccess.launchFormLocked && !editAccess.launchFormUnlockedByAdmin) {
    throw new ApiError(423, 'LAUNCH_FORM_LOCKED', editAccess.launchFormReason);
  }
};

const PHASE_TRANSITION_MAP: Record<string, string[]> = {
  creation: ['building', 'launched'],
  building: ['creation', 'launched'],
  launched: [],
};

const validatePhaseTransition = (currentPhase: string, newPhase: string): boolean => {
  const allowedTransitions = PHASE_TRANSITION_MAP[currentPhase] || [];
  return allowedTransitions.includes(newPhase);
};

const autoAdvancePhase = (startup: Record<string, any>): string => {
  if (startup.phase === 'creation') {
    const hasBusinessProfile = startup.businessProfile?.problemStatement?.trim()?.length > 10;
    const hasTeam = (startup.founderIds?.length ?? 0) > 0;
    if (hasBusinessProfile && hasTeam) {
      return 'building';
    }
  }
  if (startup.phase === 'building') {
    if (startup.reviewStatus === 'approved' && startup.launchedToInvestors) {
      return 'launched';
    }
  }
  return startup.phase || 'creation';
};

const prepareStartupForEditableMutation = (startup: InstanceType<typeof Startup>) => {
  assertStartupEditable(startup.toObject());

  if (startup.adminEditUnlockActive) {
    if (startup.reviewStatus !== 'approved') {
      startup.reviewStatus = 'draft';
    }
    clearAdminEditUnlock(startup);
  }
};

const normalizeRegistrationProfile = (
  registrationProfile: StartupRegistrationProfileInput,
) => {
  const profile = startupRegistrationProfileSchema.parse(registrationProfile ?? DEFAULT_REGISTRATION_PROFILE);

  return {
    problemStatement: profile.problemStatement.trim(),
    solutionDifferentiation: profile.solutionDifferentiation.trim(),
    coreInnovation: profile.coreInnovation.trim(),
    priorArtStatus: profile.priorArtStatus.trim(),
    workingMechanism: profile.workingMechanism.trim(),
    keyComponents: profile.keyComponents.trim(),
    developmentStage: profile.developmentStage,
    documentationReadiness: profile.documentationReadiness.trim(),
    inventorOwnership: profile.inventorOwnership,
    developmentContext: profile.developmentContext.trim(),
    targetMarkets: profile.targetMarkets.trim(),
    commercializationStrategy: profile.commercializationStrategy,
    publicDisclosureStatus: profile.publicDisclosureStatus.trim(),
    legalAgreements: profile.legalAgreements.trim(),
    ipProtectionType: profile.ipProtectionType,
  };
};

const normalizeInitializationProfile = (
  initializationProfile: StartupInitializationProfileInput,
) => {
  const profile = startupInitializationProfileSchema.parse(
    initializationProfile ?? DEFAULT_INITIALIZATION_PROFILE,
  );

  return {
    vision: profile.vision.trim(),
    mission: profile.mission.trim(),
    foundingStory: profile.foundingStory.trim(),
    teamComposition: profile.teamComposition.trim(),
    productStage: profile.productStage,
    productOverview: profile.productOverview.trim(),
    customerProfile: profile.customerProfile.trim(),
    marketOpportunity: profile.marketOpportunity.trim(),
    businessModel: profile.businessModel,
    pricingStrategy: profile.pricingStrategy.trim(),
    competitiveLandscape: profile.competitiveLandscape.trim(),
    defensibleMoat: profile.defensibleMoat.trim(),
    currentTraction: profile.currentTraction.trim(),
    upcomingMilestones: profile.upcomingMilestones.trim(),
    fundingAsk: profile.fundingAsk.trim(),
    legalEntityType: profile.legalEntityType,
    risksAndMitigation: profile.risksAndMitigation.trim(),
  };
};

const normalizeInnovationProfile = (
  innovationProfile?: StartupInnovationProfileInput,
) => {
  const profile = startupInnovationProfileSchema.parse(
    innovationProfile ?? DEFAULT_INNOVATION_PROFILE,
  );

  return {
    ...(profile.rubricVersion ? { rubricVersion: profile.rubricVersion } : {}),
    companyProfile: {
      legalStructure: profile.companyProfile.legalStructure,
      cinNumber: profile.companyProfile.cinNumber.trim(),
      dpiitRecognitionNumber: profile.companyProfile.dpiitRecognitionNumber.trim(),
      msmeUdyamNumber: profile.companyProfile.msmeUdyamNumber.trim(),
      otherGovernmentCertificationName:
        profile.companyProfile.otherGovernmentCertificationName.trim(),
      otherGovernmentCertificationNumber:
        profile.companyProfile.otherGovernmentCertificationNumber.trim(),
      websiteUrl: profile.companyProfile.websiteUrl.trim(),
      productDemoUrl: profile.companyProfile.productDemoUrl.trim(),
      portfolioUrl: profile.companyProfile.portfolioUrl.trim(),
    },
    tractionProfile: {
      startupStage: profile.tractionProfile.startupStage,
      problemClarity: profile.tractionProfile.problemClarity.trim(),
      uniqueSolution: profile.tractionProfile.uniqueSolution.trim(),
      marketDifferentiation: profile.tractionProfile.marketDifferentiation.trim(),
      patentStatus: profile.tractionProfile.patentStatus,
      hasItrFiling: profile.tractionProfile.hasItrFiling,
      hasRevenueProof: profile.tractionProfile.hasRevenueProof,
      hasGovernmentGrant: profile.tractionProfile.hasGovernmentGrant,
      hasAwardRecognition: profile.tractionProfile.hasAwardRecognition,
      fundingStatus: profile.tractionProfile.fundingStatus,
      activeUsersCustomers: Math.max(0, Math.round(profile.tractionProfile.activeUsersCustomers)),
      monthlyGrowthRate: Math.max(0, Number(profile.tractionProfile.monthlyGrowthRate) || 0),
      retentionRate: Math.min(100, Math.max(0, Number(profile.tractionProfile.retentionRate) || 0)),
    },
  };
};

const mapScoringStageToStartupStage = (
  scoringStage: StartupInnovationProfile['tractionProfile']['startupStage'],
): StartupSchemaInput['stage'] => {
  switch (scoringStage) {
    case 'idea':
      return 'Ideation';
    case 'mvp_ready':
      return 'MVP';
    case 'market_ready':
    case 'revenue_generating':
      return 'Pre-Launch';
    default:
      return 'Pre-Idea';
  }
};

const buildStartupInput = (source: Partial<Record<string, any>>): StartupSchemaInput => {
  const businessProfileSource = source.businessProfile ?? {};
  const registrationProfileSource = source.registrationProfile ?? {};
  const initializationProfileSource = source.initializationProfile ?? {};
  const innovationProfileSource = source.innovationProfile ?? {};
  const tractionSource = source.traction ?? {};

  const businessProfile: StartupBusinessProfileInput = {
    ...DEFAULT_BUSINESS_PROFILE,
    ...businessProfileSource,
  };

  const registrationProfile: StartupRegistrationProfileInput = {
    ...DEFAULT_REGISTRATION_PROFILE,
    ...registrationProfileSource,
  };

  const initializationProfile: StartupInitializationProfileInput = {
    ...DEFAULT_INITIALIZATION_PROFILE,
    ...initializationProfileSource,
  };

  const innovationProfile: StartupInnovationProfileInput = {
    ...DEFAULT_INNOVATION_PROFILE,
    ...innovationProfileSource,
    companyProfile: {
      ...DEFAULT_INNOVATION_PROFILE.companyProfile,
      ...(innovationProfileSource.companyProfile ?? {}),
    },
    tractionProfile: {
      ...DEFAULT_INNOVATION_PROFILE.tractionProfile,
      ...(innovationProfileSource.tractionProfile ?? {}),
    },
  };

  return {
    projectId: source.projectId ? String(source.projectId) : undefined,
    name: typeof source.name === 'string' ? source.name : '',
    tagline: typeof source.tagline === 'string' ? source.tagline : '',
    category: typeof source.category === 'string' ? source.category : '',
    stage: source.stage,
    fundingNeeded: typeof source.fundingNeeded === 'number' ? source.fundingNeeded : undefined,
    activeProducts: typeof source.activeProducts === 'number' ? source.activeProducts : 1,
    teamSize: typeof source.teamSize === 'number' ? source.teamSize : 1,
    traction: {
      patentFiled: Boolean(tractionSource.patentFiled),
      mvpBuilt: Boolean(tractionSource.mvpBuilt),
      revenueGenerating: Boolean(tractionSource.revenueGenerating),
      ...(typeof tractionSource.usersCount === 'number' ? { usersCount: tractionSource.usersCount } : {}),
    },
    businessProfile,
    registrationProfile,
    initializationProfile,
    innovationProfile,
  };
};

const normalizeStartupPayload = (payload: StartupSchemaInput) => {
  const normalizedPayload = startupSchema.parse(payload);
  const registrationProfile = normalizeRegistrationProfile(
    normalizedPayload.registrationProfile ?? DEFAULT_REGISTRATION_PROFILE,
  );
  const initializationProfile = normalizeInitializationProfile(
    normalizedPayload.initializationProfile ?? DEFAULT_INITIALIZATION_PROFILE,
  );
  const innovationProfile = normalizeInnovationProfile(normalizedPayload.innovationProfile);
  const businessProfile = normalizedPayload.businessProfile ?? DEFAULT_BUSINESS_PROFILE;
  const startupStageFromRubric = innovationProfile.rubricVersion
    ? mapScoringStageToStartupStage(innovationProfile.tractionProfile.startupStage)
    : normalizedPayload.stage;
  const tractionFromRubric = innovationProfile.rubricVersion
    ? {
        patentFiled: innovationProfile.tractionProfile.patentStatus !== 'none',
        mvpBuilt: innovationProfile.tractionProfile.startupStage !== 'idea',
        revenueGenerating:
          innovationProfile.tractionProfile.startupStage === 'revenue_generating',
        usersCount: innovationProfile.tractionProfile.activeUsersCustomers,
      }
    : normalizedPayload.traction;

  return {
    ...normalizedPayload,
    name: normalizedPayload.name.trim(),
    tagline: normalizedPayload.tagline.trim(),
    category: normalizedPayload.category.trim(),
    stage: startupStageFromRubric,
    businessProfile: {
      problemStatement: businessProfile.problemStatement.trim(),
      solutionSummary: businessProfile.solutionSummary.trim(),
      targetCustomers: businessProfile.targetCustomers.trim(),
      marketAnalysis: businessProfile.marketAnalysis.trim(),
      revenueModel: businessProfile.revenueModel.trim(),
      goToMarketPlan: businessProfile.goToMarketPlan.trim(),
    },
    registrationProfile,
    initializationProfile,
    innovationProfile,
    traction: tractionFromRubric,
  };
};

const getWorkspaceMemberIds = (workspace: StartupLinkedWorkspace, userId?: string) => {
  const memberIds = [
    String(workspace.ownerId),
    ...workspace.teamMemberIds.map((memberId) => String(memberId)),
  ];

  if (userId) {
    memberIds.push(String(userId));
  }

  return [...new Set(memberIds)].map((memberId) => new Types.ObjectId(memberId));
};

const resolveLinkedWorkspace = async (userId: string, projectId?: string) => {
  if (!projectId) {
    return null;
  }

  const workspace = await Workspace.findOne({
    _id: projectId,
    isActive: true,
    $or: [{ ownerId: userId }, { teamMemberIds: userId }],
  })
    .select('_id ownerId teamMemberIds isActive')
    .lean<StartupLinkedWorkspace | null>();

  if (!workspace) {
    throw new ApiError(
      404,
      'WORKSPACE_NOT_FOUND',
      'Select a valid workspace that you belong to before saving this startup.',
    );
  }

  return workspace;
};

const applyWorkspaceContextToStartupPayload = async (
  userId: string,
  payload: ReturnType<typeof normalizeStartupPayload>,
) => {
  const workspace = await resolveLinkedWorkspace(userId, payload.projectId);
  const founderIds = [new Types.ObjectId(userId)];

  const teamMemberIds: Types.ObjectId[] = [];
  if (workspace) {
    const allMemberIds = getWorkspaceMemberIds(workspace);
    for (const memberId of allMemberIds) {
      if (String(memberId) !== String(userId)) {
        founderIds.push(new Types.ObjectId(String(memberId)));
        teamMemberIds.push(memberId);
      }
    }
  }

  const totalMembers = founderIds.length;
  const teamSize = workspace ? Math.max(totalMembers, payload.teamSize || 1) : Math.max(payload.teamSize || 1, 1);

  return {
    ...payload,
    projectId: workspace ? String(workspace._id) : undefined,
    founderIds,
    teamMemberIds,
    teamSize,
  };
};

const getAccessibleWorkspaceIds = async (userId: string) => {
  const workspaces = await Workspace.find({
    isActive: true,
    $or: [{ ownerId: userId }, { teamMemberIds: userId }],
  })
    .select('_id')
    .lean<Array<{ _id: Types.ObjectId }>>();

  return workspaces.map((workspace) => workspace._id);
};

const syncAcceptedInvestorWorkspaceAccess = async (startupId: string, workspaceId?: string) => {
  if (!workspaceId) {
    return;
  }

  const acceptedDeals = await Deal.find({
    startupId,
    linkedWorkspaceId: workspaceId,
    status: { $ne: 'cancelled' },
    $or: [{ 'founderDecision.status': 'accepted' }, { stage: { $gte: 2 } }],
  })
    .select('investorId')
    .lean<Array<{ investorId: Types.ObjectId }>>();

  const investorIds = [...new Set(acceptedDeals.map((deal) => String(deal.investorId)))];
  await Promise.all(
    investorIds.map((investorId) =>
      ensureDirectWorkspaceChatAccess(workspaceId, investorId, 'investor'),
    ),
  );
};

const buildAccessibleStartupQuery = (userId: string, workspaceIds: Types.ObjectId[]) => ({
  isActive: true,
  $or: [
    { founderIds: userId },
    { teamMemberIds: userId },
    ...(workspaceIds.length > 0 ? [{ projectId: { $in: workspaceIds } }] : []),
  ],
});

const getLegacyRequiredStartupDocumentCategories = (startup: {
  initializationProfile?: {
    productStage?: string;
  };
  registrationProfile?: {
    developmentStage?: string;
  };
}): StartupDocumentCategory[] => {
  const stage =
    startup.initializationProfile?.productStage ?? startup.registrationProfile?.developmentStage;
  return stage === 'idea' ? ['design_plan_sketch'] : ['technical_documentation'];
};

const usesInnovationRubric = (startup: Record<string, any>) =>
  startup.innovationProfile?.rubricVersion === 'startup_innovation_1000';

const getUploadedDocumentCategories = (
  documents?: Array<{ category?: StartupDocumentCategory }>,
) =>
  Array.from(
    new Set(
      (documents ?? [])
        .map((document) => document.category)
        .filter((category): category is StartupDocumentCategory => Boolean(category)),
    ),
  );

const getInnovationRequiredDocumentCategories = (startup: Record<string, any>) => {
  const companyProfile = startup.innovationProfile?.companyProfile ?? {};
  const tractionProfile = startup.innovationProfile?.tractionProfile ?? {};
  const requiredDocuments = new Set<StartupDocumentCategory>();

  if (
    REGISTERED_ENTITY_TYPES.has(companyProfile.legalStructure) ||
    Boolean(companyProfile.cinNumber?.trim())
  ) {
    requiredDocuments.add('incorporation_certificate');
  }
  if (companyProfile.dpiitRecognitionNumber?.trim()) {
    requiredDocuments.add('dpiit_certificate');
  }
  if (companyProfile.msmeUdyamNumber?.trim()) {
    requiredDocuments.add('udyam_certificate');
  }
  if (
    companyProfile.otherGovernmentCertificationName?.trim() ||
    companyProfile.otherGovernmentCertificationNumber?.trim()
  ) {
    requiredDocuments.add('government_certificate_other');
  }
  if (tractionProfile.patentStatus && tractionProfile.patentStatus !== 'none') {
    requiredDocuments.add('patent_proof');
  }
  if (tractionProfile.hasItrFiling) {
    requiredDocuments.add('itr_filing');
  }
  if (tractionProfile.hasRevenueProof) {
    requiredDocuments.add('revenue_proof');
  }
  if (tractionProfile.hasGovernmentGrant) {
    requiredDocuments.add('grant_certificate');
  }
  if (tractionProfile.hasAwardRecognition) {
    requiredDocuments.add('award_certificate');
  }
  if (tractionProfile.fundingStatus === 'angel_seed' || tractionProfile.fundingStatus === 'vc') {
    requiredDocuments.add('funding_proof');
  }

  return Array.from(requiredDocuments);
};

const toIsoString = (value: unknown) => {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();

  const normalized = new Date(String(value));
  return Number.isNaN(normalized.getTime()) ? undefined : normalized.toISOString();
};

const buildLegacyStartupReadiness = (startup: {
  projectId?: unknown;
  name?: string;
  tagline?: string;
  category?: string;
  founderIds: Array<unknown>;
  pitchDeckUrl?: string;
  documents?: Array<{ category?: StartupDocumentCategory }>;
  businessProfile?: {
    problemStatement?: string;
    solutionSummary?: string;
    targetCustomers?: string;
    marketAnalysis?: string;
    revenueModel?: string;
    goToMarketPlan?: string;
  };
  registrationProfile?: {
    problemStatement?: string;
    solutionDifferentiation?: string;
    coreInnovation?: string;
    priorArtStatus?: string;
    workingMechanism?: string;
    keyComponents?: string;
    developmentStage?: string;
    documentationReadiness?: string;
    inventorOwnership?: string;
    developmentContext?: string;
    targetMarkets?: string;
    commercializationStrategy?: string;
    publicDisclosureStatus?: string;
    legalAgreements?: string;
    ipProtectionType?: string;
  };
  initializationProfile?: {
    vision?: string;
    mission?: string;
    foundingStory?: string;
    teamComposition?: string;
    productStage?: string;
    productOverview?: string;
    customerProfile?: string;
    marketOpportunity?: string;
    businessModel?: string;
    pricingStrategy?: string;
    competitiveLandscape?: string;
    defensibleMoat?: string;
    currentTraction?: string;
    upcomingMilestones?: string;
    fundingAsk?: string;
    legalEntityType?: string;
    risksAndMitigation?: string;
  };
}): StartupReadiness => {
  const missingItems: string[] = [];
  const founderIds = Array.isArray(startup.founderIds) ? startup.founderIds : [];
  const uploadedDocumentCategories = getUploadedDocumentCategories(startup.documents);
  const uploadedCategorySet = new Set(uploadedDocumentCategories);
  const requiredDocumentCategories = getLegacyRequiredStartupDocumentCategories(startup);
  const hasInitializationNarrative = Boolean(
    startup.initializationProfile?.vision?.trim() ||
      startup.initializationProfile?.mission?.trim() ||
      startup.initializationProfile?.productOverview?.trim(),
  );

  const addMissing = (condition: boolean, label: string) => {
    if (condition) missingItems.push(label);
  };

  addMissing(!startup.name?.trim(), 'startup name');
  addMissing(!startup.tagline?.trim(), 'startup tagline');
  addMissing(!startup.category?.trim(), 'startup category');
  addMissing(!startup.projectId, 'linked workspace');
  addMissing(founderIds.length === 0, 'at least one founder');

  if (hasInitializationNarrative) {
    addMissing((startup.initializationProfile?.vision?.trim().length ?? 0) < 40, 'startup vision');
    addMissing((startup.initializationProfile?.mission?.trim().length ?? 0) < 40, 'startup mission');
    addMissing((startup.initializationProfile?.foundingStory?.trim().length ?? 0) < 60, 'founding story');
    addMissing((startup.initializationProfile?.teamComposition?.trim().length ?? 0) < 40, 'team composition');
    addMissing(!startup.initializationProfile?.productStage?.trim(), 'product stage');
    addMissing((startup.initializationProfile?.productOverview?.trim().length ?? 0) < 40, 'product overview');
    addMissing((startup.initializationProfile?.customerProfile?.trim().length ?? 0) < 30, 'ideal customer profile');
    addMissing((startup.initializationProfile?.marketOpportunity?.trim().length ?? 0) < 40, 'market opportunity');
    addMissing(!startup.initializationProfile?.businessModel?.trim(), 'business model');
    addMissing((startup.initializationProfile?.pricingStrategy?.trim().length ?? 0) < 30, 'pricing strategy');
    addMissing((startup.initializationProfile?.competitiveLandscape?.trim().length ?? 0) < 30, 'competitive landscape');
    addMissing((startup.initializationProfile?.defensibleMoat?.trim().length ?? 0) < 30, 'defensible moat');
    addMissing((startup.initializationProfile?.currentTraction?.trim().length ?? 0) < 20, 'current traction');
    addMissing((startup.initializationProfile?.upcomingMilestones?.trim().length ?? 0) < 30, 'upcoming milestones');
    addMissing((startup.initializationProfile?.fundingAsk?.trim().length ?? 0) < 30, 'funding ask');
    addMissing(!startup.initializationProfile?.legalEntityType?.trim(), 'legal entity type');
    addMissing((startup.initializationProfile?.risksAndMitigation?.trim().length ?? 0) < 30, 'risks and mitigation');
  } else {
    addMissing((startup.registrationProfile?.problemStatement?.trim().length ?? 0) < 40, 'problem statement');
    addMissing(
      (startup.registrationProfile?.solutionDifferentiation?.trim().length ?? 0) < 40,
      'solution differentiation',
    );
    addMissing((startup.registrationProfile?.coreInnovation?.trim().length ?? 0) < 30, 'core innovation');
    addMissing((startup.registrationProfile?.workingMechanism?.trim().length ?? 0) < 40, 'working mechanism');
    addMissing((startup.registrationProfile?.keyComponents?.trim().length ?? 0) < 20, 'key components');
    addMissing((startup.registrationProfile?.documentationReadiness?.trim().length ?? 0) < 10, 'documentation readiness');
    addMissing((startup.registrationProfile?.targetMarkets?.trim().length ?? 0) < 20, 'target markets');
    addMissing(!startup.registrationProfile?.developmentStage?.trim(), 'development stage');
  }
  addMissing(!startup.pitchDeckUrl && !uploadedCategorySet.has('business_plan'), 'business plan or pitch deck upload');

  for (const category of requiredDocumentCategories) {
    addMissing(!uploadedCategorySet.has(category), documentLabelMap[category]);
  }

  return {
    isReviewReady: missingItems.length === 0,
    missingItems,
    requiredDocumentCategories,
    uploadedDocumentCategories,
  };
};

const buildInnovationStartupReadiness = (startup: Record<string, any>): StartupReadiness => {
  const missingItems: string[] = [];
  const founderIds = Array.isArray(startup.founderIds) ? startup.founderIds : [];
  const companyProfile = startup.innovationProfile?.companyProfile ?? {};
  const tractionProfile = startup.innovationProfile?.tractionProfile ?? {};
  const uploadedDocumentCategories = getUploadedDocumentCategories(startup.documents);
  const uploadedCategorySet = new Set(uploadedDocumentCategories);
  const requiredDocumentCategories = getInnovationRequiredDocumentCategories(startup);

  const addMissing = (condition: boolean, label: string) => {
    if (condition) {
      missingItems.push(label);
    }
  };

  addMissing(!startup.name?.trim(), 'startup name');
  addMissing(!startup.tagline?.trim(), 'startup tagline');
  addMissing(!startup.category?.trim(), 'startup category');
  addMissing(!startup.projectId, 'linked workspace');
  addMissing(founderIds.length === 0, 'at least one founder');
  addMissing(!companyProfile.legalStructure?.trim(), 'legal structure');
  addMissing(
    REGISTERED_ENTITY_TYPES.has(companyProfile.legalStructure) &&
      !companyProfile.cinNumber?.trim(),
    'CIN number',
  );
  addMissing(
    !startup.pitchDeckUrl && !uploadedCategorySet.has('dpr'),
    'pitch deck or DPR upload',
  );
  addMissing(
    !companyProfile.websiteUrl?.trim() &&
      !companyProfile.productDemoUrl?.trim() &&
      !companyProfile.portfolioUrl?.trim(),
    'website, demo, or portfolio link',
  );
  addMissing(!tractionProfile.startupStage?.trim(), 'startup stage');
  addMissing((tractionProfile.problemClarity?.trim().length ?? 0) < 30, 'problem clarity');
  addMissing((tractionProfile.uniqueSolution?.trim().length ?? 0) < 30, 'unique solution');
  addMissing(
    (tractionProfile.marketDifferentiation?.trim().length ?? 0) < 30,
    'market differentiation',
  );

  if (
    companyProfile.otherGovernmentCertificationName?.trim() &&
    !companyProfile.otherGovernmentCertificationNumber?.trim()
  ) {
    missingItems.push('other government certification number');
  }

  for (const category of requiredDocumentCategories) {
    if (
      category === 'government_certificate_other' &&
      uploadedCategorySet.has('startup_india_certificate')
    ) {
      continue;
    }
    addMissing(!uploadedCategorySet.has(category), documentLabelMap[category]);
  }

  return {
    isReviewReady: missingItems.length === 0,
    missingItems,
    requiredDocumentCategories,
    uploadedDocumentCategories,
  };
};

const buildStartupReadiness = (startup: Record<string, any>): StartupReadiness =>
  usesInnovationRubric(startup)
    ? buildInnovationStartupReadiness(startup)
    : buildLegacyStartupReadiness(startup as never);

const getActiveLinkedWorkspace = async (startup: Record<string, any>) => {
  if (!startup.projectId) {
    throw new ApiError(
      400,
      'STARTUP_WORKSPACE_REQUIRED',
      'Link an active workspace before the startup can be verified.',
      [{ missingItems: ['linked workspace'] }],
    );
  }

  const workspace = await Workspace.findOne({ _id: startup.projectId, isActive: true })
    .select('_id title category')
    .lean<{ _id: Types.ObjectId; title: string; category: string }>();

  if (!workspace) {
    throw new ApiError(
      400,
      'STARTUP_WORKSPACE_INVALID',
      'The linked workspace is unavailable. Link an active workspace before verification.',
      [{ missingItems: ['active workspace link'] }],
    );
  }

  return workspace;
};

const assertStartupVerificationReady = async (startup: Record<string, any>) => {
  const readiness = buildStartupReadiness(startup);

  if (!readiness.isReviewReady) {
    throw new ApiError(
      400,
      'STARTUP_INCOMPLETE',
      `Complete the startup profile before verification. Missing: ${formatMissingItems(readiness.missingItems)}.`,
      [{ missingItems: readiness.missingItems }],
    );
  }

  const workspace = await getActiveLinkedWorkspace(startup);
  return { readiness, workspace };
};

const formatMissingItems = (items: string[]) => {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
};

const completionScore = (checks: boolean[], maxScore: number) => {
  if (checks.length === 0) {
    return 0;
  }

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * maxScore);
};

const buildLegacyInnovationScoreBreakdown = (
  startup: Record<string, any>,
): StartupInnovationScoreBreakdown => {
  const readiness = buildLegacyStartupReadiness(startup as never);
  const businessProfile = startup.businessProfile ?? {};
  const initializationProfile = startup.initializationProfile ?? {};
  const traction = startup.traction ?? {};
  const requiredDocuments = readiness.requiredDocumentCategories ?? [];
  const uploadedDocuments = new Set(readiness.uploadedDocumentCategories ?? []);
  const uploadedRequiredDocuments =
    requiredDocuments.length > 0
      ? requiredDocuments.filter((category) => uploadedDocuments.has(category)).length
      : 0;
  const businessPitchReady =
    Boolean(startup.pitchDeckUrl) || uploadedDocuments.has('business_plan');

  const businessScore = completionScore(
    [
      Boolean(startup.name?.trim()),
      Boolean(startup.tagline?.trim()),
      Boolean(startup.category?.trim()),
      Boolean(businessProfile.problemStatement?.trim()),
      Boolean(businessProfile.solutionSummary?.trim()),
      Boolean(businessProfile.targetCustomers?.trim()),
      Boolean(businessProfile.marketAnalysis?.trim()),
      Boolean(businessProfile.revenueModel?.trim()),
      Boolean(businessProfile.goToMarketPlan?.trim()),
    ],
    250,
  );

  const registrationScore = completionScore(
    [
      Boolean(initializationProfile.vision?.trim()),
      Boolean(initializationProfile.mission?.trim()),
      Boolean(initializationProfile.foundingStory?.trim()),
      Boolean(initializationProfile.teamComposition?.trim()),
      Boolean(initializationProfile.productOverview?.trim()),
      Boolean(initializationProfile.customerProfile?.trim()),
      Boolean(initializationProfile.marketOpportunity?.trim()),
      Boolean(initializationProfile.pricingStrategy?.trim()),
      Boolean(initializationProfile.competitiveLandscape?.trim()),
      Boolean(initializationProfile.defensibleMoat?.trim()),
      Boolean(initializationProfile.currentTraction?.trim()),
      Boolean(initializationProfile.upcomingMilestones?.trim()),
    ],
    250,
  );

  const documentationScore =
    Math.round(
      ((requiredDocuments.length > 0 ? uploadedRequiredDocuments / requiredDocuments.length : 1) * 100),
    ) + (businessPitchReady ? 50 : 0);

  const tractionScore =
    (traction.patentFiled ? 60 : 0) +
    (traction.mvpBuilt ? 90 : 0) +
    (traction.revenueGenerating ? 70 : 0) +
    Math.round((Math.min(traction.usersCount ?? 0, 1000) / 1000) * 30);

  const teamScore = Math.min(
    100,
    Math.min(startup.founderIds?.length ?? 0, 4) * 15 +
      Math.min(startup.teamSize ?? startup.founderIds?.length ?? 0, 8) * 5 +
      (readiness.isReviewReady ? 20 : 0) +
      (startup.reviewStatus === 'approved' ? 20 : 0),
  );

  const total = normalizeInnovationScore(
    businessScore + registrationScore + documentationScore + tractionScore + teamScore,
  );

  return {
    total,
    companyProfile: {
      total: businessScore + documentationScore,
      businessScore,
      documentationScore,
    },
    healthAndTraction: {
      total: registrationScore + tractionScore + teamScore,
      registrationScore,
      tractionScore,
      teamScore,
    },
  };
};

const calculateMetricScore = (
  value: number,
  thresholds: Array<{ min: number; score: number }>,
) => {
  for (const threshold of thresholds) {
    if (value >= threshold.min) {
      return threshold.score;
    }
  }
  return 0;
};

const buildRubricInnovationScoreBreakdown = (
  startup: Record<string, any>,
): StartupInnovationScoreBreakdown => {
  const uploadedDocuments = new Set(getUploadedDocumentCategories(startup.documents));
  const companyProfile = startup.innovationProfile?.companyProfile ?? {};
  const tractionProfile = startup.innovationProfile?.tractionProfile ?? {};

  const legalStructure = REGISTERED_ENTITY_TYPES.has(companyProfile.legalStructure) ? 50 : 0;
  const cinNumber =
    companyProfile.cinNumber?.trim() && uploadedDocuments.has('incorporation_certificate')
      ? 30
      : 0;
  const dpiitRecognition =
    companyProfile.dpiitRecognitionNumber?.trim() && uploadedDocuments.has('dpiit_certificate')
      ? 70
      : 0;
  const msmeUdyam =
    companyProfile.msmeUdyamNumber?.trim() && uploadedDocuments.has('udyam_certificate')
      ? 20
      : 0;
  const hasOtherGovernmentCertificationProof =
    uploadedDocuments.has('government_certificate_other') ||
    uploadedDocuments.has('startup_india_certificate');
  const otherGovernmentCertification =
    (companyProfile.otherGovernmentCertificationName?.trim() ||
      companyProfile.otherGovernmentCertificationNumber?.trim() ||
      uploadedDocuments.has('startup_india_certificate')) &&
    hasOtherGovernmentCertificationProof
      ? 10
      : 0;
  const governmentRecognition = Math.min(
    100,
    dpiitRecognition + msmeUdyam + otherGovernmentCertification,
  );
  const companyDocumentation = startup.pitchDeckUrl || uploadedDocuments.has('dpr') ? 50 : 0;
  const portfolioPresence =
    companyProfile.websiteUrl?.trim() ||
    companyProfile.productDemoUrl?.trim() ||
    companyProfile.portfolioUrl?.trim()
      ? 20
      : 0;

  const stageScoreMap = {
    idea: 50,
    mvp_ready: 100,
    market_ready: 150,
    revenue_generating: 200,
  } as const;
  const startupStage =
    stageScoreMap[
      (tractionProfile.startupStage as keyof typeof stageScoreMap) ?? 'idea'
    ] ?? 0;
  const problemClarity = (tractionProfile.problemClarity?.trim().length ?? 0) >= 30 ? 40 : 0;
  const uniqueSolution = (tractionProfile.uniqueSolution?.trim().length ?? 0) >= 30 ? 40 : 0;
  const marketDifferentiation =
    (tractionProfile.marketDifferentiation?.trim().length ?? 0) >= 30 ? 40 : 0;
  const innovationUniqueness = problemClarity + uniqueSolution + marketDifferentiation;
  const hasPatentProof = uploadedDocuments.has('patent_proof');
  const patentFiled =
    (tractionProfile.patentStatus === 'filed' ||
      tractionProfile.patentStatus === 'published') &&
    hasPatentProof
      ? 40
      : 0;
  const patentPublished =
    tractionProfile.patentStatus === 'published' && hasPatentProof ? 80 : 0;
  const patentStrength = Math.min(120, patentFiled + patentPublished);
  const itrFiling =
    tractionProfile.hasItrFiling && uploadedDocuments.has('itr_filing') ? 40 : 0;
  const revenueProof =
    tractionProfile.hasRevenueProof && uploadedDocuments.has('revenue_proof') ? 80 : 0;
  const revenueValidation = itrFiling + revenueProof;
  const governmentGrant =
    tractionProfile.hasGovernmentGrant && uploadedDocuments.has('grant_certificate') ? 40 : 0;
  const awardsRecognition =
    tractionProfile.hasAwardRecognition && uploadedDocuments.has('award_certificate') ? 20 : 0;
  const grantsAndRecognition = governmentGrant + awardsRecognition;
  const fundingStatus =
    tractionProfile.fundingStatus === 'vc'
      ? uploadedDocuments.has('funding_proof')
        ? 60
        : 0
      : tractionProfile.fundingStatus === 'angel_seed'
        ? uploadedDocuments.has('funding_proof')
          ? 40
          : 0
        : tractionProfile.fundingStatus === 'bootstrapped'
          ? 20
          : 0;
  const activeUsersCustomers = calculateMetricScore(
    Number(tractionProfile.activeUsersCustomers) || 0,
    [
      { min: 500, score: 30 },
      { min: 100, score: 25 },
      { min: 25, score: 15 },
      { min: 1, score: 5 },
    ],
  );
  const growthRate = calculateMetricScore(Number(tractionProfile.monthlyGrowthRate) || 0, [
    { min: 20, score: 20 },
    { min: 10, score: 15 },
    { min: 5, score: 10 },
    { min: 1, score: 5 },
  ]);
  const retention = calculateMetricScore(Number(tractionProfile.retentionRate) || 0, [
    { min: 60, score: 20 },
    { min: 40, score: 15 },
    { min: 20, score: 10 },
    { min: 1, score: 5 },
  ]);
  const tractionMetrics = activeUsersCustomers + growthRate + retention;

  const companyTotal =
    legalStructure +
    cinNumber +
    governmentRecognition +
    companyDocumentation +
    portfolioPresence;
  const healthTotal =
    startupStage +
    innovationUniqueness +
    patentStrength +
    revenueValidation +
    grantsAndRecognition +
    fundingStatus +
    tractionMetrics;
  const total = normalizeInnovationScore(companyTotal + healthTotal);

  return {
    total,
    companyProfile: {
      total: companyTotal,
      legalStructure,
      cinNumber,
      governmentRecognition,
      companyDocumentation,
      portfolioPresence,
    },
    healthAndTraction: {
      total: healthTotal,
      startupStage,
      innovationUniqueness,
      patentStrength,
      patentFiled,
      patentPublished,
      revenueValidation,
      grantsAndRecognition,
      fundingStatus,
      tractionMetrics,
    },
  };
};

const calculateStartupInnovationScoreBreakdown = (
  startup: Record<string, any>,
): StartupInnovationScoreBreakdown =>
  usesInnovationRubric(startup)
    ? buildRubricInnovationScoreBreakdown(startup)
    : buildLegacyInnovationScoreBreakdown(startup);

const calculateStartupInnovationScore = (startup: Record<string, any>) =>
  calculateStartupInnovationScoreBreakdown(startup).total;

const getSignedStartupPitchDeckUrl = async (startup: {
  pitchDeckUrl?: string;
  pitchDeckStorageProvider?: 'cloudinary' | 's3';
  pitchDeckStorageKey?: string;
}) => {
  let pitchDeckUrl = startup.pitchDeckUrl;
  if (pitchDeckUrl) {
    try {
      if (startup.pitchDeckStorageProvider === 'cloudinary') {
        const storageKey = startup.pitchDeckStorageKey || extractCloudinaryPublicId(pitchDeckUrl);
        if (storageKey) {
          pitchDeckUrl = generateSignedCloudinaryUrl(storageKey, 'raw');
        }
      } else {
        const storageKey =
          startup.pitchDeckStorageProvider === 's3'
            ? startup.pitchDeckStorageKey || extractS3KeyFromUrl(pitchDeckUrl)
            : extractS3KeyFromUrl(pitchDeckUrl);
        if (storageKey) {
          pitchDeckUrl = await generatePresignedUrl(storageKey);
        }
      }
    } catch (error) {
      console.error('Error generating signed URL for pitch deck:', error);
    }
  }

  return pitchDeckUrl;
};

const sanitizeStartupForClient = async (startup: Record<string, any>) => {
  const editAccess = buildStartupEditAccess(startup);
  const innovationScorePreview = calculateStartupInnovationScoreBreakdown(startup);
  const pitchDeckUrl = await getSignedStartupPitchDeckUrl(startup);

  return {
    ...startup,
    pitchDeckUrl,
    reviewStatus: startup.reviewStatus ?? 'draft',
    documents: (startup.documents ?? []).map((document: Record<string, any>) => ({
      _id: document._id,
      category: document.category,
      fileUrl: document.fileUrl,
      fileType: document.fileType,
      fileName: document.fileName,
      fileSizeBytes: document.fileSizeBytes,
      uploadedAt: document.uploadedAt,
      ...(document.note ? { note: document.note } : {}),
    })),
    editAccess: {
      ...editAccess,
      ...(editAccess.unlockedAt ? { unlockedAt: editAccess.unlockedAt.toISOString() } : {}),
      ...(editAccess.unlockedBy ? { unlockedBy: String(editAccess.unlockedBy) } : {}),
    },
    readiness: buildStartupReadiness(startup as never),
    innovationScorePreview,
  };
};

const extractCloudinaryPublicId = (url: string): string | null => {
  if (!url || !url.includes('cloudinary.com')) return null;
  const match = url.match(/upload\/v\d+\/(.+)$/);
  return match ? match[1].replace(/\.[^.]+$/, '') : null;
};

const serializeStartup = async (startup: { toObject?: () => Record<string, any> } | Record<string, any>) => {
  const base = typeof (startup as { toObject?: () => Record<string, any> }).toObject === 'function'
    ? (startup as { toObject: () => Record<string, any> }).toObject()
    : (startup as Record<string, any>);

  const withPhase = { ...base };
  if (!withPhase.phase) {
    withPhase.phase = autoAdvancePhase(base);
  }

  return sanitizeStartupForClient(withPhase);
};

export const createStartupProfile = async (userId: string, payload: z.infer<typeof startupSchema>) => {
  const normalizedPayload = normalizeStartupPayload(buildStartupInput(payload));
  const startupPayload = await applyWorkspaceContextToStartupPayload(userId, normalizedPayload);

  const startup = await Startup.create({
    ...startupPayload,
  });

  await recordStartupLifecycleEvent({
    startupId: startup._id,
    workspaceId: startup.projectId,
    actorId: userId,
    source: 'startup',
    type: 'STARTUP_CREATED',
    title: 'Startup draft created',
    description: startup.name ? `${startup.name} was created as a startup draft.` : 'A startup draft was created.',
    status: startup.reviewStatus,
    metadata: {
      name: startup.name,
      category: startup.category,
      stage: startup.stage,
      phase: startup.phase,
    },
  });

  return serializeStartup(startup);
};

export const getMyStartups = async (userId: string) => {
  const workspaceIds = await getAccessibleWorkspaceIds(userId);
  const startups = await Startup.find(buildAccessibleStartupQuery(userId, workspaceIds))
    .sort({ updatedAt: -1 })
    .lean();
  return Promise.all(startups.map((startup) => serializeStartup(startup)));
};

export const getStartupById = async (startupId: string, userId: string) => {
  const workspaceIds = await getAccessibleWorkspaceIds(userId);
  let startup = await Startup.findOne({
    _id: startupId,
    ...buildAccessibleStartupQuery(userId, workspaceIds),
  }).lean();

  if (!startup) {
    const hasInvestorAccess = await Deal.exists({
      startupId,
      investorId: userId,
      status: { $ne: 'cancelled' },
      $or: [{ 'founderDecision.status': 'accepted' }, { stage: { $gte: 2 } }],
    });

    if (hasInvestorAccess) {
      startup = await Startup.findOne({ _id: startupId, isActive: true }).lean();
    }
  }

  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found.');
  }
  return serializeStartup(startup);
};

export const getStartupForFounder = async (startupId: string, userId: string) => {
  const workspaceIds = await getAccessibleWorkspaceIds(userId);
  const startup = await Startup.findOne({
    _id: startupId,
    ...buildAccessibleStartupQuery(userId, workspaceIds),
  });
  if (!startup) {
    throw new ApiError(403, 'FORBIDDEN', 'Only founders can access this startup.');
  }

  return startup;
};

export const updateStartupProfile = async (
  startupId: string,
  userId: string,
  payload: Partial<z.infer<typeof startupSchema>>,
) => {
  const startup = await getStartupForFounder(startupId, userId);
  const previousProjectId = startup.projectId ? String(startup.projectId) : undefined;
  const previousReviewStatus = startup.reviewStatus;
  const isInitialWorkspaceLink = !startup.projectId && Boolean(payload.projectId);
  const canAttachMissingWorkspaceDuringReview =
    isInitialWorkspaceLink && startup.reviewStatus === 'review_requested';

  if (!canAttachMissingWorkspaceDuringReview) {
    prepareStartupForEditableMutation(startup);
  }
  const startupSnapshot = startup.toObject();
  const mergedPayload = buildStartupInput({
    ...startupSnapshot,
    ...payload,
    businessProfile: {
      ...(startupSnapshot.businessProfile ?? {}),
      ...(payload.businessProfile ?? {}),
    },
    registrationProfile: {
      ...(startupSnapshot.registrationProfile ?? {}),
      ...(payload.registrationProfile ?? {}),
    },
    innovationProfile: {
      ...(startupSnapshot.innovationProfile ?? {}),
      ...(payload.innovationProfile ?? {}),
      companyProfile: {
        ...(startupSnapshot.innovationProfile?.companyProfile ?? {}),
        ...(payload.innovationProfile?.companyProfile ?? {}),
      },
      tractionProfile: {
        ...(startupSnapshot.innovationProfile?.tractionProfile ?? {}),
        ...(payload.innovationProfile?.tractionProfile ?? {}),
      },
    },
    traction: {
      ...(startupSnapshot.traction ?? {}),
      ...(payload.traction ?? {}),
    },
  });
  const normalizedPayload = normalizeStartupPayload(mergedPayload);
  const startupPayload = await applyWorkspaceContextToStartupPayload(userId, normalizedPayload);

  // Preserve existing founderIds — don't demote co-founders on update
  const existingFounderSet = new Set(startup.founderIds.map((id) => String(id)));
  const combinedFounderIds = [...startup.founderIds];
  for (const newId of startupPayload.founderIds) {
    if (!existingFounderSet.has(String(newId))) {
      combinedFounderIds.push(newId);
    }
  }
  startupPayload.founderIds = combinedFounderIds;

  // Team members = workspace members who are NOT founders
  const founderSet = new Set(combinedFounderIds.map((id) => String(id)));
  startupPayload.teamMemberIds = startupPayload.teamMemberIds.filter(
    (id) => !founderSet.has(String(id)),
  );

  Object.assign(startup, startupPayload);

  await startup.save();
  await syncAcceptedInvestorWorkspaceAccess(
    String(startup._id),
    startup.projectId ? String(startup.projectId) : undefined,
  );
  const nextProjectId = startup.projectId ? String(startup.projectId) : undefined;
  await recordStartupLifecycleEvent({
    startupId: startup._id,
    workspaceId: startup.projectId,
    actorId: userId,
    source: previousProjectId !== nextProjectId ? 'workspace' : 'startup',
    type:
      previousProjectId !== nextProjectId
        ? nextProjectId
          ? 'WORKSPACE_LINKED'
          : 'WORKSPACE_UNLINKED'
        : 'STARTUP_UPDATED',
    title:
      previousProjectId !== nextProjectId
        ? nextProjectId
          ? 'Workspace linked'
          : 'Workspace unlinked'
        : 'Startup profile updated',
    description:
      previousProjectId !== nextProjectId
        ? nextProjectId
          ? 'A product workspace was linked to this startup.'
          : 'The linked product workspace was removed from this startup.'
        : previousReviewStatus !== startup.reviewStatus
          ? 'Startup profile was updated and moved back to draft.'
          : 'Startup profile fields were updated.',
    status: startup.reviewStatus,
    metadata: {
      previousProjectId,
      projectId: nextProjectId,
      reviewStatus: startup.reviewStatus,
      phase: startup.phase,
    },
  });
  return serializeStartup(startup);
};

export const requestStartupReview = async (startupId: string, userId: string) => {
  const startup = await getStartupForFounder(startupId, userId);

  if (startup.reviewStatus === 'approved') {
    throw new ApiError(409, 'STARTUP_ALREADY_APPROVED', 'Startup has already been approved.');
  }

  if (startup.reviewStatus === 'review_requested') {
    throw new ApiError(409, 'STARTUP_ALREADY_UNDER_REVIEW', 'Startup review is already pending.');
  }

  const { readiness } = await assertStartupVerificationReady(startup.toObject());

  startup.reviewStatus = 'review_requested';
  startup.reviewRequestedAt = new Date();
  startup.adminReviewedAt = undefined;
  startup.adminReviewedBy = null;
  startup.adminNotes = undefined;
  clearAdminEditUnlock(startup);
  await startup.save();

  await recordStartupLifecycleEvent({
    startupId: startup._id,
    workspaceId: startup.projectId,
    actorId: userId,
    source: 'startup',
    type: 'STARTUP_REVIEW_REQUESTED',
    title: 'Startup submitted for review',
    description: 'The startup profile was submitted for admin review.',
    status: startup.reviewStatus,
    metadata: {
      requiredDocumentCategories: readiness.requiredDocumentCategories,
      uploadedDocumentCategories: readiness.uploadedDocumentCategories,
    },
  });

  return serializeStartup(startup);
};

export const launchStartup = async (
  startupId: string,
  userId: string,
  payload: z.infer<typeof launchSchema>,
) => {
  const startup = await getStartupForFounder(startupId, userId);

  if (startup.reviewStatus !== 'approved') {
    throw new ApiError(
      403,
      'STARTUP_REVIEW_REQUIRED',
      'Startup must be approved by admin before it can be launched to the marketplace.',
    );
  }

  if ((payload.launchTo === 'investors' || payload.launchTo === 'both') && !startup.projectId) {
    throw new ApiError(
      400,
      'WORKSPACE_LINK_REQUIRED',
      'Link a product workspace to this startup before launching it to investors.',
    );
  }

  const score = calculateStartupInnovationScore(startup.toObject());

  startup.launchedToInvestors =
    startup.launchedToInvestors || payload.launchTo === 'investors' || payload.launchTo === 'both';
  startup.launchedToMentors =
    startup.launchedToMentors || payload.launchTo === 'mentors' || payload.launchTo === 'both';
  startup.launchedToRecruiters = startup.launchedToRecruiters || payload.launchTo === 'recruiters';
  startup.launchedAt = new Date();
  startup.marketplaceTermsAcceptedAt = new Date();
  startup.marketplaceTermsAcceptedBy = new Types.ObjectId(userId);
  startup.marketplaceTermsVersion = MARKETPLACE_LAUNCH_TERMS_VERSION;
  startup.innovationScoreAtLaunch = score;
  startup.launchFormLocked = true;
  startup.launchFormLockedAt = new Date();
  startup.phase = 'launched';
  if (payload.launchTo !== 'recruiters') {
    startup.stage = 'Launched';
  }
  await startup.save();

  if (payload.launchTo === 'recruiters') {
    const founder = await User.findByIdAndUpdate(
      userId,
      { discoverableToRecruiters: true },
      { new: true },
    )
      .select('innovationScore institutionId')
      .lean();

    if (founder?.institutionId) {
      const institution = await User.findById(founder.institutionId).select('role').lean();
      if (institution?.role === UserRole.COLLEGE) {
        await PlacementRecord.findOneAndUpdate(
          {
            studentId: userId,
            collegeId: founder.institutionId,
            status: 'Discovered',
          },
          {
            studentId: userId,
            collegeId: founder.institutionId,
            status: 'Discovered',
            innovationScoreAtTime: normalizeInnovationScore(founder.innovationScore ?? 0),
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          },
        );
      }
    }
  } else {
    await applyScoreAsync({
      userId,
      trigger: 'STARTUP_LAUNCHED',
      metadata: { startupId, launchTo: payload.launchTo },
      idempotencyKey: `startup-launched:${startupId}`,
    });
  }

  const targetRoles =
    payload.launchTo === 'both'
      ? [UserRole.INVESTOR, UserRole.MENTOR]
      : payload.launchTo === 'investors'
        ? [UserRole.INVESTOR]
        : payload.launchTo === 'mentors'
          ? [UserRole.MENTOR]
          : [UserRole.RECRUITER];

  const recipients = await User.find({ role: { $in: targetRoles }, isActive: true })
    .select('_id role')
    .lean<Array<{ _id: unknown; role: UserRole }>>();

  const getLaunchNotification = (recipientRole: UserRole) => {
    if (recipientRole === UserRole.INVESTOR) {
      return {
        type: 'startup_launch' as const,
        title: 'New startup is seeking investors',
        body: `${startup.name} is seeking investors on ProMove.`,
        link: '/dashboard/investor/startups',
      };
    }

    if (recipientRole === UserRole.MENTOR) {
      return {
        type: 'startup_launch' as const,
        title: 'New startup in your area launched',
        body: `${startup.name} has launched and is looking for mentorship.`,
        link: '/dashboard/mentor/students',
      };
    }

    return {
      type: 'deal_interest' as const,
      title: 'New startup launch',
      body: `${startup.name} is now live on ProMove.`,
      link: '/dashboard/recruiter',
    };
  };

  await Promise.all(
    recipients.map((recipient) =>
      notificationQueue.add('startup-launch', {
        userId: String(recipient._id),
        ...getLaunchNotification(recipient.role),
      }),
    ),
  );

  await recordStartupLifecycleEvent({
    startupId: startup._id,
    workspaceId: startup.projectId,
    actorId: userId,
    source: 'marketplace',
    type: 'STARTUP_LAUNCHED',
    title: 'Startup launched',
    description: `Startup was launched to ${payload.launchTo}.`,
    status: startup.phase,
    metadata: {
      launchTo: payload.launchTo,
      launchedToInvestors: startup.launchedToInvestors,
      launchedToMentors: startup.launchedToMentors,
      launchedToRecruiters: startup.launchedToRecruiters,
      innovationScoreAtLaunch: startup.innovationScoreAtLaunch,
    },
  });

  return serializeStartup(startup);
};

export const uploadPitchDeck = async (startupId: string, userId: string, file: Express.Multer.File) => {
  if (file.size < MIN_UPLOAD_FILE_BYTES) {
    throw new ApiError(400, 'EMPTY_FILE', 'Pitch deck file cannot be empty');
  }
  const isPdf = file.mimetype === 'application/pdf';
  const isPowerPoint =
    file.mimetype === 'application/vnd.ms-powerpoint' ||
    file.mimetype ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if ((!isPdf && !isPowerPoint) || !pitchDeckFileNamePattern.test(file.originalname)) {
    throw new ApiError(400, 'INVALID_FILE_TYPE', 'Only PDF, PPT, or PPTX files are allowed');
  }
  const startup = await getStartupForFounder(startupId, userId);
  prepareStartupForEditableMutation(startup);

  await deleteStoredAsset({
    storageProvider: startup.pitchDeckStorageProvider,
    storageKey: startup.pitchDeckStorageKey,
    cloudinaryPublicId: startup.pitchDeckCloudinaryPublicId,
    legacyCloudinaryResourceType: 'raw',
  });

  const uploaded = await uploadFile({
    buffer: file.buffer,
    folder: 'promove/startups',
    fileName: file.originalname,
    contentType: file.mimetype || 'application/octet-stream',
  });

  startup.pitchDeckUrl = uploaded.url;
  startup.pitchDeckName = file.originalname;
  startup.pitchDeckStorageProvider = uploaded.provider;
  startup.pitchDeckStorageKey = uploaded.key;
  startup.pitchDeckCloudinaryPublicId = undefined;

  await startup.save();
  await recordStartupLifecycleEvent({
    startupId: startup._id,
    workspaceId: startup.projectId,
    actorId: userId,
    source: 'startup',
    type: 'PITCH_DECK_UPLOADED',
    title: 'Pitch deck uploaded',
    description: `${file.originalname} was uploaded as the startup pitch deck.`,
    status: startup.reviewStatus,
    metadata: {
      fileName: file.originalname,
      fileSizeBytes: file.size,
      storageProvider: uploaded.provider,
    },
  });
  return serializeStartup(startup);
};

export const sendPitchRequest = async (
  startupId: string,
  studentId: string | Types.ObjectId,
  investorId: string | Types.ObjectId,
) => {
  const startup = await Startup.findById(startupId);
  if (!startup || !startup.isActive) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  const studentObjectId = new Types.ObjectId(studentId);
  const investorObjectId = new Types.ObjectId(investorId);

  if (!startup.founderIds.some(id => id.equals(studentObjectId))) {
    throw new ApiError(403, 'NOT_AUTHORIZED', 'Only founders can send pitch requests');
  }

  const existingRequest = startup.pitchRequests?.find(
    req => req.investorId.equals(investorObjectId) && req.status === 'pending',
  );

  if (existingRequest) {
    throw new ApiError(409, 'PITCH_REQUEST_EXISTS', 'A pending pitch request already exists for this investor');
  }

  if (!startup.pitchRequests) {
    startup.pitchRequests = [];
  }

  startup.pitchRequests.push({
    investorId: investorObjectId,
    status: 'pending',
    requestedAt: new Date(),
  });

  await startup.save();

  await recordStartupLifecycleEvent({
    startupId: startup._id,
    workspaceId: startup.projectId,
    actorId: studentObjectId,
    source: 'investor',
    type: 'INVESTOR_PITCH_REQUEST_SENT',
    title: 'Investor pitch request sent',
    description: 'A founder sent an investor pitch request.',
    status: 'pending',
    metadata: {
      investorId: investorObjectId.toString(),
    },
  });

  await notificationQueue.add('send-pitch-request-notification', {
    recipientId: investorObjectId.toString(),
    startupId: startup._id.toString(),
    startupName: startup.name,
    founderName: startup.founderIds[0]?.toString(),
    type: 'pitch_request',
  });

  return serializeStartup(startup);
};

export const respondToPitchRequest = async (
  startupId: string,
  studentId: string | Types.ObjectId,
  requestId: string,
  decision: 'accepted' | 'rejected',
  note?: string,
) => {
  const startup = await Startup.findById(startupId);
  if (!startup || !startup.isActive) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  const studentObjectId = new Types.ObjectId(studentId);

  if (!startup.founderIds.some(id => id.equals(studentObjectId))) {
    throw new ApiError(403, 'NOT_AUTHORIZED', 'Only founders can respond to pitch requests');
  }

  const request = startup.pitchRequests?.find((pitchRequest) => String(pitchRequest._id) === requestId);
  if (!request) {
    throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Pitch request not found');
  }

  if (request.status !== 'pending') {
    throw new ApiError(409, 'REQUEST_ALREADY_HANDLED', 'Pitch request has already been handled');
  }

  request.status = decision;
  request.respondedAt = new Date();
  if (note) {
    request.responseNote = note;
  }

  await startup.save();

  await recordStartupLifecycleEvent({
    startupId: startup._id,
    workspaceId: startup.projectId,
    actorId: studentObjectId,
    source: 'investor',
    type: 'INVESTOR_PITCH_REQUEST_RESPONDED',
    title: 'Investor pitch request updated',
    description: `A pitch request was ${decision}.`,
    status: decision,
    metadata: {
      requestId,
      investorId: request.investorId.toString(),
      ...(note ? { note } : {}),
    },
  });

  await notificationQueue.add('pitch-request-response-notification', {
    recipientId: request.investorId.toString(),
    startupId: startup._id.toString(),
    startupName: startup.name,
    decision,
    note,
    type: 'pitch_request_response',
  });

  return serializeStartup(startup);
};

export const getInvestorPitchRequests = async (investorId: string | Types.ObjectId) => {
  const investorObjectId = new Types.ObjectId(investorId);

  const startups = await Startup.find({
    'pitchRequests.investorId': investorObjectId,
    isActive: true,
  }).lean();

  const pitchRequests = startups.flatMap(startup =>
    (startup.pitchRequests || [])
      .filter(req => req.investorId.equals(investorObjectId))
      .map(req => ({
        _id: req._id,
        startupId: startup._id,
        startupName: startup.name,
        startupTagline: startup.tagline,
        startupCategory: startup.category,
        startupStage: startup.stage,
        status: req.status,
        requestedAt: req.requestedAt,
        respondedAt: req.respondedAt,
        responseNote: req.responseNote,
      })),
  );

  return pitchRequests;
};

export const approveLaunchFormUnlock = async (
  adminId: string,
  startupId: string,
  options?: { reason?: string; sourceTicketId?: string },
) => {
  const startup = await Startup.findById(startupId);

  if (!startup || !startup.isActive) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  const currentEditAccess = buildStartupEditAccess(startup.toObject());
  if (!currentEditAccess.launchFormLocked || currentEditAccess.launchFormUnlockedByAdmin) {
    throw new ApiError(409, 'LAUNCH_FORM_ALREADY_EDITABLE', 'Launch form is already editable.');
  }

  startup.launchFormUnlockedByAdmin = true;
  startup.launchFormUnlockedAt = new Date();
  startup.launchFormUnlockedBy = new Types.ObjectId(adminId);
  startup.launchFormUnlockReason = options?.reason?.trim() || undefined;
  await startup.save();

  await AdminAuditLog.create({
    adminId: new Types.ObjectId(adminId),
    action: 'LAUNCH_FORM_UNLOCKED',
    targetId: startup._id,
    targetModel: 'Startup',
    metadata: {
      ...(startup.launchFormUnlockReason ? { unlockReason: startup.launchFormUnlockReason } : {}),
      ...(options?.sourceTicketId ? { sourceTicketId: options.sourceTicketId } : {}),
    },
  });

  return serializeStartup(startup);
};

export const uploadStartupDocument = async (
  startupId: string,
  userId: string,
  file: Express.Multer.File,
  payload: z.infer<typeof startupDocumentUploadSchema>,
) => {
  if (file.size < MIN_UPLOAD_FILE_BYTES) {
    throw new ApiError(400, 'EMPTY_FILE', 'Document file cannot be empty');
  }
  const startup = await getStartupForFounder(startupId, userId);
  prepareStartupForEditableMutation(startup);
  const fileType = file.mimetype === 'application/pdf' ? 'pdf' : 'image';
  const uploaded = await uploadFile({
    buffer: file.buffer,
    folder: 'promove/startup-documents',
    fileName: file.originalname,
    contentType: file.mimetype || (fileType === 'pdf' ? 'application/pdf' : 'image/jpeg'),
  });

  const existingDocument = startup.documents.find((document) => document.category === payload.category);
  await deleteStoredAsset({
    storageProvider: existingDocument?.storageProvider,
    storageKey: existingDocument?.storageKey,
    cloudinaryPublicId: existingDocument?.cloudinaryPublicId,
    legacyCloudinaryResourceType:
      existingDocument?.fileType === 'pdf' ? 'raw' : existingDocument?.fileType === 'image' ? 'image' : undefined,
  });

  startup.documents = startup.documents.filter((document) => document.category !== payload.category);
  startup.documents.push({
    _id: new Types.ObjectId(),
    category: payload.category,
    fileUrl: uploaded.url,
    fileType,
    fileName: file.originalname,
    fileSizeBytes: file.size,
    uploadedAt: new Date(),
    uploadedBy: new Types.ObjectId(userId),
    ...(payload.note?.trim() ? { note: payload.note.trim() } : {}),
    storageProvider: uploaded.provider,
    storageKey: uploaded.key,
  });

  await startup.save();
  await recordStartupLifecycleEvent({
    startupId: startup._id,
    workspaceId: startup.projectId,
    actorId: userId,
    source: 'startup',
    type: 'STARTUP_DOCUMENT_UPLOADED',
    title: 'Startup proof uploaded',
    description: `${file.originalname} was uploaded as ${payload.category.replace(/_/g, ' ')}.`,
    status: startup.reviewStatus,
    metadata: {
      category: payload.category,
      fileName: file.originalname,
      fileSizeBytes: file.size,
      storageProvider: uploaded.provider,
    },
  });
  return serializeStartup(startup);
};

export const deleteStartupDocument = async (startupId: string, userId: string, documentId: string) => {
  const startup = await getStartupForFounder(startupId, userId);
  prepareStartupForEditableMutation(startup);
  const document = startup.documents.find((item) => String(item._id) === documentId);

  if (!document) {
    throw new ApiError(404, 'STARTUP_DOCUMENT_NOT_FOUND', 'Startup document not found.');
  }

  await deleteStoredAsset({
    storageProvider: document.storageProvider,
    storageKey: document.storageKey,
    cloudinaryPublicId: document.cloudinaryPublicId,
    legacyCloudinaryResourceType: document.fileType === 'pdf' ? 'raw' : 'image',
  });

  startup.documents = startup.documents.filter((item) => String(item._id) !== documentId);

  await startup.save();
  await recordStartupLifecycleEvent({
    startupId: startup._id,
    workspaceId: startup.projectId,
    actorId: userId,
    source: 'startup',
    type: 'STARTUP_DOCUMENT_REMOVED',
    title: 'Startup proof removed',
    description: `${document.fileName} was removed from startup proof documents.`,
    status: startup.reviewStatus,
    metadata: {
      documentId,
      category: document.category,
      fileName: document.fileName,
    },
  });
  return serializeStartup(startup);
};

export const deleteStartup = async (startupId: string, userId: string) => {
  const startup = await getStartupForFounder(startupId, userId);

  // Only the primary founder (first in the list) can delete
  if (String(startup.founderIds[0]) !== String(userId)) {
    throw new ApiError(403, 'FORBIDDEN', 'Only the primary founder can delete this startup.');
  }

  // Marketplace launches become public commercial records and require admin-managed deletion.
  if (startup.launchedToInvestors || startup.launchedToMentors || startup.launchedToRecruiters) {
    throw new ApiError(
      400,
      'STARTUP_LAUNCHED_DELETION_REQUIRES_ADMIN',
      'This startup is live on the marketplace. Request admin deletion instead of deleting it directly.',
    );
  }

  // Cannot delete if the startup has active investor deals
  const hasDeals = await Deal.exists({
    startupId: startup._id,
    status: { $ne: 'cancelled' },
  });

  if (hasDeals) {
    throw new ApiError(
      400,
      'STARTUP_HAS_INVESTORS',
      'Cannot delete a startup that has active investor deals. Cancel all deals first.',
    );
  }

  if (await startupHasPatentWorkflow(startup)) {
    throw new ApiError(
      400,
      'STARTUP_HAS_PATENT',
      'This startup has a patent record and cannot be deleted. Contact admin if this startup must be archived.',
    );
  }

  // Clean up pitch deck
  await deleteStoredAsset({
    storageProvider: startup.pitchDeckStorageProvider,
    storageKey: startup.pitchDeckStorageKey,
    cloudinaryPublicId: startup.pitchDeckCloudinaryPublicId,
    legacyCloudinaryResourceType: 'raw',
  });

  // Clean up uploaded documents
  await Promise.all(
    startup.documents.map((document) =>
      deleteStoredAsset({
        storageProvider: document.storageProvider,
        storageKey: document.storageKey,
        cloudinaryPublicId: document.cloudinaryPublicId,
        legacyCloudinaryResourceType: document.fileType === 'pdf' ? 'raw' : 'image',
      }),
    ),
  );

  // Soft delete
  startup.isActive = false;
  await startup.save();
  await deleteRequestsLinkedToStartup(startupId);
};

export const adminDeleteStartup = async (adminId: string, startupId: string) => {
  const startup = await Startup.findById(startupId);

  if (!startup || !startup.isActive) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  // Block deletion while investor deals are still live — capital and equity are in play.
  const hasActiveDeals = await Deal.exists({
    startupId: startup._id,
    status: { $ne: 'cancelled' },
  });

  if (hasActiveDeals) {
    throw new ApiError(
      400,
      'STARTUP_HAS_INVESTORS',
      'Cannot delete a startup with active investor deals. Cancel all deals first.',
    );
  }

  // Clean up pitch deck
  await deleteStoredAsset({
    storageProvider: startup.pitchDeckStorageProvider,
    storageKey: startup.pitchDeckStorageKey,
    cloudinaryPublicId: startup.pitchDeckCloudinaryPublicId,
    legacyCloudinaryResourceType: 'raw',
  });

  // Clean up uploaded documents
  await Promise.all(
    startup.documents.map((document) =>
      deleteStoredAsset({
        storageProvider: document.storageProvider,
        storageKey: document.storageKey,
        cloudinaryPublicId: document.cloudinaryPublicId,
        legacyCloudinaryResourceType: document.fileType === 'pdf' ? 'raw' : 'image',
      }),
    ),
  );

  const startupName = startup.name;
  const founderIds = startup.founderIds.map((id) => String(id));
  const wasLaunched =
    startup.launchedToInvestors || startup.launchedToMentors || startup.launchedToRecruiters;

  // Soft delete — keeps historical records intact and matches founder-side deletion.
  startup.isActive = false;
  await startup.save();
  await deleteRequestsLinkedToStartup(startupId);

  await AdminAuditLog.create({
    adminId: new Types.ObjectId(adminId),
    action: 'STARTUP_DELETED',
    targetId: startup._id,
    targetModel: 'Startup',
    metadata: {
      name: startupName,
      founderIds,
      wasLaunched,
    },
  });

  return { deleted: true as const };
};

export const promoteToCoFounder = async (startupId: string, userId: string, memberId: string) => {
  const startup = await getStartupForFounder(startupId, userId);
  prepareStartupForEditableMutation(startup);

  const isTeamMember = startup.teamMemberIds.some((id) => String(id) === memberId);
  if (!isTeamMember) {
    throw new ApiError(400, 'NOT_A_TEAM_MEMBER', 'User is not a team member of this startup.');
  }

  const alreadyFounder = startup.founderIds.some((id) => String(id) === memberId);
  if (alreadyFounder) {
    throw new ApiError(400, 'ALREADY_FOUNDER', 'User is already a founder.');
  }

  startup.founderIds.push(new Types.ObjectId(memberId));
  startup.teamMemberIds = startup.teamMemberIds.filter((id) => String(id) !== memberId);
  await startup.save();

  return serializeStartup(startup);
};

export const demoteFromCoFounder = async (startupId: string, userId: string, memberId: string) => {
  const startup = await getStartupForFounder(startupId, userId);
  prepareStartupForEditableMutation(startup);

  if (String(memberId) === String(userId)) {
    throw new ApiError(400, 'CANNOT_DEMOTE_SELF', 'You cannot demote yourself from founder.');
  }

  const isFounder = startup.founderIds.some((id) => String(id) === memberId);
  if (!isFounder) {
    throw new ApiError(400, 'NOT_A_FOUNDER', 'User is not a founder of this startup.');
  }

  startup.founderIds = startup.founderIds.filter((id) => String(id) !== memberId);
  startup.teamMemberIds.push(new Types.ObjectId(memberId));
  await startup.save();

  return serializeStartup(startup);
};

export const listStartupsForAdmin = async (status?: 'draft' | 'review_requested' | 'changes_requested' | 'approved') => {
  const query = status ? { isActive: true, reviewStatus: status } : { isActive: true };

  const startups = await Startup.find(query)
    .sort({ reviewRequestedAt: -1, updatedAt: -1, createdAt: -1 })
    .lean<Array<{
      _id: Types.ObjectId;
      founderIds: Types.ObjectId[];
      projectId?: Types.ObjectId;
      name: string;
      tagline: string;
      category: string;
      stage: string;
      fundingNeeded?: number;
      activeProducts: number;
      teamSize: number;
      launchedToInvestors: boolean;
      launchedToMentors: boolean;
      launchedAt?: Date;
      reviewStatus: 'draft' | 'review_requested' | 'changes_requested' | 'approved';
      reviewRequestedAt?: Date;
      adminReviewedAt?: Date;
      adminReviewedBy?: Types.ObjectId | null;
      adminNotes?: string;
      adminEditUnlockActive: boolean;
      adminEditUnlockApprovedAt?: Date;
      adminEditUnlockApprovedBy?: Types.ObjectId | null;
      adminEditUnlockReason?: string;
      createdAt: Date;
      updatedAt: Date;
      pitchDeckUrl?: string;
      pitchDeckName?: string;
      pitchDeckStorageProvider?: 'cloudinary' | 's3';
      pitchDeckStorageKey?: string;
      registrationProfile: {
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
      initializationProfile: {
        vision: string;
        mission: string;
        foundingStory: string;
        teamComposition: string;
        productStage: string;
        productOverview: string;
        customerProfile: string;
        marketOpportunity: string;
        businessModel: string;
        pricingStrategy: string;
        competitiveLandscape: string;
        defensibleMoat: string;
        currentTraction: string;
        upcomingMilestones: string;
        fundingAsk: string;
        legalEntityType: string;
        risksAndMitigation: string;
      };
      documents: Array<{
        _id: Types.ObjectId;
        category: StartupDocumentCategory;
        fileUrl: string;
        fileType: 'pdf' | 'image';
        fileName: string;
        fileSizeBytes: number;
        uploadedAt: Date;
        note?: string;
      }>;
      traction: {
        patentFiled: boolean;
        mvpBuilt: boolean;
        revenueGenerating: boolean;
        usersCount?: number;
      };
    }>>();

  const founderIds = [
    ...new Set(
      startups.flatMap((startup) =>
        (Array.isArray(startup.founderIds) ? startup.founderIds : []).map(String),
      ),
    ),
  ];
  const founders =
    founderIds.length > 0
      ? await User.find({ _id: { $in: founderIds } })
          .select('_id displayName avatar innovationScore domain')
          .lean<Array<{
            _id: Types.ObjectId;
            displayName: string;
            avatar?: string;
            innovationScore: number;
            domain?: string;
          }>>()
      : [];

  const founderMap = new Map(founders.map((founder) => [String(founder._id), founder]));
  const workspaceIds = [
    ...new Set(startups.map((startup) => startup.projectId).filter(Boolean).map(String)),
  ];
  const linkedWorkspaces =
    workspaceIds.length > 0
      ? await Workspace.find({ _id: { $in: workspaceIds }, isActive: true })
          .select('_id title category')
          .lean<Array<{ _id: Types.ObjectId; title: string; category: string }>>()
      : [];
  const workspaceMap = new Map(
    linkedWorkspaces.map((workspace) => [String(workspace._id), workspace]),
  );

  const adminStartupRows = await Promise.all(startups.map(async (startup) => {
    const founderIds = Array.isArray(startup.founderIds) ? startup.founderIds : [];
    const documents = Array.isArray(startup.documents) ? startup.documents : [];
    const linkedWorkspace = startup.projectId
      ? workspaceMap.get(String(startup.projectId))
      : undefined;
    const baseReadiness = buildStartupReadiness(startup);
    const readiness =
      startup.projectId && !linkedWorkspace
        ? {
            ...baseReadiness,
            isReviewReady: false,
            missingItems: [
              ...baseReadiness.missingItems.filter((item) => item !== 'linked workspace'),
              'active workspace link',
            ],
          }
        : baseReadiness;
    const pitchDeckUrl = await getSignedStartupPitchDeckUrl(startup);

    return {
      _id: String(startup._id),
      ...(startup.projectId ? { projectId: String(startup.projectId) } : {}),
      ...(linkedWorkspace
        ? {
            workspace: {
              _id: String(linkedWorkspace._id),
              title: linkedWorkspace.title,
              category: linkedWorkspace.category,
            },
          }
        : {}),
      name: startup.name,
      tagline: startup.tagline,
      category: startup.category,
      stage: startup.stage,
      fundingNeeded: startup.fundingNeeded,
      activeProducts: startup.activeProducts,
      teamSize: startup.teamSize,
      launchedToInvestors: startup.launchedToInvestors,
      launchedToMentors: startup.launchedToMentors,
      ...(toIsoString(startup.launchedAt) ? { launchedAt: toIsoString(startup.launchedAt) } : {}),
      reviewStatus: startup.reviewStatus,
      ...(toIsoString(startup.reviewRequestedAt)
        ? { reviewRequestedAt: toIsoString(startup.reviewRequestedAt) }
        : {}),
      ...(toIsoString(startup.adminReviewedAt)
        ? { adminReviewedAt: toIsoString(startup.adminReviewedAt) }
        : {}),
      ...(startup.adminReviewedBy ? { adminReviewedBy: String(startup.adminReviewedBy) } : {}),
      ...(startup.adminNotes ? { adminNotes: startup.adminNotes } : {}),
      editAccess: {
        ...buildStartupEditAccess(startup),
        ...(toIsoString(startup.adminEditUnlockApprovedAt)
          ? { unlockedAt: toIsoString(startup.adminEditUnlockApprovedAt) }
          : {}),
        ...(startup.adminEditUnlockApprovedBy
          ? { unlockedBy: String(startup.adminEditUnlockApprovedBy) }
          : {}),
      },
      ...(pitchDeckUrl ? { pitchDeckUrl } : {}),
      ...(startup.pitchDeckName ? { pitchDeckName: startup.pitchDeckName } : {}),
      traction: startup.traction,
      registrationProfile: startup.registrationProfile,
      initializationProfile: startup.initializationProfile,
      readiness,
      documents: documents.map((document) => ({
        _id: String(document._id),
        category: document.category,
        fileUrl: document.fileUrl,
        fileType: document.fileType,
        fileName: document.fileName,
        fileSizeBytes: document.fileSizeBytes,
        uploadedAt: toIsoString(document.uploadedAt) ?? new Date(0).toISOString(),
        ...(document.note ? { note: document.note } : {}),
      })),
      founders: founderIds
        .map((founderId) => founderMap.get(String(founderId)))
        .filter((founder): founder is NonNullable<typeof founder> => Boolean(founder))
        .map((founder) => ({
          _id: String(founder._id),
          displayName: founder.displayName,
          ...(founder.avatar ? { avatar: founder.avatar } : {}),
          innovationScore: founder.innovationScore ?? 0,
          ...(founder.domain ? { domain: founder.domain } : {}),
        })),
      createdAt: toIsoString(startup.createdAt) ?? new Date(0).toISOString(),
      updatedAt: toIsoString(startup.updatedAt) ?? new Date(0).toISOString(),
    };
  }));

  return adminStartupRows;
};

const notifyFoundersAboutStartupChangeRequest = async (params: {
  adminId: string;
  startup: InstanceType<typeof Startup>;
  adminNotes: string;
}) => {
  const { adminId, startup, adminNotes } = params;
  const founderIds = (startup.founderIds ?? [])
    .map((founderId) => String(founderId))
    .filter((founderId) => Types.ObjectId.isValid(founderId));

  if (founderIds.length === 0) {
    return;
  }

  const admin = await User.findById(adminId).select('displayName email').lean();
  const adminName = admin?.displayName?.trim() || admin?.email || 'ProMove admin';
  const startupName = startup.name?.trim() || 'your startup';
  const startupId = String(startup._id);
  const detailLink = `/startup-launch/${startupId}/overview`;
  const message = [
    `Edit request for ${startupName}`,
    '',
    `${adminName} requested changes before launch approval.`,
    '',
    `Admin note: ${adminNotes}`,
    '',
    `Open details: ${detailLink}`,
  ].join('\n');
  const notificationBody = truncateNotificationBody(`Admin note: ${adminNotes}`);

  await Promise.all(
    founderIds.map(async (founderId) => {
      const directMessage = await DirectMessage.create({
        senderId: new Types.ObjectId(adminId),
        recipientId: new Types.ObjectId(founderId),
        message,
        messageType: 'text',
        queryType: 'general',
      });
      const serializedMessage = await serializeDirectMessage(directMessage.toObject());
      io.of('/dm').to(`user:${founderId}`).emit('dm:message', serializedMessage);

      await NotificationService.create({
        userId: founderId,
        type: 'startup_launch',
        title: 'Startup edit request',
        body: notificationBody,
        link: detailLink,
        metadata: {
          startupId,
          startupName,
          reviewStatus: 'changes_requested',
          adminId,
          adminName,
          adminNotes,
          deepLink: detailLink,
        },
      });
    }),
  );
};

export const reviewStartupSubmission = async (
  adminId: string,
  startupId: string,
  payload: z.infer<typeof reviewStartupSubmissionSchema>,
) => {
  const startup = await Startup.findById(startupId);

  if (!startup || !startup.isActive) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  if (payload.decision === 'approved') {
    if (startup.reviewStatus !== 'review_requested') {
      throw new ApiError(
        409,
        'STARTUP_NOT_SUBMITTED_FOR_REVIEW',
        'The founder must submit the latest startup updates before verification.',
      );
    }

    await assertStartupVerificationReady(startup.toObject());
  }

  startup.reviewStatus = payload.decision;
  startup.adminReviewedAt = new Date();
  startup.adminReviewedBy = new Types.ObjectId(adminId);
  startup.adminNotes = payload.adminNotes?.trim() || undefined;
  clearAdminEditUnlock(startup);

  if (payload.decision === 'approved') {
    startup.reviewRequestedAt = startup.reviewRequestedAt ?? new Date();
  }

  await startup.save();
  await AdminAuditLog.create({
    adminId: new Types.ObjectId(adminId),
    action: payload.decision === 'approved' ? 'STARTUP_APPROVED' : 'STARTUP_CHANGES_REQUESTED',
    targetId: startup._id,
    targetModel: 'Startup',
    metadata: {
      reviewStatus: startup.reviewStatus,
      ...(startup.adminNotes ? { adminNotes: startup.adminNotes } : {}),
    },
  });
  await recordStartupLifecycleEvent({
    startupId: startup._id,
    workspaceId: startup.projectId,
    actorId: adminId,
    source: 'admin',
    type: payload.decision === 'approved' ? 'STARTUP_APPROVED' : 'STARTUP_CHANGES_REQUESTED',
    title: payload.decision === 'approved' ? 'Startup approved' : 'Startup changes requested',
    description:
      payload.decision === 'approved'
        ? 'Admin approved the startup for launch.'
        : 'Admin requested changes before launch.',
    status: startup.reviewStatus,
    metadata: {
      ...(startup.adminNotes ? { adminNotes: startup.adminNotes } : {}),
    },
  });

  if (payload.decision === 'changes_requested' && startup.adminNotes) {
    await notifyFoundersAboutStartupChangeRequest({
      adminId,
      startup,
      adminNotes: startup.adminNotes,
    });
  }

  return serializeStartup(startup);
};

export const approveStartupEditUnlock = async (
  adminId: string,
  startupId: string,
  options?: { reason?: string; sourceTicketId?: string },
) => {
  const startup = await Startup.findById(startupId);

  if (!startup || !startup.isActive) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  const currentEditAccess = buildStartupEditAccess(startup.toObject());
  if (!currentEditAccess.isLocked && !startup.adminEditUnlockActive) {
    throw new ApiError(409, 'STARTUP_ALREADY_EDITABLE', 'Startup profile is already editable.');
  }

  startup.adminEditUnlockActive = true;
  startup.adminEditUnlockApprovedAt = new Date();
  startup.adminEditUnlockApprovedBy = new Types.ObjectId(adminId);
  startup.adminEditUnlockReason = options?.reason?.trim() || undefined;
  await startup.save();

  await AdminAuditLog.create({
    adminId: new Types.ObjectId(adminId),
    action: 'STARTUP_EDIT_UNLOCKED',
    targetId: startup._id,
    targetModel: 'Startup',
    metadata: {
      reviewStatus: startup.reviewStatus,
      ...(startup.adminEditUnlockReason ? { unlockReason: startup.adminEditUnlockReason } : {}),
      ...(options?.sourceTicketId ? { sourceTicketId: options.sourceTicketId } : {}),
    },
  });

  return serializeStartup(startup);
};
