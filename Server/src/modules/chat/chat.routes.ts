import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { getChatHistory } from './chat.controller';

const router = Router();

router.get(
  '/workspace/:workspaceId',
  authenticate,
  authorize(UserRole.STUDENT, UserRole.MENTOR, UserRole.INVESTOR),
  asyncHandler(getChatHistory),
);

export default router;
