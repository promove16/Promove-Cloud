import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { getMyScore, getScoreHistory, getScoreEvents, testScoreTrigger } from './score.controller';

const router = Router();

router.get('/me', authenticate, authorize(UserRole.STUDENT), asyncHandler(getMyScore));
router.get(
  '/history/:userId',
  authenticate,
  authorize(UserRole.STUDENT, UserRole.ADMIN),
  asyncHandler(getScoreHistory),
);
router.get(
  '/events/:userId',
  authenticate,
  authorize(UserRole.ADMIN),
  asyncHandler(getScoreEvents),
);
router.post(
  '/test-trigger',
  authenticate,
  authorize(UserRole.ADMIN),
  asyncHandler(testScoreTrigger),
);

export default router;
