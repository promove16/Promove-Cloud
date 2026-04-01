import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  claimProblemController,
  getProblem,
  getProblemLeaderboardController,
  getProblems,
  requestProblemReviewController,
} from './problem.controller';

const router = Router();

router.use(authenticate, authorize(UserRole.STUDENT));
router.get('/', asyncHandler(getProblems));
router.get('/:id', asyncHandler(getProblem));
router.get('/:id/leaderboard', asyncHandler(getProblemLeaderboardController));
router.post('/:id/claim', asyncHandler(claimProblemController));
router.post('/:id/review-request', asyncHandler(requestProblemReviewController));

export default router;
