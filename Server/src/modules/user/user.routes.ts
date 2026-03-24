import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { asyncHandler } from '../../utils/asyncHandler';
import { getMe, patchMe } from './user.controller';

const router = Router();

router.get('/me', authenticate, asyncHandler(getMe));
router.patch('/me', authenticate, asyncHandler(patchMe));

export default router;
