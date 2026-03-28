import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { randomBytes, randomUUID } from 'crypto';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { institutionVerifyQueue } from '../../config/bullmq';
import { User } from '../user/user.model';
import { AccessGrantedBy, SanitizedUser } from '../user/user.types';
import { UserRole } from '../../types/roles.types';
import { ApiError } from '../../utils/ApiError';
import { toSanitizedUser } from '../user/user.service';
import { sanitizePlainText } from '../../utils/sanitizeText';

const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const MS_IN_YEAR = 365 * 24 * 60 * 60 * 1000;

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: SanitizedUser;
}

interface RegisterResult extends AuthResult {
  nextStep: 'profile_setup';
  message: string;
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

const buildDefaultInstitutionProfile = (displayName: string) => ({
  institutionName: displayName,
  location: 'India',
  totalStudentsEnrolled: 0,
  academicYear: getAcademicYear(),
  iicStarRating: 0,
});

const signToken = (
  payload: Record<string, string>,
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

const createTokenPair = async (user: SanitizedUser) => {
  const tokenBase = {
    _id: user._id,
    email: user.email,
    role: user.role,
  };
  const refreshTokenId = randomUUID();

  const accessToken = signToken(tokenBase, env.JWT_ACCESS_SECRET, env.JWT_ACCESS_EXPIRES, 'access');
  const refreshToken = signToken(
    tokenBase,
    env.JWT_REFRESH_SECRET,
    env.JWT_REFRESH_EXPIRES,
    'refresh',
    refreshTokenId,
  );

  await redis.set(`refresh:${refreshTokenId}`, user._id, { ex: REFRESH_TTL_SECONDS });
  await redis.set(
    `session:${user._id}:${refreshTokenId}`,
    JSON.stringify({
      userId: user._id,
      role: user.role,
      issuedAt: new Date().toISOString(),
    }),
    { ex: REFRESH_TTL_SECONDS },
  );

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

const enqueueInstitutionVerification = async (userId: string, institutionToken: string) => {
  await institutionVerifyQueue.add(
    'verify',
    {
      userId,
      token: institutionToken,
    },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    },
  );
};

export const registerUser = async (payload: {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  institutionToken?: string;
  accessCode?: string;
  domain?: string;
  bio?: string;
  institutionProfile?: {
    institutionName: string;
    location: string;
    totalStudentsEnrolled: number;
    academicYear: string;
    iicStarRating?: number;
  };
}): Promise<RegisterResult> => {
  const activeUsers = await User.countDocuments({ isActive: true });

  if (activeUsers >= env.MAX_USERS_YEAR_ONE) {
    throw new ApiError(
      403,
      'CAPACITY_REACHED',
      'Platform is at capacity for Year 1. Please join the waitlist.',
    );
  }

  const existingUser = await User.findOne({ email: payload.email.toLowerCase() });

  if (existingUser) {
    throw new ApiError(409, 'DUPLICATE_KEY', 'Email already registered');
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);
  const isStudent = payload.role === UserRole.STUDENT;
  const institutionTokenValue = payload.institutionToken?.trim() || payload.accessCode?.trim() || undefined;
  const accessGrantedBy: AccessGrantedBy = isStudent ? 'admin' : 'self_registered';
  const fallbackDomain = payload.domain ?? payload.accessCode?.trim();
  const sanitizedDisplayName = sanitizePlainText(payload.displayName);
  const sanitizedBio = payload.bio ? sanitizePlainText(payload.bio) : undefined;
  const institutionProfile =
    payload.institutionProfile ??
    (payload.role === UserRole.SCHOOL || payload.role === UserRole.COLLEGE
      ? buildDefaultInstitutionProfile(sanitizedDisplayName)
      : undefined);
  const profileSlug =
    payload.role === UserRole.STUDENT ? await generateProfileSlug(sanitizedDisplayName) : null;
  const registrationStage =
    payload.role === UserRole.SCHOOL || payload.role === UserRole.COLLEGE
      ? 'complete'
      : isStudent && institutionTokenValue
        ? 'institution_pending'
        : 'basic';
  const institutionVerificationStatus =
    isStudent && institutionTokenValue ? 'pending' : 'none';
  const verificationStatus =
    isStudent && institutionTokenValue ? 'pending' : isStudent ? 'verified' : 'not_required';

  const createdUser = await User.create({
    email: payload.email.toLowerCase(),
    passwordHash,
    role: payload.role,
    displayName: sanitizedDisplayName,
    ...(profileSlug ? { profileSlug } : {}),
    ...(fallbackDomain ? { domain: sanitizePlainText(fallbackDomain) } : {}),
    ...(sanitizedBio ? { bio: sanitizedBio } : {}),
    ...(institutionProfile
      ? {
          institutionProfile: {
            institutionName: institutionProfile.institutionName,
            location: institutionProfile.location,
            totalStudentsEnrolled: institutionProfile.totalStudentsEnrolled,
            academicYear: institutionProfile.academicYear,
            iicStarRating: institutionProfile.iicStarRating ?? 0,
            policies: [],
            stats: {
              totalInnovationActivities: 0,
              patentsFiled: 0,
              totalMentoringHours: 0,
              startupsLaunched: 0,
              industryCollaborations: 0,
            },
          },
        }
      : {}),
    institutionToken: institutionTokenValue ?? null,
    profileComplete:
      payload.role === UserRole.SCHOOL || payload.role === UserRole.COLLEGE
        ? Boolean(institutionProfile)
        : Boolean(fallbackDomain || payload.bio),
    registrationStage,
    accessGrantedBy,
    accessExpiresAt: new Date(Date.now() + MS_IN_YEAR),
    isActive: true,
    institutionVerificationStatus,
    verificationStatus,
    ...(isStudent
      ? {
          verificationRequestedAt: institutionTokenValue ? new Date() : undefined,
          verifiedAt: new Date(),
        }
      : {}),
  });

  const user = toSanitizedUser(createdUser.toObject());
  const tokens = await createTokenPair(user);

  if (isStudent && institutionTokenValue) {
    await enqueueInstitutionVerification(user._id, institutionTokenValue);
  }

  return {
    ...tokens,
    user,
    nextStep: 'profile_setup',
    message: 'Account created! Complete your profile to unlock all features.',
  };
};

export const submitInstitutionToken = async (userId: string, institutionToken: string) => {
  const user = await User.findById(userId);

  if (!user || user.role !== UserRole.STUDENT) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'Student account not found');
  }

