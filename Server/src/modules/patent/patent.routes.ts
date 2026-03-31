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
  listShowcasedPatents,
  showcasePatent,
} from './patent.controller';

const router = Router();

// ── Public showcase (any authenticated user) ─────────────────────────────────
router.get('/showcased', authenticate, asyncHandler(listShowcasedPatents));

// ── Self-filing ──────────────────────────────────────────────────────────────
router.post('/submit', authenticate, authorize(UserRole.STUDENT), asyncHandler(createPatent));
router.get('/mine', authenticate, authorize(UserRole.STUDENT), asyncHandler(listMyPatents));
router.patch('/:id/showcase', authenticate, authorize(UserRole.STUDENT), asyncHandler(showcasePatent));

// ── Assisted filing ──────────────────────────────────────────────────────────
router.post('/requests/submit', authenticate, authorize(UserRole.STUDENT), asyncHandler(createPatentRequest));
router.get('/requests/mine', authenticate, authorize(UserRole.STUDENT), asyncHandler(listMyPatentRequests));
router.get('/requests/:id', authenticate, authorize(UserRole.STUDENT), asyncHandler(getPatentRequest));

export default router;
