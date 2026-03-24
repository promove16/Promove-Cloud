import { FilterQuery } from 'mongoose';
import { Notification, INotification, NotificationType } from './notification.model';

export class NotificationService {
  static async create(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    link?: string;
  }) {
    return Notification.create(params);
  }

  static async listForUser(userId: string, limit: number, before?: string) {
    const query: FilterQuery<INotification> = { userId };

    if (before) {
      query._id = { $lt: before };
    }

    return Notification.find(query).sort({ isRead: 1, createdAt: -1 }).limit(limit).lean();
  }

  static async markRead(userId: string, id: string) {
    return Notification.findOneAndUpdate({ _id: id, userId }, { isRead: true }, { new: true }).lean();
  }

  static async markAllRead(userId: string) {
    await Notification.updateMany({ userId, isRead: false }, { isRead: true });
  }
}
