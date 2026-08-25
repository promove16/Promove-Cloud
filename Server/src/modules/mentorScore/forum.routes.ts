import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { asyncHandler } from '../../utils/asyncHandler';
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

// Verify an answer as the solution — the post author (student) or an admin
// Permission is enforced inside the controller.
router.patch(
  '/answers/:answerId/verify',
  authenticate,
  asyncHandler(markVerifiedSolution),
);

export default router;
