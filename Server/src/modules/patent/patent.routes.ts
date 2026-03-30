import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  createPatent,
  createPatentRequest,
  getPatentRequest,
  listMyPatentRequests,
  listMyPatents,
} from './patent.controller';

const router = Router();

// ── Self-filing ──────────────────────────────────────────────────────────────
router.post('/submit', authenticate, authorize(UserRole.STUDENT), asyncHandler(createPatent));
router.get('/mine', authenticate, authorize(UserRole.STUDENT), asyncHandler(listMyPatents));

// ── Assisted filing ──────────────────────────────────────────────────────────
router.post('/requests/submit', authenticate, authorize(UserRole.STUDENT), asyncHandler(createPatentRequest));
router.get('/requests/mine', authenticate, authorize(UserRole.STUDENT), asyncHandler(listMyPatentRequests));
router.get('/requests/:id', authenticate, authorize(UserRole.STUDENT), asyncHandler(getPatentRequest));

export default router;
