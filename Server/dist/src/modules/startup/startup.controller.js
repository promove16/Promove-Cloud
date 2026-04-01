"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadPitchController = exports.requestStartupReviewController = exports.launchStartupController = exports.patchStartup = exports.getMyStartupController = exports.createStartup = void 0;
const ApiResponse_1 = require("../../utils/ApiResponse");
const startup_service_1 = require("./startup.service");
const ApiError_1 = require("../../utils/ApiError");
const getParam = (value) => Array.isArray(value) ? value[0] : value;
const createStartup = async (req, res) => {
    const startup = await (0, startup_service_1.createStartupProfile)(req.user._id, startup_service_1.startupSchema.parse(req.body));
    res.status(201).json(new ApiResponse_1.ApiResponse(startup));
};
exports.createStartup = createStartup;
const getMyStartupController = async (req, res) => {
    const startup = await (0, startup_service_1.getMyStartup)(req.user._id);
    res.json(new ApiResponse_1.ApiResponse(startup));
};
exports.getMyStartupController = getMyStartupController;
const patchStartup = async (req, res) => {
    const startupId = getParam(req.params.id);
    if (!startupId) {
        throw new ApiError_1.ApiError(400, 'STARTUP_REQUIRED', 'Startup id is required');
    }
    const startup = await (0, startup_service_1.updateStartupProfile)(startupId, req.user._id, startup_service_1.startupSchema.partial().parse(req.body));
    res.json(new ApiResponse_1.ApiResponse(startup));
};
exports.patchStartup = patchStartup;
const launchStartupController = async (req, res) => {
    const startupId = getParam(req.params.id);
    if (!startupId) {
        throw new ApiError_1.ApiError(400, 'STARTUP_REQUIRED', 'Startup id is required');
    }
    const startup = await (0, startup_service_1.launchStartup)(startupId, req.user._id, startup_service_1.launchSchema.parse(req.body));
    res.json(new ApiResponse_1.ApiResponse(startup));
};
exports.launchStartupController = launchStartupController;
const requestStartupReviewController = async (req, res) => {
    const startupId = getParam(req.params.id);
    if (!startupId) {
        throw new ApiError_1.ApiError(400, 'STARTUP_REQUIRED', 'Startup id is required');
    }
    const startup = await (0, startup_service_1.requestStartupReview)(startupId, req.user._id);
    res.json(new ApiResponse_1.ApiResponse(startup));
};
exports.requestStartupReviewController = requestStartupReviewController;
const uploadPitchController = async (req, res) => {
    if (!req.file) {
        throw new ApiError_1.ApiError(400, 'FILE_REQUIRED', 'A pitch deck PDF is required');
    }
    const startupId = getParam(req.params.id);
    if (!startupId) {
        throw new ApiError_1.ApiError(400, 'STARTUP_REQUIRED', 'Startup id is required');
    }
    const startup = await (0, startup_service_1.uploadPitchDeck)(startupId, req.user._id, req.file);
    res.json(new ApiResponse_1.ApiResponse(startup));
};
exports.uploadPitchController = uploadPitchController;
