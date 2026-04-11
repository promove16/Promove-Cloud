import { FilterQuery, Types } from 'mongoose';
import { notificationQueue } from '../../config/bullmq';
import { ApiError } from '../../utils/ApiError';
import { UserRole } from '../../types/roles.types';
import { User } from '../user/user.model';
import { Startup } from '../startup/startup.model';
import { approveStartupEditUnlock, buildStartupEditAccess } from '../startup/startup.service';
import type { StartupReviewStatus } from '../startup/startup.types';
import {
  ISupportActivity,
  ISupportAttachment,
  ISupportMessage,
  ISupportTicket,
  SupportActivityType,
  SupportCategory,
  SupportCounter,
  SupportMessageKind,
  SupportPriority,
  SupportStatus,
  SupportTicket,
  SupportTicketDocument,
} from './support.model';
import {
  AddInternalNoteInput,
  AddReplyInput,
  AdminListTicketsQueryInput,
  AssignTicketInput,
  ChangePriorityInput,
  ChangeStatusInput,
  CreateTicketInput,
  EscalateInput,
  FeedbackInput,
  ListTicketsQueryInput,
  StartupEditUnlockInput,
} from './support.validation';

const OVERDUE_HOURS_BY_PRIORITY: Record<SupportPriority, number> = {
  urgent: 4,
  high: 12,
  medium: 24,
  low: 48,
};

const FIRST_RESPONSE_TARGET_HOURS = 8;

const objectId = (value: string) => new Types.ObjectId(value);

const toOptionalObjectId = (value?: string | null) =>
  value && Types.ObjectId.isValid(value) ? objectId(value) : null;

const canUseAdminConsole = (role: string) => role === UserRole.ADMIN;

const assertAdminAccess = (role: string) => {
  if (!canUseAdminConsole(role)) {
    throw new ApiError(403, 'FORBIDDEN', 'Support console is restricted to support staff.');
  }
};

