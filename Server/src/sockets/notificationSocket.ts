import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { NotificationService } from '../modules/notification/notification.service';

export const initNotificationSocket = (io: Server) => {
  const notifs = io.of('/notifications');

  notifs.use((socket, next) => {
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

  notifs.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);

    socket.on('notif:mark-read', async ({ notificationId }) => {
      await NotificationService.markRead(socket.data.userId, notificationId);
    });
  });
};
