import { ClientSession, Types } from 'mongoose';
import { z } from 'zod';
import { notificationQueue } from '../../config/bullmq';
import { redis } from '../../config/redis';
import { extractS3KeyFromUrl, generatePresignedUrl } from '../../services/fileStorageService';
import { generateSignedCloudinaryUrl } from '../../services/cloudinaryService';
import type { DealContractData } from '../../services/dealContract';
import { ApiError } from '../../utils/ApiError';
import { readRedisJson } from '../../utils/redisJson';
import { runMongoTransaction } from '../../utils/runMongoTransaction';
import { UserRole } from '../../types/roles.types';
import { ScoreEvent } from '../innovationScore/score.model';
import { Startup } from '../startup/startup.model';
import { User } from '../user/user.model';
import { Workspace } from '../workspace/workspace.model';
import { ensureDirectWorkspaceChatAccess } from '../workspace/workspace.service';
import { recordStartupLifecycleEvent } from '../startupLifecycle/startupLifecycle.service';
import { Deal } from './deal.model';
import { Bid } from '../bidding/bidding.model';
import { BIDDING_EXPIRY_DAYS } from '../bidding/bidding.types';
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

const formatNegotiationAmount = (amount: number) => `INR ${amount.toLocaleString('en-IN')}`;

const buildTermsMessage = (
  senderRole: 'investor' | 'student',
  amountINR: number,
  equityPercent: number,
) =>
  senderRole === 'investor'
    ? `Investor proposed terms: ${formatNegotiationAmount(amountINR)} for ${equityPercent}% equity.`
    : `Student countered: ${formatNegotiationAmount(amountINR)} for ${equityPercent}% equity.`;

export const ExpressInterestSchema = z.object({
  investorType: z.enum(['penny', 'sole']),
  proposedAmountINR: z.number().min(20000),
  proposedEquityPercent: z.number().min(0.01).max(100),
  chosenRole: z.enum(['shareholder', 'director', 'observer']).optional(),
  coverLetter: z.string().trim().max(1000).optional(),
});

export const NegotiationTermsSchema = z.object({
  amountINR: z.number().min(20000),
  equityPercent: z.number().min(0.01).max(100),
});

