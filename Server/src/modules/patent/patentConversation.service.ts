import { z } from 'zod';
import { notificationQueue } from '../../config/bullmq';
import { ApiError } from '../../utils/ApiError';
import { User } from '../user/user.model';
import { UserRole } from '../../types/roles.types';
import { PatentRequest } from './patentRequest.model';
import { PatentConversationMessage } from './patentConversation.model';

// ─── Validation ─────────────────────────────────────────────────────────────

export const sendMessageSchema = z.object({
  message: z.string().trim().min(1).max(5000),
});

export const listMessagesQuerySchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ─── Send message (student or admin) ────────────────────────────────────────

export const sendPatentMessage = async (
  userId: string,
  userRole: string,
  patentRequestId: string,
  payload: z.infer<typeof sendMessageSchema>,
) => {
  const request = await PatentRequest.findById(patentRequestId).lean();
  if (!request) {
    throw new ApiError(404, 'PATENT_REQUEST_NOT_FOUND', 'Patent request not found.');
  }

  // Students can only message on their own requests
  const isStudent = userRole === UserRole.STUDENT;
  const isAdmin = userRole === UserRole.ADMIN;

  if (isStudent && String(request.studentId) !== userId) {
    throw new ApiError(403, 'FORBIDDEN', 'You can only send messages on your own patent requests.');
  }

  if (!isStudent && !isAdmin) {
    throw new ApiError(403, 'FORBIDDEN', 'Only students and admins can send patent messages.');
  }

  const message = await PatentConversationMessage.create({
    patentRequestId,
    senderId: userId,
    senderRole: isAdmin ? 'admin' : 'student',
    message: payload.message,
    sentAt: new Date(),
  });

  // Notify the other party
  const title = request.inventionTitle ?? request.projectTitle ?? 'Patent Request';
  if (isStudent) {
    // Notify assigned admin or all admins
    if (request.adminAssignedTo) {
      await notificationQueue.add('patent-conversation', {
        userId: String(request.adminAssignedTo),
        type: 'patent_message',
        title: 'New patent message',
        body: `Student sent a message on "${title}"`,
        link: '/admin/patents',
      });
    }
  } else {
    // Notify student
    await notificationQueue.add('patent-conversation', {
      userId: String(request.studentId),
      type: 'patent_message',
      title: 'New patent message',
      body: `Admin sent a message on your patent case "${title}"`,
      link: '/startup-launch',
    });
  }

  return message.toObject();
};

// ─── List messages ──────────────────────────────────────────────────────────

export const listPatentMessages = async (
  userId: string,
  userRole: string,
  patentRequestId: string,
  filters: z.infer<typeof listMessagesQuerySchema>,
) => {
  const request = await PatentRequest.findById(patentRequestId).lean();
  if (!request) {
    throw new ApiError(404, 'PATENT_REQUEST_NOT_FOUND', 'Patent request not found.');
  }

  const isStudent = userRole === UserRole.STUDENT;
  const isAdmin = userRole === UserRole.ADMIN;

  if (isStudent && String(request.studentId) !== userId) {
    throw new ApiError(403, 'FORBIDDEN', 'You can only view messages on your own patent requests.');
  }
  if (!isStudent && !isAdmin) {
    throw new ApiError(403, 'FORBIDDEN', 'Only students and admins can view patent messages.');
  }

  const query: Record<string, unknown> = { patentRequestId };
  if (filters.before) {
    query.sentAt = { $lt: new Date(filters.before) };
  }

  const messages = await PatentConversationMessage.find(query)
    .sort({ sentAt: -1 })
    .limit(filters.limit)
    .lean();

  // Populate sender names
  const senderIds = [...new Set(messages.map((m) => String(m.senderId)))];
  const senders = senderIds.length > 0
    ? await User.find({ _id: { $in: senderIds } }).select('_id displayName avatar role').lean()
    : [];
  const senderMap = new Map(senders.map((s) => [String(s._id), s]));

  return messages.map((m) => {
    const sender = senderMap.get(String(m.senderId));
    return {
      _id: String(m._id),
      patentRequestId: String(m.patentRequestId),
      senderId: String(m.senderId),
      senderRole: m.senderRole,
      senderName: sender?.displayName ?? (m.senderRole === 'admin' ? 'Admin' : 'Student'),
      senderAvatar: sender?.avatar,
      message: m.message,
      attachmentUrl: m.attachmentUrl,
      attachmentType: m.attachmentType,
      attachmentName: m.attachmentName,
      readAt: m.readAt?.toISOString(),
      sentAt: m.sentAt.toISOString(),
    };
  });
};

// ─── Mark messages as read ──────────────────────────────────────────────────

export const markPatentMessagesRead = async (
  userId: string,
  userRole: string,
  patentRequestId: string,
) => {
  const request = await PatentRequest.findById(patentRequestId).lean();
  if (!request) {
    throw new ApiError(404, 'PATENT_REQUEST_NOT_FOUND', 'Patent request not found.');
  }

  const isStudent = userRole === UserRole.STUDENT;
  const isAdmin = userRole === UserRole.ADMIN;

  if (isStudent && String(request.studentId) !== userId) {
    throw new ApiError(403, 'FORBIDDEN', 'Access denied.');
  }
  if (!isStudent && !isAdmin) {
    throw new ApiError(403, 'FORBIDDEN', 'Access denied.');
  }

  // Mark messages from the OTHER party as read
  const otherRole = isAdmin ? 'student' : 'admin';
  await PatentConversationMessage.updateMany(
    { patentRequestId, senderRole: otherRole, readAt: null },
    { $set: { readAt: new Date() } },
  );

  return { marked: true };
};

// ─── Unread count ───────────────────────────────────────────────────────────

export const getUnreadCount = async (
  userId: string,
  userRole: string,
  patentRequestId: string,
) => {
  const request = await PatentRequest.findById(patentRequestId).lean();
  if (!request) return { count: 0 };

  const otherRole = userRole === UserRole.ADMIN ? 'student' : 'admin';
  const count = await PatentConversationMessage.countDocuments({
    patentRequestId,
    senderRole: otherRole,
    readAt: null,
  });

  return { count };
};
