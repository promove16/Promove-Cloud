import { Types } from 'mongoose';
import { z } from 'zod';
import { ApiError } from '../../utils/ApiError';
import { User } from '../user/user.model';
import { UserRole } from '../../types/roles.types';
import { Startup } from '../startup/startup.model';
import { recomputeStartupFunding } from '../startup/funding.service';
import { Deal } from '../deal/deal.model';
import {
  getDealForParticipant,
  validateInvestmentTerms,
  resolveInvestorAuthority,
  invalidateInvestmentCaches,
  recordFounderDecision,
} from '../deal/deal.service';
import { IBid, ICounterOfferEntry } from './bidding.types';
import { NotificationService } from '../notification/notification.service';
import { queueNotification } from '../notification/notification.delivery';
import { ActivityLogService } from '../activityLog/activityLog.service';
import { broadcastStartupActivity } from '../activityLog/activity.broadcaster';
import { hasActiveInterest } from '../interest/interest.service';
import { generateAgreementForAcceptedBid } from '../agreement/agreement.service';
import { Bid } from './bidding.model';
import type {
  BidDetailView,
  BidListFilters,
  BidListResponse,
  BidStatus,
} from './bidding.types';

const BID_EXPIRY_HOURS = 72;
const MAX_BIDS_PER_STARTUP_PER_INVESTOR = 1;

export const placeBidSchema = z.object({
  bidType: z.enum(['penny', 'sole']),
  proposedAmount: z.number().min(20000),
  proposedEquity: z.number().min(0.01).max(100),
  coverLetter: z.string().trim().max(2000).optional(),
  investorRole: z.enum(['shareholder', 'director', 'observer']).optional(),
});

export const counterBidSchema = z.object({
  counterAmount: z.number().min(20000),
  counterEquity: z.number().min(0.01).max(100),
  message: z.string().trim().max(2000).optional(),
});

export const respondToBidSchema = z.object({
  decision: z.enum(['accepted', 'rejected']),
  rejectionReason: z.string().trim().max(1000).optional(),
});

const BID_STATUS_TRANSITIONS: Record<BidStatus, BidStatus[]> = {
  pending: ['viewed', 'accepted', 'rejected', 'expired'],
  viewed: ['negotiating', 'accepted', 'rejected', 'expired'],
  negotiating: ['countered', 'accepted', 'rejected', 'expired'],
  countered: ['negotiating', 'accepted', 'rejected', 'expired'],
  accepted: ['closed'],
  rejected: [],
  expired: [],
  closed: [],
};

const assertValidTransition = (current: BidStatus, next: BidStatus) => {
  const allowed = BID_STATUS_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    throw new ApiError(
      400,
      'INVALID_BID_STATUS_TRANSITION',
      `Cannot transition bid from '${current}' to '${next}'`,
    );
  }
};

const serializeCounterHistory = (
  history: ICounterOfferEntry[] | undefined,
  actorNameById: Map<string, { displayName?: string; avatar?: string }>,
) =>
  (history ?? []).map((entry) => {
    const actorId = String(entry.actorId);
    const actor = actorNameById.get(actorId);
    return {
      _id: entry._id ? String(entry._id) : undefined,
      by: entry.by,
      actorId,
      actorName: actor?.displayName,
      actorAvatar: actor?.avatar,
      amount: entry.amount,
      equity: entry.equity,
      message: entry.message,
      at: new Date(entry.at).toISOString(),
    };
  });

