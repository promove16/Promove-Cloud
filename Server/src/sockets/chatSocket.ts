import { Server } from 'socket.io';
import { Workspace } from '../modules/workspace/workspace.model';
import { ChatMessage } from '../modules/chat/chat.model';
import { verifySocketToken } from './auth';

export const initChatSocket = (io: Server) => {
  const chat = io.of('/chat');

  chat.use((socket, next) => {
    try {
      verifySocketToken(socket);
      next();
    } catch (error) {
      next(error as Error);
    }
  });

  chat.on('connection', (socket) => {
    socket.on('chat:join', async ({ workspaceId }) => {
      const workspace = await Workspace.findById(workspaceId).lean();
      if (!workspace) return;
      const isMember =
        String(workspace.ownerId) === socket.data.userId ||
        workspace.teamMemberIds.map(String).includes(socket.data.userId as string);
      if (!isMember) {
        socket.emit('error', { message: 'Not a workspace member' });
        return;
      }
      socket.join(`ws:${workspaceId}`);
    });

    socket.on('chat:message', async ({ workspaceId, message, attachmentUrl, attachmentType }) => {
      const workspace = await Workspace.findById(workspaceId).lean();
      if (!workspace) return;
      const isMember =
        String(workspace.ownerId) === socket.data.userId ||
        workspace.teamMemberIds.map(String).includes(socket.data.userId as string);
      if (!isMember) {
        socket.emit('error', { message: 'Not a workspace member' });
        return;
      }

      const saved = await ChatMessage.create({
        workspaceId,
        senderId: socket.data.userId,
        message,
        attachmentUrl,
        attachmentType,
        sentAt: new Date(),
      });

      chat.to(`ws:${workspaceId}`).emit('chat:message', saved.toObject());
    });

    socket.on('chat:leave', ({ workspaceId }) => {
      socket.leave(`ws:${workspaceId}`);
    });
  });
};
