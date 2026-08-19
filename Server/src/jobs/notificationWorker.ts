import { createQueueWorker, QueueJob } from '../config/bullmq';
import { NotificationService } from '../modules/notification/notification.service';
import {
  deliverNotificationEmail,
  fanoutNotification,
  NotificationPayload,
} from '../modules/notification/notification.delivery';

export const startNotificationWorker = () => {
  const worker = createQueueWorker<NotificationPayload>(
    'notifications',
    async (job: QueueJob<NotificationPayload>) => {
      const { userId, type, title, body, link, metadata } = job.data;

      const notification = await NotificationService.create({
        userId,
        type,
        title,
        body,
        link,
        metadata,
      });

      fanoutNotification(notification.toObject());

      await deliverNotificationEmail(notification);
    },
  );

  return worker;
};
