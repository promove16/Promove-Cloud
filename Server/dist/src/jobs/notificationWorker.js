"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startNotificationWorker = void 0;
const bullmq_1 = require("../config/bullmq");
const redis_1 = require("../config/redis");
const socket_1 = require("../config/socket");
const notification_service_1 = require("../modules/notification/notification.service");
const startNotificationWorker = () => {
    const worker = (0, bullmq_1.createQueueWorker)('notifications', async (job) => {
        const { userId, type, title, body, link } = job.data;
        const notification = await notification_service_1.NotificationService.create({
            userId,
            type,
            title,
            body,
            link,
        });
        if (socket_1.io) {
            socket_1.io.of('/notifications').to(`user:${userId}`).emit('notification:new', notification);
        }
        await redis_1.redis.lpush(`notif:${userId}`, JSON.stringify(notification));
        await redis_1.redis.expire(`notif:${userId}`, 172800);
    });
    return worker;
};
exports.startNotificationWorker = startNotificationWorker;
