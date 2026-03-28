import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { authLimiter, withRateLimit } from '../../middleware/rateLimiter';
import { asyncHandler } from '../../utils/asyncHandler';
import { UserRole } from '../../types/roles.types';
import {
  login,
  logout,
  refresh,
  register,
  submitInstitutionTokenAfterRegister,
} from './auth.controller';

const router = Router();

router.post('/register', asyncHandler(register));
router.post('/login', withRateLimit(authLimiter), asyncHandler(login));
router.post('/refresh', asyncHandler(refresh));
router.post('/logout', authenticate, asyncHandler(logout));
router.post(
  '/submit-institution-token',
  authenticate,
  authorize(UserRole.STUDENT),
  asyncHandler(submitInstitutionTokenAfterRegister),
);

export default router;
