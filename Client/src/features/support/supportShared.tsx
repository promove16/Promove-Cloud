import { ReactNode } from 'react';
import { Badge } from '../../components/ui/Badge';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_DESCRIPTIONS,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
  SupportCategory,
  SupportPriority,
  SupportStatus,
} from '../../types/support.types';
import { UserRole } from '../../types/roles.types';

export const SUPPORT_USER_BASE_PATH = '/dashboard/help-desk';
export const SUPPORT_ADMIN_BASE_PATH = '/dashboard/admin/help-desk';

export const buildUserTicketPath = (ticketId: string) => `${SUPPORT_USER_BASE_PATH}/${ticketId}`;
export const buildAdminTicketPath = (ticketId: string) => `${SUPPORT_ADMIN_BASE_PATH}/${ticketId}`;

// ─── FAQ entries ──────────────────────────────────────────────────────────────

export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
  category: SupportCategory;
  roles: UserRole[]; // which roles see this FAQ
};

export const FAQ_ENTRIES: FaqEntry[] = [
  // ── Shared / access ──────────────────────────────────────────────────────
  {
    id: 'faq-login-reset',
    question: 'I cannot sign in — how do I reset my password?',
    answer:
      'Use the "Forgot password" link on the login page. If you do not receive the email within five minutes, check spam or raise a ticket under Access & Login Issues.',
    category: 'access_login',
    roles: [UserRole.STUDENT, UserRole.SCHOOL, UserRole.COLLEGE, UserRole.MENTOR, UserRole.INVESTOR, UserRole.RECRUITER],
  },
  {
    id: 'faq-account-locked',
    question: 'My account is locked or flagged — what do I do?',
    answer:
      'Account locks are usually triggered by multiple failed logins or a policy flag. Raise a ticket under Access & Login Issues and include any error message you see.',
    category: 'access_login',
    roles: [UserRole.STUDENT, UserRole.SCHOOL, UserRole.COLLEGE, UserRole.MENTOR, UserRole.INVESTOR, UserRole.RECRUITER],
  },

  // ── Student FAQs ─────────────────────────────────────────────────────────
  {
    id: 'faq-student-portfolio',
    question: 'My public portfolio is not showing updated info.',
    answer:
      'Public profile caches refresh every few minutes. If the update still does not appear after 10 minutes, raise a ticket under Account & Profile Issues.',
    category: 'account_profile',
    roles: [UserRole.STUDENT],
  },
  {
    id: 'faq-student-startup-launch',
    question: 'The startup launch checklist is complete but review is still blocked.',
    answer:
      'Reviews are queued every morning. If a review stays stuck for more than 24 hours, raise a ticket under Startup Launch / Patent Support with the startup ID.',
    category: 'startup_patent',
    roles: [UserRole.STUDENT],
  },
  {
    id: 'faq-student-patent',
    question: 'I submitted a patent but it has not moved to review yet.',
    answer:
      'Patent submissions are processed within 48 hours on business days. If it has been longer, raise a ticket under Startup Launch / Patent Support with your patent reference.',
    category: 'startup_patent',
    roles: [UserRole.STUDENT],
  },
  {
    id: 'faq-student-application',
    question: 'My application status has not updated after I submitted.',
    answer:
      'Application status updates depend on the recruiter or institution reviewing it. Give it 48 hours; if it still shows "Pending", raise a ticket under Marketplace / Applications Issues.',
    category: 'marketplace_applications',
    roles: [UserRole.STUDENT],
  },
  {
    id: 'faq-student-workspace',
    question: 'My workspace chat or files are locked after joining.',
    answer:
      'Workspace invites need admin approval. Open the workspace, confirm the invite has been accepted, and if it still reads "pending" raise a ticket under Workspace / Collaboration Issues.',
    category: 'workspace_collaboration',
    roles: [UserRole.STUDENT],
  },

  // ── Recruiter FAQs ────────────────────────────────────────────────────────
  {
    id: 'faq-recruiter-post-job',
    question: 'My job listing is not visible on the marketplace.',
    answer:
      'New listings go through a brief moderation check (usually under 2 hours). If it has been longer, raise a ticket under Marketplace / Applications Issues with the listing ID.',
    category: 'marketplace_applications',
    roles: [UserRole.RECRUITER],
  },
  {
    id: 'faq-recruiter-applications',
    question: 'I cannot see applications for my open position.',
    answer:
      'Applications appear in real time once approved. If the count shows applications but the list is blank, try a hard refresh. If still empty, raise a ticket under Marketplace / Applications Issues.',
    category: 'marketplace_applications',
    roles: [UserRole.RECRUITER],
  },
  {
    id: 'faq-recruiter-candidate-access',
    question: 'I cannot view a candidate\'s full profile or portfolio.',
    answer:
      'Full profile access is granted after the candidate accepts your interest request. If you have an accepted request but still see a locked view, raise a ticket under Account & Profile Issues.',
    category: 'account_profile',
    roles: [UserRole.RECRUITER],
  },
  {
    id: 'faq-recruiter-workspace',
    question: 'How do I set up a workspace for interview coordination?',
    answer:
      'Create a workspace from the Workspace section, invite the candidate and your team. If invite emails are not delivered, raise a ticket under Workspace / Collaboration Issues.',
    category: 'workspace_collaboration',
    roles: [UserRole.RECRUITER],
  },

  // ── Investor FAQs ─────────────────────────────────────────────────────────
  {
    id: 'faq-investor-payment-failed',
    question: 'The payment for a deal is showing as failed.',
    answer:
      'Retry once from the deal page. If it still fails, open a ticket under Deals / Payment / Investment Issues and include the deal ID and payment reference.',
    category: 'deals_payments',
    roles: [UserRole.INVESTOR],
  },
  {
    id: 'faq-investor-deal-room',
    question: 'I cannot access the deal room documents.',
    answer:
      'Deal room access is controlled by the startup founder. If you have a confirmed deal but still see a locked room, raise a ticket under Deals / Payment / Investment Issues with the deal ID.',
    category: 'deals_payments',
    roles: [UserRole.INVESTOR],
  },
  {
    id: 'faq-investor-portfolio-tracking',
    question: 'My investment portfolio is not reflecting a recent deal.',
    answer:
      'Portfolio updates happen within an hour of deal confirmation. If it has been over 2 hours, raise a ticket under Deals / Payment / Investment Issues with the deal reference.',
    category: 'deals_payments',
    roles: [UserRole.INVESTOR],
  },
  {
    id: 'faq-investor-marketplace',
    question: 'I cannot find a startup I was looking at on the marketplace.',
    answer:
      'Startups may be removed if they complete funding or withdraw. If you believe the listing was removed in error, raise a ticket under Marketplace / Applications Issues.',
    category: 'marketplace_applications',
    roles: [UserRole.INVESTOR],
  },

  // ── Mentor FAQs ───────────────────────────────────────────────────────────
  {
    id: 'faq-mentor-workspace',
    question: 'My mentoring workspace is not loading.',
    answer:
      'Workspaces can take a moment to initialize after being created. Wait 5 minutes and refresh. If still unavailable, raise a ticket under Workspace / Collaboration Issues.',
    category: 'workspace_collaboration',
    roles: [UserRole.MENTOR],
  },
  {
    id: 'faq-mentor-student-profiles',
    question: 'I cannot view the profiles of students I am mentoring.',
    answer:
      'Student profile visibility is controlled by their privacy settings. If they have shared their profile with you but you still see a restricted view, raise a ticket under Account & Profile Issues.',
    category: 'account_profile',
    roles: [UserRole.MENTOR],
  },
  {
    id: 'faq-mentor-availability',
    question: 'My availability or mentoring schedule is not updating.',
    answer:
      'Schedule changes can take a few minutes to propagate. If the update is not reflected after 15 minutes, raise a ticket under Account & Profile Issues.',
    category: 'account_profile',
    roles: [UserRole.MENTOR],
  },

  // ── School / College (Institution) FAQs ──────────────────────────────────
  {
    id: 'faq-institution-verification',
    question: 'My institution verification is pending for more than 48 hours.',
    answer:
      'Verifications are reviewed on business days. If it has been over 48 hours since submission, raise a ticket under Institution Operations / Verification with your institution ID.',
    category: 'institution_operations',
    roles: [UserRole.SCHOOL, UserRole.COLLEGE],
  },
  {
    id: 'faq-institution-student-onboard',
    question: 'Students I invited are not appearing in my institution dashboard.',
    answer:
      'Students must accept the institution invite and complete their profile. If accepted students are missing from your dashboard, raise a ticket under Institution Operations / Verification.',
    category: 'institution_operations',
    roles: [UserRole.SCHOOL, UserRole.COLLEGE],
  },
  {
    id: 'faq-institution-workspace',
    question: 'I cannot add members to my institution workspace.',
    answer:
      'Institution workspaces have a member cap based on your plan. If you are below the cap but still cannot add members, raise a ticket under Workspace / Collaboration Issues.',
    category: 'workspace_collaboration',
    roles: [UserRole.SCHOOL, UserRole.COLLEGE],
  },
  {
    id: 'faq-institution-profile',
    question: 'My institution profile or logo is not showing correctly.',
    answer:
      'Profile images are cached for up to 30 minutes. If it has been longer, raise a ticket under Account & Profile Issues.',
    category: 'account_profile',
    roles: [UserRole.SCHOOL, UserRole.COLLEGE],
  },
];

