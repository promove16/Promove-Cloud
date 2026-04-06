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

router.use(authenticate);
router.get(
  '/',
  authorize(
    UserRole.STUDENT,
    UserRole.SCHOOL,
    UserRole.COLLEGE,
    UserRole.MENTOR,
    UserRole.INVESTOR,
    UserRole.RECRUITER,
  ),
  asyncHandler(getProblems),
);
router.get(
  '/:id',
  authorize(
    UserRole.STUDENT,
    UserRole.SCHOOL,
    UserRole.COLLEGE,
    UserRole.MENTOR,
    UserRole.INVESTOR,
    UserRole.RECRUITER,
  ),
  asyncHandler(getProblem),
);
router.get(
  '/:id/leaderboard',
  authorize(
    UserRole.STUDENT,
    UserRole.SCHOOL,
    UserRole.COLLEGE,
    UserRole.MENTOR,
    UserRole.INVESTOR,
    UserRole.RECRUITER,
  ),
  asyncHandler(getProblemLeaderboardController),
);
router.use(authorize(UserRole.STUDENT));
router.post('/:id/claim', asyncHandler(claimProblemController));
router.post('/:id/review-request', asyncHandler(requestProblemReviewController));

export default router;
