import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { createPatent, listMyPatents } from './patent.controller';

const router = Router();

router.post('/submit', authenticate, authorize(UserRole.STUDENT), asyncHandler(createPatent));
router.get('/mine', authenticate, authorize(UserRole.STUDENT), asyncHandler(listMyPatents));

export default router;
