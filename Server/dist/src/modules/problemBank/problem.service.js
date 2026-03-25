"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimProblem = exports.getProblemById = exports.listProblems = exports.seedProblemsIfEmpty = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = require("mongoose");
const redis_1 = require("../../config/redis");
const ApiError_1 = require("../../utils/ApiError");
const scoreEngine_1 = require("../../services/scoreEngine");
const problem_model_1 = require("./problem.model");
const workspace_model_1 = require("../workspace/workspace.model");
const sampleProblems = [
    ['Smart irrigation for small farms', 'Agriculture', 'Medium', 'Agritech'],
    ['Village cold-chain logistics', 'Agriculture', 'Hard', 'Supply Chain'],
    ['Low-cost assistive reading tool', 'Education', 'Easy', 'Accessibility'],
    ['AI attendance insights for schools', 'Education', 'Medium', 'EdTech'],
    ['Rural telemedicine diagnostics', 'Healthcare', 'Hard', 'HealthTech'],
    ['Smart medicine adherence alerts', 'Healthcare', 'Medium', 'HealthTech'],
    ['E-waste collection incentives', 'Environment', 'Medium', 'Sustainability'],
    ['Flood prediction for local bodies', 'Environment', 'Hard', 'Climate'],
    ['Affordable solar uptime monitor', 'Technology', 'Medium', 'IoT'],
    ['Offline-first learning hub', 'Technology', 'Easy', 'Software'],
    ['Women safety commute assist', 'Other', 'Medium', 'Mobility'],
    ['Accessible skill training portal', 'Rural Development', 'Easy', 'Employment'],
    ['Artisan market discovery engine', 'Rural Development', 'Medium', 'Commerce'],
    ['Water quality community scanner', 'Environment', 'Hard', 'Hardware'],
    ['Farmer credit readiness tracker', 'Agriculture', 'Medium', 'FinTech'],
];
const seedProblemsIfEmpty = async () => {
    const count = await problem_model_1.Problem.countDocuments();
    if (count > 0) {
        return;
    }
    await problem_model_1.Problem.insertMany(sampleProblems.map(([title, category, difficulty, domain], index) => ({
        title,
        description: `${title} is a verified ProMove challenge designed to help student innovators ship high-impact solutions for real communities.`,
        category,
        difficulty,
        domain,
        tags: domain.split(' ').map((part) => part.toLowerCase()),
        isVerified: index % 2 === 0,
        postedBy: index % 3 === 0 ? 'ProMove' : 'Partner Institution',
    })));
};
exports.seedProblemsIfEmpty = seedProblemsIfEmpty;
const listProblems = async (query) => {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(20, Math.max(1, Number(query.limit ?? 10)));
    const cacheKey = `problems:${crypto_1.default.createHash('sha1').update(JSON.stringify(query)).digest('hex')}`;
    const cached = await redis_1.redis.get(cacheKey);
    if (cached) {
        return typeof cached === 'string' ? JSON.parse(cached) : cached;
    }
    const filter = {};
    if (typeof query.category === 'string' && query.category && query.category !== 'All Problems') {
        filter.category = query.category;
    }
    if (typeof query.difficulty === 'string' && query.difficulty) {
        filter.difficulty = query.difficulty;
    }
    if (typeof query.domain === 'string' && query.domain) {
        filter.domain = new RegExp(query.domain, 'i');
    }
    if (typeof query.search === 'string' && query.search) {
        filter.$text = { $search: query.search };
    }
    const problems = await problem_model_1.Problem.find(filter)
        .sort({ isVerified: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    const total = await problem_model_1.Problem.countDocuments(filter);
    const payload = { items: problems, nextPage: page * limit < total ? page + 1 : null, total };
    await redis_1.redis.set(cacheKey, JSON.stringify(payload), { ex: 300 });
    return payload;
};
exports.listProblems = listProblems;
const getProblemById = async (id) => {
    const problem = await problem_model_1.Problem.findById(id).lean();
    if (!problem) {
        throw new ApiError_1.ApiError(404, 'PROBLEM_NOT_FOUND', 'Problem not found');
    }
    return problem;
};
exports.getProblemById = getProblemById;
const claimProblem = async (problemId, userId) => {
    const activeCount = await workspace_model_1.Workspace.countDocuments({ ownerId: userId, isActive: true });
    if (activeCount >= 3) {
        throw new ApiError_1.ApiError(400, 'WORKSPACE_LIMIT_REACHED', 'You can only have 3 active workspaces.');
    }
    const problem = await problem_model_1.Problem.findById(problemId);
    if (!problem) {
        throw new ApiError_1.ApiError(404, 'PROBLEM_NOT_FOUND', 'Problem not found');
    }
    if (problem.claimedBy) {
        throw new ApiError_1.ApiError(400, 'PROBLEM_ALREADY_CLAIMED', 'Problem already claimed');
    }
    problem.claimedBy = new mongoose_1.Types.ObjectId(userId);
    problem.claimedAt = new Date();
    await problem.save();
    const workspace = await workspace_model_1.Workspace.create({
        ownerId: userId,
        teamMemberIds: [userId],
        claimedProblemId: problem._id,
        title: problem.title,
        category: problem.category,
        stage: 'Problem',
        progressPercent: 0,
    });
    await (0, scoreEngine_1.applyScoreAsync)({ userId, trigger: 'PROBLEM_CLAIMED', metadata: { problemId } });
    return workspace.toObject();
};
exports.claimProblem = claimProblem;