const formatDayKey = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const generateTicketCode = async (createdAt: Date) => {
  const dayKey = formatDayKey(createdAt);
  const counter = await SupportCounter.findOneAndUpdate(
    { _id: dayKey },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return `SUP-${dayKey}-${String(counter.seq).padStart(4, '0')}`;
};

const normaliseAttachments = (
  uploaderId: string,
  input?: CreateTicketInput['attachments'],
): ISupportAttachment[] => {
  if (!input?.length) {
    return [];
  }

  const uploader = objectId(uploaderId);
  return input.map((item) => ({
    url: item.url,
    name: item.name,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    uploadedBy: uploader,
    uploadedAt: new Date(),
  }));
};

type UserSummary = {
  _id: string;
  displayName: string;
  email: string;
  role: string;
};

export type SupportAttachmentView = {
  _id?: string;
  url: string;
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedBy: string;
  uploadedAt: string;
};

export type SupportMessageView = {
  _id?: string;
  kind: SupportMessageKind;
  authorId: string;
  authorRoleSnapshot?: string;
  body: string;
  attachments: SupportAttachmentView[];
  createdAt: string;
  author?: UserSummary;
};

export type SupportActivityView = {
  _id?: string;
  type: SupportActivityType;
  actorUserId?: string;
  fromValue?: string;
  toValue?: string;
  note?: string;
  at: string;
  actor?: UserSummary;
};

export type SupportTicketView = {
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
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  referenceText?: string;
  attachments: SupportAttachmentView[];
  assignedTo?: string | null;
  watchers: string[];
  messages: SupportMessageView[];
  activity: SupportActivityView[];
  firstRespondedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  reopenedCount: number;
  lastActivityAt: string;
  feedback?: {
    rating: number;
    comment?: string;
    submittedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  author?: UserSummary;
  assignee?: UserSummary | null;
  overdue?: boolean;
  relatedStartup?: {
    _id: string;
    name: string;
    reviewStatus: StartupReviewStatus;
    editAccess: {
      isLocked: boolean;
      canEdit: boolean;
      requiresAdminUnlock: boolean;
      unlockedByAdmin: boolean;
      reason: string;
      unlockedAt?: string;
      unlockedBy?: string | null;
      unlockReason?: string;
    };
  };
};

const collectUserIds = (ticket: ISupportTicket) => {
  const ids = new Set<string>();
  ids.add(String(ticket.createdBy));
  if (ticket.assignedTo) {
    ids.add(String(ticket.assignedTo));
  }
  ticket.messages.forEach((message) => ids.add(String(message.authorId)));
  ticket.activity.forEach((entry) => {
    if (entry.actorUserId) {
      ids.add(String(entry.actorUserId));
    }
  });
  return Array.from(ids);
};

const fetchUserSummaries = async (userIds: string[]): Promise<Map<string, UserSummary>> => {
  if (!userIds.length) {
    return new Map();
  }

  const users = await User.find({ _id: { $in: userIds } })
    .select('_id displayName email role')
    .lean<Array<{ _id: Types.ObjectId; displayName: string; email: string; role: string }>>();

  return new Map(
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
};

const serializeAttachments = (items: ISupportAttachment[]): SupportAttachmentView[] =>
  items.map((item) => ({
    _id: item._id ? String(item._id) : undefined,
    url: item.url,
    name: item.name,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    uploadedBy: String(item.uploadedBy),
    uploadedAt: item.uploadedAt.toISOString(),
  }));

const isTicketOverdue = (ticket: ISupportTicket) => {
  if (ticket.status === 'resolved' || ticket.status === 'closed') {
    return false;
  }

  const slaHours = OVERDUE_HOURS_BY_PRIORITY[ticket.priority];
  const deadlineMs = ticket.createdAt.getTime() + slaHours * 60 * 60 * 1000;
  return Date.now() > deadlineMs;
};

const serializeTicket = (ticket: ISupportTicket, users: Map<string, UserSummary>): SupportTicketView => ({
  _id: String(ticket._id),
  ticketCode: ticket.ticketCode,
  createdBy: String(ticket.createdBy),
  institutionId: ticket.institutionId ? String(ticket.institutionId) : null,
  roleSnapshot: ticket.roleSnapshot,
  category: ticket.category,
  title: ticket.title,
  description: ticket.description,
  priority: ticket.priority,
  status: ticket.status,
  relatedEntityType: ticket.relatedEntityType ?? null,
  relatedEntityId: ticket.relatedEntityId ?? null,
  ...(ticket.referenceText ? { referenceText: ticket.referenceText } : {}),
  attachments: serializeAttachments(ticket.attachments ?? []),
  assignedTo: ticket.assignedTo ? String(ticket.assignedTo) : null,
  watchers: (ticket.watchers ?? []).map((watcher) => String(watcher)),
  messages: (ticket.messages ?? []).map((message) => ({
    _id: message._id ? String(message._id) : undefined,
    kind: message.kind,
    authorId: String(message.authorId),
    ...(message.authorRoleSnapshot ? { authorRoleSnapshot: message.authorRoleSnapshot } : {}),
    body: message.body,
    attachments: serializeAttachments(message.attachments ?? []),
    createdAt: message.createdAt.toISOString(),
    ...(users.get(String(message.authorId)) ? { author: users.get(String(message.authorId)) } : {}),
  })),
  activity: (ticket.activity ?? []).map((entry) => ({
    _id: entry._id ? String(entry._id) : undefined,
    type: entry.type,
    ...(entry.actorUserId ? { actorUserId: String(entry.actorUserId) } : {}),
    ...(entry.fromValue ? { fromValue: entry.fromValue } : {}),
    ...(entry.toValue ? { toValue: entry.toValue } : {}),
    ...(entry.note ? { note: entry.note } : {}),
    at: entry.at.toISOString(),
    ...(entry.actorUserId && users.get(String(entry.actorUserId))
      ? { actor: users.get(String(entry.actorUserId)) }
      : {}),
  })),
  firstRespondedAt: ticket.firstRespondedAt ? ticket.firstRespondedAt.toISOString() : null,
  resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null,
  closedAt: ticket.closedAt ? ticket.closedAt.toISOString() : null,
  reopenedCount: ticket.reopenedCount ?? 0,
  lastActivityAt: ticket.lastActivityAt.toISOString(),
  feedback: ticket.feedback
    ? {
        rating: ticket.feedback.rating,
        ...(ticket.feedback.comment ? { comment: ticket.feedback.comment } : {}),
        submittedAt: ticket.feedback.submittedAt.toISOString(),
      }
    : null,
  createdAt: ticket.createdAt.toISOString(),
  updatedAt: ticket.updatedAt.toISOString(),
  ...(users.get(String(ticket.createdBy)) ? { author: users.get(String(ticket.createdBy)) } : {}),
  assignee: ticket.assignedTo ? users.get(String(ticket.assignedTo)) ?? null : null,
  overdue: isTicketOverdue(ticket),
});

const filterPublicMessages = (view: SupportTicketView, viewerId: string, viewerRole: string): SupportTicketView => {
  if (canUseAdminConsole(viewerRole)) {
    return view;
  }

  if (String(view.createdBy) !== viewerId) {
    return { ...view, messages: view.messages.filter((message) => message.kind !== 'internal_note') };
  }

  return { ...view, messages: view.messages.filter((message) => message.kind !== 'internal_note') };
};

const hydrateTicketView = async (
  ticket: ISupportTicket,
  viewer: { userId: string; role: string },
): Promise<SupportTicketView> => {
  const userIds = collectUserIds(ticket);
  const users = await fetchUserSummaries(userIds);
  const view = serializeTicket(ticket, users);

  if (
    ticket.relatedEntityType === 'startup' &&
    ticket.relatedEntityId &&
    Types.ObjectId.isValid(ticket.relatedEntityId)
  ) {
    const relatedStartup = await Startup.findById(ticket.relatedEntityId)
      .select(
        '_id name reviewStatus adminEditUnlockActive adminEditUnlockApprovedAt adminEditUnlockApprovedBy adminEditUnlockReason isActive',
      )
      .lean<{
        _id: Types.ObjectId;
        name: string;
        reviewStatus: StartupReviewStatus;
        adminEditUnlockActive: boolean;
        adminEditUnlockApprovedAt?: Date;
        adminEditUnlockApprovedBy?: Types.ObjectId | null;
        adminEditUnlockReason?: string;
        isActive: boolean;
      } | null>();

    if (relatedStartup?.isActive) {
      const editAccess = buildStartupEditAccess(relatedStartup);
      view.relatedStartup = {
        _id: String(relatedStartup._id),
        name: relatedStartup.name,
        reviewStatus: relatedStartup.reviewStatus,
        editAccess: {
          isLocked: editAccess.isLocked,
          canEdit: editAccess.canEdit,
          requiresAdminUnlock: editAccess.requiresAdminUnlock,
          unlockedByAdmin: editAccess.unlockedByAdmin,
          reason: editAccess.reason,
          ...(editAccess.unlockedAt ? { unlockedAt: editAccess.unlockedAt.toISOString() } : {}),
          ...(editAccess.unlockedBy ? { unlockedBy: String(editAccess.unlockedBy) } : {}),
          ...(editAccess.unlockReason ? { unlockReason: editAccess.unlockReason } : {}),
        },
      };
    }
  }

  return filterPublicMessages(view, viewer.userId, viewer.role);
};

const hydrateTicketList = async (
  tickets: ISupportTicket[],
  viewer: { userId: string; role: string },
): Promise<SupportTicketView[]> => {
  if (!tickets.length) {
    return [];
  }

  const userIds = Array.from(new Set(tickets.flatMap(collectUserIds)));
  const users = await fetchUserSummaries(userIds);
  return tickets.map((ticket) => filterPublicMessages(serializeTicket(ticket, users), viewer.userId, viewer.role));
};

const queueNotification = async (params: {
  userId: string;
  title: string;
  body: string;
  ticketId: string;
  ticketCode: string;
  link: string;
  extra?: Record<string, unknown>;
}) => {
  if (!params.userId) {
    return;
  }

  await notificationQueue.add('support-notification', {
    userId: params.userId,
    type: 'support',
    title: params.title,
    body: params.body,
    link: params.link,
    metadata: {
      ticketId: params.ticketId,
      ticketCode: params.ticketCode,
      ...(params.extra ?? {}),
    },
  });
};

const adminDashboardLink = (ticketId: string) => `/dashboard/admin/help-desk/${ticketId}`;
const userDashboardLink = (ticketId: string) => `/dashboard/help-desk/${ticketId}`;

const pushActivity = (
  ticket: SupportTicketDocument,
  entry: Omit<ISupportActivity, 'at'> & { at?: Date },
) => {
  ticket.activity.push({
    ...entry,
    at: entry.at ?? new Date(),
  });
  ticket.lastActivityAt = new Date();
};

const notifyAssignedAdmin = async (ticket: SupportTicketDocument) => {
  if (!ticket.assignedTo) {
    return;
  }

  await queueNotification({
    userId: String(ticket.assignedTo),
    title: `New support ticket ${ticket.ticketCode}`,
    body: `${ticket.title} (${ticket.priority})`,
    ticketId: String(ticket._id),
    ticketCode: ticket.ticketCode,
    link: adminDashboardLink(String(ticket._id)),
  });
};

const resolveAdminRecipients = async (ticket: SupportTicketDocument): Promise<string[]> => {
  if (ticket.assignedTo) {
    return [String(ticket.assignedTo)];
  }

  const admins = await User.find({ role: UserRole.ADMIN, isActive: true })
    .select('_id')
    .limit(10)
    .lean<Array<{ _id: Types.ObjectId }>>();

  return admins.map((admin) => String(admin._id));
};

export const createTicket = async (params: {
  userId: string;
  userRole: string;
  institutionId?: string | null;
  payload: CreateTicketInput;
}) => {
  const createdAt = new Date();
  const ticketCode = await generateTicketCode(createdAt);
  const institutionObjectId = toOptionalObjectId(params.institutionId ?? null);

  const ticket = await SupportTicket.create({
    ticketCode,
    createdBy: objectId(params.userId),
    institutionId: institutionObjectId,
    roleSnapshot: params.userRole,
    category: params.payload.category,
    title: params.payload.title.trim(),
    description: params.payload.description.trim(),
    priority: params.payload.priority ?? 'medium',
    status: 'open',
    relatedEntityType: params.payload.relatedEntityType ?? null,
    relatedEntityId: params.payload.relatedEntityId ?? null,
    referenceText: params.payload.referenceText,
    attachments: normaliseAttachments(params.userId, params.payload.attachments),
    activity: [
      {
        type: 'created',
        actorUserId: objectId(params.userId),
        toValue: 'open',
        at: createdAt,
      },
    ],
    lastActivityAt: createdAt,
  });

  const recipients = await resolveAdminRecipients(ticket);
  await Promise.all(
    recipients.map((adminUserId) =>
      queueNotification({
        userId: adminUserId,
        title: `New support ticket ${ticket.ticketCode}`,
        body: `${ticket.title} (${ticket.priority})`,
        ticketId: String(ticket._id),
        ticketCode: ticket.ticketCode,
        link: adminDashboardLink(String(ticket._id)),
        extra: { event: 'created' },
      }),
    ),
  );

  return hydrateTicketView(ticket.toObject() as ISupportTicket, {
    userId: params.userId,
    role: params.userRole,
  });
};

export const listUserTickets = async (
  userId: string,
  userRole: string,
  filters: ListTicketsQueryInput,
) => {
  const query: FilterQuery<ISupportTicket> = { createdBy: objectId(userId) };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.category) {
    query.category = filters.category;
  }

  if (filters.priority) {
    query.priority = filters.priority;
  }

  if (filters.search) {
    const regex = new RegExp(filters.search.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
    query.$or = [{ ticketCode: regex }, { title: regex }, { description: regex }];
  }

  const tickets = await SupportTicket.find(query)
    .sort({ lastActivityAt: -1 })
    .limit(200)
    .lean<ISupportTicket[]>();

  return hydrateTicketList(tickets, { userId, role: userRole });
};

const loadTicketForViewer = async (
  ticketId: string,
  userId: string,
  role: string,
): Promise<SupportTicketDocument> => {
  if (!Types.ObjectId.isValid(ticketId)) {
    throw new ApiError(400, 'SUPPORT_TICKET_INVALID_ID', 'Ticket id is invalid.');
  }

  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) {
    throw new ApiError(404, 'SUPPORT_TICKET_NOT_FOUND', 'Support ticket not found.');
  }

  if (!canUseAdminConsole(role) && String(ticket.createdBy) !== userId) {
    throw new ApiError(404, 'SUPPORT_TICKET_NOT_FOUND', 'Support ticket not found.');
  }

  return ticket;
};

export const getTicketForViewer = async (
  ticketId: string,
  viewer: { userId: string; role: string },
) => {
  const ticket = await loadTicketForViewer(ticketId, viewer.userId, viewer.role);
  return hydrateTicketView(ticket.toObject() as ISupportTicket, viewer);
};

const recordFirstResponse = (ticket: SupportTicketDocument, actorRole: string) => {
  if (!ticket.firstRespondedAt && canUseAdminConsole(actorRole)) {
    ticket.firstRespondedAt = new Date();
  }
};

export const addUserReply = async (params: {
  ticketId: string;
  userId: string;
  userRole: string;
  payload: AddReplyInput;
}) => {
  const ticket = await loadTicketForViewer(params.ticketId, params.userId, params.userRole);

  if (String(ticket.createdBy) !== params.userId) {
    throw new ApiError(403, 'SUPPORT_TICKET_FORBIDDEN', 'Only the author can reply as the user.');
  }

  if (ticket.status === 'closed') {
    throw new ApiError(400, 'SUPPORT_TICKET_CLOSED', 'Reopen the ticket before replying.');
  }

  const message: ISupportMessage = {
    kind: 'user_reply',
    authorId: objectId(params.userId),
    authorRoleSnapshot: params.userRole,
    body: params.payload.body.trim(),
    attachments: normaliseAttachments(params.userId, params.payload.attachments),
    createdAt: new Date(),
  };

  ticket.messages.push(message);
  ticket.lastActivityAt = new Date();

  if (ticket.status === 'resolved') {
    ticket.status = 'open';
    ticket.reopenedCount += 1;
    pushActivity(ticket, {
      type: 'reopened',
      actorUserId: objectId(params.userId),
      fromValue: 'resolved',
      toValue: 'open',
    });
  }

  await ticket.save();

  const adminRecipients = await resolveAdminRecipients(ticket);
  await Promise.all(
    adminRecipients.map((adminUserId) =>
      queueNotification({
        userId: adminUserId,
        title: `Update on ${ticket.ticketCode}`,
        body: `New user reply on ${ticket.title}`,
        ticketId: String(ticket._id),
        ticketCode: ticket.ticketCode,
        link: adminDashboardLink(String(ticket._id)),
        extra: { event: 'user_reply' },
      }),
    ),
  );

  return hydrateTicketView(ticket.toObject() as ISupportTicket, {
    userId: params.userId,
    role: params.userRole,
  });
};

export const reopenTicket = async (params: {
  ticketId: string;
  userId: string;
  userRole: string;
  note?: string;
}) => {
  const ticket = await loadTicketForViewer(params.ticketId, params.userId, params.userRole);

  if (String(ticket.createdBy) !== params.userId && !canUseAdminConsole(params.userRole)) {
    throw new ApiError(403, 'SUPPORT_TICKET_FORBIDDEN', 'Only the author or an admin can reopen.');
  }

  if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
    throw new ApiError(400, 'SUPPORT_TICKET_NOT_RESOLVED', 'Only resolved or closed tickets can be reopened.');
  }

  const previousStatus: SupportStatus = ticket.status;
  ticket.status = 'open';
  ticket.resolvedAt = null;
  ticket.closedAt = null;
  ticket.reopenedCount += 1;
  pushActivity(ticket, {
    type: 'reopened',
    actorUserId: objectId(params.userId),
    fromValue: previousStatus,
    toValue: 'open',
    note: params.note,
  });

  await ticket.save();

  const adminRecipients = await resolveAdminRecipients(ticket);
  await Promise.all(
    adminRecipients.map((adminUserId) =>
      queueNotification({
        userId: adminUserId,
        title: `Ticket ${ticket.ticketCode} reopened`,
        body: ticket.title,
        ticketId: String(ticket._id),
        ticketCode: ticket.ticketCode,
        link: adminDashboardLink(String(ticket._id)),
        extra: { event: 'reopened' },
      }),
    ),
  );

  return hydrateTicketView(ticket.toObject() as ISupportTicket, {
    userId: params.userId,
    role: params.userRole,
  });
};

export const submitFeedback = async (params: {
  ticketId: string;
  userId: string;
  userRole: string;
  payload: FeedbackInput;
}) => {
  const ticket = await loadTicketForViewer(params.ticketId, params.userId, params.userRole);

  if (String(ticket.createdBy) !== params.userId) {
    throw new ApiError(403, 'SUPPORT_TICKET_FORBIDDEN', 'Only the author can submit feedback.');
  }

  if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
    throw new ApiError(400, 'SUPPORT_TICKET_NOT_RESOLVED', 'Feedback can only be left after resolution.');
  }

  ticket.feedback = {
    rating: params.payload.rating,
    comment: params.payload.comment,
    submittedAt: new Date(),
  };

  pushActivity(ticket, {
    type: 'feedback_submitted',
    actorUserId: objectId(params.userId),
    toValue: String(params.payload.rating),
  });

  await ticket.save();
  return hydrateTicketView(ticket.toObject() as ISupportTicket, {
    userId: params.userId,
    role: params.userRole,
  });
};