const serializeBid = async (
  bid: IBid,
  startupName?: string,
  startupTagline?: string,
  startupCategory?: string,
  investorName?: string,
  investorAvatar?: string,
  investorInnovationScore?: number,
  founderName?: string,
  founderAvatar?: string,
): Promise<BidDetailView> => ({
  _id: String(bid._id),
  startupId: String(bid.startupId),
  startupName: startupName ?? 'Startup',
  startupTagline: startupTagline ?? '',
  startupCategory: startupCategory ?? '',
  investorId: String(bid.investorId),
  investorName: investorName ?? 'Investor',
  investorAvatar,
  investorInnovationScore: investorInnovationScore ?? 0,
  founderId: String(bid.founderId),
  founderName: founderName ?? 'Founder',
  status: bid.status,
  bidType: bid.bidType,
  proposedAmount: bid.proposedAmount,
  proposedEquity: bid.proposedEquity,
  counterAmount: bid.counterAmount,
  counterEquity: bid.counterEquity,
  finalAmount: bid.finalAmount,
  finalEquity: bid.finalEquity,
  coverLetter: bid.coverLetter,
  investorRole: bid.investorRole ?? 'shareholder',
  expiresAt: bid.expiresAt?.toISOString(),
  viewedAt: bid.viewedAt?.toISOString(),
  acceptedAt: bid.acceptedAt?.toISOString(),
  rejectedAt: bid.rejectedAt?.toISOString(),
  rejectionReason: bid.rejectionReason,
  isRead: bid.isRead,
  dealId: bid.dealId ? String(bid.dealId) : undefined,
  counterOfferHistory: serializeCounterHistory(
    bid.counterOfferHistory,
    new Map([
      [String(bid.investorId), { displayName: investorName, avatar: investorAvatar }],
      [String(bid.founderId), { displayName: founderName, avatar: founderAvatar }],
    ]),
  ),
  createdAt: bid.createdAt.toISOString(),
  updatedAt: bid.updatedAt.toISOString(),
});

const loadBidContext = async (bid: IBid) => {
  const [startup, investor, founder] = await Promise.all([
    Startup.findById(bid.startupId).select('name tagline category').lean(),
    User.findById(bid.investorId).select('displayName avatar innovationScore').lean(),
    User.findById(bid.founderId).select('displayName avatar').lean(),
  ]);
  return { startup, investor, founder };
};

export const placeBid = async (
  investorId: string,
  startupId: string,
  payload: z.infer<typeof placeBidSchema>,
): Promise<BidDetailView> => {
  const parsed = placeBidSchema.parse(payload);

  const investor = await User.findById(investorId)
    .select('role isActive')
    .lean();
  if (!investor || investor.role !== UserRole.INVESTOR) {
    throw new ApiError(403, 'FORBIDDEN', 'Only investors can place bids');
  }

  const startup = await Startup.findOne({
    _id: startupId,
    launchedToInvestors: true,
    reviewStatus: 'approved',
  })
    .select('_id name tagline category founderIds hasSoleInvestor maxPennyInvestors currentPennyCount totalShares availableShares reservedForSole')
    .lean();

  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found or not open for investment');
  }

  if (startup.founderIds.some((id) => String(id) === investorId)) {
    throw new ApiError(400, 'SELF_BID', 'Founders cannot bid on their own startup');
  }

  const interested = await hasActiveInterest(investorId, startupId);
  if (!interested) {
    throw new ApiError(
      403,
      'INTEREST_REQUIRED',
      'You must express interest in this startup before placing a bid',
    );
  }

  const existingActiveBid = await Bid.findOne({
    startupId,
    investorId,
    status: { $in: ['pending', 'viewed', 'negotiating', 'countered'] },
  });

  if (existingActiveBid) {
    throw new ApiError(409, 'ACTIVE_BID_EXISTS', 'You already have an active bid on this startup. Counter-negotiate instead.');
  }

  if (parsed.bidType === 'sole' && startup.hasSoleInvestor) {
    throw new ApiError(409, 'SOLE_INVESTOR_EXISTS', 'This startup already has a sole investor');
  }

  const founderId = startup.founderIds[0];
  if (!founderId) {
    throw new ApiError(400, 'NO_FOUNDER', 'Startup has no founder assigned');
  }

  const expiresAt = new Date(Date.now() + BID_EXPIRY_HOURS * 60 * 60 * 1000);

  const bid = await Bid.create({
    startupId,
    investorId,
    founderId,
    status: 'pending',
    bidType: parsed.bidType,
    proposedAmount: parsed.proposedAmount,
    proposedEquity: parsed.proposedEquity,
    coverLetter: parsed.coverLetter,
    investorRole: parsed.investorRole ?? (parsed.bidType === 'sole' ? 'director' : 'shareholder'),
    expiresAt,
  });

  await ActivityLogService.log({
    actorId: investorId,
    action: 'BID_PLACED',
    entityType: 'Bid',
    entityId: String(bid._id),
    metadata: {
      startupId,
      startupName: startup.name,
      bidType: parsed.bidType,
      proposedAmount: parsed.proposedAmount,
      proposedEquity: parsed.proposedEquity,
    },
  });

  await queueNotification({
    userId: String(founderId),
    type: 'deal_interest',
    title: `New ${parsed.bidType} investment bid`,
    body: `An investor placed a ${parsed.bidType} bid of ₹${parsed.proposedAmount.toLocaleString('en-IN')} on ${startup.name}.`,
    link: `/startup-launch/${startupId}/bids`,
    metadata: {
      bidId: String(bid._id),
      startupId,
      investorId,
    },
  });

  void recomputeStartupFunding(startupId);

  const context = await loadBidContext(bid);
  broadcastStartupActivity({
    startupId,
    action: 'BID_PLACED',
    actorName: context.investor?.displayName,
    actorAvatar: context.investor?.avatar,
    summary: `New ${parsed.bidType} bid placed on ${startup.name}.`,
  });

  return serializeBid(
    bid,
    context.startup?.name,
    context.startup?.tagline,
    context.startup?.category,
    context.investor?.displayName,
    context.investor?.avatar,
    context.investor?.innovationScore,
    context.founder?.displayName,
  );
};