// ─── Role configuration ───────────────────────────────────────────────────────

export type RoleHelpConfig = {
  greeting: string;
  subtitle: string;
  color: string;           // Tailwind text color for accent
  bgColor: string;         // Tailwind bg/border accent
  categories: SupportCategory[];
  quickTopics: { label: string; category: SupportCategory; description: string }[];
};

export const ROLE_HELP_CONFIG: Partial<Record<UserRole, RoleHelpConfig>> = {
  [UserRole.STUDENT]: {
    greeting: 'Student Help Center',
    subtitle: 'Find answers about your portfolio, startup journey, applications, and workspace access.',
    color: 'text-cyan-300',
    bgColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    categories: ['access_login', 'startup_patent', 'marketplace_applications', 'workspace_collaboration', 'account_profile'],
    quickTopics: [
      { label: 'Startup / Patent', category: 'startup_patent', description: 'Launch checklist, patent submission, reviewer feedback' },
      { label: 'My Applications', category: 'marketplace_applications', description: 'Application status, offers, marketplace listings' },
      { label: 'Workspace Access', category: 'workspace_collaboration', description: 'Chat locked, invite pending, file access' },
      { label: 'Portfolio / Profile', category: 'account_profile', description: 'Public profile, portfolio updates, notifications' },
      { label: 'Login Issues', category: 'access_login', description: 'Password reset, locked account, MFA' },
    ],
  },
  [UserRole.RECRUITER]: {
    greeting: 'Recruiter Help Center',
    subtitle: 'Find answers about job listings, candidate applications, workspace setup, and account management.',
    color: 'text-violet-300',
    bgColor: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
    categories: ['access_login', 'marketplace_applications', 'workspace_collaboration', 'account_profile'],
    quickTopics: [
      { label: 'Job Listings', category: 'marketplace_applications', description: 'Post jobs, listing visibility, application reviews' },
      { label: 'Candidate Access', category: 'account_profile', description: 'View full profiles, locked portfolio, interest requests' },
      { label: 'Workspace', category: 'workspace_collaboration', description: 'Interview coordination, team invites, chat access' },
      { label: 'Login Issues', category: 'access_login', description: 'Password reset, locked account, MFA' },
    ],
  },
  [UserRole.INVESTOR]: {
    greeting: 'Investor Help Center',
    subtitle: 'Find answers about deals, payments, investment tracking, and marketplace access.',
    color: 'text-emerald-300',
    bgColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    categories: ['access_login', 'deals_payments', 'marketplace_applications', 'workspace_collaboration', 'account_profile'],
    quickTopics: [
      { label: 'Deal & Payments', category: 'deals_payments', description: 'Payment failures, deal room access, investment tracking' },
      { label: 'Marketplace', category: 'marketplace_applications', description: 'Browse startups, listings, funding rounds' },
      { label: 'Workspace', category: 'workspace_collaboration', description: 'Collaboration, document access, team coordination' },
      { label: 'Login Issues', category: 'access_login', description: 'Password reset, locked account, MFA' },
    ],
  },
  [UserRole.MENTOR]: {
    greeting: 'Mentor Help Center',
    subtitle: 'Find answers about your mentoring workspace, student profiles, and availability settings.',
    color: 'text-amber-300',
    bgColor: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    categories: ['access_login', 'workspace_collaboration', 'marketplace_applications', 'account_profile'],
    quickTopics: [
      { label: 'Workspace Issues', category: 'workspace_collaboration', description: 'Mentoring workspace not loading, invite issues' },
      { label: 'Student Profiles', category: 'account_profile', description: 'Cannot view mentee profiles, visibility settings' },
      { label: 'Availability', category: 'account_profile', description: 'Schedule not updating, availability settings' },
      { label: 'Login Issues', category: 'access_login', description: 'Password reset, locked account, MFA' },
    ],
  },
  [UserRole.SCHOOL]: {
    greeting: 'School Help Center',
    subtitle: 'Find answers about institution verification, student management, workspaces, and your institution profile.',
    color: 'text-blue-300',
    bgColor: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    categories: ['access_login', 'institution_operations', 'workspace_collaboration', 'account_profile'],
    quickTopics: [
      { label: 'Verification', category: 'institution_operations', description: 'Pending verification, student onboarding, dashboard' },
      { label: 'Workspace', category: 'workspace_collaboration', description: 'Add members, chat issues, file access' },
      { label: 'Institution Profile', category: 'account_profile', description: 'Logo, profile info, public listing' },
      { label: 'Login Issues', category: 'access_login', description: 'Password reset, locked account, MFA' },
    ],
  },
  [UserRole.COLLEGE]: {
    greeting: 'College Help Center',
    subtitle: 'Find answers about institution verification, student management, workspaces, and your institution profile.',
    color: 'text-blue-300',
    bgColor: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    categories: ['access_login', 'institution_operations', 'workspace_collaboration', 'account_profile'],
    quickTopics: [
      { label: 'Verification', category: 'institution_operations', description: 'Pending verification, student onboarding, dashboard' },
      { label: 'Workspace', category: 'workspace_collaboration', description: 'Add members, chat issues, file access' },
      { label: 'Institution Profile', category: 'account_profile', description: 'Logo, profile info, public listing' },
      { label: 'Login Issues', category: 'access_login', description: 'Password reset, locked account, MFA' },
    ],
  },
};

