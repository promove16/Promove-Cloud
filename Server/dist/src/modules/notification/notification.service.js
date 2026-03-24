"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const notification_model_1 = require("./notification.model");
class NotificationService {
    static async create(params) {
        return notification_model_1.Notification.create(params);
    }
    static async listForUser(userId, limit, before) {
        const query = { userId };
        if (before) {
            query._id = { $lt: before };
        }
        return notification_model_1.Notification.find(query).sort({ isRead: 1, createdAt: -1 }).limit(limit).lean();
    }
    static async markRead(userId, id) {
        return notification_model_1.Notification.findOneAndUpdate({ _id: id, userId }, { isRead: true }, { new: true }).lean();
    }
    static async markAllRead(userId) {
        await notification_model_1.Notification.updateMany({ userId, isRead: false }, { isRead: true });
    }
}
exports.NotificationService = NotificationService;
