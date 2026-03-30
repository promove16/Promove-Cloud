import { z } from 'zod';
import { notificationQueue } from '../../config/bullmq';
import { applyScoreAsync } from '../../services/scoreEngine';
import { ApiError } from '../../utils/ApiError';
import { User } from '../user/user.model';
import { UserRole } from '../../types/roles.types';
import { Workspace } from '../workspace/workspace.model';
import { Patent } from './patent.model';

const filingDocumentsSchema = z
  .object({
    inventionCategory: z.enum([
      'mobile_app_backend',
      'iot_hardware_interface',
      'mechanical_improvement',
      'software_hardware_integration',
      'other',
    ]),
    specificationType: z.enum(['provisional', 'complete']),
    inventorJournalSummary: z.string().trim().min(50),
    priorArtSearchSummary: z.string().trim().min(50),
    prototypeStatus: z.enum([
      'concept_only',
      'partial_prototype',
      'working_prototype',
      'validated_prototype',
    ]),
    specificationDraft: z.string().trim().min(80),
    abstractDraft: z.string().trim().min(30),
    claimsDraft: z.string().trim().min(50),
    drawingsPrepared: z.boolean(),
    drawingsNotes: z.string().trim().min(20),
    form1ApplicantDetailsConfirmed: z.literal(true),
    form3ForeignFilingDetails: z.string().trim().max(500).optional(),
    form5InventorshipConfirmed: z.literal(true),
    form26PowerOfAttorneyRequired: z.boolean(),
    form26PowerOfAttorneyDetails: z.string().trim().max(500).optional(),
    examinationRequestPlan: z.string().trim().min(30),
    publicDisclosureChecked: z.literal(true),
    professionalSupportNeeded: z.boolean(),
    costManagementNotes: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.form26PowerOfAttorneyRequired && !value.form26PowerOfAttorneyDetails?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['form26PowerOfAttorneyDetails'],
        message: 'Add Form 26 details if a patent agent or attorney will be used.',
      });
    }
  });

const PATENT_DOC_CATEGORIES = [
  'inventor_journal',
  'prior_art_search',
  'specification_draft',
  'abstract_draft',
  'claims_draft',
  'drawings_diagrams',
  'examination_request',
  'form3_foreign_filing',
  'cost_management',
] as const;

export const patentSubmissionSchema = z.object({
  projectTitle: z.string().trim().min(2).max(200),
  workspaceId: z.string().min(1),
  documentUploads: z
    .array(
      z.object({
        uploadId: z.string().min(1),
        category: z.enum(PATENT_DOC_CATEGORIES),
      }),
    )
    .min(1)
    .max(9),
  questionnaire: z.object({
    whatIsYourInnovation: z.string().trim().min(50),
    noveltyExplanation: z.string().trim().min(50),
    technicalDetails: z.string().trim().min(50),
    marketUseCase: z.string().trim().min(50),
    priorArtAwareness: z.string().trim().min(50),
  }),
  filingDocuments: filingDocumentsSchema,
});

export const submitPatent = async (userId: string, payload: z.infer<typeof patentSubmissionSchema>) => {
  const workspace = await Workspace.findOne({
    _id: payload.workspaceId,
    $or: [{ ownerId: userId }, { teamMemberIds: userId }],
  }).lean();

  if (!workspace) {
    throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Select a valid workspace before submitting for patent review.');
  }

  const supportingDocuments = payload.documentUploads.map((item) => {
    const upload = workspace.uploads.find((u) => String(u._id) === item.uploadId);
    if (!upload) {
      throw new ApiError(400, 'SUPPORTING_DOCUMENT_NOT_FOUND', 'One or more selected project documents no longer exist in the workspace.');
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

  const patent = await Patent.create({
    studentId: userId,
    workspaceId: payload.workspaceId,
    projectTitle: payload.projectTitle,
    questionnaire: payload.questionnaire,
    filingDocuments: payload.filingDocuments,
    supportingDocuments,
    status: 'submitted',
    submittedAt: new Date(),
  });

  await applyScoreAsync({
    userId,
    trigger: 'PATENT_SUBMITTED',
    metadata: { patentId: String(patent._id) },
  });

  await notificationQueue.add('patent-submitted', {
    userId,
    type: 'patent_status',
    title: 'Patent submission received',
    body: `Your patent submission for ${payload.projectTitle} is now in review.`,
    link: '/patent-support',
  });

  const admins = await User.find({ role: UserRole.ADMIN }).select('_id').lean();
  await Promise.all(
    admins.map((admin) =>
      notificationQueue.add('patent-admin-notify', {
        userId: String(admin._id),
        type: 'patent_status',
        title: 'New patent submission',
        body: `${payload.projectTitle} has been submitted for patent review.`,
        link: '/admin/patents',
      }),
    ),
  );

  return patent.toObject();
};

export const getMyPatents = async (userId: string) =>
  Patent.find({ studentId: userId }).sort({ createdAt: -1 }).lean();
