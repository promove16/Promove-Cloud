import { ActivityLog } from './activityLog.model';
import type { ActivityAction } from './activityLog.types';

export interface LogInput {
  actorId: string;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export class ActivityLogService {
  static async log(input: LogInput) {
    return ActivityLog.create(input);
  }

  static async findByEntity(entityType: string, entityId: string, limit = 50) {
    return ActivityLog.find({ entityType, entityId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('actorId', 'displayName avatar role')
      .lean();
  }

  static async findByActor(actorId: string, limit = 50) {
    return ActivityLog.find({ actorId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  static async findByAction(action: ActivityAction, limit = 50) {
    return ActivityLog.find({ action })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('actorId', 'displayName avatar role')
      .lean();
  }

  static async findByStartup(startupId: string, limit = 100) {
    return ActivityLog.find({
      $or: [
        { entityType: 'Startup', entityId: startupId },
        { entityType: 'Bid', metadata: { startupId } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('actorId', 'displayName avatar role')
      .lean();
  }

  static async getRecentGlobal(limit = 100) {
    return ActivityLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('actorId', 'displayName avatar role')
      .lean();
  }

  static async countByAction(since?: Date): Promise<Record<string, number>> {
    const match = since ? { createdAt: { $gte: since } } : {};
    const results = await ActivityLog.aggregate([
      { $match: match },
      { $group: { _id: '$action', count: { $sum: 1 } } },
    ]);
    return results.reduce(
      (acc, r) => ({ ...acc, [r._id]: r.count }),
      {} as Record<string, number>,
    );
  }
}
