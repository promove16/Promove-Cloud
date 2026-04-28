import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { randomBytes, randomUUID } from 'crypto';
import { env } from '../../config/env';
import { redis } from '../../config/redis';
import {
  getServiceUnavailableDetails,
  shouldFailOpenForService,
} from '../../config/serviceAvailability';
import { User, UserDocument } from '../user/user.model';
import { AccessGrantedBy, SanitizedUser } from '../user/user.types';
import { UserRole } from '../../types/roles.types';
import { ApiError } from '../../utils/ApiError';
import { logError } from '../../config/logger';
import { syncInstitutionEducationForUser, toSanitizedUser } from '../user/user.service';
import { getProfileCompletionProgress } from '../user/profileCompletion';
import { sanitizePlainText } from '../../utils/sanitizeText';
import { recordLoginActivity } from '../analytics/activity.service';
import {
  queueProfileCompletionMilestoneEmail,
  queueWelcomeEmail,
} from '../../services/retentionEmailService';
import { applyScore } from '../../services/scoreEngine';
import {
  registerTokenUsage,
  resolveInstitutionToken,
} from '../institution/institutionAccess.service';
import {
  buildInstitutionVerificationProfile,
  cleanupInstitutionVerificationDocuments,
} from '../institution/institutionVerification.service';
import {
  findInstitutionRosterMatchByEmail,
  syncStudentRosterVerificationStatus,
} from '../institution/studentRoster.service';

const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const MS_IN_YEAR = 365 * 24 * 60 * 60 * 1000;
const refreshSessionKey = (tokenId: string) => `refresh:${tokenId}`;
const userSessionKey = (userId: string, tokenId: string) => `session:${userId}:${tokenId}`;
const userSessionIndexKey = (userId: string) => `session-index:${userId}`;

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: SanitizedUser;
}

interface RegisterResult extends AuthResult {
  nextStep: 'profile_setup';
  message: string;
}

interface PendingRegisterResult {
  pendingApproval: true;
  approvalType: 'institution' | 'admin';
  message: string;
  user: SanitizedUser;
}

interface RefreshPayload extends jwt.JwtPayload {
  _id: string;
  email: string;
  role: UserRole;
  tokenId: string;
  type: 'refresh';
}

const getAcademicYear = () => {
  const today = new Date();
  const startYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
};

const buildDefaultInstitutionProfile = (displayName: string): {
  institutionName: string;
  location: string;
  totalStudentsEnrolled: number;
  academicYear: string;
  iicStarRating: number;
  organizationType?: string;
  foundedYear?: number;
  specialties: string[];
  locations: string[];
  alumniCount?: number;
  employeeCount?: number;
  contactEmail?: string;
  contactPhone?: string;
} => ({
  institutionName: displayName,
  location: 'India',
  totalStudentsEnrolled: 0,
  academicYear: getAcademicYear(),
  iicStarRating: 0,
  specialties: [],
  locations: [],
});

type TokenBasePayload = {
  _id: string;
  email: string;
  role: string;
  // Tenant context — null for users that don't belong to a single institution.
  institutionId: string | null;
};

const signToken = (
  payload: TokenBasePayload,
  secret: string,
  expiresIn: string,
  tokenType: 'access' | 'refresh',
  tokenId?: string,
) => {
  const options: SignOptions = {
    algorithm: 'RS256',
    expiresIn: expiresIn as SignOptions['expiresIn'],
    subject: payload._id,
  };

  if (tokenId) {
    options.jwtid = tokenId;
  }

  return jwt.sign(
    tokenId ? { ...payload, tokenId, type: tokenType } : { ...payload, type: tokenType },
    secret,
    options,
  );
};

const createAuthSessionStoreError = () =>
  new ApiError(
    503,
    'AUTH_SESSION_STORE_UNAVAILABLE',
    'Authentication session store is temporarily unavailable. Please try again.',
    getServiceUnavailableDetails(
      'auth_session_store',
      'Authentication session store is temporarily unavailable. Login can continue only when fallback is enabled.',
    ),
  );