export const markBidAsViewed = async (founderId: string, bidId: string): Promise<BidDetailView> => {
  const bid = await Bid.findById(bidId);
  if (!bid) {
    throw new ApiError(404, 'BID_NOT_FOUND', 'Bid not found');
  }

  if (String(bid.founderId) !== founderId) {
    throw new ApiError(403, 'FORBIDDEN', 'Only the startup founder can view this bid');
  }

  assertValidTransition(bid.status, 'viewed');

  bid.status = 'viewed';
  bid.viewedAt = new Date();
  bid.isRead = true;
  await bid.save();

  await ActivityLogService.log({
    actorId: founderId,
    action: 'BID_VIEWED',
    entityType: 'Bid',
    entityId: bidId,
    metadata: { startupId: String(bid.startupId) },
  });

  const context = await loadBidContext(bid);
  return serializeBid(
    bid,
    context.startup?.name,
    context.startup?.tagline,
    context.startup?.category,
    context.investor?.displayName,
    context.investor?.avatar,
    context.investor?.innovationScore,
    context.founder?.displayName,
  );
};

export const counterBid = async (
  userId: string,
  bidId: string,
  payload: z.infer<typeof counterBidSchema>,
): Promise<BidDetailView> => {
  const parsed = counterBidSchema.parse(payload);
  const bid = await Bid.findById(bidId);
  if (!bid) {
    throw new ApiError(404, 'BID_NOT_FOUND', 'Bid not found');
  }

  const isFounder = String(bid.founderId) === userId;
  const isInvestor = String(bid.investorId) === userId;
  if (!isFounder && !isInvestor) {
    throw new ApiError(403, 'FORBIDDEN', 'You are not a participant in this bid');
  }

  if (bid.status !== 'viewed' && bid.status !== 'negotiating' && bid.status !== 'countered') {
    throw new ApiError(400, 'INVALID_BID_STATE', 'This bid is not open for negotiation');
  }

  assertValidTransition(bid.status, isFounder ? 'negotiating' : 'countered');

  const newStatus: BidStatus = isFounder ? 'negotiating' : 'countered';

  const startup = await Startup.findById(bid.startupId)
    .select('totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor')
    .lean();

  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  bid.status = newStatus;

  // Seed history with the original proposal so the timeline reads linearly.
  if (!bid.counterOfferHistory || bid.counterOfferHistory.length === 0) {
    bid.counterOfferHistory = [
      {
        by: 'investor',
        actorId: bid.investorId,
        amount: bid.proposedAmount,
        equity: bid.proposedEquity,
        message: bid.coverLetter,
        at: bid.createdAt,
      } as ICounterOfferEntry,
    ];
  }

  bid.counterOfferHistory.push({
    by: isFounder ? 'founder' : 'investor',
    actorId: new Types.ObjectId(userId),
    amount: parsed.counterAmount,
    equity: parsed.counterEquity,
    message: parsed.message,
    at: new Date(),
  } as ICounterOfferEntry);

  // Keep latest counter snapshot at the top-level fields for quick reads.
  bid.counterAmount = parsed.counterAmount;
  bid.counterEquity = parsed.counterEquity;

  await bid.save();

  const notifyUserId = isFounder ? String(bid.investorId) : String(bid.founderId);
  await queueNotification({
    userId: notifyUserId,
    type: 'deal_interest',
    title: 'Counter-offer received',
    body: isFounder
      ? `The founder countered with ₹${parsed.counterAmount.toLocaleString('en-IN')} for ${parsed.counterEquity}% equity.`
      : `The investor countered with ₹${parsed.counterAmount.toLocaleString('en-IN')} for ${parsed.counterEquity}% equity.`,
    link: isFounder ? '/dashboard/investor/pipeline' : `/startup-launch/${bid.startupId}/bids`,
    metadata: {
      bidId,
      startupId: String(bid.startupId),
    },
  });

  await ActivityLogService.log({
    actorId: userId,
    action: 'BID_COUNTERED',
    entityType: 'Bid',
    entityId: bidId,
    metadata: {
      counterAmount: parsed.counterAmount,
      counterEquity: parsed.counterEquity,
      counteredBy: isFounder ? 'founder' : 'investor',
    },
  });

  const context = await loadBidContext(bid);
  return serializeBid(
    bid,
    context.startup?.name,
    context.startup?.tagline,
    context.startup?.category,
    context.investor?.displayName,
    context.investor?.avatar,
    context.investor?.innovationScore,
    context.founder?.displayName,
  );
};

