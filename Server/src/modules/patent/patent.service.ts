import { z } from 'zod';
import { notificationQueue } from '../../config/bullmq';
import { applyScoreAsync } from '../../services/scoreEngine';
import { ApiError } from '../../utils/ApiError';
import { User } from '../user/user.model';
import { UserRole } from '../../types/roles.types';
import { Workspace } from '../workspace/workspace.model';
import { Startup } from '../startup/startup.model';
import { recordStartupLifecycleEvent } from '../startupLifecycle/startupLifecycle.service';
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
  'design_plan_sketch',
  'examination_request',
  'form3_foreign_filing',
  'cost_management',
] as const;

export const patentSubmissionSchema = z.object({
  projectTitle: z.string().trim().min(2).max(200),
  workspaceId: z.string().min(1),
  coInventorIds: z.array(z.string().min(1)).max(4).default([]),
  documentUploads: z
    .array(
      z.object({
        uploadId: z.string().min(1),
        category: z.enum(PATENT_DOC_CATEGORIES),
      }),
    )
    .min(0)
    .max(9),
  questionnaire: z.object({
    problemStatement: z.string().trim().min(40),
    solutionDifferentiation: z.string().trim().min(40),
    coreInnovation: z.string().trim().min(30),
    priorArtStatus: z.string().trim().min(20),
    workingMechanism: z.string().trim().min(40),
    keyComponents: z.string().trim().min(20),
    developmentStage: z.string().trim().min(1),
    documentationReadiness: z.string().trim().min(10),
    inventorOwnership: z.string().trim().min(1),
    developmentContext: z.string().trim().min(20),
    targetMarkets: z.string().trim().min(20),
    commercializationStrategy: z.string().trim().min(1),
    publicDisclosureStatus: z.string().trim().min(10),
    legalAgreements: z.string().trim().min(10),
    ipProtectionType: z.string().trim().min(1),
  }),
  filingDocuments: filingDocumentsSchema.optional(),

  // Patent Verification — for already-filed patents
  patentStage: z.enum(['filed', 'published', 'granted']).optional(),
  ipoApplicationNumber: z.string().trim().max(50).optional(),
  ipoFilingDate: z.string().datetime().optional(),
  publicationDate: z.string().datetime().optional(),
  grantNumber: z.string().trim().max(50).optional(),
  grantDate: z.string().datetime().optional(),
});

export const submitPatent = async (userId: string, payload: z.infer<typeof patentSubmissionSchema>) => {
  const workspace = await Workspace.findOne({
    _id: payload.workspaceId,
    $or: [{ ownerId: userId }, { teamMemberIds: userId }],
  }).lean();

  if (!workspace) {
    throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Select a valid workspace before submitting for patent review.');
  }

  if (workspace.claimedProblemId) {
    throw new ApiError(
      400,
      'PATENT_WORKSPACE_NOT_ELIGIBLE',
      'Patent support is only available for your own product workspace. ProMove problem-bank workspaces are leaderboard-only.',
    );
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

  // Validate co-inventors are workspace members (not the submitter)
  const workspaceMemberIds = new Set([
    String(workspace.ownerId),
    ...workspace.teamMemberIds.map((id: any) => String(id)),
  ]);
  const validCoInventorIds = payload.coInventorIds.filter(
    (id) => id !== userId && workspaceMemberIds.has(id),
  );

  const patent = await Patent.create({
    studentId: userId,
    coInventorIds: validCoInventorIds,
    workspaceId: payload.workspaceId,
    projectTitle: payload.projectTitle,
    questionnaire: payload.questionnaire,
    ...(payload.filingDocuments ? { filingDocuments: payload.filingDocuments } : {}),
    supportingDocuments,
    status: 'submitted',
    submittedAt: new Date(),
    ...(payload.patentStage ? { patentStage: payload.patentStage } : {}),
    ...(payload.ipoApplicationNumber ? { ipoApplicationNumber: payload.ipoApplicationNumber } : {}),
    ...(payload.ipoFilingDate ? { ipoFilingDate: new Date(payload.ipoFilingDate) } : {}),
    ...(payload.publicationDate ? { publicationDate: new Date(payload.publicationDate) } : {}),
    ...(payload.grantNumber ? { grantNumber: payload.grantNumber } : {}),
    ...(payload.grantDate ? { grantDate: new Date(payload.grantDate) } : {}),
  });

  const linkedStartup = await Startup.findOne({ projectId: payload.workspaceId, isActive: true });
  if (linkedStartup) {
    linkedStartup.traction = {
      ...(linkedStartup.traction ?? {}),
      patentFiled: true,
      patentType: 'self_filed',
      patentApplicationId: String(patent._id),
    };
    if (linkedStartup.innovationProfile?.tractionProfile) {
      linkedStartup.innovationProfile.tractionProfile.patentStatus =
        payload.patentStage === 'published' || payload.patentStage === 'granted' ? 'published' : 'filed';
    }
    await linkedStartup.save();
  }

  await recordStartupLifecycleEvent({
    startupId: linkedStartup?._id,
    workspaceId: payload.workspaceId,
    actorId: userId,
    source: 'patent',
    type: 'PATENT_SUBMITTED',
    title: 'Patent submitted',
    description: `${payload.projectTitle} was submitted for patent review.`,
    status: patent.status,
    metadata: {
      patentId: String(patent._id),
      patentStage: payload.patentStage,
      documentCount: supportingDocuments.length,
    },
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
    link: '/startup-launch',
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
  Patent.find({ $or: [{ studentId: userId }, { coInventorIds: userId }] }).sort({ createdAt: -1 }).lean();

export const togglePatentShowcase = async (userId: string, patentId: string) => {
  const patent = await Patent.findOne({ _id: patentId, studentId: userId });
  if (!patent) throw new ApiError(404, 'PATENT_NOT_FOUND', 'Patent not found');
  if (patent.status !== 'approved') {
    throw new ApiError(400, 'NOT_APPROVED', 'Only approved patents can be showcased in the marketplace.');
  }
  patent.showcasedInMarketplace = !patent.showcasedInMarketplace;
  await patent.save();
  return { showcasedInMarketplace: patent.showcasedInMarketplace };
};

export const getShowcasedPatents = async () => {
  const patents = await Patent.find({ status: 'approved', showcasedInMarketplace: true })
    .sort({ adminReviewedAt: -1 })
    .lean();
  const studentIds = patents.map((p) => String(p.studentId));
  const students = studentIds.length > 0
    ? await User.find({ _id: { $in: studentIds } })
        .select('_id displayName avatar domain bio headline')
        .lean()
    : [];
  const studentMap = new Map(students.map((s) => [String(s._id), s]));

  return patents.map((p) => {
    const student = studentMap.get(String(p.studentId));
    return {
      _id: String(p._id),
      studentId: String(p.studentId),
      projectTitle: p.projectTitle,
      inventionCategory: p.filingDocuments?.inventionCategory,
      specificationType: p.filingDocuments?.specificationType,
      abstract: p.filingDocuments?.abstractDraft,
      patentStage: p.patentStage,
      ipoApplicationNumber: p.ipoApplicationNumber,
      submittedAt: p.submittedAt,
      adminReviewedAt: p.adminReviewedAt,
      student: {
        _id: String(p.studentId),
        displayName: student?.displayName ?? 'Student',
        ...(student?.avatar ? { avatar: student.avatar } : {}),
        ...(student?.domain ? { domain: student.domain } : {}),
        ...(student?.bio ? { bio: student.bio } : {}),
        ...(student?.headline ? { headline: student.headline } : {}),
      },
    };
  });
};
