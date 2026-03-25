import { Types } from 'mongoose';
import { z } from 'zod';
import { notificationQueue } from '../../config/bullmq';
import { redis } from '../../config/redis';
import { ApiError } from '../../utils/ApiError';
import { readRedisJson } from '../../utils/redisJson';
import { UserRole } from '../../types/roles.types';
import { ScoreEvent } from '../innovationScore/score.model';
import { Startup } from '../startup/startup.model';
import { User } from '../user/user.model';
import { Deal } from './deal.model';
import {
  DealDetailView,
  DealGroupView,
  DealPortfolioItem,
  DealStage,
  DealStatus,
  DealSummaryView,
  DealTransitionResponse,
  InvestorRole,
} from './deal.types';

const STAGE_LABELS: Record<DealStage, string> = {
  1: 'Due Diligence',
  2: 'Fund Transfer',
  3: 'Equity Transfer',
  4: 'Portfolio',
};

const STAGE_ORDER: DealStage[] = [1, 2, 3, 4];

const transitionSchema = z.object({
  newStage: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  stageData: z
    .object({
      amountINR: z.number().min(20000).optional(),
      equityPercent: z.number().min(0).max(100).optional(),
      investorRole: z.enum(['Shareholder', 'Director', 'Co-Founder']).optional(),
    })
    .optional(),
});

type DealDocumentLike = {
  _id: Types.ObjectId;
  investorId: Types.ObjectId;
  startupId: Types.ObjectId;
  studentId: Types.ObjectId;
  stage: DealStage;
  amountINR?: number;
  fundTransferInitiatedAt?: Date;
  equityPercent?: number;
  investorRole?: InvestorRole;
  adminApprovalRequired: boolean;
  adminApprovedAt?: Date;
  adminApprovedBy?: Types.ObjectId;
  closedAt?: Date;
  innovationScoreSnapshot: number;
  status: DealStatus;
  createdAt: Date;
  updatedAt: Date;
};

type LeanUser = {
  _id: Types.ObjectId;
  displayName: string;
  avatar?: string;
  role: UserRole;
  innovationScore: number;
  scoreBreakdown?: Record<string, number>;
  domain?: string;
  isActive?: boolean;
};

type LeanStartup = {
  _id: Types.ObjectId;
  name: string;
  tagline: string;
  category: string;
  stage: string;
  pitchDeckUrl?: string;
  launchedToInvestors?: boolean;
  launchedAt?: Date;
  innovationScoreAtLaunch: number;
  founderIds: Types.ObjectId[];
  traction: {
    patentFiled: boolean;
    mvpBuilt: boolean;
    revenueGenerating: boolean;
  };
};

const currentStage = (deal: DealDocumentLike): DealStage =>
  deal.stage === 2 && deal.adminApprovalRequired ? 3 : deal.stage;

const nextActionLabel = (deal: DealDocumentLike): string => {
  const stage = currentStage(deal);
  if (stage === 1) return 'Advance to Fund Transfer';
  if (stage === 2) return 'Advance to Equity Transfer';
  if (stage === 3) return deal.adminApprovedAt ? 'Advance to Portfolio' : 'Awaiting Admin Verification';
  return 'View in Portfolio';
};

const getParticipantSummary = (user: LeanUser | undefined) => {
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  return {
    _id: String(user._id),
    displayName: user.displayName,
    ...(user.avatar ? { avatar: user.avatar } : {}),
    role: user.role,
    innovationScore: user.innovationScore ?? 0,
  };
};

const buildSummary = (
  deal: DealDocumentLike,
  startup: LeanStartup,
  student: LeanUser,
  investor: LeanUser,
  investorDisplayName: string,
): DealSummaryView => ({
  _id: String(deal._id),
  startupId: String(deal.startupId),
  studentId: String(deal.studentId),
  investorId: String(deal.investorId),
  startupName: startup.name,
  startupCategory: startup.category,
  studentDisplayName: student.displayName,
  investorDisplayName,
  currentStage: currentStage(deal),
  status: deal.status,
  ...(deal.amountINR !== undefined ? { amountINR: deal.amountINR } : {}),
  ...(deal.equityPercent !== undefined ? { equityPercent: deal.equityPercent } : {}),
  ...(deal.investorRole ? { investorRole: deal.investorRole } : {}),
  adminApprovalRequired: deal.adminApprovalRequired,
  ...(deal.adminApprovedAt ? { adminApprovedAt: deal.adminApprovedAt.toISOString() } : {}),
  innovationScoreSnapshot: deal.innovationScoreSnapshot,
  nextActionLabel: nextActionLabel(deal),
  createdAt: deal.createdAt.toISOString(),
  updatedAt: deal.updatedAt.toISOString(),
});

