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
const ApiError_1 = require("../../utils/ApiError");
const user_service_1 = require("../user/user.service");
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const MS_IN_YEAR = 365 * 24 * 60 * 60 * 1000;
const ACCESS_CODE_MAP = {
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
const normalizeAccessCode = (value) => value.replace(/[^a-zA-Z]/g, '').toUpperCase();
const resolveAccessGrant = (accessCode) => {
    const direct = ACCESS_CODE_MAP[accessCode.toUpperCase()];
    if (direct) {
        return direct;
    }
    const normalized = ACCESS_CODE_MAP[normalizeAccessCode(accessCode)];
    if (!normalized) {
        throw new ApiError_1.ApiError(400, 'INVALID_ACCESS_CODE', 'Invalid access code');
    }
    return normalized;
};
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
    const accessGrantedBy = resolveAccessGrant(payload.accessCode);
    const passwordHash = await bcrypt_1.default.hash(payload.password, 12);
    const createdUser = await user_model_1.User.create({
        email: payload.email.toLowerCase(),
        passwordHash,
        role: payload.role,
        displayName: payload.displayName,
        accessGrantedBy,
        accessExpiresAt: new Date(Date.now() + MS_IN_YEAR),
    });
    const user = (0, user_service_1.toSanitizedUser)(createdUser.toObject());
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
    const user = await user_model_1.User.findById(decoded._id);
    if (!user) {
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
    }
    catch (_error) {
        return;
    }
};
exports.logoutUser = logoutUser;
