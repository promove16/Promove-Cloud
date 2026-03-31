"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimProblem = exports.updateAdminProblem = exports.createAdminProblem = exports.listAdminProblems = exports.getProblemById = exports.listProblems = exports.seedProblemsIfEmpty = exports.updateProblemSchema = exports.createProblemSchema = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = require("mongoose");
const zod_1 = require("zod");
const redis_1 = require("../../config/redis");
const ApiError_1 = require("../../utils/ApiError");
const scoreEngine_1 = require("../../services/scoreEngine");
const problem_model_1 = require("./problem.model");
const workspace_model_1 = require("../workspace/workspace.model");
const defaultSecurityNotice = 'Upload only project-safe evidence. Do not share secrets, credentials, private keys, personal data, or production database exports.';
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
const arrayField = (maxItems, itemMax = 160) => zod_1.z.array(zod_1.z.string().trim().min(1).max(itemMax)).max(maxItems).default([]);
const submissionConfigSchema = zod_1.z.object({
    allowDocuments: zod_1.z.boolean().default(true),
    allowImages: zod_1.z.boolean().default(true),
    allowGithubRepos: zod_1.z.boolean().default(true),
    allowCodeSnippets: zod_1.z.boolean().default(true),
    maxFileSizeMb: zod_1.z.number().int().min(1).max(25).default(10),
    maxRepoLinks: zod_1.z.number().int().min(0).max(10).default(3),
    maxCodeSnippets: zod_1.z.number().int().min(0).max(20).default(5),
    codeExecutionAllowed: zod_1.z.literal(false).default(false),
});
exports.createProblemSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(3).max(160),
    description: zod_1.z.string().trim().min(20).max(1200),
    category: zod_1.z.enum([
        'Agriculture',
        'Technology',
        'Healthcare',
        'Education',
        'Environment',
        'Rural Development',
        'Other',
    ]),
    difficulty: zod_1.z.enum(['Easy', 'Medium', 'Hard']),
    domain: zod_1.z.string().trim().min(2).max(120),
    tags: arrayField(12, 40),
    isVerified: zod_1.z.boolean().default(true),
    sponsorName: zod_1.z.string().trim().min(2).max(160).optional(),
    geography: zod_1.z.string().trim().min(2).max(160).optional(),
    targetBeneficiaries: arrayField(10, 80),
    impactGoal: zod_1.z.string().trim().min(2).max(500).optional(),
    expectedOutcome: zod_1.z.string().trim().min(2).max(500).optional(),
    deliverables: arrayField(10, 200),
    acceptanceCriteria: arrayField(10, 200),
    constraints: arrayField(10, 200),
    resourceLinks: zod_1.z.array(zod_1.z.string().trim().url().max(300)).max(10).default([]),
    securityNotice: zod_1.z.string().trim().min(10).max(500).default(defaultSecurityNotice),
    publicationStatus: zod_1.z.enum(['draft', 'published', 'archived']).default('published'),
    submissionConfig: submissionConfigSchema.default({
        allowDocuments: true,
        allowImages: true,
        allowGithubRepos: true,
        allowCodeSnippets: true,
        maxFileSizeMb: 10,
        maxRepoLinks: 3,
        maxCodeSnippets: 5,
        codeExecutionAllowed: false,
    }),
});
exports.updateProblemSchema = exports.createProblemSchema.partial();
const clearProblemCaches = async () => {
    const scan = redis_1.redis.scan;
    if (typeof scan !== 'function') {
        return;
    }
    let cursor = '0';
    const keys = [];
    do {
        const [nextCursor, batch] = await scan(cursor);
        cursor = nextCursor;
        batch.forEach((key) => {
            if (key.startsWith('problems:')) {
                keys.push(key);
            }
        });
    } while (cursor !== '0');
    if (keys.length > 0) {
        await Promise.all(keys.map((key) => redis_1.redis.del(key)));
    }
};
const normalizeProblemInput = (payload) => ({
    ...payload,
    postedBy: payload.sponsorName?.trim() || 'ProMove Admin',
    targetBeneficiaries: payload.targetBeneficiaries ?? [],
    deliverables: payload.deliverables ?? [],
    acceptanceCriteria: payload.acceptanceCriteria ?? [],
    constraints: payload.constraints ?? [],
    resourceLinks: payload.resourceLinks ?? [],
    submissionConfig: payload.submissionConfig,
    claimStatus: 'open',
    maxClaims: 1,
});
const seedProblemsIfEmpty = async () => {
    const count = await problem_model_1.Problem.countDocuments();
    if (count > 0) {
        return false;
    }
    await problem_model_1.Problem.insertMany(sampleProblems.map(([title, category, difficulty, domain], index) => ({
        title,
        description: `${title} is a verified ProMove challenge designed to help student innovators ship high-impact solutions for real communities.`,
        category,
        difficulty,
        domain,
        tags: domain.split(' ').map((part) => part.toLowerCase()),
        isVerified: true,
        postedBy: 'ProMove Admin',
        sponsorName: index % 2 === 0 ? 'ProMove Innovation Desk' : 'Partner Challenge Office',
        geography: 'India',
        targetBeneficiaries: ['Students', 'Communities'],
        impactGoal: 'Create a real-world, implementation-ready student innovation.',
        expectedOutcome: 'A validated prototype and a documented implementation path.',
        deliverables: ['Problem analysis', 'Prototype evidence', 'Validation summary'],
        acceptanceCriteria: ['Clear user problem fit', 'Functional evidence uploaded', 'Safe submission hygiene'],
        constraints: ['No sharing of secrets', 'No production data uploads', 'One active claimant at a time'],
        resourceLinks: [],
        securityNotice: defaultSecurityNotice,
        publicationStatus: 'published',
        claimStatus: 'open',
        maxClaims: 1,
        submissionConfig: {
            allowDocuments: true,
            allowImages: true,
            allowGithubRepos: true,
            allowCodeSnippets: true,
            maxFileSizeMb: 10,
            maxRepoLinks: 3,
            maxCodeSnippets: 5,
            codeExecutionAllowed: false,
        },
    })));
    return true;
};
exports.seedProblemsIfEmpty = seedProblemsIfEmpty;
const listProblems = async (query) => {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(20, Math.max(1, Number(query.limit ?? 10)));
    const cacheKey = `problems:${crypto_1.default.createHash('sha1').update(JSON.stringify(query)).digest('hex')}`;
    const seeded = await (0, exports.seedProblemsIfEmpty)();
    const cached = seeded ? null : await redis_1.redis.get(cacheKey);
    if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        if (parsed.total > 0 || (await problem_model_1.Problem.countDocuments()) === 0) {
            return parsed;
        }
    }
    const filter = { publicationStatus: 'published' };
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
        .sort({ isVerified: -1, claimStatus: 1, createdAt: -1 })
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
    const problem = await problem_model_1.Problem.findOne({ _id: id, publicationStatus: 'published' }).lean();
    if (!problem) {
        throw new ApiError_1.ApiError(404, 'PROBLEM_NOT_FOUND', 'Problem not found');
    }
    return problem;
};
exports.getProblemById = getProblemById;
const listAdminProblems = async () => problem_model_1.Problem.find({})
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();
exports.listAdminProblems = listAdminProblems;
const createAdminProblem = async (adminId, payload) => {
    const created = await problem_model_1.Problem.create({
        ...normalizeProblemInput(payload),
        createdByAdminId: new mongoose_1.Types.ObjectId(adminId),
    });
    await clearProblemCaches();
    return created.toObject();
};
exports.createAdminProblem = createAdminProblem;
const updateAdminProblem = async (problemId, payload) => {
    const problem = await problem_model_1.Problem.findById(problemId);
    if (!problem) {
        throw new ApiError_1.ApiError(404, 'PROBLEM_NOT_FOUND', 'Problem not found');
    }
    Object.assign(problem, {
        ...payload,
        ...(payload.sponsorName !== undefined
            ? {
                postedBy: payload.sponsorName.trim() || 'ProMove Admin',
            }
            : {}),
    });
    if (payload.publicationStatus === 'archived') {
        problem.claimStatus = problem.claimedBy ? 'completed' : 'open';
    }
    await problem.save();
    await clearProblemCaches();
    return problem.toObject();
};
exports.updateAdminProblem = updateAdminProblem;
const claimProblem = async (problemId, userId) => {
    const activeCount = await workspace_model_1.Workspace.countDocuments({ ownerId: userId, isActive: true });
    if (activeCount >= 3) {
        throw new ApiError_1.ApiError(400, 'WORKSPACE_LIMIT_REACHED', 'You can only have 3 active workspaces.');
    }
    const claimedAt = new Date();
    const problem = await problem_model_1.Problem.findOneAndUpdate({
        _id: problemId,
        publicationStatus: 'published',
        claimStatus: 'open',
        $or: [{ claimedBy: { $exists: false } }, { claimedBy: null }],
    }, {
        $set: {
            claimedBy: new mongoose_1.Types.ObjectId(userId),
            claimedAt,
            claimStatus: 'claimed',
        },
    }, { new: true });
    if (!problem) {
        const existing = await problem_model_1.Problem.findById(problemId).lean();
        if (!existing || existing.publicationStatus !== 'published') {
            throw new ApiError_1.ApiError(404, 'PROBLEM_NOT_FOUND', 'Problem not found');
        }
        if (existing.claimedBy) {
            throw new ApiError_1.ApiError(400, 'PROBLEM_ALREADY_CLAIMED', 'This problem is already claimed by another student.');
        }
        throw new ApiError_1.ApiError(400, 'PROBLEM_NOT_AVAILABLE', 'This problem is not available for claiming.');
    }
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
    await clearProblemCaches();
    return workspace.toObject();
};
exports.claimProblem = claimProblem;
