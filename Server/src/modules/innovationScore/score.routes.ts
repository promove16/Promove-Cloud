import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { getMyScore, getScoreHistory } from './score.controller';

const router = Router();

router.get('/me', authenticate, authorize(UserRole.STUDENT), asyncHandler(getMyScore));
router.get(
  '/history/:userId',
  authenticate,
  authorize(UserRole.STUDENT),
  asyncHandler(getScoreHistory),
);

export default router;
