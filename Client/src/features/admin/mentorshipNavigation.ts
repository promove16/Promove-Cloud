import { type AdminSectionLink } from './AdminSectionTabs';

export const ADMIN_MENTORSHIP_BASE_PATH = '/dashboard/admin/mentors/mentorship';

export const ADMIN_MENTORSHIP_SECTION_LINKS: ReadonlyArray<AdminSectionLink> = [
  {
    label: 'Institution Requests',
    shortLabel: 'Requests',
    description: 'Review incoming institution mentorship requests and assign mentors with scheduling details.',
    path: `${ADMIN_MENTORSHIP_BASE_PATH}/requests`,
  },
  {
    label: 'Mentor Directory',
    shortLabel: 'Mentors',
    description: 'Create mentor access and review current mentor capacity before assigning new work.',
    path: `${ADMIN_MENTORSHIP_BASE_PATH}/mentors`,
  },
  {
    label: 'Admin Programs',
    shortLabel: 'Programs',
    description: 'Create mentorship programs on behalf of schools or colleges with a selected mentor.',
    path: `${ADMIN_MENTORSHIP_BASE_PATH}/programs`,
  },
];
