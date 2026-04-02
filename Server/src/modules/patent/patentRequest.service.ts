import { z } from 'zod';
import { notificationQueue } from '../../config/bullmq';
import { ApiError } from '../../utils/ApiError';
import { User } from '../user/user.model';
import { UserRole } from '../../types/roles.types';
import { Workspace } from '../workspace/workspace.model';
import { PatentRequest } from './patentRequest.model';

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const inventorSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  address: z.string().trim().min(10).max(500),
  nationality: z.string().trim().min(2).max(60),
  contribution: z.string().trim().min(10).max(1000),
});

const applicantSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  address: z.string().trim().min(10).max(500),
  entityType: z.enum(['individual', 'startup', 'institution', 'small_entity']),
  dpiitNumber: z.string().trim().max(50).optional(),
  institutionName: z.string().trim().max(200).optional(),
});

const PATENT_REQUEST_DOC_CATEGORIES = [
  'form1_application',
  'form2_specification',
  'form3_foreign_filing',
  'form5_inventorship',
  'form26_power_of_attorney',
  'form28_startup_status',
  'drawings',
  'prior_art_report',
  'assignment_deed',
  'priority_document',
  'other',
] as const;

export const patentRequestSubmissionSchema = z
  .object({
    workspaceId: z.string().min(1),

    // Form 1 — Application for grant
    inventionTitle: z.string().trim().min(5).max(300),
    inventionCategory: z.enum([
      'mobile_app_backend',
      'iot_hardware_interface',
      'mechanical_improvement',
      'software_hardware_integration',
      'other',
    ]),
    applicantDetails: applicantSchema,
    inventors: z.array(inventorSchema).min(1).max(10),

    // Form 2 — Specification
    specificationType: z.enum(['provisional', 'complete']),
    technicalField: z.string().trim().min(20).max(2000),
    backgroundArt: z.string().trim().min(50).max(5000),
    inventionDescription: z.string().trim().min(100).max(20000),
    abstractText: z.string().trim().min(30).max(1500),
    claimsText: z.string().trim().min(50).max(10000),
    drawingsDescription: z.string().trim().max(2000).optional(),
    bestMode: z.string().trim().min(30).max(5000),

    // Form 3 — Foreign filing
    hasFiledAbroad: z.boolean(),
    foreignFilingCountries: z.string().trim().max(500).optional(),
    foreignApplicationNumbers: z.string().trim().max(500).optional(),

    // Form 5 — Inventorship declaration
    inventorDeclarationConfirmed: z.literal(true),

    // Form 26 — Power of attorney
    powerOfAttorneyGranted: z.literal(true),
    attorneyDetails: z.string().trim().max(1000).optional(),

    // Form 28 — Fee reduction
    claimingFeeReduction: z.boolean(),
    feeReductionEntityType: z.enum(['individual', 'startup', 'institution', 'small_entity']).optional(),
    dpiitRecognitionNumber: z.string().trim().max(50).optional(),

    // Prior art & novelty
    priorArtSearchSummary: z.string().trim().min(30).max(5000),
    priorArtReferences: z.string().trim().max(3000).optional(),
    noveltyStatement: z.string().trim().min(30).max(5000),

    // Examination
    proposedExaminationType: z.enum(['normal', 'expedited']),
    publicDisclosureStatus: z.boolean(),

    // Document uploads (references to workspace uploads)
    documentUploads: z
      .array(
        z.object({
          uploadId: z.string().min(1),
          category: z.enum(PATENT_REQUEST_DOC_CATEGORIES),
        }),
      )
      .min(0)
      .max(15),
  })
  .superRefine((val, ctx) => {
    if (val.hasFiledAbroad && !val.foreignFilingCountries?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['foreignFilingCountries'],
        message: 'List the countries where patent applications have been filed.',
      });
    }
    if (val.claimingFeeReduction && !val.feeReductionEntityType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['feeReductionEntityType'],
        message: 'Select entity type to claim fee reduction.',
      });
    }
  });

// ─── Service functions ────────────────────────────────────────────────────────

