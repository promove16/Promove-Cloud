import { Types } from 'mongoose';
import { z } from 'zod';
import { uploadFile, deleteStoredAsset } from '../../services/fileStorageService';
import { renderPatentSystemDocument } from '../../services/patentSystemDocument';
import { ApiError } from '../../utils/ApiError';
import { applyScore } from '../../services/scoreEngine';
import { User } from '../user/user.model';
import { UserRole } from '../../types/roles.types';
import { Workspace } from '../workspace/workspace.model';
import { recordStartupLifecycleEvent } from '../startupLifecycle/startupLifecycle.service';
import { queueNotification } from '../notification/notification.delivery';
import { PatentRequest } from './patentRequest.model';
import { LEGACY_STATUS_MAP, type IPatentRequest, type PatentRequestDocument, type PatentRequestStatus } from './patent.types';
import { getSignedPatentDocumentUrl, resolveStartupForPatentSubmission } from './patent.service';

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
  'patent_certificate',
  'supporting_evidence',
  'other',
] as const;

const MUTABLE_PATENT_REQUEST_STATUSES = new Set<PatentRequestStatus>([
  'draft',
  'submitted',
  'documents_review',
  'ready_for_filing',
  'filed_with_ipo',
  'published',
  'examination_requested',
  'fer_issued',
  'fer_response_submitted',
]);

const normalizePatentRequestStatus = (raw: string): PatentRequestStatus =>
  (LEGACY_STATUS_MAP[raw] as PatentRequestStatus) ?? (raw as PatentRequestStatus);

export const serializePatentRequestDocument = async (document: PatentRequestDocument) => ({
  ...document,
  fileUrl: await getSignedPatentDocumentUrl(document),
});

export const serializePatentRequestForClient = async (request: IPatentRequest) => ({
  ...request,
  documents: await Promise.all((request.documents ?? []).map(serializePatentRequestDocument)),
  ...(request.officialHandover
    ? {
        officialHandover: {
          ...request.officialHandover,
          documents: await Promise.all(
            (request.officialHandover.documents ?? []).map(serializePatentRequestDocument),
          ),
        },
      }
    : {}),
});

export const patentRequestDocumentUploadSchema = z.object({
  documentCategory: z.enum(PATENT_REQUEST_DOC_CATEGORIES),
  note: z.string().trim().max(300).optional(),
});

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

    // Form 26 — Power of attorney (conditional on agent/attorney usage)
    powerOfAttorneyGranted: z.boolean().default(false),
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
    if (val.claimingFeeReduction && val.feeReductionEntityType === 'startup' && !val.dpiitRecognitionNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dpiitRecognitionNumber'],
        message: 'DPIIT recognition number is required for startup fee reduction claims.',
      });
    }
    if (val.powerOfAttorneyGranted && !val.attorneyDetails?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['attorneyDetails'],
        message: 'Provide attorney or agent details when granting power of attorney.',
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

  const linkedStartup = await resolveStartupForPatentSubmission(userId, payload.workspaceId);

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
      ...(upload.storageProvider ? { storageProvider: upload.storageProvider } : {}),
      ...(upload.storageKey ? { storageKey: upload.storageKey } : {}),
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
    ...(payload.specificationType === 'provisional'
      ? { completeSpecDeadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }
      : {}),
  });

  await applyScore({
    userId,
    trigger: 'PATENT_SUBMITTED',
    metadata: { workspaceId: payload.workspaceId, patentRequestId: String(patentRequest._id) },
    idempotencyKey: `patent-submitted:${patentRequest._id}`,
  });

  linkedStartup.traction = {
    ...(linkedStartup.traction ?? {}),
    patentFiled: true,
    patentType: 'promove_assisted',
    patentApplicationId: String(patentRequest._id),
  };
  await linkedStartup.save();

  await recordStartupLifecycleEvent({
    startupId: linkedStartup?._id,
    workspaceId: payload.workspaceId,
    actorId: userId,
    source: 'patent',
    type: 'PATENT_ASSISTED_FILING_SUBMITTED',
    title: 'Assisted patent filing submitted',
    description: `${payload.inventionTitle} was submitted for assisted patent filing.`,
    status: patentRequest.status,
    metadata: {
      patentRequestId: String(patentRequest._id),
      specificationType: payload.specificationType,
      documentCount: documents.length,
    },
  });

  await queueNotification({
    userId,
    type: 'patent_status',
    title: 'Patent filing request received',
    body: `Your assisted patent filing request for "${payload.inventionTitle}" is now under review.`,
    link: '/startup-launch',
  });

  const admins = await User.find({ role: UserRole.ADMIN }).select('_id').lean();
  await Promise.all(
    admins.map((admin) =>
      queueNotification({
        userId: String(admin._id),
        type: 'patent_status',
        title: 'New assisted filing request',
        body: `${payload.inventionTitle} has been submitted for assisted patent filing.`,
        link: '/admin/patents',
      }),
    ),
  );

  return serializePatentRequestForClient(patentRequest.toObject());
};

