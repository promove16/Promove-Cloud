import { type AdminSectionLink } from './AdminSectionTabs';

export const ADMIN_PATENTS_BASE_PATH = '/dashboard/admin/patents';

export const ADMIN_PATENTS_SECTION_LINKS: ReadonlyArray<AdminSectionLink> = [
  {
    label: 'Direct Intake Submissions',
    shortLabel: 'Direct Intakes',
    description:
      'Review direct student patent intake submissions, evaluate supporting documents, and approve 25-point Innovation Score awards.',
    path: `${ADMIN_PATENTS_BASE_PATH}/review`,
  },
  {
    label: 'Assisted Patent Filings',
    shortLabel: 'Assisted Filings',
    description:
      'Full case management lifecycle for ProMove-assisted patents across 12 status stages, IPO filings, deadlines, and official handovers.',
    path: `${ADMIN_PATENTS_BASE_PATH}/assisted-filing`,
  },
];