export const cancelDealSchema = z.object({
  reason: z.string().trim().max(500).optional(),
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
type NegotiationParticipantRole = 'investor' | 'student';

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
const BIDDER_ACCOUNT_ROLES = new Set<UserRole>([
  UserRole.STUDENT,
  UserRole.INVESTOR,
  UserRole.MENTOR,
]);

const capTableCacheKey = (startupId: string) => `cap-table:${startupId}`;
const pennyEquityCacheKey = (startupId: string) => `penny-equity:${startupId}`;
const round = (value: number) => Number(value.toFixed(2));
const computeShares = (equityPercent: number, totalShares: number) =>
  Math.floor((equityPercent / 100) * totalShares);

const currentStage = (deal: DealDocumentLike): DealStage => deal.stage;

const nextActionLabel = (deal: DealDocumentLike): string => {
  if (deal.cancellationRequest?.status === 'pending') {
    return 'Cancellation request under admin review';
  }
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

const getCancellationRequestView = (deal: DealDocumentLike) => {
  const request = deal.cancellationRequest;
  if (!request?.status) {
    return undefined;
  }

  return {
    status: request.status,
    ...(request.reason ? { reason: request.reason } : {}),
    ...(request.requestedBy ? { requestedBy: String(request.requestedBy) } : {}),
    ...(request.requestedByRole ? { requestedByRole: request.requestedByRole } : {}),
    ...(request.requestedAt ? { requestedAt: request.requestedAt.toISOString() } : {}),
    ...(request.reviewedBy ? { reviewedBy: String(request.reviewedBy) } : {}),
    ...(request.reviewedAt ? { reviewedAt: request.reviewedAt.toISOString() } : {}),
    ...(request.reviewNotes ? { reviewNotes: request.reviewNotes } : {}),
  };
};

const getPaymentApprovalView = (deal: DealDocumentLike) => {
  const approval = deal.paymentApproval;
  if (!approval?.status || approval.status === 'none') {
    return undefined;
  }

  return {
    status: approval.status,
    ...(approval.requestedAt ? { requestedAt: approval.requestedAt.toISOString() } : {}),
    ...(approval.requestedBy ? { requestedBy: String(approval.requestedBy) } : {}),
    ...(approval.reviewedAt ? { reviewedAt: approval.reviewedAt.toISOString() } : {}),
    ...(approval.reviewedBy ? { reviewedBy: String(approval.reviewedBy) } : {}),
    ...(approval.reviewNotes ? { reviewNotes: approval.reviewNotes } : {}),
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
    investorAgreed: negotiation.investorAgreed ?? false,
    startupAgreed: negotiation.startupAgreed ?? false,
    ...(negotiation.investorAgreedAt ? { investorAgreedAt: negotiation.investorAgreedAt.toISOString() } : {}),
    ...(negotiation.startupAgreedAt ? { startupAgreedAt: negotiation.startupAgreedAt.toISOString() } : {}),
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

const getSignedPitchDeckUrl = async (startup: LeanStartup) => {
  if (!startup.pitchDeckUrl) {
    return undefined;
  }

  try {
    if (startup.pitchDeckStorageProvider === 'cloudinary') {
      const storageKey = startup.pitchDeckStorageKey || extractCloudinaryPublicId(startup.pitchDeckUrl);
      return storageKey ? generateSignedCloudinaryUrl(storageKey, 'raw') : startup.pitchDeckUrl;
    }

    const s3Key =
      startup.pitchDeckStorageProvider === 's3'
        ? startup.pitchDeckStorageKey || extractS3KeyFromUrl(startup.pitchDeckUrl)
        : extractS3KeyFromUrl(startup.pitchDeckUrl);

    return s3Key ? await generatePresignedUrl(s3Key) : startup.pitchDeckUrl;
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
    ...(deal.officialContract?.contractNumber && deal.officialContract.generatedAt
      ? {
          officialContract: {
            contractNumber: deal.officialContract.contractNumber,
            generatedAt: deal.officialContract.generatedAt.toISOString(),
          },
        }
      : {}),
    stockDetails: getStockDetailsView(deal),
    stockTransfer: getStockTransferView(deal),
    royalty: getRoyaltyView(deal),
    founderDecision: getFounderDecisionView(deal),
    ...(getCancellationRequestView(deal) ? { cancellationRequest: getCancellationRequestView(deal) } : {}),
    ...(getPaymentApprovalView(deal) ? { paymentApproval: getPaymentApprovalView(deal) } : {}),
    ...(getNegotiationView(deal) ? { negotiation: getNegotiationView(deal) } : {}),
    innovationScoreSnapshot: deal.innovationScoreSnapshot,
    nextActionLabel: nextActionLabel(deal),
    ...(mappedProductWorkshop ? { productWorkshop: mappedProductWorkshop } : {}),
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
  };
};

const buildDetail = async (
  deal: DealDocumentLike,
  startup: LeanStartup,
  student: LeanUser,
  investor: LeanUser,
  investorDisplayName: string,
  productWorkshop?: LeanProductWorkshop | null,
): Promise<DealDetailView> => {
  const pitchDeckUrl = await getSignedPitchDeckUrl(startup);

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

const ensureBidderAccount = async (userId: string) => {
  const user = await User.findById(userId)
    .select('_id displayName role isActive')
    .lean<LeanUser & { isActive?: boolean }>();

  if (!user || !BIDDER_ACCOUNT_ROLES.has(user.role) || !user.isActive) {
    throw new ApiError(403, 'FORBIDDEN', 'Only active students, investors, and mentors can bid');
  }

  return user;
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

const resolveDealAccessFilter = async (userId: string, role: UserRole) => {
  if (role === UserRole.ADMIN) {
    return {};
  }

  if (role === UserRole.INVESTOR || role === UserRole.MENTOR) {
    return { investorId: userId };
  }

  if (role === UserRole.STUDENT) {
    const startupIds = await getAccessibleStartupIdsForStudent(userId);
    return {
      $or: [
        { investorId: userId },
        ...(startupIds.length > 0 ? [{ startupId: { $in: startupIds } }] : []),
      ],
    };
  }

  throw new ApiError(403, 'FORBIDDEN', 'You cannot access this deal');
};

const resolveNegotiationParticipantRole = (
  deal: Pick<DealDocumentLike, 'investorId' | 'studentId'>,
  userId: string,
): NegotiationParticipantRole => {
  if (String(deal.investorId) === userId) {
    return 'investor';
  }

  if (String(deal.studentId) === userId) {
    return 'student';
  }

  throw new ApiError(403, 'FORBIDDEN', 'You cannot participate in this negotiation');
};

const getCancellationActorLabel = (role: NegotiationParticipantRole) =>
  role === 'investor' ? 'Investor' : 'Startup';

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

// Deals whose terms are committed by both parties. Includes admin-approved
// deals AND deals where both sides have agreed in negotiation but the deal
// is still awaiting admin review. Used by the cap table so agreed equity
// shows up immediately instead of waiting for admin sign-off.
const buildCommittedDealQuery = (excludeId?: string) => ({
  status: { $ne: 'cancelled' as const },
  $or: [
    { adminApprovedAt: { $exists: true, $ne: null } },
    { 'negotiation.status': 'terms_agreed' as const },
  ],
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

const getActivePennyBidCount = (startupId: string, excludeId?: string, session?: ClientSession) =>
  Deal.countDocuments({
    startupId,
    investorType: 'penny',
    status: 'active',
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).session(session ?? null);

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

const isActiveStudentFounder = (
  user?: LeanUser | null,
): user is LeanUser & { isActive: boolean } =>
  Boolean(user && user.role === UserRole.STUDENT && user.isActive);

const getActiveStudentFounderIds = () =>
  User.distinct('_id', { role: UserRole.STUDENT, isActive: true });

const getEligibleStudentFounders = async (
  founderIds: Types.ObjectId[],
  session?: ClientSession,
) => {
  if (founderIds.length === 0) {
    return [];
  }

  const query = User.find({
    _id: { $in: founderIds },
    role: UserRole.STUDENT,
    isActive: true,
  }).select('_id displayName avatar role innovationScore scoreBreakdown domain isActive');

  if (session) {
    query.session(session);
  }

  const founders = await query.lean<(LeanUser & { isActive?: boolean })[]>();
  const founderMap = new Map(founders.map((founder) => [String(founder._id), founder]));

  return founderIds
    .map((founderId) => founderMap.get(String(founderId)))
    .filter(isActiveStudentFounder);
};

const resolvePrimaryEligibleFounder = async (
  founderIds: Types.ObjectId[],
  session?: ClientSession,
) => {
  if (founderIds.length === 0) {
    throw new ApiError(400, 'STARTUP_NO_FOUNDERS', 'Startup does not have a founder linked');
  }

  const founders = await getEligibleStudentFounders(founderIds, session);
  const founder = founders[0];

  if (!founder) {
    throw new ApiError(
      409,
      'STARTUP_FOUNDER_UNAVAILABLE',
      'This startup cannot receive investment offers because its active founder account is missing.',
    );
  }

  return {
    founder,
    founderIds: founders.map((item) => item._id),
  };
};

export const createInvestorDealFromInterest = async (
  investorId: string,
  startupId: string,
  payload: ExpressInterestInput,
) => {
  const parsed = ExpressInterestSchema.parse(payload);
  await ensureBidderAccount(investorId);

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

    if (startup.founderIds.some((id) => String(id) === investorId)) {
      throw new ApiError(400, 'SELF_BID', 'Founders cannot bid on their own startup');
    }

    const { founder, founderIds } = await resolvePrimaryEligibleFounder(startup.founderIds, session);
    const studentId = founder._id;

    const existing = await Deal.findOne({
      investorId,
      startupId,
      studentId,
    }).session(session);

    if (existing && existing.status !== 'cancelled') {
      const existingBid = await Bid.findOne({ dealId: existing._id }).session(session);
      if (!existingBid) {
        const existingAuthority = resolveInvestorAuthority(
          existing.investorType,
          existing.proposedEquityPercent ?? existing.equityPercent ?? 0,
          existing.investorRole,
        );
        await Bid.create([{
          startupId,
          investorId,
          founderId: studentId,
          status: 'pending',
          bidType: existing.investorType,
          proposedAmount: existing.proposedAmountINR,
          proposedEquity: existing.proposedEquityPercent ?? existing.equityPercent ?? 0,
          coverLetter: existing.coverLetter,
          investorRole: existingAuthority.investorRole,
          dealId: existing._id,
          expiresAt: new Date(Date.now() + BIDDING_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        }], { session });
      }
      return {
        existingDealId: String(existing._id),
        founderIds,
      };
    }

    if (parsed.investorType === 'sole' && startup.hasSoleInvestor) {
      throw new ApiError(409, 'SOLE_INVESTOR_EXISTS', 'This startup already has a sole investor');
    }

    const activePennyBidCount =
      parsed.investorType === 'penny'
        ? await getActivePennyBidCount(startupId, existing ? String(existing._id) : undefined, session)
        : 0;

    if (parsed.investorType === 'penny' && activePennyBidCount >= startup.maxPennyInvestors) {
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
      status: 'terms_proposed',
      investorProposedAmount: parsed.proposedAmountINR,
      investorProposedEquity: parsed.proposedEquityPercent,
      investorAgreed: true,
      investorAgreedAt: new Date(),
      startupAgreed: false,
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

    await Bid.create([{
      startupId,
      investorId,
      founderId: studentId,
      status: 'pending',
      bidType: parsed.investorType,
      proposedAmount: parsed.proposedAmountINR,
      proposedEquity: parsed.proposedEquityPercent,
      coverLetter: parsed.coverLetter,
      investorRole: authority.investorRole,
      dealId: deal._id,
      expiresAt: new Date(Date.now() + BIDDING_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    }], { session });

    return {
      dealId: String(deal._id),
      founderIds,
    };
  });

  await invalidateInvestmentCaches(startupId, investorId);

  if ('existingDealId' in transactionResult) {
    const existingDeal = await Deal.findById(transactionResult.existingDealId).lean<DealDocumentLike | null>();
    if (!existingDeal) {
      throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
    }

    const context = await fetchDealContext(existingDeal);
    return await buildDetail(
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
  await recordStartupLifecycleEvent({
    startupId,
    workspaceId: context.startup.projectId,
    actorId: investorId,
    source: 'investor',
    type: 'INVESTOR_DEAL_CREATED',
    title: 'Investor deal created',
    description: `${context.investor.displayName} started a ${parsed.investorType} investor deal.`,
    status: `stage_${createdDeal.stage}`,
    metadata: {
      dealId: String(createdDeal._id),
      investorId,
      investorType: parsed.investorType,
      proposedAmountINR: parsed.proposedAmountINR,
      proposedEquityPercent: parsed.proposedEquityPercent,
    },
  });
  return await buildDetail(
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
  if (role === UserRole.INVESTOR || role === UserRole.MENTOR) {
    await ensureBidderAccount(userId);
    const deals = await Deal.find({ investorId: userId, status: { $ne: 'cancelled' } })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean<DealDocumentLike[]>();

    const contexts = await Promise.all(deals.map(async (deal) => ({ deal, ...(await fetchDealContext(deal)) })));

    return contexts.map(({ deal, startup, student, investor, productWorkshop }) =>
      buildSummary(deal, startup, student, investor, investor.displayName, productWorkshop),
    );
  }

  if (role !== UserRole.STUDENT) {
    throw new ApiError(403, 'FORBIDDEN', 'Only students, investors, and mentors can access deal lists');
  }

  await ensureStudent(userId);
  const startupIds = await getAccessibleStartupIdsForStudent(userId);

  const deals = await Deal.find({
    status: { $ne: 'cancelled' },
    $or: [
      { investorId: userId },
      ...(startupIds.length > 0 ? [{ startupId: { $in: startupIds } }] : []),
    ],
  })
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
  if (
    role !== UserRole.INVESTOR &&
    role !== UserRole.STUDENT &&
    role !== UserRole.MENTOR &&
    role !== UserRole.ADMIN
  ) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot access this deal');
  }

  const accessFilter = await resolveDealAccessFilter(userId, role);
  const deal = await Deal.findOne({
    _id: dealId,
    ...accessFilter,
  }).lean<DealDocumentLike | null>();

  if (!deal) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot access this deal');
  }

  const context = await fetchDealContext(deal);
  return await buildDetail(
    deal,
    context.startup,
    context.student,
    context.investor,
    context.investor.displayName,
    context.productWorkshop,
  );
};

export const getDealContractData = async (
  userId: string,
  role: UserRole,
  dealId: string,
): Promise<DealContractData> => {
  const accessFilter = await resolveDealAccessFilter(userId, role);
  const deal = await Deal.findOne({
    _id: dealId,
    ...accessFilter,
  }).lean<DealDocumentLike | null>();

  if (!deal) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot access this deal');
  }

  if (!deal.adminApprovedAt || !deal.officialContract?.contractNumber) {
    throw new ApiError(
      409,
      'CONTRACT_NOT_READY',
      'The official contract becomes available after ProMove admin verifies the deal.',
    );
  }

  const context = await fetchDealContext(deal);
  const royaltyPercentage = getRoyaltyPercentage(deal);

  return {
    contractNumber: deal.officialContract.contractNumber,
    generatedAt: deal.officialContract.generatedAt ?? deal.adminApprovedAt,
    adminApprovedAt: deal.adminApprovedAt,
    mediatorLabel: deal.mediatorLabel || 'ProMove',
    mediationStatus: deal.mediationStatus,
    startupName: context.startup.name,
    startupCategory: context.startup.category,
    founderName: context.student.displayName ?? 'Founder',
    investorName: context.investor.displayName ?? 'Investor',
    investorType: deal.investorType,
    investorRole: deal.investorRole,
    amountINR: deal.amountINR,
    equityPercent: deal.equityPercent,
    sharesAllocated: deal.sharesAllocated,
    shareClassLabel: deal.stockDetails?.shareClassLabel ?? 'Common Equity',
    sharePriceInr: deal.stockDetails?.sharePriceInr ?? 0,
    transferValueInr: deal.stockDetails?.transferValueInr ?? deal.amountINR,
    royaltyPercentage,
    royaltyAmountINR: deal.royalty?.promoveAmountINR ?? 0,
  };
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

  return await buildDetail(
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

export const reviewPaymentApprovalSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reviewNotes: z.string().trim().max(1000).optional(),
});

export const reviewPaymentApproval = async (
  adminId: string,
  dealId: string,
  payload: z.infer<typeof reviewPaymentApprovalSchema>,
) => {
  const parsed = reviewPaymentApprovalSchema.parse(payload);
  const reviewedAt = new Date();

  const result = await runMongoTransaction(async (session) => {
    const deal = await Deal.findById(dealId).session(session);
    if (!deal || deal.status !== 'active') {
      throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
    }
    if (deal.stage !== 1) {
      throw new ApiError(400, 'INVALID_STAGE', 'Payment approval can only be reviewed at the payment stage');
    }
    if ((deal.paymentApproval?.status ?? 'none') !== 'requested') {
      throw new ApiError(400, 'PAYMENT_APPROVAL_NOT_PENDING', 'There is no pending payment approval to review');
    }

    deal.paymentApproval = {
      status: parsed.decision,
      requestedAt: deal.paymentApproval?.requestedAt,
      requestedBy: deal.paymentApproval?.requestedBy,
      reviewedAt,
      reviewedBy: new Types.ObjectId(adminId),
      ...(parsed.reviewNotes ? { reviewNotes: parsed.reviewNotes } : {}),
    };

    if (parsed.decision === 'approved') {
      deal.stage = 2;
      deal.fundTransferInitiatedAt = reviewedAt;
      deal.mediationStatus = 'intake';
      const metadata = buildDealFinancialMetadata(deal.toObject() as DealDocumentLike);
      deal.mediatorLabel = metadata.mediatorLabel;
      deal.stockDetails = metadata.stockDetails;
      deal.stockTransfer = metadata.stockTransfer;
      deal.royalty = metadata.royalty;
    }

    await deal.save({ session });

    return {
      dealId: String(deal._id),
      startupId: String(deal.startupId),
      investorId: String(deal.investorId),
      studentId: String(deal.studentId),
      decision: parsed.decision,
      reviewNotes: parsed.reviewNotes,
    };
  });

  await invalidateInvestmentCaches(result.startupId, result.investorId);

  const fresh = await Deal.findById(result.dealId).lean<DealDocumentLike | null>();
  if (!fresh) {
    throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
  }
  const context = await fetchDealContext(fresh);

  const title =
    result.decision === 'approved' ? 'Payment approved by admin' : 'Payment request declined';
  const body =
    result.decision === 'approved'
      ? `ProMove admin approved payment for ${context.startup.name}. The deal has moved to the next stage.`
      : result.reviewNotes || 'ProMove admin declined the payment approval request.';

  await Promise.all([
    notificationQueue.add('deal-stage', {
      userId: result.investorId,
      type: 'deal_interest',
      title,
      body,
      link: '/dashboard/investor/deals',
    }),
    notificationQueue.add('deal-stage', {
      userId: result.studentId,
      type: 'deal_interest',
      title,
      body,
      link: '/startup-launch',
    }),
  ]);

  return buildDetail(
    fresh,
    context.startup,
    context.student,
    context.investor,
    context.investor.displayName,
    context.productWorkshop,
  );
};

export const requestPaymentApproval = async (
  investorId: string,
  dealId: string,
): Promise<DealDetailView> => {
  await ensureInvestor(investorId);

  const transactionResult = await runMongoTransaction(async (session) => {
    const deal = await Deal.findOne({ _id: dealId, investorId }).session(session);
    if (!deal || deal.status !== 'active') {
      throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
    }
    if (deal.stage !== 1) {
      throw new ApiError(400, 'INVALID_STAGE', 'Payment approval can only be requested at the payment stage');
    }
    if ((deal.founderDecision?.status ?? 'pending') !== 'accepted') {
      throw new ApiError(400, 'FOUNDER_ACCEPTANCE_REQUIRED', 'Founder must accept before requesting payment approval');
    }

    const currentStatus = deal.paymentApproval?.status ?? 'none';
    if (currentStatus === 'requested') {
      throw new ApiError(400, 'PAYMENT_APPROVAL_ALREADY_REQUESTED', 'Payment approval has already been requested');
    }
    if (currentStatus === 'approved') {
      throw new ApiError(400, 'PAYMENT_APPROVAL_ALREADY_APPROVED', 'Payment has already been approved');
    }

    deal.paymentApproval = {
      status: 'requested',
      requestedAt: new Date(),
      requestedBy: new Types.ObjectId(investorId),
    };

    await deal.save({ session });

    return {
      dealId: String(deal._id),
      startupId: String(deal.startupId),
      studentId: String(deal.studentId),
    };
  });

  await invalidateInvestmentCaches(transactionResult.startupId, investorId);

  const deal = await Deal.findById(transactionResult.dealId).lean<DealDocumentLike | null>();
  if (!deal) {
    throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
  }
  const context = await fetchDealContext(deal);

  await notificationQueue.add('deal-stage', {
    userId: transactionResult.studentId,
    type: 'deal_interest',
    title: 'Payment approval requested',
    body: `${context.investor.displayName} requested ProMove admin approval for payment on ${context.startup.name}.`,
    link: '/startup-launch',
  });

  return await buildDetail(
    deal,
    context.startup,
    context.student,
    context.investor,
    context.investor.displayName,
    context.productWorkshop,
  );
};

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

  await recordStartupLifecycleEvent({
    startupId: transitionResult.startupId,
    workspaceId: context.startup.projectId,
    actorId: investorId,
    source: 'investor',
    type: 'INVESTOR_DEAL_STAGE_CHANGED',
    title: `Investor deal moved to stage ${parsed.newStage}`,
    description: `${context.investor.displayName} advanced the investor deal.`,
    status: `stage_${parsed.newStage}`,
    metadata: {
      dealId: String(deal._id),
      investorId,
      stage: parsed.newStage,
      status: deal.status,
    },
  });

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
    deal: await buildDetail(
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
  const activeStudentFounderIds = await getActiveStudentFounderIds();

  if (activeStudentFounderIds.length === 0) {
    return {
      items: [],
      page,
      limit,
      total: 0,
    };
  }

  query.founderIds = { $in: activeStudentFounderIds };

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
          .select('_id displayName avatar innovationScore scoreBreakdown role domain isActive')
          .lean<LeanUser[]>()
      : [];
  const founderMap = new Map(founders.map((founder) => [String(founder._id), founder]));

  const items = startups.map((startup) => {
    const founder = startup.founderIds
      .map((founderId) => founderMap.get(String(founderId)))
      .find(isActiveStudentFounder);

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
  const activeStudentFounderIds = await getActiveStudentFounderIds();

  const startup = await Startup.findOne({
    _id: startupId,
    launchedToInvestors: true,
    reviewStatus: 'approved',
    founderIds: { $in: activeStudentFounderIds },
  })
    .select('_id name tagline category stage pitchDeckUrl pitchDeckStorageProvider pitchDeckStorageKey founderIds launchedToInvestors launchedAt innovationScoreAtLaunch traction totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor soleInvestorId')
    .lean<LeanStartup>();

  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  const founders =
    startup.founderIds.length > 0
      ? await User.find({ _id: { $in: startup.founderIds } })
          .select('_id displayName avatar innovationScore scoreBreakdown role domain isActive')
          .lean<LeanUser[]>()
      : [];
  const founderMap = new Map(founders.map((founder) => [String(founder._id), founder]));
  const eligibleFounders = startup.founderIds
    .map((founderId) => founderMap.get(String(founderId)))
    .filter(isActiveStudentFounder);

  const scoreEvents =
    eligibleFounders.length > 0
      ? await ScoreEvent.find({ userId: eligibleFounders[0]._id }).sort({ createdAt: -1 }).limit(25).lean()
      : [];
  const pitchDeckUrl = await getSignedPitchDeckUrl(startup);

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
      founders: eligibleFounders.map((founder) => ({
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

  const deals = await Deal.find({ startupId, ...buildCommittedDealQuery() })
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

  const unissuedShares = Math.max(startup.totalShares - allocatedShares, 0);

  const capTable: CapTableResponse = {
    startupId: String(startup._id),
    totalShares: startup.totalShares,
    availableShares: unissuedShares,
    visibility: 'full',
    soleInvestor: soleDeal ? mapRow(soleDeal) : null,
    pennyInvestors: pennyDeals.map(mapRow),
    founderRetained: {
      sharesAllocated: unissuedShares,
      equityPercent:
        startup.totalShares > 0 ? round((unissuedShares / startup.totalShares) * 100) : 0,
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
  return await buildDetail(
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
  await recordStartupLifecycleEvent({
    startupId: deal.startupId,
    workspaceId,
    actorId: userId,
    source: 'investor',
    type: 'INVESTOR_DEAL_WORKSHOP_LINKED',
    title: 'Investor deal workshop linked',
    description: `${workspace.title} was linked to an investor deal.`,
    status: `stage_${deal.stage}`,
    metadata: {
      dealId,
      investorId: String(deal.investorId),
      workspaceTitle: workspace.title,
    },
  });

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
) => {
  const deal = await Deal.findById(dealId);
  if (!deal || deal.status === 'cancelled') {
    throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
  }

  if (deal.stage !== 0) {
    throw new ApiError(400, 'INVALID_STAGE', 'Negotiation is only allowed at Stage 0');
  }

  const senderRole = resolveNegotiationParticipantRole(deal, userId);

  if (!deal.negotiation) {
    deal.negotiation = {
      status: 'initial',
      messages: [],
    };
  }
  deal.negotiation.messages = deal.negotiation.messages || [];

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
) => {
  const parsedTerms = NegotiationTermsSchema.parse({ amountINR, equityPercent });
  const deal = await Deal.findById(dealId);
  if (!deal || deal.status === 'cancelled') {
    throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
  }

  if (deal.stage !== 0) {
    throw new ApiError(400, 'INVALID_STAGE', 'Negotiation is only allowed at Stage 0');
  }

  const senderRole = resolveNegotiationParticipantRole(deal, userId);
  const startup = await Startup.findById(deal.startupId)
    .select(
      '_id name tagline category stage pitchDeckUrl founderIds launchedToInvestors launchedAt innovationScoreAtLaunch traction totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor soleInvestorId',
    )
    .lean<LeanStartup | null>();

  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  await validateInvestmentTerms({
    startup,
    investorType: deal.investorType,
    equityPercent: parsedTerms.equityPercent,
    chosenRole: deal.investorRole,
    excludeId: String(deal._id),
  });

  deal.negotiation = deal.negotiation || { status: 'initial', messages: [] };
  deal.negotiation.messages = deal.negotiation.messages || [];

  if (senderRole === 'investor') {
    deal.negotiation.investorProposedAmount = parsedTerms.amountINR;
    deal.negotiation.investorProposedEquity = parsedTerms.equityPercent;
    deal.negotiation.studentCounterAmount = undefined;
    deal.negotiation.studentCounterEquity = undefined;
    deal.negotiation.status = 'terms_proposed';
    deal.negotiation.investorAgreed = true;
    deal.negotiation.startupAgreed = false;
    deal.negotiation.investorAgreedAt = new Date();
    deal.negotiation.startupAgreedAt = undefined;
  } else {
    deal.negotiation.studentCounterAmount = parsedTerms.amountINR;
    deal.negotiation.studentCounterEquity = parsedTerms.equityPercent;
    deal.negotiation.status = 'counter_offer';
    deal.negotiation.investorAgreed = false;
    deal.negotiation.startupAgreed = true;
    deal.negotiation.investorAgreedAt = undefined;
    deal.negotiation.startupAgreedAt = new Date();
  }

  // Reset both parties' acceptance — new terms require fresh agreement
  deal.negotiation.messages.push({
    _id: new Types.ObjectId(),
    senderId: new Types.ObjectId(userId),
    senderRole,
    message: buildTermsMessage(senderRole, parsedTerms.amountINR, parsedTerms.equityPercent),
    timestamp: new Date(),
  });

  deal.negotiation.lastUpdatedAt = new Date();
  await deal.save();
  return deal.negotiation;
};

export const agreeNegotiationTerms = async (
  dealId: string,
  userId: string,
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

  if (deal.negotiation.status === 'terms_agreed') {
    return deal.negotiation;
  }

  const senderRole = resolveNegotiationParticipantRole(deal, userId);
  const investorAcceptingStartupCounter =
    senderRole === 'investor' &&
    deal.negotiation.status === 'counter_offer' &&
    typeof deal.negotiation.studentCounterAmount === 'number' &&
    typeof deal.negotiation.studentCounterEquity === 'number';

  const alreadyAgreed =
    senderRole === 'investor' ? deal.negotiation.investorAgreed : deal.negotiation.startupAgreed;

  if (alreadyAgreed) {
    return deal.negotiation;
  }

  deal.negotiation.messages = deal.negotiation.messages || [];

  // Record this party's acceptance
  if (senderRole === 'investor') {
    deal.negotiation.investorAgreed = true;
    deal.negotiation.investorAgreedAt = new Date();
  } else {
    deal.negotiation.startupAgreed = true;
    deal.negotiation.startupAgreedAt = new Date();
  }

  deal.negotiation.messages.push({
    _id: new Types.ObjectId(),
    senderId: new Types.ObjectId(userId),
    senderRole,
    message: `${senderRole === 'investor' ? 'Investor' : 'Startup'} accepted the proposed terms.`,
    timestamp: new Date(),
  });

  // Both parties have now agreed — finalise and send to admin
  if (deal.negotiation.investorAgreed && deal.negotiation.startupAgreed) {
    if (
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
    const finalAgreedAmount = deal.negotiation.finalAgreedAmount;
    const finalAgreedEquity = deal.negotiation.finalAgreedEquity;

    if (typeof finalAgreedAmount !== 'number' || typeof finalAgreedEquity !== 'number') {
      throw new ApiError(400, 'INVALID_AGREED_TERMS', 'Agreed terms are incomplete');
    }

    const startup = await Startup.findById(deal.startupId)
      .select(
        '_id name tagline category stage pitchDeckUrl founderIds launchedToInvestors launchedAt innovationScoreAtLaunch traction totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor soleInvestorId',
      )
      .lean<LeanStartup | null>();

    if (!startup) {
      throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
    }

    const sharesToAllocate = await validateInvestmentTerms({
      startup,
      investorType: deal.investorType,
      equityPercent: finalAgreedEquity,
      chosenRole: deal.investorRole,
      excludeId: String(deal._id),
    });
    const authority = resolveInvestorAuthority(deal.investorType, finalAgreedEquity, deal.investorRole);

    deal.amountINR = finalAgreedAmount;
    deal.proposedAmountINR = finalAgreedAmount;
    deal.equityPercent = finalAgreedEquity;
    deal.proposedEquityPercent = finalAgreedEquity;
    deal.sharesAllocated = sharesToAllocate;
    deal.investorRole = authority.investorRole;
    deal.votingWeight = authority.votingWeight;
    deal.canVeto = authority.canVeto;
    deal.canAccessFinancials = authority.canAccessFinancials;
    deal.canRequestUpdates = authority.canRequestUpdates;
    const metadata = investorAcceptingStartupCounter
      ? buildDealFinancialMetadata(
          deal.toObject() as DealDocumentLike,
          `${startup.name} counter-offer stock transfer request submitted to ProMove for ${finalAgreedEquity}% equity (${sharesToAllocate} shares).`,
        )
      : buildDealFinancialMetadata(deal.toObject() as DealDocumentLike);
    deal.stockDetails = metadata.stockDetails;
    deal.stockTransfer = metadata.stockTransfer;
    deal.royalty = metadata.royalty;
    deal.negotiation.messages.push({
      _id: new Types.ObjectId(),
      senderId: new Types.ObjectId(userId),
      senderRole,
      message: `Both parties agreed to terms: ${formatNegotiationAmount(
        finalAgreedAmount,
      )} for ${finalAgreedEquity}% equity.${
        investorAcceptingStartupCounter
          ? ' Deal submitted to admin for share-transfer review.'
          : ' Deal is ready for due diligence.'
      }`,
      timestamp: new Date(),
    });
    deal.mediationStatus = investorAcceptingStartupCounter ? metadata.mediationStatus : 'under_review';

    if (investorAcceptingStartupCounter) {
      deal.stage = 3;
      deal.founderDecision = {
        status: 'accepted',
        respondedAt: new Date(),
        respondedBy: new Types.ObjectId(deal.studentId),
        note: 'Startup counter offer accepted by investor.',
      };
      deal.adminApprovalRequired = true;
      deal.adminApprovedAt = undefined;
      deal.adminApprovedBy = undefined;
    }
  }

  deal.negotiation.lastUpdatedAt = new Date();
  await deal.save();
  await invalidateInvestmentCaches(String(deal.startupId), String(deal.investorId));
  return deal.negotiation;
};

// ─── Marketplace Bid Board ──────────────────────────────────────────────────

type LeanBidder = {
  _id: Types.ObjectId;
  displayName: string;
  avatar?: string;
  innovationScore: number;
};

type PopulatedBidDeal = DealDocumentLike & { investorId: LeanBidder | Types.ObjectId | null };
type BidDealWithInvestor = DealDocumentLike & { investorId: LeanBidder };

const hasPopulatedBidInvestor = (deal: PopulatedBidDeal): deal is BidDealWithInvestor =>
  Boolean(
    deal.investorId &&
      typeof deal.investorId === 'object' &&
      '_id' in deal.investorId &&
      'displayName' in deal.investorId,
  );

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

const getBidBoardDisplayTerms = (deal: DealDocumentLike) => {
  const negotiation = deal.negotiation;

  if (
    typeof negotiation?.finalAgreedAmount === 'number' &&
    typeof negotiation.finalAgreedEquity === 'number'
  ) {
    return {
      amountINR: negotiation.finalAgreedAmount,
      equityPercent: negotiation.finalAgreedEquity,
    };
  }

  if (
    negotiation?.status === 'counter_offer' &&
    typeof negotiation.studentCounterAmount === 'number' &&
    typeof negotiation.studentCounterEquity === 'number'
  ) {
    return {
      amountINR: negotiation.studentCounterAmount,
      equityPercent: negotiation.studentCounterEquity,
    };
  }

  if (
    typeof negotiation?.investorProposedAmount === 'number' &&
    typeof negotiation.investorProposedEquity === 'number'
  ) {
    return {
      amountINR: negotiation.investorProposedAmount,
      equityPercent: negotiation.investorProposedEquity,
    };
  }

  return {
    amountINR: deal.amountINR,
    equityPercent: deal.equityPercent,
  };
};

export const getStartupBidBoard = async (
  startupId: string,
  viewerId?: string,
): Promise<StartupBidBoardResponse> => {
  const activeStudentFounderIds = await getActiveStudentFounderIds();
  const startup = await Startup.findOne({
    _id: startupId,
    launchedToInvestors: true,
    reviewStatus: 'approved',
    founderIds: { $in: activeStudentFounderIds },
  })
    .select('_id name tagline fundingNeeded maxPennyInvestors currentPennyCount hasSoleInvestor founderIds')
    .lean<LeanStartupBidInfo | null>();

  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found or not open for bids');
  }

  const [pennyDeals, soleDeals] = await Promise.all([
    Deal.find({ startupId, investorType: 'penny', status: 'active' })
      .select('_id investorId investorType amountINR equityPercent coverLetter createdAt founderDecision investorRole negotiation')
      .populate<{ investorId: LeanBidder }>('investorId', '_id displayName avatar innovationScore')
      .sort({ createdAt: 1 })
      .lean<PopulatedBidDeal[]>(),
    Deal.find({ startupId, investorType: 'sole', status: 'active' })
      .select('_id investorId investorType amountINR equityPercent coverLetter createdAt founderDecision investorRole negotiation')
      .populate<{ investorId: LeanBidder }>('investorId', '_id displayName avatar innovationScore')
      .sort({ amountINR: -1, createdAt: 1 })
      .lean<PopulatedBidDeal[]>(),
  ]);

  const validPennyDeals = pennyDeals.filter(hasPopulatedBidInvestor);
  const validSoleDeals = soleDeals.filter(hasPopulatedBidInvestor);

  const pennyTotal = validPennyDeals.reduce((sum, d) => sum + getBidBoardDisplayTerms(d).amountINR, 0);

  const contributors = validPennyDeals.map((d) => {
    const displayTerms = getBidBoardDisplayTerms(d);

    return {
      bidId: String(d._id),
      investorId: String(d.investorId._id),
      name: d.investorId.displayName ?? 'Investor',
      ...(d.investorId.avatar ? { avatar: d.investorId.avatar } : {}),
      innovationScore: d.investorId.innovationScore ?? 0,
      amountINR: displayTerms.amountINR,
      equityPercent: displayTerms.equityPercent,
      placedAt: d.createdAt.toISOString(),
      isCurrentUser: viewerId ? String(d.investorId._id) === viewerId : false,
    };
  });

  const soleBidsList = validSoleDeals.map((d) => {
    const displayTerms = getBidBoardDisplayTerms(d);

    return {
      bidId: String(d._id),
      investorId: String(d.investorId._id),
      name: d.investorId.displayName ?? 'Investor',
      ...(d.investorId.avatar ? { avatar: d.investorId.avatar } : {}),
      innovationScore: d.investorId.innovationScore ?? 0,
      amountINR: displayTerms.amountINR,
      equityPercent: displayTerms.equityPercent,
      ...(d.coverLetter ? { coverLetter: d.coverLetter } : {}),
      role: d.investorRole,
      founderDecisionStatus: (d.founderDecision?.status as 'pending' | 'accepted' | 'rejected') ?? 'pending',
      isCurrentUser: viewerId ? String(d.investorId._id) === viewerId : false,
      placedAt: d.createdAt.toISOString(),
    };
  });

  const allDeals = [...validPennyDeals, ...validSoleDeals];
  const currentUserDeal = viewerId
    ? allDeals.find((d) => String(d.investorId._id) === viewerId)
    : undefined;

  return {
    startupId,
    startupName: startup.name,
    startupTagline: startup.tagline,
    ...(typeof startup.fundingNeeded === 'number' ? { fundingTarget: startup.fundingNeeded } : {}),
    acceptsPennyInvestors: validPennyDeals.length < startup.maxPennyInvestors,
    acceptsSoleInvestor: !startup.hasSoleInvestor,
    pennyPool: {
      totalRaised: pennyTotal,
      investorCount: validPennyDeals.length,
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

  await ensureBidderAccount(userId);

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

    const { founder, founderIds } = await resolvePrimaryEligibleFounder(startup.founderIds, session);
    const studentId = founder._id;

    const existing = await Deal.findOne({ investorId: userId, startupId, studentId }).session(session);
    if (existing && existing.status !== 'cancelled') {
      const existingBid = await Bid.findOne({ dealId: existing._id }).session(session);
      if (!existingBid) {
        const existingAuthority = resolveInvestorAuthority(
          existing.investorType,
          existing.proposedEquityPercent ?? existing.equityPercent ?? 0,
          existing.investorRole,
        );
        await Bid.create([{
          startupId,
          investorId: userId,
          founderId: studentId,
          status: 'pending',
          bidType: existing.investorType,
          proposedAmount: existing.proposedAmountINR,
          proposedEquity: existing.proposedEquityPercent ?? existing.equityPercent ?? 0,
          coverLetter: existing.coverLetter,
          investorRole: existingAuthority.investorRole,
          dealId: existing._id,
          expiresAt: new Date(Date.now() + BIDDING_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        }], { session });
      }
      return { existingDealId: String(existing._id), founderIds };
    }

    if (parsed.investorType === 'sole' && startup.hasSoleInvestor) {
      throw new ApiError(409, 'SOLE_INVESTOR_EXISTS', 'This startup already has a sole investor');
    }

    const activePennyBidCount =
      parsed.investorType === 'penny'
        ? await getActivePennyBidCount(startupId, existing ? String(existing._id) : undefined, session)
        : 0;

    if (parsed.investorType === 'penny' && activePennyBidCount >= startup.maxPennyInvestors) {
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
    deal.requestOrigin = 'investor';
    deal.mediationStatus = 'intake';
    deal.investorType = parsed.investorType;
    deal.stage = 0;
    deal.negotiation = {
      status: 'terms_proposed',
      investorProposedAmount: parsed.proposedAmountINR,
      investorProposedEquity: parsed.proposedEquityPercent,
      investorAgreed: true,
      investorAgreedAt: new Date(),
      startupAgreed: false,
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

    await Bid.create([{
      startupId,
      investorId: userId,
      founderId: studentId,
      status: 'pending',
      bidType: parsed.investorType,
      proposedAmount: parsed.proposedAmountINR,
      proposedEquity: parsed.proposedEquityPercent,
      coverLetter: parsed.coverLetter,
      investorRole: authority.investorRole,
      dealId: deal._id,
      expiresAt: new Date(Date.now() + BIDDING_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    }], { session });

    return { dealId: String(deal._id), founderIds };
  });

  await invalidateInvestmentCaches(startupId, userId);

  if ('existingDealId' in transactionResult) {
    const existingDeal = await Deal.findById(transactionResult.existingDealId).lean<DealDocumentLike | null>();
    if (!existingDeal) {
      throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
    }
    const context = await fetchDealContext(existingDeal);
    return await buildDetail(existingDeal, context.startup, context.student, context.investor, context.investor.displayName, context.productWorkshop);
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
  await recordStartupLifecycleEvent({
    startupId,
    workspaceId: context.startup.projectId,
    actorId: userId,
    source: 'investor',
    type: 'INVESTOR_BID_PLACED',
    title: 'Investor bid placed',
    description: `${context.investor.displayName} placed a ${parsed.investorType} investor bid.`,
    status: `stage_${createdDeal.stage}`,
    metadata: {
      dealId: String(createdDeal._id),
      investorId: userId,
      investorType: parsed.investorType,
      proposedAmountINR: parsed.proposedAmountINR,
      proposedEquityPercent: parsed.proposedEquityPercent,
    },
  });
  return await buildDetail(createdDeal, context.startup, context.student, context.investor, context.investor.displayName, context.productWorkshop);
};

export const cancelDealByParticipant = async (
  dealId: string,
  userId: string,
  payload: z.infer<typeof cancelDealSchema>,
): Promise<DealDetailView> => {
  const parsed = cancelDealSchema.parse(payload);
  const deal = await Deal.findById(dealId);

  if (!deal || deal.status === 'cancelled') {
    throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found');
  }

  if (deal.status === 'closed' || deal.stage === 4 || deal.adminApprovedAt) {
    throw new ApiError(400, 'DEAL_CANCELLATION_LOCKED', 'This deal can no longer be cancelled');
  }

  const actorRole = resolveNegotiationParticipantRole(deal, userId);
  const actorLabel = getCancellationActorLabel(actorRole);
  const now = new Date();
  const reason = parsed.reason?.trim();
  const requiresAdminCancellation =
    deal.stage > 0 ||
    Boolean(deal.adminApprovalRequired) ||
    deal.mediationStatus === 'under_review' ||
    Boolean(deal.negotiation?.termsAgreedAt) ||
    deal.negotiation?.status === 'terms_agreed';

  if (requiresAdminCancellation) {
    if (deal.cancellationRequest?.status === 'pending') {
      throw new ApiError(
        409,
        'DEAL_CANCELLATION_REQUEST_PENDING',
        'A cancellation request is already pending admin review',
      );
    }

    deal.cancellationRequest = {
      status: 'pending',
      ...(reason ? { reason } : {}),
      requestedBy: new Types.ObjectId(userId),
      requestedByRole: actorRole,
      requestedAt: now,
    };
    deal.mediationStatus = 'under_review';
    deal.negotiation = deal.negotiation || { status: 'initial', messages: [] };
    deal.negotiation.lastUpdatedAt = now;
    deal.negotiation.messages = deal.negotiation.messages || [];
    deal.negotiation.messages.push({
      _id: new Types.ObjectId(),
      senderId: new Types.ObjectId(userId),
      senderRole: actorRole,
      message: reason
        ? `${actorLabel} requested admin cancellation review: ${reason}`
        : `${actorLabel} requested admin cancellation review.`,
      timestamp: now,
    });

    await deal.save();

    const dealObject = deal.toObject() as DealDocumentLike;
    const context = await fetchDealContext(dealObject);

    const admins = await User.find({ role: UserRole.ADMIN, isActive: true }).select('_id').lean();
    await Promise.all(
      admins.map((admin) =>
        notificationQueue.add('deal-cancellation-requested', {
          userId: String(admin._id),
          type: 'system',
          title: 'Deal cancellation requested',
          body: `${actorLabel} requested admin review to cancel the ${context.startup.name} deal.`,
          link: `/dashboard/admin/deals/${dealId}`,
          metadata: {
            dealId,
            startupId: String(deal.startupId),
            requestedBy: userId,
            requestedByRole: actorRole,
          },
        }),
      ),
    );

    return await buildDetail(
      dealObject,
      context.startup,
      context.student,
      context.investor,
      context.investor.displayName,
      context.productWorkshop,
    );
  }

  deal.status = 'cancelled';
  deal.mediationStatus = 'rejected';
  deal.adminApprovalRequired = false;
  deal.adminApprovedAt = undefined;
  deal.adminApprovedBy = undefined;
  deal.closedAt = undefined;
  deal.founderDecision = {
    status: 'rejected',
    respondedAt: now,
    respondedBy: new Types.ObjectId(userId),
    note: reason || `${actorLabel} cancelled the deal.`,
  };
  deal.negotiation = deal.negotiation || { status: 'cancelled', messages: [] };
  deal.negotiation.status = 'cancelled';
  deal.negotiation.notes = reason || `${actorLabel} cancelled the deal.`;
  deal.negotiation.lastUpdatedAt = now;
  deal.negotiation.messages = deal.negotiation.messages || [];
  deal.negotiation.messages.push({
    _id: new Types.ObjectId(),
    senderId: new Types.ObjectId(userId),
    senderRole: actorRole,
    message: reason ? `${actorLabel} cancelled the deal: ${reason}` : `${actorLabel} cancelled the deal.`,
    timestamp: now,
  });

  if (deal.stockTransfer?.status && deal.stockTransfer.status !== 'approved') {
    deal.stockTransfer = {
      ...deal.stockTransfer,
      status: 'rejected',
      reviewedAt: now,
      reviewNotes: reason || `${actorLabel} cancelled the deal.`,
    };
  }

  await deal.save();
  await invalidateInvestmentCaches(String(deal.startupId), String(deal.investorId));

  const dealObject = deal.toObject() as DealDocumentLike;
  const context = await fetchDealContext(dealObject);
  return await buildDetail(
    dealObject,
    context.startup,
    context.student,
    context.investor,
    context.investor.displayName,
    context.productWorkshop,
  );
};