export const adminListTickets = async (
  adminUserId: string,
  adminRole: string,
  filters: AdminListTicketsQueryInput,
) => {
  assertAdminAccess(adminRole);

  const query: FilterQuery<ISupportTicket> = {};

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.category) {
    query.category = filters.category;
  }

  if (filters.priority) {
    query.priority = filters.priority;
  }

  if (filters.assignedTo) {
    query.assignedTo = objectId(filters.assignedTo);
  }

  if (filters.search) {
    const regex = new RegExp(filters.search.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
    query.$or = [{ ticketCode: regex }, { title: regex }, { description: regex }];
  }

  const tickets = await SupportTicket.find(query)
    .sort({ status: 1, lastActivityAt: -1 })
    .limit(400)
    .lean<ISupportTicket[]>();

  const filtered = filters.overdue
    ? tickets.filter((ticket) => isTicketOverdue(ticket))
    : tickets;

  return hydrateTicketList(filtered, { userId: adminUserId, role: adminRole });
};

export const adminAssignTicket = async (params: {
  ticketId: string;
  actorUserId: string;
  actorRole: string;
  payload: AssignTicketInput;
}) => {
  assertAdminAccess(params.actorRole);
  const ticket = await loadTicketForViewer(params.ticketId, params.actorUserId, params.actorRole);

  if (params.payload.assignedTo) {
    const assignee = await User.findById(params.payload.assignedTo).select('_id role').lean();
    if (!assignee || !canUseAdminConsole(assignee.role)) {
      throw new ApiError(400, 'SUPPORT_TICKET_INVALID_ASSIGNEE', 'Assignee must be support staff.');
    }
  }

  const previousAssignee = ticket.assignedTo ? String(ticket.assignedTo) : null;
  ticket.assignedTo = params.payload.assignedTo ? objectId(params.payload.assignedTo) : null;

  pushActivity(ticket, {
    type: 'assigned',
    actorUserId: objectId(params.actorUserId),
    fromValue: previousAssignee ?? undefined,
    toValue: params.payload.assignedTo ?? 'unassigned',
  });

  await ticket.save();

  if (ticket.assignedTo) {
    await notifyAssignedAdmin(ticket);
  }

  return hydrateTicketView(ticket.toObject() as ISupportTicket, {
    userId: params.actorUserId,
    role: params.actorRole,
  });
};

