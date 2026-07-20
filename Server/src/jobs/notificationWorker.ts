import { createQueueWorker, QueueJob } from '../config/bullmq';
import { io } from '../config/socket';
import { NotificationService } from '../modules/notification/notification.service';
import { Settings } from '../modules/settings/settings.model';
import { User } from '../modules/user/user.model';
import { sendNotificationEmail } from '../services/emailService';
import { logger } from '../config/logger';

const NOTIFICATION_TYPE_TO_EMAIL_CATEGORY: Record<string, string> = {
  score_update: 'platform',
  request: 'platform',
  patent_status: 'patents',
  deal_interest: 'deals',
  startup_launch: 'platform',
  system: 'platform',
};

const EMAIL_SKIPPED_TYPES = new Set(['team_invite', 'chat_invite']);

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

      if (EMAIL_SKIPPED_TYPES.has(type)) {
        return;
      }

      try {
        const emailCategory = NOTIFICATION_TYPE_TO_EMAIL_CATEGORY[type];
        if (!emailCategory) {
          return;
        }

        const settings = await Settings.findOne({ userId })
          .select('notifications.email')
          .lean();

        if (!settings?.notifications?.email?.[emailCategory as keyof typeof settings.notifications.email]) {
          return;
        }

        const user = await User.findById(userId).select('email displayName').lean();
        if (!user?.email) {
          return;
        }

        await sendNotificationEmail({
          toEmail: user.email,
          userName: user.displayName || 'there',
          notificationType: type,
          title,
          body,
          link,
        });
      } catch (error) {
        logger.error(`[NotificationWorker] Failed to send email for notification ${notification._id}:`, error);
      }
    },
  );

  return worker;
};
