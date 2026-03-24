import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { getMarketplace, getMarketplaceProfile } from './marketplace.controller';

const router = Router();

router.get('/', authenticate, authorize(UserRole.STUDENT), asyncHandler(getMarketplace));
router.get('/:userId', authenticate, asyncHandler(getMarketplaceProfile));

export default router;
