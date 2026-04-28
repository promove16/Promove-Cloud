import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { DirectMessage } from '../modules/dm/dm.model';
import { onlineUsers } from '../modules/dm/dm.controller';
import { ensureDmAccess, ensureDmThreadAccess } from '../modules/dm/dm.permissions';
import { serializeDirectMessage } from '../modules/dm/dm.serializer';

// Map to store userId -> socket mapping for secure message routing
const userSockets = new Map<string, Set<Socket>>();
const allowedQueryTypes = new Set<string>([
  'project_mentor',
  'project_join',
  'investor',
  'recruiter',
  'hiring_event',
  'mentorship_program',
  'general',
]);

const validateDmAttachmentStorage = (
  senderId: string,
  attachmentStorageProvider?: unknown,
  attachmentStorageKey?: unknown,
) => {
  if (!attachmentStorageProvider && !attachmentStorageKey) {
    return {};
  }

  if (attachmentStorageProvider !== 's3' && attachmentStorageProvider !== 'cloudinary') {
    throw new Error('Attachment storage provider is invalid');
  }

  if (typeof attachmentStorageKey !== 'string' || !attachmentStorageKey.trim()) {
    throw new Error('Attachment storage key is invalid');
  }

  const normalizedKey = attachmentStorageKey.trim();
  if (!normalizedKey.startsWith(`dm/${senderId}/`)) {
    throw new Error('Attachment does not belong to this sender');
  }

  return {
    attachmentStorageProvider,
    attachmentStorageKey: normalizedKey,
  };
};

export const initDmSocket = (io: Server) => {
  const dm = io.of('/dm');

  dm.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
        algorithms: ['RS256'],
      }) as any;
      socket.data.userId = decoded._id;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  dm.on('connection', (socket) => {
    const userId: string = socket.data.userId;

    // Track socket for this user
    const userSocketSet = userSockets.get(userId) ?? new Set();
    userSocketSet.add(socket);
    userSockets.set(userId, userSocketSet);

    // Each user joins their own room named by their userId
    socket.join(`user:${userId}`);

    // Track online presence
    onlineUsers.add(userId);
    dm.emit('dm:presence', { userId, isOnline: true });

    // Send a DM - SECURE VERSION
    socket.on('dm:send', async (data: { 
      recipientId?: string; 
      message?: string; 
      messageType?: string; 
      scheduledAt?: string; 
      meetLink?: string; 
      attachmentUrl?: string; 
      attachmentType?: string; 
      attachmentName?: string;
      attachmentStorageProvider?: string;
      attachmentStorageKey?: string;
      queryType?: string;
    }) => {
      try {
        // CRITICAL: Use the socket's authenticated userId as sender, NOT from payload
        const senderId = userId;
        
        const {
          recipientId,
          message,
          messageType,
          scheduledAt,
          meetLink,
          attachmentUrl,
          attachmentType,
          attachmentName,
          attachmentStorageProvider,
          attachmentStorageKey,
          queryType,
        } = data;

        if (!recipientId || !Types.ObjectId.isValid(recipientId)) {
          socket.emit('dm:error', { message: 'Invalid recipient' });
          return;
        }

        const normalizedMessage = typeof message === 'string' ? message.trim() : '';
        const type = messageType === 'interview_request' ? 'interview_request' : 'text';

        if (!normalizedMessage && type !== 'interview_request' && !attachmentUrl) {
          socket.emit('dm:error', { message: 'Message cannot be empty' });
          return;
        }

        if (type === 'interview_request' && !scheduledAt) {
          socket.emit('dm:error', { message: 'scheduledAt is required for interview requests' });
          return;
        }

        if (queryType && !allowedQueryTypes.has(queryType)) {
          socket.emit('dm:error', { message: 'Invalid message query type' });
          return;
        }

        await ensureDmAccess(senderId, recipientId, (queryType as any) || 'general');
        const attachmentStorage = validateDmAttachmentStorage(
          senderId,
          attachmentStorageProvider,
          attachmentStorageKey,
        );

        // Create message with verified senderId from socket auth
        const msg = await DirectMessage.create({
          senderId: new Types.ObjectId(senderId),
          recipientId: new Types.ObjectId(recipientId),
          message: normalizedMessage,
          messageType: type,
          queryType: queryType || 'general',
          ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
          ...(meetLink ? { meetLink } : {}),
          ...(attachmentUrl ? { attachmentUrl } : {}),
          ...(attachmentType ? { attachmentType } : {}),
          ...(attachmentName ? { attachmentName } : {}),
          ...attachmentStorage,
        });
        const serializedMessage = await serializeDirectMessage(msg.toObject());

        // Send ONLY to the intended recipient
        dm.to(`user:${recipientId}`).emit('dm:message', serializedMessage);
        
        // Echo back to sender only (to their own sockets)
        socket.emit('dm:message', serializedMessage);
        
        console.log(`[DM] Message sent from ${senderId} to ${recipientId}`);
      } catch (_err) {
        console.error('[DM] Send error:', _err);
        socket.emit('dm:error', { message: 'Failed to send message' });
      }
    });

    // Mark messages as read & notify sender - SECURE VERSION
    socket.on('dm:read', async (data: { partnerId?: string }) => {
      const { partnerId } = data;
      
      if (!partnerId || !Types.ObjectId.isValid(partnerId)) return;
      
      // Use socket's authenticated userId
      const userId = socket.data.userId;
      await ensureDmThreadAccess(userId, partnerId);

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

    // Typing indicator - SECURE VERSION
    socket.on('dm:typing', async (data: { recipientId?: string; isTyping?: boolean }) => {
      const { recipientId, isTyping } = data;
      if (!recipientId) return;
      
      // Use socket's authenticated userId
      const senderId = socket.data.userId;
      try {
        await ensureDmThreadAccess(senderId, recipientId);
      } catch {
        return;
      }
      dm.to(`user:${recipientId}`).emit('dm:typing', { senderId, isTyping });
    });

    // Handle disconnect — remove from online set
    socket.on('disconnect', () => {
      // Remove socket from user's socket set
      const userSocketSet = userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket);
        if (userSocketSet.size === 0) {
          userSockets.delete(userId);
          onlineUsers.delete(userId);
          dm.emit('dm:presence', { userId, isOnline: false });
        }
      }
    });
  });
};
