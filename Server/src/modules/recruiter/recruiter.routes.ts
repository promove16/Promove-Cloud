import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { connectionGuard } from '../../middleware/connectionGuard';
import { relevanceGuard } from '../../middleware/relevanceGuard';
import { asyncHandler } from '../../utils/asyncHandler';
import { UserRole } from '../../types/roles.types';
import {
  applyJobController,
  createJobController,
  deleteJobController,
  getCollegesController,
  getLinkedCollegesController,
  getDashboardController,
  getJobApplicationsController,
  getStudentApplicationsController,
  getPublicJobController,
  getJobsController,
  getOnboardingController,
  getPublicJobsController,
  getTalentDiscoverController,
  getTalentPipelineController,
  getTalentProfileController,
  hiredStudentController,
  inviteStudentToJobController,
  messageCheckController,
  removeShortlistController,
  requestPartnershipController,
  sendMessageController,
  sendOnboardingReminderController,
  shortlistStudentController,
  updateJobController,
  updateJobApplicationController,
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
  '/jobs/public/job/:jobId',
  authenticate,
  authorize(UserRole.STUDENT, UserRole.RECRUITER, UserRole.COLLEGE, UserRole.SCHOOL),
  asyncHandler(getPublicJobController),
);
router.get(
  '/jobs/public/:recruiterId',
  authenticate,
  authorize(UserRole.STUDENT, UserRole.RECRUITER, UserRole.COLLEGE, UserRole.SCHOOL),
  asyncHandler(getPublicJobsController),
);
router.post('/jobs', authenticate, authorize(UserRole.RECRUITER), asyncHandler(createJobController));
router.patch('/jobs/:jobId', authenticate, authorize(UserRole.RECRUITER), asyncHandler(updateJobController));
router.delete('/jobs/:jobId', authenticate, authorize(UserRole.RECRUITER), asyncHandler(deleteJobController));
router.get('/applications/me', authenticate, authorize(UserRole.STUDENT), asyncHandler(getStudentApplicationsController));
router.get('/jobs/:jobId/applications', authenticate, authorize(UserRole.RECRUITER), asyncHandler(getJobApplicationsController));
router.patch(
  '/jobs/:jobId/applications/:studentId',
  authenticate,
  authorize(UserRole.RECRUITER),
  asyncHandler(updateJobApplicationController),
);
router.post(
  '/jobs/:jobId/invite/:studentId',
  authenticate,
  authorize(UserRole.RECRUITER),
  connectionGuard(UserRole.STUDENT),
  asyncHandler(inviteStudentToJobController),
);
router.post('/jobs/:jobId/apply', authenticate, authorize(UserRole.STUDENT), asyncHandler(applyJobController));
router.get('/colleges', authenticate, authorize(UserRole.RECRUITER), connectionGuard(UserRole.COLLEGE), asyncHandler(getCollegesController));
router.get('/colleges/linked', authenticate, authorize(UserRole.RECRUITER), asyncHandler(getLinkedCollegesController));
router.get('/onboarding', authenticate, authorize(UserRole.RECRUITER), asyncHandler(getOnboardingController));
router.post(
  '/onboarding/:studentId/reminder',
  authenticate,
  authorize(UserRole.RECRUITER),
  asyncHandler(sendOnboardingReminderController),
);
router.post('/hired/:studentId', authenticate, authorize(UserRole.RECRUITER), connectionGuard(UserRole.STUDENT), asyncHandler(hiredStudentController));
router.post(
  '/colleges/:collegeId/partnership-request',
  authenticate,
  authorize(UserRole.RECRUITER),
  asyncHandler(requestPartnershipController),
);

export default router;