export const adminChangeStatus = async (params: {
  ticketId: string;
  actorUserId: string;
  actorRole: string;
  payload: ChangeStatusInput;
}) => {
  assertAdminAccess(params.actorRole);
  const ticket = await loadTicketForViewer(params.ticketId, params.actorUserId, params.actorRole);
  const previousStatus: SupportStatus = ticket.status;

  if (previousStatus === params.payload.status) {
    return hydrateTicketView(ticket.toObject() as ISupportTicket, {
      userId: params.actorUserId,
      role: params.actorRole,
    });
  }

  ticket.status = params.payload.status;

  if (params.payload.status === 'resolved') {
    ticket.resolvedAt = new Date();
    ticket.closedAt = null;
  } else if (params.payload.status === 'closed') {
    ticket.closedAt = new Date();
    if (!ticket.resolvedAt) {
      ticket.resolvedAt = ticket.closedAt;
    }
  } else if (params.payload.status === 'open' || params.payload.status === 'in_progress') {
    if (previousStatus === 'resolved' || previousStatus === 'closed') {
      ticket.reopenedCount += 1;
    }
    if (params.payload.status === 'open') {
      ticket.resolvedAt = null;
      ticket.closedAt = null;
    }
  }

  pushActivity(ticket, {
    type: previousStatus === 'resolved' || previousStatus === 'closed' ? 'reopened' : 'status_changed',
    actorUserId: objectId(params.actorUserId),
    fromValue: previousStatus,
    toValue: params.payload.status,
    note: params.payload.note,
  });

  await ticket.save();

  await queueNotification({
    userId: String(ticket.createdBy),
    title: `Ticket ${ticket.ticketCode} ${params.payload.status}`,
    body: ticket.title,
    ticketId: String(ticket._id),
    ticketCode: ticket.ticketCode,
    link: userDashboardLink(String(ticket._id)),
    extra: { event: 'status_changed', status: params.payload.status },
  });

  return hydrateTicketView(ticket.toObject() as ISupportTicket, {
    userId: params.actorUserId,
    role: params.actorRole,
  });
};

