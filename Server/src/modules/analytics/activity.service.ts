import { Types } from 'mongoose';
import { z } from 'zod';
import { UserActivity } from './userActivity.model';
import {
  ActivityRouteMetric,
  DailyUsagePoint,
  PlatformUsageAnalytics,
  UsageInsight,
  UserActivityDetail,
  UserActivityEventType,
  UserActivityFeedItem,
  UserActivitySource,
  UserActivitySummary,
} from './activity.types';
import { User } from '../user/user.model';
import { UserRole } from '../../types/roles.types';
import { ApiError } from '../../utils/ApiError';

const DEFAULT_ACTIVITY_DAYS = 14;
const ENGAGEMENT_WINDOW_DAYS = 7;
const USER_DETAIL_SUMMARY_DAYS = 30;
const MAX_RECENT_ACTIVITY_ITEMS = 20;
const MAX_ACTIVITY_SEARCH_RESULTS = 10;
const objectIdSegmentPattern = /^[0-9a-fA-F]{24}$/;
const uuidSegmentPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const numericSegmentPattern = /^\d+$/;
const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const recordClientActivitySchema = z.object({
  eventType: z.enum(['page_view', 'navigation_click']),
  path: z
    .string()
    .trim()
    .min(1)
    .max(240)
    .refine((value) => value.startsWith('/'), { message: 'path must start with /' }),
  label: z.string().trim().min(1).max(180).optional(),
  referrerPath: z
    .string()
    .trim()
    .max(240)
    .refine((value) => value.startsWith('/'), { message: 'referrerPath must start with /' })
    .optional(),
});

const round = (value: number) => Number(value.toFixed(2));

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const toIso = (value: Date) => value.toISOString();

const normalizePath = (value: string) => {
  const basePath = value.split('?')[0].trim() || '/';
  const normalizedSegments = basePath
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      if (objectIdSegmentPattern.test(segment) || uuidSegmentPattern.test(segment) || numericSegmentPattern.test(segment)) {
        return ':id';
      }
      return segment;
    });

  return `/${normalizedSegments.join('/')}` || '/';
};

const deriveFeature = (path: string) => {
  const segments = normalizePath(path).split('/').filter(Boolean);
  if (segments.length === 0) return 'root';
  if (segments[0] === 'api') {
    return segments.slice(1, 3).join('/') || 'api';
  }
  return segments.slice(0, 2).join('/') || segments[0];
};

const toTitleCase = (value: string) =>
  value
    .split(/[-_/]/g)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(' ');

const defaultLabel = (eventType: UserActivityEventType, path: string, method?: string) => {
  const normalizedPath = normalizePath(path);
  if (eventType === 'login') return 'Signed in';
  if (eventType === 'page_view') return `Visited ${normalizedPath}`;
  if (eventType === 'navigation_click') return `Opened ${normalizedPath}`;
  return `${method ?? 'GET'} ${normalizedPath}`;
};

const serializeActivity = (
  activity: {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    eventType: UserActivityEventType;
    source: UserActivitySource;
    path: string;
    label: string;
    feature: string;
    method?: string;
    statusCode?: number;
    durationMs?: number;
    createdAt: Date;
  },
  userMap: Map<string, { displayName: string; email: string; role: UserRole }>,
): UserActivityFeedItem => {
  const user = userMap.get(String(activity.userId));

  return {
    _id: String(activity._id),
    userId: String(activity.userId),
    displayName: user?.displayName ?? 'Unknown user',
    email: user?.email ?? 'unknown@promove.local',
    role: user?.role ?? UserRole.STUDENT,
    eventType: activity.eventType,
    source: activity.source,
    path: activity.path,
    label: activity.label,
    feature: activity.feature,
    ...(activity.method ? { method: activity.method } : {}),
    ...(activity.statusCode !== undefined ? { statusCode: activity.statusCode } : {}),
    ...(activity.durationMs !== undefined ? { durationMs: activity.durationMs } : {}),
    createdAt: toIso(activity.createdAt),
  };
};

