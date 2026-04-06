"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewProblemSubmissionController = exports.listProblemReviewRequestsController = exports.deleteAdminProblemController = exports.updateAdminProblemController = exports.createAdminProblemController = exports.listAdminProblemsController = exports.getProblemLeaderboardController = exports.requestProblemReviewController = exports.claimProblemController = exports.getProblem = exports.getProblems = void 0;
const ApiError_1 = require("../../utils/ApiError");
const ApiResponse_1 = require("../../utils/ApiResponse");
const problem_service_1 = require("./problem.service");
const getParam = (value) => Array.isArray(value) ? value[0] : value;
const getProblems = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const payload = await (0, problem_service_1.listProblems)(req.query, req.user._id);
    res.json(new ApiResponse_1.ApiResponse(payload.items, { total: payload.total, page: Number(req.query.page ?? 1), limit: Number(req.query.limit ?? 10) }));
};
exports.getProblems = getProblems;
const getProblem = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const problemId = getParam(req.params.id);
    if (!problemId) {
        throw new ApiError_1.ApiError(400, 'PROBLEM_REQUIRED', 'Problem id is required');
    }
    const problem = await (0, problem_service_1.getProblemById)(problemId, req.user._id);
    res.json(new ApiResponse_1.ApiResponse(problem));
};
exports.getProblem = getProblem;
const claimProblemController = async (req, res) => {
    const problemId = getParam(req.params.id);
    if (!problemId) {
        throw new ApiError_1.ApiError(400, 'PROBLEM_REQUIRED', 'Problem id is required');
    }
    const workspace = await (0, problem_service_1.claimProblem)(problemId, req.user._id);
    res.status(200).json(new ApiResponse_1.ApiResponse(workspace));
};
exports.claimProblemController = claimProblemController;
const requestProblemReviewController = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const problemId = getParam(req.params.id);
    if (!problemId) {
        throw new ApiError_1.ApiError(400, 'PROBLEM_REQUIRED', 'Problem id is required');
    }
    const submission = await (0, problem_service_1.requestProblemReview)(problemId, req.user._id, problem_service_1.createProblemReviewRequestSchema.parse(req.body));
    res.status(202).json(new ApiResponse_1.ApiResponse(submission));
};
exports.requestProblemReviewController = requestProblemReviewController;
const getProblemLeaderboardController = async (req, res) => {
    const problemId = getParam(req.params.id);
    if (!problemId) {
        throw new ApiError_1.ApiError(400, 'PROBLEM_REQUIRED', 'Problem id is required');
    }
    res.json(new ApiResponse_1.ApiResponse(await (0, problem_service_1.listProblemLeaderboard)(problemId)));
};
exports.getProblemLeaderboardController = getProblemLeaderboardController;
const listAdminProblemsController = async (_req, res) => {
    res.json(new ApiResponse_1.ApiResponse(await (0, problem_service_1.listAdminProblems)()));
};
exports.listAdminProblemsController = listAdminProblemsController;
const createAdminProblemController = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const problem = await (0, problem_service_1.createAdminProblem)(req.user._id, problem_service_1.createProblemSchema.parse(req.body));
    res.status(201).json(new ApiResponse_1.ApiResponse(problem));
};
exports.createAdminProblemController = createAdminProblemController;
const updateAdminProblemController = async (req, res) => {
    const problemId = getParam(req.params.id);
    if (!problemId) {
        throw new ApiError_1.ApiError(400, 'PROBLEM_REQUIRED', 'Problem id is required');
    }
    const problem = await (0, problem_service_1.updateAdminProblem)(problemId, problem_service_1.updateProblemSchema.parse(req.body));
    res.status(200).json(new ApiResponse_1.ApiResponse(problem));
};
exports.updateAdminProblemController = updateAdminProblemController;
const deleteAdminProblemController = async (req, res) => {
    const problemId = getParam(req.params.id);
    if (!problemId) {
        throw new ApiError_1.ApiError(400, 'PROBLEM_REQUIRED', 'Problem id is required');
    }
    res.status(200).json(new ApiResponse_1.ApiResponse(await (0, problem_service_1.deleteAdminProblem)(problemId)));
};
exports.deleteAdminProblemController = deleteAdminProblemController;
const listProblemReviewRequestsController = async (req, res) => {
    const query = problem_service_1.listProblemReviewRequestsQuerySchema.parse(req.query);
    res.json(new ApiResponse_1.ApiResponse(await (0, problem_service_1.listProblemReviewRequests)(query.status)));
};
exports.listProblemReviewRequestsController = listProblemReviewRequestsController;
const reviewProblemSubmissionController = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const submissionId = getParam(req.params.submissionId);
    if (!submissionId) {
        throw new ApiError_1.ApiError(400, 'REVIEW_REQUEST_REQUIRED', 'Review request id is required');
    }
    res.status(200).json(new ApiResponse_1.ApiResponse(await (0, problem_service_1.reviewProblemSubmission)(req.user._id, submissionId, problem_service_1.reviewProblemSubmissionSchema.parse(req.body))));
};
exports.reviewProblemSubmissionController = reviewProblemSubmissionController;
