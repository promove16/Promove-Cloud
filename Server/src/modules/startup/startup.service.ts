import { Types } from 'mongoose';
import { z } from 'zod';
import { notificationQueue } from '../../config/bullmq';
import { deleteFromCloudinary, uploadToCloudinary } from '../../services/cloudinaryService';
import { applyScoreAsync } from '../../services/scoreEngine';
import { User } from '../user/user.model';
import { Startup } from './startup.model';
import { ApiError } from '../../utils/ApiError';
import { PlacementRecord } from '../college/placementRecord.model';
import { UserRole } from '../../types/roles.types';
import { normalizeInnovationScore } from '../innovationScore/score.utils';
import type { StartupDocumentCategory, StartupReadiness } from './startup.types';

const pdfFileNamePattern = /\.pdf$/i;
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const tanPattern = /^[A-Z]{4}[0-9]{5}[A-Z]$/;
const gstinPattern = /^[0-9A-Z]{15}$/;
const pincodePattern = /^[1-9][0-9]{5}$/;

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
  legalStructure: 'private_limited',
  registrationStage: 'idea',
  proposedEntityName: '',
  registeredEntityName: '',
  businessObjective: '',
  incorporationDate: '',
  incorporationState: '',
  registeredOfficeAddress: '',
  registeredOfficeCity: '',
  registeredOfficeState: '',
  registeredOfficePincode: '',
  cinOrLlpin: '',
  companyPan: '',
  tanNumber: '',
  gstin: '',
  startupIndiaStatus: 'not_started',
  startupIndiaRecognitionNumber: '',
  bankAccountOpened: false,
  bankName: '',
  dscReady: false,
  founderAgreementSigned: false,
  ndaReady: false,
  employmentContractsReady: false,
  operationalLicenses: '',
  trademarkStatus: 'not_started',
  patentStatus: 'not_started',
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
    legalStructure: z.enum(['private_limited', 'llp', 'partnership', 'opc']).default('private_limited'),
    registrationStage: z
      .enum(['idea', 'name_reserved', 'incorporation_in_progress', 'incorporated', 'startup_india_recognized'])
      .default('idea'),
    proposedEntityName: buildTextField(160),
    registeredEntityName: buildTextField(160),
    businessObjective: buildTextField(500),
    incorporationDate: buildTextField(40),
    incorporationState: buildTextField(120),
    registeredOfficeAddress: buildTextField(500),
    registeredOfficeCity: buildTextField(120),
    registeredOfficeState: buildTextField(120),
    registeredOfficePincode: buildTextField(6),
    cinOrLlpin: buildTextField(50),
    companyPan: buildTextField(20),
    tanNumber: buildTextField(20),
    gstin: buildTextField(20),
    startupIndiaStatus: z.enum(['not_started', 'applied', 'recognized']).default('not_started'),
    startupIndiaRecognitionNumber: buildTextField(80),
    bankAccountOpened: z.boolean().default(false),
    bankName: buildTextField(120),
    dscReady: z.boolean().default(false),
    founderAgreementSigned: z.boolean().default(false),
    ndaReady: z.boolean().default(false),
    employmentContractsReady: z.boolean().default(false),
    operationalLicenses: buildTextField(500),
    trademarkStatus: z.enum(['not_started', 'applied', 'registered']).default('not_started'),
    patentStatus: z.enum(['not_started', 'drafting', 'filed', 'granted']).default('not_started'),
  })
  .superRefine((value, ctx) => {
    const companyPan = value.companyPan.trim().toUpperCase();
    if (companyPan && !panPattern.test(companyPan)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['companyPan'], message: 'Company PAN must use the standard PAN format.' });
    }

    const tanNumber = value.tanNumber.trim().toUpperCase();
    if (tanNumber && !tanPattern.test(tanNumber)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tanNumber'], message: 'TAN must use the standard TAN format.' });
    }

    const gstin = value.gstin.trim().toUpperCase();
    if (gstin && !gstinPattern.test(gstin)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['gstin'], message: 'GSTIN must be 15 alphanumeric characters.' });
    }

    const pincode = value.registeredOfficePincode.trim();
    if (pincode && !pincodePattern.test(pincode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['registeredOfficePincode'],
        message: 'Registered office pincode must be a valid 6 digit Indian pincode.',
      });
    }
  })
  .default(DEFAULT_REGISTRATION_PROFILE);

