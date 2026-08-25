import { notificationQueue } from '../../config/bullmq';
import { logger } from '../../config/logger';
import {
  markNotificationEmitted,
  publishNotificationFanout,
} from '../../config/notificationFanout';
import { io } from '../../config/socket';
import { sendNotificationEmail } from '../../services/emailService';
import { Settings } from '../settings/settings.model';
import { User } from '../user/user.model';
import { NotificationType } from './notification.model';

export type NotificationPayload = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
};

const NOTIFICATION_TYPE_TO_EMAIL_CATEGORY: Record<string, string> = {
  score_update: 'platform',
  request: 'platform',
  patent_status: 'patents',
  deal_interest: 'deals',
  startup_launch: 'platform',
  system: 'platform',
};

const EMAIL_SKIPPED_TYPES = new Set(['team_invite', 'chat_invite']);

/**
 * Persists a notification row and guarantees realtime delivery to the recipient
 * across all deployment modes:
 *  - in-process socket emit when running inside the API process
 *  - Redis channel publish so dedicated worker processes can fan out to the
 *    API replicas that own the connected clients
 */
export const fanoutNotification = (notification: { _id: unknown; userId: unknown }) => {
  const userId = String(notification.userId);
  if (!userId) {
    return;
  }
  try {
    markNotificationEmitted(String(notification._id));
    io.of('/notifications').to(`user:${userId}`).emit('notification:new', notification);
  } catch (error) {
    logger.error('[NotificationFanout] In-process socket emit failed:', error);
  }
  publishNotificationFanout(notification as unknown as Record<string, unknown>);
};

/**
 * Canonical entry point for creating a notification. Queues the job so the
 * notification worker persists it, pushes it in realtime and sends the email.
 * Use this from services instead of NotificationService.create directly so
 * every notification reaches the recipient via all channels.
 */
export const queueNotification = async (params: NotificationPayload) => {
  await notificationQueue.add('send', params);
};

/**
 * Sends the notification email honouring the user's settings. A user without a
 * Settings document (never opened the settings page) is treated as opted-in.
 */
export const deliverNotificationEmail = async (notification: {
  userId: unknown;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}) => {
  const { type, title, body, link } = notification;
  const userId = String(notification.userId);
  if (!userId) {
    return;
  }

  if (EMAIL_SKIPPED_TYPES.has(type)) {
    return;
  }

  const emailCategory = NOTIFICATION_TYPE_TO_EMAIL_CATEGORY[type];
  if (!emailCategory) {
    return;
  }

  let settings;
  try {
    settings = await Settings.findOne({ userId }).select('notifications.email').lean();
  } catch (error) {
    logger.error(`[NotificationWorker] Failed to load settings for ${userId}:`, error);
  }

  // No settings doc -> default to email enabled. When a settings doc exists,
  // honour per-channel preference — only an explicit `false` disables.
  const channelEnabled = settings
    ? (settings.notifications?.email?.[emailCategory as keyof typeof settings.notifications.email] as boolean | undefined) !== false
    : true;
  if (!channelEnabled) {
    return;
  }

  const user = await User.findById(userId).select('email displayName').lean();
  if (!user?.email) {
    return;
  }

  try {
    await sendNotificationEmail({
      toEmail: user.email,
      userName: user.displayName || 'there',
      notificationType: type,
      title,
      body,
      link,
    });
  } catch (error) {
    logger.error(`[NotificationWorker] Failed to send email for user ${userId} (${type}):`, error);
  }
};