export const respondToBid = async (
  founderId: string,
  bidId: string,
  payload: z.infer<typeof respondToBidSchema>,
): Promise<BidDetailView> => {
  const parsed = respondToBidSchema.parse(payload);
  const bid = await Bid.findById(bidId);
  if (!bid) {
    throw new ApiError(404, 'BID_NOT_FOUND', 'Bid not found');
  }

  if (String(bid.founderId) !== founderId) {
    throw new ApiError(403, 'FORBIDDEN', 'Only the founder can respond to bids');
  }

  if (bid.status === 'accepted' || bid.status === 'rejected' || bid.status === 'closed') {
    throw new ApiError(400, 'BID_ALREADY_RESOLVED', 'This bid has already been resolved');
  }

  if (parsed.decision === 'rejected') {
    assertValidTransition(bid.status, 'rejected');
    bid.status = 'rejected';
    bid.rejectedAt = new Date();
    bid.rejectionReason = parsed.rejectionReason;

    await bid.save();

    await queueNotification({
      userId: String(bid.investorId),
      type: 'deal_interest',
      title: 'Bid was not accepted',
      body: parsed.rejectionReason
        ? `The founder declined your bid: ${parsed.rejectionReason}`
        : 'The founder declined your investment bid.',
      link: '/dashboard/investor/pipeline',
      metadata: {
        bidId,
        startupId: String(bid.startupId),
      },
    });

    await ActivityLogService.log({
      actorId: founderId,
      action: 'BID_REJECTED',
      entityType: 'Bid',
      entityId: bidId,
      metadata: {
        startupId: String(bid.startupId),
        rejectionReason: parsed.rejectionReason,
      },
    });
  } else {
    assertValidTransition(bid.status, 'accepted');
    bid.status = 'accepted';
    bid.acceptedAt = new Date();

    const finalAmount = bid.counterAmount ?? bid.proposedAmount;
    const finalEquity = bid.counterEquity ?? bid.proposedEquity;
    bid.finalAmount = finalAmount;
    bid.finalEquity = finalEquity;

    await bid.save();

    await queueNotification({
      userId: String(bid.investorId),
      type: 'deal_interest',
      title: 'Your bid was accepted!',
      body: `The founder accepted your ${bid.bidType} investment of ₹${finalAmount.toLocaleString('en-IN')} for ${finalEquity}% equity.`,
      link: '/dashboard/investor/pipeline',
      metadata: {
        bidId,
        startupId: String(bid.startupId),
        finalAmount,
        finalEquity,
      },
    });

    if (bid.bidType === 'sole') {
      await closeOtherSoleBids(bid);
      await markStartupExclusive(bid);
    }

    await ActivityLogService.log({
      actorId: founderId,
      action: 'BID_ACCEPTED',
      entityType: 'Bid',
      entityId: bidId,
      metadata: {
        startupId: String(bid.startupId),
        bidType: bid.bidType,
        finalAmount,
        finalEquity,
      },
    });

    void recomputeStartupFunding(String(bid.startupId));
    void generateAgreementForAcceptedBid(String(bid._id));

    broadcastStartupActivity({
      startupId: String(bid.startupId),
      action: 'BID_ACCEPTED',
      summary: `A bid was accepted on this startup.`,
    });
  }

  const context = await loadBidContext(bid);
  return serializeBid(
    bid,
    context.startup?.name,
    context.startup?.tagline,
    context.startup?.category,
    context.investor?.displayName,
    context.investor?.avatar,
    context.investor?.innovationScore,
    context.founder?.displayName,
  );
};

