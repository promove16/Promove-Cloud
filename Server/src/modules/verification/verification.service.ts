import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { User } from '../user/user.model';
import { UserRole } from '../../types/roles.types';
import { Startup } from '../startup/startup.model';
import { Deal } from '../deal/deal.model';
import { Bid } from '../bidding/bidding.model';
import { ActivityLogService } from '../activityLog/activityLog.service';
import type { VerificationStatus, FraudSeverity } from './verification.types';

interface FraudCheckResult {
  flagged: boolean;
  flags: Array<{
    type: string;
    severity: FraudSeverity;
    description: string;
    evidence?: string[];
  }>;
}

const DUPLICATE_STARTUP_THRESHOLD = 10;
const MAX_BOUNCE_ATTEMPTS = 3;
const SUSPICIOUS_INVESTMENT_VELOCITY = 5;

export const verifyInvestor = async (
  adminId: string,
  investorId: string,
  decision: 'verified' | 'rejected',
  notes?: string,
) => {
  const investor = await User.findById(investorId);
  if (!investor || investor.role !== UserRole.INVESTOR) {
    throw new ApiError(404, 'INVESTOR_NOT_FOUND', 'Investor not found');
  }

  const newStatus: VerificationStatus = decision === 'verified' ? 'verified' : 'rejected';
  await User.findByIdAndUpdate(investorId, {
    $set: {
      'institutionProfile.verificationStatus': newStatus,
      'institutionProfile.verifiedAt': new Date(),
      'institutionProfile.verifiedBy': adminId,
      'institutionProfile.verificationNotes': notes,
    },
  });

  await ActivityLogService.log({
    actorId: adminId,
    action: decision === 'verified' ? 'INVESTOR_VERIFIED' : 'INVESTOR_REJECTED',
    entityType: 'User',
    entityId: investorId,
    metadata: { notes },
  });

  return { investorId, status: newStatus };
};

export const verifyStartup = async (
  adminId: string,
  startupId: string,
  decision: 'approved' | 'rejected',
  adminNotes?: string,
) => {
  const startup = await Startup.findById(startupId);
  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  const newStatus = decision === 'approved' ? 'approved' : 'rejected';
  const update: Record<string, unknown> = {
    reviewStatus: newStatus,
    adminReviewedAt: new Date(),
    adminReviewedBy: new Types.ObjectId(adminId),
  };

  if (adminNotes) {
    update.adminNotes = adminNotes;
  }

  await Startup.findByIdAndUpdate(startupId, { $set: update });

  if (decision === 'approved') {
    await Startup.findByIdAndUpdate(startupId, {
      $set: { launchFormLocked: true, launchFormLockedAt: new Date() },
    });
  }

  await ActivityLogService.log({
    actorId: adminId,
    action: decision === 'approved' ? 'STARTUP_VERIFIED' : 'STARTUP_REJECTED',
    entityType: 'Startup',
    entityId: startupId,
    metadata: { notes: adminNotes },
  });

  return { startupId, status: newStatus };
};

