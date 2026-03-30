import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { randomBytes, randomUUID } from 'crypto';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { User, UserDocument } from '../user/user.model';
import { AccessGrantedBy, ConnectedAccountProvider, SanitizedUser } from '../user/user.types';
import { UserRole } from '../../types/roles.types';
import { ApiError } from '../../utils/ApiError';
import { toSanitizedUser } from '../user/user.service';
import { sanitizePlainText } from '../../utils/sanitizeText';
import {
  registerTokenUsage,
  resolveInstitutionToken,
} from '../institution/institutionAccess.service';
import {
  findInstitutionRosterMatchByEmail,
  markStudentRosterEntryRegistered,
} from '../institution/studentRoster.service';

const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const OAUTH_STATE_TTL_SECONDS = 10 * 60;
const MS_IN_YEAR = 365 * 24 * 60 * 60 * 1000;

export type OAuthProvider = Extract<ConnectedAccountProvider, 'google' | 'linkedin'>;

interface OAuthStatePayload {
  provider: OAuthProvider;
}

interface OAuthUserProfile {
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string;
  avatar?: string;
  username?: string | null;
}

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

const getOAuthStateKey = (state: string) => `oauth:state:${state}`;

const getOAuthProviderDisplayName = (provider: OAuthProvider) =>
  provider === 'google' ? 'Google' : 'LinkedIn';

const getOAuthProviderConfig = (provider: OAuthProvider) => {
  if (provider === 'google') {
    return {
      clientId: env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
      scopes: ['openid', 'email', 'profile'],
      extraAuthorizeParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    };
  }

  return {
    clientId: env.LINKEDIN_OAUTH_CLIENT_ID,
    clientSecret: env.LINKEDIN_OAUTH_CLIENT_SECRET,
    authorizationEndpoint: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenEndpoint: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoEndpoint: 'https://api.linkedin.com/v2/userinfo',
    scopes: ['openid', 'profile', 'email'],
    extraAuthorizeParams: {},
  };
};

const assertOAuthProviderConfigured = (provider: OAuthProvider) => {
  const config = getOAuthProviderConfig(provider);

  if (!config.clientId || !config.clientSecret) {
    throw new ApiError(
      503,
      `${provider.toUpperCase()}_OAUTH_NOT_CONFIGURED`,
      `${getOAuthProviderDisplayName(provider)} sign-in is not configured yet.`,
    );
  }

  return {
    ...config,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  };
};

export const buildFrontendOAuthRedirectUrl = (
  provider: OAuthProvider,
  status: 'success' | 'error',
  params?: {
    code?: string;
    message?: string;
  },
) => {
  const callbackUrl = new URL('/auth/callback', env.CLIENT_URL);
  callbackUrl.searchParams.set('provider', provider);
  callbackUrl.searchParams.set('status', status);

  if (params?.code) {
    callbackUrl.searchParams.set('code', params.code);
  }

  if (params?.message) {
    callbackUrl.searchParams.set('message', params.message);
  }

  return callbackUrl.toString();
};

const buildOAuthCallbackUrl = (requestOrigin: string, provider: OAuthProvider) => {
  if (provider === 'google' && env.GOOGLE_OAUTH_REDIRECT_URI) {
    return env.GOOGLE_OAUTH_REDIRECT_URI;
  }

  if (provider === 'linkedin' && env.LINKEDIN_OAUTH_REDIRECT_URI) {
    return env.LINKEDIN_OAUTH_REDIRECT_URI;
  }

  return `${requestOrigin}/api/auth/oauth/${provider}/callback`;
};

export const createOAuthAuthorizationUrl = async (
  provider: OAuthProvider,
  requestOrigin: string,
) => {
  const config = assertOAuthProviderConfigured(provider);
  const state = randomUUID();
  const redirectUri = buildOAuthCallbackUrl(requestOrigin, provider);
  const statePayload: OAuthStatePayload = { provider };

  await redis.set(getOAuthStateKey(state), JSON.stringify(statePayload), {
    ex: OAUTH_STATE_TTL_SECONDS,
  });

  const authorizationUrl = new URL(config.authorizationEndpoint);
  authorizationUrl.searchParams.set('client_id', config.clientId);
  authorizationUrl.searchParams.set('redirect_uri', redirectUri);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', config.scopes.join(' '));
  authorizationUrl.searchParams.set('state', state);

  Object.entries(config.extraAuthorizeParams).forEach(([key, value]) => {
    authorizationUrl.searchParams.set(key, value);
  });

  return authorizationUrl.toString();
};

type OAuthTokenResponse = {
  access_token?: string;
  id_token?: string;
};

const exchangeOAuthCode = async (
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
): Promise<OAuthTokenResponse> => {
  const config = assertOAuthProviderConfigured(provider);
  const response = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }).toString(),
  });

  if (!response.ok) {
    throw new ApiError(
      502,
      `${provider.toUpperCase()}_TOKEN_EXCHANGE_FAILED`,
      `Unable to complete ${getOAuthProviderDisplayName(provider)} sign-in right now.`,
    );
  }

  const payload = (await response.json()) as OAuthTokenResponse;

  if (!payload.access_token) {
    throw new ApiError(
      502,
      `${provider.toUpperCase()}_TOKEN_EXCHANGE_FAILED`,
      `Unable to complete ${getOAuthProviderDisplayName(provider)} sign-in right now.`,
    );
  }

  return payload;
};

