import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  fundTransferController,
  getInvestorAuthorityController,
  getMyDealController,
  getMyDealsController,
  getStartupCapTableController,
  getStartupInvestorsController,
  updateDealStageController,
  updateInvestorRoleController,
} from './deal.controller';
import { expressSoleInterestController } from '../investor/investor.controller';

const dealsRouter = Router();
const startupsInvestmentRouter = Router();

dealsRouter.use(authenticate);
startupsInvestmentRouter.use(authenticate);

dealsRouter.get('/', asyncHandler(getMyDealsController));
dealsRouter.get('/:id', asyncHandler(getMyDealController));
dealsRouter.post('/:id/fund-transfer', authorize(UserRole.INVESTOR), asyncHandler(fundTransferController));
dealsRouter.patch('/:id/stage', authorize(UserRole.INVESTOR), asyncHandler(updateDealStageController));
dealsRouter.patch('/:id/investor-role', authorize(UserRole.ADMIN), asyncHandler(updateInvestorRoleController));
dealsRouter.get('/portfolio/authority', authorize(UserRole.INVESTOR), asyncHandler(getInvestorAuthorityController));

startupsInvestmentRouter.get('/:id/investors', asyncHandler(getStartupInvestorsController));
startupsInvestmentRouter.get('/:id/cap-table', asyncHandler(getStartupCapTableController));
startupsInvestmentRouter.post('/:id/sole-investor', authorize(UserRole.INVESTOR), asyncHandler(expressSoleInterestController));

export { dealsRouter, startupsInvestmentRouter };
export default dealsRouter;