export const startupSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().trim().min(0).max(120).default(''),
  tagline: z.string().trim().min(0).max(200).default(''),
  category: z.string().trim().min(0).max(100).default(''),
  stage: z.enum(['Pre-Idea', 'Ideation', 'MVP', 'Pre-Launch', 'Launched']).default('Pre-Idea'),
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

const clearReviewMetadata = (startup: InstanceType<typeof Startup>) => {
  startup.reviewRequestedAt = undefined;
  startup.adminReviewedAt = undefined;
  startup.adminReviewedBy = null;
  startup.adminNotes = undefined;
};

const normalizeOptionalText = (value?: string) => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const toInputDateString = (value?: Date | string | null) => {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
};

const normalizeDate = (value?: string | Date | null) => {
  const normalized = typeof value === 'string' ? value.trim() : toInputDateString(value).trim();
  if (!normalized) return undefined;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const normalizeRegistrationProfile = (
  registrationProfile: StartupRegistrationProfileInput,
) => {
  const profile = startupRegistrationProfileSchema.parse(registrationProfile ?? DEFAULT_REGISTRATION_PROFILE);

  return {
    legalStructure: profile.legalStructure,
    registrationStage: profile.registrationStage,
    proposedEntityName: profile.proposedEntityName.trim(),
    registeredEntityName: normalizeOptionalText(profile.registeredEntityName),
    businessObjective: profile.businessObjective.trim(),
    incorporationDate: normalizeDate(profile.incorporationDate),
    incorporationState: profile.incorporationState.trim(),
    registeredOfficeAddress: profile.registeredOfficeAddress.trim(),
    registeredOfficeCity: profile.registeredOfficeCity.trim(),
    registeredOfficeState: profile.registeredOfficeState.trim(),
    registeredOfficePincode: profile.registeredOfficePincode.trim(),
    cinOrLlpin: normalizeOptionalText(profile.cinOrLlpin)?.toUpperCase(),
    companyPan: normalizeOptionalText(profile.companyPan)?.toUpperCase(),
    tanNumber: normalizeOptionalText(profile.tanNumber)?.toUpperCase(),
    gstin: normalizeOptionalText(profile.gstin)?.toUpperCase(),
    startupIndiaStatus: profile.startupIndiaStatus,
    startupIndiaRecognitionNumber: normalizeOptionalText(profile.startupIndiaRecognitionNumber),
    bankAccountOpened: profile.bankAccountOpened,
    bankName: profile.bankAccountOpened ? normalizeOptionalText(profile.bankName) : undefined,
    dscReady: profile.dscReady,
    founderAgreementSigned: profile.founderAgreementSigned,
    ndaReady: profile.ndaReady,
    employmentContractsReady: profile.employmentContractsReady,
    operationalLicenses: profile.operationalLicenses.trim(),
    trademarkStatus: profile.trademarkStatus,
    patentStatus: profile.patentStatus,
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
    proposedEntityName: registrationProfileSource.proposedEntityName ?? DEFAULT_REGISTRATION_PROFILE.proposedEntityName,
    registeredEntityName: registrationProfileSource.registeredEntityName ?? DEFAULT_REGISTRATION_PROFILE.registeredEntityName,
    businessObjective: registrationProfileSource.businessObjective ?? DEFAULT_REGISTRATION_PROFILE.businessObjective,
    incorporationDate: toInputDateString(registrationProfileSource.incorporationDate),
    incorporationState: registrationProfileSource.incorporationState ?? DEFAULT_REGISTRATION_PROFILE.incorporationState,
    registeredOfficeAddress:
      registrationProfileSource.registeredOfficeAddress ?? DEFAULT_REGISTRATION_PROFILE.registeredOfficeAddress,
    registeredOfficeCity: registrationProfileSource.registeredOfficeCity ?? DEFAULT_REGISTRATION_PROFILE.registeredOfficeCity,
    registeredOfficeState:
      registrationProfileSource.registeredOfficeState ?? DEFAULT_REGISTRATION_PROFILE.registeredOfficeState,
    registeredOfficePincode:
      registrationProfileSource.registeredOfficePincode ?? DEFAULT_REGISTRATION_PROFILE.registeredOfficePincode,
    cinOrLlpin: registrationProfileSource.cinOrLlpin ?? DEFAULT_REGISTRATION_PROFILE.cinOrLlpin,
    companyPan: registrationProfileSource.companyPan ?? DEFAULT_REGISTRATION_PROFILE.companyPan,
    tanNumber: registrationProfileSource.tanNumber ?? DEFAULT_REGISTRATION_PROFILE.tanNumber,
    gstin: registrationProfileSource.gstin ?? DEFAULT_REGISTRATION_PROFILE.gstin,
    startupIndiaRecognitionNumber:
      registrationProfileSource.startupIndiaRecognitionNumber ??
      DEFAULT_REGISTRATION_PROFILE.startupIndiaRecognitionNumber,
    bankName: registrationProfileSource.bankName ?? DEFAULT_REGISTRATION_PROFILE.bankName,
    operationalLicenses:
      registrationProfileSource.operationalLicenses ?? DEFAULT_REGISTRATION_PROFILE.operationalLicenses,
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
  const patentFiledByRegistration =
    registrationProfile.patentStatus === 'filed' || registrationProfile.patentStatus === 'granted';

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
    traction: {
      ...normalizedPayload.traction,
      patentFiled: normalizedPayload.traction.patentFiled || patentFiledByRegistration,
    },
  };
};

const isIncorporatedStage = (registrationStage?: string) =>
  registrationStage === 'incorporated' || registrationStage === 'startup_india_recognized';

const getRequiredStartupDocumentCategories = (startup: {
  registrationProfile?: {
    legalStructure?: string;
    registrationStage?: string;
    startupIndiaStatus?: string;
    trademarkStatus?: string;
    patentStatus?: string;
  };
}): StartupDocumentCategory[] => {
  const categories = new Set<StartupDocumentCategory>(['founder_agreement']);
  const registrationProfile = startup.registrationProfile;

  if (isIncorporatedStage(registrationProfile?.registrationStage)) {
    categories.add('business_plan');
    categories.add('incorporation_certificate');
    categories.add('registered_office_proof');
    categories.add('office_noc_or_utility_bill');
    categories.add('company_pan');

    if (registrationProfile?.legalStructure === 'private_limited' || registrationProfile?.legalStructure === 'opc') {
      categories.add('moa');
      categories.add('aoa');
    }

    if (registrationProfile?.legalStructure === 'llp') {
      categories.add('llp_agreement');
    }

    if (registrationProfile?.legalStructure === 'partnership') {
      categories.add('partnership_deed');
    }
  }

  if (
    registrationProfile?.startupIndiaStatus === 'recognized' ||
    registrationProfile?.registrationStage === 'startup_india_recognized'
  ) {
    categories.add('startup_india_certificate');
  }

  if (registrationProfile?.trademarkStatus === 'registered') {
    categories.add('trademark_certificate');
  }

  if (registrationProfile?.patentStatus === 'filed' || registrationProfile?.patentStatus === 'granted') {
    categories.add('patent_proof');
  }

  return Array.from(categories);
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
    legalStructure?: string;
    registrationStage?: string;
    proposedEntityName?: string;
    registeredEntityName?: string;
    businessObjective?: string;
    incorporationState?: string;
    registeredOfficeAddress?: string;
    registeredOfficeCity?: string;
    registeredOfficeState?: string;
    registeredOfficePincode?: string;
    cinOrLlpin?: string;
    companyPan?: string;
    startupIndiaStatus?: string;
    startupIndiaRecognitionNumber?: string;
    dscReady?: boolean;
    founderAgreementSigned?: boolean;
    bankAccountOpened?: boolean;
    bankName?: string;
  };
}): StartupReadiness => {
  const missingItems: string[] = [];
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
  addMissing(startup.founderIds.length === 0, 'at least one founder');
  addMissing((startup.businessProfile?.problemStatement?.trim().length ?? 0) < 30, 'problem statement');
  addMissing((startup.businessProfile?.solutionSummary?.trim().length ?? 0) < 30, 'solution summary');
  addMissing((startup.businessProfile?.targetCustomers?.trim().length ?? 0) < 20, 'target customers');
  addMissing((startup.businessProfile?.marketAnalysis?.trim().length ?? 0) < 20, 'market analysis');
  addMissing((startup.businessProfile?.revenueModel?.trim().length ?? 0) < 20, 'revenue model');
  addMissing((startup.businessProfile?.goToMarketPlan?.trim().length ?? 0) < 20, 'go-to-market plan');
  addMissing(!startup.registrationProfile?.legalStructure, 'legal structure');
  addMissing(!startup.registrationProfile?.registrationStage, 'registration stage');
  addMissing(
    !startup.registrationProfile?.proposedEntityName?.trim() &&
      !startup.registrationProfile?.registeredEntityName?.trim(),
    'proposed or registered entity name',
  );
  addMissing((startup.registrationProfile?.businessObjective?.trim().length ?? 0) < 20, 'business objective');
  addMissing((startup.registrationProfile?.registeredOfficeAddress?.trim().length ?? 0) < 20, 'registered office address');
  addMissing(!startup.registrationProfile?.registeredOfficeCity?.trim(), 'registered office city');
  addMissing(!startup.registrationProfile?.registeredOfficeState?.trim(), 'registered office state');
  addMissing(!pincodePattern.test(startup.registrationProfile?.registeredOfficePincode?.trim() ?? ''), 'registered office pincode');
  addMissing(!startup.registrationProfile?.dscReady, 'digital signature certificate readiness');
  addMissing(!startup.registrationProfile?.founderAgreementSigned, 'founder agreement confirmation');
  addMissing(!startup.pitchDeckUrl && !uploadedCategorySet.has('business_plan'), 'business plan or pitch deck upload');
  addMissing(!uploadedCategorySet.has('founder_agreement'), 'founder agreement upload');

  if (isIncorporatedStage(startup.registrationProfile?.registrationStage)) {
    addMissing(!startup.registrationProfile?.incorporationState?.trim(), 'incorporation state');
    addMissing(!startup.registrationProfile?.cinOrLlpin?.trim(), 'CIN or LLPIN');
    addMissing(!startup.registrationProfile?.companyPan?.trim(), 'company PAN');
  }

  if (
    startup.registrationProfile?.startupIndiaStatus === 'recognized' ||
    startup.registrationProfile?.registrationStage === 'startup_india_recognized'
  ) {
    addMissing(!startup.registrationProfile?.startupIndiaRecognitionNumber?.trim(), 'Startup India recognition number');
  }

  if (startup.registrationProfile?.bankAccountOpened && !startup.registrationProfile?.bankName?.trim()) {
    addMissing(true, 'bank name');
  }

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

const sanitizeStartupForClient = (startup: Record<string, any>) => ({
  ...startup,
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
  readiness: buildStartupReadiness(startup as never),
});

const serializeStartup = (startup: { toObject?: () => Record<string, any> } | Record<string, any>) => {
  const base = typeof (startup as { toObject?: () => Record<string, any> }).toObject === 'function'
    ? (startup as { toObject: () => Record<string, any> }).toObject()
    : (startup as Record<string, any>);

  return sanitizeStartupForClient(base);
};

export const createStartupProfile = async (userId: string, payload: z.infer<typeof startupSchema>) => {
  const startup = await Startup.create({
    founderIds: [userId],
    ...normalizeStartupPayload(buildStartupInput(payload)),
  });

  return serializeStartup(startup);
};

export const getMyStartups = async (userId: string) => {
  const startups = await Startup.find({ founderIds: userId, isActive: true }).sort({ updatedAt: -1 }).lean();
  return startups.map((startup) => serializeStartup(startup));
};

export const getStartupById = async (startupId: string, userId: string) => {
  const startup = await Startup.findOne({ _id: startupId, founderIds: userId, isActive: true }).lean();
  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found.');
  }
  return serializeStartup(startup);
};

