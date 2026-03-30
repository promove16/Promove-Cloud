import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { authLimiter, withRateLimit } from '../../middleware/rateLimiter';
import { asyncHandler } from '../../utils/asyncHandler';
import { UserRole } from '../../types/roles.types';
import {
  changePasswordController,
  login,
  logout,
  refresh,
  register,
  registerRequest,
  submitInstitutionTokenAfterRegister,
} from './auth.controller';

const router = Router();

router.post('/register', asyncHandler(register));
router.post('/register-request', asyncHandler(registerRequest));
router.post('/login', withRateLimit(authLimiter), asyncHandler(login));
// OAuth routes are temporarily disabled. Manual credential login remains active.
// router.get('/oauth/:provider', withRateLimit(authLimiter), asyncHandler(startOAuth));
// router.get('/oauth/:provider/callback', asyncHandler(oauthCallback));
router.post('/refresh', asyncHandler(refresh));
router.post('/logout', authenticate, asyncHandler(logout));
router.put('/change-password', authenticate, asyncHandler(changePasswordController));
router.post(
  '/submit-institution-token',
  authenticate,
  authorize(UserRole.STUDENT),
  asyncHandler(submitInstitutionTokenAfterRegister),
);

export default router;