const buildDetail = (
  deal: DealDocumentLike,
  startup: LeanStartup,
  student: LeanUser,
  investor: LeanUser,
  investorDisplayName: string,
): DealDetailView => ({
  ...buildSummary(deal, startup, student, investor, investorDisplayName),
  startup: {
    _id: String(startup._id),
    name: startup.name,
    tagline: startup.tagline,
    category: startup.category,
    stage: startup.stage,
    ...(startup.pitchDeckUrl ? { pitchDeckUrl: startup.pitchDeckUrl } : {}),
  },
  student: getParticipantSummary(student),
  investor: getParticipantSummary(investor),
  ...(deal.fundTransferInitiatedAt ? { fundTransferInitiatedAt: deal.fundTransferInitiatedAt.toISOString() } : {}),
  ...(deal.closedAt ? { closedAt: deal.closedAt.toISOString() } : {}),
});

const fetchDealContext = async (deal: DealDocumentLike) => {
  const [startup, student, investor] = await Promise.all([
    Startup.findById(deal.startupId)
      .select('_id name tagline category stage pitchDeckUrl founderIds launchedToInvestors launchedAt innovationScoreAtLaunch traction')
      .lean<LeanStartup>(),
    User.findById(deal.studentId)
      .select('_id displayName avatar role innovationScore scoreBreakdown')
      .lean<LeanUser>(),
    User.findById(deal.investorId)
      .select('_id displayName avatar role innovationScore scoreBreakdown')
      .lean<LeanUser>(),
  ]);

  if (!startup || !student || !investor) {
    throw new ApiError(404, 'DEAL_CONTEXT_NOT_FOUND', 'Deal context could not be loaded');
  }

  return { startup, student, investor };
};

const ensureInvestor = async (investorId: string) => {
  const investor = await User.findById(investorId)
    .select('_id displayName role isActive')
    .lean<LeanUser & { isActive?: boolean }>();

  if (!investor || investor.role !== UserRole.INVESTOR || !investor.isActive) {
    throw new ApiError(403, 'FORBIDDEN', 'Only active investors can perform this action');
  }

  return investor;
};

const ensureStudent = async (studentId: string) => {
  const student = await User.findById(studentId)
    .select('_id displayName role isActive')
    .lean<LeanUser & { isActive?: boolean }>();

  if (!student || student.role !== UserRole.STUDENT || !student.isActive) {
    throw new ApiError(403, 'FORBIDDEN', 'Only active students can perform this action');
  }

  return student;
};

const dealToPortfolioItem = (
  deal: DealDocumentLike,
  student: LeanUser,
  startup: LeanStartup | undefined,
): DealPortfolioItem => {
  const liveInnovationScore = student.innovationScore ?? 0;

  return {
    _id: String(deal._id),
    dealId: String(deal._id),
    startupId: String(deal.startupId),
    startupName: startup?.name ?? 'Startup',
    startupCategory: startup?.category ?? 'Category pending',
    ...(deal.investorRole ? { investorRole: deal.investorRole } : {}),
    ...(deal.equityPercent !== undefined ? { equityPercent: deal.equityPercent } : {}),
    currentStage: 4,
    innovationScoreSnapshot: deal.innovationScoreSnapshot,
    liveInnovationScore,
    scoreTrend: liveInnovationScore - deal.innovationScoreSnapshot,
    ...(deal.closedAt ? { closedAt: deal.closedAt.toISOString() } : {}),
    studentDisplayName: student.displayName,
    ...(student.avatar ? { studentAvatar: student.avatar } : {}),
  };
};

