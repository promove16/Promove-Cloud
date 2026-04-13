import { Types } from 'mongoose';
import { z } from 'zod';
import { notificationQueue } from '../../config/bullmq';
import { applyScoreAsync } from '../../services/scoreEngine';
import { deleteStoredAsset, uploadFile } from '../../services/fileStorageService';
import { User } from '../user/user.model';
import { Startup } from './startup.model';
import { ApiError } from '../../utils/ApiError';
import { PlacementRecord } from '../college/placementRecord.model';
import { UserRole } from '../../types/roles.types';
import { normalizeInnovationScore } from '../innovationScore/score.utils';
import { Workspace } from '../workspace/workspace.model';
import { AdminAuditLog } from '../admin/adminAuditLog.model';
import type { StartupDocumentCategory, StartupEditAccess, StartupReadiness } from './startup.types';

const pdfFileNamePattern = /\.pdf$/i;

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

export const startupSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().trim().min(0).max(120).default(''),
  tagline: z.string().trim().min(0).max(200).default(''),
  category: z.string().trim().min(0).max(100).default(''),
  stage: z.enum(['Pre-Idea', 'Ideation', 'MVP', 'Pre-Launch', 'Launched']).default('Pre-Idea'),
  phase: z.enum(['creation', 'building', 'launched']).default('creation'),
  fundingNeeded: z.number().optional(),
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
});

