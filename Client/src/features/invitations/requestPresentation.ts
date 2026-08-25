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
  college_event_reschedule: 'Event postponement',
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
  previousDate: 'Previous date',
  newDate: 'Requested date',
  reason: 'Reason',
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

const isTerminalPositiveStatus = (request: WorkflowRequest) =>
  request.status === 'accepted' || request.status === 'completed';

const getMetadataString = (request: WorkflowRequest, key: string) => {
  const value = request.metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const isMessagePath = (path: string) => path.startsWith('/dashboard/messages');

const isRequestInboxPath = (path: string) =>
  path === '/dashboard/invitations' ||
  path.startsWith('/dashboard/invitations?') ||
  path === '/dashboard/messages?view=requests' ||
  path.startsWith('/dashboard/messages?view=requests&');

function getConversationRequestPartnerId(request: WorkflowRequest, viewerUserId?: string) {
  const isGenericChat =
    request.type === 'generic' &&
    request.actionType === 'connect' &&
    request.targetEntityType === 'conversation';

  const isDmPermissionRequest =
    Boolean(request.requestedPermission?.startsWith('dm_')) ||
    Boolean(request.metadata?.queryType) ||
    request.targetEntityType === 'user_profile' ||
    Boolean(request.acceptRedirect?.startsWith('/dashboard/messages')) ||
    Boolean(request.deepLink?.startsWith('/dashboard/messages'));

  if (!isGenericChat && !isDmPermissionRequest) {
    return null;
  }

  if (viewerUserId) {
    if (request.fromUserId === viewerUserId) {
      return request.toUserId ?? (request.targetEntityType === 'user_profile' ? request.targetEntityId?.split(':')[0] : request.targetEntityId) ?? null;
    }

    if (request.toUserId === viewerUserId || request.targetEntityId === viewerUserId) {
      return request.fromUserId;
    }
  }

  return request.toUserId ?? request.fromUserId ?? null;
}

const getAcceptedPitchWorkspacePath = (request: WorkflowRequest) => {
  if (!isTerminalPositiveStatus(request)) {
    return null;
  }

  if (request.actionType !== 'invest' || request.requestedPermission !== 'dm_investor') {
    return null;
  }

  const workspaceId = request.metadata?.workspaceId;
  return typeof workspaceId === 'string' && workspaceId.trim()
    ? `/product-workspace/${workspaceId.trim()}`
    : null;
};

const getWorkspacePath = (request: WorkflowRequest, viewerUserId?: string) => {
  const workspaceId =
    request.targetEntityType === 'workspace' && request.targetEntityId.trim()
      ? request.targetEntityId.trim()
      : getMetadataString(request, 'workspaceId');

  if (!workspaceId) {
    return null;
  }

  const senderCanAlreadyOpen = viewerUserId ? request.fromUserId === viewerUserId : false;
  return isTerminalPositiveStatus(request) || senderCanAlreadyOpen ? `/product-workspace/${workspaceId}` : null;
};

const getStartupPath = (request: WorkflowRequest) => {
  const startupId =
    request.targetEntityType === 'startup' && request.targetEntityId.trim()
      ? request.targetEntityId.trim()
      : getMetadataString(request, 'startupId');

  return startupId ? `/marketplace/view/startup/${startupId}` : null;
};

const getJobPath = (request: WorkflowRequest) => {
  const jobId =
    request.targetEntityType === 'recruiter_job' && request.targetEntityId.trim()
      ? request.targetEntityId.trim()
      : getMetadataString(request, 'jobId');

  return jobId ? `/marketplace/jobs/${jobId}` : null;
};

const getCollegeEventInviteAction = (request: WorkflowRequest, viewerUserId?: string) => {
  if (request.type !== 'college_event_invite' && request.type !== 'college_event_reschedule') {
    return null;
  }

  const isRecipient = viewerUserId ? request.toUserId === viewerUserId : request.targetRole === 'college';
  const eventId = getMetadataString(request, 'eventId');

  if (isRecipient) {
    return eventId && isTerminalPositiveStatus(request)
      ? { label: 'Open Event', path: `/dashboard/college/events?tab=hiring&eventId=${eventId}` }
      : {
          label: 'Open Event Request',
          path: `/dashboard/college/events?tab=hiring&requestId=${request._id}`,
        };
  }

  return eventId && isTerminalPositiveStatus(request)
    ? { label: 'Open Event', path: `/dashboard/recruiter/hiring-events?eventId=${eventId}` }
    : {
        label: 'Open Event Request',
        path: `/dashboard/recruiter/hiring-events?requestId=${request._id}`,
      };
};

const labelForPath = (path: string) => (isMessagePath(path) ? 'Continue Chat' : 'Open Linked Content');

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

export function getRequestPrimaryAction(request: WorkflowRequest, viewerUserId?: string) {
  const collegeEventInviteAction = getCollegeEventInviteAction(request, viewerUserId);
  if (collegeEventInviteAction) {
    return collegeEventInviteAction;
  }

  const conversationPartnerId = getConversationRequestPartnerId(request, viewerUserId);
  if (conversationPartnerId) {
    return {
      label: 'Continue Chat',
      path: `/dashboard/messages/${conversationPartnerId}`,
    };
  }

  const acceptedPitchWorkspacePath = getAcceptedPitchWorkspacePath(request);
  if (acceptedPitchWorkspacePath) {
    return { label: 'Open Workspace', path: acceptedPitchWorkspacePath };
  }

  const workspacePath = getWorkspacePath(request, viewerUserId);
  if (workspacePath) {
    return { label: 'Open Workspace', path: workspacePath };
  }

  const startupPath = getStartupPath(request);
  if (startupPath) {
    return { label: 'Open Startup', path: startupPath };
  }

  const jobPath = getJobPath(request);
  if (jobPath) {
    return { label: 'Open Job', path: jobPath };
  }

  if (isTerminalPositiveStatus(request) && request.acceptRedirect && !isRequestInboxPath(request.acceptRedirect)) {
    return { label: labelForPath(request.acceptRedirect), path: request.acceptRedirect };
  }

  const fallbackPath = [request.deepLink, request.acceptRedirect, request.declineRedirect].find(
    (path): path is string => Boolean(path && !isRequestInboxPath(path)),
  );

  return fallbackPath ? { label: labelForPath(fallbackPath), path: fallbackPath } : null;
}

export function getRequestPrimaryLink(request: WorkflowRequest, viewerUserId?: string) {
  return getRequestPrimaryAction(request, viewerUserId)?.path ?? null;
}

export function getRequestLinkTargets(request: WorkflowRequest) {
  const isAccepted = request.status === 'accepted' || request.status === 'completed';
  const acceptedPitchWorkspacePath = getAcceptedPitchWorkspacePath(request);
  const targets = isAccepted
    ? [
        acceptedPitchWorkspacePath
          ? { label: 'Open Workspace', path: acceptedPitchWorkspacePath }
          : request.acceptRedirect
            ? { label: labelForPath(request.acceptRedirect), path: request.acceptRedirect }
            : null,
        request.deepLink ? { label: 'Original request', path: request.deepLink } : null,
        request.declineRedirect ? { label: 'After decline', path: request.declineRedirect } : null,
      ]
    : [
        request.deepLink ? { label: labelForPath(request.deepLink), path: request.deepLink } : null,
        request.acceptRedirect ? { label: 'After acceptance', path: request.acceptRedirect } : null,
        request.declineRedirect ? { label: 'After decline', path: request.declineRedirect } : null,
      ];

  const availableTargets = targets.filter(
    (target): target is { label: string; path: string } => Boolean(target?.path),
  );

  return availableTargets.filter(
    (target, index) => availableTargets.findIndex((candidate) => candidate.path === target.path) === index,
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
