import { Server } from 'socket.io';
import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Workspace } from '../modules/workspace/workspace.model';
import { ChatMessage } from '../modules/chat/chat.model';
import type { ChatAttachmentType, IChatMessage } from '../modules/chat/chat.types';

const canAccessWorkspace = async (workspaceId: string, userId: string) =>
  Workspace.exists({
    _id: workspaceId,
    $or: [
      { ownerId: userId },
      { teamMemberIds: userId },
      { 'chatParticipants.userId': userId },
    ],
  });

const canPostWorkspaceChat = async (workspaceId: string, userId: string) =>
  Workspace.exists({
    _id: workspaceId,
    $or: [
      { ownerId: userId },
      { teamMemberIds: userId },
      { 'chatParticipants.userId': userId },
    ],
  });

const ALLOWED_ATTACHMENT_TYPES = new Set<ChatAttachmentType>([
  'pdf',
  'image',
  'doc',
  'ppt',
  'xls',
  'video',
  'audio',
  'other',
]);

const HIGH_CONFIDENCE_SECRET_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, message: 'Private keys are not allowed in chat code snippets.' },
  { pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/, message: 'GitHub tokens are not allowed in chat code snippets.' },
  { pattern: /github_pat_[A-Za-z0-9_]{20,}/, message: 'GitHub personal access tokens are not allowed in chat code snippets.' },
  { pattern: /AKIA[0-9A-Z]{16}/, message: 'AWS access keys are not allowed in chat code snippets.' },
  { pattern: /AIza[0-9A-Za-z\-_]{35}/, message: 'Google API keys are not allowed in chat code snippets.' },
  { pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/, message: 'Slack tokens are not allowed in chat code snippets.' },
  { pattern: /mongodb(?:\+srv)?:\/\/[^/\s:@]+:[^/\s@]+@/i, message: 'Database credentials are not allowed in chat code snippets.' },
];

// userId -> Set of socketIds for online presence
const onlineUsers = new Map<string, Set<string>>();

const serializeDate = (value?: Date) => (value ? value.toISOString() : undefined);

const countLines = (value: string) => value.split(/\r\n|\r|\n/).length;

const normalizeCodeSnippet = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const snippet = value as {
    title?: string;
    language?: string;
    code?: string;
  };

  const title = typeof snippet.title === 'string' ? snippet.title.trim() : '';
  const language = typeof snippet.language === 'string' ? snippet.language.trim() : '';
  const code = typeof snippet.code === 'string' ? snippet.code.trim() : '';

  if (!title && !language && !code) {
    return undefined;
  }

  if (title.length < 2 || title.length > 120) {
    throw new Error('Code title must be between 2 and 120 characters');
  }

  if (language.length < 1 || language.length > 60) {
    throw new Error('Code language is required');
  }

  if (code.length < 10 || code.length > 8000) {
    throw new Error('Code snippet must be between 10 and 8000 characters');
  }

  for (const rule of HIGH_CONFIDENCE_SECRET_PATTERNS) {
    if (rule.pattern.test(code)) {
      throw new Error(rule.message);
    }
  }

  const lineCount = countLines(code);
  if (lineCount > 500) {
    throw new Error('Code snippets are limited to 500 lines');
  }

  return { title, language, code, lineCount };
};

const normalizeAttachment = (payload: {
  attachmentUrl?: unknown;
  attachmentType?: unknown;
  attachmentName?: unknown;
  attachmentSizeBytes?: unknown;
  attachmentMimeType?: unknown;
}) => {
  const attachmentUrl = typeof payload.attachmentUrl === 'string' ? payload.attachmentUrl.trim() : '';
  if (!attachmentUrl) {
    return undefined;
  }

  try {
    const parsed = new URL(attachmentUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Attachment URLs must use HTTP or HTTPS');
    }
  } catch {
    throw new Error('Attachment URL is invalid');
  }

  const attachmentType =
    typeof payload.attachmentType === 'string' &&
    ALLOWED_ATTACHMENT_TYPES.has(payload.attachmentType as ChatAttachmentType)
      ? (payload.attachmentType as ChatAttachmentType)
      : undefined;

  if (!attachmentType) {
    throw new Error('Attachment type is invalid');
  }

  const attachmentName = typeof payload.attachmentName === 'string' ? payload.attachmentName.trim() : '';
  if (!attachmentName || attachmentName.length > 180) {
    throw new Error('Attachment name is required');
  }

  const attachmentSizeBytes =
    typeof payload.attachmentSizeBytes === 'number' && Number.isFinite(payload.attachmentSizeBytes)
      ? payload.attachmentSizeBytes
      : 0;

  const attachmentMimeType =
    typeof payload.attachmentMimeType === 'string' ? payload.attachmentMimeType.trim() : undefined;

  return {
    attachmentUrl,
    attachmentType,
    attachmentName,
    attachmentSizeBytes: Math.max(0, attachmentSizeBytes),
    attachmentMimeType: attachmentMimeType || undefined,
  };
};

