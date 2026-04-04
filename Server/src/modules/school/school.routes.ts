import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { connectionGuard } from '../../middleware/connectionGuard';
import { UserRole } from '../../types/roles.types';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  cancelSchoolStudentRosterInviteController,
  createSchoolMentorshipProgramController,
  createSchoolManagedStudentCredentialsController,
  createSchoolStudentAccessTokenController,
  createSchoolStudentRosterEntryController,
  createSchoolComplianceReportController,
  getLatestSchoolComplianceReportController,
  getSchoolDashboardController,
  getSchoolStudentJourneyController,
  importSchoolStudentCredentialsController,
  importSchoolStudentRosterController,
  listSchoolEventsController,
  listSchoolMentorshipProgramsController,
  listSchoolPatentsController,
  listSchoolProjectsController,
  listSchoolStudentRosterController,
  listSchoolPendingStudentVerificationsController,
  listSchoolStudentAccessTokensController,
  listSchoolInvestorsController,
  listSchoolStartupsController,
  listSchoolStudentsController,
  reviewSchoolStudentVerificationController,
} from './school.controller';

const router = Router();
const rosterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const rejectRecruiterTargets = (req: Request, _res: Response, next: NextFunction) => {
  const path = req.path.toLowerCase();
  const targetRole = typeof req.query.targetRole === 'string' ? req.query.targetRole.toLowerCase() : '';

  if (path.includes('recruiter') || targetRole === 'recruiter') {
    return next(
      new ApiError(
        403,
        'RECRUITER_ACCESS_BLOCKED',
        'School accounts cannot access recruiter resources',
      ),
    );
  }

  return next();
};

router.use(authenticate, authorize(UserRole.SCHOOL), rejectRecruiterTargets);

router.get('/dashboard', asyncHandler(getSchoolDashboardController));
router.get('/students', asyncHandler(listSchoolStudentsController));
router.get('/students/:id/journey', asyncHandler(getSchoolStudentJourneyController));
router.get('/projects', asyncHandler(listSchoolProjectsController));
router.get('/patents', asyncHandler(listSchoolPatentsController));
router.get('/startups', asyncHandler(listSchoolStartupsController));
router.get('/events', asyncHandler(listSchoolEventsController));
router.get(
  '/investors',
  connectionGuard(UserRole.INVESTOR),
  asyncHandler(listSchoolInvestorsController),
);
router.post('/compliance-report', asyncHandler(createSchoolComplianceReportController));
router.get(
  '/compliance-report/latest',
  asyncHandler(getLatestSchoolComplianceReportController),
);
router.get('/student-access-tokens', asyncHandler(listSchoolStudentAccessTokensController));
router.post('/student-access-tokens', asyncHandler(createSchoolStudentAccessTokenController));
router.get('/student-roster', asyncHandler(listSchoolStudentRosterController));
router.post('/student-roster/manual', asyncHandler(createSchoolStudentRosterEntryController));
router.delete('/student-roster/:rosterEntryId', asyncHandler(cancelSchoolStudentRosterInviteController));
router.get('/mentorship-programs', asyncHandler(listSchoolMentorshipProgramsController));
router.post('/mentorship-programs', asyncHandler(createSchoolMentorshipProgramController));
router.post(
  '/student-temp-credentials',
  asyncHandler(createSchoolManagedStudentCredentialsController),
);
router.post(
  '/student-roster/import',
  rosterUpload.single('file'),
  asyncHandler(importSchoolStudentRosterController),
);
router.post(
  '/student-roster/import-credentials',
  rosterUpload.single('file'),
  asyncHandler(importSchoolStudentCredentialsController),
);
router.get(
  '/student-verifications',
  asyncHandler(listSchoolPendingStudentVerificationsController),
);
router.patch(
  '/student-verifications/:studentId',
  asyncHandler(reviewSchoolStudentVerificationController),
);

export default router;