export const getMyPatentRequests = async (userId: string) =>
  Promise.all(
    (await PatentRequest.find({ studentId: userId }).sort({ createdAt: -1 }).lean())
      .map((request) => serializePatentRequestForClient(request)),
  );

export const getPatentRequestById = async (userId: string, requestId: string) => {
  const request = await PatentRequest.findOne({ _id: requestId, studentId: userId }).lean();
  if (!request) {
    throw new ApiError(404, 'PATENT_REQUEST_NOT_FOUND', 'Patent request not found.');
  }
  return serializePatentRequestForClient(request);
};

// ─── Patent certificate (just-in-time PDF, generated from live data on every request) ──

export const getPatentCertificatePdf = async (userId: string, requestId: string) => {
  const request = await PatentRequest.findOne({ _id: requestId, studentId: userId }).lean();
  if (!request) {
    throw new ApiError(404, 'PATENT_REQUEST_NOT_FOUND', 'Patent request not found.');
  }

  if (normalizePatentRequestStatus(request.status) !== 'granted') {
    throw new ApiError(
      409,
      'PATENT_CERTIFICATE_NOT_AVAILABLE',
      'The patent certificate is only available after the patent has been granted.',
    );
  }

  const student = await User.findById(request.studentId).select('displayName email').lean();

  return renderPatentSystemDocument({
    kind: 'patent_certificate',
    generatedAt: new Date(),
    projectTitle: request.inventionTitle ?? request.projectTitle ?? 'Patent request',
    studentName: student?.displayName ?? 'Student',
    studentEmail: student?.email,
    workspaceId: request.workspaceId ? String(request.workspaceId) : undefined,
    patentRequestId: String(request._id),
    status: request.status,
    ipoApplicationNumber: request.ipoApplicationNumber,
    ipoFilingDate: request.ipoFilingDate,
    grantDate: request.grantDate,
  });
};

const getMutablePatentRequestForStudent = async (userId: string, requestId: string) => {
  const request = await PatentRequest.findOne({ _id: requestId, studentId: userId });
  if (!request) {
    throw new ApiError(404, 'PATENT_REQUEST_NOT_FOUND', 'Patent request not found.');
  }

  const normalizedStatus = normalizePatentRequestStatus(request.status);
  if (!MUTABLE_PATENT_REQUEST_STATUSES.has(normalizedStatus)) {
    throw new ApiError(
      409,
      'PATENT_REQUEST_LOCKED',
      'Documents can only be changed while the patent request is still in progress.',
    );
  }

  return request;
};