export const submitPatentRequest = async (userId: string, payload: z.infer<typeof patentRequestSubmissionSchema>) => {
  const workspace = await Workspace.findOne({
    _id: payload.workspaceId,
    $or: [{ ownerId: userId }, { teamMemberIds: userId }],
  }).lean();

  if (!workspace) {
    throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Select a valid workspace before submitting a patent request.');
  }

  if (workspace.claimedProblemId) {
    throw new ApiError(
      400,
      'PATENT_WORKSPACE_NOT_ELIGIBLE',
      'Patent support is only available for your own product workspace. ProMove problem-bank workspaces are leaderboard-only.',
    );
  }

  const documents = payload.documentUploads.map((item) => {
    const upload = workspace.uploads.find((u) => String(u._id) === item.uploadId);
    if (!upload) {
      throw new ApiError(400, 'DOCUMENT_NOT_FOUND', 'One or more selected documents no longer exist in the workspace.');
    }
    return {
      uploadId: upload._id,
      fileUrl: upload.fileUrl,
      fileType: upload.fileType,
      fileName: upload.fileName,
      fileSizeBytes: upload.fileSizeBytes,
      documentCategory: item.category,
      ...(upload.note ? { note: upload.note } : {}),
    };
  });

  const patentRequest = await PatentRequest.create({
    studentId: userId,
    workspaceId: payload.workspaceId,
    inventionTitle: payload.inventionTitle,
    inventionCategory: payload.inventionCategory,
    applicantDetails: payload.applicantDetails,
    inventors: payload.inventors,
    specificationType: payload.specificationType,
    technicalField: payload.technicalField,
    backgroundArt: payload.backgroundArt,
    inventionDescription: payload.inventionDescription,
    abstractText: payload.abstractText,
    claimsText: payload.claimsText,
    ...(payload.drawingsDescription ? { drawingsDescription: payload.drawingsDescription } : {}),
    bestMode: payload.bestMode,
    hasFiledAbroad: payload.hasFiledAbroad,
    ...(payload.foreignFilingCountries ? { foreignFilingCountries: payload.foreignFilingCountries } : {}),
    ...(payload.foreignApplicationNumbers ? { foreignApplicationNumbers: payload.foreignApplicationNumbers } : {}),
    inventorDeclarationConfirmed: payload.inventorDeclarationConfirmed,
    powerOfAttorneyGranted: payload.powerOfAttorneyGranted,
    ...(payload.attorneyDetails ? { attorneyDetails: payload.attorneyDetails } : {}),
    claimingFeeReduction: payload.claimingFeeReduction,
    ...(payload.feeReductionEntityType ? { feeReductionEntityType: payload.feeReductionEntityType } : {}),
    ...(payload.dpiitRecognitionNumber ? { dpiitRecognitionNumber: payload.dpiitRecognitionNumber } : {}),
    priorArtSearchSummary: payload.priorArtSearchSummary,
    ...(payload.priorArtReferences ? { priorArtReferences: payload.priorArtReferences } : {}),
    noveltyStatement: payload.noveltyStatement,
    proposedExaminationType: payload.proposedExaminationType,
    publicDisclosureStatus: payload.publicDisclosureStatus,
    documents,
    status: 'submitted',
    submittedAt: new Date(),
  });

  await notificationQueue.add('patent-request-submitted', {
    userId,
    type: 'patent_status',
    title: 'Patent filing request received',
    body: `Your assisted patent filing request for "${payload.inventionTitle}" is now under review.`,
    link: '/patent-support',
  });

  const admins = await User.find({ role: UserRole.ADMIN }).select('_id').lean();
  await Promise.all(
    admins.map((admin) =>
      notificationQueue.add('patent-request-admin-notify', {
        userId: String(admin._id),
        type: 'patent_status',
        title: 'New assisted filing request',
        body: `${payload.inventionTitle} has been submitted for assisted patent filing.`,
        link: '/admin/patents',
      }),
    ),
  );

  return patentRequest.toObject();
};

export const getMyPatentRequests = async (userId: string) =>
  PatentRequest.find({ studentId: userId }).sort({ createdAt: -1 }).lean();

export const getPatentRequestById = async (userId: string, requestId: string) => {
  const request = await PatentRequest.findOne({ _id: requestId, studentId: userId }).lean();
  if (!request) {
    throw new ApiError(404, 'PATENT_REQUEST_NOT_FOUND', 'Patent request not found.');
  }
  return request;
};