export const runFraudCheck = async (startupId: string): Promise<FraudCheckResult> => {
  const flags: FraudCheckResult['flags'] = [];
  const startup = await Startup.findById(startupId)
    .select('name tagline category founderIds businessProfile initializationProfile')
    .lean();

  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  const keywordPatterns = [
    /\b(work\s*from\s*home|make\s*money\s*fast|get\s*rich|instant\s*profit)\b/i,
    /\b(guaranteed\s*returns|no\s*risk|100%\s*success)\b/i,
  ];

  for (const pattern of keywordPatterns) {
    const textToCheck = [
      startup.name,
      startup.tagline,
      startup.businessProfile?.problemStatement,
      startup.businessProfile?.solutionSummary,
      startup.initializationProfile?.vision,
      startup.initializationProfile?.mission,
    ]
      .filter(Boolean)
      .join(' ');

    if (pattern.test(textToCheck)) {
      flags.push({
        type: 'SUSPICIOUS_KEYWORDS',
        severity: 'medium',
        description: 'Startup description contains potentially misleading keywords',
        evidence: [textToCheck.match(pattern)?.[0] ?? ''],
      });
    }
  }

  const similarStartups = await Startup.find({
    _id: { $ne: startupId },
    name: { $regex: startup.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  })
    .select('name')
    .lean();

  if (similarStartups.length >= DUPLICATE_STARTUP_THRESHOLD) {
    flags.push({
      type: 'DUPLICATE_STARTUPS',
      severity: 'high',
      description: `Multiple startups (${similarStartups.length}) with similar names created recently`,
      evidence: similarStartups.slice(0, 5).map((s) => s.name),
    });
  }

  return { flagged: flags.length > 0, flags };
};

export const flagForFraud = async (
  adminId: string,
  startupId: string,
  severity: FraudSeverity,
  description: string,
) => {
  const flag = {
    type: 'MANUAL_FLAG',
    severity,
    description,
    detectedAt: new Date(),
  };

  await Startup.findByIdAndUpdate(startupId, {
    $push: { fraudFlags: flag },
    $set: { reviewStatus: 'rejected' },
  });

  await ActivityLogService.log({
    actorId: adminId,
    action: 'FRAUD_FLAG_RAISED',
    entityType: 'Startup',
    entityId: startupId,
    metadata: { severity, description },
  });

  return { startupId, flag };
};

export const clearFraudFlag = async (
  adminId: string,
  startupId: string,
  flagType: string,
  note?: string,
) => {
  await Startup.findByIdAndUpdate(startupId, {
    $set: {
      'fraudFlags.$[elem].clearedAt': new Date(),
      'fraudFlags.$[elem].clearedBy': adminId,
      'fraudFlags.$[elem].clearanceNote': note,
    },
  }, {
    arrayFilters: [{ 'elem.type': flagType, 'elem.clearedAt': { $exists: false } }],
  });

  await ActivityLogService.log({
    actorId: adminId,
    action: 'FRAUD_FLAG_CLEARED',
    entityType: 'Startup',
    entityId: startupId,
    metadata: { flagType, note },
  });
};

export const getPlatformVerificationStats = async () => {
  const [
    totalStartups,
    pendingStartups,
    approvedStartups,
    rejectedStartups,
    totalInvestors,
    verifiedInvestors,
    pendingVerificationInvestors,
    totalBids,
    totalDeals,
  ] = await Promise.all([
    Startup.countDocuments({ isActive: true }),
    Startup.countDocuments({ reviewStatus: 'review_requested' }),
    Startup.countDocuments({ reviewStatus: 'approved' }),
    Startup.countDocuments({ reviewStatus: 'rejected' }),
    User.countDocuments({ role: UserRole.INVESTOR, isActive: true }),
    User.countDocuments({
      role: UserRole.INVESTOR,
      'institutionProfile.verificationStatus': 'verified',
    }),
    User.countDocuments({
      role: UserRole.INVESTOR,
      'institutionProfile.verificationStatus': { $in: ['pending', 'unverified'] },
    }),
    Bid.countDocuments({}),
    Deal.countDocuments({ status: { $ne: 'cancelled' } }),
  ]);

  return {
    startups: {
      total: totalStartups,
      pending: pendingStartups,
      approved: approvedStartups,
      rejected: rejectedStartups,
      approvalRate: totalStartups > 0 ? Number(((approvedStartups / totalStartups) * 100).toFixed(1)) : 0,
    },
    investors: {
      total: totalInvestors,
      verified: verifiedInvestors,
      pending: pendingVerificationInvestors,
      verificationRate: totalInvestors > 0 ? Number(((verifiedInvestors / totalInvestors) * 100).toFixed(1)) : 0,
    },
    activity: {
      totalBids,
      totalDeals,
    },
  };
};