export const uploadPatentRequestDocument = async (
  userId: string,
  requestId: string,
  file: Express.Multer.File,
  payload: z.infer<typeof patentRequestDocumentUploadSchema>,
) => {
  const request = await getMutablePatentRequestForStudent(userId, requestId);
  const fileType = file.mimetype === 'application/pdf' ? 'pdf' : 'image';
  const uploaded = await uploadFile({
    buffer: file.buffer,
    folder: 'promove/patent-request-documents',
    fileName: file.originalname,
    contentType: file.mimetype || (fileType === 'pdf' ? 'application/pdf' : 'image/jpeg'),
  });

  request.documents.push({
    _id: new Types.ObjectId(),
    fileUrl: uploaded.url,
    fileType,
    fileName: file.originalname,
    fileSizeBytes: file.size,
    documentCategory: payload.documentCategory,
    reviewStatus: 'pending',
    uploadedAt: new Date(),
    ...(payload.note?.trim() ? { note: payload.note.trim() } : {}),
    storageProvider: uploaded.provider,
    storageKey: uploaded.key,
  });

  const normalizedStatus = normalizePatentRequestStatus(request.status);
  if (normalizedStatus === 'submitted') {
    request.status = 'documents_review';
    request.lastStatusUpdate = new Date();
    request.trackingTimeline = request.trackingTimeline ?? [];
    request.trackingTimeline.push({
      status: 'documents_review',
      note: `Student uploaded ${payload.documentCategory.replace(/_/g, ' ')} for review.`,
      updatedAt: new Date(),
      updatedBy: new Types.ObjectId(userId),
    });
  }

  await request.save();

  await queueNotification({
    userId,
    type: 'patent_status',
    title: 'Patent document uploaded',
    body: `${file.originalname} was added to your patent workflow.`,
    link: '/startup-launch',
  });

  const admins = await User.find({ role: UserRole.ADMIN }).select('_id').lean();
  await Promise.all(
    admins.map((admin) =>
      queueNotification({
        userId: String(admin._id),
        type: 'patent_status',
        title: 'New patent document uploaded',
        body: `${file.originalname} was uploaded for ${(request.inventionTitle ?? request.projectTitle ?? 'a patent request')}.`,
        link: '/admin/patent-requests',
      }),
    ),
  );

  return serializePatentRequestForClient(request.toObject());
};

export const deletePatentRequestDocument = async (userId: string, requestId: string, documentId: string) => {
  const request = await getMutablePatentRequestForStudent(userId, requestId);
  const document = request.documents.find((item) => String(item._id) === documentId);

  if (!document) {
    throw new ApiError(404, 'PATENT_DOCUMENT_NOT_FOUND', 'Patent document not found.');
  }

  await deleteStoredAsset({
    storageProvider: document.storageProvider,
    storageKey: document.storageKey,
    legacyCloudinaryResourceType: document.fileType === 'pdf' ? 'raw' : 'image',
  });

  request.documents = request.documents.filter((item) => String(item._id) !== documentId);
  await request.save();

  return serializePatentRequestForClient(request.toObject());
};

export const acknowledgeOfficialHandover = async (userId: string, requestId: string) => {
  const request = await PatentRequest.findOne({ _id: requestId, studentId: userId });
  if (!request) {
    throw new ApiError(404, 'PATENT_REQUEST_NOT_FOUND', 'Patent request not found.');
  }

  if (normalizePatentRequestStatus(request.status) !== 'granted') {
    throw new ApiError(
      409,
      'PATENT_HANDOVER_NOT_AVAILABLE',
      'Official handover can only be acknowledged after the patent has been granted.',
    );
  }

  if (!request.officialHandover?.handedOverAt || request.officialHandover.documents.length === 0) {
    throw new ApiError(409, 'PATENT_HANDOVER_NOT_READY', 'The official handover package is not ready yet.');
  }

  if (request.officialHandover.studentAcknowledgedAt) {
    throw new ApiError(409, 'PATENT_HANDOVER_ALREADY_ACKNOWLEDGED', 'Official handover has already been acknowledged.');
  }

  const now = new Date();
  request.officialHandover.studentAcknowledgedAt = now;
  request.officialHandover.studentAcknowledgedBy = new Types.ObjectId(userId);
  request.nextActionRequired = undefined;
  request.lastStatusUpdate = now;
  request.trackingTimeline = request.trackingTimeline ?? [];
  request.trackingTimeline.push({
    status: 'official_handover_acknowledged',
    note: 'Student acknowledged receipt of the official patent handover package.',
    updatedAt: now,
    updatedBy: new Types.ObjectId(userId),
  });

  await request.save();

  const notifyAdminIds =
    request.adminAssignedTo != null
      ? [String(request.adminAssignedTo)]
      : (await User.find({ role: UserRole.ADMIN }).select('_id').lean()).map((admin) => String(admin._id));

  await Promise.all(
    notifyAdminIds.map((adminId) =>
      queueNotification({
        userId: adminId,
        type: 'patent_status',
        title: 'Official patent handover acknowledged',
        body: `${request.inventionTitle ?? request.projectTitle ?? 'A patent case'} handover package was acknowledged by the student.`,
        link: '/admin/patents',
      }),
    ),
  );

  return serializePatentRequestForClient(request.toObject());
};