export const adminChangePriority = async (params: {
  ticketId: string;
  actorUserId: string;
  actorRole: string;
  payload: ChangePriorityInput;
}) => {
  assertAdminAccess(params.actorRole);
  const ticket = await loadTicketForViewer(params.ticketId, params.actorUserId, params.actorRole);
  const previous = ticket.priority;
  ticket.priority = params.payload.priority;
  pushActivity(ticket, {
    type: 'priority_changed',
    actorUserId: objectId(params.actorUserId),
    fromValue: previous,
    toValue: params.payload.priority,
    note: params.payload.note,
  });
  await ticket.save();
  return hydrateTicketView(ticket.toObject() as ISupportTicket, {
    userId: params.actorUserId,
    role: params.actorRole,
  });
};

export const adminAddInternalNote = async (params: {
  ticketId: string;
  actorUserId: string;
  actorRole: string;
  payload: AddInternalNoteInput;
}) => {
  assertAdminAccess(params.actorRole);
  const ticket = await loadTicketForViewer(params.ticketId, params.actorUserId, params.actorRole);

  const note: ISupportMessage = {
    kind: 'internal_note',
    authorId: objectId(params.actorUserId),
    authorRoleSnapshot: params.actorRole,
    body: params.payload.body.trim(),
    attachments: [],
    createdAt: new Date(),
  };

  ticket.messages.push(note);
  ticket.lastActivityAt = new Date();
  await ticket.save();
  return hydrateTicketView(ticket.toObject() as ISupportTicket, {
    userId: params.actorUserId,
    role: params.actorRole,
  });
};

