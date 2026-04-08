import { Server } from 'socket.io';
import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Workspace } from '../modules/workspace/workspace.model';
import { ChatMessage } from '../modules/chat/chat.model';

const canAccessWorkspace = async (workspaceId: string, userId: string) =>
  Workspace.exists({
    _id: workspaceId,
    $or: [
      { ownerId: userId },
      { teamMemberIds: userId },
      { 'chatParticipants.userId': userId },
    ],
  });

// userId -> Set of socketIds for online presence
const onlineUsers = new Map<string, Set<string>>();

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

    socket.on('chat:message', async ({ workspaceId, message, attachmentUrl, attachmentType }) => {
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

        const normalizedMessage =
          typeof message === 'string'
            ? message.trim()
            : '';

        if (!normalizedMessage && !attachmentUrl) {
          socket.emit('chat:error', { message: 'Message or attachment is required' });
          return;
        }

        const msg = await ChatMessage.create({
          workspaceId,
          senderId: socket.data.userId,
          message: normalizedMessage,
          ...(attachmentUrl ? { attachmentUrl } : {}),
          ...(attachmentType ? { attachmentType } : {}),
        });

        chat.to(`ws:${workspaceId}`).emit('chat:message', msg);
      } catch (_error) {
        socket.emit('chat:error', { message: 'Unable to send message right now' });
      }
    });

    // Typing indicator: broadcast to room excluding sender. Verify access
    // first so non-members cannot inject fake typing indicators into a
    // workspace they do not belong to.
    socket.on('chat:typing', async ({ workspaceId, isTyping }: { workspaceId: string; isTyping: boolean }) => {
      if (!workspaceId || !Types.ObjectId.isValid(workspaceId)) return;
      const hasAccess = await canAccessWorkspace(workspaceId, socket.data.userId);
      if (!hasAccess) return;
      socket.to(`ws:${workspaceId}`).emit('chat:typing', { userId, isTyping });
    });

    socket.on('chat:leave', ({ workspaceId }) => {
      socket.leave(`ws:${workspaceId}`);
      chat.to(`ws:${workspaceId}`).emit('presence:update', { userId, online: false });
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
