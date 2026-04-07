import { FilterQuery, Types } from 'mongoose';
import { notificationQueue } from '../../config/bullmq';
import { ApiError } from '../../utils/ApiError';
import { User } from '../user/user.model';
import {
  IRequest,
  RequestActionType,
  RequestDocument,
  RequestRecord,
  RequestStatus,
  RequestType,
} from './request.model';

const DEFAULT_REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

export const claimEmailRequestsForUser = async (userId: string, email: string) => {
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
};

type RequestView = {
  _id: string;
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

const serializeRequests = async (requests: IRequest[]): Promise<RequestView[]> => {
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
        .select('_id displayName email role')
        .lean<Array<{ _id: Types.ObjectId; displayName: string; email: string; role: string }>>()
    : [];
  const userMap = new Map(
    users.map((user) => [
      String(user._id),
      {
        _id: String(user._id),
        displayName: user.displayName,
        email: user.email,
        role: user.role,
      },
    ]),
  );

  return requests.map((request) => ({
    _id: String(request._id),
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

  await notificationQueue.add('request-created', {
    userId: String(request.toUserId),
    type: 'request',
    title: 'New request',
    body: `${senderName} requested ${requestedAction} for ${entityName}.`,
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

  await notificationQueue.add('request-updated', {
    userId: String(request.fromUserId),
    type: 'request',
    title: `Request ${status}`,
    body: `${actorName} ${status} your request for ${entityName}.`,
    link: '/dashboard/invitations',
    metadata: {
      requestId: String(request._id),
      requestType: request.type,
      actionType: request.actionType,
      targetEntityType: request.targetEntityType,
      targetEntityId: request.targetEntityId,
      targetEntityTitle: request.targetEntityTitle,
      status,
      deepLink: request.deepLink,
    },
  });
};

export const createRequest = async (params: {
  type: RequestType;
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
  message?: string;
  metadata?: Record<string, unknown>;
  deepLink?: string;
  acceptRedirect?: string;
  declineRedirect?: string;
  expiresAt?: Date;
}) => {
  assertRecipient(params);
  const recipientEmail = normalizeEmail(params.recipientEmail);
  if (params.toUserId && params.toUserId === params.fromUserId && params.metadata?.allowSelfRequest !== true) {
    throw new ApiError(400, 'REQUEST_SELF_RECIPIENT', 'Sender and receiver must be different users.');
  }

  const existing = await RequestRecord.findOne({
    type: params.type,
    fromUserId: objectId(params.fromUserId),
    ...(params.toUserId ? { toUserId: objectId(params.toUserId) } : { recipientEmail }),
    targetEntityType: params.targetEntityType,
    targetEntityId: params.targetEntityId,
    status: 'pending',
  });

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

export const listIncomingRequests = async (userId: string, email: string) => {
  await claimEmailRequestsForUser(userId, email);
  const requests = await RequestRecord.find(requestRecipientFilter(userId, normalizeEmail(email) ?? ''))
    .sort({ status: 1, createdAt: -1 })
    .lean<IRequest[]>();
  return serializeRequests(requests);
};

export const listOutgoingRequests = async (userId: string) => {
  const requests = await RequestRecord.find({ fromUserId: objectId(userId) })
    .sort({ status: 1, createdAt: -1 })
    .lean<IRequest[]>();
  return serializeRequests(requests);
};

export const getRequestForUser = async (requestId: string, userId: string, email: string) => {
  await claimEmailRequestsForUser(userId, email);
  const request = await RequestRecord.findOne({
    _id: requestId,
    ...requestVisibilityFilter(userId, normalizeEmail(email) ?? ''),
  }).lean<IRequest | null>();

  if (!request) {
    throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Request not found.');
  }

  return mapRequest(request);
};

const getActionableRecipientRequest = async (requestId: string, userId: string, email: string) => {
  await claimEmailRequestsForUser(userId, email);
  const request = await RequestRecord.findOne({
    _id: requestId,
    ...requestRecipientFilter(userId, normalizeEmail(email) ?? ''),
  });

  if (!request) {
    throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Request not found.');
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

export const acceptRequest = async (requestId: string, actorUserId: string, actorEmail?: string) => {
  const resolvedEmail = await getActorEmail(actorUserId, actorEmail);
  const request = await getActionableRecipientRequest(requestId, actorUserId, resolvedEmail);
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

export const declineRequest = async (requestId: string, actorUserId: string, actorEmail?: string) => {
  const resolvedEmail = await getActorEmail(actorUserId, actorEmail);
  const request = await getActionableRecipientRequest(requestId, actorUserId, resolvedEmail);
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

export const withdrawRequest = async (requestId: string, actorUserId: string) => {
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
