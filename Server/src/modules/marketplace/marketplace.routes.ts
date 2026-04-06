import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { getMarketplace, getMarketplaceEntityDetail, getMarketplaceProfile } from './marketplace.controller';

const router = Router();

router.get(
  '/',
  authenticate,
  authorize(
    UserRole.STUDENT,
    UserRole.SCHOOL,
    UserRole.COLLEGE,
    UserRole.MENTOR,
    UserRole.INVESTOR,
    UserRole.RECRUITER,
    UserRole.ADMIN,
  ),
  asyncHandler(getMarketplace),
);
router.get(
  '/entities/:entityType/:entityId',
  authenticate,
  authorize(
    UserRole.STUDENT,
    UserRole.SCHOOL,
    UserRole.COLLEGE,
    UserRole.MENTOR,
    UserRole.INVESTOR,
    UserRole.RECRUITER,
    UserRole.ADMIN,
  ),
  asyncHandler(getMarketplaceEntityDetail),
);
router.get(
  '/:userId',
  authenticate,
  authorize(
    UserRole.STUDENT,
    UserRole.SCHOOL,
    UserRole.COLLEGE,
    UserRole.MENTOR,
    UserRole.INVESTOR,
    UserRole.RECRUITER,
    UserRole.ADMIN,
  ),
  asyncHandler(getMarketplaceProfile),
);

export default router;
