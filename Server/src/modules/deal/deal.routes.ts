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
  getStartupBidBoardController,
  placeBidController,
  respondToDealController,
  getStartupCapTableController,
  getStartupInvestorsController,
  updateDealStageController,
  updateInvestorRoleController,
  linkWorkshopController,
  unlinkWorkshopController,
  addNegotiationMessageController,
  proposeNegotiationTermsController,
  agreeNegotiationTermsController,
} from './deal.controller';
import { expressSoleInterestController } from '../investor/investor.controller';

const dealsRouter = Router();
const startupsInvestmentRouter = Router();

dealsRouter.use(authenticate);
startupsInvestmentRouter.use(authenticate);

dealsRouter.get('/', asyncHandler(getMyDealsController));
dealsRouter.get('/:id', asyncHandler(getMyDealController));
dealsRouter.patch('/:id/founder-decision', authorize(UserRole.STUDENT), asyncHandler(respondToDealController));
dealsRouter.post('/:id/fund-transfer', authorize(UserRole.INVESTOR), asyncHandler(fundTransferController));
dealsRouter.patch('/:id/stage', authorize(UserRole.INVESTOR), asyncHandler(updateDealStageController));
dealsRouter.patch('/:id/investor-role', authorize(UserRole.ADMIN), asyncHandler(updateInvestorRoleController));
dealsRouter.patch('/:id/link-workshop', authorize(UserRole.STUDENT), asyncHandler(linkWorkshopController));
dealsRouter.patch('/:id/unlink-workshop', authorize(UserRole.STUDENT), asyncHandler(unlinkWorkshopController));
dealsRouter.post('/:id/negotiation-message', authorize(UserRole.STUDENT, UserRole.INVESTOR, UserRole.MENTOR), asyncHandler(addNegotiationMessageController));
dealsRouter.post('/:id/negotiation-propose', authorize(UserRole.STUDENT, UserRole.INVESTOR, UserRole.MENTOR), asyncHandler(proposeNegotiationTermsController));
dealsRouter.post('/:id/negotiation-agree', authorize(UserRole.STUDENT, UserRole.INVESTOR, UserRole.MENTOR), asyncHandler(agreeNegotiationTermsController));
dealsRouter.get('/portfolio/authority', authorize(UserRole.INVESTOR), asyncHandler(getInvestorAuthorityController));

startupsInvestmentRouter.get('/:id/investors', asyncHandler(getStartupInvestorsController));
startupsInvestmentRouter.get('/:id/cap-table', asyncHandler(getStartupCapTableController));
startupsInvestmentRouter.get('/:id/bids', asyncHandler(getStartupBidBoardController));
startupsInvestmentRouter.post('/:id/bid', authorize(UserRole.STUDENT, UserRole.INVESTOR, UserRole.MENTOR), asyncHandler(placeBidController));
startupsInvestmentRouter.post('/:id/sole-investor', authorize(UserRole.INVESTOR), asyncHandler(expressSoleInterestController));

export { dealsRouter, startupsInvestmentRouter };
export default dealsRouter;