export const launchSchema = z.object({
  launchTo: z.enum(['investors', 'mentors', 'both', 'recruiters']),
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
  const isLocked =
    (reviewStatus === 'review_requested' || reviewStatus === 'approved') && !unlockedByAdmin;

  let reason = 'Startup profile can be edited.';
  if (unlockedByAdmin && (reviewStatus === 'review_requested' || reviewStatus === 'approved')) {
    reason = 'Admin approved a temporary edit unlock. Save your changes and submit again for review.';
  } else if (reviewStatus === 'review_requested') {
    reason = 'Startup profile is locked while admin review is pending.';
  } else if (reviewStatus === 'approved') {
    reason = 'Startup profile is locked after approval. Raise a Smart Help request if you need updates.';
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

  if (
    startup.adminEditUnlockActive &&
    (startup.reviewStatus === 'review_requested' || startup.reviewStatus === 'approved')
  ) {
    startup.reviewStatus = 'draft';
    clearReviewMetadata(startup);
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

const buildStartupInput = (source: Partial<Record<string, any>>): StartupSchemaInput => {
  const businessProfileSource = source.businessProfile ?? {};
  const registrationProfileSource = source.registrationProfile ?? {};
  const tractionSource = source.traction ?? {};

  const businessProfile: StartupBusinessProfileInput = {
    ...DEFAULT_BUSINESS_PROFILE,
    ...businessProfileSource,
  };

  const registrationProfile: StartupRegistrationProfileInput = {
    ...DEFAULT_REGISTRATION_PROFILE,
    ...registrationProfileSource,
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
  };
};

const normalizeStartupPayload = (payload: StartupSchemaInput) => {
  const normalizedPayload = startupSchema.parse(payload);
  const registrationProfile = normalizeRegistrationProfile(
    normalizedPayload.registrationProfile ?? DEFAULT_REGISTRATION_PROFILE,
  );
  const businessProfile = normalizedPayload.businessProfile ?? DEFAULT_BUSINESS_PROFILE;

  return {
    ...normalizedPayload,
    name: normalizedPayload.name.trim(),
    tagline: normalizedPayload.tagline.trim(),
    category: normalizedPayload.category.trim(),
    businessProfile: {
      problemStatement: businessProfile.problemStatement.trim(),
      solutionSummary: businessProfile.solutionSummary.trim(),
      targetCustomers: businessProfile.targetCustomers.trim(),
      marketAnalysis: businessProfile.marketAnalysis.trim(),
      revenueModel: businessProfile.revenueModel.trim(),
      goToMarketPlan: businessProfile.goToMarketPlan.trim(),
    },
    registrationProfile,
    traction: normalizedPayload.traction,
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

const buildAccessibleStartupQuery = (userId: string, workspaceIds: Types.ObjectId[]) => ({
  isActive: true,
  $or: [
    { founderIds: userId },
    { teamMemberIds: userId },
    ...(workspaceIds.length > 0 ? [{ projectId: { $in: workspaceIds } }] : []),
  ],
});

const getRequiredStartupDocumentCategories = (startup: {
  registrationProfile?: {
    developmentStage?: string;
  };
}): StartupDocumentCategory[] => {
  return startup.registrationProfile?.developmentStage === 'idea'
    ? ['design_plan_sketch']
    : ['technical_documentation'];
};

const toIsoString = (value: unknown) => {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();

  const normalized = new Date(String(value));
  return Number.isNaN(normalized.getTime()) ? undefined : normalized.toISOString();
};

const buildStartupReadiness = (startup: {
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
}): StartupReadiness => {
  const missingItems: string[] = [];
  const founderIds = Array.isArray(startup.founderIds) ? startup.founderIds : [];
  const documents = startup.documents ?? [];
  const uploadedDocumentCategories = Array.from(
    new Set(
      documents
        .map((document) => document.category)
        .filter((category): category is StartupDocumentCategory => Boolean(category)),
    ),
  );
  const uploadedCategorySet = new Set(uploadedDocumentCategories);
  const requiredDocumentCategories = getRequiredStartupDocumentCategories(startup);

  const addMissing = (condition: boolean, label: string) => {
    if (condition) missingItems.push(label);
  };

  addMissing(!startup.name?.trim(), 'startup name');
  addMissing(!startup.tagline?.trim(), 'startup tagline');
  addMissing(!startup.category?.trim(), 'startup category');
  addMissing(founderIds.length === 0, 'at least one founder');
  addMissing((startup.registrationProfile?.problemStatement?.trim().length ?? 0) < 40, 'IPR problem statement');
  addMissing(
    (startup.registrationProfile?.solutionDifferentiation?.trim().length ?? 0) < 40,
    'solution differentiation',
  );
  addMissing((startup.registrationProfile?.coreInnovation?.trim().length ?? 0) < 30, 'core innovation');
  addMissing((startup.registrationProfile?.priorArtStatus?.trim().length ?? 0) < 20, 'prior art status');
  addMissing((startup.registrationProfile?.workingMechanism?.trim().length ?? 0) < 40, 'working mechanism');
  addMissing((startup.registrationProfile?.keyComponents?.trim().length ?? 0) < 20, 'key components');
  addMissing(!startup.registrationProfile?.developmentStage?.trim(), 'innovation stage');
  addMissing((startup.registrationProfile?.documentationReadiness?.trim().length ?? 0) < 10, 'documentation readiness');
  addMissing(!startup.registrationProfile?.inventorOwnership?.trim(), 'inventor ownership');
  addMissing((startup.registrationProfile?.developmentContext?.trim().length ?? 0) < 20, 'development context');
  addMissing((startup.registrationProfile?.targetMarkets?.trim().length ?? 0) < 20, 'target markets');
  addMissing(!startup.registrationProfile?.commercializationStrategy?.trim(), 'commercialization strategy');
  addMissing((startup.registrationProfile?.publicDisclosureStatus?.trim().length ?? 0) < 10, 'public disclosure status');
  addMissing((startup.registrationProfile?.legalAgreements?.trim().length ?? 0) < 10, 'legal agreements');
  addMissing(!startup.registrationProfile?.ipProtectionType?.trim(), 'IP protection type');
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

const formatReadinessErrorMessage = (readiness: StartupReadiness) => {
  if (readiness.missingItems.length === 0) return 'Startup profile is incomplete for review.';
  const topItems = readiness.missingItems.slice(0, 5).join(', ');
  return readiness.missingItems.length > 5
    ? `Startup profile is incomplete for review. Complete: ${topItems}, and ${readiness.missingItems.length - 5} more.`
    : `Startup profile is incomplete for review. Complete: ${topItems}.`;
};

const completionScore = (checks: boolean[], maxScore: number) => {
  if (checks.length === 0) {
    return 0;
  }

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * maxScore);
};

const calculateStartupInnovationScore = (startup: Record<string, any>) => {
  const readiness = buildStartupReadiness(startup as never);
  const businessProfile = startup.businessProfile ?? {};
  const registrationProfile = startup.registrationProfile ?? {};
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
      Boolean(registrationProfile.problemStatement?.trim()),
      Boolean(registrationProfile.solutionDifferentiation?.trim()),
      Boolean(registrationProfile.coreInnovation?.trim()),
      Boolean(registrationProfile.priorArtStatus?.trim()),
      Boolean(registrationProfile.workingMechanism?.trim()),
      Boolean(registrationProfile.keyComponents?.trim()),
      Boolean(registrationProfile.developmentStage?.trim()),
      Boolean(registrationProfile.documentationReadiness?.trim()),
      Boolean(registrationProfile.developmentContext?.trim()),
      Boolean(registrationProfile.targetMarkets?.trim()),
      Boolean(registrationProfile.publicDisclosureStatus?.trim()),
      Boolean(registrationProfile.legalAgreements?.trim()),
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

  return normalizeInnovationScore(
    businessScore + registrationScore + documentationScore + tractionScore + teamScore,
  );
};

const sanitizeStartupForClient = (startup: Record<string, any>) => {
  const editAccess = buildStartupEditAccess(startup);

  return {
    ...startup,
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
  };
};

const serializeStartup = (startup: { toObject?: () => Record<string, any> } | Record<string, any>) => {
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

  return serializeStartup(startup);
};

export const getMyStartups = async (userId: string) => {
  const workspaceIds = await getAccessibleWorkspaceIds(userId);
  const startups = await Startup.find(buildAccessibleStartupQuery(userId, workspaceIds))
    .sort({ updatedAt: -1 })
    .lean();
  return startups.map((startup) => serializeStartup(startup));
};

export const getStartupById = async (startupId: string, userId: string) => {
  const workspaceIds = await getAccessibleWorkspaceIds(userId);
  const startup = await Startup.findOne({
    _id: startupId,
    ...buildAccessibleStartupQuery(userId, workspaceIds),
  }).lean();
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
  prepareStartupForEditableMutation(startup);
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
  return serializeStartup(startup);
};

export const requestStartupReview = async (startupId: string, userId: string) => {
  const startup = await getStartupForFounder(startupId, userId);
  const readiness = buildStartupReadiness(startup.toObject());

  if (!readiness.isReviewReady) {
    throw new ApiError(400, 'STARTUP_INCOMPLETE', formatReadinessErrorMessage(readiness));
  }

  if (startup.reviewStatus === 'approved') {
    throw new ApiError(409, 'STARTUP_ALREADY_APPROVED', 'Startup has already been approved.');
  }

  if (startup.reviewStatus === 'review_requested') {
    throw new ApiError(409, 'STARTUP_ALREADY_UNDER_REVIEW', 'Startup review is already pending.');
  }

  startup.reviewStatus = 'review_requested';
  startup.reviewRequestedAt = new Date();
  startup.adminReviewedAt = undefined;
  startup.adminReviewedBy = null;
  startup.adminNotes = undefined;
  clearAdminEditUnlock(startup);
  await startup.save();

  return serializeStartup(startup);
};

export const launchStartup = async (
  startupId: string,
  userId: string,
  payload: z.infer<typeof launchSchema>,
) => {
  const startup = await getStartupForFounder(startupId, userId);
  const readiness = buildStartupReadiness(startup.toObject());

  if (!readiness.isReviewReady) {
    throw new ApiError(400, 'STARTUP_INCOMPLETE', formatReadinessErrorMessage(readiness));
  }

  if (startup.reviewStatus !== 'approved') {
    throw new ApiError(
      403,
      'STARTUP_REVIEW_REQUIRED',
      'Startup must be approved by admin before it can be launched to the marketplace.',
    );
  }

  const score = calculateStartupInnovationScore(startup.toObject());

startup.launchedToInvestors = startup.launchedToInvestors || payload.launchTo === 'investors' || payload.launchTo === 'both';
  startup.launchedToMentors = startup.launchedToMentors || payload.launchTo === 'mentors' || payload.launchTo === 'both';
  startup.launchedToRecruiters = startup.launchedToRecruiters || payload.launchTo === 'recruiters';
  startup.launchedAt = new Date();
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

  return serializeStartup(startup);
};

export const uploadPitchDeck = async (startupId: string, userId: string, file: Express.Multer.File) => {
  if (file.mimetype !== 'application/pdf' && !pdfFileNamePattern.test(file.originalname)) {
    throw new ApiError(400, 'INVALID_FILE_TYPE', 'Only PDF files are allowed');
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
    contentType: file.mimetype || 'application/pdf',
  });

  startup.pitchDeckUrl = uploaded.url;
  startup.pitchDeckName = file.originalname;
  startup.pitchDeckStorageProvider = uploaded.provider;
  startup.pitchDeckStorageKey = uploaded.key;
  startup.pitchDeckCloudinaryPublicId = undefined;

  await startup.save();
return serializeStartup(startup);
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
  return serializeStartup(startup);
};

export const deleteStartupDocument = async (startupId: string, userId: string, documentId: string) => {
  const startup = await getStartupForFounder(startupId, userId);
  prepareStartupForEditableMutation(startup);
  assertLaunchFormEditable(startup.toObject());
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
  return serializeStartup(startup);
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

  return startups.map((startup) => {
    const founderIds = Array.isArray(startup.founderIds) ? startup.founderIds : [];
    const documents = Array.isArray(startup.documents) ? startup.documents : [];
    const readiness = buildStartupReadiness(startup);

    return {
      _id: String(startup._id),
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
      ...(startup.pitchDeckUrl ? { pitchDeckUrl: startup.pitchDeckUrl } : {}),
      ...(startup.pitchDeckName ? { pitchDeckName: startup.pitchDeckName } : {}),
      traction: startup.traction,
      registrationProfile: startup.registrationProfile,
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
  });
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
    const readiness = buildStartupReadiness(startup.toObject());
    if (!readiness.isReviewReady) {
      throw new ApiError(400, 'STARTUP_INCOMPLETE', formatReadinessErrorMessage(readiness));
    }
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
