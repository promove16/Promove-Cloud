import { User } from '../modules/user/user.model';
import { IUser } from '../modules/user/user.types';
import { redis } from '../config/redis';
import { scoreQueue } from '../config/bullmq';
import { io } from '../config/socket';
import { ScoreEvent } from '../modules/innovationScore/score.model';
import {
  MAX_INNOVATION_SCORE,
  normalizeInnovationScore,
} from '../modules/innovationScore/score.utils';
import { runMongoTransaction } from '../utils/runMongoTransaction';

export const SCORE_DELTAS = {
  PROBLEM_CLAIMED:         0,
  PROBLEM_COMPLETED:       100,
  SKILL_COMPLETED:         40,
  TASK_COMPLETED:          10,
  PROGRESS_UPLOADED:       15,
  PATENT_SUBMITTED:        75,
  PATENT_APPROVED:         125,
  MVP_VERIFIED:            100,
  MARKET_READY_VERIFIED:   150,
  STARTUP_LAUNCHED:        50,
  GITHUB_CONNECTED:        25,
  LINKEDIN_CONNECTED:      25,
  RESUME_UPLOADED:         15,
  PROFILE_COMPLETE:        50,
  ONBOARDING_PROFILE:      50,
  ONBOARDING_PROJECT:      100,
  ONBOARDING_GITHUB:       150,
  ONBOARDING_SHARE:        50,
} as const;

export type ScoreTrigger = keyof typeof SCORE_DELTAS;

const BREAKDOWN_FIELD_MAP: Record<ScoreTrigger, keyof IUser['scoreBreakdown'] | null> = {
  PROBLEM_CLAIMED:        'problemsClaimed',
  PROBLEM_COMPLETED:      'problemsCompleted',
  SKILL_COMPLETED:        'skillsCompleted',
  TASK_COMPLETED:         'tasksCompleted',
  PROGRESS_UPLOADED:      'progressUploads',
  PATENT_SUBMITTED:       'patentsSubmitted',
  PATENT_APPROVED:        'patentsApproved',
  MVP_VERIFIED:           'mvpsVerified',
  MARKET_READY_VERIFIED:  'marketReadyVerified',
  STARTUP_LAUNCHED:       'startupsLaunched',
  GITHUB_CONNECTED:       null,
  LINKEDIN_CONNECTED:     null,
  RESUME_UPLOADED:        null,
  PROFILE_COMPLETE:       null,
  ONBOARDING_PROFILE:     null,
  ONBOARDING_PROJECT:     null,
  ONBOARDING_GITHUB:      null,
  ONBOARDING_SHARE:       null,
};

const ONE_TIME_SCORE_TRIGGERS: ScoreTrigger[] = [
  'GITHUB_CONNECTED',
  'LINKEDIN_CONNECTED',
  'RESUME_UPLOADED',
  'PROFILE_COMPLETE',
  'ONBOARDING_PROFILE',
  'ONBOARDING_PROJECT',
  'ONBOARDING_GITHUB',
  'ONBOARDING_SHARE',
];

const REQUIRES_IDEMPOTENCY_KEY_TRIGGERS: ScoreTrigger[] = (
  Object.keys(SCORE_DELTAS) as ScoreTrigger[]
).filter(
  (trigger) =>
    (SCORE_DELTAS[trigger] > 0 || BREAKDOWN_FIELD_MAP[trigger] !== null) &&
    !ONE_TIME_SCORE_TRIGGERS.includes(trigger),
);

export interface ApplyScoreParams {
  userId: string;
  trigger: ScoreTrigger;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

const MAX_TIEBREAKER_EPOCH = 9999999999999;

const getInstitutionLeaderboardScore = (score: number, createdAt: Date): number => {
  const tiebreaker = (MAX_TIEBREAKER_EPOCH - createdAt.getTime()) / 1_000_000_000_000_000;
  return score + tiebreaker;
};

const getScoreIdempotencyKey = (trigger: ScoreTrigger, idempotencyKey?: string) =>
  idempotencyKey ?? (ONE_TIME_SCORE_TRIGGERS.includes(trigger) ? `trigger:${trigger}` : undefined);

const isDuplicateKeyError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: number }).code === 11000;

