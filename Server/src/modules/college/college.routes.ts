import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { connectionGuard } from '../../middleware/connectionGuard';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  cancelCollegeStudentRosterInviteController,
  createCollegeMentorshipProgramController,
  createCollegeManagedStudentCredentialsController,
  createCollegeStudentAccessTokenController,
  createCollegeStudentRosterEntryController,
  createCollegeComplianceReportController,
  createCollegeEventController,
  getCollegeDashboardController,
  getCollegeEventRankingsController,
  getCollegePlacementController,
  getCollegeStudentJourneyController,
  getLatestCollegeComplianceReportController,
  importCollegeStudentCredentialsController,
  importCollegeStudentRosterController,
  listCollegeMentorshipProgramsController,
  listCollegePendingStudentVerificationsController,
  listCollegePatentsController,
  listCollegeProjectsController,
  listCollegeStudentRosterController,
  listCollegeStudentAccessTokensController,
  listCollegeEventsController,
  listCollegeInvestorsController,
  listCollegeRecruitersController,
  listCollegeStartupsController,
  listCollegeStudentsController,
  reviewCollegeStudentVerificationController,
  updatePlacementStatusController,
  listCollegeHiringEventsController,
} from './college.controller';

const router = Router();
const rosterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(authenticate);

router.get('/dashboard', authorize(UserRole.COLLEGE), asyncHandler(getCollegeDashboardController));
router.get('/students', authorize(UserRole.COLLEGE), asyncHandler(listCollegeStudentsController));
router.get('/projects', authorize(UserRole.COLLEGE), asyncHandler(listCollegeProjectsController));
router.get('/patents', authorize(UserRole.COLLEGE), asyncHandler(listCollegePatentsController));
router.get('/startups', authorize(UserRole.COLLEGE), asyncHandler(listCollegeStartupsController));
router.get(
  '/students/:id/journey',
  authorize(UserRole.COLLEGE),
  connectionGuard(UserRole.STUDENT),
  asyncHandler(getCollegeStudentJourneyController),
);
router.get(
  '/investors',
  authorize(UserRole.COLLEGE),
  connectionGuard(UserRole.INVESTOR),
  asyncHandler(listCollegeInvestorsController),
);
router.get(
  '/recruiters',
  authorize(UserRole.COLLEGE),
  connectionGuard(UserRole.RECRUITER),
  asyncHandler(listCollegeRecruitersController),
);
router.get('/placement', authorize(UserRole.COLLEGE), asyncHandler(getCollegePlacementController));
router.patch(
  '/placement/:studentId/status',
  authorize(UserRole.RECRUITER),
  asyncHandler(updatePlacementStatusController),
);
router.post('/events', authorize(UserRole.COLLEGE), asyncHandler(createCollegeEventController));
router.get('/events', authorize(UserRole.COLLEGE), asyncHandler(listCollegeEventsController));
router.get('/events/hiring', authorize(UserRole.COLLEGE), asyncHandler(listCollegeHiringEventsController));
router.get(
  '/events/:eventId/rankings',
  authorize(UserRole.COLLEGE),
  asyncHandler(getCollegeEventRankingsController),
);
router.post(
  '/compliance-report',
  authorize(UserRole.COLLEGE),
  asyncHandler(createCollegeComplianceReportController),
);
router.get(
  '/compliance-report/latest',
  authorize(UserRole.COLLEGE),
  asyncHandler(getLatestCollegeComplianceReportController),
);
router.get(
  '/student-access-tokens',
  authorize(UserRole.COLLEGE),
  asyncHandler(listCollegeStudentAccessTokensController),
);
router.post(
  '/student-access-tokens',
  authorize(UserRole.COLLEGE),
  asyncHandler(createCollegeStudentAccessTokenController),
);
router.get(
  '/student-roster',
  authorize(UserRole.COLLEGE),
  asyncHandler(listCollegeStudentRosterController),
);
router.delete(
  '/student-roster/:rosterEntryId',
  authorize(UserRole.COLLEGE),
  asyncHandler(cancelCollegeStudentRosterInviteController),
);
router.post(
  '/student-roster/manual',
  authorize(UserRole.COLLEGE),
  asyncHandler(createCollegeStudentRosterEntryController),
);
router.post(
  '/student-temp-credentials',
  authorize(UserRole.COLLEGE),
  asyncHandler(createCollegeManagedStudentCredentialsController),
);
router.get(
  '/mentorship-programs',
  authorize(UserRole.COLLEGE),
  asyncHandler(listCollegeMentorshipProgramsController),
);
router.post(
  '/mentorship-programs',
  authorize(UserRole.COLLEGE),
  asyncHandler(createCollegeMentorshipProgramController),
);
router.post(
  '/student-roster/import',
  authorize(UserRole.COLLEGE),
  rosterUpload.single('file'),
  asyncHandler(importCollegeStudentRosterController),
);
router.post(
  '/student-roster/import-credentials',
  authorize(UserRole.COLLEGE),
  rosterUpload.single('file'),
  asyncHandler(importCollegeStudentCredentialsController),
);
router.get(
  '/student-verifications',
  authorize(UserRole.COLLEGE),
  asyncHandler(listCollegePendingStudentVerificationsController),
);
router.patch(
  '/student-verifications/:studentId',
  authorize(UserRole.COLLEGE),
  asyncHandler(reviewCollegeStudentVerificationController),
);

export default router;