const serializeChatMessage = (message: Partial<IChatMessage> & Record<string, unknown>) => ({
  _id: String(message._id),
  workspaceId: String(message.workspaceId),
  senderId: String(message.senderId),
  message: typeof message.message === 'string' ? message.message : '',
  ...(message.attachmentUrl
    ? {
        attachmentUrl: String(message.attachmentUrl),
        attachmentType: message.attachmentType as IChatMessage['attachmentType'],
        attachmentName: typeof message.attachmentName === 'string' ? message.attachmentName : undefined,
        attachmentSizeBytes:
          typeof message.attachmentSizeBytes === 'number' ? message.attachmentSizeBytes : undefined,
        attachmentMimeType:
          typeof message.attachmentMimeType === 'string' ? message.attachmentMimeType : undefined,
        attachment: {
          fileUrl: String(message.attachmentUrl),
          fileType: message.attachmentType as IChatMessage['attachmentType'],
          fileName:
            typeof message.attachmentName === 'string' ? message.attachmentName : 'Attachment',
          fileSizeBytes:
            typeof message.attachmentSizeBytes === 'number' ? message.attachmentSizeBytes : 0,
          ...(typeof message.attachmentMimeType === 'string'
            ? { mimeType: message.attachmentMimeType }
            : {}),
        },
      }
    : {}),
  ...(message.codeSnippet && typeof message.codeSnippet === 'object'
    ? {
        codeSnippet: {
          title: String((message.codeSnippet as Record<string, unknown>).title ?? ''),
          language: String((message.codeSnippet as Record<string, unknown>).language ?? ''),
          code: String((message.codeSnippet as Record<string, unknown>).code ?? ''),
          lineCount: Number((message.codeSnippet as Record<string, unknown>).lineCount ?? 0),
        },
      }
    : {}),
  sentAt: serializeDate(message.sentAt as Date) ?? new Date().toISOString(),
  ...(message.deliveredAt ? { deliveredAt: serializeDate(message.deliveredAt as Date) } : {}),
  ...(message.seenAt ? { seenAt: serializeDate(message.seenAt as Date) } : {}),
  seenBy: Array.isArray(message.seenBy)
    ? message.seenBy.map((entry) => String(entry))
    : [],
});

