import { FilterQuery, Types } from 'mongoose';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { ApiError } from '../../utils/ApiError';
import { UserRole } from '../../types/roles.types';
import {
  sendJobInviteEmail,
  sendJobInviteAcceptedEmail,
  sendJobInviteDeclinedEmail,
} from '../../services/emailService';
import { Startup } from '../startup/startup.model';
import { User } from '../user/user.model';
import { Workspace } from '../workspace/workspace.model';
import { queueNotification } from '../notification/notification.delivery';
import {
  IRequest,
  RequestActionType,
  RequestDocument,
  RequestRecord,
  RequestStatus,
  RequestType,
} from './request.model';

const DEFAULT_REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COLLEGE_HIRING_REQUEST_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const ACCEPTED_REQUEST_TYPES_BLOCK_REINVITE = new Set<RequestType>([
  'workspace_member',
  'startup_member',
]);

type RequestHandler = {
  validateAccept?: (request: RequestDocument, actorUserId: string) => Promise<void>;
  onAccept?: (request: RequestDocument, actorUserId: string) => Promise<void>;
  onDecline?: (request: RequestDocument, actorUserId: string) => Promise<void>;
  onWithdraw?: (request: RequestDocument, actorUserId: string) => Promise<void>;
};

const handlers = new Map<RequestType, RequestHandler>();

export const registerRequestHandler = (type: RequestType, handler: RequestHandler) => {
  handlers.set(type, handler);
};

const objectId = (value: string) => new Types.ObjectId(value);

const normalizeEmail = (value?: string) => value?.trim().toLowerCase();

const optionalObjectId = (value?: string | null) =>
  value && Types.ObjectId.isValid(value) ? objectId(value) : null;

const scopedRequestFilter = (
  filter: FilterQuery<IRequest>,
  institutionId?: string | null,
): FilterQuery<IRequest> => {
  const tenantId = optionalObjectId(institutionId);
  if (!tenantId) {
    return filter;
  }

  return {
    $and: [
      filter,
      {
        $or: [
          { institutionId: tenantId },
          { institutionId: { $exists: false } },
          { institutionId: null },
        ],
      },
    ],
  };
};

const resolveRequestInstitutionId = async (params: {
  institutionId?: string | null;
  fromUserId: string;
}) => {
  const explicitInstitutionId = optionalObjectId(params.institutionId);
  if (explicitInstitutionId) {
    return explicitInstitutionId;
  }

  const sender = await User.findById(params.fromUserId)
    .select('_id role institutionId')
    .lean();

  if (!sender) {
    return null;
  }

  if (sender.role === UserRole.SCHOOL || sender.role === UserRole.COLLEGE) {
    return sender._id;
  }

  if (sender.role === UserRole.STUDENT && sender.institutionId) {
    return sender.institutionId;
  }

  return null;
};

const getActorEmail = async (userId: string, email?: string) => {
  const normalized = normalizeEmail(email);
  if (normalized) {
    return normalized;
  }

  const user = await User.findById(userId).select('email').lean();
  return normalizeEmail(user?.email) ?? '';
};

const getUserLabel = (user?: { displayName?: string; email?: string } | null) =>
  user?.displayName || user?.email || 'A ProMove member';

const isCollegeHiringRequestWithCooldown = (params: {
  type: RequestType;
  targetEntityType: string;
  requestedPermission?: string;
}) =>
  params.type === 'college_event_invite' &&
  params.targetEntityType === 'recruiter' &&
  params.requestedPermission === 'college_hiring_event_request';

const formatRequestCooldownDate = (value: Date) =>
  value.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const assertRecipient = (params: { toUserId?: string; recipientEmail?: string }) => {
  if (!params.toUserId && !normalizeEmail(params.recipientEmail)) {
    throw new ApiError(400, 'REQUEST_RECIPIENT_REQUIRED', 'A request recipient is required.');
  }
};

const requestRecipientFilter = (userId: string, email: string) => ({
  $or: [
    { toUserId: objectId(userId) },
    { recipientEmail: email, toUserId: { $exists: false } },
    { recipientEmail: email, toUserId: null },
  ],
});

