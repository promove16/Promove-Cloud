import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import { NotificationService } from './notification.service';

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const listNotifications = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const limit = Number(req.query.limit ?? 20);
  const before = typeof req.query.before === 'string' ? req.query.before : undefined;
  const notifications = await NotificationService.listForUser(req.user._id, limit, before);
  res.json(new ApiResponse(notifications));
};

export const markNotificationRead = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const notificationId = getParam(req.params.id);
  if (!notificationId) {
    throw new ApiError(400, 'INVALID_NOTIFICATION', 'Notification id is required');
  }

  const notification = await NotificationService.markRead(req.user._id, notificationId);
  res.json(new ApiResponse(notification));
};

export const markAllNotificationsRead = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  await NotificationService.markAllRead(req.user._id);
  res.json(new ApiResponse({ updated: true }));
};
