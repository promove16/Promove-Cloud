import crypto from 'crypto';
import { Types } from 'mongoose';
import { z } from 'zod';
import { logError, logger } from '../../config/logger';
import { redis } from '../../config/redis';
import { ApiError } from '../../utils/ApiError';
import { applyScore } from '../../services/scoreEngine';
import { NotificationService } from '../notification/notification.service';
import { User } from '../user/user.model';
import { Workspace } from '../workspace/workspace.model';
import problemBankSeedData from './problemBank.seed.json';
import { Problem } from './problem.model';
import { ProblemSubmission } from './problemSubmission.model';
import { PROBLEM_CATEGORIES, ProblemCategory, ProblemDifficulty } from './problem.types';

const defaultSecurityNotice =
  'Upload only project-safe evidence. Do not share secrets, credentials, private keys, personal data, or production database exports.';

const PROBLEM_CACHE_NON_FATAL_PATTERNS = [
  /max requests limit exceeded/i,
  /stream isn't writeable/i,
  /connection is closed/i,
  /connection lost/i,
  /socket closed unexpectedly/i,
  /ready check failed/i,
  /econnrefused/i,
  /econnreset/i,
  /etimedout/i,
  /enotfound/i,
  /network is unreachable/i,
  /connection ended unexpectedly/i,
] as const;

let problemCacheDisabledReason: string | null = null;

type ProblemBankSeedRecord = {
  sourceCategorySequence: number;
  sourceCategoryNumber: number;
  sourceCategory: string;
  sourcePage: number;
  number: number;
  title: string;
  problem: string;
  solution: string;
  aiTools: string;
  market: string;
  reference: string;
};

const seedProblemRecords = problemBankSeedData as ProblemBankSeedRecord[];

const problemCategorySet = new Set<string>(PROBLEM_CATEGORIES);

const legacyCategoryMap: Partial<Record<string, ProblemCategory>> = {
  Agriculture: 'Agriculture & AgriTech',
  Environment: 'Renewable Energy & Sustainability',
  Healthcare: 'Healthcare & MedTech',
  Education: 'Education & Skill Development (EdTech)',
  Technology: 'Smart Cities & Infrastructure',
  'Rural Development': 'Agriculture & AgriTech',
};

const resolveProblemCategory = (
  category?: string | null,
  domain?: string | null,
): ProblemCategory => {
  if (domain && problemCategorySet.has(domain)) {
    return domain as ProblemCategory;
  }

  if (category && problemCategorySet.has(category)) {
    return category as ProblemCategory;
  }

  if (category && legacyCategoryMap[category]) {
    return legacyCategoryMap[category];
  }

  if (domain) {
    const normalizedDomain = domain.toLowerCase();

    if (/(transport|mobility|traffic|logistics)/i.test(normalizedDomain)) {
      return 'Transportation & Mobility';
    }
    if (/(finance|financial|fintech|bank|payment|credit|insurance)/i.test(normalizedDomain)) {
      return 'Finance & Financial Inclusion (FinTech)';
    }
    if (/(manufactur|industry|factory|industrial|supply chain)/i.test(normalizedDomain)) {
      return 'Manufacturing & Industry 4.0';
    }
    if (/(energy|climate|sustain|environment|renewable)/i.test(normalizedDomain)) {
      return 'Renewable Energy & Sustainability';
    }
    if (/(health|med|clinical|hospital|care)/i.test(normalizedDomain)) {
      return 'Healthcare & MedTech';
    }
    if (/(education|skill|learning|edtech)/i.test(normalizedDomain)) {
      return 'Education & Skill Development (EdTech)';
    }
    if (/(agri|farm|crop|food|rural)/i.test(normalizedDomain)) {
      return 'Agriculture & AgriTech';
    }
  }

  return 'Smart Cities & Infrastructure';
};

const defaultSeedDifficulty: ProblemDifficulty = 'Medium';

const arrayField = (maxItems: number, itemMax = 160) =>
  z.array(z.string().trim().min(1).max(itemMax)).max(maxItems).default([]);

const submissionConfigSchema = z.object({
  allowDocuments: z.boolean().default(true),
  allowImages: z.boolean().default(true),
  allowGithubRepos: z.boolean().default(true),
  allowCodeSnippets: z.boolean().default(true),
  maxFileSizeMb: z.number().int().min(1).max(25).default(10),
  maxRepoLinks: z.number().int().min(0).max(10).default(3),
  maxCodeSnippets: z.number().int().min(0).max(20).default(5),
  codeExecutionAllowed: z.literal(false).default(false),
});

