import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  founderAnalyticsController,
  founderStartupAnalyticsController,
  investorAnalyticsController,
  adminPlatformAnalyticsController,
} from './analytics.controller';

const router = Router();

router.use(authenticate);

router.get('/founder', authorize(UserRole.STUDENT), asyncHandler(founderAnalyticsController));
router.get('/founder/startup/:startupId', authorize(UserRole.STUDENT), asyncHandler(founderStartupAnalyticsController));
router.get('/investor', authorize(UserRole.INVESTOR), asyncHandler(investorAnalyticsController));
router.get('/admin', authorize(UserRole.ADMIN), asyncHandler(adminPlatformAnalyticsController));

export default router;
