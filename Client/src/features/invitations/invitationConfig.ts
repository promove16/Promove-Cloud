import {
  BriefcaseBusiness,
  GraduationCap,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { UserRole } from '../../types/roles.types';

export type InvitationRole =
  | UserRole.STUDENT
  | UserRole.MENTOR
  | UserRole.INVESTOR
  | UserRole.RECRUITER;

type InvitationRoleMeta = {
  label: string;
  shortLabel: string;
  summary: string;
  invitePath: '/signup' | '/request-access';
  accessModel: string;
  icon: LucideIcon;
};

type BuildInvitationUrlInput = {
  origin: string;
  targetRole: InvitationRole;
  inviterRole: UserRole;
  inviterName: string;
  inviteeEmail?: string;
  purpose?: string;
};

export const INVITER_ENABLED_ROLES: InvitationRole[] = [
  UserRole.STUDENT,
  UserRole.MENTOR,
  UserRole.INVESTOR,
  UserRole.RECRUITER,
];

export const INVITABLE_ROLES: InvitationRole[] = [...INVITER_ENABLED_ROLES];

export const INVITATION_ROLE_META: Record<InvitationRole, InvitationRoleMeta> = {
  [UserRole.STUDENT]: {
    label: 'Student',
    shortLabel: 'Student',
    summary: 'Invite builders, founders, or innovation teammates into the student journey.',
    invitePath: '/signup',
    accessModel: 'Direct signup with optional institution token review later.',
    icon: GraduationCap,
  },
  [UserRole.MENTOR]: {
    label: 'Mentor',
    shortLabel: 'Mentor',
    summary: 'Bring in expert guidance for product, domain, or execution support.',
    invitePath: '/request-access',
    accessModel: 'Admin-reviewed access request.',
    icon: Users,
  },
  [UserRole.INVESTOR]: {
    label: 'Investor',
    shortLabel: 'Investor',
    summary: 'Open a path for funding conversations, diligence, and market expansion.',
    invitePath: '/request-access',
    accessModel: 'Admin-reviewed access request.',
    icon: TrendingUp,
  },
  [UserRole.RECRUITER]: {
    label: 'HR / Recruiter',
    shortLabel: 'HR',
    summary: 'Connect hiring, licensing, and talent partnership stakeholders.',
    invitePath: '/request-access',
    accessModel: 'Admin-reviewed access request.',
    icon: BriefcaseBusiness,
  },
};

const PURPOSE_MATRIX: Record<InvitationRole, Record<InvitationRole, string>> = {
  [UserRole.STUDENT]: {
    [UserRole.STUDENT]: 'Bring another student into product execution, co-building, or startup formation.',
    [UserRole.MENTOR]: 'Bring in a mentor to guide product direction, milestones, and market readiness.',
    [UserRole.INVESTOR]: 'Open an investor conversation around traction, launch readiness, and diligence.',
    [UserRole.RECRUITER]: 'Invite an HR or recruiter partner for internships, hiring, or licensing pathways.',
  },
  [UserRole.MENTOR]: {
    [UserRole.STUDENT]: 'Invite students into a guided build, mentorship, or challenge-based learning track.',
    [UserRole.MENTOR]: 'Add another mentor for specialist input, reviews, or co-mentoring support.',
    [UserRole.INVESTOR]: 'Bring in investors when a student or startup is ready for market-facing discussions.',
    [UserRole.RECRUITER]: 'Add HR or recruiter stakeholders for talent outcomes and hiring alignment.',
  },
  [UserRole.INVESTOR]: {
    [UserRole.STUDENT]: 'Invite students whose product progress or startup potential should enter your pipeline.',
    [UserRole.MENTOR]: 'Bring mentors in to de-risk teams, sharpen execution, and improve founder readiness.',
    [UserRole.INVESTOR]: 'Invite co-investors or strategic investors for shared diligence and syndicate flow.',
    [UserRole.RECRUITER]: 'Invite recruiter or HR partners to support commercial hiring and portfolio growth.',
  },
  [UserRole.RECRUITER]: {
    [UserRole.STUDENT]: 'Invite students for internships, talent discovery, and innovation-led hiring programs.',
    [UserRole.MENTOR]: 'Bring mentors into capability-building programs that improve talent quality and readiness.',
    [UserRole.INVESTOR]: 'Invite investors to review high-potential startups, talent clusters, and market signals.',
    [UserRole.RECRUITER]: 'Add another HR or recruiter operator to scale hiring, outreach, or campus pipelines.',
  },
};

export const normalizeInvitationRole = (value?: string | null): InvitationRole | null => {
  switch (value?.trim().toLowerCase()) {
    case UserRole.STUDENT:
      return UserRole.STUDENT;
    case UserRole.MENTOR:
      return UserRole.MENTOR;
    case UserRole.INVESTOR:
      return UserRole.INVESTOR;
    case UserRole.RECRUITER:
    case 'company':
    case 'hr':
      return UserRole.RECRUITER;
    default:
      return null;
  }
};

export const isInvitationEnabledRole = (role?: UserRole | null): role is InvitationRole =>
  Boolean(role && INVITER_ENABLED_ROLES.includes(role as InvitationRole));

export const getInvitationRoleLabel = (role: InvitationRole) =>
  INVITATION_ROLE_META[role].label;

export const getInvitationPurpose = (
  inviterRole: InvitationRole,
  targetRole: InvitationRole,
) => PURPOSE_MATRIX[inviterRole][targetRole];

export const buildInvitationUrl = ({
  origin,
  targetRole,
  inviterRole,
  inviterName,
  inviteeEmail,
  purpose,
}: BuildInvitationUrlInput) => {
  const search = new URLSearchParams({
    inviteRole: targetRole,
    inviterRole,
    inviterName,
  });

  if (inviteeEmail?.trim()) {
    search.set('inviteeEmail', inviteeEmail.trim());
  }

  if (purpose?.trim()) {
    search.set('purpose', purpose.trim());
  }

  return `${origin}${INVITATION_ROLE_META[targetRole].invitePath}?${search.toString()}`;
};
