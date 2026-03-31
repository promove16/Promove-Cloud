import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { DirectMessage } from '../modules/dm/dm.model';

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

    // Typing indicator
    socket.on('dm:typing', ({ recipientId, isTyping }: { recipientId: string; isTyping: boolean }) => {
      if (!recipientId) return;
      dm.to(`user:${recipientId}`).emit('dm:typing', { senderId: userId, isTyping });
    });
  });
};
