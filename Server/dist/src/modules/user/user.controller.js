"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchUsers = exports.claimMyOnboardingStep = exports.getMyOnboarding = exports.launchToRecruiters = exports.getMySessions = exports.trackMeActivity = exports.importGithubRepositories = exports.listGithubRepositories = exports.syncGithubProof = exports.githubOauthCallback = exports.startGithubOauth = exports.enrichMeFromSocialLinks = exports.patchMe = exports.getPublicStudentProfile = exports.getMe = void 0;
const ApiResponse_1 = require("../../utils/ApiResponse");
const ApiError_1 = require("../../utils/ApiError");
const user_service_1 = require("./user.service");
const onboarding_service_1 = require("./onboarding.service");
const user_model_1 = require("./user.model");
const getMe = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const user = await (0, user_service_1.getCurrentUser)(req.user._id);
    res.status(200).json(new ApiResponse_1.ApiResponse(user));
};
exports.getMe = getMe;
const getPublicStudentProfile = async (req, res) => {
    const profileSlug = String(req.params.profileSlug ?? '').trim().toLowerCase();
    const profile = await (0, user_service_1.getPublicStudentProfileBySlug)(profileSlug);
    res.status(200).json(new ApiResponse_1.ApiResponse(profile));
};
exports.getPublicStudentProfile = getPublicStudentProfile;
const patchMe = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const payload = user_service_1.updateMeSchema.parse(req.body);
    const user = await (0, user_service_1.updateCurrentUser)(req.user._id, payload);
    res.status(200).json(new ApiResponse_1.ApiResponse(user));
};
exports.patchMe = patchMe;
const enrichMeFromSocialLinks = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const payload = user_service_1.socialEnrichSchema.parse(req.body);
    const result = await (0, user_service_1.enrichCurrentUserFromSocialLinks)(req.user._id, payload);
    res.status(200).json(new ApiResponse_1.ApiResponse(result));
};
exports.enrichMeFromSocialLinks = enrichMeFromSocialLinks;
const startGithubOauth = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const rawReturnTo = req.query.returnTo;
    const returnTo = typeof rawReturnTo === 'string'
        ? rawReturnTo
        : Array.isArray(rawReturnTo) && typeof rawReturnTo[0] === 'string'
            ? rawReturnTo[0]
            : undefined;
    const result = await (0, user_service_1.beginGithubOauthForCurrentUser)(req.user._id, returnTo);
    res.status(200).json(new ApiResponse_1.ApiResponse(result));
};
exports.startGithubOauth = startGithubOauth;
const githubOauthCallback = async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
    if (!code || !state) {
        res.redirect(`${clientUrl}/dashboard/profile?github=error`);
        return;
    }
    try {
        const { returnTo } = await (0, user_service_1.connectGithubForCurrentUserFromCallback)(state, code);
        const separator = returnTo.includes('?') ? '&' : '?';
        res.redirect(`${clientUrl}${returnTo}${separator}github=connected`);
    }
    catch (error) {
        const message = error instanceof ApiError_1.ApiError ? encodeURIComponent(error.message) : encodeURIComponent('GitHub connection failed.');
        res.redirect(`${clientUrl}/dashboard/profile?github=error&message=${message}`);
    }
};
exports.githubOauthCallback = githubOauthCallback;
const syncGithubProof = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const result = await (0, user_service_1.syncCurrentUserGithubProof)(req.user._id);
    res.status(200).json(new ApiResponse_1.ApiResponse(result));
};
exports.syncGithubProof = syncGithubProof;
const listGithubRepositories = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const result = await (0, user_service_1.listCurrentUserGithubRepositories)(req.user._id);
    res.status(200).json(new ApiResponse_1.ApiResponse(result));
};
exports.listGithubRepositories = listGithubRepositories;
const importGithubRepositories = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const payload = user_service_1.importGithubRepositoriesSchema.parse(req.body);
    const result = await (0, user_service_1.importCurrentUserGithubRepositories)(req.user._id, payload);
    res.status(200).json(new ApiResponse_1.ApiResponse(result));
};
exports.importGithubRepositories = importGithubRepositories;
const trackMeActivity = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const result = await (0, user_service_1.recordCurrentUserActivity)(req.user._id, req.body);
    res.status(201).json(new ApiResponse_1.ApiResponse(result));
};
exports.trackMeActivity = trackMeActivity;
const getMySessions = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const sessions = await (0, user_service_1.getCurrentUserMentorSessions)(req.user._id);
    res.status(200).json(new ApiResponse_1.ApiResponse(sessions));
};
exports.getMySessions = getMySessions;
const launchToRecruiters = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const result = await (0, user_service_1.launchCurrentUserToRecruiters)(req.user._id);
    res.status(200).json(new ApiResponse_1.ApiResponse(result));
};
exports.launchToRecruiters = launchToRecruiters;
const getMyOnboarding = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const status = await (0, onboarding_service_1.getOnboardingStatus)(req.user._id);
    res.status(200).json(new ApiResponse_1.ApiResponse(status));
};
exports.getMyOnboarding = getMyOnboarding;
const claimMyOnboardingStep = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const rawStepId = req.params.stepId;
    const stepId = Array.isArray(rawStepId) ? rawStepId[0] : rawStepId;
    if (!stepId) {
        throw new ApiError_1.ApiError(400, 'VALIDATION_ERROR', 'Onboarding step is required');
    }
    const result = await (0, onboarding_service_1.claimOnboardingStep)(req.user._id, stepId);
    res.status(200).json(new ApiResponse_1.ApiResponse(result));
};
exports.claimMyOnboardingStep = claimMyOnboardingStep;
const searchUsers = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
        res.status(200).json(new ApiResponse_1.ApiResponse([]));
        return;
    }
    // Escape regex special characters to prevent ReDoS
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await user_model_1.User.find({
        displayName: { $regex: escaped, $options: 'i' },
        isActive: true,
        _id: { $ne: req.user._id },
    }, { _id: 1, displayName: 1, avatar: 1, role: 1 })
        .limit(10)
        .lean();
    res.status(200).json(new ApiResponse_1.ApiResponse(users));
};
exports.searchUsers = searchUsers;