export const createProblemSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(20).max(1200),
  category: z.enum(PROBLEM_CATEGORIES),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  domain: z.string().trim().min(2).max(120),
  tags: arrayField(12, 40),
  isVerified: z.boolean().default(true),
  sponsorName: z.string().trim().min(2).max(160).optional(),
  geography: z.string().trim().min(2).max(160).optional(),
  targetBeneficiaries: arrayField(10, 80),
  impactGoal: z.string().trim().min(2).max(500).optional(),
  expectedOutcome: z.string().trim().min(2).max(500).optional(),
  deliverables: arrayField(10, 200),
  acceptanceCriteria: arrayField(10, 200),
  constraints: arrayField(10, 200),
  resourceLinks: z.array(z.string().trim().url().max(300)).max(10).default([]),
  securityNotice: z.string().trim().min(10).max(500).default(defaultSecurityNotice),
  publicationStatus: z.enum(['draft', 'published', 'archived']).default('published'),
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

export const updateProblemSchema = createProblemSchema.partial();

export const createProblemReviewRequestSchema = z.object({
  workspaceId: z.string().trim().min(1),
  requestNote: z.string().trim().min(20).max(1000),
});

export const listProblemReviewRequestsQuerySchema = z.object({
  status: z.enum(['review_requested', 'changes_requested', 'approved']).optional(),
});

export const reviewProblemSubmissionSchema = z
  .object({
    decision: z.enum(['approved', 'changes_requested']),
    adminNotes: z.string().trim().min(3).max(500).optional(),
    pointsAwarded: z.number().int().min(1).max(100).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === 'approved' && value.pointsAwarded === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pointsAwarded'],
        message: 'pointsAwarded is required when approving a submission',
      });
    }
  });

type ProblemViewWorkspace = {
  _id: Types.ObjectId;
  claimedProblemId?: Types.ObjectId;
  ownerId: Types.ObjectId;
  teamMemberIds: Types.ObjectId[];
  progressPercent: number;
  updatedAt: Date;
};

export const clearProblemCaches = async () => {
  if (process.env.PROMOVE_SKIP_PROBLEM_CACHE_CLEAR === 'true') {
    return;
  }

  const redisClient = redis as unknown as {
    scan?: (
      cursor: string,
      options?: { match?: string; count?: number },
    ) => Promise<[string, string[]]>;
  };
  const scan = typeof redisClient.scan === 'function' ? redisClient.scan.bind(redisClient) : null;

  if (!scan) {
    return;
  }

  try {
    const keys: string[] = [];
    const patterns = ['problems:*', 'problem:*'];

    for (const pattern of patterns) {
      let cursor = '0';
      let iterations = 0;

      do {
        const [nextCursor, batch] = await scan(cursor, { match: pattern, count: 100 });
        cursor = nextCursor;
        keys.push(...batch);
        iterations += 1;
      } while (cursor !== '0' && iterations < 50);
    }

    if (keys.length > 0) {
      await Promise.all(Array.from(new Set(keys)).map((key) => redis.del(key)));
    }
  } catch (error) {
    logError('Failed to clear problem caches', error);
  }
};

const normalizeProblemInput = (payload: z.infer<typeof createProblemSchema>) => ({
  ...payload,
  category: resolveProblemCategory(payload.category, payload.domain),
  postedBy: payload.sponsorName?.trim() || 'ProMove Admin',
  targetBeneficiaries: payload.targetBeneficiaries ?? [],
  deliverables: payload.deliverables ?? [],
  acceptanceCriteria: payload.acceptanceCriteria ?? [],
  constraints: payload.constraints ?? [],
  resourceLinks: payload.resourceLinks ?? [],
  submissionConfig: payload.submissionConfig,
  claimStatus: 'open' as const,
  maxClaims: Number.MAX_SAFE_INTEGER,
});

const isProblemCacheBypassError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return PROBLEM_CACHE_NON_FATAL_PATTERNS.some((pattern) => pattern.test(message));
};

