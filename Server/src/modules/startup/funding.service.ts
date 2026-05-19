import { io } from '../../config/socket';
import { emitFundingUpdated } from '../../sockets/bidSocket';
import { Bid } from '../bidding/bidding.model';
import { Interest } from '../interest/interest.model';
import { Startup } from './startup.model';

export interface FundingSnapshot {
  startupId: string;
  fundingGoal?: number;
  currentFunding: number;
  availableEquity: number;
  investorCount: number;
  interestedInvestorCount: number;
  fundingStatus: 'open' | 'partial' | 'fully_funded' | 'closed';
  trendingScore: number;
  lastFundingUpdate?: string;
  percentFunded?: number;
  remaining?: number;
}

const computeTrendingScore = (params: {
  interestedCount: number;
  activeBidCount: number;
  acceptedBidCount: number;
  recentActivityCount: number;
}) => {
  // Lightweight heuristic: interested investors are mild signal, active bids are
  // strong signal, accepted bids are strongest, recent activity adds momentum.
  const { interestedCount, activeBidCount, acceptedBidCount, recentActivityCount } = params;
  return (
    interestedCount * 1 +
    activeBidCount * 5 +
    acceptedBidCount * 15 +
    recentActivityCount * 0.5
  );
};

const resolveFundingStatus = (
  currentFunding: number,
  fundingGoal?: number,
  closed?: boolean,
): 'open' | 'partial' | 'fully_funded' | 'closed' => {
  if (closed) return 'closed';
  if (!fundingGoal || fundingGoal <= 0) {
    return currentFunding > 0 ? 'partial' : 'open';
  }
  if (currentFunding >= fundingGoal) return 'fully_funded';
  if (currentFunding > 0) return 'partial';
  return 'open';
};

export const recomputeStartupFunding = async (
  startupId: string,
): Promise<FundingSnapshot | null> => {
  const startup = await Startup.findById(startupId).select(
    'fundingGoal hasSoleInvestor soleInvestorId totalShares availableShares',
  );
  if (!startup) return null;

  const [acceptedBids, activeBidCount, interestedCount] = await Promise.all([
    Bid.find({ startupId, status: 'accepted' })
      .select('finalAmount finalEquity proposedAmount proposedEquity counterAmount counterEquity investorId')
      .lean(),
    Bid.countDocuments({
      startupId,
      status: { $in: ['pending', 'viewed', 'negotiating', 'countered'] },
    }),
    Interest.countDocuments({ startupId, status: 'active' }),
  ]);

  const currentFunding = acceptedBids.reduce(
    (sum, b) => sum + (b.finalAmount ?? b.counterAmount ?? b.proposedAmount ?? 0),
    0,
  );
  const equityTaken = acceptedBids.reduce(
    (sum, b) => sum + (b.finalEquity ?? b.counterEquity ?? b.proposedEquity ?? 0),
    0,
  );
  const availableEquity = Math.max(0, Math.min(100, 100 - equityTaken));
  const investorCount = new Set(acceptedBids.map((b) => String(b.investorId))).size;

  const trendingScore = computeTrendingScore({
    interestedCount,
    activeBidCount,
    acceptedBidCount: acceptedBids.length,
    recentActivityCount: 0,
  });

  const closed = startup.hasSoleInvestor === true;
  const fundingStatus = resolveFundingStatus(currentFunding, startup.fundingGoal, closed);
  const now = new Date();

  startup.currentFunding = currentFunding;
  startup.availableEquity = availableEquity;
  startup.investorCount = investorCount;
  startup.interestedInvestorCount = interestedCount;
  startup.trendingScore = trendingScore;
  startup.fundingStatus = fundingStatus;
  startup.lastFundingUpdate = now;
  await startup.save();

  const fundingGoal = startup.fundingGoal;
  const percentFunded =
    fundingGoal && fundingGoal > 0
      ? Math.min(100, (currentFunding / fundingGoal) * 100)
      : undefined;
  const remaining =
    fundingGoal && fundingGoal > 0 ? Math.max(0, fundingGoal - currentFunding) : undefined;

  const snapshot: FundingSnapshot = {
    startupId,
    fundingGoal,
    currentFunding,
    availableEquity,
    investorCount,
    interestedInvestorCount: interestedCount,
    fundingStatus,
    trendingScore,
    lastFundingUpdate: now.toISOString(),
    percentFunded,
    remaining,
  };

  emitFundingUpdated(io, startupId, snapshot as unknown as Record<string, unknown>);

  return snapshot;
};

export const getFundingSnapshot = async (
  startupId: string,
): Promise<FundingSnapshot | null> => {
  const startup = await Startup.findById(startupId)
    .select(
      'fundingGoal currentFunding availableEquity investorCount interestedInvestorCount fundingStatus trendingScore lastFundingUpdate',
    )
    .lean();
  if (!startup) return null;

  // Lazy recompute when no aggregates exist yet (old documents).
  if (
    startup.currentFunding === undefined ||
    startup.availableEquity === undefined ||
    startup.investorCount === undefined
  ) {
    return recomputeStartupFunding(startupId);
  }

  const fundingGoal = startup.fundingGoal;
  const currentFunding = startup.currentFunding ?? 0;
  const percentFunded =
    fundingGoal && fundingGoal > 0
      ? Math.min(100, (currentFunding / fundingGoal) * 100)
      : undefined;
  const remaining =
    fundingGoal && fundingGoal > 0 ? Math.max(0, fundingGoal - currentFunding) : undefined;

  return {
    startupId,
    fundingGoal,
    currentFunding,
    availableEquity: startup.availableEquity ?? 100,
    investorCount: startup.investorCount ?? 0,
    interestedInvestorCount: startup.interestedInvestorCount ?? 0,
    fundingStatus: startup.fundingStatus ?? 'open',
    trendingScore: startup.trendingScore ?? 0,
    lastFundingUpdate: startup.lastFundingUpdate
      ? new Date(startup.lastFundingUpdate).toISOString()
      : undefined,
    percentFunded,
    remaining,
  };
};