export const transitionBodySchema = transitionSchema;

export const createInvestorDealFromInterest = async (investorId: string, startupId: string) => {
  const investor = await ensureInvestor(investorId);

  const startup = await Startup.findById(startupId)
    .select('_id name category stage pitchDeckUrl founderIds launchedToInvestors launchedAt innovationScoreAtLaunch traction')
    .lean<LeanStartup>();

  if (!startup || !startup.launchedToInvestors) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  const studentId = startup.founderIds[0];
  if (!studentId) {
    throw new ApiError(400, 'STARTUP_NO_FOUNDERS', 'Startup does not have a founder linked');
  }

  await ensureStudent(String(studentId));

  const founder = await User.findById(studentId).select('_id innovationScore').lean<LeanUser>();
  if (!founder) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }

  const existing = await Deal.findOne({
    investorId,
    startupId,
    studentId,
    status: 'active',
  }).lean<DealDocumentLike | null>();

  if (existing) {
    const context = await fetchDealContext(existing);
    return buildDetail(existing, context.startup, context.student, context.investor, context.investor.displayName);
  }

  const deal = await Deal.create({
    investorId,
    startupId,
    studentId,
    stage: 1,
    innovationScoreSnapshot: founder.innovationScore ?? 0,
    status: 'active',
    adminApprovalRequired: false,
  });

  await redis.del(`investor:dashboard:${investorId}`);

  await notificationQueue.add('deal-interest', {
    userId: String(studentId),
    type: 'deal_interest',
    title: 'An investor is interested in your startup!',
    body: `${investor.displayName} expressed interest in ${startup.name}.`,
    link: '/startup-launch',
  });

  const context = await fetchDealContext(deal.toObject() as DealDocumentLike);
  return buildDetail(deal.toObject() as DealDocumentLike, context.startup, context.student, context.investor, context.investor.displayName);
};

export const listDealsForInvestor = async (investorId: string): Promise<DealGroupView[]> => {
  await ensureInvestor(investorId);

  const deals = await Deal.find({ investorId })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean<DealDocumentLike[]>();

  if (deals.length === 0) {
    return STAGE_ORDER.map((stage) => ({ stage, label: STAGE_LABELS[stage], deals: [] }));
  }

  const contexts = await Promise.all(deals.map(async (deal) => ({ deal, ...(await fetchDealContext(deal)) })));
  const summaries = contexts.map(({ deal, startup, student, investor }) =>
    buildSummary(deal, startup, student, investor, investor.displayName),
  );

  return STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    deals: summaries.filter((deal) => deal.currentStage === stage),
  }));
};

export const listDealsForParticipant = async (userId: string, role: UserRole): Promise<DealSummaryView[]> => {
  if (role !== UserRole.INVESTOR && role !== UserRole.STUDENT) {
    throw new ApiError(403, 'FORBIDDEN', 'Only investors and students can access deal lists');
  }

  if (role === UserRole.INVESTOR) {
    const grouped = await listDealsForInvestor(userId);
    return grouped.flatMap((group) => group.deals);
  }

  await ensureStudent(userId);

  const deals = await Deal.find({ studentId: userId })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean<DealDocumentLike[]>();

  const contexts = await Promise.all(deals.map(async (deal) => ({ deal, ...(await fetchDealContext(deal)) })));

  return contexts.map(({ deal, startup, student, investor }, index) =>
    buildSummary(
      deal,
      startup,
      student,
      investor,
      currentStage(deal) < 2 ? `Investor #${index + 1}` : investor.displayName,
    ),
  );
};

export const getDealForParticipant = async (userId: string, role: UserRole, dealId: string): Promise<DealDetailView> => {
  if (role !== UserRole.INVESTOR && role !== UserRole.STUDENT) {
    throw new ApiError(403, 'FORBIDDEN', 'Only investors and students can access deals');
  }

  const deal = await Deal.findOne({
    _id: dealId,
    ...(role === UserRole.INVESTOR ? { investorId: userId } : { studentId: userId }),
  }).lean<DealDocumentLike | null>();

  if (!deal) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot access this deal');
  }

  const context = await fetchDealContext(deal);
  return buildDetail(
    deal,
    context.startup,
    context.student,
    context.investor,
    role === UserRole.STUDENT && currentStage(deal) < 2
      ? 'Investor #1'
      : context.investor.displayName,
  );
};