const requestVisibilityFilter = (userId: string, email: string): FilterQuery<IRequest> => ({
  $or: [
    { fromUserId: objectId(userId) },
    { toUserId: objectId(userId) },
    { recipientEmail: email, toUserId: { $exists: false } },
    { recipientEmail: email, toUserId: null },
  ],
});

const getMetadataObjectId = (metadata: Record<string, unknown> | undefined, key: string) => {
  const value = metadata?.[key];
  return typeof value === 'string' && Types.ObjectId.isValid(value) ? value : null;
};

const addValidObjectId = (set: Set<string>, value?: string | Types.ObjectId | null) => {
  if (!value) {
    return;
  }

  const id = String(value);
  if (Types.ObjectId.isValid(id)) {
    set.add(id);
  }
};

const expirePendingRequests = async (filter: FilterQuery<IRequest>) => {
  const now = new Date();
  await RequestRecord.updateMany(
    {
      ...filter,
      status: 'pending',
      expiresAt: { $lte: now },
    },
    {
      $set: {
        status: 'expired',
        respondedAt: now,
      },
      $push: {
        auditTrail: {
          status: 'expired',
          message: 'Request expired automatically before listing.',
          at: now,
        },
      },
    },
  );
};

const removeUnavailableRequests = async <T extends IRequest>(requests: T[]) => {
  if (requests.length === 0) {
    return requests;
  }

  const userIds = new Set<string>();
  const startupIds = new Set<string>();
  const workspaceIds = new Set<string>();

  for (const request of requests) {
    addValidObjectId(userIds, request.fromUserId);
    addValidObjectId(userIds, request.toUserId);

    if (request.targetEntityType === 'startup') {
      addValidObjectId(startupIds, request.targetEntityId);
    }
    if (request.targetEntityType === 'workspace') {
      addValidObjectId(workspaceIds, request.targetEntityId);
    }

    addValidObjectId(startupIds, getMetadataObjectId(request.metadata, 'startupId'));
    addValidObjectId(workspaceIds, getMetadataObjectId(request.metadata, 'workspaceId'));
  }

  const [users, startups, workspaces] = await Promise.all([
    userIds.size
      ? User.find({ _id: { $in: Array.from(userIds) }, isActive: true }).select('_id').lean()
      : Promise.resolve([]),
    startupIds.size
      ? Startup.find({ _id: { $in: Array.from(startupIds) }, isActive: true }).select('_id').lean()
      : Promise.resolve([]),
    workspaceIds.size
      ? Workspace.find({ _id: { $in: Array.from(workspaceIds) }, isActive: true }).select('_id').lean()
      : Promise.resolve([]),
  ]);

  const existingUserIds = new Set(users.map((user) => String(user._id)));
  const existingStartupIds = new Set(startups.map((startup) => String(startup._id)));
  const existingWorkspaceIds = new Set(workspaces.map((workspace) => String(workspace._id)));

  const unavailableRequestIds = requests
    .filter((request) => {
      if (!existingUserIds.has(String(request.fromUserId))) {
        return true;
      }
      if (request.toUserId && !existingUserIds.has(String(request.toUserId))) {
        return true;
      }

      const targetStartupId =
        request.targetEntityType === 'startup' && Types.ObjectId.isValid(request.targetEntityId)
          ? request.targetEntityId
          : null;
      if (request.targetEntityType === 'startup' && !targetStartupId) {
        return true;
      }
      if (targetStartupId && !existingStartupIds.has(targetStartupId)) {
        return true;
      }

      const metadataStartupId = getMetadataObjectId(request.metadata, 'startupId');
      if (metadataStartupId && !existingStartupIds.has(metadataStartupId)) {
        return true;
      }

      const targetWorkspaceId =
        request.targetEntityType === 'workspace' && Types.ObjectId.isValid(request.targetEntityId)
          ? request.targetEntityId
          : null;
      if (request.targetEntityType === 'workspace' && !targetWorkspaceId) {
        return true;
      }
      if (targetWorkspaceId && !existingWorkspaceIds.has(targetWorkspaceId)) {
        return true;
      }

      const metadataWorkspaceId = getMetadataObjectId(request.metadata, 'workspaceId');
      if (metadataWorkspaceId && !existingWorkspaceIds.has(metadataWorkspaceId)) {
        return true;
      }

      return false;
    })
    .map((request) => request._id);

  if (unavailableRequestIds.length === 0) {
    return requests;
  }

  await RequestRecord.deleteMany({ _id: { $in: unavailableRequestIds } });
  const unavailableIdSet = new Set(unavailableRequestIds.map((id) => String(id)));
  return requests.filter((request) => !unavailableIdSet.has(String(request._id)));
};

