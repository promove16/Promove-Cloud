import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notification.controller';

const router = Router();

router.get('/', authenticate, asyncHandler(listNotifications));
router.patch('/read-all', authenticate, asyncHandler(markAllNotificationsRead));
router.patch('/:id/read', authenticate, asyncHandler(markNotificationRead));

export default router;
