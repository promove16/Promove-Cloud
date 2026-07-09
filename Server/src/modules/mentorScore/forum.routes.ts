import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { asyncHandler } from '../../utils/asyncHandler';
import { UserRole } from '../../types/roles.types';
import {
  createPost,
  listPosts,
  getPost,
  createAnswer,
  markHelpful,
  markVerifiedSolution,
} from './forum.controller';

const router = Router();

// Posts — any authenticated user
router.get('/',                     authenticate, asyncHandler(listPosts));
router.get('/:id',                  authenticate, asyncHandler(getPost));
router.post('/',                    authenticate, asyncHandler(createPost));

// Answers — any authenticated user
router.post('/:postId/answers',     authenticate, asyncHandler(createAnswer));

// Helpful vote — any authenticated user
router.post('/answers/:answerId/helpful', authenticate, asyncHandler(markHelpful));

// Admin: mark verified solution
router.patch(
  '/answers/:answerId/verify',
  authenticate,
  authorize(UserRole.ADMIN),
  asyncHandler(markVerifiedSolution),
);

export default router;
