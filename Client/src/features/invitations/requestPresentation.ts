import { WorkflowRequest } from '../../types/request.types';

export const REQUEST_TYPE_LABELS: Record<WorkflowRequest['type'], string> = {
  generic: 'Workflow request',
  workspace_member: 'Workspace invite',
  workspace_chat_access: 'Workspace chat access',
  startup_member: 'Startup invite',
  startup_cofounder: 'Co-founder invite',
  mentor_assignment: 'Mentor invite',
  investor_startup_access: 'Investor pitch',
  recruiter_job_invite: 'Job invite',
  campus_drive_registration: 'Campus drive registration',
  college_event_invite: 'Event invite',
  college_recruiter_partnership: 'Recruiter partnership',
  patent_coinventor: 'Patent co-inventor',
  problem_review: 'Problem review',
  startup_review: 'Startup review',
  patent_request_review: 'Patent request review',
};

export function getRequestTypeLabel(request: WorkflowRequest) {
  if (request.type === 'generic' && request.actionType === 'connect' && request.targetEntityType === 'conversation') {
    return 'Conversation request';
  }

  return REQUEST_TYPE_LABELS[request.type] ?? 'Request';
}

export const REQUEST_STATUS_COLOR_CLASSES: Record<WorkflowRequest['status'], string> = {
  pending: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  accepted: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  declined: 'text-rose-300 border-rose-500/30 bg-rose-500/10',
  withdrawn: 'text-slate-300 border-slate-700 bg-slate-800',
  expired: 'text-slate-300 border-slate-700 bg-slate-800',
  cancelled: 'text-slate-300 border-slate-700 bg-slate-800',
  completed: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10',
};

const ENTITY_METADATA_KEYS = ['entityName', 'targetName', 'workspaceTitle', 'jobTitle', 'company', 'startupName'] as const;

const METADATA_LABELS: Record<string, string> = {
  workspaceTitle: 'Workspace',
  targetName: 'Target name',
  entityName: 'Entity name',
  jobTitle: 'Job title',
  company: 'Company',
  startupName: 'Startup',
  startupStage: 'Stage',
  startupCategory: 'Category',
  startupTagline: 'Tagline',
  startupFundingNeeded: 'Funding needed',
  requestedAudience: 'Requested audience',
  recipientName: 'Recipient',
  recruiterName: 'Recruiter',
  collegeName: 'College',
  collegeLocation: 'College location',
  queryType: 'Conversation context',
  messageId: 'Message reference',
  recipientRole: 'Recipient role',
  title: 'Event title',
  type: 'Event type',
  date: 'Scheduled for',
  description: 'Event brief',
  minimumInnovationScore: 'Minimum score',
  subject: 'Request subject',
  innovationThemes: 'Innovation focus',
  cohortSize: 'Cohort size',
  targetRoles: 'Target roles',
  engagementFormat: 'Engagement format',
};

const HIDDEN_METADATA_KEYS = new Set([
  'allowSelfAcceptance',
  'allowSelfRequest',
  'workspaceId',
  'teamRequestId',
  'jobId',
  'collegeId',
  'recruiterId',
  'eventId',
  'deepLink',
  'acceptRedirect',
  'declineRedirect',
  'requestOrigin',
  'eventRequestKind',
]);

const humanize = (value: string) =>
  value
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatMetadataValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => formatMetadataValue(item))
      .filter((item): item is string => Boolean(item));
    return items.length > 0 ? items.join(', ') : null;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const displayValue =
      formatMetadataValue(record.displayName) ??
      formatMetadataValue(record.name) ??
      formatMetadataValue(record.title) ??
      formatMetadataValue(record.label);
    return displayValue;
  }

  return null;
};

export function formatRequestStamp(value?: string) {
  if (!value) {
    return 'Not available';
  }

  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatRequestStatus(status: WorkflowRequest['status']) {
  return humanize(status);
}

export function getRequestEntityName(request: WorkflowRequest) {
  for (const key of ENTITY_METADATA_KEYS) {
    const metadataValue = request.metadata?.[key];
    const formatted = formatMetadataValue(metadataValue);
    if (formatted) {
      return formatted;
    }
  }

  return request.targetEntityTitle ?? `${humanize(request.targetEntityType)} ${request.targetEntityId}`;
}

export function getRequestActorLabel(request: WorkflowRequest, direction: 'incoming' | 'outgoing') {
  return direction === 'incoming'
    ? request.fromUser?.displayName ?? request.fromUser?.email ?? 'Unknown sender'
    : request.toUser?.displayName ?? request.recipientEmail ?? 'Pending account';
}

export function getRequestPrimaryLink(request: WorkflowRequest) {
  return request.deepLink ?? request.acceptRedirect ?? request.declineRedirect ?? null;
}

export function getRequestLinkTargets(request: WorkflowRequest) {
  const targets = [
    request.deepLink ? { label: 'Open linked content', path: request.deepLink } : null,
    request.acceptRedirect ? { label: 'After acceptance', path: request.acceptRedirect } : null,
    request.declineRedirect ? { label: 'After decline', path: request.declineRedirect } : null,
  ].filter((target): target is { label: string; path: string } => Boolean(target?.path));

  return targets.filter(
    (target, index) => targets.findIndex((candidate) => candidate.path === target.path) === index,
  );
}

export function getRequestMetadataEntries(request: WorkflowRequest) {
  const metadata = request.metadata ?? {};
  const entries = Object.entries(metadata)
    .filter(([key]) => !HIDDEN_METADATA_KEYS.has(key))
    .map(([key, value]) => {
      const formattedValue = formatMetadataValue(value);
      if (!formattedValue) {
        return null;
      }

      return {
        key,
        label: METADATA_LABELS[key] ?? humanize(key),
        value: formattedValue,
      };
    })
    .filter((entry): entry is { key: string; label: string; value: string } => Boolean(entry));

  return entries.filter(
    (entry, index) =>
      entries.findIndex(
        (candidate) =>
          candidate.label.toLowerCase() === entry.label.toLowerCase() &&
          candidate.value.toLowerCase() === entry.value.toLowerCase(),
      ) === index,
  );
}
