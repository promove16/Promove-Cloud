import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { asyncHandler } from '../../utils/asyncHandler';
import { getMyDealController, getMyDealsController } from './deal.controller';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(getMyDealsController));
router.get('/:id', asyncHandler(getMyDealController));

export default router;