const shouldAllowRedisAuthFallback = () =>
  env.AUTH_ALLOW_REDIS_AUTH_FALLBACK || shouldFailOpenForService('auth_session_store');

interface CreateTokenPairOptions {
  persistSession?: boolean;
}

const persistRefreshSession = async (
  refreshTokenId: string,
  user: SanitizedUser,
) => {
  await Promise.all([
    redis.set(refreshSessionKey(refreshTokenId), user._id, { ex: REFRESH_TTL_SECONDS }),
    redis.set(
      userSessionKey(user._id, refreshTokenId),
      JSON.stringify({
        userId: user._id,
        role: user.role,
        institutionId: user.institutionId ?? null,
        issuedAt: new Date().toISOString(),
      }),
      { ex: REFRESH_TTL_SECONDS },
    ),
    redis.sadd(userSessionIndexKey(user._id), refreshTokenId),
    redis.expire(userSessionIndexKey(user._id), REFRESH_TTL_SECONDS),
  ]);
};

const deleteRefreshSession = async (userId: string, refreshTokenId: string) => {
  await Promise.all([
    redis.del(refreshSessionKey(refreshTokenId)),
    redis.del(userSessionKey(userId, refreshTokenId)),
    redis.srem(userSessionIndexKey(userId), refreshTokenId),
  ]);
};

// Resolve the tenant boundary for a user. Schools/colleges are themselves
// the institution, so they own their own tenant. Students belong to the
// institution that issued their token. Other roles operate cross-tenant.
const resolveTenantInstitutionId = (user: SanitizedUser): string | null => {
  if (user.role === UserRole.SCHOOL || user.role === UserRole.COLLEGE) {
    return user._id;
  }

  if (user.role === UserRole.STUDENT) {
    return user.institutionId ?? null;
  }

  return null;
};

const createTokenPair = async (
  user: SanitizedUser,
  options: CreateTokenPairOptions = {},
) => {
  const tokenBase: TokenBasePayload = {
    _id: user._id,
    email: user.email,
    role: user.role,
    institutionId: resolveTenantInstitutionId(user),
  };
  const refreshTokenId = randomUUID();
  const shouldPersistSession = options.persistSession ?? true;

  const accessToken = signToken(tokenBase, env.JWT_ACCESS_SECRET, env.JWT_ACCESS_EXPIRES, 'access');
  const refreshToken = signToken(
    tokenBase,
    env.JWT_REFRESH_SECRET,
    env.JWT_REFRESH_EXPIRES,
    'refresh',
    refreshTokenId,
  );

  if (shouldPersistSession) {
    try {
      await persistRefreshSession(refreshTokenId, user);
    } catch (error) {
      logError('Failed to persist refresh session in Redis', error);

      if (!shouldAllowRedisAuthFallback()) {
        throw createAuthSessionStoreError();
      }
    }
  }

  return {
    accessToken,
    refreshToken,
  };
};