export const closeOtherSoleBids = async (acceptedBid: IBid) => {
  const otherSoleBids = await Bid.find({
    startupId: acceptedBid.startupId,
    bidType: 'sole',
    _id: { $ne: acceptedBid._id },
    status: { $in: ['pending', 'viewed', 'negotiating', 'countered'] },
  });

  if (otherSoleBids.length > 0) {
    await Bid.updateMany(
      { _id: { $in: otherSoleBids.map((b) => b._id) } },
      {
        $set: {
          status: 'closed',
          closedAt: new Date(),
          rejectionReason: 'Another investor was selected as the exclusive investor.',
        },
      },
    );

    for (const bid of otherSoleBids) {
      await queueNotification({
        userId: String(bid.investorId),
        type: 'deal_interest',
        title: 'Startup secured exclusive investment',
        body: 'The startup has accepted another investor as their exclusive investor. Your sole bid has been closed.',
        link: `/marketplace`,
        metadata: {
          bidId: String(bid._id),
          startupId: String(acceptedBid.startupId),
        },
      });
    }
  }
};

export const markStartupExclusive = async (bid: IBid) => {
  await Startup.findByIdAndUpdate(bid.startupId, {
    hasSoleInvestor: true,
    soleInvestorId: bid.investorId,
  });
};

export const expireBid = async (bidId: string): Promise<void> => {
  const bid = await Bid.findById(bidId);
  if (!bid || bid.status === 'accepted' || bid.status === 'rejected' || bid.status === 'closed' || bid.status === 'expired') {
    return;
  }

  assertValidTransition(bid.status, 'expired');
  bid.status = 'expired';
  bid.expiredAt = new Date();
  await bid.save();

  await queueNotification({
    userId: String(bid.investorId),
    type: 'deal_interest',
    title: 'Your bid has expired',
    body: 'Your investment bid expired because the founder did not respond within the timeframe.',
    link: `/marketplace`,
    metadata: {
      bidId,
      startupId: String(bid.startupId),
    },
  });

  await ActivityLogService.log({
    actorId: String(bid.founderId),
    action: 'BID_EXPIRED',
    entityType: 'Bid',
    entityId: bidId,
    metadata: {
      startupId: String(bid.startupId),
    },
  });
};

