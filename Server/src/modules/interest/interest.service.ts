import { z } from 'zod';
import { notificationQueue } from '../../config/bullmq';
import { io } from '../../config/socket';
import { emitInterestExpressed, emitInterestWithdrawn } from '../../sockets/bidSocket';
import { ApiError } from '../../utils/ApiError';
import { ActivityLogService } from '../activityLog/activityLog.service';
import { broadcastStartupActivity } from '../activityLog/activity.broadcaster';
import { Startup } from '../startup/startup.model';
import { recomputeStartupFunding } from '../startup/funding.service';
import { User } from '../user/user.model';
import { UserRole } from '../../types/roles.types';
import { Interest } from './interest.model';
import type { IInterest, InterestView, StartupInterestSummary } from './interest.types';

export const expressInterestSchema = z.object({
  message: z.string().trim().max(1000).optional(),
});

const serializeInterest = (
  interest: IInterest,
  startupName?: string,
  startupTagline?: string,
  startupCategory?: string,
  investorName?: string,
  investorAvatar?: string,
): InterestView => ({
  _id: String(interest._id),
  startupId: String(interest.startupId),
  startupName: startupName ?? 'Startup',
  startupTagline: startupTagline ?? '',
  startupCategory: startupCategory ?? '',
  investorId: String(interest.investorId),
  investorName: investorName ?? 'Investor',
  investorAvatar,
  founderId: String(interest.founderId),
  status: interest.status,
  message: interest.message,
  createdAt: interest.createdAt.toISOString(),
  updatedAt: interest.updatedAt.toISOString(),
  withdrawnAt: interest.withdrawnAt?.toISOString(),
});

export const expressInterest = async (
  investorId: string,
  startupId: string,
  payload: z.infer<typeof expressInterestSchema>,
): Promise<InterestView> => {
  const parsed = expressInterestSchema.parse(payload);

  const investor = await User.findById(investorId).select('role displayName avatar').lean();
  if (!investor || investor.role !== UserRole.INVESTOR) {
    throw new ApiError(403, 'FORBIDDEN', 'Only investors can express interest');
  }

  const startup = await Startup.findOne({
    _id: startupId,
    launchedToInvestors: true,
    reviewStatus: 'approved',
  })
    .select('_id name tagline category founderIds')
    .lean();

  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found or not open for investment');
  }

  if (startup.founderIds.some((id) => String(id) === investorId)) {
    throw new ApiError(400, 'SELF_INTEREST', 'Founders cannot express interest in their own startup');
  }

  const founderId = startup.founderIds[0];
  if (!founderId) {
    throw new ApiError(400, 'NO_FOUNDER', 'Startup has no founder assigned');
  }

  // Resurrect a previously withdrawn record, or create a new one.
  const existing = await Interest.findOne({ startupId, investorId });
  let interest: IInterest;

  if (existing && existing.status === 'active') {
    throw new ApiError(409, 'ALREADY_INTERESTED', 'You have already expressed interest in this startup');
  }

  if (existing) {
    existing.status = 'active';
    existing.message = parsed.message;
    existing.withdrawnAt = undefined;
    await existing.save();
    interest = existing;
  } else {
    interest = await Interest.create({
      startupId,
      investorId,
      founderId,
      status: 'active',
      message: parsed.message,
    });
  }

  const interestedCount = await Interest.countDocuments({ startupId, status: 'active' });

  await ActivityLogService.log({
    actorId: investorId,
    action: 'INTEREST_EXPRESSED',
    entityType: 'Interest',
    entityId: String(interest._id),
    metadata: {
      startupId,
      startupName: startup.name,
      interestedCount,
    },
  });

  await notificationQueue.add('interest-expressed', {
    userId: String(founderId),
    type: 'deal_interest',
    title: 'An investor expressed interest',
    body: `${investor.displayName ?? 'An investor'} is interested in ${startup.name}.`,
    link: `/dashboard/startup/${startupId}`,
    metadata: {
      interestId: String(interest._id),
      startupId,
      investorId,
    },
  });

  emitInterestExpressed(io, startupId, {
    interestId: String(interest._id),
    startupId,
    investorId,
    investorName: investor.displayName ?? 'Investor',
    investorAvatar: investor.avatar,
    interestedCount,
    at: new Date().toISOString(),
  });

  // Update funding aggregates so trendingScore/interestedInvestorCount stay current.
  void recomputeStartupFunding(startupId);

  broadcastStartupActivity({
    startupId,
    action: 'INTEREST_EXPRESSED',
    actorName: investor.displayName,
    actorAvatar: investor.avatar,
    summary: `${investor.displayName ?? 'An investor'} expressed interest in ${startup.name}.`,
  });

  return serializeInterest(
    interest,
    startup.name,
    startup.tagline,
    startup.category,
    investor.displayName,
    investor.avatar,
  );
};

