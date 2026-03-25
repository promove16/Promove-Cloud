"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initNotificationSocket = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const notification_service_1 = require("../modules/notification/notification.service");
const initNotificationSocket = (io) => {
    const notifs = io.of('/notifications');
    notifs.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token)
            return next(new Error('Unauthorized'));
        try {
            const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_ACCESS_SECRET);
            socket.data.userId = decoded._id;
            socket.data.role = decoded.role;
            next();
        }
        catch {
            next(new Error('Unauthorized'));
        }
    });
    notifs.on('connection', (socket) => {
        socket.join(`user:${socket.data.userId}`);
        socket.on('notif:mark-read', async ({ notificationId }) => {
            await notification_service_1.NotificationService.markRead(socket.data.userId, notificationId);
        });
    });
};
exports.initNotificationSocket = initNotificationSocket;