export const claimEmailRequestsForUser = async (
  userId: string,
  email: string,
  institutionId?: string | null,
) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return;
  }

  await RequestRecord.updateMany(
    {
      recipientEmail: normalizedEmail,
      status: 'pending',
      $or: [{ toUserId: { $exists: false } }, { toUserId: null }],
    },
    { $set: { toUserId: objectId(userId) } },
  );
};

type UserSummary = {
  _id: string;
  displayName: string;
  email: string;
  role: string;
  avatar?: string;
  domain?: string;
  verificationStatus?: string;
  adminApprovalStatus?: string;
};

type RequestView = {
  _id: string;
  institutionId?: string | null;
  type: RequestType;
  requestType: RequestType;
  actionType?: RequestActionType;
  fromUserId: string;
  toUserId?: string;
  recipientEmail?: string;
  targetEntityType: string;
  targetEntityId: string;
  targetEntityTitle?: string;
  targetRole?: string;
  requestedRole?: string;
  requestedPermission?: string;
  status: RequestStatus;
  message: string;
  metadata?: Record<string, unknown>;
  deepLink?: string;
  acceptRedirect?: string;
  declineRedirect?: string;
  expiresAt: string;
  respondedAt?: string | null;
  auditTrail: Array<{
    status: RequestStatus | 'created';
    actorUserId?: string;
    message?: string;
    metadata?: Record<string, unknown>;
    at: string;
  }>;
  createdAt: string;
  updatedAt: string;
  fromUser?: UserSummary;
  toUser?: UserSummary;
};

export const serializeRequests = async (requests: IRequest[]): Promise<RequestView[]> => {
  const userIds = Array.from(
    new Set(
      requests.flatMap((request) => [
        String(request.fromUserId),
        ...(request.toUserId ? [String(request.toUserId)] : []),
      ]),
    ),
  );

  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select('_id displayName email role avatar domain verificationStatus adminApprovalStatus')
        .lean<Array<{
          _id: Types.ObjectId;
          displayName: string;
          email: string;
          role: string;
          avatar?: string;
          domain?: string;
          verificationStatus?: string;
          adminApprovalStatus?: string;
        }>>()
    : [];
  const userMap = new Map(
    users.map((user) => [
      String(user._id),
      {
        _id: String(user._id),
         displayName: user.displayName,
         email: user.email,
         role: user.role,
         ...(user.avatar ? { avatar: user.avatar } : {}),
         ...(user.domain ? { domain: user.domain } : {}),
         ...(user.verificationStatus ? { verificationStatus: user.verificationStatus } : {}),
         ...(user.adminApprovalStatus ? { adminApprovalStatus: user.adminApprovalStatus } : {}),
       },
    ]),
  );

  return requests.map((request) => ({
    _id: String(request._id),
    institutionId: request.institutionId ? String(request.institutionId) : null,
    type: request.type,
    requestType: request.type,
    ...(request.actionType ? { actionType: request.actionType } : {}),
    fromUserId: String(request.fromUserId),
    ...(request.toUserId ? { toUserId: String(request.toUserId) } : {}),
    ...(request.recipientEmail ? { recipientEmail: request.recipientEmail } : {}),
    targetEntityType: request.targetEntityType,
    targetEntityId: request.targetEntityId,
    ...(request.targetEntityTitle ? { targetEntityTitle: request.targetEntityTitle } : {}),
    ...(request.targetRole ? { targetRole: request.targetRole } : {}),
    ...(request.requestedRole ? { requestedRole: request.requestedRole } : {}),
    ...(request.requestedPermission ? { requestedPermission: request.requestedPermission } : {}),
    status: request.status,
    message: request.message,
    ...(request.metadata ? { metadata: request.metadata } : {}),
    ...(request.deepLink ? { deepLink: request.deepLink } : {}),
    ...(request.acceptRedirect ? { acceptRedirect: request.acceptRedirect } : {}),
    ...(request.declineRedirect ? { declineRedirect: request.declineRedirect } : {}),
    expiresAt: request.expiresAt.toISOString(),
    respondedAt: request.respondedAt ? request.respondedAt.toISOString() : null,
    auditTrail: (request.auditTrail ?? []).map((entry) => ({
      status: entry.status,
      ...(entry.actorUserId ? { actorUserId: String(entry.actorUserId) } : {}),
      ...(entry.message ? { message: entry.message } : {}),
      ...(entry.metadata ? { metadata: entry.metadata } : {}),
      at: entry.at.toISOString(),
    })),
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    ...(userMap.get(String(request.fromUserId)) ? { fromUser: userMap.get(String(request.fromUserId)) } : {}),
    ...(request.toUserId && userMap.get(String(request.toUserId))
      ? { toUser: userMap.get(String(request.toUserId)) }
      : {}),
  }));
};

