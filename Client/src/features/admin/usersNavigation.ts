import { type AdminSectionLink } from './AdminSectionTabs';

export const ADMIN_USERS_BASE_PATH = '/dashboard/admin/users';

export const ADMIN_USERS_SECTION_LINKS: ReadonlyArray<AdminSectionLink> = [
  {
    label: 'Registration Requests',
    shortLabel: 'Requests',
    description: 'Approve or reject non-student sign-up requests without mixing them into the broader user directory.',
    path: `${ADMIN_USERS_BASE_PATH}/requests`,
  },
  {
    label: 'User Directory',
    shortLabel: 'Directory',
    description: 'Search accounts, filter by role or status, and manage access controls from the full operator directory.',
    path: `${ADMIN_USERS_BASE_PATH}/directory`,
  },
];
