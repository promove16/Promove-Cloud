import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { asyncHandler } from '../../utils/asyncHandler';
import { UserRole } from '../../types/roles.types';
import {
  getMyMentorScore,
  getMyScoreHistory,
  getMySubmissions,
  submitLabSync,
  submitCurriculumPdf,
  submitClassPhoto,
  submitIndustrySession,
  submitDemoDay,
  endSessionToken,
  rateSession,
  completeTrainingModule,
  completeQuiz,
} from './mentorScore.controller';

const router = Router();

const mentorOnly = [authenticate, authorize(UserRole.MENTOR)];

// Score dashboard
router.get('/me',          ...mentorOnly, asyncHandler(getMyMentorScore));
router.get('/me/history',  ...mentorOnly, asyncHandler(getMyScoreHistory));
router.get('/submissions', ...mentorOnly, asyncHandler(getMySubmissions));

// Phase 1 – Training (called internally by training module, or directly)
router.post('/training/complete',      ...mentorOnly, asyncHandler(completeTrainingModule));
router.post('/training/quiz',          ...mentorOnly, asyncHandler(completeQuiz));

// Phase 1 – Empowerment
router.post('/submit/lab-sync',        ...mentorOnly, asyncHandler(submitLabSync));
router.post('/submit/curriculum',      ...mentorOnly, asyncHandler(submitCurriculumPdf));
router.post('/submit/class-photo',     ...mentorOnly, asyncHandler(submitClassPhoto));

// Phase 2 – Institutional Incubation
router.post('/submit/industry-session', ...mentorOnly, asyncHandler(submitIndustrySession));
router.post('/submit/demo-day',         ...mentorOnly, asyncHandler(submitDemoDay));

// Phase 3 – Session Token (called by student to release points to mentor)
router.post('/sessions/:sessionId/end',  authenticate, asyncHandler(endSessionToken));
router.post('/sessions/:sessionId/rate', authenticate, asyncHandler(rateSession));

export default router;
