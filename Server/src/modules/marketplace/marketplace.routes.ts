import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { getMarketplace, getMarketplaceProfile } from './marketplace.controller';

const router = Router();

router.get(
  '/',
  authenticate,
  authorize(UserRole.STUDENT, UserRole.SCHOOL, UserRole.COLLEGE),
  asyncHandler(getMarketplace),
);
router.get(
  '/:userId',
  authenticate,
  authorize(UserRole.STUDENT, UserRole.SCHOOL, UserRole.COLLEGE),
  asyncHandler(getMarketplaceProfile),
);

export default router;
