import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { writeLimiter, withRateLimit } from '../../middleware/rateLimiter';
import { asyncHandler } from '../../utils/asyncHandler';
import { postSmartChatMessage } from './smartChat.controller';

const router = Router();

router.post(
  '/',
  authenticate,
  withRateLimit(writeLimiter),
  asyncHandler(postSmartChatMessage),
);

export default router;
