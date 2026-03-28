"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutUser = exports.refreshUserToken = exports.loginUser = exports.registerUser = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = require("crypto");
const redis_1 = require("../../config/redis");
const env_1 = require("../../config/env");
const user_model_1 = require("../user/user.model");
const roles_types_1 = require("../../types/roles.types");
const ApiError_1 = require("../../utils/ApiError");
const user_service_1 = require("../user/user.service");
const institutionAccess_service_1 = require("../institution/institutionAccess.service");
const sanitizeText_1 = require("../../utils/sanitizeText");
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
const registerUser = async (payload) => {
    const activeUsers = await user_model_1.User.countDocuments({ isActive: true });
    if (activeUsers >= env_1.env.MAX_USERS_YEAR_ONE) {
        throw new ApiError_1.ApiError(403, 'CAPACITY_REACHED', 'Platform is at capacity for Year 1. Please join the waitlist.');
    }
    const existingUser = await user_model_1.User.findOne({ email: payload.email.toLowerCase() });
    if (existingUser) {
        throw new ApiError_1.ApiError(409, 'DUPLICATE_KEY', 'Email already registered');
    }
    const passwordHash = await bcrypt_1.default.hash(payload.password, 12);
    const isStudent = payload.role === roles_types_1.UserRole.STUDENT;
    const institutionTokenValue = payload.institutionToken?.trim();
    const hasManagedInstitutionFlow = isStudent && Boolean(institutionTokenValue);
    const tokenRecord = hasManagedInstitutionFlow && institutionTokenValue
        ? await (0, institutionAccess_service_1.resolveInstitutionToken)(institutionTokenValue)
        : undefined;
    const accessGrantedBy = isStudent ? 'institution_token' : 'self_registered';
    const fallbackDomain = payload.domain ?? payload.accessCode?.trim();
    const sanitizedDisplayName = (0, sanitizeText_1.sanitizePlainText)(payload.displayName);
    const sanitizedBio = payload.bio ? (0, sanitizeText_1.sanitizePlainText)(payload.bio) : undefined;
    const institutionProfile = payload.institutionProfile ??
        (payload.role === roles_types_1.UserRole.SCHOOL || payload.role === roles_types_1.UserRole.COLLEGE
            ? buildDefaultInstitutionProfile(sanitizedDisplayName)
            : undefined);
    const createdUser = await user_model_1.User.create({
        email: payload.email.toLowerCase(),
        passwordHash,
        role: payload.role,
        displayName: sanitizedDisplayName,
        ...(fallbackDomain ? { domain: (0, sanitizeText_1.sanitizePlainText)(fallbackDomain) } : {}),
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
        ...(tokenRecord ? { institutionId: tokenRecord.institutionId } : {}),
        profileComplete: payload.role === roles_types_1.UserRole.SCHOOL || payload.role === roles_types_1.UserRole.COLLEGE
            ? Boolean(institutionProfile)
            : Boolean(fallbackDomain || payload.bio),
        accessGrantedBy,
        accessExpiresAt: new Date(Date.now() + MS_IN_YEAR),
        isActive: hasManagedInstitutionFlow ? false : true,
        verificationStatus: hasManagedInstitutionFlow
            ? 'pending'
            : isStudent
                ? 'verified'
                : 'not_required',
        ...(isStudent
            ? {
                verificationRequestedAt: new Date(),
                ...(hasManagedInstitutionFlow ? {} : { verifiedAt: new Date() }),
            }
            : {}),
    });
    if (tokenRecord) {
        await (0, institutionAccess_service_1.registerTokenUsage)(String(tokenRecord._id));
    }
    const user = (0, user_service_1.toSanitizedUser)(createdUser.toObject());
    if (hasManagedInstitutionFlow) {
        return {
            requiresVerification: true,
            message: 'Your account has been created and is waiting for school or college approval before sign-in.',
            user,
        };
    }
    const tokens = await createTokenPair(user);
    return {
        ...tokens,
        user,
    };
};
exports.registerUser = registerUser;
const loginUser = async (payload) => {
    const user = await user_model_1.User.findOne({ email: payload.email.toLowerCase() }).select('+passwordHash');
    if (!user) {
        throw new ApiError_1.ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    if (user.role !== payload.role) {
        throw new ApiError_1.ApiError(401, 'ROLE_MISMATCH', 'Selected role does not match your account.');
    }
    if (user.role === roles_types_1.UserRole.STUDENT && user.verificationStatus === 'rejected') {
        throw new ApiError_1.ApiError(403, 'INSTITUTION_VERIFICATION_REJECTED', user.verificationRejectedReason ||
            'Your institution could not verify your account. Please contact them for support.');
    }
    if (user.role === roles_types_1.UserRole.STUDENT && user.verificationStatus === 'pending') {
        throw new ApiError_1.ApiError(403, 'INSTITUTION_VERIFICATION_PENDING', 'Your school or college still needs to verify your account before you can sign in.');
    }
    if (!user.isActive && user.role !== roles_types_1.UserRole.STUDENT) {
        throw new ApiError_1.ApiError(403, 'ACCESS_DISABLED', 'Your account is currently inactive');
    }
    const passwordMatches = await bcrypt_1.default.compare(payload.password, user.passwordHash);
    if (!passwordMatches) {
        throw new ApiError_1.ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    user.lastLogin = new Date();
    await user.save();
    const sanitizedUser = (0, user_service_1.toSanitizedUser)(user.toObject());
    const tokens = await createTokenPair(sanitizedUser);
    return {
        ...tokens,
        user: sanitizedUser,
    };
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