export const mapRequest = async (request: IRequest) => {
  const [view] = await serializeRequests([request]);
  return view;
};

const buildClientUrl = (path: string) => {
  const base = env.CLIENT_URL.replace(/\/+$/, '');
  return `${base}/${path.replace(/^\/+/, '')}`;
};

const queueRequestNotification = async (request: IRequest) => {
  if (!request.toUserId) {
    return;
  }

  const fromUser = await User.findById(request.fromUserId).select('displayName email role').lean();
  const senderName = getUserLabel(fromUser);
  const entityName = request.targetEntityTitle
    ? request.targetEntityTitle
    : typeof request.metadata?.entityName === 'string'
      ? request.metadata.entityName
      : typeof request.metadata?.workspaceTitle === 'string'
        ? request.metadata.workspaceTitle
        : request.targetEntityType;
  const link = `/dashboard/invitations?requestId=${String(request._id)}`;
  const requestedAction = request.actionType?.replace(/_/g, ' ') ?? request.targetRole ?? request.type.replace(/_/g, ' ');
  const isEventReschedule = request.type === 'college_event_reschedule';
  const requestedEventDate =
    isEventReschedule && typeof request.metadata?.newDate === 'string'
      ? new Date(request.metadata.newDate).toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Kolkata',
        })
      : null;
  const rescheduleReason =
    isEventReschedule && typeof request.metadata?.reason === 'string'
      ? request.metadata.reason.trim()
      : '';

  await queueNotification({
    userId: String(request.toUserId),
    type: 'request',
    title: isEventReschedule ? 'Event postponement approval requested' : 'New request',
    body: isEventReschedule
      ? `${senderName} requested to postpone ${entityName}${requestedEventDate ? ` to ${requestedEventDate}` : ''}.${rescheduleReason ? ` Reason: ${rescheduleReason}` : ''}`
      : `${senderName} requested ${requestedAction} for ${entityName}.`,
    link,
    metadata: {
      requestId: String(request._id),
      requestType: request.type,
      actionType: request.actionType,
      targetEntityType: request.targetEntityType,
      targetEntityId: request.targetEntityId,
      targetEntityTitle: request.targetEntityTitle,
      targetRole: request.targetRole,
      requestedRole: request.requestedRole,
      requestedPermission: request.requestedPermission,
      sender: {
        _id: String(request.fromUserId),
        name: senderName,
        role: fromUser?.role,
      },
      ...(request.metadata ?? {}),
      deepLink: request.deepLink,
      acceptRedirect: request.acceptRedirect,
      declineRedirect: request.declineRedirect,
    },
  });

  if (request.type === 'recruiter_job_invite') {
    const toUser = await User.findById(request.toUserId).select('displayName email').lean();
    if (toUser?.email) {
      const jobTitle = (request.targetEntityTitle as string) ?? (typeof request.metadata?.jobTitle === 'string' ? request.metadata.jobTitle : 'a position');
      const company = typeof request.metadata?.company === 'string' ? request.metadata.company : '';
      const note = typeof request.message === 'string' ? request.message : undefined;
      const inviteLink = buildClientUrl(`/marketplace/jobs/${request.targetEntityId}`);

      sendJobInviteEmail({
        toEmail: toUser.email,
        studentName: getUserLabel(toUser),
        recruiterName: senderName,
        jobTitle,
        company,
        note,
        inviteLink,
      }).catch((error) => logger.error('Failed to send job invite email', error));
    }
  }
};

