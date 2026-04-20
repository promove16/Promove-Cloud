import { ClientSession, Types } from 'mongoose';
import { z } from 'zod';
import { notificationQueue } from '../../config/bullmq';
import { redis } from '../../config/redis';
import { generateSignedCloudinaryUrl } from '../../services/cloudinaryService';
import { ApiError } from '../../utils/ApiError';
import { readRedisJson } from '../../utils/redisJson';
import { runMongoTransaction } from '../../utils/runMongoTransaction';
import { UserRole } from '../../types/roles.types';
import { ScoreEvent } from '../innovationScore/score.model';
import { Startup } from '../startup/startup.model';
import { User } from '../user/user.model';
import { Workspace } from '../workspace/workspace.model';
import { ensureDirectWorkspaceChatAccess } from '../workspace/workspace.service';
import { Deal } from './deal.model';
import {
  CapTableResponse,
  DealDetailView,
  DealGroupView,
  DealPortfolioItem,
  DealStage,
  DealStatus,
  DealSummaryView,
  DealTransitionResponse,
  IDeal,
  InvestmentTypeAnalytics,
  InvestorAuthorityView,
  InvestorRole,
  InvestorType,
  StartupBidBoardResponse,
  StartupInvestorView,
} from './deal.types';

const STAGE_LABELS: Record<DealStage, string> = {
  0: 'Negotiation',
  1: 'Due Diligence',
  2: 'Fund Transfer',
  3: 'Equity Transfer',
  4: 'Portfolio',
};

const STAGE_ORDER: DealStage[] = [0, 1, 2, 3, 4];
const MAX_PENNY_EQUITY = 49;
const MAX_PENNY_EQUITY_PER_INVESTOR = 5;
const DEFAULT_PROMOVE_ROYALTY_PERCENTAGE = 5;
const DEFAULT_SHARE_CLASS_LABEL = 'Common Equity';

export const ExpressInterestSchema = z.object({
  investorType: z.enum(['penny', 'sole']),
  proposedAmountINR: z.number().min(20000),
  proposedEquityPercent: z.number().min(0.01).max(100),
  chosenRole: z.enum(['shareholder', 'director', 'observer']).optional(),
  coverLetter: z.string().trim().max(1000).optional(),
});

export const FundTransferSchema = z.object({
  amountINR: z.number().min(20000),
});

export const founderDecisionSchema = z.object({
  decision: z.enum(['accepted', 'rejected']),
  note: z.string().trim().max(500).optional(),
});

const transitionSchema = z.object({
  newStage: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  stageData: z
    .object({
      amountINR: z.number().min(20000).optional(),
      equityPercent: z.number().min(0.01).max(100).optional(),
      investorRole: z.enum(['shareholder', 'director', 'observer']).optional(),
    })
    .optional(),
});

export const updateInvestorRoleSchema = z.object({
  investorRole: z.enum(['shareholder', 'director', 'observer']),
});

export const linkWorkshopSchema = z.object({
  workspaceId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid workspace ID'),
});

type DealDocumentLike = IDeal & { _id: Types.ObjectId };

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
  projectId?: Types.ObjectId;
  pitchDeckUrl?: string;
  pitchDeckStorageProvider?: 'cloudinary' | 's3';
  pitchDeckStorageKey?: string;
  launchedToInvestors?: boolean;
  launchedAt?: Date;
  innovationScoreAtLaunch: number;
  founderIds: Types.ObjectId[];
  totalShares: number;
  availableShares: number;
  reservedForSole: number;
  maxPennyInvestors: number;
  currentPennyCount: number;
  hasSoleInvestor: boolean;
  soleInvestorId?: Types.ObjectId | null;
  traction: {
    patentFiled: boolean;
    mvpBuilt: boolean;
    revenueGenerating: boolean;
  };
  adminReviewedAt?: Date;
};

type LeanProductWorkshop = {
  _id: Types.ObjectId;
  title: string;
  category: string;
  stage: string;
  progressPercent?: number;
};

type ExpressInterestInput = z.infer<typeof ExpressInterestSchema>;

const capTableCacheKey = (startupId: string) => `cap-table:${startupId}`;
const pennyEquityCacheKey = (startupId: string) => `penny-equity:${startupId}`;
const round = (value: number) => Number(value.toFixed(2));
const computeShares = (equityPercent: number, totalShares: number) =>
  Math.floor((equityPercent / 100) * totalShares);

const currentStage = (deal: DealDocumentLike): DealStage => deal.stage;

const nextActionLabel = (deal: DealDocumentLike): string => {
  if (deal.stage === 0) {
    return deal.negotiation?.termsAgreedAt ? 'Advance to Due Diligence' : 'Continue negotiation';
  }
  if (deal.stage === 1) {
    const founderDecisionStatus = deal.founderDecision?.status ?? 'pending';
    return founderDecisionStatus === 'accepted' ? 'Advance to Fund Transfer' : 'Awaiting founder acceptance';
  }
  if (deal.stage === 2) return 'Advance to Equity Transfer';
  if (deal.stage === 3 && deal.stockTransfer?.status === 'rejected') return 'Transfer Rejected - Resubmit';
  if (deal.stage === 3) return deal.adminApprovedAt ? 'Advance to Portfolio' : 'Awaiting ProMove Mediation Review';
  return 'View in Portfolio';
};

const calculateRoyaltyAmount = (amountINR: number, royaltyPercentage: number) =>
  round((amountINR * royaltyPercentage) / 100);

const getRoyaltyPercentage = (deal: DealDocumentLike) =>
  deal.royalty?.promovePercentage ?? DEFAULT_PROMOVE_ROYALTY_PERCENTAGE;

const getStockDetailsView = (deal: DealDocumentLike) => ({
  shareClassLabel: deal.stockDetails?.shareClassLabel ?? DEFAULT_SHARE_CLASS_LABEL,
  sharePriceInr:
    deal.stockDetails?.sharePriceInr ??
    (deal.sharesAllocated > 0 ? round(deal.amountINR / deal.sharesAllocated) : 0),
  transferValueInr: deal.stockDetails?.transferValueInr ?? deal.amountINR,
  totalSharesConsidered: deal.stockDetails?.totalSharesConsidered ?? deal.sharesAllocated,
});

const getStockTransferView = (deal: DealDocumentLike) => ({
  status: deal.stockTransfer?.status ?? (deal.stage >= 3 ? 'pending_review' : 'not_started'),
  ...(deal.stockTransfer?.requestedAt ? { requestedAt: deal.stockTransfer.requestedAt.toISOString() } : {}),
  ...(deal.stockTransfer?.requestedByRole ? { requestedByRole: deal.stockTransfer.requestedByRole } : {}),
  ...(deal.stockTransfer?.requestSummary ? { requestSummary: deal.stockTransfer.requestSummary } : {}),
  ...(deal.stockTransfer?.reviewNotes ? { reviewNotes: deal.stockTransfer.reviewNotes } : {}),
  ...(deal.stockTransfer?.reviewedAt ? { reviewedAt: deal.stockTransfer.reviewedAt.toISOString() } : {}),
  ...(deal.stockTransfer?.reviewedBy ? { reviewedBy: String(deal.stockTransfer.reviewedBy) } : {}),
});

const getRoyaltyView = (deal: DealDocumentLike) => {
  const promovePercentage = getRoyaltyPercentage(deal);

  return {
    promovePercentage,
    promoveAmountINR:
      deal.royalty?.promoveAmountINR ?? calculateRoyaltyAmount(deal.amountINR, promovePercentage),
    status: deal.royalty?.status ?? 'pending',
    ...(deal.royalty?.settledAt ? { settledAt: deal.royalty.settledAt.toISOString() } : {}),
  };
};

const getFounderDecisionView = (deal: DealDocumentLike) => {
  const status =
    deal.founderDecision?.status ??
    (deal.stage >= 2 || deal.status === 'closed' ? 'accepted' : 'pending');

  return {
    status,
    ...(deal.founderDecision?.respondedAt ? { respondedAt: deal.founderDecision.respondedAt.toISOString() } : {}),
    ...(deal.founderDecision?.respondedBy ? { respondedBy: String(deal.founderDecision.respondedBy) } : {}),
    ...(deal.founderDecision?.note ? { note: deal.founderDecision.note } : {}),
  };
};

const getNegotiationView = (deal: DealDocumentLike) => {
  const negotiation = deal.negotiation;
  if (!negotiation) {
    return undefined;
  }

  return {
    status: negotiation.status ?? 'initial',
    ...(typeof negotiation.investorProposedAmount === 'number'
      ? { investorProposedAmount: negotiation.investorProposedAmount }
      : {}),
    ...(typeof negotiation.investorProposedEquity === 'number'
      ? { investorProposedEquity: negotiation.investorProposedEquity }
      : {}),
    ...(typeof negotiation.studentCounterAmount === 'number'
      ? { studentCounterAmount: negotiation.studentCounterAmount }
      : {}),
    ...(typeof negotiation.studentCounterEquity === 'number'
      ? { studentCounterEquity: negotiation.studentCounterEquity }
      : {}),
    ...(typeof negotiation.finalAgreedAmount === 'number'
      ? { finalAgreedAmount: negotiation.finalAgreedAmount }
      : {}),
    ...(typeof negotiation.finalAgreedEquity === 'number'
      ? { finalAgreedEquity: negotiation.finalAgreedEquity }
      : {}),
    messages: (negotiation.messages ?? []).map((message: any) => ({
      _id: String(message?._id ?? ''),
      senderId: String(message?.senderId ?? ''),
      senderRole: (message?.senderRole === 'student' ? 'student' : 'investor') as 'student' | 'investor',
      message: String(message?.message ?? ''),
      timestamp: new Date(
        message?.timestamp ?? message?.createdAt ?? message?.updatedAt ?? deal.updatedAt,
      ).toISOString(),
      ...(Array.isArray(message?.attachments) && message.attachments.length > 0
        ? { attachments: message.attachments as string[] }
        : {}),
    })),
    ...(negotiation.lastUpdatedAt ? { lastUpdatedAt: negotiation.lastUpdatedAt.toISOString() } : {}),
    ...(negotiation.termsAgreedAt ? { termsAgreedAt: negotiation.termsAgreedAt.toISOString() } : {}),
    ...(negotiation.notes ? { notes: negotiation.notes } : {}),
  };
};

