import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  addSubmissionScoreController,
  closeEventController,
  computeEventRankingsController,
  getEventRankingsController,
  joinEventController,
  listRecruiterHiringEventsController,
  listStudentInstitutionEventsController,
  selectStudentFromHiringEventController,
  sendHiringEventInviteController,
  listStudentInstitutionDrivesController,
  postponeHiringEventController,
} from './event.controller';

const router = Router();

router.use(authenticate);

router.get('/my-institution', authorize(UserRole.STUDENT), asyncHandler(listStudentInstitutionEventsController));
router.get('/drives', authorize(UserRole.STUDENT), asyncHandler(listStudentInstitutionDrivesController));
router.get('/hiring', authorize(UserRole.RECRUITER), asyncHandler(listRecruiterHiringEventsController));
router.post('/hiring-invite/:collegeId', authorize(UserRole.RECRUITER), asyncHandler(sendHiringEventInviteController));
router.patch(
  '/:eventId/postpone',
  authorize(UserRole.RECRUITER),
  asyncHandler(postponeHiringEventController),
);
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
router.route('/:eventId/close')
  .post(
    authorize(UserRole.COLLEGE, UserRole.SCHOOL, UserRole.RECRUITER),
    asyncHandler(closeEventController),
  )
  .patch(
    authorize(UserRole.COLLEGE, UserRole.SCHOOL, UserRole.RECRUITER),
    asyncHandler(closeEventController),
  );

export default router;
