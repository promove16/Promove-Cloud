import { NextFunction, Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { connectionGuard } from '../../middleware/connectionGuard';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import {
  expressInterestController,
  getInvestorDashboardController,
  getInvestorDealController,
  getInvestorPortfolioController,
  getInvestorStartupController,
  listInvestorDealsController,
  listInvestorInstitutionsController,
  listInvestorStartupsController,
  updateInvestorDealStageController,
} from './investor.controller';

const router = Router();

const institutionTypeGuard = (req: Request, res: Response, next: NextFunction) => {
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;

  if (type !== 'school' && type !== 'college') {
    return next(new ApiError(400, 'INVALID_INSTITUTION_TYPE', 'type must be school or college'));
  }

  return connectionGuard(type === 'school' ? UserRole.SCHOOL : UserRole.COLLEGE)(req, res, next);
};

router.use(authenticate);

router.get('/dashboard', authorize(UserRole.INVESTOR), asyncHandler(getInvestorDashboardController));
router.get(
  '/startups',
  authorize(UserRole.INVESTOR),
  connectionGuard(UserRole.STUDENT),
  asyncHandler(listInvestorStartupsController),
);
router.get(
  '/startups/:id',
  authorize(UserRole.INVESTOR),
  connectionGuard(UserRole.STUDENT),
  asyncHandler(getInvestorStartupController),
);
router.post(
  '/express-interest/:startupId',
  authorize(UserRole.INVESTOR),
  connectionGuard(UserRole.STUDENT),
  asyncHandler(expressInterestController),
);
router.get('/deals', authorize(UserRole.INVESTOR), asyncHandler(listInvestorDealsController));
router.get('/deals/:id', authorize(UserRole.INVESTOR), asyncHandler(getInvestorDealController));
router.patch('/deals/:id/stage', authorize(UserRole.INVESTOR), asyncHandler(updateInvestorDealStageController));
router.get(
  '/institutions',
  authorize(UserRole.INVESTOR),
  institutionTypeGuard,
  asyncHandler(listInvestorInstitutionsController),
);
router.get('/portfolio', authorize(UserRole.INVESTOR), asyncHandler(getInvestorPortfolioController));

export default router;

