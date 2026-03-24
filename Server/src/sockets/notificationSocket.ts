import { Server } from 'socket.io';
import { Notification } from '../modules/notification/notification.model';
import { verifySocketToken } from './auth';

export const initNotificationSocket = (io: Server) => {
  const notifications = io.of('/notifications');

  notifications.use((socket, next) => {
    try {
      verifySocketToken(socket);
      next();
    } catch (error) {
      next(error as Error);
    }
  });

  notifications.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId as string}`);

    socket.on('notif:mark-read', async ({ notificationId }) => {
      await Notification.findByIdAndUpdate(notificationId, { isRead: true });
    });
  });
};
