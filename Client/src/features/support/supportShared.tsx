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

export const SUPPORT_USER_BASE_PATH = '/dashboard/help-desk';
export const SUPPORT_ADMIN_BASE_PATH = '/dashboard/admin/help-desk';

export const buildUserTicketPath = (ticketId: string) => `${SUPPORT_USER_BASE_PATH}/${ticketId}`;
export const buildAdminTicketPath = (ticketId: string) => `${SUPPORT_ADMIN_BASE_PATH}/${ticketId}`;

export const FAQ_ENTRIES: Array<{ id: string; question: string; answer: string; category: SupportCategory }> = [
  {
    id: 'faq-login-reset',
    question: 'I cannot sign in — how do I reset my password?',
    answer:
      'Use the "Forgot password" link on the login page. If you do not receive the email within five minutes, check spam or raise a ticket under Access & Login Issues.',
    category: 'access_login',
  },
  {
    id: 'faq-workspace-access',
    question: 'My workspace chat or files are locked after joining.',
    answer:
      'Workspace invites need admin approval. Open the workspace, confirm the invite has been accepted, and if it still reads "pending" raise a ticket under Workspace / Collaboration Issues.',
    category: 'workspace_collaboration',
  },
  {
    id: 'faq-startup-launch',
    question: 'The startup launch checklist is complete but review is still blocked.',
    answer:
      'Reviews are queued every morning. If a review stays stuck for more than 24 hours, raise a ticket under Startup Launch / Patent Support with the startup ID.',
    category: 'startup_patent',
  },
  {
    id: 'faq-deal-payment',
    question: 'The investor payment for a deal is showing as failed.',
    answer:
      'Retry once from the deal page. If it still fails, open a ticket under Deals / Payment / Investment Issues and include the deal ID and payment reference.',
    category: 'deals_payments',
  },
  {
    id: 'faq-profile-public',
    question: 'My public portfolio is not showing updated info.',
    answer:
      'Public profile caches refresh every few minutes. If the update still does not appear after 10 minutes, raise a ticket under Account & Profile Issues.',
    category: 'account_profile',
  },
];

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
