import { Startup } from '../startup/startup.model';
import { Bid } from '../bidding/bidding.model';
import { Deal } from '../deal/deal.model';
import { User } from '../user/user.model';
import { UserRole } from '../../types/roles.types';
import { ActivityLogService } from '../activityLog/activityLog.service';

export interface FounderAnalytics {
  totalStartups: number;
  totalBids: number;
  pendingBids: number;
  acceptedBids: number;
  rejectedBids: number;
  totalInvestmentAmount: number;
  totalEquityGiven: number;
  investorCount: number;
  soleInvestorCount: number;
  pennyInvestorCount: number;
  bidsOverTime: Array<{ date: string; count: number }>;
  topInvestors: Array<{ investorId: string; name: string; amount: number; equity: number }>;
}

export interface InvestorAnalytics {
  totalBids: number;
  activeBids: number;
  acceptedBids: number;
  rejectedBids: number;
  totalInvested: number;
  totalEquityHeld: number;
  portfolioSize: number;
  avgDealSize: number;
  bidsByStatus: Array<{ status: string; count: number }>;
}

export interface AdminPlatformAnalytics {
  totalUsers: number;
  usersByRole: Array<{ role: string; count: number }>;
  totalStartups: number;
  startupsByStatus: Array<{ status: string; count: number }>;
  totalBids: number;
  bidsByStatus: Array<{ status: string; count: number }>;
  totalDeals: number;
  dealsByStage: Array<{ stage: number; count: number }>;
  totalInvestmentVolume: number;
  activeInvestors: number;
  pendingVerifications: number;
  recentActivity: Array<Record<string, unknown>>;
  fraudFlags: number;
}

export interface StartupAnalytics {
  totalBids: number;
  pendingBids: number;
  negotiatingBids: number;
  acceptedBids: number;
  rejectedBids: number;
  soleBids: number;
  pennyBids: number;
  totalProposedAmount: number;
  highestBid: number;
  averageBidAmount: number;
  investorEngagement: number;
  bidsTimeline: Array<{ date: string; count: number }>;
}

export const getFounderAnalytics = async (founderId: string): Promise<FounderAnalytics> => {
  const startups = await Startup.find({ founderIds: founderId })
    .select('_id name')
    .lean();
  const startupIds = startups.map((s) => String(s._id));

  const bids = await Bid.find({ startupId: { $in: startupIds } }).lean();
  const deals = await Deal.find({ startupId: { $in: startupIds } }).lean();

  const acceptedBids = bids.filter((b) => b.status === 'accepted');
  const acceptedDeals = deals.filter((d) => d.status === 'closed' || d.stage >= 2);

  const totalInvestmentAmount = acceptedBids.reduce(
    (sum, b) => sum + (b.finalAmount ?? b.proposedAmount), 0,
  );
  const totalEquity = acceptedBids.reduce(
    (sum, b) => sum + (b.finalEquity ?? b.proposedEquity), 0,
  );

  const investorIds = [...new Set(acceptedDeals.map((d) => String(d.investorId)))];
  const soleCount = acceptedDeals.filter((d) => d.investorType === 'sole').length;
  const pennyCount = acceptedDeals.filter((d) => d.investorType === 'penny').length;

  const investors = await User.find({ _id: { $in: investorIds } })
    .select('displayName')
    .lean();

  const investorMap = new Map(investors.map((u) => [String(u._id), u.displayName]));

  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }).reverse();

  const bidsOverTime = last30Days.map((date) => ({
    date,
    count: bids.filter(
      (b) => b.createdAt.toISOString().split('T')[0] === date,
    ).length,
  }));

  return {
    totalStartups: startups.length,
    totalBids: bids.length,
    pendingBids: bids.filter((b) => b.status === 'pending' || b.status === 'viewed').length,
    acceptedBids: acceptedBids.length,
    rejectedBids: bids.filter((b) => b.status === 'rejected').length,
    totalInvestmentAmount,
    totalEquityGiven: Number(totalEquity.toFixed(2)),
    investorCount: investorIds.length,
    soleInvestorCount: soleCount,
    pennyInvestorCount: pennyCount,
    bidsOverTime,
    topInvestors: acceptedDeals.map((d) => ({
      investorId: String(d.investorId),
      name: investorMap.get(String(d.investorId)) ?? 'Unknown',
      amount: d.amountINR,
      equity: d.equityPercent,
    })),
  };
};