export const withdrawInterest = async (
  investorId: string,
  startupId: string,
): Promise<InterestView> => {
  const interest = await Interest.findOne({ startupId, investorId, status: 'active' });
  if (!interest) {
    throw new ApiError(404, 'INTEREST_NOT_FOUND', 'No active interest to withdraw');
  }

  interest.status = 'withdrawn';
  interest.withdrawnAt = new Date();
  await interest.save();

  const interestedCount = await Interest.countDocuments({ startupId, status: 'active' });

  await ActivityLogService.log({
    actorId: investorId,
    action: 'INTEREST_WITHDRAWN',
    entityType: 'Interest',
    entityId: String(interest._id),
    metadata: { startupId, interestedCount },
  });

  emitInterestWithdrawn(io, startupId, {
    interestId: String(interest._id),
    startupId,
    investorId,
    interestedCount,
    at: new Date().toISOString(),
  });

  void recomputeStartupFunding(startupId);

  const [startup, investor] = await Promise.all([
    Startup.findById(startupId).select('name tagline category').lean(),
    User.findById(investorId).select('displayName avatar').lean(),
  ]);

  return serializeInterest(
    interest,
    startup?.name,
    startup?.tagline,
    startup?.category,
    investor?.displayName,
    investor?.avatar,
  );
};

export const getMyInterests = async (investorId: string): Promise<InterestView[]> => {
  const interests = await Interest.find({ investorId, status: 'active' })
    .sort({ createdAt: -1 })
    .lean();

  if (interests.length === 0) return [];

  const startupIds = [...new Set(interests.map((i) => String(i.startupId)))];
  const [startups, investor] = await Promise.all([
    Startup.find({ _id: { $in: startupIds } }).select('name tagline category').lean(),
    User.findById(investorId).select('displayName avatar').lean(),
  ]);
  const startupMap = new Map(startups.map((s) => [String(s._id), s]));

  return interests.map((i) => {
    const s = startupMap.get(String(i.startupId));
    return serializeInterest(
      i as IInterest,
      s?.name,
      s?.tagline,
      s?.category,
      investor?.displayName,
      investor?.avatar,
    );
  });
};

export const getStartupInterestSummary = async (
  startupId: string,
  viewerId?: string,
): Promise<StartupInterestSummary> => {
  const [interestedCount, viewerInterest] = await Promise.all([
    Interest.countDocuments({ startupId, status: 'active' }),
    viewerId
      ? Interest.findOne({ startupId, investorId: viewerId, status: 'active' }).lean()
      : Promise.resolve(null),
  ]);

  return {
    interestedCount,
    isInterested: !!viewerInterest,
    interestId: viewerInterest ? String(viewerInterest._id) : undefined,
    interestedAt: viewerInterest ? new Date(viewerInterest.createdAt).toISOString() : undefined,
  };
};

export const getInvestorsForStartup = async (
  startupId: string,
  founderId: string,
): Promise<InterestView[]> => {
  const startup = await Startup.findById(startupId).select('founderIds name tagline category').lean();
  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }
  if (!startup.founderIds.some((id) => String(id) === founderId)) {
    throw new ApiError(403, 'FORBIDDEN', 'Only the startup founder can view interested investors');
  }

  const interests = await Interest.find({ startupId, status: 'active' })
    .sort({ createdAt: -1 })
    .lean();

  const investorIds = [...new Set(interests.map((i) => String(i.investorId)))];
  const investors = await User.find({ _id: { $in: investorIds } })
    .select('displayName avatar')
    .lean();
  const investorMap = new Map(investors.map((u) => [String(u._id), u]));

  return interests.map((i) => {
    const u = investorMap.get(String(i.investorId));
    return serializeInterest(
      i as IInterest,
      startup.name,
      startup.tagline,
      startup.category,
      u?.displayName,
      u?.avatar,
    );
  });
};

export const hasActiveInterest = async (
  investorId: string,
  startupId: string,
): Promise<boolean> => {
  const interest = await Interest.findOne({ startupId, investorId, status: 'active' }).lean();
  return !!interest;
};
