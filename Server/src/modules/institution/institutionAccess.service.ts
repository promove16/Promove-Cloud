import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { redis } from '../../config/redis';
import { UserRole } from '../../types/roles.types';
import { ApiError } from '../../utils/ApiError';
import { sanitizePlainText } from '../../utils/sanitizeText';
import { NotificationService } from '../notification/notification.service';
import {
  createStudentRosterEntry,
  syncStudentRosterVerificationStatus,
  studentRosterEntrySchema,
  workbookRowsToPayloads,
} from './studentRoster.service';
import { StudentVerificationReviewResult } from '../school/school.types';
import { User } from '../user/user.model';
import { getProfileCompletionProgress } from '../user/profileCompletion';
import { StudentAccessToken } from './studentAccessToken.model';
import {
  queueInstitutionVerifiedEmail,
  queueProfileCompletionMilestoneEmail,
} from '../../services/retentionEmailService';

const TOKEN_TTL_DAYS = 90;
const MS_IN_YEAR = 365 * 24 * 60 * 60 * 1000;

export const createStudentAccessTokenSchema = z.object({
  label: z.string().trim().min(2).max(80).optional(),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
});

export const reviewStudentVerificationSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().max(300).optional(),
});

export const createManagedStudentCredentialsSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  domain: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(500).optional(),
  gradeOrProgram: z.string().trim().max(120).optional(),
  rollNumber: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(300).optional(),
});

const slugifyDisplayName = (displayName: string) => {
  const normalized = displayName
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'student';
};

const generateProfileSlug = async (displayName: string) => {
  const baseSlug = slugifyDisplayName(displayName);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = randomBytes(2).toString('hex');
    const candidate = `${baseSlug}-${suffix}`;
    const existing = await User.exists({ profileSlug: candidate });

    if (!existing) {
      return candidate;
    }
  }

  throw new ApiError(500, 'PROFILE_SLUG_GENERATION_FAILED', 'Unable to generate a unique profile URL');
};

const extractEmailDomain = (email: string) => email.trim().toLowerCase().split('@')[1] ?? '';

const generateTemporaryPassword = () => randomBytes(6).toString('base64url');

const assertInstitutionRole = async (
  institutionId: string,
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE,
) => {
  const institution = await User.findById(institutionId).select('_id role displayName email').lean();

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
    student.registrationStage = 'institution_verified';
    student.isActive = true;
    student.verifiedAt = new Date();
    student.institutionVerificationStatus = 'verified';
    student.institutionVerifiedAt = student.institutionVerifiedAt ?? student.verifiedAt;
    student.verificationRejectedAt = undefined;
    student.verificationRejectedReason = undefined;
  } else {
    student.verificationStatus = 'rejected';
    student.registrationStage = 'basic';
    student.isActive = false;
    student.verificationRejectedAt = new Date();
    student.verificationRejectedReason = payload.reason?.trim() || 'Institution verification failed';
  }

  await student.save();
  await invalidateInstitutionCaches(institutionId);
  await syncStudentRosterVerificationStatus(
    institutionId,
    student.email,
    String(student._id),
    payload.decision === 'approved' ? 'verified' : 'rejected',
  );

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

  if (payload.decision === 'approved') {
    await queueInstitutionVerifiedEmail(studentId, institutionId);
  }

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