export const getBidsForFounder = async (
  founderId: string,
  filters: BidListFilters = {},
): Promise<BidListResponse> => {
  const page = Math.max(filters.page ?? 1, 1);
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 50);
  const query: Record<string, unknown> = { founderId };

  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.bidType) {
    query.bidType = filters.bidType;
  }

  let sort: Record<string, 1 | -1> = { createdAt: -1 };
  if (filters.sortBy === 'oldest') sort = { createdAt: 1 };
  else if (filters.sortBy === 'amount_high') sort = { proposedAmount: -1 };
  else if (filters.sortBy === 'amount_low') sort = { proposedAmount: 1 };

  const [total, bids] = await Promise.all([
    Bid.countDocuments(query),
    Bid.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  const startupIds = [...new Set(bids.map((b) => String(b.startupId)))];
  const investorIds = [...new Set(bids.map((b) => String(b.investorId)))];

  const [startups, investors] = await Promise.all([
    Startup.find({ _id: { $in: startupIds } })
      .select('name tagline category')
      .lean(),
    User.find({ _id: { $in: investorIds } })
      .select('displayName avatar innovationScore')
      .lean(),
  ]);

  const startupMap = new Map(startups.map((s) => [String(s._id), s]));
  const investorMap = new Map(investors.map((u) => [String(u._id), u]));
  const founder = await User.findById(founderId).select('displayName').lean();

  const items = await Promise.all(
    bids.map((bid) => {
      const startup = startupMap.get(String(bid.startupId));
      const investor = investorMap.get(String(bid.investorId));
      return serializeBid(
        bid,
        startup?.name,
        startup?.tagline,
        startup?.category,
        investor?.displayName,
        investor?.avatar,
        investor?.innovationScore,
        founder?.displayName,
      );
    }),
  );

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

export const getBidsForInvestor = async (
  investorId: string,
  filters: BidListFilters = {},
): Promise<BidListResponse> => {
  const page = Math.max(filters.page ?? 1, 1);
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 50);
  const query: Record<string, unknown> = { investorId };

  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.bidType) {
    query.bidType = filters.bidType;
  }

  let sort: Record<string, 1 | -1> = { createdAt: -1 };
  if (filters.sortBy === 'oldest') sort = { createdAt: 1 };
  else if (filters.sortBy === 'amount_high') sort = { proposedAmount: -1 };
  else if (filters.sortBy === 'amount_low') sort = { proposedAmount: 1 };

  const [total, bids] = await Promise.all([
    Bid.countDocuments(query),
    Bid.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  const startupIds = [...new Set(bids.map((b) => String(b.startupId)))];

  const [startups, founder] = await Promise.all([
    Startup.find({ _id: { $in: startupIds } })
      .select('name tagline category')
      .lean(),
    User.findById(investorId).select('displayName').lean(),
  ]);

  const startupMap = new Map(startups.map((s) => [String(s._id), s]));

  const items = await Promise.all(
    bids.map(async (bid) => {
      const startup = startupMap.get(String(bid.startupId));
      const founderUser = await User.findById(bid.founderId).select('displayName').lean();
      return serializeBid(
        bid,
        startup?.name,
        startup?.tagline,
        startup?.category,
        founder?.displayName,
        undefined,
        undefined,
        founderUser?.displayName,
      );
    }),
  );

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

export const getBidById = async (
  userId: string,
  bidId: string,
): Promise<BidDetailView> => {
  const bid = await Bid.findById(bidId);
  if (!bid) {
    throw new ApiError(404, 'BID_NOT_FOUND', 'Bid not found');
  }

  const isParticipant =
    String(bid.founderId) === userId || String(bid.investorId) === userId;
  if (!isParticipant) {
    throw new ApiError(403, 'FORBIDDEN', 'You are not a participant in this bid');
  }

  const context = await loadBidContext(bid);
  return serializeBid(
    bid,
    context.startup?.name,
    context.startup?.tagline,
    context.startup?.category,
    context.investor?.displayName,
    context.investor?.avatar,
    context.investor?.innovationScore,
    context.founder?.displayName,
  );
};

export const getBidsForStartup = async (
  startupId: string,
  founderId: string,
): Promise<BidDetailView[]> => {
  const bids = await Bid.find({ startupId, founderId })
    .sort({ createdAt: -1 })
    .lean();

  const investorIds = [...new Set(bids.map((b) => String(b.investorId)))];

  const [startup, investors] = await Promise.all([
    Startup.findById(startupId).select('name tagline category').lean(),
    User.find({ _id: { $in: investorIds } })
      .select('displayName avatar innovationScore')
      .lean(),
  ]);

  const investorMap = new Map(investors.map((u) => [String(u._id), u]));
  const founder = await User.findById(founderId).select('displayName').lean();

  return Promise.all(
    bids.map((bid) => {
      const investor = investorMap.get(String(bid.investorId));
      return serializeBid(
        bid,
        startup?.name,
        startup?.tagline,
        startup?.category,
        investor?.displayName,
        investor?.avatar,
        investor?.innovationScore,
        founder?.displayName,
      );
    }),
  );
};

export const expireStaleBids = async (): Promise<number> => {
  const now = new Date();
  const staleBids = await Bid.find({
    status: { $in: ['pending', 'viewed', 'negotiating', 'countered'] },
    expiresAt: { $lte: now },
  });

  let expiredCount = 0;
  for (const bid of staleBids) {
    await expireBid(String(bid._id));
    expiredCount++;
  }

  return expiredCount;
};
