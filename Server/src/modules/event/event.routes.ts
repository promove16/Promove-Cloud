import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  addSubmissionScoreController,
  computeEventRankingsController,
  getEventRankingsController,
  joinEventController,
} from './event.controller';

const router = Router();

router.use(authenticate);

router.post('/:eventId/join', authorize(UserRole.STUDENT), asyncHandler(joinEventController));
router.patch(
  '/:eventId/participants/:studentId/submission-score',
  authorize(UserRole.COLLEGE),
  asyncHandler(addSubmissionScoreController),
);
router.post(
  '/:eventId/compute-rankings',
  authorize(UserRole.COLLEGE),
  asyncHandler(computeEventRankingsController),
);
router.get(
  '/:eventId/rankings',
  authorize(UserRole.COLLEGE, UserRole.STUDENT, UserRole.RECRUITER),
  asyncHandler(getEventRankingsController),
);

export default router;
