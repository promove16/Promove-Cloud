import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { getMe, getMySessions, launchToRecruiters, patchMe } from './user.controller';

const router = Router();

router.get('/me', authenticate, asyncHandler(getMe));
router.patch('/me', authenticate, asyncHandler(patchMe));
router.get('/me/sessions', authenticate, authorize(UserRole.STUDENT), asyncHandler(getMySessions));
router.post(
  '/me/launch-to-recruiters',
  authenticate,
  authorize(UserRole.STUDENT),
  asyncHandler(launchToRecruiters),
);

export default router;