type GoogleUserInfoResponse = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

type LinkedInUserInfoResponse = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

const fetchOAuthUserProfile = async (
  provider: OAuthProvider,
  accessToken: string,
): Promise<OAuthUserProfile> => {
  const config = assertOAuthProviderConfigured(provider);
  const response = await fetch(config.userInfoEndpoint, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new ApiError(
      502,
      `${provider.toUpperCase()}_USERINFO_FAILED`,
      `Unable to read your ${getOAuthProviderDisplayName(provider)} profile right now.`,
    );
  }

  if (provider === 'google') {
    const profile = (await response.json()) as GoogleUserInfoResponse;

    return {
      providerUserId: profile.sub,
      email: profile.email?.toLowerCase() ?? null,
      emailVerified: profile.email_verified === true,
      displayName: profile.name?.trim() || profile.email?.trim() || 'Google User',
      ...(profile.picture ? { avatar: profile.picture } : {}),
      ...(profile.email ? { username: profile.email.toLowerCase() } : {}),
    };
  }

  const profile = (await response.json()) as LinkedInUserInfoResponse;
  const displayName =
    profile.name?.trim() ||
    [profile.given_name, profile.family_name].filter(Boolean).join(' ').trim() ||
    profile.email?.trim() ||
    'LinkedIn User';

  return {
    providerUserId: profile.sub,
    email: profile.email?.toLowerCase() ?? null,
    emailVerified: profile.email_verified === true,
    displayName,
    ...(profile.picture ? { avatar: profile.picture } : {}),
    ...(profile.email ? { username: profile.email.toLowerCase() } : {}),
  };
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

const issueAuthResultForUser = async (user: UserDocument): Promise<AuthResult> => {
  user.lastLogin = new Date();
  await user.save();

  const sanitizedUser = toSanitizedUser(user.toObject());
  const tokens = await createTokenPair(sanitizedUser);

  return {
    ...tokens,
    user: sanitizedUser,
  };
};

const resolveOAuthUser = async (provider: OAuthProvider, profile: OAuthUserProfile) => {
  const linkedUser = await User.findOne({
    [`connectedAccounts.${provider}.userId`]: profile.providerUserId,
  });

  if (linkedUser) {
    return linkedUser;
  }

  if (!profile.email || !profile.emailVerified) {
    throw new ApiError(
      403,
      'OAUTH_EMAIL_NOT_VERIFIED',
      `${getOAuthProviderDisplayName(provider)} did not return a verified email address for this account.`,
    );
  }

  const emailMatchedUser = await User.findOne({ email: profile.email });

  if (!emailMatchedUser) {
    throw new ApiError(
      404,
      'OAUTH_ACCOUNT_NOT_REGISTERED',
      'No ProMove account exists for this email yet. Please complete registration first.',
    );
  }

  return emailMatchedUser;
};

const syncOAuthAccount = async (
  user: UserDocument,
  provider: OAuthProvider,
  profile: OAuthUserProfile,
) => {
  const existingLinkedUser = await User.findOne({
    [`connectedAccounts.${provider}.userId`]: profile.providerUserId,
    _id: { $ne: user._id },
  })
    .select('_id')
    .lean();

  if (existingLinkedUser) {
    throw new ApiError(
      409,
      'OAUTH_ACCOUNT_ALREADY_LINKED',
      `This ${getOAuthProviderDisplayName(provider)} account is already linked to another ProMove user.`,
    );
  }

  const currentAccount = user.connectedAccounts[provider];

  if (currentAccount.userId && currentAccount.userId !== profile.providerUserId) {
    throw new ApiError(
      409,
      'OAUTH_PROVIDER_MISMATCH',
      `This ProMove account is already linked to a different ${getOAuthProviderDisplayName(provider)} identity.`,
    );
  }

  user.connectedAccounts[provider] = {
    ...currentAccount,
    userId: profile.providerUserId,
    username: profile.username ?? profile.email ?? currentAccount.username ?? null,
    accessToken: null,
    connectedAt: currentAccount.connectedAt ?? new Date(),
    lastSyncedAt: new Date(),
  };

  if (!user.avatar && profile.avatar) {
    user.avatar = profile.avatar;
  }
};

export const registerUser = async (payload: {
  email: string;
  password: string;
  displayName: string;
  role: UserRole.STUDENT;
  institutionToken?: string;
  domain?: string;
  bio?: string;
}): Promise<RegisterResult | PendingRegisterResult> => {
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
  const sanitizedDisplayName = sanitizePlainText(payload.displayName);
  const sanitizedBio = payload.bio ? sanitizePlainText(payload.bio) : undefined;
  const profileSlug = await generateProfileSlug(sanitizedDisplayName);
  const profileComplete = Boolean(payload.domain || payload.bio);

  // ── No institution token → basic self-registration ────────────────
  if (!payload.institutionToken) {
    const createdUser = await User.create({
      email: payload.email.toLowerCase(),
      passwordHash,
      role: UserRole.STUDENT,
      displayName: sanitizedDisplayName,
      ...(profileSlug ? { profileSlug } : {}),
      ...(payload.domain ? { domain: sanitizePlainText(payload.domain) } : {}),
      ...(sanitizedBio ? { bio: sanitizedBio } : {}),
      institutionToken: null,
      institutionId: null,
      profileComplete,
      registrationStage: 'basic',
      accessGrantedBy: 'self_registered',
      accessExpiresAt: new Date(Date.now() + MS_IN_YEAR),
      isActive: true,
      institutionVerificationStatus: 'none',
      verificationStatus: 'not_required',
      adminApprovalStatus: 'not_required',
    });

    const user = toSanitizedUser(createdUser.toObject());
    const tokens = await createTokenPair(user);

    return {
      ...tokens,
      user,
      nextStep: 'profile_setup',
      message: 'Registration successful. Complete your profile to get started.',
    };
  }

  // ── With institution token → existing flow ────────────────────────
  const institutionTokenValue = payload.institutionToken.trim().toUpperCase();
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
    registrationStage: 'institution_pending',
    accessGrantedBy,
    accessExpiresAt: new Date(Date.now() + MS_IN_YEAR),
    isActive: false,
    institutionVerificationStatus: 'verified',
    verificationStatus: 'pending',
    adminApprovalStatus: 'not_required',
    verificationRequestedAt: verificationTimestamp,
    institutionVerifiedAt: verificationTimestamp,
  });

  const user = toSanitizedUser(createdUser.toObject());

  if (studentInstitutionContext) {
    await registerTokenUsage(String(studentInstitutionContext.tokenRecord._id));
  }

  if (matchedRoster) {
    await markStudentRosterEntryRegistered(String(matchedRoster.institutionId), payload.email, user._id);
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
  };
}): Promise<PendingRegisterResult> => {
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

  const passwordHash = await bcrypt.hash(payload.password, 12);
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
      ? Boolean(institutionProfile)
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

  await user.save();

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

  if (user.institutionVerificationStatus === 'verified') {
    throw new ApiError(409, 'INSTITUTION_ALREADY_VERIFIED', 'Institution already verified');
  }

  const normalizedToken = institutionToken.trim().toUpperCase();
  const { tokenRecord, institution } = await resolveStudentInstitutionContext(normalizedToken);

  user.institutionToken = normalizedToken;
  user.institutionId = institution._id;
  user.institutionVerificationStatus = 'verified';
  user.institutionVerifiedAt = new Date();
  user.verificationStatus = 'pending';
  user.registrationStage = 'institution_pending';
  user.verificationRequestedAt = new Date();
  user.verificationRejectedAt = undefined;
  user.verificationRejectedReason = undefined;
  user.accessGrantedBy = 'institution_token';
  await user.save();

  await registerTokenUsage(String(tokenRecord._id));

  return {
    message: 'Token submitted successfully. Your institution can now review your account.',
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

  user.passwordHash = await bcrypt.hash(newPassword, 12);
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

  const passwordMatches = await bcrypt.compare(payload.password, user.passwordHash);

  if (!passwordMatches) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (payload.role && user.role !== payload.role) {
    throw new ApiError(403, 'ROLE_MISMATCH', `This account is registered as ${user.role}, not ${payload.role}`);
  }

  assertUserCanAuthenticate(user);

  return issueAuthResultForUser(user);
};

export const loginWithOAuth = async (payload: {
  provider: OAuthProvider;
  code: string;
  state: string;
  requestOrigin: string;
}): Promise<AuthResult> => {
  const stateKey = getOAuthStateKey(payload.state);
  const rawState = await redis.get<string>(stateKey);

  if (!rawState) {
    throw new ApiError(400, 'INVALID_OAUTH_STATE', 'This sign-in session has expired. Please try again.');
  }

  await redis.del(stateKey);

  let statePayload: OAuthStatePayload;

  try {
    statePayload = JSON.parse(rawState) as OAuthStatePayload;
  } catch (_error) {
    throw new ApiError(400, 'INVALID_OAUTH_STATE', 'This sign-in session has expired. Please try again.');
  }

  if (statePayload.provider !== payload.provider) {
    throw new ApiError(400, 'INVALID_OAUTH_STATE', 'This sign-in session has expired. Please try again.');
  }

  const redirectUri = buildOAuthCallbackUrl(payload.requestOrigin, payload.provider);
  const tokenResponse = await exchangeOAuthCode(payload.provider, payload.code, redirectUri);
  const profile = await fetchOAuthUserProfile(payload.provider, tokenResponse.access_token!);
  const user = await resolveOAuthUser(payload.provider, profile);

  await syncOAuthAccount(user, payload.provider, profile);
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