const mergeUserSummaries = (
  users: Array<{ _id: Types.ObjectId; displayName: string; email: string; role: UserRole }>,
  aggregateRows: Array<{
    _id: Types.ObjectId;
    totalEvents: number;
    pageViews: number;
    apiRequests: number;
    writeActions: number;
    activeDays: string[];
    lastSeenAt?: Date;
  }>,
) => {
  const aggregateMap = new Map(
    aggregateRows.map((row) => [
      String(row._id),
      {
        totalEvents: row.totalEvents,
        pageViews: row.pageViews,
        apiRequests: row.apiRequests,
        writeActions: row.writeActions,
        activeDays: row.activeDays.length,
        lastSeenAt: row.lastSeenAt,
      },
    ]),
  );

  return users
    .map((user) => {
      const aggregate = aggregateMap.get(String(user._id));
      return {
        userId: String(user._id),
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        totalEvents: aggregate?.totalEvents ?? 0,
        pageViews: aggregate?.pageViews ?? 0,
        apiRequests: aggregate?.apiRequests ?? 0,
        writeActions: aggregate?.writeActions ?? 0,
        activeDays: aggregate?.activeDays ?? 0,
        ...(aggregate?.lastSeenAt ? { lastSeenAt: toIso(aggregate.lastSeenAt) } : {}),
      } satisfies UserActivitySummary;
    })
    .sort((left, right) => {
      if (right.totalEvents !== left.totalEvents) return right.totalEvents - left.totalEvents;
      return left.displayName.localeCompare(right.displayName);
    });
};

const buildDailyUsageSeries = (
  rows: Array<{
    _id: string;
    activeUsers: string[];
    pageViews: number;
    apiRequests: number;
    writeActions: number;
  }>,
  days: number,
) => {
  const rowMap = new Map(rows.map((row) => [row._id, row]));
  const points: DailyUsagePoint[] = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = daysAgo(index);
    const dayKey = date.toISOString().slice(0, 10);
    const row = rowMap.get(dayKey);

    points.push({
      date: dayKey,
      activeUsers: row?.activeUsers.length ?? 0,
      pageViews: row?.pageViews ?? 0,
      apiRequests: row?.apiRequests ?? 0,
      writeActions: row?.writeActions ?? 0,
    });
  }

  return points;
};

const buildUsageInsights = (input: {
  totalUsers: number;
  usageSummary: PlatformUsageAnalytics['usageSummary'];
  topRoutes: ActivityRouteMetric[];
  mostActiveUsers: UserActivitySummary[];
}) => {
  const insights: UsageInsight[] = [];
  const engagedRatio = input.totalUsers > 0 ? (input.usageSummary.activeUsersLast7Days / input.totalUsers) * 100 : 0;

  if (input.totalUsers > 0) {
    insights.push({
      title: 'Weekly engagement',
      description:
        engagedRatio >= 40
          ? `${round(engagedRatio)}% of users generated tracked activity in the last 7 days.`
          : `${round(engagedRatio)}% of users generated tracked activity in the last 7 days. Consider re-engaging inactive accounts.`,
      tone: engagedRatio >= 40 ? 'success' : 'warning',
    });
  }

  const topRoute = input.topRoutes[0];
  if (topRoute) {
    insights.push({
      title: 'Most-used journey',
      description: `${topRoute.label} is the strongest current usage path with ${topRoute.count} tracked events across ${topRoute.uniqueUsers} users.`,
      tone: 'info',
    });
  }

  const mostActiveUser = input.mostActiveUsers[0];
  if (mostActiveUser) {
    insights.push({
      title: 'Power user signal',
      description: `${mostActiveUser.displayName} generated ${mostActiveUser.totalEvents} events with ${mostActiveUser.activeDays} active day(s) in the last 7 days.`,
      tone: 'info',
    });
  }

  return insights.slice(0, 3);
};

const getUsersByIds = async (userIds: string[]) => {
  if (userIds.length === 0) return [];
  return User.find({ _id: { $in: userIds } })
    .select('_id displayName email role')
    .lean();
};