export const getStartupForFounder = async (startupId: string, userId: string) => {
  const startup = await Startup.findById(startupId);
  if (!startup) {
    throw new ApiError(403, 'FORBIDDEN', 'Only founders can access this startup.');
  }

  const isFounder = startup.founderIds.some((founderId) => String(founderId) === String(userId));
  if (!isFounder) {
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
  const mergedPayload = buildStartupInput({
    ...startup.toObject(),
    ...payload,
    businessProfile: {
      ...(startup.toObject().businessProfile ?? {}),
      ...(payload.businessProfile ?? {}),
    },
    registrationProfile: {
      ...(startup.toObject().registrationProfile ?? {}),
      ...(payload.registrationProfile ?? {}),
    },
    traction: {
      ...(startup.toObject().traction ?? {}),
      ...(payload.traction ?? {}),
    },
  });
  Object.assign(startup, normalizeStartupPayload(mergedPayload));

  if (startup.reviewStatus === 'review_requested') {
    startup.reviewStatus = 'draft';
    clearReviewMetadata(startup);
  }

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

  if (payload.launchTo !== 'recruiters' && startup.reviewStatus !== 'approved') {
    throw new ApiError(
      403,
      'STARTUP_REVIEW_REQUIRED',
      'Startup must be approved by admin before it can be launched to the marketplace.',
    );
  }

  const user = await User.findById(userId).select('innovationScore').lean();
  const score = normalizeInnovationScore(user?.innovationScore ?? 0);

  startup.launchedToInvestors = payload.launchTo === 'investors' || payload.launchTo === 'both';
  startup.launchedToMentors = payload.launchTo === 'mentors' || payload.launchTo === 'both';
  startup.launchedToRecruiters = payload.launchTo === 'recruiters';
  startup.launchedAt = new Date();
  startup.innovationScoreAtLaunch = score;
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
  const uploaded = await uploadToCloudinary(file.buffer, 'promove/startups', 'raw', { format: 'pdf' });
  startup.pitchDeckUrl = uploaded.secure_url;
  startup.pitchDeckName = file.originalname;

  if (startup.reviewStatus === 'review_requested') {
    startup.reviewStatus = 'draft';
    clearReviewMetadata(startup);
  }

  await startup.save();
  return serializeStartup(startup);
};

export const uploadStartupDocument = async (
  startupId: string,
  userId: string,
  file: Express.Multer.File,
  payload: z.infer<typeof startupDocumentUploadSchema>,
) => {
  const startup = await getStartupForFounder(startupId, userId);
  const fileType = file.mimetype === 'application/pdf' ? 'pdf' : 'image';
  const uploaded = await uploadToCloudinary(
    file.buffer,
    'promove/startup-documents',
    fileType === 'pdf' ? 'raw' : 'image',
    fileType === 'pdf' ? { format: 'pdf' } : undefined,
  );

  const existingDocument = startup.documents.find((document) => document.category === payload.category);
  if (existingDocument?.cloudinaryPublicId) {
    await deleteFromCloudinary(
      existingDocument.cloudinaryPublicId,
      existingDocument.fileType === 'pdf' ? 'raw' : 'image',
    );
  }

  startup.documents = startup.documents.filter((document) => document.category !== payload.category);
  startup.documents.push({
    _id: new Types.ObjectId(),
    category: payload.category,
    fileUrl: uploaded.secure_url,
    fileType,
    fileName: file.originalname,
    fileSizeBytes: file.size,
    uploadedAt: new Date(),
    uploadedBy: new Types.ObjectId(userId),
    ...(payload.note?.trim() ? { note: payload.note.trim() } : {}),
    cloudinaryPublicId: uploaded.public_id,
  });

  if (startup.reviewStatus === 'review_requested') {
    startup.reviewStatus = 'draft';
    clearReviewMetadata(startup);
  }

  await startup.save();
  return serializeStartup(startup);
};

export const deleteStartupDocument = async (startupId: string, userId: string, documentId: string) => {
  const startup = await getStartupForFounder(startupId, userId);
  const document = startup.documents.find((item) => String(item._id) === documentId);

  if (!document) {
    throw new ApiError(404, 'STARTUP_DOCUMENT_NOT_FOUND', 'Startup document not found.');
  }

  if (document.cloudinaryPublicId) {
    await deleteFromCloudinary(
      document.cloudinaryPublicId,
      document.fileType === 'pdf' ? 'raw' : 'image',
    );
  }

  startup.documents = startup.documents.filter((item) => String(item._id) !== documentId);

  if (startup.reviewStatus === 'review_requested') {
    startup.reviewStatus = 'draft';
    clearReviewMetadata(startup);
  }

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
      createdAt: Date;
      updatedAt: Date;
      pitchDeckUrl?: string;
      pitchDeckName?: string;
      registrationProfile: {
        legalStructure: string;
        registrationStage: string;
        proposedEntityName?: string;
        registeredEntityName?: string;
        startupIndiaStatus?: string;
        startupIndiaRecognitionNumber?: string;
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

  const founderIds = [...new Set(startups.flatMap((startup) => startup.founderIds.map(String)))];
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
      ...(startup.launchedAt ? { launchedAt: startup.launchedAt.toISOString() } : {}),
      reviewStatus: startup.reviewStatus,
      ...(startup.reviewRequestedAt ? { reviewRequestedAt: startup.reviewRequestedAt.toISOString() } : {}),
      ...(startup.adminReviewedAt ? { adminReviewedAt: startup.adminReviewedAt.toISOString() } : {}),
      ...(startup.adminReviewedBy ? { adminReviewedBy: String(startup.adminReviewedBy) } : {}),
      ...(startup.adminNotes ? { adminNotes: startup.adminNotes } : {}),
      ...(startup.pitchDeckUrl ? { pitchDeckUrl: startup.pitchDeckUrl } : {}),
      ...(startup.pitchDeckName ? { pitchDeckName: startup.pitchDeckName } : {}),
      traction: startup.traction,
      registrationProfile: {
        legalStructure: startup.registrationProfile.legalStructure,
        registrationStage: startup.registrationProfile.registrationStage,
        proposedEntityName: startup.registrationProfile.proposedEntityName,
        ...(startup.registrationProfile.registeredEntityName
          ? { registeredEntityName: startup.registrationProfile.registeredEntityName }
          : {}),
        startupIndiaStatus: startup.registrationProfile.startupIndiaStatus,
        ...(startup.registrationProfile.startupIndiaRecognitionNumber
          ? { startupIndiaRecognitionNumber: startup.registrationProfile.startupIndiaRecognitionNumber }
          : {}),
      },
      readiness,
      documents: startup.documents.map((document) => ({
        _id: String(document._id),
        category: document.category,
        fileUrl: document.fileUrl,
        fileType: document.fileType,
        fileName: document.fileName,
        fileSizeBytes: document.fileSizeBytes,
        uploadedAt: document.uploadedAt.toISOString(),
        ...(document.note ? { note: document.note } : {}),
      })),
      founders: startup.founderIds
        .map((founderId) => founderMap.get(String(founderId)))
        .filter((founder): founder is NonNullable<typeof founder> => Boolean(founder))
        .map((founder) => ({
          _id: String(founder._id),
          displayName: founder.displayName,
          ...(founder.avatar ? { avatar: founder.avatar } : {}),
          innovationScore: founder.innovationScore ?? 0,
          ...(founder.domain ? { domain: founder.domain } : {}),
        })),
      createdAt: startup.createdAt.toISOString(),
      updatedAt: startup.updatedAt.toISOString(),
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

  if (payload.decision === 'approved') {
    startup.reviewRequestedAt = startup.reviewRequestedAt ?? new Date();
  }

  await startup.save();
  return serializeStartup(startup);
};