const queueRequestResponseNotification = async (
  request: IRequest,
  status: Extract<RequestStatus, 'accepted' | 'declined' | 'withdrawn' | 'expired'>,
) => {
  const actor = request.toUserId
    ? await User.findById(request.toUserId).select('displayName email role').lean()
    : null;
  const actorName = getUserLabel(actor);
  const entityName =
    request.targetEntityTitle ||
    (typeof request.metadata?.entityName === 'string'
      ? request.metadata.entityName
      : typeof request.metadata?.workspaceTitle === 'string'
        ? request.metadata.workspaceTitle
        : request.targetEntityType);

  const notificationLink =
    status === 'accepted'
      ? request.acceptRedirect || request.deepLink || (request.toUserId ? `/dashboard/messages/${String(request.toUserId)}` : '/dashboard/invitations')
      : '/dashboard/invitations';

  await queueNotification({
    userId: String(request.fromUserId),
    type: 'request',
    title: `Request ${status}`,
    body: `${actorName} ${status} your request for ${entityName}.`,
    link: notificationLink,
    metadata: {
      requestId: String(request._id),
      requestType: request.type,
      actionType: request.actionType,
      targetEntityType: request.targetEntityType,
      targetEntityId: request.targetEntityId,
      targetEntityTitle: request.targetEntityTitle,
      status,
      deepLink: request.deepLink,
      acceptRedirect: request.acceptRedirect,
    },
  });

  if (request.type === 'recruiter_job_invite' && (status === 'accepted' || status === 'declined')) {
    const recruiter = await User.findById(request.fromUserId).select('displayName email').lean();
    if (recruiter?.email) {
      const jobTitle = (request.targetEntityTitle as string) ?? (typeof request.metadata?.jobTitle === 'string' ? request.metadata.jobTitle : 'a position');
      const company = typeof request.metadata?.company === 'string' ? request.metadata.company : '';
      const dashboardLink = buildClientUrl('/dashboard/recruiter/applications');

      const emailParams = {
        toEmail: recruiter.email,
        recruiterName: getUserLabel(recruiter),
        studentName: actorName,
        jobTitle,
        company,
        accepted: status === 'accepted',
        dashboardLink,
      };

      if (status === 'accepted') {
        sendJobInviteAcceptedEmail(emailParams).catch((error) =>
          logger.error('Failed to send job invite accepted email', error),
        );
      } else {
        sendJobInviteDeclinedEmail(emailParams).catch((error) =>
          logger.error('Failed to send job invite declined email', error),
        );
      }
    }
  }
};

const assertCollegeHiringRequestCooldown = async (params: {
  type: RequestType;
  institutionId?: Types.ObjectId | null;
  fromUserId: string;
  toUserId?: string;
  recipientEmail?: string;
  targetEntityType: string;
  targetEntityId: string;
  requestedPermission?: string;
}) => {
  if (!isCollegeHiringRequestWithCooldown(params)) {
    return;
  }

  assertRecipient(params);

  const cooldownStart = new Date(Date.now() - COLLEGE_HIRING_REQUEST_COOLDOWN_MS);
  const recentRequest = await RequestRecord.findOne(
    scopedRequestFilter(
      {
        type: params.type,
        fromUserId: objectId(params.fromUserId),
        ...(params.toUserId ? { toUserId: objectId(params.toUserId) } : { recipientEmail: normalizeEmail(params.recipientEmail) }),
        targetEntityType: params.targetEntityType,
        targetEntityId: params.targetEntityId,
        requestedPermission: params.requestedPermission,
        createdAt: { $gte: cooldownStart },
      },
      params.institutionId ? String(params.institutionId) : null,
    ),
  )
    .sort({ createdAt: -1 })
    .select('createdAt')
    .lean<{ createdAt: Date } | null>();

  if (!recentRequest?.createdAt) {
    return;
  }

  const nextAllowedAt = new Date(recentRequest.createdAt.getTime() + COLLEGE_HIRING_REQUEST_COOLDOWN_MS);
  throw new ApiError(
    409,
    'COLLEGE_HIRING_REQUEST_COOLDOWN',
    `A hiring request was already sent recently. You can send another on ${formatRequestCooldownDate(nextAllowedAt)}.`,
  );
};

