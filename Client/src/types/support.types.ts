import type { StartupEditAccess, StartupReviewStatus } from './startup.types';

export const SUPPORT_CATEGORIES = [
  'access_login',
  'workspace_collaboration',
  'startup_patent',
  'marketplace_applications',
  'institution_operations',
  'deals_payments',
  'account_profile',
  'other',
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];

export const SUPPORT_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_RELATED_ENTITY_TYPES = [
  'workspace',
  'startup',
  'patent',
  'deal',
  'job',
  'application',
  'other',
] as const;
export type SupportRelatedEntityType = (typeof SUPPORT_RELATED_ENTITY_TYPES)[number];

export type SupportMessageKind = 'user_reply' | 'admin_reply' | 'internal_note';

export type SupportActivityType =
  | 'created'
  | 'assigned'
  | 'status_changed'
  | 'priority_changed'
  | 'reopened'
  | 'escalated'
  | 'feedback_submitted'
  | 'attachment_added';

export interface SupportUserSummary {
  _id: string;
  displayName: string;
  email: string;
  role: string;
}

export interface SupportAttachment {
  _id?: string;
  url: string;
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface SupportAttachmentInput {
  url: string;
  name: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface SupportAttachmentUpload {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  publicId?: string;
}

export interface SupportMessage {
  _id?: string;
  kind: SupportMessageKind;
  authorId: string;
  authorRoleSnapshot?: string;
  body: string;
  attachments: SupportAttachment[];
  createdAt: string;
  author?: SupportUserSummary;
}

export interface SupportActivityEntry {
  _id?: string;
  type: SupportActivityType;
  actorUserId?: string;
  fromValue?: string;
  toValue?: string;
  note?: string;
  at: string;
  actor?: SupportUserSummary;
}

export interface SupportFeedback {
  rating: number;
  comment?: string;
  submittedAt: string;
}

export interface SupportTicket {
  _id: string;
  ticketCode: string;
  createdBy: string;
  institutionId?: string | null;
  roleSnapshot: string;
  category: SupportCategory;
  title: string;
  description: string;
  priority: SupportPriority;
  status: SupportStatus;
  relatedEntityType?: SupportRelatedEntityType | null;
  relatedEntityId?: string | null;
  referenceText?: string;
  attachments: SupportAttachment[];
  assignedTo?: string | null;
  watchers: string[];
  messages: SupportMessage[];
  activity: SupportActivityEntry[];
  firstRespondedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  reopenedCount: number;
  lastActivityAt: string;
  feedback?: SupportFeedback | null;
  createdAt: string;
  updatedAt: string;
  author?: SupportUserSummary;
  assignee?: SupportUserSummary | null;
  overdue?: boolean;
  relatedStartup?: {
    _id: string;
    name: string;
    reviewStatus: StartupReviewStatus;
    editAccess: StartupEditAccess;
  };
}

export interface CreateSupportTicketPayload {
  title: string;
  category: SupportCategory;
  description: string;
  priority?: SupportPriority;
  relatedEntityType?: SupportRelatedEntityType;
  relatedEntityId?: string;
  referenceText?: string;
  attachments?: SupportAttachmentInput[];
}

export interface ListSupportTicketsFilters {
  status?: SupportStatus;
  category?: SupportCategory;
  priority?: SupportPriority;
  search?: string;
}

export interface AdminListSupportTicketsFilters extends ListSupportTicketsFilters {
  assignedTo?: string;
  overdue?: boolean;
}

export interface SupportAnalyticsSummary {
  open: number;
  inProgress: number;
  resolvedToday: number;
  overdue: number;
  avgFirstResponseHours: number | null;
  avgResolutionHours: number | null;
  byCategory: Record<SupportCategory, number>;
  byPriority: Record<SupportPriority, number>;
}

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  access_login: 'Access & Login Issues',
  workspace_collaboration: 'Workspace / Collaboration Issues',
  startup_patent: 'Startup Launch / Patent Support',
  marketplace_applications: 'Marketplace / Applications Issues',
  institution_operations: 'Institution Operations / Verification',
  deals_payments: 'Deals / Payment / Investment Issues',
  account_profile: 'Account & Profile Issues',
  other: 'Other Support',
};

export const SUPPORT_CATEGORY_DESCRIPTIONS: Record<SupportCategory, string> = {
  access_login: 'Sign-in problems, password resets, locked accounts, MFA issues.',
  workspace_collaboration: 'Workspace permissions, chat access, team invites, and shared docs.',
  startup_patent: 'Startup launch steps, patent submissions, reviewer feedback.',
  marketplace_applications: 'Marketplace listings, applications, offers and acceptance.',
  institution_operations: 'School or college operations, verification, and onboarding.',
  deals_payments: 'Deal rooms, payment failures, investor settlements.',
  account_profile: 'Profile edits, portfolio info, notification preferences.',
  other: 'Anything that does not fit a category above.',
};

export const SUPPORT_PRIORITY_LABELS: Record<SupportPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};
