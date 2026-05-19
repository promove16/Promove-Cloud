import { Types } from 'mongoose';
import { Bid } from '../bidding/bidding.model';
import { Interest } from '../interest/interest.model';
import { Startup } from '../startup/startup.model';
import { User } from '../user/user.model';

export type BadgeId =
  | 'early_supporter'
  | 'top_investor'
  | 'trend_spotter'
  | 'most_funded'
  | 'fast_growing'
  | 'investor_favorite';

export interface Badge {
  id: BadgeId;
  label: string;
  description: string;
  earnedAt?: string;
}

export interface InvestorReputation {
  userId: string;
  totalInterests: number;
  totalActiveBids: number;
  totalAcceptedBids: number;
  totalCommittedAmount: number;
  acceptanceRate: number;
  averageResponseHours: number | null;
  badges: Badge[];
}

export interface FounderReputation {
  userId: string;
  totalStartups: number;
  totalAcceptedBids: number;
  totalFundedAmount: number;
  totalInterestedInvestors: number;
  badges: Badge[];
}

const TOP_INVESTOR_AMOUNT_THRESHOLD = 5_00_000;
const TOP_INVESTOR_DEAL_COUNT = 3;
const EARLY_SUPPORTER_RANK = 3;

export const getInvestorReputation = async (
  investorId: string,
): Promise<InvestorReputation> => {
  const [totalInterests, allBids, earlyInterests] = await Promise.all([
    Interest.countDocuments({ investorId, status: 'active' }),
    Bid.find({ investorId }).select('status finalAmount counterAmount proposedAmount createdAt acceptedAt viewedAt').lean(),
    Interest.find({ investorId, status: 'active' })
      .select('startupId createdAt')
      .lean(),
  ]);

  const activeStatuses = new Set(['pending', 'viewed', 'negotiating', 'countered']);
  const totalActiveBids = allBids.filter((b) => activeStatuses.has(b.status)).length;
  const acceptedBids = allBids.filter((b) => b.status === 'accepted');
  const totalAcceptedBids = acceptedBids.length;
  const totalCommittedAmount = acceptedBids.reduce(
    (sum, b) => sum + (b.finalAmount ?? b.counterAmount ?? b.proposedAmount ?? 0),
    0,
  );
  const resolvedBids = allBids.filter(
    (b) => b.status === 'accepted' || b.status === 'rejected',
  );
  const acceptanceRate =
    resolvedBids.length > 0 ? totalAcceptedBids / resolvedBids.length : 0;

  const responseTimes = allBids
    .filter((b) => b.acceptedAt)
    .map(
      (b) =>
        (new Date(b.acceptedAt as Date).getTime() - new Date(b.createdAt).getTime()) /
        (1000 * 60 * 60),
    );
  const averageResponseHours =
    responseTimes.length > 0
      ? responseTimes.reduce((s, h) => s + h, 0) / responseTimes.length
      : null;

  // Compute early-supporter: any startup where this investor was among first N
  // to express interest.
  let earlySupporterCount = 0;
  for (const interest of earlyInterests) {
    const olderCount = await Interest.countDocuments({
      startupId: interest.startupId,
      status: 'active',
      createdAt: { $lt: interest.createdAt },
    });
    if (olderCount < EARLY_SUPPORTER_RANK) earlySupporterCount++;
  }

  // Trend spotter: at least one accepted bid on a startup that later reached a
  // trendingScore in the top quartile.
  const acceptedStartupIds = acceptedBids.map((b) => b.startupId as Types.ObjectId);
  let trendSpotter = false;
  if (acceptedStartupIds.length > 0) {
    const trending = await Startup.find({
      _id: { $in: acceptedStartupIds },
      trendingScore: { $gte: 50 },
    })
      .select('_id')
      .lean();
    trendSpotter = trending.length > 0;
  }

  const badges: Badge[] = [];
  if (earlySupporterCount >= 1) {
    badges.push({
      id: 'early_supporter',
      label: 'Early Supporter',
      description: `Among the first ${EARLY_SUPPORTER_RANK} to back ${earlySupporterCount} startup(s).`,
    });
  }
  if (
    totalAcceptedBids >= TOP_INVESTOR_DEAL_COUNT ||
    totalCommittedAmount >= TOP_INVESTOR_AMOUNT_THRESHOLD
  ) {
    badges.push({
      id: 'top_investor',
      label: 'Top Investor',
      description: `${totalAcceptedBids} deals closed, ${totalCommittedAmount.toLocaleString('en-IN')} INR committed.`,
    });
  }
  if (trendSpotter) {
    badges.push({
      id: 'trend_spotter',
      label: 'Trend Spotter',
      description: 'Backed a startup that became trending.',
    });
  }

  return {
    userId: investorId,
    totalInterests,
    totalActiveBids,
    totalAcceptedBids,
    totalCommittedAmount,
    acceptanceRate,
    averageResponseHours,
    badges,
  };
};

export const getFounderReputation = async (
  founderId: string,
): Promise<FounderReputation> => {
  const startups = await Startup.find({ founderIds: founderId })
    .select('_id name currentFunding fundingGoal interestedInvestorCount investorCount trendingScore createdAt')
    .lean();
  const startupIds = startups.map((s) => s._id);

  const acceptedBids = await Bid.find({
    startupId: { $in: startupIds },
    status: 'accepted',
  })
    .select('finalAmount counterAmount proposedAmount startupId')
    .lean();

  const totalAcceptedBids = acceptedBids.length;
  const totalFundedAmount = acceptedBids.reduce(
    (sum, b) => sum + (b.finalAmount ?? b.counterAmount ?? b.proposedAmount ?? 0),
    0,
  );
  const totalInterestedInvestors = startups.reduce(
    (sum, s) => sum + (s.interestedInvestorCount ?? 0),
    0,
  );

  const badges: Badge[] = [];

  const mostFunded = startups.find((s) => (s.currentFunding ?? 0) >= 10_00_000);
  if (mostFunded) {
    badges.push({
      id: 'most_funded',
      label: 'Most Funded',
      description: `Raised ${(mostFunded.currentFunding ?? 0).toLocaleString('en-IN')} INR on ${mostFunded.name}.`,
    });
  }

  const fastGrowing = startups.find((s) => (s.trendingScore ?? 0) >= 75);
  if (fastGrowing) {
    badges.push({
      id: 'fast_growing',
      label: 'Fast Growing',
      description: `Trending score ${fastGrowing.trendingScore?.toFixed(0)} on ${fastGrowing.name}.`,
    });
  }

  const favorite = startups.find((s) => (s.interestedInvestorCount ?? 0) >= 10);
  if (favorite) {
    badges.push({
      id: 'investor_favorite',
      label: 'Investor Favorite',
      description: `${favorite.interestedInvestorCount} investors interested in ${favorite.name}.`,
    });
  }

  return {
    userId: founderId,
    totalStartups: startups.length,
    totalAcceptedBids,
    totalFundedAmount,
    totalInterestedInvestors,
    badges,
  };
};

export const getReputationForUser = async (userId: string) => {
  const user = await User.findById(userId).select('role').lean();
  if (!user) return null;
  if (user.role === 'investor') {
    const investor = await getInvestorReputation(userId);
    return { kind: 'investor' as const, ...investor };
  }
  if (user.role === 'student') {
    const founder = await getFounderReputation(userId);
    return { kind: 'founder' as const, ...founder };
  }
  return null;
};
