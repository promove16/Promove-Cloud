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
  createCollegeComplianceActionController,
  createCollegeComplianceAlertController,
  createCollegeComplianceIncidentController,
  createCollegeEventController,
  getCollegeComplianceOverviewController,
  getCollegeComplianceSubmissionController,
  getCollegeDashboardController,
  getCollegeEventRankingsController,
  getCollegePlacementController,
  getCollegeStudentJourneyController,
  getLatestCollegeComplianceReportController,
  importCollegeStudentCredentialsController,
  importCollegeStudentRosterController,
  previewCollegeStudentCredentialsController,
  listCollegeMentorshipProgramsController,
  listCollegeComplianceActionsController,
  listCollegeComplianceAlertsController,
  listCollegeComplianceIncidentsController,
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
  markCollegeComplianceAlertReadController,
  requestCollegeComplianceEvidenceEditController,
  reviewCollegeStudentVerificationController,
  submitCollegeComplianceSubmissionController,
  uploadCollegeComplianceEvidenceController,
  updateCollegeComplianceActionController,
  updateCollegeComplianceIncidentController,
  updatePlacementStatusController,
  listCollegeHiringEventsController,
} from './college.controller';

const router = Router();
const rosterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
const complianceEvidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
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
  '/compliance/overview',
  authorize(UserRole.COLLEGE),
  asyncHandler(getCollegeComplianceOverviewController),
);
router.get(
  '/compliance/submission',
  authorize(UserRole.COLLEGE),
  asyncHandler(getCollegeComplianceSubmissionController),
);
router.put(
  '/compliance/submission',
  authorize(UserRole.COLLEGE),
  asyncHandler(submitCollegeComplianceSubmissionController),
);
router.post(
  '/compliance/submission/evidence-edit-request',
  authorize(UserRole.COLLEGE),
  asyncHandler(requestCollegeComplianceEvidenceEditController),
);
router.post(
  '/compliance/evidence',
  authorize(UserRole.COLLEGE),
  complianceEvidenceUpload.single('file'),
  asyncHandler(uploadCollegeComplianceEvidenceController),
);
router.get(
  '/compliance/incidents',
  authorize(UserRole.COLLEGE),
  asyncHandler(listCollegeComplianceIncidentsController),
);
router.post(
  '/compliance/incidents',
  authorize(UserRole.COLLEGE),
  asyncHandler(createCollegeComplianceIncidentController),
);
router.patch(
  '/compliance/incidents/:incidentId',
  authorize(UserRole.COLLEGE),
  asyncHandler(updateCollegeComplianceIncidentController),
);
router.get(
  '/compliance/alerts',
  authorize(UserRole.COLLEGE),
  asyncHandler(listCollegeComplianceAlertsController),
);
router.post(
  '/compliance/alerts',
  authorize(UserRole.COLLEGE),
  asyncHandler(createCollegeComplianceAlertController),
);
router.patch(
  '/compliance/alerts/:alertId/read',
  authorize(UserRole.COLLEGE),
  asyncHandler(markCollegeComplianceAlertReadController),
);
router.get(
  '/compliance/actions',
  authorize(UserRole.COLLEGE),
  asyncHandler(listCollegeComplianceActionsController),
);
router.post(
  '/compliance/actions',
  authorize(UserRole.COLLEGE),
  asyncHandler(createCollegeComplianceActionController),
);
router.patch(
  '/compliance/actions/:actionId',
  authorize(UserRole.COLLEGE),
  asyncHandler(updateCollegeComplianceActionController),
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
  '/student-roster/preview-credentials',
  authorize(UserRole.COLLEGE),
  rosterUpload.single('file'),
  asyncHandler(previewCollegeStudentCredentialsController),
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
