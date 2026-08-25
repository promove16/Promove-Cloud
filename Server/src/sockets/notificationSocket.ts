import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { NotificationService } from '../modules/notification/notification.service';

export const initNotificationSocket = (io: Server) => {
  const notifs = io.of('/notifications');

  notifs.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
        algorithms: ['RS256'],
      }) as { _id?: string; id?: string; role?: string };
      socket.data.userId = decoded._id ?? decoded.id;
      socket.data.role = decoded.role;
      if (!socket.data.userId) {
        return next(new Error('Unauthorized'));
      }
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  notifs.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);

    socket.on('notif:mark-read', async ({ notificationId }, callback?: (response?: unknown) => void) => {
      try {
        if (!notificationId || typeof notificationId !== 'string') {
          callback?.({ error: 'Invalid notification id' });
          return;
        }
        const result = await NotificationService.markRead(socket.data.userId, notificationId);
        callback?.({ success: true, notification: result });
      } catch (error) {
        logger.error(`[NotificationSocket] Failed to mark notification read:`, error);
        callback?.({ error: 'Failed to mark as read' });
      }
    });
  });
};
