import { Server } from 'socket.io';
import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Workspace } from '../modules/workspace/workspace.model';
import { ChatMessage } from '../modules/chat/chat.model';

const canAccessWorkspace = async (workspaceId: string, userId: string) =>
  Workspace.exists({
    _id: workspaceId,
    $or: [{ ownerId: userId }, { teamMemberIds: userId }],
  });

export const initChatSocket = (io: Server) => {
  const chat = io.of('/chat');

  chat.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as any;
      socket.data.userId = decoded._id;
      socket.data.role = decoded.role;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  chat.on('connection', (socket) => {
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

    socket.on('chat:leave', ({ workspaceId }) => {
      socket.leave(`ws:${workspaceId}`);
    });
  });
};
