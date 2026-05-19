import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  expressInterestController,
  myInterestsController,
  startupInterestSummaryController,
  startupInterestedInvestorsController,
  withdrawInterestController,
} from './interest.controller';

const router = Router();

router.use(authenticate);

router.get('/me', authorize(UserRole.INVESTOR), asyncHandler(myInterestsController));
router.get('/startup/:startupId/summary', asyncHandler(startupInterestSummaryController));
router.get(
  '/startup/:startupId/investors',
  authorize(UserRole.STUDENT),
  asyncHandler(startupInterestedInvestorsController),
);
router.post(
  '/startup/:startupId',
  authorize(UserRole.INVESTOR),
  asyncHandler(expressInterestController),
);
router.delete(
  '/startup/:startupId',
  authorize(UserRole.INVESTOR),
  asyncHandler(withdrawInterestController),
);

export default router;
