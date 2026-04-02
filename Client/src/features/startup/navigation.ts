import { BarChart3, BriefcaseBusiness, Rocket, Send, type LucideIcon } from 'lucide-react';

export interface StartupLaunchSectionLink {
  label: string;
  shortLabel: string;
  description: string;
  segment: string;
  icon: LucideIcon;
}

export const STARTUP_LAUNCH_BASE_PATH = '/startup-launch';
export const STARTUP_LAUNCH_LIST_PATH = STARTUP_LAUNCH_BASE_PATH;
export const STARTUP_LAUNCH_DRAFT_ID = 'new';
export const STARTUP_LAUNCH_NEW_PATH = `${STARTUP_LAUNCH_BASE_PATH}/new`;
export const STARTUP_LAUNCH_LEGACY_NEW_OVERVIEW_PATH = `${STARTUP_LAUNCH_BASE_PATH}/new/overview`;

export const STARTUP_LAUNCH_SECTION_LINKS: StartupLaunchSectionLink[] = [
  {
    label: 'Launch',
    shortLabel: 'Launch',
    description: 'Build the startup profile, upload the pitch deck, and launch to investors or mentors.',
    segment: 'overview',
    icon: Rocket,
  },
  {
    label: 'Investor Outreach',
    shortLabel: 'Outreach',
    description: 'Shortlist investors, send pitch requests, and continue investor conversations.',
    segment: 'investor-outreach',
    icon: Send,
  },
  {
    label: 'Cap Table',
    shortLabel: 'Cap Table',
    description: 'Track founder retention, sole investor allocation, and penny investor equity.',
    segment: 'cap-table',
    icon: BarChart3,
  },
  {
    label: 'Investors Deals',
    shortLabel: 'Investors Deals',
    description: 'Monitor live investor deal flow, stages, and closed outcomes in one place.',
    segment: 'investor-deals',
    icon: BriefcaseBusiness,
  },
];

export const getStartupSectionPath = (startupId: string, segment: string) =>
  `${STARTUP_LAUNCH_BASE_PATH}/${startupId}/${segment}`;

export const getStartupOverviewPath = (startupId: string) =>
  getStartupSectionPath(startupId, 'overview');

export const normalizeStartupRouteId = (startupId?: string) =>
  startupId && startupId !== STARTUP_LAUNCH_DRAFT_ID ? startupId : undefined;