const buildDealFinancialMetadata = (
  deal: DealDocumentLike,
  requestSummary?: string,
) => {
  const royaltyPercentage = getRoyaltyPercentage(deal);
  const sharePriceInr = deal.sharesAllocated > 0 ? round(deal.amountINR / deal.sharesAllocated) : 0;
  const mediatorLabel = deal.mediatorLabel || 'ProMove';
  const stockDetails = {
    shareClassLabel: deal.stockDetails?.shareClassLabel ?? DEFAULT_SHARE_CLASS_LABEL,
    sharePriceInr,
    transferValueInr: deal.amountINR,
    totalSharesConsidered: deal.sharesAllocated,
  };
  const royalty = {
    promovePercentage: royaltyPercentage,
    promoveAmountINR: calculateRoyaltyAmount(deal.amountINR, royaltyPercentage),
    status: deal.royalty?.status ?? 'pending',
    ...(deal.royalty?.settledAt ? { settledAt: deal.royalty.settledAt } : {}),
  };

  if (requestSummary) {
    return {
      mediatorLabel,
      stockDetails,
      royalty,
      stockTransfer: {
        status: 'pending_review' as const,
        requestedAt: new Date(),
        requestedByRole: 'investor' as const,
        requestSummary,
        ...(deal.stockTransfer?.reviewNotes ? { reviewNotes: deal.stockTransfer.reviewNotes } : {}),
      },
      mediationStatus: 'under_review' as const,
    };
  }

  return {
    mediatorLabel,
    stockDetails,
    royalty,
    stockTransfer: {
      status: deal.stockTransfer?.status ?? 'not_started',
      ...(deal.stockTransfer?.requestedAt ? { requestedAt: deal.stockTransfer.requestedAt } : {}),
      ...(deal.stockTransfer?.requestedByRole ? { requestedByRole: deal.stockTransfer.requestedByRole } : {}),
      ...(deal.stockTransfer?.requestSummary ? { requestSummary: deal.stockTransfer.requestSummary } : {}),
      ...(deal.stockTransfer?.reviewNotes ? { reviewNotes: deal.stockTransfer.reviewNotes } : {}),
      ...(deal.stockTransfer?.reviewedAt ? { reviewedAt: deal.stockTransfer.reviewedAt } : {}),
      ...(deal.stockTransfer?.reviewedBy ? { reviewedBy: deal.stockTransfer.reviewedBy } : {}),
    },
    mediationStatus: deal.stage >= 3 ? ('under_review' as const) : deal.mediationStatus ?? 'intake',
  };
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

const mapProductWorkshop = (workspace?: LeanProductWorkshop | null) =>
  workspace
    ? {
        workspaceId: String(workspace._id),
        title: workspace.title,
        category: workspace.category,
        stage: workspace.stage,
        progressPercent: workspace.progressPercent ?? 0,
      }
    : undefined;

const extractCloudinaryPublicId = (url?: string) => {
  if (!url || !url.includes('cloudinary.com')) {
    return null;
  }

  const match = url.match(/upload\/v\d+\/(.+)$/);
  return match ? match[1].replace(/\.[^.]+$/, '') : null;
};

const getSignedPitchDeckUrl = (startup: LeanStartup) => {
  if (!startup.pitchDeckUrl) {
    return undefined;
  }

  if (startup.pitchDeckStorageProvider !== 'cloudinary') {
    return startup.pitchDeckUrl;
  }

  const storageKey = startup.pitchDeckStorageKey || extractCloudinaryPublicId(startup.pitchDeckUrl);
  if (!storageKey) {
    return startup.pitchDeckUrl;
  }

  try {
    return generateSignedCloudinaryUrl(storageKey, 'raw');
  } catch (error) {
    console.error('Error generating signed pitch deck URL for deal context:', error);
    return startup.pitchDeckUrl;
  }
};

const buildSummary = (
  deal: DealDocumentLike,
  startup: LeanStartup,
  student: LeanUser,
  investor: LeanUser,
  investorDisplayName: string,
  productWorkshop?: LeanProductWorkshop | null,
): DealSummaryView => {
  const mappedProductWorkshop = mapProductWorkshop(productWorkshop);

  return {
    _id: String(deal._id),
    startupId: String(deal.startupId),
    studentId: String(deal.studentId),
    investorId: String(deal.investorId),
    mediatorLabel: deal.mediatorLabel ?? 'ProMove',
    requestOrigin: deal.requestOrigin ?? 'investor',
    mediationStatus: deal.mediationStatus ?? (deal.stage >= 3 ? 'under_review' : 'intake'),
    startupName: startup.name,
    startupCategory: startup.category,
    studentDisplayName: student.displayName,
    investorDisplayName,
    investorType: deal.investorType,
    currentStage: currentStage(deal),
    status: deal.status,
    amountINR: deal.amountINR,
    equityPercent: deal.equityPercent,
    sharesAllocated: deal.sharesAllocated,
    investorRole: deal.investorRole,
    votingWeight: deal.votingWeight,
    canVeto: deal.canVeto,
    canAccessFinancials: deal.canAccessFinancials,
    canRequestUpdates: deal.canRequestUpdates,
    adminApprovalRequired: deal.adminApprovalRequired,
    ...(deal.adminApprovedAt ? { adminApprovedAt: deal.adminApprovedAt.toISOString() } : {}),
    stockDetails: getStockDetailsView(deal),
    stockTransfer: getStockTransferView(deal),
    royalty: getRoyaltyView(deal),
    founderDecision: getFounderDecisionView(deal),
    ...(getNegotiationView(deal) ? { negotiation: getNegotiationView(deal) } : {}),
    innovationScoreSnapshot: deal.innovationScoreSnapshot,
    nextActionLabel: nextActionLabel(deal),
    ...(mappedProductWorkshop ? { productWorkshop: mappedProductWorkshop } : {}),
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
  };
};

const buildDetail = (
  deal: DealDocumentLike,
  startup: LeanStartup,
  student: LeanUser,
  investor: LeanUser,
  investorDisplayName: string,
  productWorkshop?: LeanProductWorkshop | null,
): DealDetailView => {
  const pitchDeckUrl = getSignedPitchDeckUrl(startup);

  return {
    ...buildSummary(deal, startup, student, investor, investorDisplayName, productWorkshop),
    startup: {
      _id: String(startup._id),
      name: startup.name,
      tagline: startup.tagline,
      category: startup.category,
      stage: startup.stage,
      ...(pitchDeckUrl ? { pitchDeckUrl } : {}),
    },
    student: getParticipantSummary(student),
    investor: getParticipantSummary(investor),
    ...(deal.fundTransferInitiatedAt ? { fundTransferInitiatedAt: deal.fundTransferInitiatedAt.toISOString() } : {}),
    ...(deal.closedAt ? { closedAt: deal.closedAt.toISOString() } : {}),
  };
};

const fetchDealContext = async (deal: DealDocumentLike) => {
  const [startup, student, investor] = await Promise.all([
    Startup.findById(deal.startupId)
      .select('_id name tagline category stage projectId pitchDeckUrl pitchDeckStorageProvider pitchDeckStorageKey founderIds launchedToInvestors launchedAt innovationScoreAtLaunch traction totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor soleInvestorId')
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

  const productWorkshop = deal.linkedWorkspaceId
    ? await Workspace.findOne({ _id: deal.linkedWorkspaceId, isActive: true })
        .select('_id title category stage progressPercent')
        .lean<LeanProductWorkshop | null>()
    : null;

  return { startup, student, investor, productWorkshop };
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

const getAccessibleStartupIdsForStudent = async (userId: string) => {
  const workspaces = await Workspace.find({
    $or: [{ ownerId: userId }, { teamMemberIds: userId }],
  })
    .select('_id')
    .lean<Array<{ _id: Types.ObjectId }>>();
  const workspaceIds = workspaces.map((workspace) => workspace._id);

  const startups = await Startup.find({
    $or: [
      { founderIds: userId },
      ...(workspaceIds.length > 0 ? [{ projectId: { $in: workspaceIds } }] : []),
    ],
  })
    .select('_id')
    .lean<Array<{ _id: Types.ObjectId }>>();

  return startups.map((startup) => startup._id);
};

const resolveNormalizedRole = (investorType: InvestorType, chosenRole?: InvestorRole): InvestorRole => {
  if (investorType === 'penny') {
    return chosenRole === 'shareholder' ? 'shareholder' : 'observer';
  }

  return chosenRole === 'director' ? 'director' : 'shareholder';
};

export const resolveInvestorAuthority = (
  investorType: InvestorType,
  equityPercent: number,
  chosenRole?: InvestorRole,
) => {
  const investorRole = resolveNormalizedRole(investorType, chosenRole);
  const isDirector = investorType === 'sole' && investorRole === 'director';

  return {
    investorRole,
    votingWeight: isDirector ? Math.max(51, round(equityPercent)) : round(equityPercent),
    canVeto: isDirector,
    canAccessFinancials: investorType === 'sole',
    canRequestUpdates: true,
  };
};

export const invalidateInvestmentCaches = async (startupId: string, investorId?: string) => {
  const keys = [capTableCacheKey(startupId), pennyEquityCacheKey(startupId), 'admin:analytics'];
  if (investorId) {
    keys.push(`investor:dashboard:${investorId}`);
  }

  await Promise.all(keys.map((key) => redis.del(key)));
};

const buildOfficialDealQuery = (excludeId?: string) => ({
  status: { $ne: 'cancelled' as const },
  adminApprovedAt: { $exists: true, $ne: null },
  ...(excludeId ? { _id: { $ne: excludeId } } : {}),
});

const buildReservedDealQuery = (excludeId?: string) => ({
  status: { $ne: 'cancelled' as const },
  ...(excludeId ? { _id: { $ne: excludeId } } : {}),
});

const getTotalPennyEquity = async (startupId: string, excludeId?: string, session?: ClientSession) => {
  if (!excludeId) {
    const cached = await redis.get<string>(pennyEquityCacheKey(startupId));
    const cachedValue = readRedisJson<number>(cached);
    if (typeof cachedValue === 'number') {
      return cachedValue;
    }
  }

  const deals = await Deal.find({
    startupId,
    investorType: 'penny',
    ...buildOfficialDealQuery(excludeId),
  })
    .session(session ?? null)
    .select('equityPercent')
    .lean<Array<Pick<DealDocumentLike, 'equityPercent'>>>();

  const total = round(deals.reduce((sum, deal) => sum + deal.equityPercent, 0));
  if (!excludeId) {
    await redis.set(pennyEquityCacheKey(startupId), JSON.stringify(total), { ex: 30 });
  }
  return total;
};

const getTotalInvestorEquity = async (startupId: string, excludeId?: string, session?: ClientSession) => {
  const deals = await Deal.find({
    startupId,
    ...buildOfficialDealQuery(excludeId),
  })
    .session(session ?? null)
    .select('equityPercent')
    .lean<Array<Pick<DealDocumentLike, 'equityPercent'>>>();

  return round(deals.reduce((sum, deal) => sum + deal.equityPercent, 0));
};

const dealToPortfolioItem = (
  deal: DealDocumentLike,
  student: LeanUser,
  startup: LeanStartup | undefined,
  productWorkshop?: LeanProductWorkshop | null,
): DealPortfolioItem => {
  const liveInnovationScore = student.innovationScore ?? 0;
  const mappedProductWorkshop = mapProductWorkshop(productWorkshop);

  return {
    _id: String(deal._id),
    dealId: String(deal._id),
    startupId: String(deal.startupId),
    startupName: startup?.name ?? 'Startup',
    startupCategory: startup?.category ?? 'Category pending',
    investorType: deal.investorType,
    investorRole: deal.investorRole,
    equityPercent: deal.equityPercent,
    sharesAllocated: deal.sharesAllocated,
    votingWeight: deal.votingWeight,
    canVeto: deal.canVeto,
    canAccessFinancials: deal.canAccessFinancials,
    canRequestUpdates: deal.canRequestUpdates,
    currentStage: 4,
    innovationScoreSnapshot: deal.innovationScoreSnapshot,
    liveInnovationScore,
    scoreTrend: liveInnovationScore - deal.innovationScoreSnapshot,
    ...(mappedProductWorkshop ? { productWorkshop: mappedProductWorkshop } : {}),
    ...(deal.closedAt ? { closedAt: deal.closedAt.toISOString() } : {}),
    studentDisplayName: student.displayName,
    ...(student.avatar ? { studentAvatar: student.avatar } : {}),
  };
};

export const transitionBodySchema = transitionSchema;

export const validateInvestmentTerms = async ({
  startup,
  investorType,
  equityPercent,
  chosenRole,
  excludeId,
  currentSharesAllocated = 0,
  session,
}: {
  startup: LeanStartup;
  investorType: InvestorType;
  equityPercent: number;
  chosenRole?: InvestorRole;
  excludeId?: string;
  currentSharesAllocated?: number;
  session?: ClientSession;
}) => {
  const normalizedRole = resolveNormalizedRole(investorType, chosenRole);

  if (chosenRole === 'director' && investorType !== 'sole') {
    throw new ApiError(400, 'DIRECTOR_ROLE_RESERVED', 'Director role is reserved for sole investors only');
  }

  if (investorType === 'penny' && equityPercent > MAX_PENNY_EQUITY_PER_INVESTOR) {
    throw new ApiError(400, 'PENNY_EQUITY_LIMIT', 'A penny investor cannot hold more than 5% equity');
  }

  const sharesToAllocate = computeShares(equityPercent, startup.totalShares);

  if (investorType === 'sole' && normalizedRole === 'director') {
    if (equityPercent < 51 || sharesToAllocate < startup.reservedForSole) {
      throw new ApiError(
        400,
        'SOLE_DIRECTOR_MINIMUM',
        'A sole investor with director authority must hold at least 51% equity',
      );
    }
  }

  if (investorType === 'penny') {
    const currentPennyEquity = await getTotalPennyEquity(String(startup._id), excludeId, session);
    if (round(currentPennyEquity + equityPercent) > MAX_PENNY_EQUITY) {
      throw new ApiError(
        400,
        'PENNY_EQUITY_CAP',
        'Penny investors collectively cannot hold more than 49% equity',
      );
    }
  }

  const totalInvestorEquity = await getTotalInvestorEquity(String(startup._id), excludeId, session);
  if (round(totalInvestorEquity + equityPercent) > 100) {
    throw new ApiError(400, 'TOTAL_EQUITY_EXCEEDED', 'Total investor equity cannot exceed 100%');
  }

  if (sharesToAllocate > startup.availableShares + currentSharesAllocated) {
    throw new ApiError(400, 'INSUFFICIENT_SHARES', 'Insufficient shares available');
  }

  return sharesToAllocate;
};

const pushFounderNotification = async (founderIds: Types.ObjectId[], title: string, body: string) =>
  Promise.all(
    founderIds.map((founderId) =>
      notificationQueue.add('investment-notification', {
        userId: String(founderId),
        type: 'deal_interest' as const,
        title,
        body,
        link: '/startup-launch',
      }),
    ),
  );

export const createInvestorDealFromInterest = async (
  investorId: string,
  startupId: string,
  payload: ExpressInterestInput,
) => {
  const parsed = ExpressInterestSchema.parse(payload);
  await ensureInvestor(investorId);

  const transactionResult = await runMongoTransaction(async (session) => {
    const startup = await Startup.findOne({
      _id: startupId,
      launchedToInvestors: true,
      reviewStatus: 'approved',
    })
      .session(session)
      .select(
        '_id name tagline category stage pitchDeckUrl founderIds launchedToInvestors launchedAt innovationScoreAtLaunch traction totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor soleInvestorId',
      )
      .lean<LeanStartup | null>();

    if (!startup) {
      throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
    }

    const studentId = startup.founderIds[0];
    if (!studentId) {
      throw new ApiError(400, 'STARTUP_NO_FOUNDERS', 'Startup does not have a founder linked');
    }

    const founder = await User.findById(studentId)
      .session(session)
      .select('_id innovationScore role isActive')
      .lean<(LeanUser & { isActive?: boolean }) | null>();
    if (!founder || founder.role !== UserRole.STUDENT || !founder.isActive) {
      throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
    }

    const existing = await Deal.findOne({
      investorId,
      startupId,
      studentId,
    }).session(session);

    if (existing && existing.status !== 'cancelled') {
      return {
        existingDealId: String(existing._id),
        founderIds: startup.founderIds,
      };
    }

    if (parsed.investorType === 'sole' && startup.hasSoleInvestor) {
      throw new ApiError(409, 'SOLE_INVESTOR_EXISTS', 'This startup already has a sole investor');
    }

    if (parsed.investorType === 'penny' && startup.currentPennyCount >= startup.maxPennyInvestors) {
      throw new ApiError(409, 'PENNY_SLOTS_FULL', 'Penny investor slots are full for this startup');
    }

    const sharesToAllocate = await validateInvestmentTerms({
      startup,
      investorType: parsed.investorType,
      equityPercent: parsed.proposedEquityPercent,
      chosenRole: parsed.chosenRole,
      excludeId: existing ? String(existing._id) : undefined,
      session,
    });
    const authority = resolveInvestorAuthority(
      parsed.investorType,
      parsed.proposedEquityPercent,
      parsed.chosenRole,
    );

    const deal =
      existing ??
      new Deal({
        investorId,
        startupId,
        studentId,
      });

    deal.mediatorLabel = 'ProMove';
    deal.requestOrigin = 'investor';
    deal.mediationStatus = 'intake';
    deal.investorType = parsed.investorType;
    deal.stage = 0;
    deal.negotiation = {
      status: 'initial',
      investorProposedAmount: parsed.proposedAmountINR,
      investorProposedEquity: parsed.proposedEquityPercent,
      messages: [],
    };
    deal.amountINR = parsed.proposedAmountINR;
    deal.proposedAmountINR = parsed.proposedAmountINR;
    deal.equityPercent = parsed.proposedEquityPercent;
    deal.proposedEquityPercent = parsed.proposedEquityPercent;
    deal.sharesAllocated = sharesToAllocate;
    deal.stockDetails = {
      shareClassLabel: DEFAULT_SHARE_CLASS_LABEL,
      sharePriceInr: sharesToAllocate > 0 ? round(parsed.proposedAmountINR / sharesToAllocate) : 0,
      transferValueInr: parsed.proposedAmountINR,
      totalSharesConsidered: sharesToAllocate,
    };
    deal.stockTransfer = {
      status: 'not_started',
    };
    deal.royalty = {
      promovePercentage: DEFAULT_PROMOVE_ROYALTY_PERCENTAGE,
      promoveAmountINR: calculateRoyaltyAmount(parsed.proposedAmountINR, DEFAULT_PROMOVE_ROYALTY_PERCENTAGE),
      status: 'pending',
    };
    deal.founderDecision = {
      status: 'pending',
    };
    deal.investorRole = authority.investorRole;
    deal.votingWeight = authority.votingWeight;
    deal.canVeto = authority.canVeto;
    deal.canAccessFinancials = authority.canAccessFinancials;
    deal.canRequestUpdates = authority.canRequestUpdates;
    deal.innovationScoreSnapshot = founder.innovationScore ?? 0;
    deal.status = 'active';
    deal.adminApprovalRequired = false;
    deal.adminApprovedAt = undefined;
    deal.adminApprovedBy = undefined;
    deal.closedAt = undefined;
    deal.fundTransferInitiatedAt = undefined;
    if (parsed.coverLetter) {
      deal.coverLetter = parsed.coverLetter;
    }

    await deal.save({ session });

    return {
      dealId: String(deal._id),
      founderIds: startup.founderIds,
    };
  });

  await invalidateInvestmentCaches(startupId, investorId);

  if ('existingDealId' in transactionResult) {
    const existingDeal = await Deal.findById(transactionResult.existingDealId).lean<DealDocumentLike | null>();
    if (!existingDeal) {
      throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
    }

    const context = await fetchDealContext(existingDeal);
    return buildDetail(
      existingDeal,
      context.startup,
      context.student,
      context.investor,
      context.investor.displayName,
      context.productWorkshop,
    );
  }

  if (parsed.investorType === 'sole') {
    await pushFounderNotification(
      transactionResult.founderIds,
      'Founder decision required for sole investor deal',
      'A sole investor reserved shares in your startup. Accept or reject the deal before fund transfer can begin.',
    );
  } else {
    await pushFounderNotification(
      transactionResult.founderIds,
      'Founder decision required for penny investor deal',
      `A penny investor reserved ${round(parsed.proposedEquityPercent)}% equity. Accept or reject the deal before fund transfer can begin.`,
    );
  }

  const createdDeal = await Deal.findById(transactionResult.dealId).lean<DealDocumentLike | null>();
  if (!createdDeal) {
    throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
  }

  const context = await fetchDealContext(createdDeal);
  return buildDetail(
    createdDeal,
    context.startup,
    context.student,
    context.investor,
    context.investor.displayName,
    context.productWorkshop,
  );
};

export const createInvestment = createInvestorDealFromInterest;

export const listDealsForInvestor = async (investorId: string): Promise<DealGroupView[]> => {
  await ensureInvestor(investorId);

  const deals = await Deal.find({ investorId, ...buildReservedDealQuery() })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean<DealDocumentLike[]>();

  if (deals.length === 0) {
    return STAGE_ORDER.map((stage) => ({ stage, label: STAGE_LABELS[stage], deals: [] }));
  }

  const contexts = await Promise.all(deals.map(async (deal) => ({ deal, ...(await fetchDealContext(deal)) })));
  const summaries = contexts.map(({ deal, startup, student, investor, productWorkshop }) =>
    buildSummary(deal, startup, student, investor, investor.displayName, productWorkshop),
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
  const startupIds = await getAccessibleStartupIdsForStudent(userId);

  if (startupIds.length === 0) {
    return [];
  }

  const deals = await Deal.find({ startupId: { $in: startupIds }, status: { $ne: 'cancelled' } })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean<DealDocumentLike[]>();

  const contexts = await Promise.all(deals.map(async (deal) => ({ deal, ...(await fetchDealContext(deal)) })));

  return contexts.map(({ deal, startup, student, investor, productWorkshop }) =>
    buildSummary(
      deal,
      startup,
      student,
      investor,
      investor.displayName,
      productWorkshop,
    ),
  );
};

export const getDealForParticipant = async (userId: string, role: UserRole, dealId: string): Promise<DealDetailView> => {
  if (role !== UserRole.INVESTOR && role !== UserRole.STUDENT && role !== UserRole.ADMIN) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot access this deal');
  }

  const studentStartupIds = role === UserRole.STUDENT ? await getAccessibleStartupIdsForStudent(userId) : [];
  const deal = await Deal.findOne({
    _id: dealId,
    ...(role === UserRole.ADMIN
      ? {}
      : role === UserRole.INVESTOR
        ? { investorId: userId }
        : { startupId: { $in: studentStartupIds } }),
  }).lean<DealDocumentLike | null>();

  if (!deal || deal.status === 'cancelled') {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot access this deal');
  }

  const context = await fetchDealContext(deal);
  return buildDetail(
    deal,
    context.startup,
    context.student,
    context.investor,
    context.investor.displayName,
    context.productWorkshop,
  );
};

export const recordFounderDecision = async (
  studentId: string,
  dealId: string,
  payload: z.infer<typeof founderDecisionSchema>,
): Promise<DealDetailView> => {
  await ensureStudent(studentId);
  const parsed = founderDecisionSchema.parse(payload);
  const transactionResult = await runMongoTransaction(async (session) => {
    const deal = await Deal.findOne({
      _id: dealId,
      status: { $ne: 'cancelled' },
    }).session(session);

    if (!deal) {
      throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
    }

    if (deal.requestOrigin !== 'investor' || deal.stage !== 1) {
      throw new ApiError(400, 'DEAL_RESPONSE_LOCKED', 'Only pending investor proposals can be answered here');
    }

    if ((deal.founderDecision?.status ?? 'pending') !== 'pending') {
      throw new ApiError(400, 'FOUNDER_DECISION_ALREADY_RECORDED', 'Founder decision has already been recorded');
    }

    const startup = await Startup.findById(deal.startupId)
      .session(session)
      .select(
        '_id name tagline category stage pitchDeckUrl founderIds launchedToInvestors launchedAt innovationScoreAtLaunch traction totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor soleInvestorId',
      )
      .lean<LeanStartup | null>();

    if (!startup) {
      throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
    }

    if (!startup.founderIds.some((founderId) => String(founderId) === studentId)) {
      throw new ApiError(403, 'FORBIDDEN', 'Only founders of this startup can respond to this deal');
    }

    deal.founderDecision = {
      status: parsed.decision,
      respondedAt: new Date(),
      respondedBy: new Types.ObjectId(studentId),
      ...(parsed.note?.trim() ? { note: parsed.note.trim() } : {}),
    };

    if (parsed.decision === 'rejected') {
      deal.status = 'cancelled';
      deal.adminApprovalRequired = false;
      deal.adminApprovedAt = undefined;
      deal.adminApprovedBy = undefined;
      deal.closedAt = undefined;
      deal.mediationStatus = 'rejected';

    }

    await deal.save({ session });

    return {
      dealId: String(deal._id),
      startupId: String(deal.startupId),
      investorId: String(deal.investorId),
      decision: parsed.decision,
    };
  });

  await invalidateInvestmentCaches(transactionResult.startupId, transactionResult.investorId);

  const deal = await Deal.findById(transactionResult.dealId).lean<DealDocumentLike | null>();
  if (!deal) {
    throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
  }

  const context = await fetchDealContext(deal);
  await notificationQueue.add('deal-stage', {
    userId: transactionResult.investorId,
    type: 'deal_interest',
    title:
      transactionResult.decision === 'accepted'
        ? 'Founder accepted your proposal'
        : 'Founder declined your proposal',
    body:
      transactionResult.decision === 'accepted'
        ? `${context.student.displayName} accepted your proposal for ${context.startup.name}.`
        : `${context.student.displayName} declined your proposal for ${context.startup.name}.`,
    link: '/dashboard/investor/deals',
  });

  const acceptedWorkspaceId = deal.linkedWorkspaceId
    ? String(deal.linkedWorkspaceId)
    : undefined;

  if (transactionResult.decision === 'accepted' && acceptedWorkspaceId) {
    await ensureDirectWorkspaceChatAccess(
      acceptedWorkspaceId,
      transactionResult.investorId,
      'investor',
    );
  }

  return buildDetail(
    deal,
    context.startup,
    context.student,
    context.investor,
    context.investor.displayName,
    context.productWorkshop,
  );
};

export const recordFundTransfer = async (
  investorId: string,
  dealId: string,
  payload: z.infer<typeof FundTransferSchema>,
): Promise<DealTransitionResponse> =>
  advanceDealStage(investorId, dealId, {
    newStage: 2,
    stageData: { amountINR: FundTransferSchema.parse(payload).amountINR },
  });

export const advanceDealStage = async (
  investorId: string,
  dealId: string,
  payload: z.infer<typeof transitionSchema>,
): Promise<DealTransitionResponse> => {
  await ensureInvestor(investorId);
  const parsed = transitionSchema.parse(payload);
  const isStageThreeTransition = parsed.newStage === 3;
  const transitionResult = await runMongoTransaction(async (session) => {
    const deal = await Deal.findOne({
      _id: dealId,
      investorId,
    }).session(session);

    if (!deal || deal.status === 'cancelled') {
      throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
    }

    const dealDoc = deal.toObject() as DealDocumentLike;
    const activeStage = currentStage(dealDoc);
    const isRejectedStageThreeResubmission =
      parsed.newStage === 3 &&
      activeStage === 3 &&
      deal.stockTransfer?.status === 'rejected' &&
      !deal.adminApprovedAt;

    if (parsed.newStage === 1) {
      if (activeStage !== 0) {
        throw new ApiError(400, 'INVALID_STAGE_TRANSITION', 'Stages must advance sequentially');
      }

      if (!deal.negotiation?.termsAgreedAt) {
        throw new ApiError(
          400,
          'TERMS_AGREEMENT_REQUIRED',
          'Both parties must agree on terms before proceeding',
        );
      }

      deal.stage = 1;
      deal.mediationStatus = 'under_review';
      
      await deal.save({ session });

      return {
        dealId: String(deal._id),
        startupId: String(deal.startupId),
      };
    }

    if (parsed.newStage === 2) {
      if (activeStage !== 1) {
        throw new ApiError(400, 'INVALID_STAGE_TRANSITION', 'Stages must advance sequentially');
      }

      if ((deal.founderDecision?.status ?? 'pending') !== 'accepted') {
        throw new ApiError(
          400,
          'FOUNDER_ACCEPTANCE_REQUIRED',
          'Founder acceptance is required before fund transfer can begin',
        );
      }

      if (typeof parsed.stageData?.amountINR !== 'number' || parsed.stageData.amountINR < 20000) {
        throw new ApiError(400, 'MINIMUM_INVESTMENT_REQUIRED', 'Minimum investment is INR 20,000');
      }

      deal.stage = 2;
      deal.amountINR = parsed.stageData.amountINR;
      deal.proposedAmountINR = parsed.stageData.amountINR;
      deal.fundTransferInitiatedAt = new Date();
      deal.status = 'active';
      deal.adminApprovalRequired = false;
      deal.adminApprovedAt = undefined;
      deal.adminApprovedBy = undefined;
      deal.mediationStatus = 'intake';
      const metadata = buildDealFinancialMetadata(deal.toObject() as DealDocumentLike);
      deal.mediatorLabel = metadata.mediatorLabel;
      deal.stockDetails = metadata.stockDetails;
      deal.stockTransfer = metadata.stockTransfer;
      deal.royalty = metadata.royalty;

      await deal.save({ session });

      return {
        dealId: String(deal._id),
        startupId: String(deal.startupId),
      };
    }

    if (parsed.newStage === 3) {
      if (activeStage !== 2 && !isRejectedStageThreeResubmission) {
        throw new ApiError(400, 'INVALID_STAGE_TRANSITION', 'Stages must advance sequentially');
      }

      const startup = await Startup.findById(deal.startupId)
        .session(session)
        .select(
          '_id name tagline category stage pitchDeckUrl founderIds launchedToInvestors launchedAt innovationScoreAtLaunch traction totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor soleInvestorId',
        )
        .lean<LeanStartup | null>();

      if (!startup) {
        throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
      }

      const nextEquityPercent = parsed.stageData?.equityPercent ?? deal.equityPercent;
      const nextRole = parsed.stageData?.investorRole ?? deal.investorRole;
      const sharesToAllocate = await validateInvestmentTerms({
        startup,
        investorType: deal.investorType,
        equityPercent: nextEquityPercent,
        chosenRole: nextRole,
        excludeId: String(deal._id),
        session,
      });
      const authority = resolveInvestorAuthority(deal.investorType, nextEquityPercent, nextRole);

      deal.stage = 3;
      deal.adminApprovalRequired = true;
      deal.equityPercent = nextEquityPercent;
      deal.proposedEquityPercent = nextEquityPercent;
      deal.sharesAllocated = sharesToAllocate;
      deal.investorRole = authority.investorRole;
      deal.votingWeight = authority.votingWeight;
      deal.canVeto = authority.canVeto;
      deal.canAccessFinancials = authority.canAccessFinancials;
      deal.canRequestUpdates = authority.canRequestUpdates;
      deal.adminApprovedAt = undefined;
      deal.adminApprovedBy = undefined;
      const metadata = buildDealFinancialMetadata(
        deal.toObject() as DealDocumentLike,
        `${startup.name} stock transfer request submitted to ProMove for ${nextEquityPercent}% equity (${sharesToAllocate} shares).`,
      );
      deal.mediatorLabel = metadata.mediatorLabel;
      deal.requestOrigin = deal.requestOrigin ?? 'investor';
      deal.mediationStatus = metadata.mediationStatus;
      deal.stockDetails = metadata.stockDetails;
      deal.stockTransfer = metadata.stockTransfer;
      deal.royalty = metadata.royalty;

      await deal.save({ session });

      return {
        dealId: String(deal._id),
        startupId: String(deal.startupId),
        requiresAdminApproval: true as const,
        message: 'Stage 3 submitted to ProMove for mediation and stock transfer review.',
      };
    }

    if (parsed.newStage !== 4 || activeStage !== 3 || !deal.adminApprovedAt) {
      throw new ApiError(400, 'ADMIN_APPROVAL_REQUIRED', 'Stage 4 requires admin approval first');
    }

    deal.stage = 4;
    deal.status = 'closed';
    deal.closedAt = new Date();
    deal.adminApprovalRequired = false;
    deal.mediationStatus = deal.mediationStatus ?? 'approved';

    const needsStockDetailsRebuild =
      !deal.stockDetails
      || !deal.stockDetails.sharePriceInr
      || !deal.stockDetails.transferValueInr
      || !deal.stockDetails.totalSharesConsidered;
    if (needsStockDetailsRebuild && deal.sharesAllocated > 0 && deal.amountINR > 0) {
      const metadata = buildDealFinancialMetadata(deal.toObject() as DealDocumentLike);
      deal.stockDetails = metadata.stockDetails;
      if (!deal.royalty?.promoveAmountINR) {
        deal.royalty = metadata.royalty;
      }
    }

    await deal.save({ session });

    return {
      dealId: String(deal._id),
      startupId: String(deal.startupId),
    };
  });

  await invalidateInvestmentCaches(transitionResult.startupId, investorId);

  if (transitionResult.requiresAdminApproval) {
    const notifiedDeal = await Deal.findById(transitionResult.dealId).lean<DealDocumentLike | null>();
    if (!notifiedDeal) {
      throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
    }

    const context = await fetchDealContext(notifiedDeal);
    await notificationQueue.add('deal-stage', {
      userId: String(notifiedDeal.studentId),
      type: 'deal_interest',
      title: `Your deal has moved to Stage ${parsed.newStage}`,
      body: `${context.investor.displayName} submitted ${context.startup.name} to ProMove for stock transfer review.`,
      link: '/startup-launch',
    });

    return {
      requiresAdminApproval: true,
      message: transitionResult.message,
    };
  }

  const deal = await Deal.findById(transitionResult.dealId).lean<DealDocumentLike | null>();
  if (!deal) {
    throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
  }

  const context = await fetchDealContext(deal);

  await notificationQueue.add('deal-stage', {
    userId: String(deal.studentId),
    type: 'deal_interest',
    title: `Your deal has moved to Stage ${parsed.newStage}`,
    body:
      isStageThreeTransition
        ? `${context.investor.displayName} submitted ${context.startup.name} to ProMove for stock transfer review.`
        : `${context.investor.displayName} advanced the deal for ${context.startup.name}.`,
    link: '/startup-launch',
  });

  return {
    deal: buildDetail(
      deal,
      context.startup,
      context.student,
      context.investor,
      context.investor.displayName,
      context.productWorkshop,
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
    acceptingPenny?: boolean;
    acceptingSole?: boolean;
  },
) => {
  await ensureInvestor(investorId);

  const page = Math.max(filters.page ?? 1, 1);
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 50);
  const query: Record<string, unknown> = { launchedToInvestors: true, reviewStatus: 'approved' };

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

  const acceptingClauses: Array<Record<string, unknown>> = [];
  if (filters.acceptingPenny) {
    acceptingClauses.push({ $expr: { $lt: ['$currentPennyCount', '$maxPennyInvestors'] } });
  }
  if (filters.acceptingSole) {
    acceptingClauses.push({ hasSoleInvestor: false });
  }
  if (acceptingClauses.length === 1) {
    Object.assign(query, acceptingClauses[0]);
  } else if (acceptingClauses.length > 1) {
    query.$or = acceptingClauses;
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
      acceptsPennyInvestors: startup.currentPennyCount < startup.maxPennyInvestors,
      acceptsSoleInvestor: !startup.hasSoleInvestor,
      sharePool: {
        totalShares: startup.totalShares,
        availableShares: startup.availableShares,
      },
      ...(startup.adminReviewedAt
        ? { adminApprovedAt: startup.adminReviewedAt.toISOString() }
        : {}),
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
    reviewStatus: 'approved',
  })
    .select('_id name tagline category stage pitchDeckUrl pitchDeckStorageProvider pitchDeckStorageKey founderIds launchedToInvestors launchedAt innovationScoreAtLaunch traction totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor soleInvestorId')
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
  const pitchDeckUrl = getSignedPitchDeckUrl(startup);

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
      ...(pitchDeckUrl ? { pitchDeckUrl } : {}),
      traction: startup.traction,
      acceptsPennyInvestors: startup.currentPennyCount < startup.maxPennyInvestors,
      acceptsSoleInvestor: !startup.hasSoleInvestor,
      sharePool: {
        totalShares: startup.totalShares,
        availableShares: startup.availableShares,
      },
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
    canExpressInterest: startup.currentPennyCount < startup.maxPennyInvestors || !startup.hasSoleInvestor,
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
      ? await Startup.find({ _id: { $in: startupIds } }).select('_id name category projectId').lean<LeanStartup[]>()
      : [];
  const startupMap = new Map(startups.map((startup) => [String(startup._id), startup]));
  const productWorkshopIds = [
    ...new Set(deals.map((deal) => String(deal.linkedWorkspaceId ?? '')).filter(Boolean)),
  ];
  const productWorkshops =
    productWorkshopIds.length > 0
      ? await Workspace.find({ _id: { $in: productWorkshopIds }, isActive: true })
          .select('_id title category stage progressPercent')
          .lean<LeanProductWorkshop[]>()
      : [];
  const productWorkshopMap = new Map(
    productWorkshops.map((workspace) => [String(workspace._id), workspace]),
  );

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

    return dealToPortfolioItem(
      deal,
      student,
      startup,
      deal.linkedWorkspaceId
        ? productWorkshopMap.get(String(deal.linkedWorkspaceId))
        : undefined,
    );
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

export const getInvestorAuthorityPortfolio = async (investorId: string): Promise<InvestorAuthorityView[]> => {
  await ensureInvestor(investorId);

  const deals = await Deal.find({ investorId, status: { $ne: 'cancelled' } })
    .sort({ updatedAt: -1 })
    .lean<DealDocumentLike[]>();
  const startupIds = [...new Set(deals.map((deal) => String(deal.startupId)))];
  const startups =
    startupIds.length > 0
      ? await Startup.find({ _id: { $in: startupIds } }).select('_id name').lean<Array<{ _id: Types.ObjectId; name: string }>>()
      : [];
  const startupMap = new Map(startups.map((startup) => [String(startup._id), startup.name]));

  return deals.map((deal) => ({
    dealId: String(deal._id),
    startupId: String(deal.startupId),
    startupName: startupMap.get(String(deal.startupId)) ?? 'Startup',
    investorType: deal.investorType,
    equityPercent: deal.equityPercent,
    sharesAllocated: deal.sharesAllocated,
    stage: deal.stage,
    investorRole: deal.investorRole,
    votingWeight: deal.votingWeight,
    canVeto: deal.canVeto,
    canAccessFinancials: deal.canAccessFinancials,
    canRequestUpdates: deal.canRequestUpdates,
  }));
};

const getStartupAccess = async (startupId: string, userId: string, role: UserRole) => {
  const startup = await Startup.findById(startupId)
    .select('_id founderIds totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor soleInvestorId')
    .lean<LeanStartup>();

  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  const hasFullAccess =
    role === UserRole.ADMIN ||
    startup.founderIds.some((founderId) => String(founderId) === userId) ||
    (startup.soleInvestorId ? String(startup.soleInvestorId) === userId : false);
  const ownInvestment = Types.ObjectId.isValid(userId)
    ? await Deal.findOne({
        startupId,
        investorId: userId,
        ...buildOfficialDealQuery(),
      }).lean<DealDocumentLike | null>()
    : null;

  return { startup, hasFullAccess, ownInvestment };
};

export const getStartupInvestors = async (
  startupId: string,
  userId: string,
  role: UserRole,
): Promise<StartupInvestorView[]> => {
  const access = await getStartupAccess(startupId, userId, role);
  if (!access.hasFullAccess) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot view the full investor list for this startup');
  }

  const deals = await Deal.find({ startupId, ...buildOfficialDealQuery() })
    .sort({ investorType: 1, createdAt: 1 })
    .lean<DealDocumentLike[]>();
  const investorIds = [...new Set(deals.map((deal) => String(deal.investorId)))];
  const investors =
    investorIds.length > 0
      ? await User.find({ _id: { $in: investorIds } }).select('_id displayName').lean<Array<{ _id: Types.ObjectId; displayName: string }>>()
      : [];
  const investorMap = new Map(investors.map((investor) => [String(investor._id), investor.displayName]));

  return deals.map((deal) => ({
    dealId: String(deal._id),
    investorId: String(deal.investorId),
    name: investorMap.get(String(deal.investorId)) ?? 'Investor',
    investorType: deal.investorType,
    equityPercent: deal.equityPercent,
    sharesAllocated: deal.sharesAllocated,
    amountINR: deal.amountINR,
    stage: deal.stage,
    ...(deal.closedAt ? { closedAt: deal.closedAt.toISOString() } : {}),
    investorRole: deal.investorRole,
    votingWeight: deal.votingWeight,
    canVeto: deal.canVeto,
    canAccessFinancials: deal.canAccessFinancials,
    canRequestUpdates: deal.canRequestUpdates,
  }));
};

const getCapTableBase = async (startupId: string): Promise<CapTableResponse> => {
  const cached = await redis.get<string>(capTableCacheKey(startupId));
  const cachedValue = readRedisJson<CapTableResponse>(cached);
  if (cachedValue) {
    return cachedValue;
  }

  const startup = await Startup.findById(startupId)
    .select('_id totalShares availableShares')
    .lean<Pick<LeanStartup, '_id' | 'totalShares' | 'availableShares'>>();
  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  const deals = await Deal.find({ startupId, ...buildOfficialDealQuery() })
    .sort({ createdAt: 1 })
    .lean<DealDocumentLike[]>();
  const investorIds = [...new Set(deals.map((deal) => String(deal.investorId)))];
  const investors =
    investorIds.length > 0
      ? await User.find({ _id: { $in: investorIds } }).select('_id displayName').lean<Array<{ _id: Types.ObjectId; displayName: string }>>()
      : [];
  const investorMap = new Map(investors.map((investor) => [String(investor._id), investor.displayName]));
  const mapRow = (deal: DealDocumentLike) => ({
    dealId: String(deal._id),
    investorId: String(deal.investorId),
    name: investorMap.get(String(deal.investorId)) ?? 'Investor',
    investorType: deal.investorType,
    equityPercent: deal.equityPercent,
    sharesAllocated: deal.sharesAllocated,
    investorRole: deal.investorRole,
    votingWeight: deal.votingWeight,
    canVeto: deal.canVeto,
    canAccessFinancials: deal.canAccessFinancials,
    canRequestUpdates: deal.canRequestUpdates,
  });
  const soleDeal = deals.find((deal) => deal.investorType === 'sole') ?? null;
  const pennyDeals = deals.filter((deal) => deal.investorType === 'penny');
  const allocatedShares = deals.reduce((sum, deal) => sum + deal.sharesAllocated, 0);

  const capTable: CapTableResponse = {
    startupId: String(startup._id),
    totalShares: startup.totalShares,
    availableShares: startup.availableShares,
    visibility: 'full',
    soleInvestor: soleDeal ? mapRow(soleDeal) : null,
    pennyInvestors: pennyDeals.map(mapRow),
    founderRetained: {
      sharesAllocated: Math.max(startup.totalShares - allocatedShares, 0),
      equityPercent:
        startup.totalShares > 0
          ? round((Math.max(startup.totalShares - allocatedShares, 0) / startup.totalShares) * 100)
          : 0,
    },
    totalInvestorEquity: round(deals.reduce((sum, deal) => sum + deal.equityPercent, 0)),
  };

  await redis.set(capTableCacheKey(startupId), JSON.stringify(capTable), { ex: 60 });
  return capTable;
};

export const getStartupCapTable = async (
  startupId: string,
  userId: string,
  role: UserRole,
): Promise<CapTableResponse> => {
  const access = await getStartupAccess(startupId, userId, role);
  const capTable = await getCapTableBase(startupId);

  if (access.hasFullAccess) {
    return capTable;
  }

  if (!access.ownInvestment) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot view this cap table');
  }

  const ownDealId = String(access.ownInvestment._id);
  const ownPennyRow = capTable.pennyInvestors.find((row) => row.dealId === ownDealId);
  const ownSoleRow = capTable.soleInvestor?.dealId === ownDealId ? capTable.soleInvestor : null;

  return {
    ...capTable,
    visibility: 'limited',
    soleInvestor: ownSoleRow
      ? ownSoleRow
      : capTable.soleInvestor
        ? { ...capTable.soleInvestor, investorId: undefined, name: undefined }
        : null,
    pennyInvestors: ownPennyRow ? [ownPennyRow] : [],
  };
};

export const updateInvestmentRole = async (dealId: string, investorRole: InvestorRole) => {
  const deal = await Deal.findById(dealId);
  if (!deal || deal.status === 'cancelled') {
    throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
  }

  const startup = await Startup.findById(deal.startupId)
    .select('_id founderIds totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor soleInvestorId')
    .lean<LeanStartup>();
  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  await validateInvestmentTerms({
    startup,
    investorType: deal.investorType,
    equityPercent: deal.equityPercent,
    chosenRole: investorRole,
    excludeId: String(deal._id),
    currentSharesAllocated: deal.sharesAllocated,
  });
  const authority = resolveInvestorAuthority(deal.investorType, deal.equityPercent, investorRole);

  deal.investorRole = authority.investorRole;
  deal.votingWeight = authority.votingWeight;
  deal.canVeto = authority.canVeto;
  deal.canAccessFinancials = authority.canAccessFinancials;
  deal.canRequestUpdates = authority.canRequestUpdates;
  await deal.save();

  await invalidateInvestmentCaches(String(deal.startupId), String(deal.investorId));
  const context = await fetchDealContext(deal.toObject() as DealDocumentLike);
  return buildDetail(
    deal.toObject() as DealDocumentLike,
    context.startup,
    context.student,
    context.investor,
    context.investor.displayName,
    context.productWorkshop,
  );
};

export const getInvestmentTypeAnalytics = async (): Promise<InvestmentTypeAnalytics> => {
  const deals = await Deal.find({ status: { $ne: 'cancelled' } })
    .select('investorType amountINR')
    .lean<Array<Pick<DealDocumentLike, 'investorType' | 'amountINR'>>>();

  return {
    pennyCount: deals.filter((deal) => deal.investorType === 'penny').length,
    soleCount: deals.filter((deal) => deal.investorType === 'sole').length,
    pennyCapitalDeployed: deals
      .filter((deal) => deal.investorType === 'penny')
      .reduce((sum, deal) => sum + deal.amountINR, 0),
    soleCapitalDeployed: deals
      .filter((deal) => deal.investorType === 'sole')
      .reduce((sum, deal) => sum + deal.amountINR, 0),
  };
};

export const resetSoleInvestorForStartup = async (startupId: string) => {
  const startup = await Startup.findById(startupId);
  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  const soleDeals = await Deal.find({ startupId, investorType: 'sole', status: { $ne: 'cancelled' } });
  const refundedShares = soleDeals.reduce((sum, deal) => sum + deal.sharesAllocated, 0);

  await Promise.all(
    soleDeals.map(async (deal) => {
      deal.status = 'cancelled';
      deal.adminApprovalRequired = false;
      deal.canVeto = false;
      deal.canAccessFinancials = false;
      deal.votingWeight = 0;
      await deal.save();
    }),
  );

  startup.availableShares = Math.min(startup.totalShares, startup.availableShares + refundedShares);
  startup.hasSoleInvestor = false;
  startup.soleInvestorId = null;
  await startup.save();
  await invalidateInvestmentCaches(startupId);
};

export const linkWorkshopToDeal = async (dealId: string, workspaceId: string, userId: string) => {
  const deal = await Deal.findById(dealId);
  if (!deal) {
    throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
  }

  if (String(deal.studentId) !== userId) {
    throw new ApiError(403, 'FORBIDDEN', 'Only the founder can link a workshop to this deal');
  }

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  }

  const isOwner = String(workspace.ownerId) === userId;
  const isTeamMember = workspace.teamMemberIds?.some((id) => String(id) === userId);
  if (!isOwner && !isTeamMember) {
    throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this workspace');
  }

  deal.linkedWorkspaceId = new Types.ObjectId(workspaceId);
  await deal.save();
  if (deal.founderDecision?.status === 'accepted' || deal.stage >= 2) {
    await ensureDirectWorkspaceChatAccess(workspaceId, String(deal.investorId), 'investor');
  }
  await invalidateInvestmentCaches(String(deal.startupId));

  return {
    message: 'Workshop linked to deal',
    workspaceId,
    workspaceTitle: workspace.title,
  };
};

export const unlinkWorkshopFromDeal = async (dealId: string, userId: string) => {
  const deal = await Deal.findById(dealId);
  if (!deal) {
    throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
  }

  if (String(deal.studentId) !== userId) {
    throw new ApiError(403, 'FORBIDDEN', 'Only the founder can unlink a workshop from this deal');
  }

  deal.linkedWorkspaceId = undefined;
  await deal.save();
  await invalidateInvestmentCaches(String(deal.startupId));

  return { message: 'Workshop unlinked from deal' };
};

export const addNegotiationMessage = async (
  dealId: string,
  userId: string,
  message: string,
  senderRole: 'investor' | 'student',
) => {
  const deal = await Deal.findById(dealId);
  if (!deal || deal.status === 'cancelled') {
    throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
  }

  if (deal.stage !== 0) {
    throw new ApiError(400, 'INVALID_STAGE', 'Negotiation is only allowed at Stage 0');
  }

  if (
    (senderRole === 'investor' && String(deal.investorId) !== userId) ||
    (senderRole === 'student' && String(deal.studentId) !== userId)
  ) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot participate in this negotiation');
  }

  if (!deal.negotiation) {
    deal.negotiation = {
      status: 'initial',
      messages: [],
    };
  }

  deal.negotiation.messages.push({
    _id: new Types.ObjectId(),
    senderId: new Types.ObjectId(userId),
    senderRole,
    message,
    timestamp: new Date(),
  });
  deal.negotiation.lastUpdatedAt = new Date();

  await deal.save();
  return deal.negotiation;
};