export const adminAddReply = async (params: {
  ticketId: string;
  actorUserId: string;
  actorRole: string;
  payload: AddReplyInput;
}) => {
  assertAdminAccess(params.actorRole);
  const ticket = await loadTicketForViewer(params.ticketId, params.actorUserId, params.actorRole);

  const message: ISupportMessage = {
    kind: 'admin_reply',
    authorId: objectId(params.actorUserId),
    authorRoleSnapshot: params.actorRole,
    body: params.payload.body.trim(),
    attachments: normaliseAttachments(params.actorUserId, params.payload.attachments),
    createdAt: new Date(),
  };

  ticket.messages.push(message);
  ticket.lastActivityAt = new Date();
  recordFirstResponse(ticket, params.actorRole);
  if (ticket.status === 'open') {
    ticket.status = 'in_progress';
    pushActivity(ticket, {
      type: 'status_changed',
      actorUserId: objectId(params.actorUserId),
      fromValue: 'open',
      toValue: 'in_progress',
    });
  }

  await ticket.save();

  await queueNotification({
    userId: String(ticket.createdBy),
    title: `Support replied on ${ticket.ticketCode}`,
    body: ticket.title,
    ticketId: String(ticket._id),
    ticketCode: ticket.ticketCode,
    link: userDashboardLink(String(ticket._id)),
    extra: { event: 'admin_reply' },
  });

  return hydrateTicketView(ticket.toObject() as ISupportTicket, {
    userId: params.actorUserId,
    role: params.actorRole,
  });
};

