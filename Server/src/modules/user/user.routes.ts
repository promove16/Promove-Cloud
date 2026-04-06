import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  acceptMyTerms,
  enrichMeFromSocialLinks,
  getMe,
  getMySessions,
  launchToRecruiters,
  patchMe,
  searchUsers,
} from './user.controller';

const router = Router();

router.get('/search', authenticate, asyncHandler(searchUsers));
router.get('/me', authenticate, asyncHandler(getMe));
router.patch('/me', authenticate, asyncHandler(patchMe));
router.post('/me/terms-acceptance', authenticate, asyncHandler(acceptMyTerms));
router.post('/me/social-enrich', authenticate, asyncHandler(enrichMeFromSocialLinks));
router.get('/me/sessions', authenticate, authorize(UserRole.STUDENT), asyncHandler(getMySessions));
router.post(
  '/me/launch-to-recruiters',
  authenticate,
  authorize(UserRole.STUDENT),
  asyncHandler(launchToRecruiters),
);

export default router;