export const proposeNegotiationTerms = async (
  dealId: string,
  userId: string,
  amountINR: number,
  equityPercent: number,
  senderRole: 'investor' | 'student',
) => {
  const deal = await Deal.findById(dealId);
  if (!deal || deal.status === 'cancelled') {
    throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
  }

  if (deal.stage !== 0) {
    throw new ApiError(400, 'INVALID_STAGE', 'Negotiation is only allowed at Stage 0');
  }

  if (senderRole === 'investor') {
    if (String(deal.investorId) !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Only the investor can propose terms');
    }
    deal.negotiation = deal.negotiation || { status: 'initial', messages: [] };
    deal.negotiation.investorProposedAmount = amountINR;
    deal.negotiation.investorProposedEquity = equityPercent;
    deal.negotiation.status = 'terms_proposed';
  } else {
    if (String(deal.studentId) !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Only the student can counter-offer');
    }
    deal.negotiation = deal.negotiation || { status: 'initial', messages: [] };
    deal.negotiation.studentCounterAmount = amountINR;
    deal.negotiation.studentCounterEquity = equityPercent;
    deal.negotiation.status = 'counter_offer';
  }

  deal.negotiation.lastUpdatedAt = new Date();
  await deal.save();
  return deal.negotiation;
};

export const agreeNegotiationTerms = async (
  dealId: string,
  userId: string,
  senderRole: 'investor' | 'student',
) => {
  const deal = await Deal.findById(dealId);
  if (!deal || deal.status === 'cancelled') {
    throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
  }

  if (deal.stage !== 0) {
    throw new ApiError(400, 'INVALID_STAGE', 'Negotiation is only allowed at Stage 0');
  }

  if (!deal.negotiation?.investorProposedAmount) {
    throw new ApiError(400, 'NO_TERMS', 'No terms have been proposed yet');
  }

  const currentAgreed = deal.negotiation.status === 'terms_agreed';
  
  if (currentAgreed) {
    return deal.negotiation;
  }

  deal.negotiation = deal.negotiation || { status: 'initial', messages: [] };
  if (
    senderRole === 'investor' &&
    typeof deal.negotiation.studentCounterAmount === 'number' &&
    typeof deal.negotiation.studentCounterEquity === 'number'
  ) {
    deal.negotiation.finalAgreedAmount = deal.negotiation.studentCounterAmount;
    deal.negotiation.finalAgreedEquity = deal.negotiation.studentCounterEquity;
  } else {
    deal.negotiation.finalAgreedAmount = deal.negotiation.investorProposedAmount;
    deal.negotiation.finalAgreedEquity = deal.negotiation.investorProposedEquity;
  }
  deal.negotiation.status = 'terms_agreed';
  deal.negotiation.termsAgreedAt = new Date();
  deal.negotiation.lastUpdatedAt = new Date();

  await deal.save();
  return deal.negotiation;
};

