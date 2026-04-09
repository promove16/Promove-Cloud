import { createQueueWorker, QueueJob } from '../config/bullmq';
import { io } from '../config/socket';
import { NotificationService } from '../modules/notification/notification.service';

export const startNotificationWorker = () => {
  const worker = createQueueWorker<{
    userId: string;
    type: Parameters<typeof NotificationService.create>[0]['type'];
    title: string;
    body: string;
    link?: string;
    metadata?: Record<string, unknown>;
  }>(
    'notifications',
    async (job: QueueJob<{
      userId: string;
      type: Parameters<typeof NotificationService.create>[0]['type'];
      title: string;
      body: string;
      link?: string;
      metadata?: Record<string, unknown>;
    }>) => {
      const { userId, type, title, body, link, metadata } = job.data as {
        userId: string;
        type: Parameters<typeof NotificationService.create>[0]['type'];
        title: string;
        body: string;
        link?: string;
        metadata?: Record<string, unknown>;
      };

      const notification = await NotificationService.create({
        userId,
        type,
        title,
        body,
        link,
        metadata,
      });

      if (io) {
        io.of('/notifications').to(`user:${userId}`).emit('notification:new', notification);
      }
    },
  );

  return worker;
};