const getMetadataString = (metadata: Record<string, unknown> | undefined, key: string) => {
  const value = metadata?.[key];
  return typeof value === 'string' ? value.trim() : '';
};

const assertAcceptedInviteNotRepeated = async (params: {
  type: RequestType;
  institutionId?: Types.ObjectId | null;
  toUserId?: string;
  recipientEmail?: string;
  targetEntityType: string;
  targetEntityId: string;
  metadata?: Record<string, unknown>;
}) => {
  if (!ACCEPTED_REQUEST_TYPES_BLOCK_REINVITE.has(params.type)) {
    return;
  }

  assertRecipient(params);

  const recipientEmail = normalizeEmail(params.recipientEmail);
  const workspaceId =
    getMetadataString(params.metadata, 'workspaceId') ||
    (params.targetEntityType === 'workspace' ? params.targetEntityId : '');
  const acceptedTypes: RequestType[] =
    workspaceId && ['workspace_member', 'startup_member'].includes(params.type)
      ? ['workspace_member', 'startup_member']
      : [params.type];
  const targetFilters: FilterQuery<IRequest>[] = [
    {
      targetEntityType: params.targetEntityType,
      targetEntityId: params.targetEntityId,
    },
  ];

  if (workspaceId) {
    targetFilters.push({ 'metadata.workspaceId': workspaceId } as FilterQuery<IRequest>);
    targetFilters.push({
      targetEntityType: 'workspace',
      targetEntityId: workspaceId,
    });
  }

  const existingAccepted = await RequestRecord.findOne(
    scopedRequestFilter(
      {
        type: acceptedTypes.length === 1 ? acceptedTypes[0] : { $in: acceptedTypes },
        status: 'accepted',
        ...(params.toUserId ? { toUserId: objectId(params.toUserId) } : { recipientEmail }),
        ...(targetFilters.length === 1 ? targetFilters[0] : { $or: targetFilters }),
      },
      params.institutionId ? String(params.institutionId) : null,
    ),
  )
    .select('_id')
    .lean<{ _id: Types.ObjectId } | null>();

  if (!existingAccepted) {
    return;
  }

  throw new ApiError(
    409,
    'INVITE_ALREADY_ACCEPTED',
    'This invite was already accepted for this user and workspace.',
  );
};

