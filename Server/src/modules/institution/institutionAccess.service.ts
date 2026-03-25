import { randomBytes } from 'crypto';
import { z } from 'zod';
import { redis } from '../../config/redis';
import { UserRole } from '../../types/roles.types';
import { ApiError } from '../../utils/ApiError';
import { NotificationService } from '../notification/notification.service';
import { StudentVerificationReviewResult } from '../school/school.types';
import { User } from '../user/user.model';
import { StudentAccessToken } from './studentAccessToken.model';

const TOKEN_TTL_DAYS = 90;

export const createStudentAccessTokenSchema = z.object({
  label: z.string().trim().min(2).max(80).optional(),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
});

export const reviewStudentVerificationSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().max(300).optional(),
});

const assertInstitutionRole = async (
  institutionId: string,
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE,
) => {
  const institution = await User.findById(institutionId).select('_id role displayName').lean();

  if (!institution || institution.role !== institutionRole) {
    throw new ApiError(404, 'INSTITUTION_NOT_FOUND', 'Institution account not found');
  }

  return institution;
};

const invalidateInstitutionCaches = async (institutionId: string) => {
  await redis.del(
    `lb:${institutionId}`,
    `school:stats:${institutionId}`,
    `school:dashboard:${institutionId}`,
    `college:dashboard:${institutionId}`,
  );
};

const generateToken = async (
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE,
): Promise<string> => {
  const prefix = institutionRole === UserRole.SCHOOL ? 'SCH' : 'COL';

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const existing = await StudentAccessToken.exists({ token: candidate });
    if (!existing) {
      return candidate;
    }
  }

  throw new ApiError(500, 'TOKEN_GENERATION_FAILED', 'Unable to generate a unique student token');
};

export const resolveInstitutionToken = async (institutionToken: string) => {
  const normalized = institutionToken.trim().toUpperCase();
  const tokenDoc = await StudentAccessToken.findOne({
    token: normalized,
    isActive: true,
  }).lean();

  if (!tokenDoc) {
    throw new ApiError(
      400,
      'INVALID_INSTITUTION_TOKEN',
      'This institution token is invalid or inactive',
    );
  }

  if (tokenDoc.expiresAt && tokenDoc.expiresAt.getTime() < Date.now()) {
    throw new ApiError(
      400,
      'INSTITUTION_TOKEN_EXPIRED',
      'This institution token has expired. Please ask your school or college for a new one.',
    );
  }

  return tokenDoc;
};

export const registerTokenUsage = async (tokenId: string) => {
  await StudentAccessToken.findByIdAndUpdate(tokenId, { $inc: { usageCount: 1 } });
};

export const createStudentAccessToken = async (
  institutionId: string,
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE,
  createdBy: string,
  payload: z.infer<typeof createStudentAccessTokenSchema>,
) => {
  await assertInstitutionRole(institutionId, institutionRole);

  const token = await generateToken(institutionRole);
  const expiresInDays = payload.expiresInDays ?? TOKEN_TTL_DAYS;

  const created = await StudentAccessToken.create({
    institutionId,
    institutionRole,
    createdBy,
    ...(payload.label ? { label: payload.label } : {}),
    token,
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
  });

  return {
    _id: String(created._id),
    token: created.token,
    ...(created.label ? { label: created.label } : {}),
    isActive: created.isActive,
    usageCount: created.usageCount,
    ...(created.expiresAt ? { expiresAt: created.expiresAt } : {}),
    createdAt: created.createdAt,
  };
};

export const listStudentAccessTokens = async (
  institutionId: string,
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE,
) => {
  await assertInstitutionRole(institutionId, institutionRole);

  const tokens = await StudentAccessToken.find({ institutionId })
    .sort({ createdAt: -1 })
    .lean();

  return tokens.map((token) => ({
    _id: String(token._id),
    token: token.token,
    ...(token.label ? { label: token.label } : {}),
    isActive: token.isActive,
    usageCount: token.usageCount,
    ...(token.expiresAt ? { expiresAt: token.expiresAt } : {}),
    createdAt: token.createdAt,
  }));
};

export const listPendingStudentVerifications = async (
  institutionId: string,
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE,
) => {
  await assertInstitutionRole(institutionId, institutionRole);

  const students = await User.find({
    institutionId,
    role: UserRole.STUDENT,
    verificationStatus: 'pending',
  })
    .select(
      '_id displayName email domain bio verificationRequestedAt verificationRejectedReason createdAt',
    )
    .sort({ verificationRequestedAt: -1, createdAt: -1 })
    .lean();

  return students.map((student) => ({
    _id: String(student._id),
    displayName: student.displayName,
    email: student.email,
    ...(student.domain ? { domain: student.domain } : {}),
    ...(student.bio ? { bio: student.bio } : {}),
    ...(student.verificationRequestedAt
      ? { verificationRequestedAt: student.verificationRequestedAt }
      : {}),
    createdAt: student.createdAt,
  }));
};

export const reviewStudentVerification = async (
  institutionId: string,
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE,
  reviewerId: string,
  studentId: string,
  payload: z.infer<typeof reviewStudentVerificationSchema>,
): Promise<StudentVerificationReviewResult> => {
  await assertInstitutionRole(institutionId, institutionRole);

  const student = await User.findOne({
    _id: studentId,
    institutionId,
    role: UserRole.STUDENT,
  });

  if (!student) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found for this institution');
  }

  if (student.verificationStatus !== 'pending') {
    throw new ApiError(
      400,
      'VERIFICATION_ALREADY_REVIEWED',
      'This student verification request has already been reviewed',
    );
  }

  if (payload.decision === 'approved') {
    student.verificationStatus = 'verified';
    student.isActive = true;
    student.verifiedAt = new Date();
    student.verificationRejectedAt = undefined;
    student.verificationRejectedReason = undefined;
  } else {
    student.verificationStatus = 'rejected';
    student.isActive = false;
    student.verificationRejectedAt = new Date();
    student.verificationRejectedReason = payload.reason?.trim() || 'Institution verification failed';
  }

  await student.save();
  await invalidateInstitutionCaches(institutionId);

  const title =
    payload.decision === 'approved'
      ? 'Institution verification approved'
      : 'Institution verification needs attention';
  const body =
    payload.decision === 'approved'
      ? 'Your institution has approved your account. You can now sign in to ProMove.'
      : payload.reason?.trim() ||
        'Your institution could not verify your account. Please contact your school or college.';

  await NotificationService.create({
    userId: studentId,
    type: 'system',
    title,
    body,
    link: '/login',
  });

  return {
    _id: String(student._id),
    status: payload.decision === 'approved' ? 'verified' : 'rejected',
    reviewedBy: reviewerId,
    ...(student.verifiedAt ? { reviewedAt: student.verifiedAt } : {}),
    ...(student.verificationRejectedAt ? { reviewedAt: student.verificationRejectedAt } : {}),
    ...(student.verificationRejectedReason
      ? { reason: student.verificationRejectedReason }
      : {}),
  };
};