const slugifyDisplayName = (displayName: string) => {
  const normalized = displayName
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'user';
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

const resolveStudentInstitutionContext = async (institutionToken: string) => {
  const tokenRecord = await resolveInstitutionToken(institutionToken);
  const institution = await User.findOne({
    _id: tokenRecord.institutionId,
    role: { $in: [UserRole.SCHOOL, UserRole.COLLEGE] },
    isActive: true,
  })
    .select('_id role displayName')
    .lean();

  if (!institution) {
    throw new ApiError(
      400,
      'INVALID_INSTITUTION_TOKEN',
      'This institution token is invalid or inactive',
    );
  }

  return {
    tokenRecord,
    institution,
  };
};

const normalizeEducationInstitutionName = (value: string) =>
  sanitizePlainText(value).toLowerCase();

const preserveInstitutionEducationHistory = (
  user: UserDocument,
  nextInstitutionName: string,
) => {
  const currentInstitutionEducation = (user.education ?? []).find(
    (entry) => entry.source === 'institution',
  );

  if (!currentInstitutionEducation) {
    return;
  }

  const currentInstitutionName = normalizeEducationInstitutionName(
    currentInstitutionEducation.institution,
  );
  const nextNormalizedInstitutionName = normalizeEducationInstitutionName(nextInstitutionName);

  if (
    !currentInstitutionName ||
    currentInstitutionName === nextNormalizedInstitutionName
  ) {
    return;
  }

  const hasHistoricalCopy = (user.education ?? []).some(
    (entry) =>
      entry.source !== 'institution' &&
      normalizeEducationInstitutionName(entry.institution) === currentInstitutionName,
  );

  if (hasHistoricalCopy) {
    return;
  }

  const currentYear = new Date().getFullYear();
  const preservedEntry = {
    _id: currentInstitutionEducation._id,
    institution: currentInstitutionEducation.institution,
    degree: currentInstitutionEducation.degree,
    fieldOfStudy: currentInstitutionEducation.fieldOfStudy,
    ...(currentInstitutionEducation.startYear
      ? { startYear: currentInstitutionEducation.startYear }
      : {}),
    endYear: currentInstitutionEducation.endYear ?? currentYear,
    isCurrent: false,
    grade: currentInstitutionEducation.grade,
    activities: currentInstitutionEducation.activities,
    description: currentInstitutionEducation.description,
    source: 'manual' as const,
  };

  user.education = (user.education ?? []).map((entry) =>
    entry === currentInstitutionEducation ? preservedEntry : entry,
  ) as UserDocument['education'];
};

const assertUserCanAuthenticate = (user: UserDocument) => {
  if (user.role === UserRole.STUDENT && user.verificationStatus === 'rejected') {
    throw new ApiError(
      403,
      'INSTITUTION_VERIFICATION_REJECTED',
      user.verificationRejectedReason ||
        'Your institution could not verify your account. Please contact them for support.',
    );
  }

  if (user.role === UserRole.STUDENT && user.verificationStatus === 'pending') {
    throw new ApiError(
      403,
      'INSTITUTION_APPROVAL_PENDING',
      'Your institution has not approved your account yet. Please contact your school or college.',
    );
  }

  if (user.role !== UserRole.STUDENT && user.adminApprovalStatus === 'rejected') {
    throw new ApiError(
      403,
      'ADMIN_APPROVAL_REJECTED',
      user.adminApprovalRejectedReason ||
        'Your registration request was rejected by the admin team. Please contact support.',
    );
  }

  if (user.role !== UserRole.STUDENT && user.adminApprovalStatus === 'pending') {
    throw new ApiError(
      403,
      'ADMIN_APPROVAL_PENDING',
      'Your registration request is waiting for admin approval. Please try again after approval.',
    );
  }

  if (!user.isActive && user.role !== UserRole.STUDENT) {
    throw new ApiError(403, 'ACCESS_DISABLED', 'Your account is currently inactive');
  }
};

const comparePasswordWithHash = async (
  password: string,
  passwordHash: string | null | undefined,
) => {
  if (!passwordHash) {
    return false;
  }

  try {
    return await bcrypt.compare(password, passwordHash);
  } catch (error) {
    logError('Failed to compare stored password hash', error);
    return false;
  }
};

const getLegacyPasswordHash = async (userId: UserDocument['_id']) => {
  const legacyUser = await User.collection.findOne(
    { _id: userId },
    { projection: { password: 1 } },
  );

  return typeof legacyUser?.password === 'string' && legacyUser.password.length > 0
    ? legacyUser.password
    : null;
};

const upgradeLegacyPasswordHash = async (
  user: UserDocument,
  legacyPasswordHash: string,
) => {
  await User.collection.updateOne(
    { _id: user._id },
    {
      $set: { passwordHash: legacyPasswordHash },
      $unset: { password: '' },
    },
  );

  user.passwordHash = legacyPasswordHash;
};

const verifyLoginPassword = async (user: UserDocument, password: string) => {
  const currentPasswordHash =
    typeof user.passwordHash === 'string' && user.passwordHash.length > 0
      ? user.passwordHash
      : undefined;

  if (await comparePasswordWithHash(password, currentPasswordHash)) {
    return true;
  }

  const legacyPasswordHash = await getLegacyPasswordHash(user._id);

  if (!(await comparePasswordWithHash(password, legacyPasswordHash))) {
    return false;
  }

  await upgradeLegacyPasswordHash(user, legacyPasswordHash!);
  return true;
};

const issueAuthResultForUser = async (user: UserDocument): Promise<AuthResult> => {
  user.lastLogin = new Date();
  await user.save();

  try {
    await recordLoginActivity(String(user._id));
  } catch (error) {
    logError('Failed to record login activity', error);
  }

  const sanitizedUser = toSanitizedUser(user.toObject());
  const tokens = await createTokenPair(sanitizedUser);

  return {
    ...tokens,
    user: sanitizedUser,
  };
};

const applyVerifiedInstitutionAccessToStudent = async (
  user: UserDocument,
  input: {
    institutionId: string;
    institutionToken: string;
    accessGrantedBy: AccessGrantedBy;
    verificationTimestamp?: Date;
  },
) => {
  const verificationTimestamp = input.verificationTimestamp ?? new Date();

  user.institutionId = input.institutionId as unknown as UserDocument['institutionId'];
  user.institutionToken = input.institutionToken;
  user.institutionVerificationStatus = 'verified';
  user.institutionVerifiedAt = verificationTimestamp;
  user.verificationStatus = 'verified';
  user.registrationStage = 'institution_verified';
  user.verificationRequestedAt = verificationTimestamp;
  user.verifiedAt = verificationTimestamp;
  user.verificationRejectedAt = undefined;
  user.verificationRejectedReason = undefined;
  user.accessGrantedBy = input.accessGrantedBy;
  user.isActive = true;

  await syncInstitutionEducationForUser(user);
  await user.save();

  return verificationTimestamp;
};

export const registerUser = async (payload: {
  email: string;
  password: string;
  displayName: string;
  role: UserRole.STUDENT;
  institutionToken: string;
  domain?: string;
  bio?: string;
}): Promise<RegisterResult | PendingRegisterResult> => {
  const existingUser = await User.findOne({ email: payload.email.toLowerCase() });

  if (existingUser) {
    throw new ApiError(409, 'DUPLICATE_KEY', 'Email already registered');
  }

  const institutionTokenInput = (payload.institutionToken ?? '').trim();

  if (!institutionTokenInput) {
    throw new ApiError(
      400,
      'INSTITUTION_TOKEN_REQUIRED',
      'Student registration requires a school or college invitation token.',
    );
  }

  const passwordHash = await bcrypt.hash(payload.password, env.BCRYPT_ROUNDS);
  const sanitizedDisplayName = sanitizePlainText(payload.displayName);
  const sanitizedBio = payload.bio ? sanitizePlainText(payload.bio) : undefined;
  const profileSlug = await generateProfileSlug(sanitizedDisplayName);
  const profileComplete = Boolean(payload.domain || payload.bio);
  const institutionTokenValue = institutionTokenInput.toUpperCase();
  const studentInstitutionContext = await resolveStudentInstitutionContext(institutionTokenValue);
  const matchedRoster = await findInstitutionRosterMatchByEmail(payload.email);

  if (
    matchedRoster &&
    String(matchedRoster.institutionId) !== String(studentInstitutionContext.institution._id)
  ) {
    throw new ApiError(
      409,
      'INSTITUTION_TOKEN_MISMATCH',
      'This email belongs to a different institution roster. Please use the correct institution token.',
    );
  }

  const accessGrantedBy: AccessGrantedBy = matchedRoster ? 'institution_roster' : 'institution_token';
  const verificationTimestamp = new Date();
  const shouldAutoVerifyFromRoster = Boolean(matchedRoster);

  const createdUser = await User.create({
    email: payload.email.toLowerCase(),
    passwordHash,
    role: UserRole.STUDENT,
    displayName: sanitizedDisplayName,
    ...(profileSlug ? { profileSlug } : {}),
    ...(payload.domain ? { domain: sanitizePlainText(payload.domain) } : {}),
    ...(sanitizedBio ? { bio: sanitizedBio } : {}),
    institutionToken: institutionTokenValue,
    institutionId: studentInstitutionContext.institution._id,
    profileComplete,
    registrationStage: shouldAutoVerifyFromRoster ? 'institution_verified' : 'institution_pending',
    accessGrantedBy,
    accessExpiresAt: new Date(Date.now() + MS_IN_YEAR),
    isActive: shouldAutoVerifyFromRoster,
    institutionVerificationStatus: 'verified',
    verificationStatus: shouldAutoVerifyFromRoster ? 'verified' : 'pending',
    adminApprovalStatus: 'not_required',
    verificationRequestedAt: verificationTimestamp,
    institutionVerifiedAt: verificationTimestamp,
    ...(shouldAutoVerifyFromRoster ? { verifiedAt: verificationTimestamp } : {}),
  });

  await syncInstitutionEducationForUser(createdUser);

  if (profileComplete) {
    const newScore = await applyScore({
      userId: String(createdUser._id),
      trigger: 'PROFILE_COMPLETE',
      metadata: { source: 'register' },
    });
    createdUser.innovationScore = newScore;
  }

  await createdUser.save();

  const user = toSanitizedUser(createdUser.toObject());

  if (studentInstitutionContext) {
    await registerTokenUsage(String(studentInstitutionContext.tokenRecord._id));
  }

  if (matchedRoster) {
    await syncStudentRosterVerificationStatus(
      String(matchedRoster.institutionId),
      payload.email,
      user._id,
      'verified',
    );
  }

  await queueWelcomeEmail(String(createdUser._id));
  await queueProfileCompletionMilestoneEmail(
    String(createdUser._id),
    0,
    getProfileCompletionProgress(createdUser.toObject()).percent,
  );

  if (shouldAutoVerifyFromRoster) {
    const authResult = await issueAuthResultForUser(createdUser);

    return {
      ...authResult,
      nextStep: 'profile_setup',
      message: 'Your institution invite was matched and your student dashboard is ready.',
    };
  }

  return {
    pendingApproval: true,
    approvalType: 'institution',
    user,
    message:
      'Your institution token was verified. Your account is now waiting for school or college approval.',
  };
};

export const submitRegistrationRequest = async (payload: {
  email: string;
  password: string;
  displayName: string;
  role: Exclude<UserRole, UserRole.STUDENT>;
  domain?: string;
  bio?: string;
  institutionProfile?: {
    institutionName: string;
    location: string;
    totalStudentsEnrolled: number;
    academicYear: string;
    iicStarRating?: number;
    organizationType?: string;
    foundedYear?: number;
    specialties?: string[];
    locations?: string[];
    alumniCount?: number;
    employeeCount?: number;
    contactEmail?: string;
    contactPhone?: string;
  };
  institutionVerification?: {
    regulatoryBodies: Array<
      | 'AICTE'
      | 'UGC'
      | 'NAAC'
      | 'NBA'
      | 'CBSE'
      | 'ICSE'
      | 'STATE_BOARD'
      | 'STATE_EDUCATION_DEPARTMENT'
      | 'UDISE'
    >;
    affiliationName?: string;
    websiteUrl?: string;
    referenceCode?: string;
    notes?: string;
  };
}, files: Express.Multer.File[] = []): Promise<PendingRegisterResult> => {
  const normalizedEmail = payload.email.toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

  if (existingUser) {
    if (existingUser.isActive || existingUser.adminApprovalStatus === 'approved') {
      throw new ApiError(409, 'DUPLICATE_KEY', 'Email already registered');
    }

    if (existingUser.adminApprovalStatus === 'pending') {
      throw new ApiError(
        409,
        'ADMIN_APPROVAL_PENDING',
        'Your registration request is already waiting for admin approval.',
      );
    }

    if (existingUser.role !== payload.role) {
      throw new ApiError(
        409,
        'ROLE_MISMATCH',
        'This email already has a registration request for a different role.',
      );
    }
  }

  if (
    payload.role !== UserRole.SCHOOL &&
    payload.role !== UserRole.COLLEGE &&
    files.length > 0
  ) {
    throw new ApiError(
      400,
      'UNEXPECTED_INSTITUTION_DOCUMENTS',
      'Institution document uploads are only supported for school and college requests.',
    );
  }

  const passwordHash = await bcrypt.hash(payload.password, env.BCRYPT_ROUNDS);
  const sanitizedDisplayName = sanitizePlainText(payload.displayName);
  const sanitizedBio = payload.bio ? sanitizePlainText(payload.bio) : undefined;
  const sanitizedDomain = payload.domain ? sanitizePlainText(payload.domain) : undefined;
  const institutionProfile =
    payload.institutionProfile ??
    (payload.role === UserRole.SCHOOL || payload.role === UserRole.COLLEGE
      ? buildDefaultInstitutionProfile(sanitizedDisplayName)
      : undefined);
  const approvalTimestamp = new Date();

  const user =
    existingUser ??
    new User({
      email: normalizedEmail,
      passwordHash,
      role: payload.role,
      displayName: sanitizedDisplayName,
      accessGrantedBy: 'admin',
      accessExpiresAt: new Date(Date.now() + MS_IN_YEAR),
    });

  user.passwordHash = passwordHash;
  user.role = payload.role;
  user.displayName = sanitizedDisplayName;
  user.domain = sanitizedDomain;
  user.bio = sanitizedBio;
  user.profileComplete =
    payload.role === UserRole.SCHOOL || payload.role === UserRole.COLLEGE
      ? false
      : Boolean(sanitizedDomain || sanitizedBio);
  user.registrationStage =
    payload.role === UserRole.SCHOOL || payload.role === UserRole.COLLEGE ? 'complete' : 'basic';
  user.accessGrantedBy = 'admin';
  user.accessExpiresAt = new Date(Date.now() + MS_IN_YEAR);
  user.isActive = false;
  user.institutionToken = null;
  user.institutionId = null;
  user.institutionVerificationStatus = 'none';
  user.verificationStatus = 'not_required';
  user.adminApprovalStatus = 'pending';
  user.adminApprovalRequestedAt = approvalTimestamp;
  user.adminApprovedAt = undefined;
  user.adminApprovedBy = null;
  user.adminApprovalRejectedAt = undefined;
  user.adminApprovalRejectedReason = undefined;
  user.verificationRequestedAt = undefined;
  user.verifiedAt = undefined;
  user.verificationRejectedAt = undefined;
  user.verificationRejectedReason = undefined;
  user.institutionVerifiedAt = null;
  user.profileSlug = undefined;

  if (institutionProfile) {
    user.institutionProfile = {
      institutionName: institutionProfile.institutionName,
      location: institutionProfile.location,
      totalStudentsEnrolled: institutionProfile.totalStudentsEnrolled,
      academicYear: institutionProfile.academicYear,
      iicStarRating: institutionProfile.iicStarRating ?? 0,
      ...(institutionProfile.organizationType
        ? { organizationType: institutionProfile.organizationType }
        : {}),
      ...(institutionProfile.foundedYear ? { foundedYear: institutionProfile.foundedYear } : {}),
      specialties: institutionProfile.specialties ?? [],
      locations: institutionProfile.locations ?? [],
      ...(typeof institutionProfile.alumniCount === 'number'
        ? { alumniCount: institutionProfile.alumniCount }
        : {}),
      ...(typeof institutionProfile.employeeCount === 'number'
        ? { employeeCount: institutionProfile.employeeCount }
        : {}),
      ...(institutionProfile.contactEmail ? { contactEmail: institutionProfile.contactEmail } : {}),
      ...(institutionProfile.contactPhone ? { contactPhone: institutionProfile.contactPhone } : {}),
      policies: [],
      stats: {
        totalInnovationActivities: 0,
        patentsFiled: 0,
        totalMentoringHours: 0,
        startupsLaunched: 0,
        industryCollaborations: 0,
      },
    };
  } else {
    user.institutionProfile = undefined;
  }

  const previousInstitutionDocuments = existingUser?.institutionVerification?.documents ?? [];
  if (payload.role === UserRole.SCHOOL || payload.role === UserRole.COLLEGE) {
    user.institutionVerification = await buildInstitutionVerificationProfile({
      role: payload.role,
      userId: String(user._id),
      verificationInput: payload.institutionVerification,
      files,
    });
    user.profileComplete =
      Boolean(institutionProfile) && user.institutionVerification.readiness.isReadyForReview;
  } else {
    user.institutionVerification = undefined;
  }

  await user.save();
  if (existingUser && previousInstitutionDocuments.length > 0) {
    await cleanupInstitutionVerificationDocuments(previousInstitutionDocuments);
  }

  await queueWelcomeEmail(String(user._id));
  await queueProfileCompletionMilestoneEmail(
    String(user._id),
    0,
    getProfileCompletionProgress(user.toObject()).percent,
  );

  return {
    pendingApproval: true,
    approvalType: 'admin',
    user: toSanitizedUser(user.toObject()),
    message:
      'Your registration form has been submitted to the admin team. You can sign in after approval.',
  };
};

export const submitInstitutionToken = async (userId: string, institutionToken: string) => {
  const user = await User.findById(userId);

  if (!user || user.role !== UserRole.STUDENT) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'Student account not found');
  }

  const normalizedToken = institutionToken.trim().toUpperCase();
  const { tokenRecord, institution } = await resolveStudentInstitutionContext(normalizedToken);
  const isSameInstitution =
    Boolean(user.institutionId) && String(user.institutionId) === String(institution._id);
  user.institutionToken = normalizedToken;

  if (isSameInstitution && user.verificationStatus === 'verified') {
    user.institutionVerificationStatus = 'verified';
    user.institutionVerifiedAt = user.institutionVerifiedAt ?? new Date();
    await syncInstitutionEducationForUser(user);
    await user.save();

    await registerTokenUsage(String(tokenRecord._id));

    return {
      message:
        'Institution token updated. Your institution-managed education remains locked and synced.',
      user: toSanitizedUser(user.toObject()),
    };
  }

  const matchedRoster = await findInstitutionRosterMatchByEmail(user.email);

  if (matchedRoster && String(matchedRoster.institutionId) !== String(institution._id)) {
    throw new ApiError(
      409,
      'INSTITUTION_TOKEN_MISMATCH',
      'This email belongs to a different institution roster. Please use the correct institution token.',
    );
  }

  if (!isSameInstitution) {
    preserveInstitutionEducationHistory(user, institution.displayName);
  }

  const verificationRequestedAt = new Date();
  const shouldAutoVerifyFromRoster = Boolean(matchedRoster);

  if (shouldAutoVerifyFromRoster) {
    await applyVerifiedInstitutionAccessToStudent(user, {
      institutionId: String(institution._id),
      institutionToken: normalizedToken,
      accessGrantedBy: 'institution_roster',
      verificationTimestamp: verificationRequestedAt,
    });
  } else {
    user.institutionId = institution._id;
    user.institutionVerificationStatus = 'verified';
    user.institutionVerifiedAt = verificationRequestedAt;
    user.verificationStatus = 'pending';
    user.registrationStage = 'institution_pending';
    user.verificationRequestedAt = verificationRequestedAt;
    user.verifiedAt = undefined;
    user.verificationRejectedAt = undefined;
    user.verificationRejectedReason = undefined;
    user.accessGrantedBy = 'institution_token';
    await syncInstitutionEducationForUser(user);
    await user.save();
  }

  await registerTokenUsage(String(tokenRecord._id));
  // shouldAutoVerifyFromRoster === Boolean(matchedRoster), so when a roster
  // entry exists we always auto-verify and sync to 'verified' immediately.
  if (matchedRoster) {
    await syncStudentRosterVerificationStatus(
      String(matchedRoster.institutionId),
      user.email,
      String(user._id),
      'verified',
    );
  }

  if (shouldAutoVerifyFromRoster) {
    return {
      message:
        'Institution token saved. Your roster invite was verified and you now have direct student access.',
      user: toSanitizedUser(user.toObject()),
    };
  }

  return {
    message:
      'Institution token saved. Your institution can now review your account, and approved education will stay synced.',
    user: toSanitizedUser(user.toObject()),
  };
};

