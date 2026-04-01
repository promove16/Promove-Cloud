"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewProblemSubmission = exports.listProblemReviewRequests = exports.listProblemLeaderboard = exports.requestProblemReview = exports.claimProblem = exports.deleteAdminProblem = exports.updateAdminProblem = exports.createAdminProblem = exports.listAdminProblems = exports.getProblemById = exports.listProblems = exports.seedProblemsIfEmpty = exports.reviewProblemSubmissionSchema = exports.listProblemReviewRequestsQuerySchema = exports.createProblemReviewRequestSchema = exports.updateProblemSchema = exports.createProblemSchema = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = require("mongoose");
const zod_1 = require("zod");
const logger_1 = require("../../config/logger");
const redis_1 = require("../../config/redis");
const ApiError_1 = require("../../utils/ApiError");
const scoreEngine_1 = require("../../services/scoreEngine");
const notification_service_1 = require("../notification/notification.service");
const user_model_1 = require("../user/user.model");
const workspace_model_1 = require("../workspace/workspace.model");
const problem_model_1 = require("./problem.model");
const problemSubmission_model_1 = require("./problemSubmission.model");
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
exports.createProblemReviewRequestSchema = zod_1.z.object({
    workspaceId: zod_1.z.string().trim().min(1),
    requestNote: zod_1.z.string().trim().min(20).max(1000),
});
exports.listProblemReviewRequestsQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(['review_requested', 'changes_requested', 'approved']).optional(),
});
exports.reviewProblemSubmissionSchema = zod_1.z
    .object({
    decision: zod_1.z.enum(['approved', 'changes_requested']),
    adminNotes: zod_1.z.string().trim().min(3).max(500).optional(),
    pointsAwarded: zod_1.z.number().int().min(1).max(100).optional(),
})
    .superRefine((value, ctx) => {
    if (value.decision === 'approved' && value.pointsAwarded === undefined) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['pointsAwarded'],
            message: 'pointsAwarded is required when approving a submission',
        });
    }
});
const clearProblemCaches = async () => {
    const redisClient = redis_1.redis;
    const scan = typeof redisClient.scan === 'function' ? redisClient.scan.bind(redisClient) : null;
    if (!scan) {
        return;
    }
    try {
        let cursor = '0';
        const keys = [];
        do {
            const [nextCursor, batch] = await scan(cursor);
            cursor = nextCursor;
            batch.forEach((key) => {
                if (key.startsWith('problems:') || key.startsWith('problem:')) {
                    keys.push(key);
                }
            });
        } while (cursor !== '0');
        if (keys.length > 0) {
            await Promise.all(keys.map((key) => redis_1.redis.del(key)));
        }
    }
    catch (error) {
        (0, logger_1.logError)('Failed to clear problem caches', error);
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
const ensurePublishedProblem = async (problemId) => {
    const problem = await problem_model_1.Problem.findOne({ _id: problemId, publicationStatus: 'published' }).lean();
    if (!problem) {
        throw new ApiError_1.ApiError(404, 'PROBLEM_NOT_FOUND', 'Problem not found');
    }
    return problem;
};
const getReviewEvidenceCount = (workspace) => (workspace.uploads?.length ?? 0) +
    (workspace.repoSubmissions?.length ?? 0) +
    (workspace.codeSubmissions?.length ?? 0) +
    (workspace.progressUpdates?.length ?? 0) +
    ((workspace.progressPercent ?? 0) >= 100 ? 1 : 0);
const getUniqueTeamMemberIds = (workspace) => Array.from(new Set([String(workspace.ownerId), ...workspace.teamMemberIds.map((memberId) => String(memberId))]));
const buildProblemViews = async (problems, userId) => {
    if (problems.length === 0) {
        return [];
    }
    const problemIds = problems.map((problem) => problem._id);
    const cacheKey = `problems:view:${crypto_1.default
        .createHash('sha1')
        .update(JSON.stringify({ problemIds, userId }))
        .digest('hex')}`;
    const cached = await redis_1.redis.get(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }
    const [viewerWorkspaces, activeWorkspaceCounts, approvedSubmissionStats] = await Promise.all([
        workspace_model_1.Workspace.find({
            claimedProblemId: { $in: problemIds },
            isActive: true,
            $or: [{ ownerId: userId }, { teamMemberIds: userId }],
        })
            .select('_id claimedProblemId ownerId teamMemberIds progressPercent updatedAt')
            .sort({ updatedAt: -1 })
            .lean(),
        workspace_model_1.Workspace.aggregate([
            {
                $match: {
                    claimedProblemId: { $in: problemIds },
                    isActive: true,
                },
            },
            {
                $group: {
                    _id: '$claimedProblemId',
                    count: { $sum: 1 },
                },
            },
        ]),
        problemSubmission_model_1.ProblemSubmission.aggregate([
            {
                $match: {
                    problemId: { $in: problemIds },
                    reviewStatus: 'approved',
                },
            },
            {
                $group: {
                    _id: '$problemId',
                    approvedTeamsCount: { $sum: 1 },
                    topPointsAwarded: { $max: '$pointsAwarded' },
                },
            },
        ]),
    ]);
    const viewerWorkspaceByProblemId = new Map();
    viewerWorkspaces.forEach((workspace) => {
        const problemId = String(workspace.claimedProblemId);
        if (!viewerWorkspaceByProblemId.has(problemId)) {
            viewerWorkspaceByProblemId.set(problemId, workspace);
        }
    });
    const viewerWorkspaceIds = viewerWorkspaces.map((workspace) => workspace._id);
    const viewerSubmissions = viewerWorkspaceIds.length > 0
        ? await problemSubmission_model_1.ProblemSubmission.find({ workspaceId: { $in: viewerWorkspaceIds } })
            .sort({ updatedAt: -1 })
            .lean()
        : [];
    const viewerSubmissionByWorkspaceId = new Map(viewerSubmissions.map((submission) => [String(submission.workspaceId), submission]));
    const activeWorkspaceCountByProblemId = new Map(activeWorkspaceCounts.map((entry) => [String(entry._id), entry.count]));
    const approvedSubmissionStatsByProblemId = new Map(approvedSubmissionStats.map((entry) => [String(entry._id), entry]));
    const payload = problems.map((problem) => {
        const viewerWorkspace = viewerWorkspaceByProblemId.get(String(problem._id));
        const viewerSubmission = viewerWorkspace
            ? viewerSubmissionByWorkspaceId.get(String(viewerWorkspace._id))
            : null;
        const approvedStats = approvedSubmissionStatsByProblemId.get(String(problem._id));
        return {
            ...problem,
            stats: {
                activeTeamsCount: activeWorkspaceCountByProblemId.get(String(problem._id)) ?? 0,
                approvedTeamsCount: approvedStats?.approvedTeamsCount ?? 0,
                topPointsAwarded: approvedStats?.topPointsAwarded ?? 0,
            },
            viewerState: viewerWorkspace
                ? {
                    workspaceId: String(viewerWorkspace._id),
                    status: viewerSubmission?.reviewStatus ?? 'in_progress',
                    progressPercent: viewerWorkspace.progressPercent,
                    teamSize: getUniqueTeamMemberIds(viewerWorkspace).length,
                    ...(viewerSubmission
                        ? {
                            submissionId: String(viewerSubmission._id),
                            requestedAt: viewerSubmission.requestedAt,
                            reviewedAt: viewerSubmission.adminReviewedAt,
                            pointsAwarded: viewerSubmission.pointsAwarded,
                            adminNotes: viewerSubmission.adminNotes,
                        }
                        : {}),
                }
                : null,
        };
    });
    await redis_1.redis.set(cacheKey, JSON.stringify(payload), { ex: 120 });
    return payload;
};
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
        constraints: ['No sharing of secrets', 'No production data uploads', 'Teams are ranked after admin review'],
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
const listProblems = async (query, userId) => {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(20, Math.max(1, Number(query.limit ?? 10)));
    const cacheKey = `problems:${crypto_1.default
        .createHash('sha1')
        .update(JSON.stringify({ ...query, userId }))
        .digest('hex')}`;
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
    const [problems, total] = await Promise.all([
        problem_model_1.Problem.find(filter)
            .sort({ isVerified: -1, createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        problem_model_1.Problem.countDocuments(filter),
    ]);
    const items = await buildProblemViews(problems, userId);
    const payload = { items, nextPage: page * limit < total ? page + 1 : null, total };
    await redis_1.redis.set(cacheKey, JSON.stringify(payload), { ex: 120 });
    return payload;
};
exports.listProblems = listProblems;
const getProblemById = async (id, userId) => {
    const problem = await ensurePublishedProblem(id);
    const [problemView] = await buildProblemViews([problem], userId);
    return problemView;
};
exports.getProblemById = getProblemById;
const listAdminProblems = async () => {
    const problems = await problem_model_1.Problem.find({}).sort({ updatedAt: -1, createdAt: -1 }).lean();
    if (problems.length === 0) {
        return [];
    }
    const problemIds = problems.map((problem) => problem._id);
    const [workspaceCounts, submissionCounts] = await Promise.all([
        workspace_model_1.Workspace.aggregate([
            {
                $match: {
                    claimedProblemId: { $in: problemIds },
                },
            },
            {
                $group: {
                    _id: '$claimedProblemId',
                    count: { $sum: 1 },
                },
            },
        ]),
        problemSubmission_model_1.ProblemSubmission.aggregate([
            {
                $match: {
                    problemId: { $in: problemIds },
                },
            },
            {
                $group: {
                    _id: '$problemId',
                    reviewRequestedCount: {
                        $sum: {
                            $cond: [{ $eq: ['$reviewStatus', 'review_requested'] }, 1, 0],
                        },
                    },
                    approvedCount: {
                        $sum: {
                            $cond: [{ $eq: ['$reviewStatus', 'approved'] }, 1, 0],
                        },
                    },
                },
            },
        ]),
    ]);
    const workspaceCountByProblemId = new Map(workspaceCounts.map((entry) => [String(entry._id), entry.count]));
    const submissionCountByProblemId = new Map(submissionCounts.map((entry) => [String(entry._id), entry]));
    return problems.map((problem) => ({
        ...problem,
        stats: {
            activeTeamsCount: workspaceCountByProblemId.get(String(problem._id)) ?? 0,
            reviewRequestedCount: submissionCountByProblemId.get(String(problem._id))?.reviewRequestedCount ?? 0,
            approvedTeamsCount: submissionCountByProblemId.get(String(problem._id))?.approvedCount ?? 0,
        },
    }));
};
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
    await problem.save();
    await clearProblemCaches();
    return problem.toObject();
};
exports.updateAdminProblem = updateAdminProblem;
const deleteAdminProblem = async (problemId) => {
    const [problem, existingWorkspace, existingSubmission] = await Promise.all([
        problem_model_1.Problem.findById(problemId),
        workspace_model_1.Workspace.exists({ claimedProblemId: problemId }),
        problemSubmission_model_1.ProblemSubmission.exists({ problemId }),
    ]);
    if (!problem) {
        throw new ApiError_1.ApiError(404, 'PROBLEM_NOT_FOUND', 'Problem not found');
    }
    if (existingWorkspace || existingSubmission) {
        throw new ApiError_1.ApiError(400, 'PROBLEM_HAS_ACTIVITY', 'This problem already has workspace or review activity and cannot be deleted.');
    }
    await problem.deleteOne();
    await clearProblemCaches();
    return { deleted: true };
};
exports.deleteAdminProblem = deleteAdminProblem;
const claimProblem = async (problemId, userId) => {
    const [activeCount, problem, existingWorkspace] = await Promise.all([
        workspace_model_1.Workspace.countDocuments({ ownerId: userId, isActive: true }),
        problem_model_1.Problem.findOne({ _id: problemId, publicationStatus: 'published' }).lean(),
        workspace_model_1.Workspace.findOne({
            ownerId: userId,
            claimedProblemId: problemId,
            isActive: true,
        }).lean(),
    ]);
    if (!problem) {
        throw new ApiError_1.ApiError(404, 'PROBLEM_NOT_FOUND', 'Problem not found');
    }
    if (existingWorkspace) {
        throw new ApiError_1.ApiError(400, 'PROBLEM_ALREADY_STARTED', 'You already started this problem in an active workspace.');
    }
    if (activeCount >= 3) {
        throw new ApiError_1.ApiError(400, 'WORKSPACE_LIMIT_REACHED', 'You can only have 3 active workspaces.');
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
const requestProblemReview = async (problemId, userId, payload) => {
    await ensurePublishedProblem(problemId);
    const workspace = await workspace_model_1.Workspace.findOne({
        _id: payload.workspaceId,
        claimedProblemId: problemId,
        isActive: true,
        $or: [{ ownerId: userId }, { teamMemberIds: userId }],
    }).select('_id ownerId teamMemberIds uploads repoSubmissions codeSubmissions progressUpdates progressPercent claimedProblemId');
    if (!workspace) {
        throw new ApiError_1.ApiError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found for this problem.');
    }
    if (getReviewEvidenceCount(workspace) === 0) {
        throw new ApiError_1.ApiError(400, 'REVIEW_EVIDENCE_REQUIRED', 'Add progress evidence in the workspace before requesting admin review.');
    }
    const existingSubmission = await problemSubmission_model_1.ProblemSubmission.findOne({
        problemId,
        workspaceId: workspace._id,
    });
    if (existingSubmission?.reviewStatus === 'review_requested') {
        throw new ApiError_1.ApiError(400, 'REVIEW_ALREADY_REQUESTED', 'This problem is already waiting for admin review.');
    }
    if (existingSubmission?.reviewStatus === 'approved') {
        throw new ApiError_1.ApiError(400, 'PROBLEM_ALREADY_APPROVED', 'This problem has already been approved for the selected workspace.');
    }
    const uniqueTeamMemberIds = getUniqueTeamMemberIds(workspace).map((memberId) => new mongoose_1.Types.ObjectId(memberId));
    const now = new Date();
    const submission = existingSubmission ??
        new problemSubmission_model_1.ProblemSubmission({
            problemId: new mongoose_1.Types.ObjectId(problemId),
            workspaceId: workspace._id,
        });
    submission.ownerId = workspace.ownerId;
    submission.teamMemberIds = uniqueTeamMemberIds;
    submission.submittedBy = new mongoose_1.Types.ObjectId(userId);
    submission.requestNote = payload.requestNote;
    submission.reviewStatus = 'review_requested';
    submission.requestedAt = now;
    submission.adminReviewedAt = undefined;
    submission.adminReviewedBy = undefined;
    submission.adminNotes = undefined;
    submission.pointsAwarded = 0;
    await submission.save();
    await clearProblemCaches();
    return submission.toObject();
};
exports.requestProblemReview = requestProblemReview;
const listProblemLeaderboard = async (problemId) => {
    await ensurePublishedProblem(problemId);
    const submissions = await problemSubmission_model_1.ProblemSubmission.find({
        problemId,
        reviewStatus: 'approved',
    })
        .sort({ pointsAwarded: -1, adminReviewedAt: 1, createdAt: 1 })
        .lean();
    const workspaceIds = Array.from(new Set(submissions.map((submission) => String(submission.workspaceId))));
    const teamMemberIds = Array.from(new Set(submissions.flatMap((submission) => submission.teamMemberIds.map((memberId) => String(memberId)))));
    const [workspaces, users] = await Promise.all([
        workspaceIds.length > 0
            ? workspace_model_1.Workspace.find({ _id: { $in: workspaceIds } }).select('_id title').lean()
            : Promise.resolve([]),
        teamMemberIds.length > 0
            ? user_model_1.User.find({ _id: { $in: teamMemberIds } })
                .select('_id displayName avatar')
                .lean()
            : Promise.resolve([]),
    ]);
    const workspaceById = new Map(workspaces.map((workspace) => [String(workspace._id), workspace]));
    const userById = new Map(users.map((user) => [String(user._id), user]));
    return {
        items: submissions.map((submission, index) => ({
            rank: index + 1,
            submissionId: String(submission._id),
            workspaceId: String(submission.workspaceId),
            teamName: workspaceById.get(String(submission.workspaceId))?.title ?? 'Problem Team',
            pointsAwarded: submission.pointsAwarded,
            reviewedAt: submission.adminReviewedAt ?? submission.updatedAt,
            teamMembers: submission.teamMemberIds
                .map((memberId) => userById.get(String(memberId)))
                .filter((member) => Boolean(member))
                .map((member) => ({
                _id: String(member._id),
                displayName: member.displayName,
                ...(member.avatar ? { avatar: member.avatar } : {}),
            })),
        })),
        total: submissions.length,
    };
};
exports.listProblemLeaderboard = listProblemLeaderboard;
const listProblemReviewRequests = async (status) => {
    const submissions = await problemSubmission_model_1.ProblemSubmission.find(status ? { reviewStatus: status } : {})
        .sort({ requestedAt: -1, createdAt: -1 })
        .lean();
    const problemIds = Array.from(new Set(submissions.map((submission) => String(submission.problemId))));
    const workspaceIds = Array.from(new Set(submissions.map((submission) => String(submission.workspaceId))));
    const userIds = Array.from(new Set(submissions.flatMap((submission) => [
        String(submission.ownerId),
        String(submission.submittedBy),
        ...submission.teamMemberIds.map((memberId) => String(memberId)),
        ...(submission.adminReviewedBy ? [String(submission.adminReviewedBy)] : []),
    ])));
    const [problems, workspaces, users] = await Promise.all([
        problemIds.length > 0
            ? problem_model_1.Problem.find({ _id: { $in: problemIds } })
                .select('_id title category difficulty')
                .lean()
            : Promise.resolve([]),
        workspaceIds.length > 0
            ? workspace_model_1.Workspace.find({ _id: { $in: workspaceIds } })
                .select('_id title progressPercent uploads repoSubmissions codeSubmissions progressUpdates teamMemberIds')
                .lean()
            : Promise.resolve([]),
        userIds.length > 0
            ? user_model_1.User.find({ _id: { $in: userIds } }).select('_id displayName avatar').lean()
            : Promise.resolve([]),
    ]);
    const problemById = new Map(problems.map((problem) => [String(problem._id), problem]));
    const workspaceById = new Map(workspaces.map((workspace) => [String(workspace._id), workspace]));
    const userById = new Map(users.map((user) => [String(user._id), user]));
    return submissions.map((submission) => {
        const workspace = workspaceById.get(String(submission.workspaceId));
        return {
            _id: String(submission._id),
            reviewStatus: submission.reviewStatus,
            requestNote: submission.requestNote,
            requestedAt: submission.requestedAt,
            ...(submission.adminReviewedAt ? { adminReviewedAt: submission.adminReviewedAt } : {}),
            ...(submission.adminNotes ? { adminNotes: submission.adminNotes } : {}),
            pointsAwarded: submission.pointsAwarded,
            problem: {
                _id: String(submission.problemId),
                title: problemById.get(String(submission.problemId))?.title ?? 'Problem',
                category: problemById.get(String(submission.problemId))?.category ?? 'Other',
                difficulty: problemById.get(String(submission.problemId))?.difficulty ?? 'Medium',
            },
            workspace: {
                _id: String(submission.workspaceId),
                title: workspace?.title ?? 'Workspace',
                progressPercent: workspace?.progressPercent ?? 0,
                evidenceSummary: {
                    uploadsCount: workspace?.uploads?.length ?? 0,
                    repoCount: workspace?.repoSubmissions?.length ?? 0,
                    codeCount: workspace?.codeSubmissions?.length ?? 0,
                    progressUpdatesCount: workspace?.progressUpdates?.length ?? 0,
                },
            },
            owner: {
                _id: String(submission.ownerId),
                displayName: userById.get(String(submission.ownerId))?.displayName ?? 'Student',
                ...(userById.get(String(submission.ownerId))?.avatar
                    ? { avatar: userById.get(String(submission.ownerId))?.avatar }
                    : {}),
            },
            submittedBy: {
                _id: String(submission.submittedBy),
                displayName: userById.get(String(submission.submittedBy))?.displayName ?? 'Student',
            },
            teamMembers: submission.teamMemberIds.map((memberId) => ({
                _id: String(memberId),
                displayName: userById.get(String(memberId))?.displayName ?? 'Team member',
                ...(userById.get(String(memberId))?.avatar
                    ? { avatar: userById.get(String(memberId))?.avatar }
                    : {}),
            })),
            ...(submission.adminReviewedBy
                ? {
                    reviewedBy: {
                        _id: String(submission.adminReviewedBy),
                        displayName: userById.get(String(submission.adminReviewedBy))?.displayName ?? 'Admin',
                    },
                }
                : {}),
        };
    });
};
exports.listProblemReviewRequests = listProblemReviewRequests;
const reviewProblemSubmission = async (adminId, submissionId, payload) => {
    const submission = await problemSubmission_model_1.ProblemSubmission.findById(submissionId);
    if (!submission) {
        throw new ApiError_1.ApiError(404, 'REVIEW_REQUEST_NOT_FOUND', 'Problem review request not found');
    }
    if (payload.decision === 'approved' && submission.reviewStatus === 'approved') {
        throw new ApiError_1.ApiError(400, 'REVIEW_ALREADY_APPROVED', 'This submission has already been approved.');
    }
    const [problem, workspace] = await Promise.all([
        problem_model_1.Problem.findById(submission.problemId).select('_id title').lean(),
        workspace_model_1.Workspace.findById(submission.workspaceId).select('_id title').lean(),
    ]);
    if (!problem || !workspace) {
        throw new ApiError_1.ApiError(400, 'REVIEW_CONTEXT_INVALID', 'The problem or workspace linked to this review request no longer exists.');
    }
    submission.reviewStatus =
        payload.decision === 'approved' ? 'approved' : 'changes_requested';
    submission.adminReviewedAt = new Date();
    submission.adminReviewedBy = new mongoose_1.Types.ObjectId(adminId);
    submission.adminNotes =
        payload.decision === 'changes_requested'
            ? payload.adminNotes?.trim() || 'Please update the submission and request review again.'
            : payload.adminNotes?.trim() || undefined;
    submission.pointsAwarded =
        payload.decision === 'approved' ? payload.pointsAwarded ?? 0 : 0;
    await submission.save();
    const teamMemberIds = Array.from(new Set(submission.teamMemberIds.map((memberId) => String(memberId))));
    if (payload.decision === 'approved') {
        await Promise.all(teamMemberIds.map(async (memberId) => {
            await (0, scoreEngine_1.applyScore)({
                userId: memberId,
                trigger: 'PROBLEM_COMPLETED',
                metadata: {
                    adminId,
                    problemId: String(problem._id),
                    submissionId: String(submission._id),
                    workspaceId: String(workspace._id),
                    pointsAwarded: submission.pointsAwarded,
                },
            });
            await notification_service_1.NotificationService.create({
                userId: memberId,
                type: 'system',
                title: 'Problem review approved',
                body: `${problem.title} was approved. Your team earned ${submission.pointsAwarded} points on the problem leaderboard.`,
                link: '/problem-bank',
            });
        }));
    }
    else {
        await Promise.all(teamMemberIds.map((memberId) => notification_service_1.NotificationService.create({
            userId: memberId,
            type: 'system',
            title: 'Problem review needs changes',
            body: submission.adminNotes ||
                `The admin team asked for changes on ${problem.title}.`,
            link: `/product-workspace/${workspace._id}`,
        })));
    }
    await clearProblemCaches();
    return {
        _id: String(submission._id),
        reviewStatus: submission.reviewStatus,
        pointsAwarded: submission.pointsAwarded,
        ...(submission.adminNotes ? { adminNotes: submission.adminNotes } : {}),
        adminReviewedAt: submission.adminReviewedAt,
    };
};
exports.reviewProblemSubmission = reviewProblemSubmission;
