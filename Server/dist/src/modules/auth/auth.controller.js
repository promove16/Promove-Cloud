"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitInstitutionTokenAfterRegister = exports.changePasswordController = exports.logout = exports.refresh = exports.oauthCallback = exports.startOAuth = exports.login = exports.registerRequest = exports.register = void 0;
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
const getRequestOrigin = (req) => `${req.protocol}://${req.get('host')}`;
const register = async (req, res) => {
    const payload = auth_schema_1.registerSchema.parse(req.body);
    const result = await (0, auth_service_1.registerUser)(payload);
    if ('pendingApproval' in result) {
        res.status(201).json(new ApiResponse_1.ApiResponse(result));
        return;
    }
    res.cookie(COOKIE_NAME, result.refreshToken, cookieOptions);
    res.status(201).json(new ApiResponse_1.ApiResponse(result));
};
exports.register = register;
const registerRequest = async (req, res) => {
    const payload = auth_schema_1.registrationRequestSchema.parse(req.body);
    const result = await (0, auth_service_1.submitRegistrationRequest)(payload);
    res.status(201).json(new ApiResponse_1.ApiResponse(result));
};
exports.registerRequest = registerRequest;
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
const startOAuth = async (req, res) => {
    const provider = auth_schema_1.oauthProviderSchema.parse(req.params.provider);
    try {
        const authorizationUrl = await (0, auth_service_1.createOAuthAuthorizationUrl)(provider, getRequestOrigin(req));
        res.redirect(302, authorizationUrl);
    }
    catch (error) {
        if (error instanceof ApiError_1.ApiError) {
            res.redirect(302, (0, auth_service_1.buildFrontendOAuthRedirectUrl)(provider, 'error', {
                code: error.code,
                message: error.message,
            }));
            return;
        }
        throw error;
    }
};
exports.startOAuth = startOAuth;
const oauthCallback = async (req, res) => {
    const provider = auth_schema_1.oauthProviderSchema.parse(req.params.provider);
    const callbackQuery = auth_schema_1.oauthCallbackQuerySchema.parse(req.query);
    if (callbackQuery.error) {
        res.redirect(302, (0, auth_service_1.buildFrontendOAuthRedirectUrl)(provider, 'error', {
            code: 'OAUTH_ACCESS_DENIED',
            message: callbackQuery.error_description ?? 'Sign-in was cancelled or denied.',
        }));
        return;
    }
    try {
        const result = await (0, auth_service_1.loginWithOAuth)({
            provider,
            code: callbackQuery.code,
            state: callbackQuery.state,
            requestOrigin: getRequestOrigin(req),
        });
        res.cookie(COOKIE_NAME, result.refreshToken, cookieOptions);
        res.redirect(302, (0, auth_service_1.buildFrontendOAuthRedirectUrl)(provider, 'success'));
    }
    catch (error) {
        if (error instanceof ApiError_1.ApiError) {
            res.redirect(302, (0, auth_service_1.buildFrontendOAuthRedirectUrl)(provider, 'error', {
                code: error.code,
                message: error.message,
            }));
            return;
        }
        throw error;
    }
};
exports.oauthCallback = oauthCallback;
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
const changePasswordController = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        throw new ApiError_1.ApiError(400, 'VALIDATION_ERROR', 'currentPassword and newPassword are required');
    }
    if (newPassword.length < 8) {
        throw new ApiError_1.ApiError(400, 'VALIDATION_ERROR', 'New password must be at least 8 characters');
    }
    await (0, auth_service_1.changePassword)(req.user._id, currentPassword, newPassword);
    res.status(200).json(new ApiResponse_1.ApiResponse({ message: 'Password changed successfully' }));
};
exports.changePasswordController = changePasswordController;
const submitInstitutionTokenAfterRegister = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const { institutionToken } = auth_schema_1.submitInstitutionTokenSchema.parse(req.body);
    const result = await (0, auth_service_1.submitInstitutionToken)(req.user._id, institutionToken);
    res.status(200).json(new ApiResponse_1.ApiResponse({
        message: result.message,
    }));
};
exports.submitInstitutionTokenAfterRegister = submitInstitutionTokenAfterRegister;
