"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.refresh = exports.login = exports.register = void 0;
const env_1 = require("../../config/env");
const ApiResponse_1 = require("../../utils/ApiResponse");
const ApiError_1 = require("../../utils/ApiError");
const auth_schema_1 = require("./auth.schema");
const auth_service_1 = require("./auth.service");
const COOKIE_NAME = 'refreshToken';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const cookieOptions = {
    httpOnly: true,
    secure: env_1.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
};
const register = async (req, res) => {
    const payload = auth_schema_1.registerSchema.parse(req.body);
    const result = await (0, auth_service_1.registerUser)(payload);
    res.cookie(COOKIE_NAME, result.refreshToken, cookieOptions);
    res.status(201).json(new ApiResponse_1.ApiResponse({
        accessToken: result.accessToken,
        user: result.user,
    }));
};
exports.register = register;
const login = async (req, res) => {
    const payload = auth_schema_1.loginSchema.parse(req.body);
    const result = await (0, auth_service_1.loginUser)(payload);
    res.cookie(COOKIE_NAME, result.refreshToken, cookieOptions);
    res.status(200).json(new ApiResponse_1.ApiResponse({
        accessToken: result.accessToken,
        user: result.user,
    }));
};
exports.login = login;
const refresh = async (req, res) => {
    const result = await (0, auth_service_1.refreshUserToken)(req.cookies?.[COOKIE_NAME]);
    res.cookie(COOKIE_NAME, result.refreshToken, cookieOptions);
    res.status(200).json(new ApiResponse_1.ApiResponse({
        accessToken: result.accessToken,
        user: result.user,
    }));
};
exports.refresh = refresh;
const logout = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    await (0, auth_service_1.logoutUser)(req.cookies?.[COOKIE_NAME]);
    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: env_1.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
    res.status(200).json(new ApiResponse_1.ApiResponse({ message: 'Logged out successfully' }));
};
exports.logout = logout;