export const advanceDealStage = async (
  investorId: string,
  dealId: string,
  payload: z.infer<typeof transitionSchema>,
): Promise<DealTransitionResponse> => {
  await ensureInvestor(investorId);
  const parsed = transitionSchema.parse(payload);

  const deal = await Deal.findOne({
    _id: dealId,
    investorId,
  });

  if (!deal) {
    throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
  }

  const dealDoc = deal.toObject() as DealDocumentLike;
  const activeStage = currentStage(dealDoc);

  if (parsed.newStage !== activeStage + 1) {
    throw new ApiError(400, 'INVALID_STAGE_TRANSITION', 'Stages must advance sequentially');
  }

  if (parsed.newStage === 2) {
    if (typeof parsed.stageData?.amountINR !== 'number' || parsed.stageData.amountINR < 20000) {
      throw new ApiError(400, 'MINIMUM_INVESTMENT_REQUIRED', 'Minimum investment is INR 20,000');
    }

    deal.stage = 2;
    deal.amountINR = parsed.stageData.amountINR;
    deal.fundTransferInitiatedAt = new Date();
    deal.status = 'active';
    deal.adminApprovalRequired = false;
  }

  if (parsed.newStage === 3) {
    deal.stage = 3;
    deal.adminApprovalRequired = true;
    if (typeof parsed.stageData?.equityPercent === 'number') {
      deal.equityPercent = parsed.stageData.equityPercent;
    }
    if (parsed.stageData?.investorRole) {
      deal.investorRole = parsed.stageData.investorRole;
    }
    await deal.save();
    await redis.del(`investor:dashboard:${investorId}`);
    return {
      requiresAdminApproval: true,
      message: 'Stage 3 requires admin verification.',
    };
  }

  if (parsed.newStage === 4) {
    if (!deal.adminApprovedAt) {
      throw new ApiError(400, 'ADMIN_APPROVAL_REQUIRED', 'Stage 4 requires admin approval first');
    }

    deal.stage = 4;
    deal.status = 'closed';
    deal.closedAt = new Date();
    deal.adminApprovalRequired = false;
  }

  await deal.save();
  await redis.del(`investor:dashboard:${investorId}`);

  const context = await fetchDealContext(deal.toObject() as DealDocumentLike);

  await notificationQueue.add('deal-stage', {
    userId: String(deal.studentId),
    type: 'deal_interest',
    title: `Your deal has moved to Stage ${parsed.newStage}`,
    body: `${context.investor.displayName} advanced the deal for ${context.startup.name}.`,
    link: '/startup-launch',
  });

  return {
    deal: buildDetail(
      deal.toObject() as DealDocumentLike,
      context.startup,
      context.student,
      context.investor,
      context.investor.displayName,
    ),
  };
};

export const getInvestorDashboardStats = async (investorId: string) => {
  await ensureInvestor(investorId);

  const cacheKey = `investor:dashboard:${investorId}`;
  const cached = await redis.get<string>(cacheKey);
  const cachedStats = readRedisJson<{
      activeDeals: number;
      newStartupsThisWeek: number;
      portfolioCount: number;
      avgPortfolioScore: number;
    }>(cached);
  if (cachedStats) {
    return cachedStats;
  }

  const [activeDeals, newStartupsThisWeek, portfolioCount, portfolioDeals] = await Promise.all([
    Deal.countDocuments({ investorId, status: 'active' }),
    Startup.countDocuments({
      launchedToInvestors: true,
      launchedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }),
    Deal.countDocuments({ investorId, stage: 4, status: 'closed' }),
    Deal.find({ investorId, stage: 4, status: 'closed' })
      .select('_id studentId startupId innovationScoreSnapshot')
      .lean<DealDocumentLike[]>(),
  ]);

  const studentIds = [...new Set(portfolioDeals.map((deal) => String(deal.studentId)))];
  const students =
    studentIds.length > 0
      ? await User.find({ _id: { $in: studentIds } }).select('_id innovationScore').lean<LeanUser[]>()
      : [];
  const studentMap = new Map(students.map((student) => [String(student._id), student.innovationScore ?? 0]));
  const avgPortfolioScore =
    studentIds.length > 0
      ? Number(
          (
            studentIds.reduce((total, studentId) => total + (studentMap.get(studentId) ?? 0), 0) /
            studentIds.length
          ).toFixed(2),
        )
      : 0;

  const stats = {
    activeDeals,
    newStartupsThisWeek,
    portfolioCount,
    avgPortfolioScore,
  };

  await redis.set(cacheKey, JSON.stringify(stats), { ex: 60 * 5 });
  return stats;
};

