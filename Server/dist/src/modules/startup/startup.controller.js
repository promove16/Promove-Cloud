"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeStartupDocumentController = exports.demoteFromCoFounderController = exports.promoteToCoFounderController = exports.uploadStartupDocumentController = exports.uploadPitchController = exports.requestStartupReviewController = exports.launchStartupController = exports.patchStartup = exports.getStartupByIdController = exports.getMyStartupsController = exports.createStartup = void 0;
const ApiResponse_1 = require("../../utils/ApiResponse");
const startup_service_1 = require("./startup.service");
const ApiError_1 = require("../../utils/ApiError");
const objectIdSchema = /^[0-9a-fA-F]{24}$/;
const getParam = (value) => Array.isArray(value) ? value[0] : value;
const getRequiredObjectIdParam = (value, requiredCode, requiredMessage) => {
    const param = getParam(value);
    if (!param) {
        throw new ApiError_1.ApiError(400, requiredCode, requiredMessage);
    }
    if (!objectIdSchema.test(param)) {
        throw new ApiError_1.ApiError(400, 'INVALID_ID', 'Invalid ID format');
    }
    return param;
};
const createStartup = async (req, res) => {
    const startup = await (0, startup_service_1.createStartupProfile)(req.user._id, startup_service_1.startupSchema.parse(req.body));
    res.status(201).json(new ApiResponse_1.ApiResponse(startup));
};
exports.createStartup = createStartup;
const getMyStartupsController = async (req, res) => {
    const startups = await (0, startup_service_1.getMyStartups)(req.user._id);
    res.json(new ApiResponse_1.ApiResponse(startups));
};
exports.getMyStartupsController = getMyStartupsController;
const getStartupByIdController = async (req, res) => {
    const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
    const startup = await (0, startup_service_1.getStartupById)(startupId, req.user._id);
    res.json(new ApiResponse_1.ApiResponse(startup));
};
exports.getStartupByIdController = getStartupByIdController;
const patchStartup = async (req, res) => {
    const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
    const startup = await (0, startup_service_1.updateStartupProfile)(startupId, req.user._id, startup_service_1.startupSchema.partial().parse(req.body));
    res.json(new ApiResponse_1.ApiResponse(startup));
};
exports.patchStartup = patchStartup;
const launchStartupController = async (req, res) => {
    const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
    const startup = await (0, startup_service_1.launchStartup)(startupId, req.user._id, startup_service_1.launchSchema.parse(req.body));
    res.json(new ApiResponse_1.ApiResponse(startup));
};
exports.launchStartupController = launchStartupController;
const requestStartupReviewController = async (req, res) => {
    const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
    const startup = await (0, startup_service_1.requestStartupReview)(startupId, req.user._id);
    res.json(new ApiResponse_1.ApiResponse(startup));
};
exports.requestStartupReviewController = requestStartupReviewController;
const uploadPitchController = async (req, res) => {
    if (!req.file) {
        throw new ApiError_1.ApiError(400, 'FILE_REQUIRED', 'A pitch deck PDF is required');
    }
    const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
    const startup = await (0, startup_service_1.uploadPitchDeck)(startupId, req.user._id, req.file);
    res.json(new ApiResponse_1.ApiResponse(startup));
};
exports.uploadPitchController = uploadPitchController;
const uploadStartupDocumentController = async (req, res) => {
    if (!req.file) {
        throw new ApiError_1.ApiError(400, 'FILE_REQUIRED', 'An IPR supporting document is required');
    }
    const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
    const startup = await (0, startup_service_1.uploadStartupDocument)(startupId, req.user._id, req.file, startup_service_1.startupDocumentUploadSchema.parse(req.body));
    res.json(new ApiResponse_1.ApiResponse(startup));
};
exports.uploadStartupDocumentController = uploadStartupDocumentController;
const promoteToCoFounderController = async (req, res) => {
    const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
    const memberId = getRequiredObjectIdParam(req.params.memberId, 'MEMBER_REQUIRED', 'Member id is required');
    const startup = await (0, startup_service_1.promoteToCoFounder)(startupId, req.user._id, memberId);
    res.json(new ApiResponse_1.ApiResponse(startup));
};
exports.promoteToCoFounderController = promoteToCoFounderController;
const demoteFromCoFounderController = async (req, res) => {
    const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
    const memberId = getRequiredObjectIdParam(req.params.memberId, 'MEMBER_REQUIRED', 'Member id is required');
    const startup = await (0, startup_service_1.demoteFromCoFounder)(startupId, req.user._id, memberId);
    res.json(new ApiResponse_1.ApiResponse(startup));
};
exports.demoteFromCoFounderController = demoteFromCoFounderController;
const removeStartupDocumentController = async (req, res) => {
    const startupId = getRequiredObjectIdParam(req.params.id, 'STARTUP_REQUIRED', 'Startup id is required');
    const documentId = getRequiredObjectIdParam(req.params.documentId, 'STARTUP_DOCUMENT_REQUIRED', 'Startup document id is required');
    const startup = await (0, startup_service_1.deleteStartupDocument)(startupId, req.user._id, documentId);
    res.json(new ApiResponse_1.ApiResponse(startup));
};
exports.removeStartupDocumentController = removeStartupDocumentController;
