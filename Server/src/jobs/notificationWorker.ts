import { createQueueWorker, QueueJob } from '../config/bullmq';
import { redis } from '../config/redis';
import { io } from '../config/socket';
import { NotificationService } from '../modules/notification/notification.service';

export const startNotificationWorker = () => {
  const worker = createQueueWorker<{
    userId: string;
    type: Parameters<typeof NotificationService.create>[0]['type'];
    title: string;
    body: string;
    link?: string;
  }>(
    'notifications',
    async (job: QueueJob<{
      userId: string;
      type: Parameters<typeof NotificationService.create>[0]['type'];
      title: string;
      body: string;
      link?: string;
    }>) => {
      const { userId, type, title, body, link } = job.data as {
        userId: string;
        type: Parameters<typeof NotificationService.create>[0]['type'];
        title: string;
        body: string;
        link?: string;
      };

      const notification = await NotificationService.create({
        userId,
        type,
        title,
        body,
        link,
      });

      if (io) {
        io.of('/notifications').to(`user:${userId}`).emit('notification:new', notification);
      }

      await redis.lpush(`notif:${userId}`, JSON.stringify(notification));
      await redis.expire(`notif:${userId}`, 172800);
    },
  );

  return worker;
};
