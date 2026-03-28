import { User } from '../modules/user/user.model';
import { IUser } from '../modules/user/user.types';
import { redis } from '../config/redis';
import { scoreQueue } from '../config/bullmq';
import { io } from '../config/socket';
import { logError } from '../config/logger';
import { ScoreEvent } from '../modules/innovationScore/score.model';

export const SCORE_DELTAS = {
  PROBLEM_CLAIMED:         5,
  SKILL_COMPLETED:         8,
  PROGRESS_UPLOADED:       3,
  PATENT_SUBMITTED:        15,
  PATENT_APPROVED:         25,
  MVP_VERIFIED:            20,
  MARKET_READY_VERIFIED:   30,
  STARTUP_LAUNCHED:        10,
  AWARD_SUBMITTED:         0,
  AWARD_APPROVED:          15,
  GITHUB_CONNECTED:        5,
  LINKEDIN_CONNECTED:      5,
  RESUME_UPLOADED:         3,
  PROFILE_COMPLETE:        10,
} as const;

export type ScoreTrigger = keyof typeof SCORE_DELTAS;

const BREAKDOWN_FIELD_MAP: Record<ScoreTrigger, keyof IUser['scoreBreakdown'] | null> = {
  PROBLEM_CLAIMED:        'problemsClaimed',
  SKILL_COMPLETED:        'skillsCompleted',
  PROGRESS_UPLOADED:      'progressUploads',
  PATENT_SUBMITTED:       'patentsSubmitted',
  PATENT_APPROVED:        'patentsApproved',
  MVP_VERIFIED:           'mvpsVerified',
  MARKET_READY_VERIFIED:  'marketReadyVerified',
  STARTUP_LAUNCHED:       'startupsLaunched',
  AWARD_SUBMITTED:        null,
  AWARD_APPROVED:         'awardsApproved',
  GITHUB_CONNECTED:       null,
  LINKEDIN_CONNECTED:     null,
  RESUME_UPLOADED:        null,
  PROFILE_COMPLETE:       null,
};

const ONE_TIME_SCORE_TRIGGERS: ScoreTrigger[] = [
  'GITHUB_CONNECTED',
  'LINKEDIN_CONNECTED',
  'RESUME_UPLOADED',
  'PROFILE_COMPLETE',
];

export interface ApplyScoreParams {
  userId: string;
  trigger: ScoreTrigger;
  metadata?: Record<string, unknown>;
}

const MAX_TIEBREAKER_EPOCH = 9999999999999;

const getInstitutionLeaderboardScore = (score: number, createdAt: Date): number => {
  const tiebreaker = (MAX_TIEBREAKER_EPOCH - createdAt.getTime()) / 1_000_000_000_000_000;
  return score + tiebreaker;
};

export const applyScore = async ({ userId, trigger, metadata }: ApplyScoreParams): Promise<number> => {
  const delta = SCORE_DELTAS[trigger];
  if (delta === 0) return 0;

  if (ONE_TIME_SCORE_TRIGGERS.includes(trigger)) {
    const alreadyAwarded = await ScoreEvent.exists({ userId, trigger });
    if (alreadyAwarded) {
      const existingUser = await User.findById(userId).select('innovationScore').lean();
      return existingUser?.innovationScore ?? 0;
    }
  }

  const breakdownField = BREAKDOWN_FIELD_MAP[trigger];

  const user = await User.findById(userId).select('innovationScore institutionId createdAt').lean();
  if (!user) throw new Error(`User ${userId} not found`);

  const currentScore = user.innovationScore || 0;
  const newScore = Math.min(200, currentScore + delta);
  const actualDelta = newScore - currentScore;

  if (actualDelta <= 0) return currentScore;

  const updateOp: {
    $inc: Record<string, number>;
  } = {
    $inc: { innovationScore: actualDelta },
  };

  if (breakdownField) {
    updateOp.$inc[`scoreBreakdown.${breakdownField}`] = 1;
  }

  await User.findByIdAndUpdate(userId, updateOp);

  await redis.del(`score:${userId}`);

  await redis.zadd('lb:global', { score: newScore, member: userId });

  if (user.institutionId) {
    await redis.zadd(`lb:${user.institutionId}`, {
      score: getInstitutionLeaderboardScore(newScore, user.createdAt),
      member: userId,
    });
  }

  await redis.lpush(
    `student:activity:${userId}`,
    JSON.stringify({
      trigger,
      newScore,
      delta: actualDelta,
      timestamp: new Date().toISOString(),
    }),
  );
  await redis.ltrim(`student:activity:${userId}`, 0, 49);
  await redis.expire(`student:activity:${userId}`, 7 * 24 * 60 * 60);

  const mentorIds = (await redis.smembers(`student:watchers:${userId}`)) as string[];
  if (mentorIds.length > 0) {
    const activityPayload = JSON.stringify({
      studentId: userId,
      trigger,
      newScore,
      delta: actualDelta,
      timestamp: new Date().toISOString(),
    });

    await Promise.all(
      mentorIds.map(async (mentorId) => {
        await redis.lpush(`mentor:feed:${mentorId}`, activityPayload);
        await redis.ltrim(`mentor:feed:${mentorId}`, 0, 49);
        await redis.expire(`mentor:feed:${mentorId}`, 7 * 24 * 60 * 60);
      }),
    );
  }

  try {
    await ScoreEvent.create({
      userId,
      trigger,
      delta: actualDelta,
      scoreAfter: newScore,
      metadata,
    });
  } catch (err) {
    logError('Failed to create ScoreEvent log', err);
  }

  if (io) {
    io.of('/score').to(`user:${userId}`).emit('score:updated', {
      userId,
      newScore,
      delta: actualDelta,
      trigger,
    });

    io.of('/mentor').to(`student-feed:${userId}`).emit('student:activity', {
      studentId: userId,
      trigger,
      newScore,
      delta: actualDelta,
      timestamp: new Date().toISOString(),
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