export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  const user = await User.findById(userId).select('+passwordHash');

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!passwordMatches) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect');
  }

  user.passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  user.mustChangePasswordOnNextLogin = false;
  await user.save();
};

export const loginUser = async (payload: {
  email: string;
  password: string;
  role?: UserRole;
}): Promise<AuthResult> => {
  const user = await User.findOne({ email: payload.email.toLowerCase() }).select('+passwordHash');

  if (!user) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const passwordMatches = await verifyLoginPassword(user, payload.password);

  if (!passwordMatches) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (payload.role && user.role !== payload.role) {
    throw new ApiError(403, 'ROLE_MISMATCH', `This account is registered as ${user.role}, not ${payload.role}`);
  }

  assertUserCanAuthenticate(user);

  return issueAuthResultForUser(user);
};

export const refreshUserToken = async (refreshToken: string | undefined): Promise<AuthResult> => {
  if (!refreshToken) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  let decoded: RefreshPayload;

  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET, {
      algorithms: ['RS256'],
    }) as RefreshPayload;
  } catch (_error) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const key = refreshSessionKey(decoded.tokenId);
  let storedUserId: string | null;
  let shouldUseRedisSessionStore = true;

  try {
    storedUserId = await redis.get<string>(key);
  } catch (error) {
    logError('Failed to read refresh session from Redis', error);

    if (!shouldAllowRedisAuthFallback()) {
      throw createAuthSessionStoreError();
    }

    storedUserId = decoded._id;
    shouldUseRedisSessionStore = false;
  }

  if (!storedUserId || storedUserId !== decoded._id) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  if (shouldUseRedisSessionStore) {
    try {
      await deleteRefreshSession(decoded._id, decoded.tokenId);
    } catch (error) {
      logError('Failed to rotate refresh session in Redis', error);

      if (!shouldAllowRedisAuthFallback()) {
        throw createAuthSessionStoreError();
      }

      shouldUseRedisSessionStore = false;
    }
  }

  const user = await User.findById(decoded._id);

  if (!user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  if (!user.isActive) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const sanitizedUser = toSanitizedUser(user.toObject());
  const tokens = await createTokenPair(sanitizedUser, {
    persistSession: shouldUseRedisSessionStore,
  });

  return {
    ...tokens,
    user: sanitizedUser,
  };
};

export const logoutUser = async (refreshToken: string | undefined) => {
  if (!refreshToken) {
    return;
  }

  try {
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET, {
      algorithms: ['RS256'],
    }) as RefreshPayload;

    await deleteRefreshSession(decoded._id, decoded.tokenId);
  } catch (_error) {
    return;
  }
};
