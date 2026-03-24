import { redis } from '../config/redis';
import { scoreQueue } from '../config/bullmq';
import { io } from '../config/socket';
import { User } from '../modules/user/user.model';
import { ScoreEvent } from '../modules/innovationScore/score.model';
import { IScoreBreakdown } from '../modules/innovationScore/score.types';

export const SCORE_DELTAS = {
  PROBLEM_CLAIMED: 5,
  SKILL_COMPLETED: 8,
  PROGRESS_UPLOADED: 3,
  PATENT_SUBMITTED: 15,
  PATENT_APPROVED: 25,
  MVP_VERIFIED: 20,
  MARKET_READY_VERIFIED: 30,
  STARTUP_LAUNCHED: 10,
  AWARD_SUBMITTED: 0,
  AWARD_APPROVED: 15,
} as const;

export type ScoreTrigger = keyof typeof SCORE_DELTAS;

const BREAKDOWN_FIELD_MAP: Record<ScoreTrigger, keyof IScoreBreakdown | null> = {
  PROBLEM_CLAIMED: 'problemsClaimed',
  SKILL_COMPLETED: 'skillsCompleted',
  PROGRESS_UPLOADED: 'progressUploads',
  PATENT_SUBMITTED: 'patentsSubmitted',
  PATENT_APPROVED: 'patentsApproved',
  MVP_VERIFIED: 'mvpsVerified',
  MARKET_READY_VERIFIED: 'marketReadyVerified',
  STARTUP_LAUNCHED: 'startupsLaunched',
  AWARD_SUBMITTED: null,
  AWARD_APPROVED: 'awardsApproved',
};

export interface ApplyScoreParams {
  userId: string;
  trigger: ScoreTrigger;
  metadata?: Record<string, unknown>;
}

export const applyScore = async ({ userId, trigger, metadata }: ApplyScoreParams): Promise<number> => {
  const delta = SCORE_DELTAS[trigger];

  if (delta === 0) {
    const user = await User.findById(userId).select('innovationScore').lean();
    return user?.innovationScore ?? 0;
  }

  const breakdownField = BREAKDOWN_FIELD_MAP[trigger];
  const user = await User.findById(userId).select('innovationScore institutionId').lean();

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  const newScore = Math.min(200, user.innovationScore + delta);
  const actualDelta = newScore - user.innovationScore;

  if (actualDelta <= 0) {
    return user.innovationScore;
  }

  await User.findByIdAndUpdate(userId, {
    $inc: {
      innovationScore: actualDelta,
      ...(breakdownField ? { [`scoreBreakdown.${breakdownField}`]: 1 } : {}),
    },
  });

  await ScoreEvent.create({
    userId,
    trigger,
    delta: actualDelta,
    scoreAfter: newScore,
    metadata,
  });

  await redis.del(`score:${userId}`);
  await redis.zadd('lb:global', { score: newScore, member: userId });

  if (user.institutionId) {
    await redis.zadd(`lb:${String(user.institutionId)}`, { score: newScore, member: userId });
  }

  if (io) {
    io.of('/score').to(`user:${userId}`).emit('score:updated', {
      userId,
      newScore,
      delta: actualDelta,
      trigger,
    });
  }

  return newScore;
};

export const applyScoreAsync = async (params: ApplyScoreParams): Promise<void> => {
  await scoreQueue.add('apply-score', params, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  });
};
