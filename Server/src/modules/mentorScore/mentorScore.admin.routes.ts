import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { asyncHandler } from '../../utils/asyncHandler';
import { UserRole } from '../../types/roles.types';
import {
  listVerificationTasks,
  approveVerificationTask,
  rejectVerificationTask,
  getMentorLeaderboardHandler,
  getMentorScoreHistory,
  adminAdjustMentorScore,
  triggerRebuildCache,
  triggerDecay,
  recordEquityLOI,
  awardOutcomeBonus,
  awardContentCreatorBonus,
} from './mentorScore.admin.controller';

const router = Router();

router.use(authenticate, authorize(UserRole.ADMIN));

// Verification queue
router.get('/verifications',                    asyncHandler(listVerificationTasks));
router.post('/verifications/:id/approve',       asyncHandler(approveVerificationTask));
router.post('/verifications/:id/reject',        asyncHandler(rejectVerificationTask));

// Leaderboard
router.get('/leaderboard',                      asyncHandler(getMentorLeaderboardHandler));

// Score inspection
router.get('/score-history/:mentorId',          asyncHandler(getMentorScoreHistory));

// Manual adjustment
router.post('/score/adjust',                    asyncHandler(adminAdjustMentorScore));

// Equity LOI recording
router.post('/loi',                             asyncHandler(recordEquityLOI));

// Outcome Bonus (student wins competition or gets funded)
router.post('/outcome-bonus',                   asyncHandler(awardOutcomeBonus));

// Content Creator Bonus (syllabus content selected)
router.post('/content-creator-bonus',          asyncHandler(awardContentCreatorBonus));

// Maintenance (dev/admin tools)
router.post('/score/rebuild/:mentorId',         asyncHandler(triggerRebuildCache));
router.post('/score/apply-decay',               asyncHandler(triggerDecay));

export default router;
