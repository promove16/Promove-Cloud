import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  getMyReputationController,
  getReputationController,
} from './reputation.controller';

const router = Router();

router.use(authenticate);

router.get('/me', asyncHandler(getMyReputationController));
router.get('/:userId', asyncHandler(getReputationController));

export default router;
