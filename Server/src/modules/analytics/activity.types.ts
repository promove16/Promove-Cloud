import { Types } from 'mongoose';
import { UserRole } from '../../types/roles.types';

export type UserActivityEventType = 'login' | 'api_request' | 'page_view' | 'navigation_click';
export type UserActivitySource = 'server' | 'client';

export interface IUserActivity {
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
  isWrite?: boolean;
  referrerPath?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformUsageSummary {
  trackedEventsLast7Days: number;
  activeUsersLast7Days: number;
  pageViewsLast7Days: number;
  apiRequestsLast7Days: number;
  writeActionsLast7Days: number;
  avgEventsPerActiveUser: number;
}

export interface DailyUsagePoint {
  date: string;
  activeUsers: number;
  pageViews: number;
  apiRequests: number;
  writeActions: number;
}

export interface ActivityRouteMetric {
  path: string;
  label: string;
  feature: string;
  eventType: Exclude<UserActivityEventType, 'login'>;
  count: number;
  uniqueUsers: number;
}

export interface UserActivitySummary {
  userId: string;
  displayName: string;
  email: string;
  role: UserRole;
  totalEvents: number;
  pageViews: number;
  apiRequests: number;
  writeActions: number;
  activeDays: number;
  lastSeenAt?: string;
}

export interface UserActivityFeedItem {
  _id: string;
  userId: string;
  displayName: string;
  email: string;
  role: UserRole;
  eventType: UserActivityEventType;
  source: UserActivitySource;
  path: string;
  label: string;
  feature: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  createdAt: string;
}

export interface UsageInsight {
  title: string;
  description: string;
  tone: 'info' | 'warning' | 'success';
}

export interface UserActivityDetail {
  summary: UserActivitySummary & {
    trackedSince?: string;
  };
  dailyUsage: DailyUsagePoint[];
  topRoutes: ActivityRouteMetric[];
  recentActivity: UserActivityFeedItem[];
}

export interface PlatformUsageAnalytics {
  usageSummary: PlatformUsageSummary;
  dailyUsage: DailyUsagePoint[];
  topRoutes: ActivityRouteMetric[];
  mostActiveUsers: UserActivitySummary[];
  recentUserActivity: UserActivityFeedItem[];
  insights: UsageInsight[];
}