const aggregateUserSummaries = async (userIds: string[], since: Date) => {
  if (userIds.length === 0) {
    return [] as Array<{
      _id: Types.ObjectId;
      totalEvents: number;
      pageViews: number;
      apiRequests: number;
      writeActions: number;
      activeDays: string[];
      lastSeenAt?: Date;
    }>;
  }

  return UserActivity.aggregate<{
    _id: Types.ObjectId;
    totalEvents: number;
    pageViews: number;
    apiRequests: number;
    writeActions: number;
    activeDays: string[];
    lastSeenAt?: Date;
  }>([
    {
      $match: {
        userId: { $in: userIds.map((userId) => new Types.ObjectId(userId)) },
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: '$userId',
        totalEvents: { $sum: 1 },
        pageViews: {
          $sum: {
            $cond: [{ $eq: ['$eventType', 'page_view'] }, 1, 0],
          },
        },
        apiRequests: {
          $sum: {
            $cond: [{ $eq: ['$eventType', 'api_request'] }, 1, 0],
          },
        },
        writeActions: {
          $sum: {
            $cond: [{ $eq: ['$isWrite', true] }, 1, 0],
          },
        },
        activeDays: {
          $addToSet: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
        },
        lastSeenAt: { $max: '$createdAt' },
      },
    },
  ]);
};

const toSafeRegex = (value: string) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

type BaseActivityPayload = {
  userId: string;
  eventType: UserActivityEventType;
  source: UserActivitySource;
  path: string;
  label?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  referrerPath?: string;
};

const createActivity = async (payload: BaseActivityPayload) => {
  const normalizedPath = normalizePath(payload.path);
  const eventType = payload.eventType;
  const label = payload.label?.trim() || defaultLabel(eventType, normalizedPath, payload.method);

  await UserActivity.create({
    userId: new Types.ObjectId(payload.userId),
    eventType,
    source: payload.source,
    path: normalizedPath,
    label,
    feature: deriveFeature(normalizedPath),
    ...(payload.method ? { method: payload.method.toUpperCase() } : {}),
    ...(payload.statusCode !== undefined ? { statusCode: payload.statusCode } : {}),
    ...(payload.durationMs !== undefined ? { durationMs: Math.max(0, Math.round(payload.durationMs)) } : {}),
    ...(payload.referrerPath ? { referrerPath: normalizePath(payload.referrerPath) } : {}),
    isWrite: payload.method ? writeMethods.has(payload.method.toUpperCase()) : eventType === 'navigation_click',
  });
};

export const recordLoginActivity = async (userId: string) =>
  createActivity({
    userId,
    eventType: 'login',
    source: 'server',
    path: '/api/auth/login',
    label: 'Signed in',
    method: 'POST',
    statusCode: 200,
  });

export const recordApiRequestActivity = async (payload: {
  userId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}) =>
  createActivity({
    userId: payload.userId,
    eventType: 'api_request',
    source: 'server',
    path: payload.path,
    method: payload.method,
    statusCode: payload.statusCode,
    durationMs: payload.durationMs,
  });

export const recordClientActivity = async (
  userId: string,
  payload: z.infer<typeof recordClientActivitySchema>,
) =>
  createActivity({
    userId,
    eventType: payload.eventType,
    source: 'client',
    path: payload.path,
    label:
      payload.label?.trim() ||
      (payload.eventType === 'navigation_click'
        ? `Opened ${toTitleCase(payload.path)}`
        : `Visited ${normalizePath(payload.path)}`),
    referrerPath: payload.referrerPath,
  });

