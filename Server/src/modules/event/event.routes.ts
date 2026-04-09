import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  addSubmissionScoreController,
  computeEventRankingsController,
  createHiringEventController,
  getEventRankingsController,
  joinEventController,
  listRecruiterHiringEventsController,
  listStudentInstitutionEventsController,
  selectStudentFromHiringEventController,
} from './event.controller';

const router = Router();

router.use(authenticate);

router.get('/my-institution', authorize(UserRole.STUDENT), asyncHandler(listStudentInstitutionEventsController));
router.post('/hiring', authorize(UserRole.RECRUITER), asyncHandler(createHiringEventController));
router.get('/hiring', authorize(UserRole.RECRUITER), asyncHandler(listRecruiterHiringEventsController));
router.post(
  '/hiring/:eventId/select/:studentId',
  authorize(UserRole.RECRUITER),
  asyncHandler(selectStudentFromHiringEventController),
);

router.post('/:eventId/join', authorize(UserRole.STUDENT), asyncHandler(joinEventController));
router.patch(
  '/:eventId/participants/:studentId/submission-score',
  authorize(UserRole.COLLEGE, UserRole.SCHOOL, UserRole.RECRUITER),
  asyncHandler(addSubmissionScoreController),
);
router.post(
  '/:eventId/compute-rankings',
  authorize(UserRole.COLLEGE, UserRole.SCHOOL, UserRole.RECRUITER),
  asyncHandler(computeEventRankingsController),
);
router.get(
  '/:eventId/rankings',
  authorize(UserRole.COLLEGE, UserRole.SCHOOL, UserRole.STUDENT, UserRole.RECRUITER),
  asyncHandler(getEventRankingsController),
);

export default router;