export const adminEscalateTicket = async (params: {
  ticketId: string;
  actorUserId: string;
  actorRole: string;
  payload: EscalateInput;
}) => {
  assertAdminAccess(params.actorRole);
  const ticket = await loadTicketForViewer(params.ticketId, params.actorUserId, params.actorRole);
  if (ticket.priority !== 'urgent') {
    ticket.priority = 'urgent';
  }
  pushActivity(ticket, {
    type: 'escalated',
    actorUserId: objectId(params.actorUserId),
    note: params.payload.note,
    toValue: 'urgent',
  });
  await ticket.save();
  return hydrateTicketView(ticket.toObject() as ISupportTicket, {
    userId: params.actorUserId,
    role: params.actorRole,
  });
};

export const adminApproveStartupEditUnlock = async (params: {
  ticketId: string;
  actorUserId: string;
  actorRole: string;
  payload: StartupEditUnlockInput;
}) => {
  assertAdminAccess(params.actorRole);
  const ticket = await loadTicketForViewer(params.ticketId, params.actorUserId, params.actorRole);

  if (ticket.relatedEntityType !== 'startup' || !ticket.relatedEntityId || !Types.ObjectId.isValid(ticket.relatedEntityId)) {
    throw new ApiError(
      400,
      'SUPPORT_TICKET_NOT_STARTUP_UNLOCKABLE',
      'This ticket is not linked to a startup edit lock request.',
    );
  }

  const startup = await Startup.findById(ticket.relatedEntityId)
    .select('_id name founderIds teamMemberIds isActive')
    .lean<{
      _id: Types.ObjectId;
      name: string;
      founderIds: Types.ObjectId[];
      teamMemberIds: Types.ObjectId[];
      isActive: boolean;
    } | null>();

  if (!startup?.isActive) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found.');
  }

  const requesterHasStartupAccess =
    startup.founderIds.some((founderId) => String(founderId) === String(ticket.createdBy)) ||
    startup.teamMemberIds.some((memberId) => String(memberId) === String(ticket.createdBy));

  if (!requesterHasStartupAccess) {
    throw new ApiError(
      403,
      'SUPPORT_TICKET_FORBIDDEN',
      'Only startup founders or team members can request an edit unlock for this startup.',
    );
  }

  await approveStartupEditUnlock(params.actorUserId, ticket.relatedEntityId, {
    reason: params.payload.note,
    sourceTicketId: String(ticket._id),
  });

  const previousStatus: SupportStatus = ticket.status;
  const unlockMessage =
    `Startup edit unlock approved for ${startup.name}. You can now update the startup and submit it again for review.`;

  ticket.messages.push({
    kind: 'admin_reply',
    authorId: objectId(params.actorUserId),
    authorRoleSnapshot: params.actorRole,
    body: params.payload.note?.trim()
      ? `${unlockMessage}\n\nAdmin note: ${params.payload.note.trim()}`
      : unlockMessage,
    attachments: [],
    createdAt: new Date(),
  });
  recordFirstResponse(ticket, params.actorRole);
  ticket.status = 'resolved';
  ticket.resolvedAt = new Date();
  ticket.closedAt = null;
  pushActivity(ticket, {
    type: 'status_changed',
    actorUserId: objectId(params.actorUserId),
    fromValue: previousStatus,
    toValue: 'resolved',
    note: unlockMessage,
  });

  await ticket.save();

  await queueNotification({
    userId: String(ticket.createdBy),
    title: `Startup edit unlock approved for ${startup.name}`,
    body: 'You can update the startup now and resubmit it for review.',
    ticketId: String(ticket._id),
    ticketCode: ticket.ticketCode,
    link: userDashboardLink(String(ticket._id)),
    extra: {
      event: 'startup_edit_unlock',
      startupId: String(startup._id),
    },
  });

  return hydrateTicketView(ticket.toObject() as ISupportTicket, {
    userId: params.actorUserId,
    role: params.actorRole,
  });
};

