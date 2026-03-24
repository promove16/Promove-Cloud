"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimProblemController = exports.getProblem = exports.getProblems = void 0;
const ApiError_1 = require("../../utils/ApiError");
const ApiResponse_1 = require("../../utils/ApiResponse");
const problem_service_1 = require("./problem.service");
const getParam = (value) => Array.isArray(value) ? value[0] : value;
const getProblems = async (req, res) => {
    const payload = await (0, problem_service_1.listProblems)(req.query);
    res.json(new ApiResponse_1.ApiResponse(payload.items, { total: payload.total, page: Number(req.query.page ?? 1), limit: Number(req.query.limit ?? 10) }));
};
exports.getProblems = getProblems;
const getProblem = async (req, res) => {
    const problemId = getParam(req.params.id);
    if (!problemId) {
        throw new ApiError_1.ApiError(400, 'PROBLEM_REQUIRED', 'Problem id is required');
    }
    const problem = await (0, problem_service_1.getProblemById)(problemId);
    res.json(new ApiResponse_1.ApiResponse(problem));
};
exports.getProblem = getProblem;
const claimProblemController = async (req, res) => {
    const problemId = getParam(req.params.id);
    if (!problemId) {
        throw new ApiError_1.ApiError(400, 'PROBLEM_REQUIRED', 'Problem id is required');
    }
    const workspace = await (0, problem_service_1.claimProblem)(problemId, req.user._id);
    res.status(201).json(new ApiResponse_1.ApiResponse(workspace));
};
exports.claimProblemController = claimProblemController;