export const createRequest = async (params: {
  type: RequestType;
  actionType?: RequestActionType;
  institutionId?: string | null;
  fromUserId: string;
  toUserId?: string;
  recipientEmail?: string;
  targetEntityType: string;
  targetEntityId: string;
  targetEntityTitle?: string;
  targetRole?: string;
  requestedRole?: string;
  requestedPermission?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  deepLink?: string;
  acceptRedirect?: string;
  declineRedirect?: string;
  expiresAt?: Date;
}) => {
  assertRecipient(params);
  const recipientEmail = normalizeEmail(params.recipientEmail);
  const institutionId = await resolveRequestInstitutionId(params);
  await assertCollegeHiringRequestCooldown({
    ...params,
    institutionId,
    recipientEmail,
  });
  if (params.toUserId && params.toUserId === params.fromUserId && params.metadata?.allowSelfRequest !== true) {
    throw new ApiError(400, 'REQUEST_SELF_RECIPIENT', 'Sender and receiver must be different users.');
  }
  await assertAcceptedInviteNotRepeated({
    ...params,
    institutionId,
    recipientEmail,
  });

  const existing = isCollegeHiringRequestWithCooldown(params)
    ? null
    : await RequestRecord.findOne(
        scopedRequestFilter(
          {
            type: params.type,
            fromUserId: objectId(params.fromUserId),
            ...(params.toUserId ? { toUserId: objectId(params.toUserId) } : { recipientEmail }),
            targetEntityType: params.targetEntityType,
            targetEntityId: params.targetEntityId,
            status: 'pending',
          },
          institutionId ? String(institutionId) : null,
        ),
      );

  if (existing) {
    existing.message = params.message?.trim() ?? existing.message;
    existing.actionType = params.actionType ?? existing.actionType;
    existing.targetRole = params.targetRole ?? existing.targetRole;
    existing.targetEntityTitle = params.targetEntityTitle ?? existing.targetEntityTitle;
    existing.requestedRole = params.requestedRole ?? existing.requestedRole;
    existing.requestedPermission = params.requestedPermission ?? existing.requestedPermission;
    existing.metadata = params.metadata ?? existing.metadata;
    existing.deepLink = params.deepLink ?? existing.deepLink;
    existing.acceptRedirect = params.acceptRedirect ?? existing.acceptRedirect;
    existing.declineRedirect = params.declineRedirect ?? existing.declineRedirect;
    existing.expiresAt = params.expiresAt ?? existing.expiresAt;
    existing.institutionId = institutionId ?? existing.institutionId;
    existing.auditTrail.push({
      status: 'pending',
      actorUserId: objectId(params.fromUserId),
      message: 'Request updated',
      at: new Date(),
    });
    await existing.save();
    await queueRequestNotification(existing);
    return mapRequest(existing);
  }

  const request = await RequestRecord.create({
    institutionId,
    type: params.type,
    actionType: params.actionType,
    fromUserId: objectId(params.fromUserId),
    ...(params.toUserId ? { toUserId: objectId(params.toUserId) } : {}),
    ...(recipientEmail ? { recipientEmail } : {}),
    targetEntityType: params.targetEntityType,
    targetEntityId: params.targetEntityId,
    targetEntityTitle: params.targetEntityTitle,
    targetRole: params.targetRole,
    requestedRole: params.requestedRole ?? params.targetRole,
    requestedPermission: params.requestedPermission,
    message: params.message?.trim() ?? '',
    metadata: params.metadata,
    deepLink: params.deepLink,
    acceptRedirect: params.acceptRedirect,
    declineRedirect: params.declineRedirect,
    expiresAt: params.expiresAt ?? new Date(Date.now() + DEFAULT_REQUEST_TTL_MS),
    auditTrail: [
      {
        status: 'created',
        actorUserId: objectId(params.fromUserId),
        at: new Date(),
      },
    ],
  });

  await queueRequestNotification(request);
  return mapRequest(request);
};

export const listIncomingRequests = async (
  userId: string,
  email: string,
  institutionId?: string | null,
) => {
  await claimEmailRequestsForUser(userId, email, institutionId);
  const filter = requestRecipientFilter(userId, normalizeEmail(email) ?? '');
  await expirePendingRequests(filter);
  const requests = await RequestRecord.find(filter)
    .sort({ status: 1, createdAt: -1 })
    .lean<IRequest[]>();
  return serializeRequests(await removeUnavailableRequests(requests));
};

export const listOutgoingRequests = async (userId: string, institutionId?: string | null) => {
  const filter = { fromUserId: objectId(userId) };
  await expirePendingRequests(filter);
  const requests = await RequestRecord.find(filter)
    .sort({ status: 1, createdAt: -1 })
    .lean<IRequest[]>();
  return serializeRequests(await removeUnavailableRequests(requests));
};

export const getRequestForUser = async (
  requestId: string,
  userId: string,
  email: string,
  institutionId?: string | null,
) => {
  await claimEmailRequestsForUser(userId, email, institutionId);
  const request = await RequestRecord.findOne({
    _id: requestId,
    ...requestVisibilityFilter(userId, normalizeEmail(email) ?? ''),
  }).lean<IRequest | null>();

  if (!request) {
    throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Request not found.');
  }

  const [availableRequest] = await removeUnavailableRequests([request]);
  if (!availableRequest) {
    throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Request is no longer available.');
  }

  return mapRequest(availableRequest);
};

