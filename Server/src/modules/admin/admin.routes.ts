import multer from 'multer';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import {
  createAdminMentorshipProgramController,
  createMentorProfileController,
  approveRegistrationRequestController,
  approveAwardController,
  approveDealStageController,
  approvePatentController,
  getAnalyticsController,
  getAnalyticsLogsController,
  getAnalyticsUserDetailController,
  getAnalyticsUsersController,
  getComplianceSubmissionsController,
  getInvestmentTypeAnalyticsController,
  getMentorsController,
  getMentorshipProgramsController,
  getRegistrationRequestsController,
  getStartupCapTableController,
  getStartupReviewsController,
  getAwardsController,
  getDealController,
  getDealsController,
  getPatentsController,
  getUsersController,
  deleteUserController,
  rejectRegistrationRequestController,
  rejectAwardController,
  rejectPatentController,
  reviewDealController,
  reviewDealCancellationController,
  reviewComplianceSubmissionController,
  reviewRegistrationRequestController,
  reviewStartupController,
  unlockLaunchFormController,
  reviewMentorshipProgramController,
  resetSoleInvestorController,
  updateDealInvestorRoleController,
  updateUserAccessController,
  updateUserRoleController,
  verifyMilestoneController,
} from './admin.controller';
import {
  createAdminProblemController,
  deleteAdminProblemController,
  listAdminProblemsController,
  listProblemReviewRequestsController,
  reviewProblemSubmissionController,
  updateAdminProblemController,
} from '../problemBank/problem.controller';
import {
  listPatentRequestsController,
  getPatentRequestDetailController,
  updateStatusController,
  assignCaseController,
  updateIpoDetailsController,
  addNoteController,
  addTimelineController,
  reviewDocumentController,
  uploadOfficialHandoverDocumentController,
  completeOfficialHandoverController,
} from '../patent/patentRequestAdmin.controller';
import {
  sendMessageController as patentSendMessageController,
  listMessagesController as patentListMessagesController,
  markReadController as patentMarkReadController,
  unreadCountController as patentUnreadCountController,
} from '../patent/patentConversation.controller';

const router = Router();
const pdfFileNamePattern = /\.pdf$/i;
const patentHandoverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || pdfFileNamePattern.test(file.originalname);
    const isImage = file.mimetype.startsWith('image/');
    if (!isPdf && !isImage) {
      cb(new ApiError(400, 'INVALID_FILE_TYPE', 'Only PDF or image files are allowed.'));
      return;
    }
    cb(null, true);
  },
});

router.use(authenticate, authorize(UserRole.ADMIN));

router.get('/users', asyncHandler(getUsersController));
router.get('/problems', asyncHandler(listAdminProblemsController));
router.post('/problems', asyncHandler(createAdminProblemController));
router.patch('/problems/:id', asyncHandler(updateAdminProblemController));
router.delete('/problems/:id', asyncHandler(deleteAdminProblemController));
router.get('/problems/review-requests', asyncHandler(listProblemReviewRequestsController));
router.patch('/problems/review-requests/:submissionId', asyncHandler(reviewProblemSubmissionController));
router.get('/registration-requests', asyncHandler(getRegistrationRequestsController));
router.get('/compliance-submissions', asyncHandler(getComplianceSubmissionsController));
router.patch('/compliance-submissions/:id/review', asyncHandler(reviewComplianceSubmissionController));
router.patch('/registration-requests/:id/approve', asyncHandler(approveRegistrationRequestController));
router.patch('/registration-requests/:id/reject', asyncHandler(rejectRegistrationRequestController));
router.patch('/users/:id/role', asyncHandler(updateUserRoleController));
router.patch('/users/:id/access', asyncHandler(updateUserAccessController));
router.delete('/users/:id', asyncHandler(deleteUserController));
router.patch('/users/:id/registration-request', asyncHandler(reviewRegistrationRequestController));
router.get('/mentors', asyncHandler(getMentorsController));
router.post('/mentors', asyncHandler(createMentorProfileController));
router.get('/mentorship-programs', asyncHandler(getMentorshipProgramsController));
router.post('/mentorship-programs', asyncHandler(createAdminMentorshipProgramController));
router.patch('/mentorship-programs/:id', asyncHandler(reviewMentorshipProgramController));
router.get('/patents', asyncHandler(getPatentsController));
router.patch('/patents/:id/approve', asyncHandler(approvePatentController));
router.patch('/patents/:id/reject', asyncHandler(rejectPatentController));

// ── Patent Request (Assisted Filing) Management ──────────────────────────────
router.get('/patent-requests', asyncHandler(listPatentRequestsController));
router.get('/patent-requests/:id', asyncHandler(getPatentRequestDetailController));
router.patch('/patent-requests/:id/status', asyncHandler(updateStatusController));
router.patch('/patent-requests/:id/assign', asyncHandler(assignCaseController));
router.patch('/patent-requests/:id/ipo-details', asyncHandler(updateIpoDetailsController));
router.patch('/patent-requests/:id/documents/:documentId/review', asyncHandler(reviewDocumentController));
router.post(
  '/patent-requests/:id/handover/documents',
  patentHandoverUpload.single('file'),
  asyncHandler(uploadOfficialHandoverDocumentController),
);
router.patch('/patent-requests/:id/handover', asyncHandler(completeOfficialHandoverController));
router.post('/patent-requests/:id/notes', asyncHandler(addNoteController));
router.post('/patent-requests/:id/timeline', asyncHandler(addTimelineController));
router.get('/patent-requests/:id/messages', asyncHandler(patentListMessagesController));
router.post('/patent-requests/:id/messages', asyncHandler(patentSendMessageController));
router.patch('/patent-requests/:id/messages/read', asyncHandler(patentMarkReadController));
router.get('/patent-requests/:id/messages/unread', asyncHandler(patentUnreadCountController));
router.get('/awards', asyncHandler(getAwardsController));
router.patch('/awards/:id/approve', asyncHandler(approveAwardController));
router.patch('/awards/:id/reject', asyncHandler(rejectAwardController));
router.get('/deals', asyncHandler(getDealsController));
router.get('/deals/:id', asyncHandler(getDealController));
router.patch('/deals/:id/approve-stage', asyncHandler(approveDealStageController));
router.patch('/deals/:id/cancellation', asyncHandler(reviewDealCancellationController));
router.patch('/deals/:id/review', asyncHandler(reviewDealController));
router.patch('/deals/:id/investor-role', asyncHandler(updateDealInvestorRoleController));
router.get('/startups', asyncHandler(getStartupReviewsController));
router.patch('/startups/:id/review', asyncHandler(reviewStartupController));
router.patch('/startups/:id/unlock-launch-form', asyncHandler(unlockLaunchFormController));
router.get('/startups/:id/cap-table', asyncHandler(getStartupCapTableController));
router.post('/startups/:id/reset-sole-investor', asyncHandler(resetSoleInvestorController));
router.get('/investments/by-type', asyncHandler(getInvestmentTypeAnalyticsController));
router.patch('/milestones/:id/verify', asyncHandler(verifyMilestoneController));
router.get('/analytics', asyncHandler(getAnalyticsController));
router.get('/analytics/logs', asyncHandler(getAnalyticsLogsController));
router.get('/analytics/users', asyncHandler(getAnalyticsUsersController));
router.get('/analytics/users/:userId', asyncHandler(getAnalyticsUserDetailController));

export default router;
