import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  getMyRecentActivityController,
  getStartupActivityFeedController,
} from './activity.controller';

const router = Router();

router.use(authenticate);

router.get('/me/recent', asyncHandler(getMyRecentActivityController));
router.get('/startup/:startupId', asyncHandler(getStartupActivityFeedController));

export default router;
