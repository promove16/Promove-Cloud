import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  enrichMeFromSocialLinks,
  getMe,
  getPublicStudentProfile,
  githubOauthCallback,
  getMySessions,
  getMyOnboarding,
  claimMyOnboardingStep,
  importGithubRepositories,
  launchToRecruiters,
  listGithubRepositories,
  patchMe,
  startGithubOauth,
  syncGithubProof,
  trackMeActivity,
  searchUsers,
} from './user.controller';

const router = Router();

router.get('/github/callback', asyncHandler(githubOauthCallback));
router.get('/public/:profileSlug', asyncHandler(getPublicStudentProfile));
router.get('/search', authenticate, asyncHandler(searchUsers));
router.get('/me', authenticate, asyncHandler(getMe));
router.patch('/me', authenticate, asyncHandler(patchMe));
router.post('/me/activity', authenticate, asyncHandler(trackMeActivity));
router.post('/me/social-enrich', authenticate, asyncHandler(enrichMeFromSocialLinks));
router.get('/me/github/oauth/start', authenticate, asyncHandler(startGithubOauth));
router.post('/me/github/sync', authenticate, asyncHandler(syncGithubProof));
router.get('/me/github/repositories', authenticate, asyncHandler(listGithubRepositories));
router.post('/me/github/import', authenticate, asyncHandler(importGithubRepositories));
router.get('/me/onboarding', authenticate, asyncHandler(getMyOnboarding));
router.post('/me/onboarding/claim/:stepId', authenticate, asyncHandler(claimMyOnboardingStep));
router.get('/me/sessions', authenticate, authorize(UserRole.STUDENT), asyncHandler(getMySessions));
router.post(
  '/me/launch-to-recruiters',
  authenticate,
  authorize(UserRole.STUDENT),
  asyncHandler(launchToRecruiters),
);

export default router;
