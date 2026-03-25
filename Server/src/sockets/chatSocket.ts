import { Server } from 'socket.io';
import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Workspace } from '../modules/workspace/workspace.model';
import { ChatMessage } from '../modules/chat/chat.model';

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

      const hasAccess = await Workspace.exists({
        _id: workspaceId,
        $or: [{ ownerId: socket.data.userId }, { teamMemberIds: socket.data.userId }],
      });

      if (!hasAccess) {
        socket.emit('chat:error', { message: 'Workspace not found' });
        return;
      }

      socket.join(`ws:${workspaceId}`);
    });

    socket.on('chat:message', async ({ workspaceId, message, attachmentUrl }) => {
      const msg = await ChatMessage.create({
        workspaceId,
        senderId: socket.data.userId,
        message,
        attachmentUrl,
      });

      chat.to(`ws:${workspaceId}`).emit('chat:message', msg);
    });

    socket.on('chat:leave', ({ workspaceId }) => {
      socket.leave(`ws:${workspaceId}`);
    });
  });
};
