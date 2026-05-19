import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  placeBidController,
  getFounderBidsController,
  getInvestorBidsController,
  getBidController,
  getStartupBidsController,
  markBidViewedController,
  counterBidController,
  respondToBidController,
  expireStaleBidsController,
} from './bidding.controller';

const router = Router();

router.use(authenticate);

router.get('/founder', authorize(UserRole.STUDENT), asyncHandler(getFounderBidsController));
router.get('/investor', authorize(UserRole.INVESTOR), asyncHandler(getInvestorBidsController));
router.get('/startup/:startupId', asyncHandler(getStartupBidsController));
router.get('/:bidId', asyncHandler(getBidController));
router.post('/startup/:startupId', authorize(UserRole.INVESTOR), asyncHandler(placeBidController));
router.patch('/:bidId/view', authorize(UserRole.STUDENT), asyncHandler(markBidViewedController));
router.post('/:bidId/counter', authorize(UserRole.STUDENT, UserRole.INVESTOR), asyncHandler(counterBidController));
router.patch('/:bidId/respond', authorize(UserRole.STUDENT), asyncHandler(respondToBidController));

router.post('/system/expire', asyncHandler(expireStaleBidsController));

export default router;