export const listInvestorStartups = async (
  investorId: string,
  filters: {
    minScore?: number;
    maxScore?: number;
    category?: string;
    stage?: string;
    page?: number;
    limit?: number;
  },
) => {
  await ensureInvestor(investorId);

  const page = Math.max(filters.page ?? 1, 1);
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 50);
  const query: Record<string, unknown> = { launchedToInvestors: true };

  if (filters.category) {
    query.category = new RegExp(filters.category, 'i');
  }

  if (filters.stage) {
    query.stage = filters.stage;
  }

  if (typeof filters.minScore === 'number' || typeof filters.maxScore === 'number') {
    query.innovationScoreAtLaunch = {
      ...(typeof filters.minScore === 'number' ? { $gte: filters.minScore } : {}),
      ...(typeof filters.maxScore === 'number' ? { $lte: filters.maxScore } : {}),
    };
  }

  const [total, startups] = await Promise.all([
    Startup.countDocuments(query),
    Startup.find(query)
      .sort({ innovationScoreAtLaunch: -1, createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<LeanStartup[]>(),
  ]);

  const founderIds = [...new Set(startups.flatMap((startup) => startup.founderIds.map(String)))];
  const founders =
    founderIds.length > 0
      ? await User.find({ _id: { $in: founderIds } })
          .select('_id displayName avatar innovationScore scoreBreakdown role domain')
          .lean<LeanUser[]>()
      : [];
  const founderMap = new Map(founders.map((founder) => [String(founder._id), founder]));

  const items = startups.map((startup) => {
    const founder = founderMap.get(String(startup.founderIds[0]));

    return {
      _id: String(startup._id),
      name: startup.name,
      tagline: startup.tagline,
      category: startup.category,
      stage: startup.stage,
      ...(startup.launchedAt ? { launchedAt: startup.launchedAt.toISOString() } : {}),
      innovationScoreAtLaunch: startup.innovationScoreAtLaunch,
      teamSize: startup.founderIds.length,
      ...(startup.pitchDeckUrl ? { pitchDeckUrl: startup.pitchDeckUrl } : {}),
      traction: startup.traction,
      ...(founder
        ? {
            founder: {
              _id: String(founder._id),
              displayName: founder.displayName,
              ...(founder.avatar ? { avatar: founder.avatar } : {}),
              innovationScore: founder.innovationScore ?? 0,
              scoreBreakdown: founder.scoreBreakdown ?? {},
              ...(founder.domain ? { domain: founder.domain } : {}),
            },
          }
        : {}),
    };
  });

  return {
    items,
    page,
    limit,
    total,
  };
};

export const getInvestorStartup = async (investorId: string, startupId: string) => {
  await ensureInvestor(investorId);

  const startup = await Startup.findOne({
    _id: startupId,
    launchedToInvestors: true,
  })
    .select('_id name tagline category stage pitchDeckUrl founderIds launchedToInvestors launchedAt innovationScoreAtLaunch traction')
    .lean<LeanStartup>();

  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  const founders =
    startup.founderIds.length > 0
      ? await User.find({ _id: { $in: startup.founderIds } })
          .select('_id displayName avatar innovationScore scoreBreakdown role domain')
          .lean<LeanUser[]>()
      : [];

  const scoreEvents =
    startup.founderIds.length > 0
      ? await ScoreEvent.find({ userId: startup.founderIds[0] }).sort({ createdAt: -1 }).limit(25).lean()
      : [];

  return {
    startup: {
      _id: String(startup._id),
      name: startup.name,
      tagline: startup.tagline,
      category: startup.category,
      stage: startup.stage,
      ...(startup.launchedAt ? { launchedAt: startup.launchedAt.toISOString() } : {}),
      innovationScoreAtLaunch: startup.innovationScoreAtLaunch,
      teamSize: startup.founderIds.length,
      ...(startup.pitchDeckUrl ? { pitchDeckUrl: startup.pitchDeckUrl } : {}),
      traction: startup.traction,
      founders: founders.map((founder) => ({
        _id: String(founder._id),
        displayName: founder.displayName,
        ...(founder.avatar ? { avatar: founder.avatar } : {}),
        innovationScore: founder.innovationScore ?? 0,
        scoreBreakdown: founder.scoreBreakdown ?? {},
        ...(founder.domain ? { domain: founder.domain } : {}),
      })),
    },
    scoreEvents: scoreEvents.map((event) => ({
      _id: String(event._id),
      trigger: event.trigger,
      delta: event.delta,
      scoreAfter: event.scoreAfter,
      createdAt: event.createdAt.toISOString(),
    })),
    teamMembers: founders.map((founder) => ({
      _id: String(founder._id),
      displayName: founder.displayName,
      ...(founder.avatar ? { avatar: founder.avatar } : {}),
      innovationScore: founder.innovationScore ?? 0,
      scoreBreakdown: founder.scoreBreakdown ?? {},
      ...(founder.domain ? { domain: founder.domain } : {}),
    })),
    canExpressInterest: true,
  };
};

export const listInvestorInstitutions = async (type: 'school' | 'college') => {
  const institutions = await User.find({
    role: type === 'school' ? UserRole.SCHOOL : UserRole.COLLEGE,
    isActive: true,
    institutionProfile: { $exists: true, $ne: null },
  })
    .select('_id institutionProfile role')
    .sort({ updatedAt: -1 })
    .lean();

  return institutions.map((institution) => ({
    _id: String(institution._id),
    institutionName: institution.institutionProfile?.institutionName ?? 'Institution',
    location: institution.institutionProfile?.location ?? 'Location pending',
    totalStudentsEnrolled: institution.institutionProfile?.totalStudentsEnrolled ?? 0,
    academicYear: institution.institutionProfile?.academicYear ?? '2025-26',
    iicStarRating: institution.institutionProfile?.iicStarRating ?? 0,
    institutionType: type,
    focusLabel:
      type === 'school'
        ? 'CSR · Grants · Lab Funding'
        : 'Equity · Incubation · Patent Licensing',
  }));
};

export const getInvestorPortfolio = async (investorId: string) => {
  await ensureInvestor(investorId);

  const deals = await Deal.find({ investorId, stage: 4, status: 'closed' })
    .sort({ closedAt: -1, updatedAt: -1 })
    .lean<DealDocumentLike[]>();

  const startupIds = [...new Set(deals.map((deal) => String(deal.startupId)))];
  const startups =
    startupIds.length > 0
      ? await Startup.find({ _id: { $in: startupIds } }).select('_id name category').lean<LeanStartup[]>()
      : [];
  const startupMap = new Map(startups.map((startup) => [String(startup._id), startup]));

  const studentIds = [...new Set(deals.map((deal) => String(deal.studentId)))];
  const students =
    studentIds.length > 0
      ? await User.find({ _id: { $in: studentIds } })
          .select('_id displayName avatar innovationScore')
          .lean<LeanUser[]>()
      : [];
  const studentMap = new Map(students.map((student) => [String(student._id), student]));

  const items = deals.map((deal) => {
    const startup = startupMap.get(String(deal.startupId));
    const student = studentMap.get(String(deal.studentId));

    if (!student) {
      throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
    }

    return dealToPortfolioItem(deal, student, startup);
  });

  const averageLiveInnovationScore =
    items.length > 0
      ? Number((items.reduce((total, item) => total + item.liveInnovationScore, 0) / items.length).toFixed(2))
      : 0;

  return {
    items,
    portfolioStrength: {
      averageLiveInnovationScore,
      totalPortfolioCount: items.length,
    },
  };
};
