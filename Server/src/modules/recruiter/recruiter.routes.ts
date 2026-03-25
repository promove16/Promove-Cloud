import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { connectionGuard } from '../../middleware/connectionGuard';
import { relevanceGuard } from '../../middleware/relevanceGuard';
import { asyncHandler } from '../../utils/asyncHandler';
import { UserRole } from '../../types/roles.types';
import {
  applyJobController,
  closeDriveController,
  createDriveController,
  createJobController,
  deleteJobController,
  getCollegesController,
  getDashboardController,
  getDrivesController,
  getJobsController,
  getOnboardingController,
  getPublicJobsController,
  getTalentDiscoverController,
  getTalentPipelineController,
  getTalentProfileController,
  hiredStudentController,
  messageCheckController,
  registerForDriveController,
  removeShortlistController,
  sendMessageController,
  shortlistStudentController,
  submitDriveScoreController,
  updateJobController,
} from './recruiter.controller';

const router = Router();

router.get('/dashboard', authenticate, authorize(UserRole.RECRUITER), asyncHandler(getDashboardController));
router.get('/talent', authenticate, authorize(UserRole.RECRUITER), asyncHandler(getTalentPipelineController));
router.get('/talent/search', authenticate, authorize(UserRole.RECRUITER), asyncHandler(getTalentDiscoverController));
router.get('/talent/discover', authenticate, authorize(UserRole.RECRUITER), asyncHandler(getTalentDiscoverController));
router.get(
  '/talent/:studentId',
  authenticate,
  authorize(UserRole.RECRUITER),
  connectionGuard(UserRole.STUDENT),
  asyncHandler(getTalentProfileController),
);
router.post(
  '/shortlist/:studentId',
  authenticate,
  authorize(UserRole.RECRUITER),
  connectionGuard(UserRole.STUDENT),
  asyncHandler(shortlistStudentController),
);
router.delete('/shortlist/:studentId', authenticate, authorize(UserRole.RECRUITER), asyncHandler(removeShortlistController));
router.get('/message-check/:studentId', authenticate, authorize(UserRole.RECRUITER), asyncHandler(messageCheckController));
router.post(
  '/message/:studentId',
  authenticate,
  authorize(UserRole.RECRUITER),
  relevanceGuard((req) => String(req.params.studentId)),
  asyncHandler(sendMessageController),
);
router.get('/jobs', authenticate, authorize(UserRole.RECRUITER), asyncHandler(getJobsController));
router.get(
  '/jobs/public/:recruiterId',
  authenticate,
  authorize(UserRole.STUDENT, UserRole.RECRUITER, UserRole.COLLEGE, UserRole.SCHOOL),
  asyncHandler(getPublicJobsController),
);
router.post('/jobs', authenticate, authorize(UserRole.RECRUITER), asyncHandler(createJobController));
router.patch('/jobs/:jobId', authenticate, authorize(UserRole.RECRUITER), asyncHandler(updateJobController));
router.delete('/jobs/:jobId', authenticate, authorize(UserRole.RECRUITER), asyncHandler(deleteJobController));
router.post('/jobs/:jobId/apply', authenticate, authorize(UserRole.STUDENT), asyncHandler(applyJobController));
router.get('/drives', authenticate, authorize(UserRole.RECRUITER), asyncHandler(getDrivesController));
router.post('/drives', authenticate, authorize(UserRole.RECRUITER), asyncHandler(createDriveController));
router.post('/drives/:driveId/register', authenticate, authorize(UserRole.STUDENT), asyncHandler(registerForDriveController));
router.post('/drives/:driveId/submit-score', authenticate, authorize(UserRole.RECRUITER), asyncHandler(submitDriveScoreController));
router.patch('/drives/:driveId/close', authenticate, authorize(UserRole.RECRUITER), asyncHandler(closeDriveController));
router.get('/colleges', authenticate, authorize(UserRole.RECRUITER), connectionGuard(UserRole.COLLEGE), asyncHandler(getCollegesController));
router.get('/onboarding', authenticate, authorize(UserRole.RECRUITER), asyncHandler(getOnboardingController));
router.post('/hired/:studentId', authenticate, authorize(UserRole.RECRUITER), connectionGuard(UserRole.STUDENT), asyncHandler(hiredStudentController));

export default router;
