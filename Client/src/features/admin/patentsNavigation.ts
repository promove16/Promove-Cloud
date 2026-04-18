import { type AdminSectionLink } from './AdminSectionTabs';

export const ADMIN_PATENTS_BASE_PATH = '/dashboard/admin/patents';

export const ADMIN_PATENTS_SECTION_LINKS: ReadonlyArray<AdminSectionLink> = [
  {
    label: 'Patent Review',
    shortLabel: 'Patent Review',
    description:
      'Review direct patent submissions, validate supporting evidence, and approve score awards.',
    path: `${ADMIN_PATENTS_BASE_PATH}/review`,
  },
  {
    label: 'Assisted Filing',
    shortLabel: 'Assisted Filing',
    description:
      'Manage ProMove-assisted patent cases from intake through filing, IPO updates, and examination milestones.',
    path: `${ADMIN_PATENTS_BASE_PATH}/assisted-filing`,
  },
];
