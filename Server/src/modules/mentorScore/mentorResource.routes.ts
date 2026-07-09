import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { asyncHandler } from '../../utils/asyncHandler';
import { UserRole } from '../../types/roles.types';
import {
  uploadResource,
  listResources,
  downloadResource,
  toggleSaveResource,
  flagAsCurated,
} from './mentorResource.controller';

const router = Router();

// Public list (any authenticated user)
router.get('/', authenticate, asyncHandler(listResources));

// Download (any authenticated user — tracks count + milestone)
router.post('/:id/download', authenticate, asyncHandler(downloadResource));

// Save/unsave toggle (any authenticated user)
router.post('/:id/save', authenticate, asyncHandler(toggleSaveResource));

// Mentor: upload
router.post('/', authenticate, authorize(UserRole.MENTOR), asyncHandler(uploadResource));

// Admin: flag as curated
router.patch(
  '/:id/curate',
  authenticate,
  authorize(UserRole.ADMIN),
  asyncHandler(flagAsCurated),
);

export default router;