// ─── Marketplace Bid Board ──────────────────────────────────────────────────

type LeanBidder = {
  _id: Types.ObjectId;
  displayName: string;
  avatar?: string;
  innovationScore: number;
};

type LeanStartupBidInfo = {
  _id: Types.ObjectId;
  name: string;
  tagline: string;
  fundingNeeded?: number;
  maxPennyInvestors: number;
  currentPennyCount: number;
  hasSoleInvestor: boolean;
  founderIds: Types.ObjectId[];
};

export const getStartupBidBoard = async (
  startupId: string,
  viewerId?: string,
): Promise<StartupBidBoardResponse> => {
  const startup = await Startup.findOne({
    _id: startupId,
    launchedToInvestors: true,
    reviewStatus: 'approved',
  })
    .select('_id name tagline fundingNeeded maxPennyInvestors currentPennyCount hasSoleInvestor founderIds')
    .lean<LeanStartupBidInfo | null>();

  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found or not open for bids');
  }

  const [pennyDeals, soleDeals] = await Promise.all([
    Deal.find({ startupId, investorType: 'penny', status: 'active' })
      .select('_id investorId amountINR equityPercent coverLetter createdAt founderDecision investorRole')
      .populate<{ investorId: LeanBidder }>('investorId', '_id displayName avatar innovationScore')
      .sort({ createdAt: 1 })
      .lean<Array<DealDocumentLike & { investorId: LeanBidder }>>(),
    Deal.find({ startupId, investorType: 'sole', status: 'active' })
      .select('_id investorId amountINR equityPercent coverLetter createdAt founderDecision investorRole')
      .populate<{ investorId: LeanBidder }>('investorId', '_id displayName avatar innovationScore')
      .sort({ amountINR: -1, createdAt: 1 })
      .lean<Array<DealDocumentLike & { investorId: LeanBidder }>>(),
  ]);

  const pennyTotal = pennyDeals.reduce((sum, d) => sum + (d.amountINR ?? 0), 0);

  const contributors = pennyDeals.map((d) => ({
    bidId: String(d._id),
    investorId: String(d.investorId._id),
    name: d.investorId.displayName ?? 'Investor',
    ...(d.investorId.avatar ? { avatar: d.investorId.avatar } : {}),
    innovationScore: d.investorId.innovationScore ?? 0,
    amountINR: d.amountINR,
    equityPercent: d.equityPercent,
    placedAt: d.createdAt.toISOString(),
    isCurrentUser: viewerId ? String(d.investorId._id) === viewerId : false,
  }));

  const soleBidsList = soleDeals.map((d) => ({
    bidId: String(d._id),
    investorId: String(d.investorId._id),
    name: d.investorId.displayName ?? 'Investor',
    ...(d.investorId.avatar ? { avatar: d.investorId.avatar } : {}),
    innovationScore: d.investorId.innovationScore ?? 0,
    amountINR: d.amountINR,
    equityPercent: d.equityPercent,
    ...(d.coverLetter ? { coverLetter: d.coverLetter } : {}),
    role: d.investorRole,
    founderDecisionStatus: (d.founderDecision?.status as 'pending' | 'accepted' | 'rejected') ?? 'pending',
    isCurrentUser: viewerId ? String(d.investorId._id) === viewerId : false,
    placedAt: d.createdAt.toISOString(),
  }));

  const allDeals = [...pennyDeals, ...soleDeals];
  const currentUserDeal = viewerId
    ? allDeals.find((d) => String(d.investorId._id) === viewerId)
    : undefined;

  return {
    startupId,
    startupName: startup.name,
    startupTagline: startup.tagline,
    ...(typeof startup.fundingNeeded === 'number' ? { fundingTarget: startup.fundingNeeded } : {}),
    acceptsPennyInvestors: startup.currentPennyCount < startup.maxPennyInvestors,
    acceptsSoleInvestor: !startup.hasSoleInvestor,
    pennyPool: {
      totalRaised: pennyTotal,
      investorCount: pennyDeals.length,
      maxInvestors: startup.maxPennyInvestors,
      contributors,
    },
    soleBids: soleBidsList,
    hasSoleInvestorAccepted: startup.hasSoleInvestor,
    ...(currentUserDeal
      ? {
          currentUserBid: {
            bidId: String(currentUserDeal._id),
            investorType: currentUserDeal.investorType,
            status: (currentUserDeal.founderDecision?.status as 'pending' | 'accepted' | 'rejected') ?? 'pending',
          },
        }
      : {}),
  };
};

