import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { connectionGuard } from '../../middleware/connectionGuard';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  createMentorFeedbackController,
  createMentorSessionController,
  deleteMentorSessionController,
  getMentorDashboardController,
  getMentorSessionController,
  getMentorStudentProfileController,
  getMentorWorkspaceController,
  listMentorSessionsController,
  listMentorStudentsController,
  updateMentorSessionController,
} from './mentor.controller';

const router = Router();

router.use(authenticate, authorize(UserRole.MENTOR));

router.get('/dashboard', asyncHandler(getMentorDashboardController));
router.get('/students', connectionGuard(UserRole.STUDENT), asyncHandler(listMentorStudentsController));
router.get('/students/:id', connectionGuard(UserRole.STUDENT), asyncHandler(getMentorStudentProfileController));
router.get(
  '/students/:id/workspace/:workspaceId',
  connectionGuard(UserRole.STUDENT),
  asyncHandler(getMentorWorkspaceController),
);
router.post('/sessions', connectionGuard(UserRole.STUDENT), asyncHandler(createMentorSessionController));
router.get('/sessions', asyncHandler(listMentorSessionsController));
router.get('/sessions/:id', asyncHandler(getMentorSessionController));
router.patch('/sessions/:id', asyncHandler(updateMentorSessionController));
router.delete('/sessions/:id', asyncHandler(deleteMentorSessionController));
router.post('/feedback/:studentId', connectionGuard(UserRole.STUDENT), asyncHandler(createMentorFeedbackController));

export default router;
