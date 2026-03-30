import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  approveRegistrationRequestController,
  approveAwardController,
  approveDealStageController,
  approvePatentController,
  getAnalyticsController,
  getInvestmentTypeAnalyticsController,
  getRegistrationRequestsController,
  getStartupCapTableController,
  getAwardsController,
  getCapacityController,
  getDealController,
  getDealsController,
  getPatentsController,
  getUsersController,
  rejectRegistrationRequestController,
  rejectAwardController,
  rejectPatentController,
  reviewRegistrationRequestController,
  resetSoleInvestorController,
  updateDealInvestorRoleController,
  updateUserAccessController,
  updateUserRoleController,
  verifyMilestoneController,
} from './admin.controller';
import {
  createAdminProblemController,
  listAdminProblemsController,
  updateAdminProblemController,
} from '../problemBank/problem.controller';

const router = Router();

router.use(authenticate, authorize(UserRole.ADMIN));

router.get('/users', asyncHandler(getUsersController));
router.get('/problems', asyncHandler(listAdminProblemsController));
router.post('/problems', asyncHandler(createAdminProblemController));
router.patch('/problems/:id', asyncHandler(updateAdminProblemController));
router.get('/registration-requests', asyncHandler(getRegistrationRequestsController));
router.patch('/registration-requests/:id/approve', asyncHandler(approveRegistrationRequestController));
router.patch('/registration-requests/:id/reject', asyncHandler(rejectRegistrationRequestController));
router.patch('/users/:id/role', asyncHandler(updateUserRoleController));
router.patch('/users/:id/access', asyncHandler(updateUserAccessController));
router.patch('/users/:id/registration-request', asyncHandler(reviewRegistrationRequestController));
router.get('/patents', asyncHandler(getPatentsController));
router.patch('/patents/:id/approve', asyncHandler(approvePatentController));
router.patch('/patents/:id/reject', asyncHandler(rejectPatentController));
router.get('/awards', asyncHandler(getAwardsController));
router.patch('/awards/:id/approve', asyncHandler(approveAwardController));
router.patch('/awards/:id/reject', asyncHandler(rejectAwardController));
router.get('/deals', asyncHandler(getDealsController));
router.get('/deals/:id', asyncHandler(getDealController));
router.patch('/deals/:id/approve-stage', asyncHandler(approveDealStageController));
router.patch('/deals/:id/investor-role', asyncHandler(updateDealInvestorRoleController));
router.get('/startups/:id/cap-table', asyncHandler(getStartupCapTableController));
router.post('/startups/:id/reset-sole-investor', asyncHandler(resetSoleInvestorController));
router.get('/investments/by-type', asyncHandler(getInvestmentTypeAnalyticsController));
router.patch('/milestones/:id/verify', asyncHandler(verifyMilestoneController));
router.get('/analytics', asyncHandler(getAnalyticsController));
router.get('/capacity', asyncHandler(getCapacityController));

export default router;
