const crypto = require('crypto');
const ROLES = require('../../constants/roles');
const ApiError = require('../../utils/ApiError');
const emailService = require('../../utils/emailService');
const {
  generateAccessToken,
  generateRefreshTokenData,
  hashToken,
} = require('../../utils/tokenUtils');
const User = require('../../models/User');
const StudentProfile = require('../../models/StudentProfile');
const SchoolProfile = require('../../models/SchoolProfile');
const CollegeProfile = require('../../models/CollegeProfile');
const InvestorProfile = require('../../models/InvestorProfile');
const MentorProfile = require('../../models/MentorProfile');
const HrProfile = require('../../models/HrProfile');
const RefreshToken = require('../../models/RefreshToken');
const ActionToken = require('../../models/ActionToken');

const PROFILE_MODEL_MAP = {
  [ROLES.STUDENT]: StudentProfile,
  [ROLES.SCHOOL]: SchoolProfile,
  [ROLES.COLLEGE]: CollegeProfile,
  [ROLES.INVESTOR]: InvestorProfile,
  [ROLES.MENTOR]: MentorProfile,
  [ROLES.HR]: HrProfile,
  [ROLES.SUPERADMIN]: StudentProfile,
};

function buildUserPayload(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
  };
}

async function registerUser(name, email, password, role) {
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw ApiError.conflict('Email already registered');
  }

  const user = new User({ name, email, password, role });
  await user.save();

  const ProfileModel = PROFILE_MODEL_MAP[role];
  if (ProfileModel) {
    await ProfileModel.create({ userId: user._id });
  }

  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationTokenHash = hashToken(verificationToken);

  await ActionToken.deleteMany({ userId: user._id, purpose: 'email_verify' });
  await ActionToken.create({
    userId: user._id,
    tokenHash: verificationTokenHash,
    purpose: 'email_verify',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  await emailService.sendVerificationEmail(email, name, verificationToken);

  return { message: 'Registration successful. Please verify your email.' };
}

async function verifyEmail(token) {
  const verificationRecord = await ActionToken.findOne({
    tokenHash: hashToken(token),
    purpose: 'email_verify',
  });

  if (!verificationRecord || verificationRecord.expiresAt < new Date()) {
    throw ApiError.badRequest('Verification link is invalid or expired');
  }

  const user = await User.findById(verificationRecord.userId);
  if (!user) {
    throw ApiError.badRequest('Verification link is invalid or expired');
  }

  user.isVerified = true;
  await user.save();
  await ActionToken.deleteOne({ _id: verificationRecord._id });

  return { message: 'Email verified successfully. You may now log in.' };
}

async function loginUser(email, password) {
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const passwordMatches = await user.comparePassword(password);
  if (!passwordMatches) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (!user.isVerified) {
    throw ApiError.forbidden('Please verify your email before logging in');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Your account has been suspended');
  }

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
    email: user.email,
  });
  const refreshTokenData = generateRefreshTokenData();

  await RefreshToken.create({
    userId: user._id,
    tokenHash: refreshTokenData.hash,
    family: refreshTokenData.family,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  user.lastLogin = new Date();
  await user.save();

  return {
    accessToken,
    refreshTokenRaw: refreshTokenData.raw,
    user: buildUserPayload(user),
  };
}

async function refreshTokens(rawToken) {
  if (!rawToken) {
    throw ApiError.unauthorized('No refresh token');
  }

  const tokenHash = hashToken(rawToken);
  const storedToken = await RefreshToken.findOne({ tokenHash });

  if (!storedToken) {
    throw ApiError.unauthorized('Invalid refresh token');
  }

  if (storedToken.isRevoked) {
    await RefreshToken.updateMany({ family: storedToken.family }, { isRevoked: true });
    throw ApiError.unauthorized('Token reuse detected. All sessions revoked.');
  }

  if (storedToken.expiresAt < new Date()) {
    throw ApiError.unauthorized('Refresh token expired');
  }

  storedToken.isRevoked = true;
  await storedToken.save();

  const user = await User.findById(storedToken.userId);
  if (!user) {
    throw ApiError.unauthorized('Invalid refresh token');
  }

  const nextRefreshToken = generateRefreshTokenData();
  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
    email: user.email,
  });

  await RefreshToken.create({
    userId: user._id,
    tokenHash: nextRefreshToken.hash,
    family: storedToken.family,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return {
    accessToken,
    refreshTokenRaw: nextRefreshToken.raw,
    user: buildUserPayload(user),
  };
}

async function logoutUser(rawToken) {
  if (!rawToken) {
    return;
  }

  const tokenHash = hashToken(rawToken);
  await RefreshToken.findOneAndUpdate({ tokenHash }, { isRevoked: true });
}

async function forgotPassword(email) {
  const user = await User.findOne({ email });

  if (user) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = hashToken(resetToken);

    await ActionToken.deleteMany({ userId: user._id, purpose: 'password_reset' });
    await ActionToken.create({
      userId: user._id,
      tokenHash: resetTokenHash,
      purpose: 'password_reset',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await emailService.sendPasswordResetEmail(email, user.name, resetToken);
  }

  return { message: 'If that email is registered, a reset link has been sent.' };
}

async function resetPassword(token, newPassword) {
  const resetRecord = await ActionToken.findOne({
    tokenHash: hashToken(token),
    purpose: 'password_reset',
  });

  if (!resetRecord || resetRecord.expiresAt < new Date()) {
    throw ApiError.badRequest('Reset link is invalid or expired');
  }

  const user = await User.findById(resetRecord.userId).select('+password');
  if (!user) {
    throw ApiError.badRequest('Reset link is invalid or expired');
  }

  user.password = newPassword;
  await user.save();
  await RefreshToken.updateMany({ userId: user._id }, { isRevoked: true });
  await ActionToken.deleteOne({ _id: resetRecord._id });

  return { message: 'Password reset successful. Please log in.' };
}

module.exports = {
  PROFILE_MODEL_MAP,
  registerUser,
  verifyEmail,
  loginUser,
  refreshTokens,
  logoutUser,
  forgotPassword,
  resetPassword,
};