export const getStartupAnalytics = async (
  founderId: string,
  startupId: string,
): Promise<StartupAnalytics> => {
  const startup = await Startup.findOne({ _id: startupId, founderIds: founderId })
    .select('name')
    .lean();
  if (!startup) {
    return {
      totalBids: 0,
      pendingBids: 0,
      negotiatingBids: 0,
      acceptedBids: 0,
      rejectedBids: 0,
      soleBids: 0,
      pennyBids: 0,
      totalProposedAmount: 0,
      highestBid: 0,
      averageBidAmount: 0,
      investorEngagement: 0,
      bidsTimeline: [],
    };
  }

  const bids = await Bid.find({ startupId }).lean();
  const acceptedBids = bids.filter((b) => b.status === 'accepted');
  const totalAmount = acceptedBids.reduce((s, b) => s + (b.finalAmount ?? b.proposedAmount), 0);

  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }).reverse();

  const bidsTimeline = last30Days.map((date) => ({
    date,
    count: bids.filter((b) => b.createdAt.toISOString().split('T')[0] === date).length,
  }));

  return {
    totalBids: bids.length,
    pendingBids: bids.filter((b) => b.status === 'pending' || b.status === 'viewed').length,
    negotiatingBids: bids.filter((b) => b.status === 'negotiating' || b.status === 'countered').length,
    acceptedBids: acceptedBids.length,
    rejectedBids: bids.filter((b) => b.status === 'rejected').length,
    soleBids: bids.filter((b) => b.bidType === 'sole').length,
    pennyBids: bids.filter((b) => b.bidType === 'penny').length,
    totalProposedAmount: totalAmount,
    highestBid: Math.max(...acceptedBids.map((b) => b.finalAmount ?? b.proposedAmount), 0),
    averageBidAmount: acceptedBids.length > 0 ? Math.round(totalAmount / acceptedBids.length) : 0,
    investorEngagement: bids.length > 0
      ? Number(((bids.filter((b) => b.status !== 'pending').length / bids.length) * 100).toFixed(1))
      : 0,
    bidsTimeline,
  };
};

export const getInvestorAnalytics = async (investorId: string): Promise<InvestorAnalytics> => {
  const bids = await Bid.find({ investorId }).lean();
  const deals = await Deal.find({ investorId, status: { $ne: 'cancelled' } }).lean();
  const portfolioDeals = deals.filter((d) => d.stage === 4 && d.status === 'closed');

  const totalAmount = portfolioDeals.reduce((s, d) => s + d.amountINR, 0);
  const acceptedBids = bids.filter((b) => b.status === 'accepted');
  const totalAcceptedAmount = acceptedBids.reduce((s, b) => s + (b.finalAmount ?? b.proposedAmount), 0);

  const statusCounts = bids.reduce(
    (acc, b) => {
      acc[b.status] = (acc[b.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return {
    totalBids: bids.length,
    activeBids: bids.filter((b) => ['pending', 'viewed', 'negotiating', 'countered'].includes(b.status)).length,
    acceptedBids: acceptedBids.length,
    rejectedBids: bids.filter((b) => b.status === 'rejected').length,
    totalInvested: totalAmount,
    totalEquityHeld: Number(portfolioDeals.reduce((s, d) => s + d.equityPercent, 0).toFixed(2)),
    portfolioSize: portfolioDeals.length,
    avgDealSize: portfolioDeals.length > 0 ? Math.round(totalAmount / portfolioDeals.length) : 0,
    bidsByStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
  };
};

export const getAdminPlatformAnalytics = async (): Promise<AdminPlatformAnalytics> => {
  const [
    usersByRole,
    startupsByStatus,
    bidsByStatus,
    dealsByStage,
    recentActivity,
    totalUsers,
    totalStartups,
    totalBids,
    totalDeals,
    fraudFlagStartups,
    pendingVerifications,
  ] = await Promise.all([
    User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $project: { role: '$_id', count: 1, _id: 0 } },
    ]),
    Startup.aggregate([
      { $group: { _id: '$reviewStatus', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } },
    ]),
    Bid.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } },
    ]),
    Deal.aggregate([
      { $group: { _id: '$stage', count: { $sum: 1 } } },
      { $project: { stage: '$_id', count: 1, _id: 0 } },
    ]),
    ActivityLogService.getRecentGlobal(20),
    User.countDocuments({}),
    Startup.countDocuments({ isActive: true }),
    Bid.countDocuments({}),
    Deal.countDocuments({}),
    Startup.countDocuments({ 'fraudFlags.0': { $exists: true } }),
    Startup.countDocuments({ reviewStatus: 'review_requested' }),
  ]);

  const deals = await Deal.find({}).select('amountINR').lean();
  const totalInvestmentVolume = deals.reduce((s, d) => s + d.amountINR, 0);

  return {
    totalUsers,
    usersByRole: usersByRole.map((u: Record<string, unknown>) => ({
      role: String(u.role),
      count: Number(u.count),
    })),
    totalStartups,
    startupsByStatus: startupsByStatus.map((s: Record<string, unknown>) => ({
      status: String(s.status),
      count: Number(s.count),
    })),
    totalBids,
    bidsByStatus: bidsByStatus.map((b: Record<string, unknown>) => ({
      status: String(b.status),
      count: Number(b.count),
    })),
    totalDeals,
    dealsByStage: dealsByStage.map((d: Record<string, unknown>) => ({
      stage: Number(d.stage),
      count: Number(d.count),
    })),
    totalInvestmentVolume,
    activeInvestors: usersByRole.find((u: Record<string, unknown>) => u.role === UserRole.INVESTOR)?.count ?? 0,
    pendingVerifications,
    recentActivity: recentActivity as Array<Record<string, unknown>>,
    fraudFlags: fraudFlagStartups,
  };
};