export const initChatSocket = (io: Server) => {
  const chat = io.of('/chat');

  chat.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
        algorithms: ['RS256'],
      }) as any;
      socket.data.userId = decoded._id;
      socket.data.role = decoded.role;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  chat.on('connection', (socket) => {
    const userId: string = socket.data.userId;

    // Track presence
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    socket.on('chat:join', async ({ workspaceId }) => {
      if (!workspaceId || !Types.ObjectId.isValid(workspaceId)) {
        socket.emit('chat:error', { message: 'Workspace not found' });
        return;
      }

      const hasAccess = await canAccessWorkspace(workspaceId, socket.data.userId);

      if (!hasAccess) {
        socket.emit('chat:error', { message: 'Workspace not found' });
        return;
      }

      socket.join(`ws:${workspaceId}`);

      // Broadcast presence to room
      chat.to(`ws:${workspaceId}`).emit('presence:update', { userId, online: true });

      // Send current online list to the joining socket
      const room = await chat.in(`ws:${workspaceId}`).fetchSockets();
      const onlineInRoom = [...new Set(room.map((s) => s.data.userId as string))];
      socket.emit('presence:list', { onlineUserIds: onlineInRoom });
    });

    socket.on(
      'chat:message',
      async ({
        workspaceId,
        message,
        attachmentUrl,
        attachmentType,
        attachmentName,
        attachmentSizeBytes,
        attachmentMimeType,
        codeSnippet,
      }) => {
      try {
        if (!workspaceId || !Types.ObjectId.isValid(workspaceId)) {
          socket.emit('chat:error', { message: 'Workspace not found' });
          return;
        }

        const hasAccess = await canAccessWorkspace(workspaceId, socket.data.userId);
        if (!hasAccess) {
          socket.emit('chat:error', { message: 'Workspace not found' });
          return;
        }

        const canPost = await canPostWorkspaceChat(workspaceId, socket.data.userId);
        if (!canPost) {
          socket.emit('chat:error', { message: 'This workspace is read-only for your role' });
          return;
        }

        const normalizedMessage = typeof message === 'string' ? message.trim() : '';
        const normalizedAttachment = normalizeAttachment({
          attachmentUrl,
          attachmentType,
          attachmentName,
          attachmentSizeBytes,
          attachmentMimeType,
        });
        const normalizedCodeSnippet = normalizeCodeSnippet(codeSnippet);

        if (!normalizedMessage && !normalizedAttachment && !normalizedCodeSnippet) {
          socket.emit('chat:error', { message: 'Message, attachment, or code snippet is required' });
          return;
        }

        const msg = await ChatMessage.create({
          workspaceId,
          senderId: socket.data.userId,
          message: normalizedMessage,
          ...(normalizedAttachment ?? {}),
          ...(normalizedCodeSnippet ? { codeSnippet: normalizedCodeSnippet } : {}),
        });

        chat.to(`ws:${workspaceId}`).emit(
          'chat:message',
          serializeChatMessage(msg.toObject() as unknown as Partial<IChatMessage> & Record<string, unknown>),
        );
      } catch (error) {
        socket.emit('chat:error', {
          message: error instanceof Error ? error.message : 'Unable to send message right now',
        });
      }
    });

    // Typing indicator: broadcast to room excluding sender. Verify access
    // first so non-members cannot inject fake typing indicators into a
    // workspace they do not belong to.
    socket.on('chat:typing', async ({ workspaceId, isTyping }: { workspaceId: string; isTyping: boolean }) => {
      if (!workspaceId || !Types.ObjectId.isValid(workspaceId)) return;
      const hasAccess = await canAccessWorkspace(workspaceId, socket.data.userId);
      if (!hasAccess) return;
      const canPost = await canPostWorkspaceChat(workspaceId, socket.data.userId);
      if (!canPost) return;
      socket.to(`ws:${workspaceId}`).emit('chat:typing', { userId, isTyping });
    });

    socket.on('chat:leave', ({ workspaceId }) => {
      socket.leave(`ws:${workspaceId}`);
      chat.to(`ws:${workspaceId}`).emit('presence:update', { userId, online: false });
    });

    // Mark messages as delivered
    socket.on('chat:delivered', async ({ workspaceId, messageId }) => {
      if (!workspaceId || !Types.ObjectId.isValid(workspaceId)) return;
      if (!messageId || !Types.ObjectId.isValid(messageId)) return;
      const hasAccess = await canAccessWorkspace(workspaceId, userId);
      if (!hasAccess) return;

      try {
        const message = await ChatMessage.findById(messageId);
        if (message && message.workspaceId.toString() === workspaceId) {
          if (!message.deliveredAt) {
            message.deliveredAt = new Date();
          }
          await message.save();
          chat.to(`ws:${workspaceId}`).emit('chat:delivered', {
            messageId,
            deliveredAt: serializeDate(message.deliveredAt) ?? new Date().toISOString(),
          });
        }
      } catch {}
    });

    // Mark message as seen
    socket.on('chat:seen', async ({ workspaceId, messageId }) => {
      if (!workspaceId || !Types.ObjectId.isValid(workspaceId)) return;
      if (!messageId || !Types.ObjectId.isValid(messageId)) return;
      const hasAccess = await canAccessWorkspace(workspaceId, userId);
      if (!hasAccess) return;

      try {
        const message = await ChatMessage.findById(messageId);
        if (message && message.workspaceId.toString() === workspaceId) {
          if (!message.seenAt) {
            message.seenAt = new Date();
          }
          if (!message.seenBy) {
            message.seenBy = [];
          }
          if (!message.seenBy.some((id) => id.toString() === userId)) {
            message.seenBy.push(new Types.ObjectId(userId));
          }
          await message.save();
          chat.to(`ws:${workspaceId}`).emit('chat:seen', {
            messageId,
            seenAt: serializeDate(message.seenAt) ?? new Date().toISOString(),
            seenBy: message.seenBy.map((id) => id.toString()),
          });
        }
      } catch {}
    });

    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
        }
      }
    });
  });
};
