import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  acknowledgeAgreementController,
  getAgreementByBidController,
  getAgreementController,
  listAgreementsController,
} from './agreement.controller';

const router = Router();

router.use(authenticate);

router.get('/me', asyncHandler(listAgreementsController));
router.get('/bid/:bidId', asyncHandler(getAgreementByBidController));
router.get('/:agreementId', asyncHandler(getAgreementController));
router.post('/:agreementId/acknowledge', asyncHandler(acknowledgeAgreementController));

export default router;
