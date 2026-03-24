import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authLimiter, withRateLimit } from '../../middleware/rateLimiter';
import { asyncHandler } from '../../utils/asyncHandler';
import { login, logout, refresh, register } from './auth.controller';

const router = Router();

router.post('/register', withRateLimit(authLimiter), asyncHandler(register));
router.post('/login', withRateLimit(authLimiter), asyncHandler(login));
router.post('/refresh', asyncHandler(refresh));
router.post('/logout', authenticate, asyncHandler(logout));

export default router;
