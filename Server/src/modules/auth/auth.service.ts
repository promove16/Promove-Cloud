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

const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const MS_IN_YEAR = 365 * 24 * 60 * 60 * 1000;

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: SanitizedUser;
}

interface RefreshPayload extends jwt.JwtPayload {
  _id: string;
  email: string;
  role: UserRole;
  tokenId: string;
  type: 'refresh';
}

const ACCESS_CODE_MAP: Record<string, AccessGrantedBy> = {
  STARTUPSCHOOL: 'startup_school',
  STARTUPSCHOOLACCESS: 'startup_school',
  STARTUP_SCHOOL: 'startup_school',
  INSTANTINTERNSHIP: 'instant_internship',
  INSTANT_INTERNSHIP: 'instant_internship',
  SKILLDEV: 'skill_dev',
  SKILL_DEV: 'skill_dev',
  III: 'iii',
  ADMIN: 'admin',
  ADMINACCESS: 'admin',
  ADMIN_ACCESS: 'admin',
};

const normalizeAccessCode = (value: string) => value.replace(/[^a-zA-Z]/g, '').toUpperCase();

const resolveAccessGrant = (accessCode: string): AccessGrantedBy => {
  const direct = ACCESS_CODE_MAP[accessCode.toUpperCase()];

  if (direct) {
    return direct;
  }

  const normalized = ACCESS_CODE_MAP[normalizeAccessCode(accessCode)];

  if (!normalized) {
    throw new ApiError(400, 'INVALID_ACCESS_CODE', 'Invalid access code');
  }

  return normalized;
};

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
  accessCode: string;
}): Promise<AuthResult> => {
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

  const accessGrantedBy = resolveAccessGrant(payload.accessCode);
  const passwordHash = await bcrypt.hash(payload.password, 12);

  const createdUser = await User.create({
    email: payload.email.toLowerCase(),
    passwordHash,
    role: payload.role,
    displayName: payload.displayName,
    accessGrantedBy,
    accessExpiresAt: new Date(Date.now() + MS_IN_YEAR),
  });

  const user = toSanitizedUser(createdUser.toObject());
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
