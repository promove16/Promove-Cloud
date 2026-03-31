import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { asyncHandler } from '../../utils/asyncHandler';
import { getMySettings, updateMySettings } from './settings.controller';

const router = Router();

router.get('/', authenticate, asyncHandler(getMySettings));
router.put('/', authenticate, asyncHandler(updateMySettings));

export default router;
