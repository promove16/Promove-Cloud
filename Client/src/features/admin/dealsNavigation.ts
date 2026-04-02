import { type AdminSectionLink } from './AdminSectionTabs';

export const ADMIN_DEALS_BASE_PATH = '/dashboard/admin/deals';

export const ADMIN_DEALS_SECTION_LINKS: ReadonlyArray<AdminSectionLink> = [
  {
    label: 'Deal Overview',
    shortLabel: 'Overview',
    description: 'See the active mediation load, approval pressure, and latest deal movement before opening a record.',
    path: `${ADMIN_DEALS_BASE_PATH}/overview`,
  },
  {
    label: 'Deal Register',
    shortLabel: 'Register',
    description: 'Work through the full mediation register with one record per investor-startup transfer request.',
    path: `${ADMIN_DEALS_BASE_PATH}/register`,
  },
];
