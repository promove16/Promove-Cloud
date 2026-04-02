import { type AdminSectionLink } from './AdminSectionTabs';

export const ADMIN_PROBLEMS_BASE_PATH = '/dashboard/admin/problems';

export const ADMIN_PROBLEMS_SECTION_LINKS: ReadonlyArray<AdminSectionLink> = [
  {
    label: 'Problem Library',
    shortLabel: 'Library',
    description: 'Create, edit, publish, and retire catalog entries without review queue noise competing for attention.',
    path: `${ADMIN_PROBLEMS_BASE_PATH}/library`,
  },
  {
    label: 'Problem Review Queue',
    shortLabel: 'Reviews',
    description: 'Review submitted problem workspaces in a dedicated moderation queue with notes and point awards.',
    path: `${ADMIN_PROBLEMS_BASE_PATH}/reviews`,
  },
];