// ─── Simple Patent Support Request ───────────────────────────────────────────

const questionnaireSchema = z.object({
  problemStatement: z.string().trim().default(''),
  solutionDifferentiation: z.string().trim().default(''),
  coreInnovation: z.string().trim().default(''),
  priorArtStatus: z.string().trim().default(''),
  workingMechanism: z.string().trim().default(''),
  keyComponents: z.string().trim().default(''),
  developmentStage: z.string().trim().default(''),
  documentationReadiness: z.string().trim().default(''),
  inventorOwnership: z.string().trim().default(''),
  developmentContext: z.string().trim().default(''),
  targetMarkets: z.string().trim().default(''),
  commercializationStrategy: z.string().trim().default(''),
  publicDisclosureStatus: z.string().trim().default(''),
  legalAgreements: z.string().trim().default(''),
  ipProtectionType: z.string().trim().default(''),
});

export const patentSupportRequestSchema = z.object({
  workspaceId: z.string().min(1),
  projectTitle: z.string().trim().min(3).max(200),
  description: z.string().trim().min(20).max(5000),
  patentType: z.enum(['invention', 'design', 'trademark']),
  questionnaire: questionnaireSchema.optional(),
  documentUploads: z
    .array(
      z.object({
        uploadId: z.string().min(1),
        category: z.enum(PATENT_REQUEST_DOC_CATEGORIES),
      }),
    )
    .max(15)
    .optional(),
});