const disableProblemCache = (error: unknown) => {
  if (problemCacheDisabledReason) {
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  problemCacheDisabledReason = message;
  logger.warn(
    `Problem-bank Redis cache disabled. Falling back to database-only responses. Reason: ${message}`,
  );
};

const canUseProblemCache = () => problemCacheDisabledReason === null;

const readProblemCache = async <T>(key: string): Promise<T | null> => {
  if (!canUseProblemCache()) {
    return null;
  }

  try {
    const cached = await redis.get<string>(key);
    if (!cached) {
      return null;
    }

    return (typeof cached === 'string' ? JSON.parse(cached) : cached) as T;
  } catch (error) {
    if (isProblemCacheBypassError(error)) {
      disableProblemCache(error);
      return null;
    }

    logError(`Failed to read problem cache key "${key}"`, error);
    return null;
  }
};

const writeProblemCache = async (key: string, payload: unknown, ttlSeconds = 120) => {
  if (!canUseProblemCache()) {
    return;
  }

  try {
    await redis.set(key, JSON.stringify(payload), { ex: ttlSeconds });
  } catch (error) {
    if (isProblemCacheBypassError(error)) {
      disableProblemCache(error);
      return;
    }

    logError(`Failed to write problem cache key "${key}"`, error);
  }
};

const trimField = (value: string, maxLength: number) =>
  value.length > maxLength ? value.slice(0, maxLength - 1).trimEnd() : value;

const getSeedTags = (record: ProblemBankSeedRecord) => {
  const rawTags = [
    record.sourceCategory,
    ...record.aiTools.split(','),
    ...record.title.split(/\s+/).filter((part) => part.length > 4),
  ];

  return Array.from(
    new Set(
      rawTags
        .map((tag) => trimField(tag.trim(), 40))
        .filter((tag) => tag.length > 0),
    ),
  ).slice(0, 12);
};

const buildSeedProblemDocuments = () =>
  seedProblemRecords.map((record) => {
    const category = resolveProblemCategory(record.sourceCategory, record.sourceCategory);
    const sourceRef = `Problem Bank version 01, category ${record.sourceCategoryNumber}, item ${record.number}, page ${record.sourcePage}`;

    return {
      title: record.title,
      description: trimField(
        `Problem: ${record.problem} Solution hint: ${record.solution} AI tools: ${record.aiTools} Market scope: ${record.market} Reference: ${record.reference}.`,
        1200,
      ),
      category,
      difficulty: defaultSeedDifficulty,
      domain: record.sourceCategory,
      tags: getSeedTags(record),
      isVerified: true,
      postedBy: 'ProMove IP Bank',
      sponsorName: 'ProMove IP Bank',
      geography: 'Global',
      targetBeneficiaries: ['Student innovators', trimField(record.market, 80)],
      impactGoal: trimField(`Build a practical solution for: ${record.problem}.`, 500),
      expectedOutcome: trimField(`Prototype or validated concept for: ${record.solution}.`, 500),
      deliverables: [
        'Problem analysis',
        'Prototype or proof of concept',
        'AI tools and implementation plan',
        'Market validation summary',
      ],
      acceptanceCriteria: [
        trimField(`Addresses the source problem: ${record.problem}.`, 200),
        trimField(`Demonstrates the solution hint: ${record.solution}.`, 200),
        trimField(`Documents an AI tools plan: ${record.aiTools}.`, 200),
      ],
      constraints: [
        'Use only project-safe datasets and anonymized evidence.',
        trimField(`Validate feasibility for market scope: ${record.market}.`, 200),
        sourceRef,
      ],
      resourceLinks: [],
      securityNotice: defaultSecurityNotice,
      publicationStatus: 'published' as const,
      claimStatus: 'open' as const,
      maxClaims: Number.MAX_SAFE_INTEGER,
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
    };
  });

const ensurePublishedProblem = async (problemId: string) => {
  const problem = await Problem.findOne({ _id: problemId, publicationStatus: 'published' }).lean();
  if (!problem) {
    throw new ApiError(404, 'PROBLEM_NOT_FOUND', 'Problem not found');
  }
  return problem;
};

const getReviewEvidenceCount = (workspace: {
  uploads?: unknown[];
  repoSubmissions?: unknown[];
  codeSubmissions?: unknown[];
  progressUpdates?: unknown[];
  progressPercent?: number;
}) =>
  (workspace.uploads?.length ?? 0) +
  (workspace.repoSubmissions?.length ?? 0) +
  (workspace.codeSubmissions?.length ?? 0) +
  (workspace.progressUpdates?.length ?? 0) +
  ((workspace.progressPercent ?? 0) >= 100 ? 1 : 0);

const getUniqueTeamMemberIds = (workspace: {
  ownerId: Types.ObjectId;
  teamMemberIds: Types.ObjectId[];
}) =>
  Array.from(
    new Set([String(workspace.ownerId), ...workspace.teamMemberIds.map((memberId) => String(memberId))]),
  );

const withTenantScopedClaimState = <T extends Record<string, any>>(problem: T) => ({
  ...problem,
  category: resolveProblemCategory(problem.category, problem.domain),
  claimStatus: 'open' as const,
  maxClaims: Number.MAX_SAFE_INTEGER,
  claimedBy: undefined,
  claimedAt: undefined,
});

const buildProblemViews = async (
  problems: Array<Record<string, any>>,
  userId: string,
) => {
  if (problems.length === 0) {
    return [];
  }

  const problemIds = problems.map((problem) => problem._id);
  const cacheKey = `problems:view:${crypto
    .createHash('sha1')
    .update(JSON.stringify({ problemIds, userId }))
    .digest('hex')}`;
  const cached = await readProblemCache<Array<Record<string, unknown>>>(cacheKey);

  if (cached) {
    return cached;
  }

  const [viewerWorkspaces, activeWorkspaceCounts, approvedSubmissionStats] =
    await Promise.all([
      Workspace.find({
        claimedProblemId: { $in: problemIds },
        isActive: true,
        $or: [{ ownerId: userId }, { teamMemberIds: userId }],
      })
        .select('_id claimedProblemId ownerId teamMemberIds progressPercent updatedAt')
        .sort({ updatedAt: -1 })
        .lean<ProblemViewWorkspace[]>(),
      Workspace.aggregate<{ _id: Types.ObjectId; count: number }>([
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
      ProblemSubmission.aggregate<{
        _id: Types.ObjectId;
        approvedTeamsCount: number;
        topPointsAwarded: number;
      }>([
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

  const viewerWorkspaceByProblemId = new Map<string, ProblemViewWorkspace>();
  viewerWorkspaces.forEach((workspace) => {
    const problemId = String(workspace.claimedProblemId);
    if (!viewerWorkspaceByProblemId.has(problemId)) {
      viewerWorkspaceByProblemId.set(problemId, workspace);
    }
  });

  const viewerWorkspaceIds = viewerWorkspaces.map((workspace) => workspace._id);
  const viewerSubmissions =
    viewerWorkspaceIds.length > 0
      ? await ProblemSubmission.find({ workspaceId: { $in: viewerWorkspaceIds } })
          .sort({ updatedAt: -1 })
          .lean()
      : [];
  const viewerSubmissionByWorkspaceId = new Map(
    viewerSubmissions.map((submission) => [String(submission.workspaceId), submission]),
  );

  const activeWorkspaceCountByProblemId = new Map(
    activeWorkspaceCounts.map((entry) => [String(entry._id), entry.count]),
  );
  const approvedSubmissionStatsByProblemId = new Map(
    approvedSubmissionStats.map((entry) => [String(entry._id), entry]),
  );

  const payload = problems.map((problem) => {
    const viewerWorkspace = viewerWorkspaceByProblemId.get(String(problem._id));
    const viewerSubmission = viewerWorkspace
      ? viewerSubmissionByWorkspaceId.get(String(viewerWorkspace._id))
      : null;
    const approvedStats = approvedSubmissionStatsByProblemId.get(String(problem._id));

    return {
      ...withTenantScopedClaimState(problem),
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

  await writeProblemCache(cacheKey, payload);
  return payload;
};

export const seedProblemsIfEmpty = async () => {
  const count = await Problem.countDocuments();
  if (count > 0) {
    return false;
  }

  await Problem.insertMany(buildSeedProblemDocuments());
  await clearProblemCaches();

  return true;
};

export const listProblems = async (query: Record<string, unknown>, userId: string) => {
  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(20, Math.max(1, Number(query.limit ?? 10)));
  const cacheKey = `problems:${crypto
    .createHash('sha1')
    .update(JSON.stringify({ ...query, userId }))
    .digest('hex')}`;
  const seeded = await seedProblemsIfEmpty();
  const cached = seeded ? null : await readProblemCache<{ items: Array<Record<string, unknown>>; nextPage: number | null; total: number }>(cacheKey);

  if (cached) {
    const parsed = cached;
    if (parsed.total > 0 || (await Problem.countDocuments()) === 0) {
      return parsed;
    }
  }

  const filter: Record<string, unknown> = { publicationStatus: 'published' };
  if (typeof query.category === 'string' && query.category && query.category !== 'All Problems') {
    const category = resolveProblemCategory(query.category, query.category);
    filter.$or = [
      { category },
      { domain: category },
    ];
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
    Problem.find(filter)
      .sort({ isVerified: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Problem.countDocuments(filter),
  ]);

  const items = await buildProblemViews(problems, userId);
  const payload = { items, nextPage: page * limit < total ? page + 1 : null, total };
  await writeProblemCache(cacheKey, payload);
  return payload;
};

export const getProblemById = async (id: string, userId: string) => {
  const problem = await ensurePublishedProblem(id);
  const [problemView] = await buildProblemViews([problem], userId);
  return problemView;
};

export const listAdminProblems = async () => {
  const problems = await Problem.find({}).sort({ updatedAt: -1, createdAt: -1 }).lean();

  if (problems.length === 0) {
    return [];
  }

  const problemIds = problems.map((problem) => problem._id);
  const [workspaceCounts, submissionCounts] = await Promise.all([
    Workspace.aggregate<{ _id: Types.ObjectId; count: number }>([
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
    ProblemSubmission.aggregate<{
      _id: Types.ObjectId;
      reviewRequestedCount: number;
      approvedCount: number;
    }>([
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

  const workspaceCountByProblemId = new Map(
    workspaceCounts.map((entry) => [String(entry._id), entry.count]),
  );
  const submissionCountByProblemId = new Map(
    submissionCounts.map((entry) => [String(entry._id), entry]),
  );

  return problems.map((problem) => ({
    ...withTenantScopedClaimState(problem),
    stats: {
      activeTeamsCount: workspaceCountByProblemId.get(String(problem._id)) ?? 0,
      reviewRequestedCount:
        submissionCountByProblemId.get(String(problem._id))?.reviewRequestedCount ?? 0,
      approvedTeamsCount: submissionCountByProblemId.get(String(problem._id))?.approvedCount ?? 0,
    },
  }));
};

export const createAdminProblem = async (
  adminId: string,
  payload: z.infer<typeof createProblemSchema>,
) => {
  const created = await Problem.create({
    ...normalizeProblemInput(payload),
    createdByAdminId: new Types.ObjectId(adminId),
  });
  await clearProblemCaches();
  return created.toObject();
};

export const updateAdminProblem = async (
  problemId: string,
  payload: z.infer<typeof updateProblemSchema>,
) => {
  const problem = await Problem.findById(problemId);
  if (!problem) {
    throw new ApiError(404, 'PROBLEM_NOT_FOUND', 'Problem not found');
  }

  Object.assign(problem, {
    ...payload,
    ...(payload.category !== undefined || payload.domain !== undefined
      ? {
          category: resolveProblemCategory(
            payload.category ?? problem.category,
            payload.domain ?? problem.domain,
          ),
        }
      : {}),
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

export const deleteAdminProblem = async (problemId: string) => {
  const [problem, existingWorkspace, existingSubmission] = await Promise.all([
    Problem.findById(problemId),
    Workspace.exists({ claimedProblemId: problemId }),
    ProblemSubmission.exists({ problemId }),
  ]);

  if (!problem) {
    throw new ApiError(404, 'PROBLEM_NOT_FOUND', 'Problem not found');
  }

  if (existingWorkspace || existingSubmission) {
    throw new ApiError(
      400,
      'PROBLEM_HAS_ACTIVITY',
      'This problem already has workspace or review activity and cannot be deleted.',
    );
  }

  await problem.deleteOne();
  await clearProblemCaches();
  return { deleted: true };
};

export const claimProblem = async (problemId: string, userId: string) => {
  const [problem, existingWorkspace] = await Promise.all([
    ensurePublishedProblem(problemId),
    Workspace.findOne({
      ownerId: userId,
      claimedProblemId: problemId,
      isActive: true,
    }).lean(),
  ]);

  if (existingWorkspace) {
    return existingWorkspace;
  }

  let workspace;

  try {
    workspace = await Workspace.create({
      ownerId: userId,
      teamMemberIds: [userId],
      claimedProblemId: problem._id,
      title: problem.title,
      category: problem.category,
      stage: 'Problem',
      progressPercent: 0,
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      const duplicateWorkspace = await Workspace.findOne({
        ownerId: userId,
        claimedProblemId: problemId,
        isActive: true,
      }).lean();
      if (duplicateWorkspace) {
        return duplicateWorkspace;
      }
    }
    throw error;
  }

  await clearProblemCaches();

  return workspace.toObject();
};

export const requestProblemReview = async (
  problemId: string,
  userId: string,
  payload: z.infer<typeof createProblemReviewRequestSchema>,
) => {
  await ensurePublishedProblem(problemId);

  const workspace = await Workspace.findOne({
    _id: payload.workspaceId,
    claimedProblemId: problemId,
    isActive: true,
    $or: [{ ownerId: userId }, { teamMemberIds: userId }],
  }).select(
    '_id ownerId teamMemberIds uploads repoSubmissions codeSubmissions progressUpdates progressPercent claimedProblemId',
  );

  if (!workspace) {
    throw new ApiError(
      404,
      'WORKSPACE_NOT_FOUND',
      'Workspace not found for this problem.',
    );
  }

  if (getReviewEvidenceCount(workspace) === 0) {
    throw new ApiError(
      400,
      'REVIEW_EVIDENCE_REQUIRED',
      'Add progress evidence in the workspace before requesting admin review.',
    );
  }

  const existingSubmission = await ProblemSubmission.findOne({
    problemId,
    workspaceId: workspace._id,
  });

  if (existingSubmission?.reviewStatus === 'review_requested') {
    throw new ApiError(
      400,
      'REVIEW_ALREADY_REQUESTED',
      'This problem is already waiting for admin review.',
    );
  }

  if (existingSubmission?.reviewStatus === 'approved') {
    throw new ApiError(
      400,
      'PROBLEM_ALREADY_APPROVED',
      'This problem has already been approved for the selected workspace.',
    );
  }

  const uniqueTeamMemberIds = getUniqueTeamMemberIds(workspace).map((memberId) => new Types.ObjectId(memberId));
  const now = new Date();

  const submission =
    existingSubmission ??
    new ProblemSubmission({
      problemId: new Types.ObjectId(problemId),
      workspaceId: workspace._id,
    });

  submission.ownerId = workspace.ownerId;
  submission.teamMemberIds = uniqueTeamMemberIds;
  submission.submittedBy = new Types.ObjectId(userId);
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

export const listProblemLeaderboard = async (problemId: string) => {
  await ensurePublishedProblem(problemId);

  const submissions = await ProblemSubmission.find({
    problemId,
    reviewStatus: 'approved',
  })
    .sort({ pointsAwarded: -1, adminReviewedAt: 1, createdAt: 1 })
    .lean();

  const workspaceIds = Array.from(new Set(submissions.map((submission) => String(submission.workspaceId))));
  const teamMemberIds = Array.from(
    new Set(submissions.flatMap((submission) => submission.teamMemberIds.map((memberId) => String(memberId)))),
  );

  const [workspaces, users] = await Promise.all([
    workspaceIds.length > 0
      ? Workspace.find({ _id: { $in: workspaceIds } }).select('_id title').lean()
      : Promise.resolve([]),
    teamMemberIds.length > 0
      ? User.find({ _id: { $in: teamMemberIds } })
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
      teamName:
        workspaceById.get(String(submission.workspaceId))?.title ?? 'Problem Team',
      pointsAwarded: submission.pointsAwarded,
      reviewedAt: submission.adminReviewedAt ?? submission.updatedAt,
      teamMembers: submission.teamMemberIds
        .map((memberId) => userById.get(String(memberId)))
        .filter((member): member is NonNullable<typeof member> => Boolean(member))
        .map((member) => ({
          _id: String(member._id),
          displayName: member.displayName,
          ...(member.avatar ? { avatar: member.avatar } : {}),
        })),
    })),
    total: submissions.length,
  };
};

export const listProblemReviewRequests = async (
  status?: z.infer<typeof listProblemReviewRequestsQuerySchema>['status'],
) => {
  const submissions = await ProblemSubmission.find(status ? { reviewStatus: status } : {})
    .sort({ requestedAt: -1, createdAt: -1 })
    .lean();

  const problemIds = Array.from(new Set(submissions.map((submission) => String(submission.problemId))));
  const workspaceIds = Array.from(new Set(submissions.map((submission) => String(submission.workspaceId))));
  const userIds = Array.from(
    new Set(
      submissions.flatMap((submission) => [
        String(submission.ownerId),
        String(submission.submittedBy),
        ...submission.teamMemberIds.map((memberId) => String(memberId)),
        ...(submission.adminReviewedBy ? [String(submission.adminReviewedBy)] : []),
      ]),
    ),
  );

  const [problems, workspaces, users] = await Promise.all([
    problemIds.length > 0
      ? Problem.find({ _id: { $in: problemIds } })
          .select('_id title category domain difficulty')
          .lean()
      : Promise.resolve([]),
    workspaceIds.length > 0
      ? Workspace.find({ _id: { $in: workspaceIds } })
          .select('_id title progressPercent uploads repoSubmissions codeSubmissions progressUpdates teamMemberIds')
          .lean()
      : Promise.resolve([]),
    userIds.length > 0
      ? User.find({ _id: { $in: userIds } }).select('_id displayName avatar').lean()
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
        category: resolveProblemCategory(
          problemById.get(String(submission.problemId))?.category,
          problemById.get(String(submission.problemId))?.domain,
        ),
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
              displayName:
                userById.get(String(submission.adminReviewedBy))?.displayName ?? 'Admin',
            },
          }
        : {}),
    };
  });
};

export const reviewProblemSubmission = async (
  adminId: string,
  submissionId: string,
  payload: z.infer<typeof reviewProblemSubmissionSchema>,
) => {
  const submission = await ProblemSubmission.findById(submissionId);
  if (!submission) {
    throw new ApiError(404, 'REVIEW_REQUEST_NOT_FOUND', 'Problem review request not found');
  }

  if (payload.decision === 'approved' && submission.reviewStatus === 'approved') {
    throw new ApiError(
      400,
      'REVIEW_ALREADY_APPROVED',
      'This submission has already been approved.',
    );
  }

  const [problem, workspace] = await Promise.all([
    Problem.findById(submission.problemId).select('_id title').lean(),
    Workspace.findById(submission.workspaceId).select('_id title').lean(),
  ]);

  if (!problem || !workspace) {
    throw new ApiError(
      400,
      'REVIEW_CONTEXT_INVALID',
      'The problem or workspace linked to this review request no longer exists.',
    );
  }

  submission.reviewStatus =
    payload.decision === 'approved' ? 'approved' : 'changes_requested';
  submission.adminReviewedAt = new Date();
  submission.adminReviewedBy = new Types.ObjectId(adminId);
  submission.adminNotes =
    payload.decision === 'changes_requested'
      ? payload.adminNotes?.trim() || 'Please update the submission and request review again.'
      : payload.adminNotes?.trim() || undefined;
  submission.pointsAwarded =
    payload.decision === 'approved' ? payload.pointsAwarded ?? 0 : 0;
  await submission.save();

  const teamMemberIds = Array.from(
    new Set(submission.teamMemberIds.map((memberId) => String(memberId))),
  );

  if (payload.decision === 'approved') {
    await Promise.all(
      teamMemberIds.map(async (memberId) => {
        await applyScore({
          userId: memberId,
          trigger: 'PROBLEM_COMPLETED',
          metadata: {
            adminId,
            problemId: String(problem._id),
            submissionId: String(submission._id),
            workspaceId: String(workspace._id),
            pointsAwarded: submission.pointsAwarded,
          },
          idempotencyKey: `problem-completed:${submission._id}:${memberId}`,
        });
        await NotificationService.create({
          userId: memberId,
          type: 'system',
          title: 'Problem review approved',
          body: `${problem.title} was approved. Your team earned ${submission.pointsAwarded} points on the problem leaderboard.`,
          link: '/problem-bank',
        });
      }),
    );
  } else {
    await Promise.all(
      teamMemberIds.map((memberId) =>
        NotificationService.create({
          userId: memberId,
          type: 'system',
          title: 'Problem review needs changes',
          body:
            submission.adminNotes ||
            `The admin team asked for changes on ${problem.title}.`,
          link: `/product-workspace/${workspace._id}`,
        }),
      ),
    );
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
