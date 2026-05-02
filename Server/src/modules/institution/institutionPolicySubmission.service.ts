import { Types } from 'mongoose';
import { z } from 'zod';
import { NotificationService } from '../notification/notification.service';
import { UserRole } from '../../types/roles.types';
import { ApiError } from '../../utils/ApiError';
import { runMongoTransaction } from '../../utils/runMongoTransaction';
import { User } from '../user/user.model';
import type { InstitutionPolicy } from '../user/user.types';
import {
  InstitutionPolicySubmission,
  institutionPolicySubmissionStatus,
  type IInstitutionPolicySubmission,
} from './institutionPolicySubmission.model';

type InstitutionType = 'school' | 'college';
type SubmissionStatus = (typeof institutionPolicySubmissionStatus)[number];

interface SubmissionInstitutionUser {
  _id: Types.ObjectId;
  displayName: string;
  email: string;
  role: InstitutionType;
  institutionProfile?: {
    institutionName?: string;
    location?: string;
  };
}

interface SubmissionActorUser {
  _id: Types.ObjectId;
  displayName: string;
  email: string;
}

type SubmissionViewSource = Omit<IInstitutionPolicySubmission, 'institutionId' | 'submittedBy' | 'reviewedBy'> & {
  institutionId: Types.ObjectId | SubmissionInstitutionUser;
  submittedBy: Types.ObjectId | SubmissionActorUser;
  reviewedBy?: Types.ObjectId | SubmissionActorUser;
};

