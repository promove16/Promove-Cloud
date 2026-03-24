"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initNotificationSocket = void 0;
const notification_model_1 = require("../modules/notification/notification.model");
const auth_1 = require("./auth");
const initNotificationSocket = (io) => {
    const notifications = io.of('/notifications');
    notifications.use((socket, next) => {
        try {
            (0, auth_1.verifySocketToken)(socket);
            next();
        }
        catch (error) {
            next(error);
        }
    });
    notifications.on('connection', (socket) => {
        socket.join(`user:${socket.data.userId}`);
        socket.on('notif:mark-read', async ({ notificationId }) => {
            await notification_model_1.Notification.findByIdAndUpdate(notificationId, { isRead: true });
        });
    });
};
exports.initNotificationSocket = initNotificationSocket;
