import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  acceptRequestController,
  createRequestController,
  declineRequestController,
  getRequestController,
  listIncomingRequestsController,
  listOutgoingRequestsController,
  withdrawRequestController,
} from './request.controller';

const router = Router();

router.use(authenticate);

router.get('/incoming', asyncHandler(listIncomingRequestsController));
router.get('/outgoing', asyncHandler(listOutgoingRequestsController));
router.post('/', asyncHandler(createRequestController));
router.get('/:id', asyncHandler(getRequestController));
router.post('/:id/accept', asyncHandler(acceptRequestController));
router.post('/:id/decline', asyncHandler(declineRequestController));
router.post('/:id/withdraw', asyncHandler(withdrawRequestController));

export default router;