export interface InstitutionPolicySubmissionView {
  _id: string;
  institutionId: string;
  institutionType: InstitutionType;
  institution?: {
    _id: string;
    displayName: string;
    email: string;
    role: InstitutionType;
    institutionName?: string;
    location?: string;
  };
  policies: Array<{
    name: string;
    status: InstitutionPolicy['status'];
    lastUpdated?: string;
    evidence: Array<{
      title: string;
      type: InstitutionPolicy['evidence'][number]['type'];
      url: string;
      notes?: string;
      submittedAt?: string;
    }>;
  }>;
  summaryNote?: string;
  status: SubmissionStatus;
  submittedAt: string;
  submittedBy: string;
  submittedByUser?: {
    _id: string;
    displayName: string;
    email: string;
  };
  reviewedAt?: string;
  reviewedBy?: string;
  reviewedByUser?: {
    _id: string;
    displayName: string;
    email: string;
  };
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminInstitutionPolicySubmissionListResponse {
  items: InstitutionPolicySubmissionView[];
  total: number;
}

const dateStringToDate = (fieldName: string) =>
  z
    .union([z.string().trim().min(1).max(50), z.literal('')])
    .optional()
    .transform((value) => {
      if (!value) {
        return undefined;
      }

      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Invalid ${fieldName} value`);
      }

      return parsed;
    });

const submissionEvidenceSchema = z.object({
  title: z.string().trim().max(160).optional().or(z.literal('')),
  type: z.enum([
    'policy_document',
    'activity_report',
    'attendance_log',
    'photo',
    'video',
    'meeting_minutes',
    'certificate',
    'mou',
    'external_audit',
    'other',
  ]),
  url: z.string().trim().url().max(2048),
  notes: z.string().trim().max(600).optional(),
  submittedAt: dateStringToDate('submittedAt'),
});

const submissionPolicySchema = z.object({
  name: z.string().trim().min(2).max(160),
  status: z.enum(['Active', 'On Track', 'Pending', 'Inactive']),
  lastUpdated: dateStringToDate('lastUpdated'),
  evidence: z.array(submissionEvidenceSchema).min(1).max(10),
});

const hasSubmittedEvidence = (policy: unknown) => {
  if (!policy || typeof policy !== 'object' || !('evidence' in policy)) {
    return false;
  }

  const evidence = (policy as { evidence?: unknown }).evidence;
  if (!Array.isArray(evidence)) {
    return false;
  }

  return evidence.some(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof (item as { url?: unknown }).url === 'string' &&
      (item as { url: string }).url.trim().length > 0,
  );
};

const stripUnsubmittedPolicyRows = (payload: unknown) => {
  if (!payload || typeof payload !== 'object' || !('policies' in payload)) {
    return payload;
  }

  const policies = (payload as { policies?: unknown }).policies;
  if (!Array.isArray(policies)) {
    return payload;
  }

  return {
    ...payload,
    policies: policies.filter(hasSubmittedEvidence),
  };
};

export const submitInstitutionPolicySubmissionSchema = z
  .preprocess(stripUnsubmittedPolicyRows, z.object({
    policies: z.array(submissionPolicySchema).min(1).max(20),
    summaryNote: z.string().trim().max(1500).optional(),
  }))
  .superRefine((payload, ctx) => {
    const seen = new Set<string>();

    payload.policies.forEach((policy, index) => {
      const key = policy.name.trim().toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['policies', index, 'name'],
          message: 'Policy names must be unique within one submission.',
        });
      }
      seen.add(key);
    });
  });

export const listInstitutionPolicySubmissionsQuerySchema = z.object({
  status: z.enum(institutionPolicySubmissionStatus).default('pending'),
});

export const reviewInstitutionPolicySubmissionSchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    adminNotes: z.string().trim().max(1500).optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.decision === 'rejected' && (!payload.adminNotes || payload.adminNotes.length < 10)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['adminNotes'],
        message: 'Admin notes are required when rejecting a submission.',
      });
    }
  });

export const requestInstitutionPolicyEvidenceEditSchema = z.object({
  submissionId: z.string().trim().min(1),
  policyName: z.string().trim().min(2).max(160),
  evidenceTitle: z.string().trim().min(1).max(160),
  evidenceUrl: z.string().trim().url().max(2048),
});

const toSubmissionPolicy = (
  policies: Array<{
    name: string;
    status: InstitutionPolicy['status'];
    lastUpdated?: Date;
    evidence: Array<{
      title?: string;
      type: InstitutionPolicy['evidence'][number]['type'];
      url: string;
      notes?: string;
      submittedAt?: Date;
    }>;
  }>,
): InstitutionPolicy[] =>
  policies.map((policy) => ({
    name: policy.name,
    status: policy.status,
    ...(policy.lastUpdated ? { lastUpdated: policy.lastUpdated } : {}),
    evidence: policy.evidence.map((evidence) => ({
      title: evidence.title || evidence.type.replace(/_/g, ' '),
      type: evidence.type,
      url: evidence.url,
      ...(evidence.notes ? { notes: evidence.notes } : {}),
      submittedAt: evidence.submittedAt ?? new Date(),
    })),
  }));

const mergeApprovedPolicies = (
  currentPolicies: InstitutionPolicy[] = [],
  approvedPolicies: InstitutionPolicy[],
): InstitutionPolicy[] => {
  const approvedByName = new Map(
    approvedPolicies.map((policy) => [policy.name.trim().toLowerCase(), policy]),
  );
  const currentNames = new Set(currentPolicies.map((policy) => policy.name.trim().toLowerCase()));
  const mergedPolicies = currentPolicies.map((policy) => {
    const key = policy.name.trim().toLowerCase();
    return approvedByName.get(key) ?? policy;
  });
  const newPolicies = approvedPolicies.filter(
    (policy) => !currentNames.has(policy.name.trim().toLowerCase()),
  );

  return [...mergedPolicies, ...newPolicies];
};

const getEvidenceKey = (url: string) => url.trim().toLowerCase();

const hasNewEvidence = (
  currentPolicies: InstitutionPolicy[],
  incomingPolicies: InstitutionPolicy[],
) => {
  const existingEvidenceUrls = new Set(
    currentPolicies.flatMap((policy) =>
      policy.evidence.map((evidence) => getEvidenceKey(evidence.url)),
    ),
  );

  return incomingPolicies.some((policy) =>
    policy.evidence.some(
      (evidence) => !existingEvidenceUrls.has(getEvidenceKey(evidence.url)),
    ),
  );
};

const mergePendingSubmissionPolicies = (
  currentPolicies: InstitutionPolicy[],
  incomingPolicies: InstitutionPolicy[],
): InstitutionPolicy[] => {
  const incomingByName = new Map(
    incomingPolicies.map((policy) => [policy.name.trim().toLowerCase(), policy]),
  );
  const mergedNames = new Set<string>();

  const mergedExisting = currentPolicies.map((currentPolicy) => {
    const key = currentPolicy.name.trim().toLowerCase();
    mergedNames.add(key);
    const incomingPolicy = incomingByName.get(key);

    if (!incomingPolicy) {
      return currentPolicy;
    }

    const existingEvidenceUrls = new Set(
      currentPolicy.evidence.map((evidence) => getEvidenceKey(evidence.url)),
    );
    const newEvidence = incomingPolicy.evidence.filter(
      (evidence) => !existingEvidenceUrls.has(getEvidenceKey(evidence.url)),
    );

    return {
      ...incomingPolicy,
      evidence: [...currentPolicy.evidence, ...newEvidence],
    };
  });

  const newPolicies = incomingPolicies.filter(
    (policy) => !mergedNames.has(policy.name.trim().toLowerCase()),
  );

  return [...mergedExisting, ...newPolicies];
};

const toUserSummary = (value?: Types.ObjectId | SubmissionActorUser) => {
  if (!value || value instanceof Types.ObjectId) {
    return undefined;
  }

  return {
    _id: String(value._id),
    displayName: value.displayName,
    email: value.email,
  };
};

const toInstitutionSummary = (value: Types.ObjectId | SubmissionInstitutionUser) => {
  if (value instanceof Types.ObjectId) {
    return undefined;
  }

  return {
    _id: String(value._id),
    displayName: value.displayName,
    email: value.email,
    role: value.role,
    ...(value.institutionProfile?.institutionName
      ? { institutionName: value.institutionProfile.institutionName }
      : {}),
    ...(value.institutionProfile?.location ? { location: value.institutionProfile.location } : {}),
  };
};

const mapSubmission = (submission: SubmissionViewSource): InstitutionPolicySubmissionView => ({
  _id: String(submission._id),
  institutionId:
    submission.institutionId instanceof Types.ObjectId
      ? String(submission.institutionId)
      : String(submission.institutionId._id),
  institutionType: submission.institutionType,
  ...(toInstitutionSummary(submission.institutionId)
    ? { institution: toInstitutionSummary(submission.institutionId) }
    : {}),
  policies: (submission.policies ?? []).map((policy) => ({
    name: policy.name,
    status: policy.status,
    ...(policy.lastUpdated ? { lastUpdated: new Date(policy.lastUpdated).toISOString() } : {}),
    evidence: (policy.evidence ?? []).map((evidence) => ({
      title: evidence.title || evidence.type.replace(/_/g, ' '),
      type: evidence.type,
      url: evidence.url,
      ...(evidence.notes ? { notes: evidence.notes } : {}),
      ...(evidence.submittedAt ? { submittedAt: new Date(evidence.submittedAt).toISOString() } : {}),
    })),
  })),
  ...(submission.summaryNote ? { summaryNote: submission.summaryNote } : {}),
  status: submission.status,
  submittedAt: new Date(submission.submittedAt).toISOString(),
  submittedBy:
    submission.submittedBy instanceof Types.ObjectId
      ? String(submission.submittedBy)
      : String(submission.submittedBy._id),
  ...(toUserSummary(submission.submittedBy)
    ? { submittedByUser: toUserSummary(submission.submittedBy) }
    : {}),
  ...(submission.reviewedAt ? { reviewedAt: new Date(submission.reviewedAt).toISOString() } : {}),
  ...(submission.reviewedBy
    ? {
        reviewedBy:
          submission.reviewedBy instanceof Types.ObjectId
            ? String(submission.reviewedBy)
            : String(submission.reviewedBy._id),
      }
    : {}),
  ...(toUserSummary(submission.reviewedBy)
    ? { reviewedByUser: toUserSummary(submission.reviewedBy) }
    : {}),
  ...(submission.adminNotes ? { adminNotes: submission.adminNotes } : {}),
  createdAt: new Date(submission.createdAt).toISOString(),
  updatedAt: new Date(submission.updatedAt).toISOString(),
});

const ensureInstitution = async (institutionId: string, institutionType: InstitutionType) => {
  const institution = await User.findById(institutionId)
    .select('_id role displayName email institutionProfile')
    .lean<SubmissionInstitutionUser | null>();

  if (!institution || institution.role !== institutionType) {
    throw new ApiError(404, 'INSTITUTION_NOT_FOUND', 'Institution not found');
  }

  return institution;
};

const notifyAdminsOfSubmission = async (institutionId: string, institutionLabel: string) => {
  const admins = await User.find({ role: UserRole.ADMIN }).select('_id').lean<Array<{ _id: Types.ObjectId }>>();

  await Promise.allSettled(
    admins.map((admin) =>
      NotificationService.create({
        userId: String(admin._id),
        type: 'request',
        title: 'Compliance verification submitted',
        body: `${institutionLabel} submitted a policy verification packet for admin review.`,
        link: '/dashboard/admin/requests',
        metadata: { institutionId },
      }),
    ),
  );
};

const notifyInstitutionOfDecision = async (
  institutionId: string,
  institutionType: InstitutionType,
  decision: 'approved' | 'rejected',
  adminNotes?: string,
) => {
  await NotificationService.create({
    userId: institutionId,
    type: 'request',
    title:
      decision === 'approved'
        ? 'Compliance verification approved'
        : 'Compliance verification needs updates',
    body:
      decision === 'approved'
        ? 'Your institution policy verification packet has been approved.'
        : adminNotes || 'Your institution policy verification packet was rejected and needs updates.',
    link: `/dashboard/${institutionType}/compliance`,
  });
};

export const getLatestInstitutionPolicySubmission = async (
  institutionId: string,
  institutionType: InstitutionType,
) => {
  await ensureInstitution(institutionId, institutionType);

  const submission = await InstitutionPolicySubmission.findOne({ institutionId, institutionType })
    .sort({ updatedAt: -1 })
    .populate({ path: 'submittedBy', select: 'displayName email' })
    .populate({ path: 'reviewedBy', select: 'displayName email' })
    .lean<SubmissionViewSource | null>();

  return submission ? mapSubmission(submission) : null;
};

export const submitInstitutionPolicySubmission = async (
  institutionId: string,
  institutionType: InstitutionType,
  actorId: string,
  payload: unknown,
) => {
  const institution = await ensureInstitution(institutionId, institutionType);
  const parsed = submitInstitutionPolicySubmissionSchema.parse(payload);
  const mappedPolicies = toSubmissionPolicy(parsed.policies);
  const submittedAt = new Date();

  const existingPending = await InstitutionPolicySubmission.findOne({
    institutionId,
    institutionType,
    status: 'pending',
  });
  const policiesForSave = existingPending
    ? mergePendingSubmissionPolicies(existingPending.policies, mappedPolicies)
    : mappedPolicies;

  if (existingPending && !hasNewEvidence(existingPending.policies, mappedPolicies)) {
    throw new ApiError(
      409,
      'COMPLIANCE_SUBMISSION_NO_NEW_EVIDENCE',
      'This packet is already pending review. Upload new evidence or request edit access for submitted evidence.',
    );
  }

  const submission = existingPending
    ? await InstitutionPolicySubmission.findByIdAndUpdate(
        existingPending._id,
        {
          $set: {
            policies: policiesForSave,
            status: 'pending',
            submittedBy: new Types.ObjectId(actorId),
            submittedAt,
            ...(parsed.summaryNote ? { summaryNote: parsed.summaryNote } : {}),
          },
          $unset: {
            ...(parsed.summaryNote ? {} : { summaryNote: 1 }),
            reviewedBy: 1,
            reviewedAt: 1,
            adminNotes: 1,
          },
        },
        { new: true },
      )
    : await InstitutionPolicySubmission.create({
        institutionId,
        institutionType,
        policies: policiesForSave,
        ...(parsed.summaryNote ? { summaryNote: parsed.summaryNote } : {}),
        status: 'pending',
        submittedBy: new Types.ObjectId(actorId),
        submittedAt,
      });

  if (!submission) {
    throw new ApiError(500, 'COMPLIANCE_SUBMISSION_FAILED', 'Unable to save the compliance submission');
  }

  await notifyAdminsOfSubmission(
    institutionId,
    institution.institutionProfile?.institutionName || institution.displayName,
  );

  const hydratedSubmission = await InstitutionPolicySubmission.findById(submission._id)
    .populate({ path: 'submittedBy', select: 'displayName email' })
    .lean<SubmissionViewSource | null>();

  if (!hydratedSubmission) {
    throw new ApiError(500, 'COMPLIANCE_SUBMISSION_FAILED', 'Unable to load the saved submission');
  }

  return mapSubmission(hydratedSubmission);
};

export const requestInstitutionPolicyEvidenceEdit = async (
  institutionId: string,
  institutionType: InstitutionType,
  actorId: string,
  payload: unknown,
) => {
  const institution = await ensureInstitution(institutionId, institutionType);
  const parsed = requestInstitutionPolicyEvidenceEditSchema.parse(payload);
  const submission = await InstitutionPolicySubmission.findOne({
    _id: parsed.submissionId,
    institutionId,
    institutionType,
    status: 'pending',
  }).lean<SubmissionViewSource | null>();

  if (!submission) {
    throw new ApiError(
      404,
      'COMPLIANCE_SUBMISSION_NOT_FOUND',
      'Pending compliance submission not found.',
    );
  }

  const submittedEvidence = submission.policies
    .find((policy) => policy.name.trim().toLowerCase() === parsed.policyName.trim().toLowerCase())
    ?.evidence.find((evidence) => getEvidenceKey(evidence.url) === getEvidenceKey(parsed.evidenceUrl));

  if (!submittedEvidence) {
    throw new ApiError(
      404,
      'COMPLIANCE_EVIDENCE_NOT_FOUND',
      'Submitted evidence was not found on this pending packet.',
    );
  }

  // Update submission status to edit_requested
  await InstitutionPolicySubmission.updateOne(
    { _id: parsed.submissionId },
    { $set: { status: 'edit_requested' } },
  );

  const admins = await User.find({ role: UserRole.ADMIN }).select('_id').lean<Array<{ _id: Types.ObjectId }>>();
  const institutionLabel = institution.institutionProfile?.institutionName || institution.displayName;
  const requestedAt = new Date();

  await Promise.allSettled(
    admins.map((admin) =>
      NotificationService.create({
        userId: String(admin._id),
        type: 'request',
        title: 'Compliance evidence edit requested',
        body: `${institutionLabel} requested edit access for "${parsed.evidenceTitle}" in ${parsed.policyName}.`,
        link: '/dashboard/admin/requests',
        metadata: {
          submissionId: parsed.submissionId,
          institutionId,
          actorId,
          policyName: parsed.policyName,
          evidenceTitle: parsed.evidenceTitle,
          evidenceUrl: parsed.evidenceUrl,
        },
      }),
    ),
  );

  return {
    requestedAt: requestedAt.toISOString(),
    submissionId: parsed.submissionId,
  };
};

export const listAdminInstitutionPolicySubmissions = async (
  query: unknown,
): Promise<AdminInstitutionPolicySubmissionListResponse> => {
  const parsed = listInstitutionPolicySubmissionsQuerySchema.parse(query ?? {});

  const [items, total] = await Promise.all([
    InstitutionPolicySubmission.find({ status: parsed.status })
      .sort({ submittedAt: -1 })
      .populate({
        path: 'institutionId',
        select: 'displayName email role institutionProfile',
      })
      .populate({ path: 'submittedBy', select: 'displayName email' })
      .populate({ path: 'reviewedBy', select: 'displayName email' })
      .lean<SubmissionViewSource[]>(),
    InstitutionPolicySubmission.countDocuments({ status: parsed.status }),
  ]);

  return {
    items: items.map(mapSubmission),
    total,
  };
};

export const reviewInstitutionPolicySubmission = async (
  submissionId: string,
  adminId: string,
  payload: unknown,
) => {
  const parsed = reviewInstitutionPolicySubmissionSchema.parse(payload);

  const reviewed = await runMongoTransaction(async (session) => {
    const submission = await InstitutionPolicySubmission.findById(submissionId).session(session);

    if (!submission) {
      throw new ApiError(404, 'COMPLIANCE_SUBMISSION_NOT_FOUND', 'Compliance submission not found');
    }

    if (submission.status !== 'pending') {
      throw new ApiError(
        409,
        'COMPLIANCE_SUBMISSION_ALREADY_REVIEWED',
        'This compliance submission has already been reviewed',
      );
    }

    const reviewedAt = new Date();

    if (parsed.decision === 'approved') {
      const institution = await User.findOne({ _id: submission.institutionId, role: submission.institutionType })
        .select('institutionProfile.policies')
        .session(session)
        .lean<{ institutionProfile?: { policies?: InstitutionPolicy[] } } | null>();

      if (!institution) {
        throw new ApiError(404, 'INSTITUTION_NOT_FOUND', 'Institution not found');
      }

      await User.updateOne(
        { _id: submission.institutionId, role: submission.institutionType },
        {
          $set: {
            'institutionProfile.policies': mergeApprovedPolicies(
              institution.institutionProfile?.policies ?? [],
              submission.policies,
            ),
          },
        },
        { session },
      );
    }

    submission.status = parsed.decision;
    submission.reviewedBy = new Types.ObjectId(adminId);
    submission.reviewedAt = reviewedAt;
    submission.adminNotes = parsed.adminNotes;
    await submission.save({ session });

    return submission._id;
  });

  const populated = await InstitutionPolicySubmission.findById(reviewed)
    .populate({
      path: 'institutionId',
      select: 'displayName email role institutionProfile',
    })
    .populate({ path: 'submittedBy', select: 'displayName email' })
    .populate({ path: 'reviewedBy', select: 'displayName email' })
    .lean<SubmissionViewSource | null>();

  if (!populated) {
    throw new ApiError(500, 'COMPLIANCE_SUBMISSION_REVIEW_FAILED', 'Unable to load the reviewed submission');
  }

  await notifyInstitutionOfDecision(
    populated.institutionId instanceof Types.ObjectId
      ? String(populated.institutionId)
      : String(populated.institutionId._id),
    populated.institutionType,
    parsed.decision,
    parsed.adminNotes,
  );

  return mapSubmission(populated);
};