export const DEFAULT_ROLE_HELP_CONFIG: RoleHelpConfig = {
  greeting: 'Help Center',
  subtitle: 'Browse quick answers, check the category for your issue, or raise a new support ticket.',
  color: 'text-cyan-300',
  bgColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  categories: [...SUPPORT_CATEGORIES],
  quickTopics: [],
};

export function getRoleHelpConfig(role?: string | null): RoleHelpConfig {
  if (!role) return DEFAULT_ROLE_HELP_CONFIG;
  return ROLE_HELP_CONFIG[role as UserRole] ?? DEFAULT_ROLE_HELP_CONFIG;
}

export function getFaqsForRole(role?: string | null): FaqEntry[] {
  if (!role) return FAQ_ENTRIES;
  return FAQ_ENTRIES.filter((faq) => faq.roles.includes(role as UserRole));
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

export const statusBadgeClass = (status: SupportStatus) => {
  switch (status) {
    case 'open':
      return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
    case 'in_progress':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    case 'resolved':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'closed':
      return 'border-slate-500/30 bg-slate-500/10 text-slate-300';
    default:
      return 'border-slate-500/30 bg-slate-500/10 text-slate-300';
  }
};

export const priorityBadgeClass = (priority: SupportPriority) => {
  switch (priority) {
    case 'low':
      return 'border-slate-500/30 bg-slate-500/10 text-slate-300';
    case 'medium':
      return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
    case 'high':
      return 'border-orange-500/30 bg-orange-500/10 text-orange-300';
    case 'urgent':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
    default:
      return 'border-slate-500/30 bg-slate-500/10 text-slate-300';
  }
};

export function SupportStatusBadge({ status, children }: { status: SupportStatus; children?: ReactNode }) {
  return <Badge className={statusBadgeClass(status)}>{children ?? SUPPORT_STATUS_LABELS[status]}</Badge>;
}

export function SupportPriorityBadge({ priority }: { priority: SupportPriority }) {
  return <Badge className={priorityBadgeClass(priority)}>{SUPPORT_PRIORITY_LABELS[priority]}</Badge>;
}

export const formatSupportDate = (value?: string | null) => {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatRelative = (value?: string | null) => {
  if (!value) {
    return 'just now';
  }

  const then = new Date(value).getTime();
  if (Number.isNaN(then)) {
    return 'just now';
  }

  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

export { SUPPORT_CATEGORIES, SUPPORT_PRIORITIES, SUPPORT_STATUSES };
export { SUPPORT_CATEGORY_LABELS, SUPPORT_CATEGORY_DESCRIPTIONS, SUPPORT_PRIORITY_LABELS, SUPPORT_STATUS_LABELS };
