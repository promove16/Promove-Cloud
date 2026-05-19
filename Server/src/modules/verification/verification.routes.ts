import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  verifyInvestorController,
  verifyStartupController,
  checkFraudController,
  flagFraudController,
  clearFraudController,
  getVerificationStatsController,
} from './verification.controller';

const router = Router();

router.use(authenticate);

router.post('/investor/:investorId', authorize(UserRole.ADMIN), asyncHandler(verifyInvestorController));
router.post('/startup/:startupId', authorize(UserRole.ADMIN), asyncHandler(verifyStartupController));
router.get('/fraud-check/:startupId', authorize(UserRole.ADMIN), asyncHandler(checkFraudController));
router.post('/fraud-check/:startupId/flag', authorize(UserRole.ADMIN), asyncHandler(flagFraudController));
router.post('/fraud-check/:startupId/clear', authorize(UserRole.ADMIN), asyncHandler(clearFraudController));
router.get('/stats', authorize(UserRole.ADMIN), asyncHandler(getVerificationStatsController));

export default router;
