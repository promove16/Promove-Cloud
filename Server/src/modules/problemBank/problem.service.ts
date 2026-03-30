import crypto from 'crypto';
import { Types } from 'mongoose';
import { z } from 'zod';
import { redis } from '../../config/redis';
import { ApiError } from '../../utils/ApiError';
import { applyScoreAsync } from '../../services/scoreEngine';
import { Problem } from './problem.model';
import { Workspace } from '../workspace/workspace.model';

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

const clearProblemCaches = async () => {
  const scan = (
    redis as unknown as {
      scan?: (cursor: string) => Promise<[string, string[]]>;
    }
  ).scan;

  if (typeof scan !== 'function') {
    return;
  }

  let cursor = '0';
  const keys: string[] = [];

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
    await Promise.all(keys.map((key) => redis.del(key)));
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
    })),
  );

  return true;
};

export const listProblems = async (query: Record<string, unknown>) => {
  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(20, Math.max(1, Number(query.limit ?? 10)));
  const cacheKey = `problems:${crypto.createHash('sha1').update(JSON.stringify(query)).digest('hex')}`;
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

  const problems = await Problem.find(filter)
    .sort({ isVerified: -1, claimStatus: 1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  const total = await Problem.countDocuments(filter);
  const payload = { items: problems, nextPage: page * limit < total ? page + 1 : null, total };
  await redis.set(cacheKey, JSON.stringify(payload), { ex: 300 });
  return payload;
};

export const getProblemById = async (id: string) => {
  const problem = await Problem.findOne({ _id: id, publicationStatus: 'published' }).lean();
  if (!problem) {
    throw new ApiError(404, 'PROBLEM_NOT_FOUND', 'Problem not found');
  }
  return problem;
};

export const listAdminProblems = async () =>
  Problem.find({})
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

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

  if (payload.publicationStatus === 'archived') {
    problem.claimStatus = problem.claimedBy ? 'completed' : 'open';
  }

  await problem.save();
  await clearProblemCaches();
  return problem.toObject();
};

export const claimProblem = async (problemId: string, userId: string) => {
  const activeCount = await Workspace.countDocuments({ ownerId: userId, isActive: true });
  if (activeCount >= 3) {
    throw new ApiError(400, 'WORKSPACE_LIMIT_REACHED', 'You can only have 3 active workspaces.');
  }

  const claimedAt = new Date();
  const problem = await Problem.findOneAndUpdate(
    {
      _id: problemId,
      publicationStatus: 'published',
      claimStatus: 'open',
      $or: [{ claimedBy: { $exists: false } }, { claimedBy: null }],
    },
    {
      $set: {
        claimedBy: new Types.ObjectId(userId),
        claimedAt,
        claimStatus: 'claimed',
      },
    },
    { new: true },
  );

  if (!problem) {
    const existing = await Problem.findById(problemId).lean();
    if (!existing || existing.publicationStatus !== 'published') {
      throw new ApiError(404, 'PROBLEM_NOT_FOUND', 'Problem not found');
    }
    if (existing.claimedBy) {
      throw new ApiError(400, 'PROBLEM_ALREADY_CLAIMED', 'This problem is already claimed by another student.');
    }
    throw new ApiError(400, 'PROBLEM_NOT_AVAILABLE', 'This problem is not available for claiming.');
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