export const getPlatformUsageAnalytics = async (totalUsers: number): Promise<PlatformUsageAnalytics> => {
  const activityWindowStart = daysAgo(DEFAULT_ACTIVITY_DAYS);
  const engagementWindowStart = daysAgo(ENGAGEMENT_WINDOW_DAYS);

  const [usageRows, dailyRows, routeRows, activeUserRows, recentActivityRows] = await Promise.all([
    UserActivity.aggregate<{
      _id: null;
      trackedEventsLast7Days: number;
      activeUsers: Types.ObjectId[];
      pageViewsLast7Days: number;
      apiRequestsLast7Days: number;
      writeActionsLast7Days: number;
    }>([
      { $match: { createdAt: { $gte: engagementWindowStart } } },
      {
        $group: {
          _id: null,
          trackedEventsLast7Days: { $sum: 1 },
          activeUsers: { $addToSet: '$userId' },
          pageViewsLast7Days: {
            $sum: {
              $cond: [{ $eq: ['$eventType', 'page_view'] }, 1, 0],
            },
          },
          apiRequestsLast7Days: {
            $sum: {
              $cond: [{ $eq: ['$eventType', 'api_request'] }, 1, 0],
            },
          },
          writeActionsLast7Days: {
            $sum: {
              $cond: [{ $eq: ['$isWrite', true] }, 1, 0],
            },
          },
        },
      },
    ]),
    UserActivity.aggregate<{
      _id: string;
      activeUsers: string[];
      pageViews: number;
      apiRequests: number;
      writeActions: number;
    }>([
      { $match: { createdAt: { $gte: activityWindowStart } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
          activeUsers: { $addToSet: '$userId' },
          pageViews: {
            $sum: {
              $cond: [{ $eq: ['$eventType', 'page_view'] }, 1, 0],
            },
          },
          apiRequests: {
            $sum: {
              $cond: [{ $eq: ['$eventType', 'api_request'] }, 1, 0],
            },
          },
          writeActions: {
            $sum: {
              $cond: [{ $eq: ['$isWrite', true] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    UserActivity.aggregate<ActivityRouteMetric & { users: Types.ObjectId[] }>([
      {
        $match: {
          createdAt: { $gte: engagementWindowStart },
          eventType: { $in: ['api_request', 'page_view', 'navigation_click'] },
        },
      },
      {
        $group: {
          _id: {
            path: '$path',
            label: '$label',
            feature: '$feature',
            eventType: '$eventType',
          },
          count: { $sum: 1 },
          users: { $addToSet: '$userId' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 8 },
      {
        $project: {
          _id: 0,
          path: '$_id.path',
          label: '$_id.label',
          feature: '$_id.feature',
          eventType: '$_id.eventType',
          count: 1,
          uniqueUsers: { $size: '$users' },
        },
      },
    ]),
    UserActivity.aggregate<{
      _id: Types.ObjectId;
      totalEvents: number;
      pageViews: number;
      apiRequests: number;
      writeActions: number;
      activeDays: string[];
      lastSeenAt?: Date;
    }>([
      { $match: { createdAt: { $gte: engagementWindowStart } } },
      {
        $group: {
          _id: '$userId',
          totalEvents: { $sum: 1 },
          pageViews: {
            $sum: {
              $cond: [{ $eq: ['$eventType', 'page_view'] }, 1, 0],
            },
          },
          apiRequests: {
            $sum: {
              $cond: [{ $eq: ['$eventType', 'api_request'] }, 1, 0],
            },
          },
          writeActions: {
            $sum: {
              $cond: [{ $eq: ['$isWrite', true] }, 1, 0],
            },
          },
          activeDays: {
            $addToSet: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
              },
            },
          },
          lastSeenAt: { $max: '$createdAt' },
        },
      },
      { $sort: { totalEvents: -1, lastSeenAt: -1 } },
      { $limit: 8 },
    ]),
    UserActivity.find({ createdAt: { $gte: activityWindowStart } })
      .sort({ createdAt: -1 })
      .limit(MAX_RECENT_ACTIVITY_ITEMS)
      .lean(),
  ]);

  const usageRow = usageRows[0];
  const activeUsersLast7Days = usageRow?.activeUsers.length ?? 0;
  const usageSummary = {
    trackedEventsLast7Days: usageRow?.trackedEventsLast7Days ?? 0,
    activeUsersLast7Days,
    pageViewsLast7Days: usageRow?.pageViewsLast7Days ?? 0,
    apiRequestsLast7Days: usageRow?.apiRequestsLast7Days ?? 0,
    writeActionsLast7Days: usageRow?.writeActionsLast7Days ?? 0,
    avgEventsPerActiveUser:
      activeUsersLast7Days > 0 ? round((usageRow?.trackedEventsLast7Days ?? 0) / activeUsersLast7Days) : 0,
  };

  const recentUserIds = [
    ...new Set([
      ...activeUserRows.map((row) => String(row._id)),
      ...recentActivityRows.map((activity) => String(activity.userId)),
    ]),
  ];
  const recentUsers = await getUsersByIds(recentUserIds);
  const userMap = new Map(recentUsers.map((user) => [String(user._id), user]));

  const mostActiveUsers = mergeUserSummaries(recentUsers, activeUserRows).slice(0, 8);
  const recentUserActivity = recentActivityRows.map((activity) => serializeActivity(activity, userMap));
  const topRoutes = routeRows.map((row) => ({
    path: row.path,
    label: row.label,
    feature: row.feature,
    eventType: row.eventType,
    count: row.count,
    uniqueUsers: row.uniqueUsers,
  }));

  return {
    usageSummary,
    dailyUsage: buildDailyUsageSeries(dailyRows, DEFAULT_ACTIVITY_DAYS),
    topRoutes,
    mostActiveUsers,
    recentUserActivity,
    insights: buildUsageInsights({
      totalUsers,
      usageSummary,
      topRoutes,
      mostActiveUsers,
    }),
  };
};

export const searchUserActivitySummaries = async (
  query?: string,
  limit = MAX_ACTIVITY_SEARCH_RESULTS,
): Promise<UserActivitySummary[]> => {
  const normalizedLimit = Math.min(Math.max(limit, 1), MAX_ACTIVITY_SEARCH_RESULTS);
  const filter = query?.trim()
    ? {
        $or: [{ displayName: toSafeRegex(query.trim()) }, { email: toSafeRegex(query.trim()) }],
      }
    : {};

  const users = await User.find(filter).select('_id displayName email role').sort({ lastLogin: -1, createdAt: -1 }).limit(normalizedLimit).lean();
  const summaries = await aggregateUserSummaries(
    users.map((user) => String(user._id)),
    daysAgo(USER_DETAIL_SUMMARY_DAYS),
  );

  return mergeUserSummaries(users, summaries).slice(0, normalizedLimit);
};

export const getUserActivityDetail = async (userId: string): Promise<UserActivityDetail> => {
  if (!Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  }

  const user = await User.findById(userId).select('_id displayName email role').lean();
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const summaryWindowStart = daysAgo(USER_DETAIL_SUMMARY_DAYS);
  const detailWindowStart = daysAgo(DEFAULT_ACTIVITY_DAYS);

  const [summaryRows, dailyRows, routeRows, recentActivityRows, firstActivity] = await Promise.all([
    aggregateUserSummaries([userId], summaryWindowStart),
    UserActivity.aggregate<{
      _id: string;
      activeUsers: string[];
      pageViews: number;
      apiRequests: number;
      writeActions: number;
    }>([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          createdAt: { $gte: detailWindowStart },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
          activeUsers: { $addToSet: '$userId' },
          pageViews: {
            $sum: {
              $cond: [{ $eq: ['$eventType', 'page_view'] }, 1, 0],
            },
          },
          apiRequests: {
            $sum: {
              $cond: [{ $eq: ['$eventType', 'api_request'] }, 1, 0],
            },
          },
          writeActions: {
            $sum: {
              $cond: [{ $eq: ['$isWrite', true] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    UserActivity.aggregate<ActivityRouteMetric & { users: Types.ObjectId[] }>([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          createdAt: { $gte: detailWindowStart },
          eventType: { $in: ['api_request', 'page_view', 'navigation_click'] },
        },
      },
      {
        $group: {
          _id: {
            path: '$path',
            label: '$label',
            feature: '$feature',
            eventType: '$eventType',
          },
          count: { $sum: 1 },
          users: { $addToSet: '$userId' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 8 },
      {
        $project: {
          _id: 0,
          path: '$_id.path',
          label: '$_id.label',
          feature: '$_id.feature',
          eventType: '$_id.eventType',
          count: 1,
          uniqueUsers: { $size: '$users' },
        },
      },
    ]),
    UserActivity.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(MAX_RECENT_ACTIVITY_ITEMS)
      .lean(),
    UserActivity.findOne({ userId: new Types.ObjectId(userId) }).sort({ createdAt: 1 }).lean(),
  ]);

  const userMap = new Map([[String(user._id), user]]);
  const summary = mergeUserSummaries([user], summaryRows)[0];

  return {
    summary: {
      ...summary,
      ...(firstActivity?.createdAt ? { trackedSince: toIso(firstActivity.createdAt) } : {}),
    },
    dailyUsage: buildDailyUsageSeries(dailyRows, DEFAULT_ACTIVITY_DAYS),
    topRoutes: routeRows.map((row) => ({
      path: row.path,
      label: row.label,
      feature: row.feature,
      eventType: row.eventType,
      count: row.count,
      uniqueUsers: row.uniqueUsers,
    })),
    recentActivity: recentActivityRows.map((activity) => serializeActivity(activity, userMap)),
  };
};
