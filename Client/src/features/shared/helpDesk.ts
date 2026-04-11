import { WorkflowRequest } from '../../types/request.types';

export const HELP_DESK_REQUEST_TYPE = 'helpdesk_ticket';
export const HELP_DESK_TARGET_ENTITY_TYPE = 'help_desk';
export const HELP_DESK_TARGET_ENTITY_ID = 'admin-support';
export const HELP_DESK_TARGET_ENTITY_TITLE = 'ProMove Help Desk';

export const HELP_DESK_ISSUE_OPTIONS = [
  {
    value: 'access',
    label: 'Access',
    description: 'Login issues, missing permissions, blocked account state, or route access problems.',
  },
  {
    value: 'marketplace',
    label: 'Marketplace',
    description: 'Profile discovery, applications, listings, and marketplace visibility issues.',
  },
  {
    value: 'startup',
    label: 'Startup',
    description: 'Startup launch, review, patent, cap table, or launch-readiness blockers.',
  },
  {
    value: 'workspace',
    label: 'Workspace',
    description: 'Project collaboration, workspace membership, or task-flow problems.',
  },
  {
    value: 'institution',
    label: 'Institution',
    description: 'School or college operations, verification, and admin workflow support.',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Anything outside the main support flows.',
  },
] as const;

export type HelpDeskIssueType = (typeof HELP_DESK_ISSUE_OPTIONS)[number]['value'];

export interface HelpDeskMetadata {
  issueType: HelpDeskIssueType;
  mediatorReplies: string[];
  submittedByRole?: string;
  submittedByName?: string;
  submittedFromPath?: string;
  resolutionNotes?: string;
  resolvedAt?: string;
  resolvedByAdminId?: string;
}

const issueLabelMap = new Map(
  HELP_DESK_ISSUE_OPTIONS.map((option) => [option.value, option.label]),
);

const issueKeywordMatchers: Array<{ type: HelpDeskIssueType; pattern: RegExp }> = [
  { type: 'access', pattern: /\b(login|signin|sign in|password|access|permission|blocked|unauthorized)\b/i },
  { type: 'marketplace', pattern: /\b(marketplace|listing|application|job|investor|recruiter|profile)\b/i },
  { type: 'startup', pattern: /\b(startup|launch|pitch|patent|review|deck|funding|cap table)\b/i },
  { type: 'workspace', pattern: /\b(workspace|project|member|invite|collaborat|task|chat)\b/i },
  { type: 'institution', pattern: /\b(college|school|institution|verification|student roster|placement)\b/i },
];

export const isHelpDeskTicket = (request: Pick<WorkflowRequest, 'requestType' | 'type' | 'targetEntityType'>) =>
  (request.requestType ?? request.type) === HELP_DESK_REQUEST_TYPE ||
  request.targetEntityType === HELP_DESK_TARGET_ENTITY_TYPE;

export const inferHelpDeskIssueType = (
  message: string,
  selectedIssueType?: HelpDeskIssueType,
): HelpDeskIssueType => {
  if (selectedIssueType && selectedIssueType !== 'other') {
    return selectedIssueType;
  }

  const normalizedMessage = message.trim();
  const matchedType = issueKeywordMatchers.find(({ pattern }) => pattern.test(normalizedMessage));
  return matchedType?.type ?? selectedIssueType ?? 'other';
};

export const getHelpDeskIssueLabel = (issueType: HelpDeskIssueType) =>
  issueLabelMap.get(issueType) ?? 'Other';

export const buildMediatorReplies = (params: {
  issueType: HelpDeskIssueType;
  message: string;
  displayName?: string;
}) => {
  const issueLabel = getHelpDeskIssueLabel(params.issueType);
  const userReference = params.displayName?.trim() ? `${params.displayName}, ` : '';
  const summaryLine = params.message.trim()
    ? `I understand the ${issueLabel.toLowerCase()} issue. I'm preparing a help desk ticket for the admin team.`
    : `Describe the issue and I'll prepare a structured help desk ticket for the admin team.`;

  const issueSpecificLineByType: Record<HelpDeskIssueType, string> = {
    access:
      'Please include the exact page, the action you tried, and any access or login error shown on screen.',
    marketplace:
      'Mention the listing, startup, recruiter, or application flow involved so the admin can trace the record quickly.',
    startup:
      'Add the startup name and the blocked review, patent, launch, or fundraising step so the admin can investigate the right workflow.',
    workspace:
      'Mention the workspace or project name and what collaboration step is failing, such as invite, access, chat, or progress updates.',
    institution:
      'Include the institution name and the affected operations flow, such as verification, events, student access, or placement tracking.',
    other:
      'List the steps you followed and the exact result you expected so the admin can reproduce the issue without extra back-and-forth.',
  };

  return [
    `${userReference}${summaryLine}`,
    issueSpecificLineByType[params.issueType],
    'Once you submit, the ticket will stay in the help desk queue until an admin adds a resolution note.',
  ];
};

export const parseHelpDeskMetadata = (metadata?: Record<string, unknown>): HelpDeskMetadata => {
  const mediatorReplies = Array.isArray(metadata?.mediatorReplies)
    ? metadata.mediatorReplies.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];

  const issueType = typeof metadata?.issueType === 'string'
    && HELP_DESK_ISSUE_OPTIONS.some((option) => option.value === metadata.issueType)
      ? (metadata.issueType as HelpDeskIssueType)
      : 'other';

  return {
    issueType,
    mediatorReplies,
    ...(typeof metadata?.submittedByRole === 'string' ? { submittedByRole: metadata.submittedByRole } : {}),
    ...(typeof metadata?.submittedByName === 'string' ? { submittedByName: metadata.submittedByName } : {}),
    ...(typeof metadata?.submittedFromPath === 'string'
      ? { submittedFromPath: metadata.submittedFromPath }
      : {}),
    ...(typeof metadata?.resolutionNotes === 'string'
      ? { resolutionNotes: metadata.resolutionNotes }
      : {}),
    ...(typeof metadata?.resolvedAt === 'string' ? { resolvedAt: metadata.resolvedAt } : {}),
    ...(typeof metadata?.resolvedByAdminId === 'string'
      ? { resolvedByAdminId: metadata.resolvedByAdminId }
      : {}),
  };
};

export const getHelpDeskResolutionNote = (request: Pick<WorkflowRequest, 'metadata' | 'auditTrail'>) => {
  const metadata = parseHelpDeskMetadata(request.metadata);
  if (metadata.resolutionNotes) {
    return metadata.resolutionNotes;
  }

  const completionAuditEntry = request.auditTrail
    ?.slice()
    .reverse()
    .find((entry) => entry.status === 'completed' && typeof entry.message === 'string' && entry.message.trim().length > 0);

  return completionAuditEntry?.message;
};
