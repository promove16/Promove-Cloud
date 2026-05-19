import { Activity, BarChart3, FileText, Globe, Users, type LucideIcon } from 'lucide-react';

export interface AdminAnalyticsSectionLink {
  label: string;
  shortLabel: string;
  description: string;
  path: string;
  icon: LucideIcon;
}

export const ADMIN_ANALYTICS_BASE_PATH = '/dashboard/admin/analytics';

export const ADMIN_ANALYTICS_SECTION_LINKS: AdminAnalyticsSectionLink[] = [
  {
    label: 'Operational Overview',
    shortLabel: 'Overview',
    description: 'Platform-wide score, deal, patent, capital, and role-mix trends in one executive summary.',
    path: `${ADMIN_ANALYTICS_BASE_PATH}/overview`,
    icon: BarChart3,
  },
  {
    label: 'Usage Pulse',
    shortLabel: 'Usage',
    description: 'Tracked activity, route traffic, and day-by-day behavior across the last two weeks.',
    path: `${ADMIN_ANALYTICS_BASE_PATH}/usage`,
    icon: Activity,
  },
  {
    label: 'User Intelligence',
    shortLabel: 'Users',
    description: 'Search users, inspect their timelines, and review the latest behavior for individual accounts.',
    path: `${ADMIN_ANALYTICS_BASE_PATH}/users`,
    icon: Users,
  },
  {
    label: 'Log Console',
    shortLabel: 'Logs',
    description: 'Switch between admin audit logs and application logs without mixing both feeds on one screen.',
    path: `${ADMIN_ANALYTICS_BASE_PATH}/logs`,
    icon: FileText,
  },
  {
    label: 'Platform Analytics',
    shortLabel: 'Platform',
    description: 'Bidding, startup, investor, and fraud metrics across the entire platform.',
    path: `${ADMIN_ANALYTICS_BASE_PATH}/platform`,
    icon: Globe,
  },
];
