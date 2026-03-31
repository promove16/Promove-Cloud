import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { asyncHandler } from '../../utils/asyncHandler';
import { listConversations, getThread, sendMessage, getPartnerProfile, markAsRead } from './dm.controller';

const router = Router();

router.use(authenticate);

router.get('/conversations', asyncHandler(listConversations));
router.get('/partner/:userId', asyncHandler(getPartnerProfile));
router.get('/:userId', asyncHandler(getThread));
router.post('/:userId', asyncHandler(sendMessage));
router.patch('/:userId/read', asyncHandler(markAsRead));

export default router;