export type SupportAnalyticsSummary = {
  open: number;
  inProgress: number;
  resolvedToday: number;
  overdue: number;
  avgFirstResponseHours: number | null;
  avgResolutionHours: number | null;
  byCategory: Record<SupportCategory, number>;
  byPriority: Record<SupportPriority, number>;
};

const emptyCategoryCounts = (): Record<SupportCategory, number> => ({
  access_login: 0,
  workspace_collaboration: 0,
  startup_patent: 0,
  marketplace_applications: 0,
  institution_operations: 0,
  deals_payments: 0,
  account_profile: 0,
  other: 0,
});

const emptyPriorityCounts = (): Record<SupportPriority, number> => ({
  low: 0,
  medium: 0,
  high: 0,
  urgent: 0,
});

export const adminAnalytics = async (actorRole: string): Promise<SupportAnalyticsSummary> => {
  assertAdminAccess(actorRole);
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [tickets] = await Promise.all([
    SupportTicket.find({}, {
      status: 1,
      priority: 1,
      category: 1,
      createdAt: 1,
      resolvedAt: 1,
      firstRespondedAt: 1,
    })
      .limit(5000)
      .lean<ISupportTicket[]>(),
  ]);

  const summary: SupportAnalyticsSummary = {
    open: 0,
    inProgress: 0,
    resolvedToday: 0,
    overdue: 0,
    avgFirstResponseHours: null,
    avgResolutionHours: null,
    byCategory: emptyCategoryCounts(),
    byPriority: emptyPriorityCounts(),
  };

  const firstResponseDurations: number[] = [];
  const resolutionDurations: number[] = [];

  tickets.forEach((ticket) => {
    summary.byCategory[ticket.category] = (summary.byCategory[ticket.category] ?? 0) + 1;
    summary.byPriority[ticket.priority] = (summary.byPriority[ticket.priority] ?? 0) + 1;

    if (ticket.status === 'open') {
      summary.open += 1;
    }
    if (ticket.status === 'in_progress') {
      summary.inProgress += 1;
    }
    if (ticket.status === 'resolved' && ticket.resolvedAt && ticket.resolvedAt >= startOfDay) {
      summary.resolvedToday += 1;
    }
    if (isTicketOverdue(ticket)) {
      summary.overdue += 1;
    }
    if (ticket.firstRespondedAt) {
      firstResponseDurations.push(
        (ticket.firstRespondedAt.getTime() - ticket.createdAt.getTime()) / (60 * 60 * 1000),
      );
    }
    if (ticket.resolvedAt) {
      resolutionDurations.push(
        (ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / (60 * 60 * 1000),
      );
    }
  });

  const average = (values: number[]) =>
    values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null;

  summary.avgFirstResponseHours = average(firstResponseDurations);
  summary.avgResolutionHours = average(resolutionDurations);

  return summary;
};

export const supportInternals = {
  FIRST_RESPONSE_TARGET_HOURS,
  OVERDUE_HOURS_BY_PRIORITY,
  isTicketOverdue,
};
