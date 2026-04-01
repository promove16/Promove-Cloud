import crypto from 'crypto';
import { Types } from 'mongoose';
import { z } from 'zod';
import { logError } from '../../config/logger';
import { redis } from '../../config/redis';
import { ApiError } from '../../utils/ApiError';
import { applyScore, applyScoreAsync } from '../../services/scoreEngine';
import { NotificationService } from '../notification/notification.service';
import { User } from '../user/user.model';
import { Workspace } from '../workspace/workspace.model';
import { Problem } from './problem.model';
import { ProblemSubmission } from './problemSubmission.model';

const defaultSecurityNotice =
  'Upload only project-safe evidence. Do not share secrets, credentials, private keys, personal data, or production database exports.';

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
] as const;

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
  category: z.enum([
    'Agriculture',
    'Technology',
    'Healthcare',
    'Education',
    'Environment',
    'Rural Development',
    'Other',
  ]),
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

const clearProblemCaches = async () => {
  const redisClient = redis as unknown as {
    scan?: (cursor: string) => Promise<[string, string[]]>;
  };
  const scan = typeof redisClient.scan === 'function' ? redisClient.scan.bind(redisClient) : null;

  if (!scan) {
    return;
  }

  try {
    let cursor = '0';
    const keys: string[] = [];

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
      await Promise.all(keys.map((key) => redis.del(key)));
    }
  } catch (error) {
    logError('Failed to clear problem caches', error);
  }
};

const normalizeProblemInput = (payload: z.infer<typeof createProblemSchema>) => ({
  ...payload,
  postedBy: payload.sponsorName?.trim() || 'ProMove Admin',
  targetBeneficiaries: payload.targetBeneficiaries ?? [],
  deliverables: payload.deliverables ?? [],
  acceptanceCriteria: payload.acceptanceCriteria ?? [],
  constraints: payload.constraints ?? [],
  resourceLinks: payload.resourceLinks ?? [],
  submissionConfig: payload.submissionConfig,
  claimStatus: 'open' as const,
  maxClaims: 1,
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
  const cached = await redis.get<string>(cacheKey);

  if (cached) {
    return JSON.parse(cached) as Array<Record<string, unknown>>;
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

  await redis.set(cacheKey, JSON.stringify(payload), { ex: 120 });
  return payload;
};

export const seedProblemsIfEmpty = async () => {
  const count = await Problem.countDocuments();
  if (count > 0) {
    return false;
  }

  await Problem.insertMany(
    sampleProblems.map(([title, category, difficulty, domain], index) => ({
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
    })),
  );

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
  const cached = seeded ? null : await redis.get<string>(cacheKey);

  if (cached) {
    const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
    if (parsed.total > 0 || (await Problem.countDocuments()) === 0) {
      return parsed;
    }
  }

  const filter: Record<string, unknown> = { publicationStatus: 'published' };
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
    Problem.find(filter)
      .sort({ isVerified: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Problem.countDocuments(filter),
  ]);

  const items = await buildProblemViews(problems, userId);
  const payload = { items, nextPage: page * limit < total ? page + 1 : null, total };
  await redis.set(cacheKey, JSON.stringify(payload), { ex: 120 });
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
    ...problem,
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
  const [activeCount, problem, existingWorkspace] = await Promise.all([
    Workspace.countDocuments({ ownerId: userId, isActive: true }),
    Problem.findOne({ _id: problemId, publicationStatus: 'published' }).lean(),
    Workspace.findOne({
      ownerId: userId,
      claimedProblemId: problemId,
      isActive: true,
    }).lean(),
  ]);

  if (!problem) {
    throw new ApiError(404, 'PROBLEM_NOT_FOUND', 'Problem not found');
  }

  if (existingWorkspace) {
    throw new ApiError(
      400,
      'PROBLEM_ALREADY_STARTED',
      'You already started this problem in an active workspace.',
    );
  }

  if (activeCount >= 3) {
    throw new ApiError(400, 'WORKSPACE_LIMIT_REACHED', 'You can only have 3 active workspaces.');
  }

  const workspace = await Workspace.create({
    ownerId: userId,
    teamMemberIds: [userId],
    claimedProblemId: problem._id,
    title: problem.title,
    category: problem.category,
    stage: 'Problem',
    progressPercent: 0,
  });

  await applyScoreAsync({ userId, trigger: 'PROBLEM_CLAIMED', metadata: { problemId } });
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
          .select('_id title category difficulty')
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
