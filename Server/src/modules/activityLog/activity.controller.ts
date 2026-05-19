import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import { ActivityLog } from './activityLog.model';
import { ActivityLogService } from './activityLog.service';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const assertObjectId = (value: string, label: string) => {
  if (!objectIdRegex.test(value)) {
    throw new ApiError(400, 'INVALID_ID', `${label} is invalid`);
  }
  return value;
};

const sanitizeForPublic = (log: {
  _id: unknown;
  action: string;
  entityType: string;
  entityId: string;
  actorId: unknown;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}) => {
  const actor = log.actorId as
    | { _id?: unknown; displayName?: string; avatar?: string; role?: string }
    | undefined;
  const meta = log.metadata ?? {};

  // For investor-side feed we don't leak counter amounts beyond what a
  // member of that startup room would already see — keep summary fields only.
  return {
    _id: String(log._id),
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    actorName: actor?.displayName ?? 'Someone',
    actorAvatar: actor?.avatar,
    actorRole: actor?.role,
    summary: buildSummary(log.action, meta, actor?.displayName ?? 'Someone'),
    createdAt: log.createdAt.toISOString(),
  };
};

const buildSummary = (
  action: string,
  metadata: Record<string, unknown>,
  actorName: string,
): string => {
  const startupName = (metadata.startupName as string | undefined) ?? 'this startup';
  switch (action) {
    case 'INTEREST_EXPRESSED':
      return `${actorName} expressed interest in ${startupName}.`;
    case 'INTEREST_WITHDRAWN':
      return `${actorName} withdrew interest.`;
    case 'BID_PLACED':
      return `${actorName} placed a ${(metadata.bidType as string) ?? 'new'} bid on ${startupName}.`;
    case 'BID_VIEWED':
      return `Founder reviewed an investor's bid.`;
    case 'BID_COUNTERED':
      return `A counter-offer was submitted in the negotiation.`;
    case 'BID_ACCEPTED':
      return `A bid was accepted on ${startupName}.`;
    case 'BID_REJECTED':
      return `A bid was declined.`;
    case 'BID_EXPIRED':
      return `A bid expired.`;
    case 'DEAL_CREATED':
      return `A new deal was opened on ${startupName}.`;
    default:
      return `${actorName} performed ${action.replaceAll('_', ' ').toLowerCase()}.`;
  }
};

const PUBLIC_ACTIONS = new Set([
  'INTEREST_EXPRESSED',
  'INTEREST_WITHDRAWN',
  'BID_PLACED',
  'BID_ACCEPTED',
  'BID_REJECTED',
  'BID_EXPIRED',
  'DEAL_CREATED',
]);

export const getStartupActivityFeedController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const startupId = assertObjectId(String(req.params.startupId), 'Startup ID');
  const limit = Math.min(
    Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1),
    100,
  );

  const logs = await ActivityLog.find({
    action: { $in: Array.from(PUBLIC_ACTIONS) },
    $or: [
      { entityType: 'Startup', entityId: startupId },
      { 'metadata.startupId': startupId },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('actorId', 'displayName avatar role')
    .lean();

  const items = logs.map((log) =>
    sanitizeForPublic(
      log as unknown as Parameters<typeof sanitizeForPublic>[0],
    ),
  );

  res.json(new ApiResponse({ items }));
};

export const getMyRecentActivityController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  const logs = await ActivityLogService.findByActor(req.user._id, 50);
  res.json(new ApiResponse({ items: logs }));
};
