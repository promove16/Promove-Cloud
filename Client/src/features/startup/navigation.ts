import { BarChart3, BriefcaseBusiness, Rocket, Send, type LucideIcon } from 'lucide-react';

export interface StartupLaunchSectionLink {
  label: string;
  shortLabel: string;
  description: string;
  path: string;
  icon: LucideIcon;
}

export const STARTUP_LAUNCH_BASE_PATH = '/startup-launch';

export const STARTUP_LAUNCH_SECTION_LINKS: StartupLaunchSectionLink[] = [
  {
    label: 'Launch',
    shortLabel: 'Launch',
    description: 'Build the startup profile, upload the pitch deck, and launch to investors or mentors.',
    path: `${STARTUP_LAUNCH_BASE_PATH}/overview`,
    icon: Rocket,
  },
  {
    label: 'Investor Outreach',
    shortLabel: 'Outreach',
    description: 'Shortlist investors, send pitch requests, and continue investor conversations.',
    path: `${STARTUP_LAUNCH_BASE_PATH}/investor-outreach`,
    icon: Send,
  },
  {
    label: 'Cap Table',
    shortLabel: 'Cap Table',
    description: 'Track founder retention, sole investor allocation, and penny investor equity.',
    path: `${STARTUP_LAUNCH_BASE_PATH}/cap-table`,
    icon: BarChart3,
  },
  {
    label: 'Investors Deals',
    shortLabel: 'Investors Deals',
    description: 'Monitor live investor deal flow, stages, and closed outcomes in one place.',
    path: `${STARTUP_LAUNCH_BASE_PATH}/investor-deals`,
    icon: BriefcaseBusiness,
  },
];