export const applyScore = async ({
  userId,
  trigger,
  metadata,
  idempotencyKey,
}: ApplyScoreParams): Promise<number> => {
  const delta = SCORE_DELTAS[trigger];
  const breakdownField = BREAKDOWN_FIELD_MAP[trigger];
  if (delta === 0 && !breakdownField) return 0;

  if (
    REQUIRES_IDEMPOTENCY_KEY_TRIGGERS.includes(trigger) &&
    !idempotencyKey?.trim()
  ) {
    throw new Error(`Score trigger ${trigger} requires an idempotencyKey`);
  }

  const awardKey = getScoreIdempotencyKey(trigger, idempotencyKey);

  let result: {
    awarded: boolean;
    newScore: number;
    actualDelta: number;
    user?: {
      institutionId?: unknown;
      createdAt: Date;
    };
  };

  try {
    result = await runMongoTransaction(async (session) => {
      if (awardKey) {
        const existingEvent = await ScoreEvent.findOne({ userId, idempotencyKey: awardKey })
          .select('scoreAfter')
          .session(session)
          .lean();

        if (existingEvent) {
          const existingUser = await User.findById(userId).select('innovationScore').session(session).lean();
          return {
            awarded: false,
            newScore: normalizeInnovationScore(existingUser?.innovationScore ?? existingEvent.scoreAfter),
            actualDelta: 0,
          };
        }
      }

      if (ONE_TIME_SCORE_TRIGGERS.includes(trigger)) {
        const legacyAward = await ScoreEvent.findOne({
          userId,
          trigger,
          $or: [{ idempotencyKey: { $exists: false } }, { idempotencyKey: null }],
        })
          .select('scoreAfter')
          .session(session)
          .lean();

        if (legacyAward) {
          const existingUser = await User.findById(userId).select('innovationScore').session(session).lean();
          return {
            awarded: false,
            newScore: normalizeInnovationScore(existingUser?.innovationScore ?? legacyAward.scoreAfter),
            actualDelta: 0,
          };
        }
      }

      const user = await User.findById(userId)
        .select('innovationScore institutionId createdAt')
        .session(session)
        .lean();
      if (!user) throw new Error(`User ${userId} not found`);

      const currentScore = normalizeInnovationScore(user.innovationScore);
      const newScore = Math.min(MAX_INNOVATION_SCORE, currentScore + delta);
      const actualDelta = newScore - currentScore;

      if (actualDelta <= 0 && !breakdownField) {
        return {
          awarded: false,
          newScore: currentScore,
          actualDelta: 0,
          user,
        };
      }

      const updateOp: {
        $set: Record<string, number>;
        $inc?: Record<string, number>;
      } = {
        $set: { innovationScore: newScore },
      };

      if (breakdownField) {
        updateOp.$inc = { [`scoreBreakdown.${breakdownField}`]: 1 };
      }

      await User.updateOne({ _id: userId }, updateOp, { session });

      await ScoreEvent.create(
        [
          {
            userId,
            trigger,
            delta: actualDelta,
            scoreAfter: newScore,
            ...(awardKey ? { idempotencyKey: awardKey } : {}),
            metadata,
          },
        ],
        { session },
      );

      return {
        awarded: true,
        newScore,
        actualDelta,
        user,
      };
    });
  } catch (err) {
    if (awardKey && isDuplicateKeyError(err)) {
      const existingUser = await User.findById(userId).select('innovationScore').lean();
      return normalizeInnovationScore(existingUser?.innovationScore ?? 0);
    }

    throw err;
  }

  if (!result.awarded) return result.newScore;

  await redis.del(`score:${userId}`);

  await redis.zadd('lb:global', { score: result.newScore, member: userId });

  const institutionId = result.user?.institutionId ? String(result.user.institutionId) : null;
  if (institutionId && result.user) {
    await redis.zadd(`lb:${institutionId}`, {
      score: getInstitutionLeaderboardScore(result.newScore, result.user.createdAt),
      member: userId,
    });
  }

  await redis.lpush(
    `student:activity:${userId}`,
    JSON.stringify({
      trigger,
      newScore: result.newScore,
      delta: result.actualDelta,
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
      newScore: result.newScore,
      delta: result.actualDelta,
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

  if (io) {
    const payload = {
      userId,
      newScore: result.newScore,
      delta: result.actualDelta,
      trigger,
    };

    io.of('/score').to(`user:${userId}`).emit('score:updated', {
      ...payload,
    });

    if (institutionId) {
      io.of('/score').to(`institution:${institutionId}`).emit('score:updated', {
        ...payload,
      });
    }

    io.of('/mentor').to(`student-feed:${userId}`).emit('student:activity', {
      studentId: userId,
      trigger,
      newScore: result.newScore,
      delta: result.actualDelta,
      timestamp: new Date().toISOString(),
    });
  }

  return result.newScore;
};

export const applyScoreAsync = async (params: ApplyScoreParams): Promise<void> => {
  await scoreQueue.add('apply-score', params, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  });
};
