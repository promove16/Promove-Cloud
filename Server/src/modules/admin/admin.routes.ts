import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  approveAwardController,
  approveDealStageController,
  approvePatentController,
  getAnalyticsController,
  getAwardsController,
  getCapacityController,
  getDealController,
  getDealsController,
  getPatentsController,
  getUsersController,
  rejectAwardController,
  rejectPatentController,
  updateUserAccessController,
  updateUserRoleController,
  verifyMilestoneController,
} from './admin.controller';

const router = Router();

router.use(authenticate, authorize(UserRole.ADMIN));

router.get('/users', asyncHandler(getUsersController));
router.patch('/users/:id/role', asyncHandler(updateUserRoleController));
router.patch('/users/:id/access', asyncHandler(updateUserAccessController));
router.get('/patents', asyncHandler(getPatentsController));
router.patch('/patents/:id/approve', asyncHandler(approvePatentController));
router.patch('/patents/:id/reject', asyncHandler(rejectPatentController));
router.get('/awards', asyncHandler(getAwardsController));
router.patch('/awards/:id/approve', asyncHandler(approveAwardController));
router.patch('/awards/:id/reject', asyncHandler(rejectAwardController));
router.get('/deals', asyncHandler(getDealsController));
router.get('/deals/:id', asyncHandler(getDealController));
router.patch('/deals/:id/approve-stage', asyncHandler(approveDealStageController));
router.patch('/milestones/:id/verify', asyncHandler(verifyMilestoneController));
router.get('/analytics', asyncHandler(getAnalyticsController));
router.get('/capacity', asyncHandler(getCapacityController));

export default router;