export const createPatentSupportRequest = async (
  userId: string,
  payload: z.infer<typeof patentSupportRequestSchema>,
) => {
  const workspace = await Workspace.findOne({
    _id: payload.workspaceId,
    $or: [{ ownerId: userId }, { teamMemberIds: userId }],
  }).lean();
  if (!workspace) {
    throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Select a valid workspace before requesting patent support.');
  }

  if (workspace.claimedProblemId) {
    throw new ApiError(
      400,
      'PATENT_WORKSPACE_NOT_ELIGIBLE',
      'Patent support is only available for your own product workspace. ProMove problem-bank workspaces are leaderboard-only.',
    );
  }

  const linkedStartup = await resolveStartupForPatentSubmission(userId, payload.workspaceId, {
    requireStartup: false,
  });
  const requiresStartupRegistration = !linkedStartup;

  const documents = (payload.documentUploads ?? []).map((item) => {
    const upload = workspace.uploads.find((entry) => String(entry._id) === item.uploadId);
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
      ...(upload.storageProvider ? { storageProvider: upload.storageProvider } : {}),
      ...(upload.storageKey ? { storageKey: upload.storageKey } : {}),
    };
  });

  const submittedAt = new Date();
  const patentRequest = await PatentRequest.create({
    studentId: userId,
    workspaceId: payload.workspaceId,
    projectTitle: payload.projectTitle,
    description: payload.description,
    patentType: payload.patentType,
    inventionTitle: payload.projectTitle,
    inventionCategory: 'other',
    applicantDetails: {
      fullName: 'Pending applicant details',
      address: 'Pending applicant address from admin-assisted intake',
      entityType: 'startup',
    },
    inventors: [
      {
        fullName: 'Pending inventor details',
        address: 'Pending inventor address from admin-assisted intake',
        nationality: 'Pending',
        contribution: 'To be confirmed during admin-assisted patent drafting.',
      },
    ],
    specificationType: 'provisional',
    technicalField: payload.questionnaire?.workingMechanism || 'Pending technical field details from admin-assisted intake.',
    backgroundArt: payload.questionnaire?.priorArtStatus || 'Pending prior-art summary from admin-assisted intake.',
    inventionDescription: payload.description,
    abstractText: payload.questionnaire?.coreInnovation || payload.description.slice(0, 120),
    claimsText: 'Claims will be drafted during admin-assisted filing review.',
    bestMode: payload.questionnaire?.workingMechanism || payload.description,
    hasFiledAbroad: false,
    inventorDeclarationConfirmed: true,
    powerOfAttorneyGranted: false,
    claimingFeeReduction: true,
    feeReductionEntityType: 'startup',
    priorArtSearchSummary: payload.questionnaire?.priorArtStatus || 'Prior-art review pending.',
    noveltyStatement: payload.questionnaire?.solutionDifferentiation || payload.description,
    proposedExaminationType: 'normal',
    publicDisclosureStatus: false,
    ...(payload.questionnaire ? { questionnaire: payload.questionnaire } : {}),
    status: requiresStartupRegistration ? 'draft' : 'submitted',
    ...(requiresStartupRegistration ? {} : { submittedAt }),
    ...(requiresStartupRegistration
      ? {
          nextActionRequired: 'Register a startup for this workspace to begin assisted patent filing.',
          trackingTimeline: [
            {
              status: 'draft',
              note: 'Patent support request received. Register a startup for this workspace so the patent team can begin drafting.',
              updatedAt: submittedAt,
              updatedBy: new Types.ObjectId(userId),
            },
          ],
        }
      : {
          trackingTimeline: [
            {
              status: 'submitted',
              note: 'Patent support request submitted for admin review.',
              updatedAt: submittedAt,
              updatedBy: new Types.ObjectId(userId),
            },
          ],
        }),
    documents,
  });

  if (linkedStartup) {
    await applyScore({
      userId,
      trigger: 'PATENT_SUBMITTED',
      metadata: { workspaceId: payload.workspaceId, patentRequestId: String(patentRequest._id) },
      idempotencyKey: `patent-submitted:${patentRequest._id}`,
    });

    linkedStartup.traction = {
      ...(linkedStartup.traction ?? {}),
      patentFiled: true,
      patentType: 'promove_assisted',
      patentApplicationId: String(patentRequest._id),
    };
    await linkedStartup.save();

    await recordStartupLifecycleEvent({
      startupId: linkedStartup?._id,
      workspaceId: payload.workspaceId,
      actorId: userId,
      source: 'patent',
      type: 'PATENT_SUPPORT_REQUESTED',
      title: 'Patent support requested',
      description: `${payload.projectTitle} was submitted for patent support.`,
      status: patentRequest.status,
      metadata: {
        patentRequestId: String(patentRequest._id),
        patentType: payload.patentType,
        documentCount: documents.length,
      },
    });
  }

  await queueNotification({
    userId,
    type: 'patent_status',
    title: requiresStartupRegistration
      ? 'Patent support request received'
      : 'Patent support request submitted',
    body: requiresStartupRegistration
      ? `Your patent support request for "${payload.projectTitle}" is saved as a draft. Register a startup for this workspace so the patent team can begin.`
      : `Your patent support request for "${payload.projectTitle}" is now under review.`,
    link: '/startup-launch',
  });

  const admins = await User.find({ role: UserRole.ADMIN, isActive: true }).select('_id').lean();
  await Promise.all(
    admins.map((admin) =>
      queueNotification({
        userId: String(admin._id),
        type: 'patent_status',
        title: requiresStartupRegistration
          ? 'New patent support draft awaiting startup'
          : 'New patent support request',
        body: requiresStartupRegistration
          ? `${payload.projectTitle} was submitted but no startup is linked to the workspace yet.`
          : `${payload.projectTitle} has been submitted for patent support.`,
        link: '/admin/patents',
        metadata: {
          requestId: patentRequest._id.toString(),
          studentId: userId,
          requiresStartupRegistration,
        },
      }),
    ),
  );

  return serializePatentRequestForClient(patentRequest.toObject());
};
