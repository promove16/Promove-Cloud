"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllNotificationsRead = exports.markNotificationRead = exports.listNotifications = void 0;
const ApiError_1 = require("../../utils/ApiError");
const ApiResponse_1 = require("../../utils/ApiResponse");
const notification_service_1 = require("./notification.service");
const getParam = (value) => Array.isArray(value) ? value[0] : value;
const listNotifications = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const limit = Number(req.query.limit ?? 20);
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const notifications = await notification_service_1.NotificationService.listForUser(req.user._id, limit, before);
    res.json(new ApiResponse_1.ApiResponse(notifications));
};
exports.listNotifications = listNotifications;
const markNotificationRead = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const notificationId = getParam(req.params.id);
    if (!notificationId) {
        throw new ApiError_1.ApiError(400, 'INVALID_NOTIFICATION', 'Notification id is required');
    }
    const notification = await notification_service_1.NotificationService.markRead(req.user._id, notificationId);
    res.json(new ApiResponse_1.ApiResponse(notification));
};
exports.markNotificationRead = markNotificationRead;
const markAllNotificationsRead = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    await notification_service_1.NotificationService.markAllRead(req.user._id);
    res.json(new ApiResponse_1.ApiResponse({ updated: true }));
};
exports.markAllNotificationsRead = markAllNotificationsRead;