  if (user.institutionVerificationStatus === 'verified') {
    throw new ApiError(409, 'INSTITUTION_ALREADY_VERIFIED', 'Institution already verified');
  }

  user.institutionToken = institutionToken.trim().toUpperCase();
  user.institutionVerificationStatus = 'pending';
  user.verificationStatus = 'pending';
  user.registrationStage = 'institution_pending';
  user.verificationRequestedAt = new Date();
  user.verificationRejectedAt = undefined;
  user.verificationRejectedReason = undefined;
  await user.save();

  await enqueueInstitutionVerification(userId, user.institutionToken);

  return {
    message: 'Token submitted. Verification in progress.',
  };
};

export const loginUser = async (payload: {
  email: string;
  password: string;
  role: UserRole;
}): Promise<AuthResult> => {
  const user = await User.findOne({ email: payload.email.toLowerCase() }).select('+passwordHash');

  if (!user) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (user.role !== payload.role) {
    throw new ApiError(401, 'ROLE_MISMATCH', 'Selected role does not match your account.');
  }

  if (user.role === UserRole.STUDENT && user.verificationStatus === 'rejected') {
    throw new ApiError(
      403,
      'INSTITUTION_VERIFICATION_REJECTED',
      user.verificationRejectedReason ||
        'Your institution could not verify your account. Please contact them for support.',
    );
  }

  if (!user.isActive && user.role !== UserRole.STUDENT) {
    throw new ApiError(403, 'ACCESS_DISABLED', 'Your account is currently inactive');
  }

  const passwordMatches = await bcrypt.compare(payload.password, user.passwordHash);

  if (!passwordMatches) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  user.lastLogin = new Date();
  await user.save();

  const sanitizedUser = toSanitizedUser(user.toObject());
  const tokens = await createTokenPair(sanitizedUser);

  return {
    ...tokens,
    user: sanitizedUser,
  };
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

  const key = `refresh:${decoded.tokenId}`;
  const storedUserId = await redis.get<string>(key);

  if (!storedUserId || storedUserId !== decoded._id) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  await redis.del(key);
  await redis.del(`session:${decoded._id}:${decoded.tokenId}`);

  const user = await User.findById(decoded._id);

  if (!user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  if (!user.isActive) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const sanitizedUser = toSanitizedUser(user.toObject());
  const tokens = await createTokenPair(sanitizedUser);

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

    await redis.del(`refresh:${decoded.tokenId}`);
    await redis.del(`session:${decoded._id}:${decoded.tokenId}`);
  } catch (_error) {
    return;
  }
};