export const PlaceBidSchema = ExpressInterestSchema;

export const placeBidFromUser = async (
  userId: string,
  startupId: string,
  payload: z.infer<typeof PlaceBidSchema>,
): Promise<DealDetailView> => {
  const parsed = PlaceBidSchema.parse(payload);

  const user = await User.findById(userId)
    .select('_id displayName role isActive innovationScore')
    .lean<(LeanUser & { isActive?: boolean }) | null>();

  if (!user || !user.isActive) {
    throw new ApiError(403, 'FORBIDDEN', 'User not found or inactive');
  }

  if (user.role !== UserRole.STUDENT && user.role !== UserRole.INVESTOR) {
    throw new ApiError(403, 'FORBIDDEN', 'Only students and investors can place bids');
  }

  const transactionResult = await runMongoTransaction(async (session) => {
    const startup = await Startup.findOne({
      _id: startupId,
      launchedToInvestors: true,
      reviewStatus: 'approved',
    })
      .session(session)
      .select(
        '_id name tagline category stage pitchDeckUrl founderIds launchedToInvestors launchedAt innovationScoreAtLaunch traction totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor soleInvestorId',
      )
      .lean<LeanStartup | null>();

    if (!startup) {
      throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found or not open for bids');
    }

    if (startup.founderIds.some((id) => String(id) === userId)) {
      throw new ApiError(400, 'SELF_BID', 'Founders cannot bid on their own startup');
    }

    const studentId = startup.founderIds[0];
    if (!studentId) {
      throw new ApiError(400, 'STARTUP_NO_FOUNDERS', 'Startup does not have a founder linked');
    }

    const founder = await User.findById(studentId)
      .session(session)
      .select('_id innovationScore role isActive')
      .lean<(LeanUser & { isActive?: boolean }) | null>();
    if (!founder || founder.role !== UserRole.STUDENT || !founder.isActive) {
      throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
    }

    const existing = await Deal.findOne({ investorId: userId, startupId, studentId }).session(session);
    if (existing && existing.status !== 'cancelled') {
      return { existingDealId: String(existing._id), founderIds: startup.founderIds };
    }

    if (parsed.investorType === 'sole' && startup.hasSoleInvestor) {
      throw new ApiError(409, 'SOLE_INVESTOR_EXISTS', 'This startup already has a sole investor');
    }

    if (parsed.investorType === 'penny' && startup.currentPennyCount >= startup.maxPennyInvestors) {
      throw new ApiError(409, 'PENNY_SLOTS_FULL', 'Penny investor slots are full for this startup');
    }

    const sharesToAllocate = await validateInvestmentTerms({
      startup,
      investorType: parsed.investorType,
      equityPercent: parsed.proposedEquityPercent,
      chosenRole: parsed.chosenRole,
      excludeId: existing ? String(existing._id) : undefined,
      session,
    });

    const authority = resolveInvestorAuthority(parsed.investorType, parsed.proposedEquityPercent, parsed.chosenRole);

    const deal =
      existing ??
      new Deal({
        investorId: userId,
        startupId,
        studentId,
      });

    deal.mediatorLabel = 'ProMove';
    deal.requestOrigin = user.role === UserRole.INVESTOR ? 'investor' : 'student';
    deal.mediationStatus = 'intake';
    deal.investorType = parsed.investorType;
    deal.stage = 0;
    deal.negotiation = {
      status: 'initial',
      investorProposedAmount: parsed.proposedAmountINR,
      investorProposedEquity: parsed.proposedEquityPercent,
      messages: [],
    };
    deal.amountINR = parsed.proposedAmountINR;
    deal.proposedAmountINR = parsed.proposedAmountINR;
    deal.equityPercent = parsed.proposedEquityPercent;
    deal.proposedEquityPercent = parsed.proposedEquityPercent;
    deal.sharesAllocated = sharesToAllocate;
    deal.stockDetails = {
      shareClassLabel: DEFAULT_SHARE_CLASS_LABEL,
      sharePriceInr: sharesToAllocate > 0 ? round(parsed.proposedAmountINR / sharesToAllocate) : 0,
      transferValueInr: parsed.proposedAmountINR,
      totalSharesConsidered: sharesToAllocate,
    };
    deal.stockTransfer = { status: 'not_started' };
    deal.royalty = {
      promovePercentage: DEFAULT_PROMOVE_ROYALTY_PERCENTAGE,
      promoveAmountINR: calculateRoyaltyAmount(parsed.proposedAmountINR, DEFAULT_PROMOVE_ROYALTY_PERCENTAGE),
      status: 'pending',
    };
    deal.founderDecision = { status: 'pending' };
    deal.investorRole = authority.investorRole;
    deal.votingWeight = authority.votingWeight;
    deal.canVeto = authority.canVeto;
    deal.canAccessFinancials = authority.canAccessFinancials;
    deal.canRequestUpdates = authority.canRequestUpdates;
    deal.innovationScoreSnapshot = founder.innovationScore ?? 0;
    deal.status = 'active';
    deal.adminApprovalRequired = false;
    deal.adminApprovedAt = undefined;
    deal.adminApprovedBy = undefined;
    deal.closedAt = undefined;
    deal.fundTransferInitiatedAt = undefined;
    if (parsed.coverLetter) {
      deal.coverLetter = parsed.coverLetter;
    }

    await deal.save({ session });

    return { dealId: String(deal._id), founderIds: startup.founderIds };
  });

  await invalidateInvestmentCaches(startupId, userId);

  if ('existingDealId' in transactionResult) {
    const existingDeal = await Deal.findById(transactionResult.existingDealId).lean<DealDocumentLike | null>();
    if (!existingDeal) {
      throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
    }
    const context = await fetchDealContext(existingDeal);
    return buildDetail(existingDeal, context.startup, context.student, context.investor, context.investor.displayName, context.productWorkshop);
  }

  await pushFounderNotification(
    transactionResult.founderIds,
    `New ${parsed.investorType} investor bid on your startup`,
    parsed.investorType === 'sole'
      ? 'A sole investor placed a bid on your startup. Review it in your deal board.'
      : `A penny investor bid ₹${parsed.proposedAmountINR.toLocaleString()} for ${round(parsed.proposedEquityPercent)}% equity.`,
  );

  const createdDeal = await Deal.findById(transactionResult.dealId).lean<DealDocumentLike | null>();
  if (!createdDeal) {
    throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
  }

  const context = await fetchDealContext(createdDeal);
  return buildDetail(createdDeal, context.startup, context.student, context.investor, context.investor.displayName, context.productWorkshop);
};
