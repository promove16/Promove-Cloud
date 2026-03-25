import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { User } from '../user/user.model';
import { AccessGrantedBy, SanitizedUser } from '../user/user.types';
import { UserRole } from '../../types/roles.types';
import { ApiError } from '../../utils/ApiError';
import { toSanitizedUser } from '../user/user.service';
import {
  registerTokenUsage,
  resolveInstitutionToken,
} from '../institution/institutionAccess.service';

const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const MS_IN_YEAR = 365 * 24 * 60 * 60 * 1000;

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: SanitizedUser;
}

interface PendingStudentRegistrationResult {
  requiresVerification: true;
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

  return {
    accessToken,
    refreshToken,
  };
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
}): Promise<AuthResult | PendingStudentRegistrationResult> => {
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
  const institutionTokenValue = payload.institutionToken ?? payload.accessCode;
  const tokenRecord = isStudent
    ? await resolveInstitutionToken(institutionTokenValue ?? '')
    : undefined;
  const accessGrantedBy: AccessGrantedBy = isStudent ? 'institution_token' : 'self_registered';

  const createdUser = await User.create({
    email: payload.email.toLowerCase(),
    passwordHash,
    role: payload.role,
    displayName: payload.displayName,
    ...(payload.domain ? { domain: payload.domain } : {}),
    ...(payload.bio ? { bio: payload.bio } : {}),
    ...(payload.institutionProfile
      ? {
          institutionProfile: {
            institutionName: payload.institutionProfile.institutionName,
            location: payload.institutionProfile.location,
            totalStudentsEnrolled: payload.institutionProfile.totalStudentsEnrolled,
            academicYear: payload.institutionProfile.academicYear,
            iicStarRating: payload.institutionProfile.iicStarRating ?? 0,
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
    ...(tokenRecord ? { institutionId: tokenRecord.institutionId } : {}),
    profileComplete:
      payload.role === UserRole.SCHOOL || payload.role === UserRole.COLLEGE
        ? Boolean(payload.institutionProfile)
        : Boolean(payload.domain || payload.bio),
    accessGrantedBy,
    accessExpiresAt: new Date(Date.now() + MS_IN_YEAR),
    isActive: isStudent ? false : true,
    verificationStatus: isStudent ? 'pending' : 'not_required',
    ...(isStudent ? { verificationRequestedAt: new Date() } : {}),
  });

  if (tokenRecord) {
    await registerTokenUsage(String(tokenRecord._id));
  }

  const user = toSanitizedUser(createdUser.toObject());
  if (isStudent) {
    return {
      requiresVerification: true,
      message:
        'Your account has been created and is waiting for school or college approval before sign-in.',
      user,
    };
  }

  const tokens = await createTokenPair(user);

  return {
    ...tokens,
    user,
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

  if (!user.isActive) {
    if (user.role === UserRole.STUDENT && user.verificationStatus === 'pending') {
      throw new ApiError(
        403,
        'INSTITUTION_VERIFICATION_PENDING',
        'Your school or college still needs to verify your account before you can sign in.',
      );
    }

    if (user.role === UserRole.STUDENT && user.verificationStatus === 'rejected') {
      throw new ApiError(
        403,
        'INSTITUTION_VERIFICATION_REJECTED',
        user.verificationRejectedReason ||
          'Your institution could not verify your account. Please contact them for support.',
      );
    }

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
  } catch (_error) {
    return;
  }
};