const getActionableRecipientRequest = async (
  requestId: string,
  userId: string,
  email: string,
  institutionId?: string | null,
) => {
  await claimEmailRequestsForUser(userId, email, institutionId);
  const request = await RequestRecord.findOne({
    _id: requestId,
    ...requestRecipientFilter(userId, normalizeEmail(email) ?? ''),
  });

  if (!request) {
    throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Request not found.');
  }

  const [availableRequest] = await removeUnavailableRequests([request]);
  if (!availableRequest) {
    throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Request is no longer available.');
  }

  if (String(request.fromUserId) === userId && request.metadata?.allowSelfAcceptance !== true) {
    throw new ApiError(403, 'REQUEST_SELF_ACCEPT_FORBIDDEN', 'Sender cannot accept their own request.');
  }

  if (request.status !== 'pending') {
    throw new ApiError(400, 'REQUEST_NOT_ACTIONABLE', 'This request is no longer pending.');
  }

  if (request.expiresAt.getTime() <= Date.now()) {
    request.status = 'expired';
    request.respondedAt = new Date();
    request.auditTrail.push({
      status: 'expired',
      actorUserId: objectId(userId),
      at: new Date(),
    });
    await request.save();
    await queueRequestResponseNotification(request, 'expired');
    throw new ApiError(400, 'REQUEST_EXPIRED', 'This request has expired.');
  }

  return request;
};

export const acceptRequest = async (
  requestId: string,
  actorUserId: string,
  actorEmail?: string,
  institutionId?: string | null,
) => {
  const resolvedEmail = await getActorEmail(actorUserId, actorEmail);
  const request = await getActionableRecipientRequest(requestId, actorUserId, resolvedEmail, institutionId);
  const handler = handlers.get(request.type);

  await handler?.validateAccept?.(request, actorUserId);
  await handler?.onAccept?.(request, actorUserId);

  const accepted = await RequestRecord.findOneAndUpdate(
    {
      _id: request._id,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    },
    {
      $set: {
        status: 'accepted',
        respondedAt: new Date(),
        toUserId: objectId(actorUserId),
      },
      $push: {
        auditTrail: {
          status: 'accepted',
          actorUserId: objectId(actorUserId),
          at: new Date(),
        },
      },
    },
    { new: true },
  );

  if (!accepted) {
    throw new ApiError(409, 'REQUEST_STATE_CHANGED', 'This request was already updated.');
  }

  await queueRequestResponseNotification(accepted, 'accepted');
  return mapRequest(accepted);
};

export const declineRequest = async (
  requestId: string,
  actorUserId: string,
  actorEmail?: string,
  institutionId?: string | null,
) => {
  const resolvedEmail = await getActorEmail(actorUserId, actorEmail);
  const request = await getActionableRecipientRequest(requestId, actorUserId, resolvedEmail, institutionId);
  const declined = await RequestRecord.findOneAndUpdate(
    { _id: request._id, status: 'pending' },
    {
      $set: { status: 'declined', respondedAt: new Date(), toUserId: objectId(actorUserId) },
      $push: {
        auditTrail: {
          status: 'declined',
          actorUserId: objectId(actorUserId),
          at: new Date(),
        },
      },
    },
    { new: true },
  );

  if (!declined) {
    throw new ApiError(409, 'REQUEST_STATE_CHANGED', 'This request was already updated.');
  }

  await handlers.get(declined.type)?.onDecline?.(declined, actorUserId);
  await queueRequestResponseNotification(declined, 'declined');
  return mapRequest(declined);
};

export const withdrawRequest = async (
  requestId: string,
  actorUserId: string,
  institutionId?: string | null,
) => {
  const request = await RequestRecord.findOne({ _id: requestId, fromUserId: actorUserId });

  if (!request) {
    throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Request not found.');
  }

  if (request.status !== 'pending') {
    throw new ApiError(400, 'REQUEST_NOT_ACTIONABLE', 'Only pending requests can be withdrawn.');
  }

  request.status = 'withdrawn';
  request.respondedAt = new Date();
  request.auditTrail.push({
    status: 'withdrawn',
    actorUserId: objectId(actorUserId),
    at: new Date(),
  });
  await request.save();
  await handlers.get(request.type)?.onWithdraw?.(request, actorUserId);
  return mapRequest(request);
};

export const createRequestRecord = createRequest;

export const registerRequestAcceptHandler = (
  type: RequestType,
  handler: (params: { request: RequestDocument; actorUserId: string }) => Promise<void>,
) => {
  registerRequestHandler(type, {
    onAccept: (request, actorUserId) => handler({ request, actorUserId }),
  });
};
