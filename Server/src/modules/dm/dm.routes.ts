import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { asyncHandler } from '../../utils/asyncHandler';
import { listConversations, getThread, sendMessage } from './dm.controller';

const router = Router();

router.use(authenticate);

router.get('/conversations', asyncHandler(listConversations));
router.get('/:userId', asyncHandler(getThread));
router.post('/:userId', asyncHandler(sendMessage));

export default router;
