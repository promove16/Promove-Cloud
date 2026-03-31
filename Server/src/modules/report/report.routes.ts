import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { asyncHandler } from '../../utils/asyncHandler';
import { createReport, getMyReports } from './report.controller';

const router = Router();

router.use(authenticate);

router.post('/', asyncHandler(createReport));
router.get('/', asyncHandler(getMyReports));

export default router;