export const createManagedStudentCredentials = async (
  institutionId: string,
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE,
  createdBy: string,
  payload: z.infer<typeof createManagedStudentCredentialsSchema>,
) => {
  const institution = await assertInstitutionRole(institutionId, institutionRole);
  const institutionDomain = extractEmailDomain(institution.email);
  const studentDomain = extractEmailDomain(payload.email);

  if (!institutionDomain || institutionDomain !== studentDomain) {
    throw new ApiError(
      400,
      'INSTITUTION_EMAIL_DOMAIN_REQUIRED',
      'Student email must use the same email domain as your institution account.',
    );
  }

  const existingUser = await User.findOne({ email: payload.email.toLowerCase() }).lean();
  if (existingUser) {
    throw new ApiError(409, 'DUPLICATE_KEY', 'Email already registered');
  }

  const sanitizedDisplayName = sanitizePlainText(payload.displayName);
  const sanitizedBio = payload.bio ? sanitizePlainText(payload.bio) : undefined;
  const sanitizedDomain = payload.domain ? sanitizePlainText(payload.domain) : undefined;
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  const profileSlug = await generateProfileSlug(sanitizedDisplayName);
  const verifiedAt = new Date();

  const createdStudent = await User.create({
    email: payload.email.toLowerCase(),
    passwordHash,
    role: UserRole.STUDENT,
    displayName: sanitizedDisplayName,
    profileSlug,
    ...(sanitizedDomain ? { domain: sanitizedDomain } : {}),
    ...(sanitizedBio ? { bio: sanitizedBio } : {}),
    profileComplete: Boolean(sanitizedDomain || sanitizedBio),
    registrationStage: 'institution_verified',
    accessGrantedBy: 'institution_admin',
    accessExpiresAt: new Date(Date.now() + MS_IN_YEAR),
    isActive: true,
    institutionToken: null,
    institutionId: institution._id,
    institutionVerifiedAt: verifiedAt,
    institutionVerificationStatus: 'verified',
    verificationStatus: 'verified',
    verificationRequestedAt: verifiedAt,
    verifiedAt,
    adminApprovalStatus: 'not_required',
    mustChangePasswordOnNextLogin: true,
  });

  await createStudentRosterEntry(institutionId, institutionRole, createdBy, {
    displayName: sanitizedDisplayName,
    email: payload.email,
    ...(payload.gradeOrProgram ? { gradeOrProgram: payload.gradeOrProgram } : {}),
    ...(payload.rollNumber ? { rollNumber: payload.rollNumber } : {}),
    ...(payload.notes ? { notes: payload.notes } : {}),
  });

  await invalidateInstitutionCaches(institutionId);

  await queueProfileCompletionMilestoneEmail(
    String(createdStudent._id),
    0,
    getProfileCompletionProgress(createdStudent.toObject()).percent,
  );

  await NotificationService.create({
    userId: String(createdStudent._id),
    type: 'system',
    title: 'Temporary credentials created',
    body: `Your ${institution.role} created a student account for you. Sign in and update your password after your first login.`,
    link: '/login',
  });

  return {
    student: {
      _id: String(createdStudent._id),
      displayName: createdStudent.displayName,
      email: createdStudent.email,
      profileSlug: createdStudent.profileSlug,
    },
    temporaryPassword,
    institutionDomain,
    createdAt: createdStudent.createdAt,
  };
};

export type BulkCredentialResult = {
  results: Array<{
    row: number;
    student: { _id: string; displayName: string; email: string };
    temporaryPassword: string;
  }>;
  errors: Array<{ row: number; email?: string; message: string }>;
};

export const bulkCreateManagedStudentCredentials = async (
  institutionId: string,
  institutionRole: UserRole.SCHOOL | UserRole.COLLEGE,
  createdBy: string,
  file: { originalname: string; buffer: Buffer },
): Promise<BulkCredentialResult> => {
  await assertInstitutionRole(institutionId, institutionRole);

  const rows = await workbookRowsToPayloads(file.buffer, file.originalname);

  if (rows.length === 0) {
    throw new ApiError(400, 'EMPTY_STUDENT_ROSTER_FILE', 'The uploaded file has no student rows.');
  }

  const results: BulkCredentialResult['results'] = [];
  const errors: BulkCredentialResult['errors'] = [];

  for (const row of rows) {
    try {
      const parsed = studentRosterEntrySchema.parse(row);
      const credential = await createManagedStudentCredentials(institutionId, institutionRole, createdBy, {
        displayName: parsed.displayName,
        email: parsed.email,
        ...(parsed.gradeOrProgram ? { gradeOrProgram: parsed.gradeOrProgram } : {}),
        ...(parsed.rollNumber ? { rollNumber: parsed.rollNumber } : {}),
        ...(parsed.notes ? { notes: parsed.notes } : {}),
      });

      results.push({
        row: row.__rowNumber,
        student: credential.student,
        temporaryPassword: credential.temporaryPassword,
      });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Unable to create credentials for this row';

      errors.push({
        row: row.__rowNumber,
        ...(row.email ? { email: String(row.email) } : {}),
        message,
      });
    }
  }

  return { results, errors };
};
