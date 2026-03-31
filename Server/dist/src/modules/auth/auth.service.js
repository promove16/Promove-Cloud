"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutUser = exports.refreshUserToken = exports.loginUser = exports.changePassword = exports.submitInstitutionToken = exports.submitRegistrationRequest = exports.registerUser = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = require("crypto");
const env_1 = require("../../config/env");
const redis_1 = require("../../config/redis");
const user_model_1 = require("../user/user.model");
const roles_types_1 = require("../../types/roles.types");
const ApiError_1 = require("../../utils/ApiError");
const user_service_1 = require("../user/user.service");
const sanitizeText_1 = require("../../utils/sanitizeText");
const institutionAccess_service_1 = require("../institution/institutionAccess.service");
const studentRoster_service_1 = require("../institution/studentRoster.service");
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const MS_IN_YEAR = 365 * 24 * 60 * 60 * 1000;
const getAcademicYear = () => {
    const today = new Date();
    const startYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
};
const buildDefaultInstitutionProfile = (displayName) => ({
    institutionName: displayName,
    location: 'India',
    totalStudentsEnrolled: 0,
    academicYear: getAcademicYear(),
    iicStarRating: 0,
});
const signToken = (payload, secret, expiresIn, tokenType, tokenId) => {
    const options = {
        algorithm: 'RS256',
        expiresIn: expiresIn,
        subject: payload._id,
    };
    if (tokenId) {
        options.jwtid = tokenId;
    }
    return jsonwebtoken_1.default.sign(tokenId ? { ...payload, tokenId, type: tokenType } : { ...payload, type: tokenType }, secret, options);
};
const createTokenPair = async (user) => {
    const tokenBase = {
        _id: user._id,
        email: user.email,
        role: user.role,
    };
    const refreshTokenId = (0, crypto_1.randomUUID)();
    const accessToken = signToken(tokenBase, env_1.env.JWT_ACCESS_SECRET, env_1.env.JWT_ACCESS_EXPIRES, 'access');
    const refreshToken = signToken(tokenBase, env_1.env.JWT_REFRESH_SECRET, env_1.env.JWT_REFRESH_EXPIRES, 'refresh', refreshTokenId);
    await redis_1.redis.set(`refresh:${refreshTokenId}`, user._id, { ex: REFRESH_TTL_SECONDS });
    await redis_1.redis.set(`session:${user._id}:${refreshTokenId}`, JSON.stringify({
        userId: user._id,
        role: user.role,
        issuedAt: new Date().toISOString(),
    }), { ex: REFRESH_TTL_SECONDS });
    return {
        accessToken,
        refreshToken,
    };
};
const slugifyDisplayName = (displayName) => {
    const normalized = displayName
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || 'user';
};
const generateProfileSlug = async (displayName) => {
    const baseSlug = slugifyDisplayName(displayName);
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const suffix = (0, crypto_1.randomBytes)(2).toString('hex');
        const candidate = `${baseSlug}-${suffix}`;
        const existing = await user_model_1.User.exists({ profileSlug: candidate });
        if (!existing) {
            return candidate;
        }
    }
    throw new ApiError_1.ApiError(500, 'PROFILE_SLUG_GENERATION_FAILED', 'Unable to generate a unique profile URL');
};
const resolveStudentInstitutionContext = async (institutionToken) => {
    const tokenRecord = await (0, institutionAccess_service_1.resolveInstitutionToken)(institutionToken);
    const institution = await user_model_1.User.findOne({
        _id: tokenRecord.institutionId,
        role: { $in: [roles_types_1.UserRole.SCHOOL, roles_types_1.UserRole.COLLEGE] },
        isActive: true,
    })
        .select('_id role displayName')
        .lean();
    if (!institution) {
        throw new ApiError_1.ApiError(400, 'INVALID_INSTITUTION_TOKEN', 'This institution token is invalid or inactive');
    }
    return {
        tokenRecord,
        institution,
    };
};
const assertUserCanAuthenticate = (user) => {
    if (user.role === roles_types_1.UserRole.STUDENT && user.verificationStatus === 'rejected') {
        throw new ApiError_1.ApiError(403, 'INSTITUTION_VERIFICATION_REJECTED', user.verificationRejectedReason ||
            'Your institution could not verify your account. Please contact them for support.');
    }
    if (user.role === roles_types_1.UserRole.STUDENT && user.verificationStatus === 'pending') {
        throw new ApiError_1.ApiError(403, 'INSTITUTION_APPROVAL_PENDING', 'Your institution has not approved your account yet. Please contact your school or college.');
    }
    if (user.role !== roles_types_1.UserRole.STUDENT && user.adminApprovalStatus === 'rejected') {
        throw new ApiError_1.ApiError(403, 'ADMIN_APPROVAL_REJECTED', user.adminApprovalRejectedReason ||
            'Your registration request was rejected by the admin team. Please contact support.');
    }
    if (user.role !== roles_types_1.UserRole.STUDENT && user.adminApprovalStatus === 'pending') {
        throw new ApiError_1.ApiError(403, 'ADMIN_APPROVAL_PENDING', 'Your registration request is waiting for admin approval. Please try again after approval.');
    }
    if (!user.isActive && user.role !== roles_types_1.UserRole.STUDENT) {
        throw new ApiError_1.ApiError(403, 'ACCESS_DISABLED', 'Your account is currently inactive');
    }
};
const issueAuthResultForUser = async (user) => {
    user.lastLogin = new Date();
    await user.save();
    const sanitizedUser = (0, user_service_1.toSanitizedUser)(user.toObject());
    const tokens = await createTokenPair(sanitizedUser);
    return {
        ...tokens,
        user: sanitizedUser,
    };
};
const registerUser = async (payload) => {
    const existingUser = await user_model_1.User.findOne({ email: payload.email.toLowerCase() });
    if (existingUser) {
        throw new ApiError_1.ApiError(409, 'DUPLICATE_KEY', 'Email already registered');
    }
    const passwordHash = await bcrypt_1.default.hash(payload.password, 12);
    const sanitizedDisplayName = (0, sanitizeText_1.sanitizePlainText)(payload.displayName);
    const sanitizedBio = payload.bio ? (0, sanitizeText_1.sanitizePlainText)(payload.bio) : undefined;
    const profileSlug = await generateProfileSlug(sanitizedDisplayName);
    const profileComplete = Boolean(payload.domain || payload.bio);
    // ── No institution token → basic self-registration ────────────────
    if (!payload.institutionToken) {
        const createdUser = await user_model_1.User.create({
            email: payload.email.toLowerCase(),
            passwordHash,
            role: roles_types_1.UserRole.STUDENT,
            displayName: sanitizedDisplayName,
            ...(profileSlug ? { profileSlug } : {}),
            ...(payload.domain ? { domain: (0, sanitizeText_1.sanitizePlainText)(payload.domain) } : {}),
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
        const user = (0, user_service_1.toSanitizedUser)(createdUser.toObject());
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
    const matchedRoster = await (0, studentRoster_service_1.findInstitutionRosterMatchByEmail)(payload.email);
    if (matchedRoster &&
        String(matchedRoster.institutionId) !== String(studentInstitutionContext.institution._id)) {
        throw new ApiError_1.ApiError(409, 'INSTITUTION_TOKEN_MISMATCH', 'This email belongs to a different institution roster. Please use the correct institution token.');
    }
    const accessGrantedBy = matchedRoster ? 'institution_roster' : 'institution_token';
    const verificationTimestamp = new Date();
    const createdUser = await user_model_1.User.create({
        email: payload.email.toLowerCase(),
        passwordHash,
        role: roles_types_1.UserRole.STUDENT,
        displayName: sanitizedDisplayName,
        ...(profileSlug ? { profileSlug } : {}),
        ...(payload.domain ? { domain: (0, sanitizeText_1.sanitizePlainText)(payload.domain) } : {}),
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
    const user = (0, user_service_1.toSanitizedUser)(createdUser.toObject());
    if (studentInstitutionContext) {
        await (0, institutionAccess_service_1.registerTokenUsage)(String(studentInstitutionContext.tokenRecord._id));
    }
    if (matchedRoster) {
        await (0, studentRoster_service_1.markStudentRosterEntryRegistered)(String(matchedRoster.institutionId), payload.email, user._id);
    }
    return {
        pendingApproval: true,
        approvalType: 'institution',
        user,
        message: 'Your institution token was verified. Your account is now waiting for school or college approval.',
    };
};
exports.registerUser = registerUser;
const submitRegistrationRequest = async (payload) => {
    const normalizedEmail = payload.email.toLowerCase();
    const existingUser = await user_model_1.User.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (existingUser) {
        if (existingUser.isActive || existingUser.adminApprovalStatus === 'approved') {
            throw new ApiError_1.ApiError(409, 'DUPLICATE_KEY', 'Email already registered');
        }
        if (existingUser.adminApprovalStatus === 'pending') {
            throw new ApiError_1.ApiError(409, 'ADMIN_APPROVAL_PENDING', 'Your registration request is already waiting for admin approval.');
        }
        if (existingUser.role !== payload.role) {
            throw new ApiError_1.ApiError(409, 'ROLE_MISMATCH', 'This email already has a registration request for a different role.');
        }
    }
    const passwordHash = await bcrypt_1.default.hash(payload.password, 12);
    const sanitizedDisplayName = (0, sanitizeText_1.sanitizePlainText)(payload.displayName);
    const sanitizedBio = payload.bio ? (0, sanitizeText_1.sanitizePlainText)(payload.bio) : undefined;
    const sanitizedDomain = payload.domain ? (0, sanitizeText_1.sanitizePlainText)(payload.domain) : undefined;
    const institutionProfile = payload.institutionProfile ??
        (payload.role === roles_types_1.UserRole.SCHOOL || payload.role === roles_types_1.UserRole.COLLEGE
            ? buildDefaultInstitutionProfile(sanitizedDisplayName)
            : undefined);
    const approvalTimestamp = new Date();
    const user = existingUser ??
        new user_model_1.User({
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
        payload.role === roles_types_1.UserRole.SCHOOL || payload.role === roles_types_1.UserRole.COLLEGE
            ? Boolean(institutionProfile)
            : Boolean(sanitizedDomain || sanitizedBio);
    user.registrationStage =
        payload.role === roles_types_1.UserRole.SCHOOL || payload.role === roles_types_1.UserRole.COLLEGE ? 'complete' : 'basic';
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
    }
    else {
        user.institutionProfile = undefined;
    }
    await user.save();
    return {
        pendingApproval: true,
        approvalType: 'admin',
        user: (0, user_service_1.toSanitizedUser)(user.toObject()),
        message: 'Your registration form has been submitted to the admin team. You can sign in after approval.',
    };
};
exports.submitRegistrationRequest = submitRegistrationRequest;
const submitInstitutionToken = async (userId, institutionToken) => {
    const user = await user_model_1.User.findById(userId);
    if (!user || user.role !== roles_types_1.UserRole.STUDENT) {
        throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'Student account not found');
    }
    if (user.institutionVerificationStatus === 'verified') {
        throw new ApiError_1.ApiError(409, 'INSTITUTION_ALREADY_VERIFIED', 'Institution already verified');
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
    await (0, institutionAccess_service_1.registerTokenUsage)(String(tokenRecord._id));
    return {
        message: 'Token submitted successfully. Your institution can now review your account.',
    };
};
exports.submitInstitutionToken = submitInstitutionToken;
const changePassword = async (userId, currentPassword, newPassword) => {
    const user = await user_model_1.User.findById(userId).select('+passwordHash');
    if (!user) {
        throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    const passwordMatches = await bcrypt_1.default.compare(currentPassword, user.passwordHash);
    if (!passwordMatches) {
        throw new ApiError_1.ApiError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect');
    }
    user.passwordHash = await bcrypt_1.default.hash(newPassword, 12);
    user.mustChangePasswordOnNextLogin = false;
    await user.save();
};
exports.changePassword = changePassword;
const loginUser = async (payload) => {
    const user = await user_model_1.User.findOne({ email: payload.email.toLowerCase() }).select('+passwordHash');
    if (!user) {
        throw new ApiError_1.ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    const passwordMatches = await bcrypt_1.default.compare(payload.password, user.passwordHash);
    if (!passwordMatches) {
        throw new ApiError_1.ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    if (payload.role && user.role !== payload.role) {
        throw new ApiError_1.ApiError(403, 'ROLE_MISMATCH', `This account is registered as ${user.role}, not ${payload.role}`);
    }
    assertUserCanAuthenticate(user);
    return issueAuthResultForUser(user);
};
exports.loginUser = loginUser;
const refreshUserToken = async (refreshToken) => {
    if (!refreshToken) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    let decoded;
    try {
        decoded = jsonwebtoken_1.default.verify(refreshToken, env_1.env.JWT_REFRESH_SECRET, {
            algorithms: ['RS256'],
        });
    }
    catch (_error) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const key = `refresh:${decoded.tokenId}`;
    const storedUserId = await redis_1.redis.get(key);
    if (!storedUserId || storedUserId !== decoded._id) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    await redis_1.redis.del(key);
    await redis_1.redis.del(`session:${decoded._id}:${decoded.tokenId}`);
    const user = await user_model_1.User.findById(decoded._id);
    if (!user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    if (!user.isActive) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const sanitizedUser = (0, user_service_1.toSanitizedUser)(user.toObject());
    const tokens = await createTokenPair(sanitizedUser);
    return {
        ...tokens,
        user: sanitizedUser,
    };
};
exports.refreshUserToken = refreshUserToken;
const logoutUser = async (refreshToken) => {
    if (!refreshToken) {
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(refreshToken, env_1.env.JWT_REFRESH_SECRET, {
            algorithms: ['RS256'],
        });
        await redis_1.redis.del(`refresh:${decoded.tokenId}`);
        await redis_1.redis.del(`session:${decoded._id}:${decoded.tokenId}`);
    }
    catch (_error) {
        return;
    }
};
exports.logoutUser = logoutUser;
