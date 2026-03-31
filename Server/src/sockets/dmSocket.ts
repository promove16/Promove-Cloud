import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { DirectMessage } from '../modules/dm/dm.model';
import { onlineUsers } from '../modules/dm/dm.controller';

export const initDmSocket = (io: Server) => {
  const dm = io.of('/dm');

  dm.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as any;
      socket.data.userId = decoded._id;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  dm.on('connection', (socket) => {
    const userId: string = socket.data.userId;

    // Each user joins their own room named by their userId
    socket.join(`user:${userId}`);

    // Track online presence
    onlineUsers.add(userId);
    dm.emit('dm:presence', { userId, isOnline: true });

    // Send a DM
    socket.on('dm:send', async ({ recipientId, message, messageType, scheduledAt, meetLink }) => {
      try {
        if (!recipientId || !Types.ObjectId.isValid(recipientId)) {
          socket.emit('dm:error', { message: 'Invalid recipient' });
          return;
        }

        const normalizedMessage = typeof message === 'string' ? message.trim() : '';
        const type = messageType === 'interview_request' ? 'interview_request' : 'text';

        if (!normalizedMessage && type !== 'interview_request') {
          socket.emit('dm:error', { message: 'Message cannot be empty' });
          return;
        }

        if (type === 'interview_request' && !scheduledAt) {
          socket.emit('dm:error', { message: 'scheduledAt is required for interview requests' });
          return;
        }

        const msg = await DirectMessage.create({
          senderId: new Types.ObjectId(userId),
          recipientId: new Types.ObjectId(recipientId),
          message: normalizedMessage,
          messageType: type,
          ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
          ...(meetLink ? { meetLink } : {}),
        });

        // Send to recipient's room
        dm.to(`user:${recipientId}`).emit('dm:message', msg);
        // Echo back to sender (in case multiple tabs)
        socket.emit('dm:message', msg);
      } catch (_err) {
        socket.emit('dm:error', { message: 'Failed to send message' });
      }
    });

    // Mark messages as read & notify sender
    socket.on('dm:read', async ({ partnerId }: { partnerId: string }) => {
      if (!partnerId || !Types.ObjectId.isValid(partnerId)) return;

      const now = new Date();
      await DirectMessage.updateMany(
        {
          senderId: new Types.ObjectId(partnerId),
          recipientId: new Types.ObjectId(userId),
          readAt: null,
        },
        { $set: { readAt: now } },
      );

      // Notify the original sender that their messages were read
      dm.to(`user:${partnerId}`).emit('dm:messages-read', {
        readBy: userId,
        readAt: now.toISOString(),
      });
    });

    // Typing indicator
    socket.on('dm:typing', ({ recipientId, isTyping }: { recipientId: string; isTyping: boolean }) => {
      if (!recipientId) return;
      dm.to(`user:${recipientId}`).emit('dm:typing', { senderId: userId, isTyping });
    });

    // Handle disconnect — remove from online set
    socket.on('disconnect', () => {
      // Only mark offline if no other sockets for this user
      const rooms = dm.adapter.rooms.get(`user:${userId}`);
      if (!rooms || rooms.size === 0) {
        onlineUsers.delete(userId);
        dm.emit('dm:presence', { userId, isOnline: false });
      }
    });
  });
};
