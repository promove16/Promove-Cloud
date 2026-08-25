import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { env } from '../../config/env';
import { redis } from '../../config/redis';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import { readRedisJson } from '../../utils/redisJson';
import { User } from '../user/user.model';
import { Startup } from '../startup/startup.model';
import { Patent } from '../patent/patent.model';
import { PatentRequest } from '../patent/patentRequest.model';
import { Workspace } from '../workspace/workspace.model';
import { ScoreEvent } from './score.model';
import { applyScore, SCORE_DELTAS, ScoreTrigger } from '../../services/scoreEngine';
import { UserRole } from '../../types/roles.types';
import {
  normalizeInnovationScore,
  normalizeScoreBreakdown,
} from './score.utils';

const percentileFromRank = (rank: number | null, total: number) => {
  if (rank === null || total <= 0) {
    return 100;
  }

  if (total === 1) {
    return 1;
  }

  return Math.min(100, Math.max(1, Math.round(((rank + 1) / total) * 100)));
};

const syncUserScoreBreakdown = async (
  userId: string,
  rawBreakdown: Parameters<typeof normalizeScoreBreakdown>[0],
) => {
  const normalized = normalizeScoreBreakdown(rawBreakdown);
  const studentId = new Types.ObjectId(userId);

  const [
    startupsCount,
    selfPatentsCount,
    assistedPatentsCount,
    approvedSelfPatents,
    approvedAssistedPatents,
    claimedWorkspacesCount,
    progressUploadsCount,
  ] = await Promise.all([
    Startup.countDocuments({
      isActive: true,
      $and: [
        { $or: [{ founderIds: studentId }, { teamMemberIds: studentId }] },
        {
          $or: [
            { launchedToInvestors: true },
            { launchedToMentors: true },
            { launchedToRecruiters: true },
            { phase: 'launched' },
            { stage: 'Launched' },
          ],
        },
      ],
    }),
    Patent.countDocuments({ studentId: userId }),
    PatentRequest.countDocuments({ studentId: userId }),
    Patent.countDocuments({
      studentId: userId,
      status: { $in: ['approved', 'published', 'granted'] },
    }),
    PatentRequest.countDocuments({
      studentId: userId,
      status: 'granted',
    }),
    Workspace.countDocuments({
      $or: [{ ownerId: userId }, { teamMemberIds: userId }],
      claimedProblemId: { $ne: null },
      isActive: true,
    }),
    Workspace.aggregate<{ count: number }>([
      { $unwind: '$progressUpdates' },
      { $match: { 'progressUpdates.submittedBy': studentId } },
      { $count: 'count' },
    ]).then(([result]) => result?.count ?? 0),
  ]);

  return {
    ...normalized,
    startupsLaunched: Math.max(normalized.startupsLaunched, startupsCount),
    patentsSubmitted: Math.max(normalized.patentsSubmitted, selfPatentsCount + assistedPatentsCount),
    patentsApproved: Math.max(normalized.patentsApproved, approvedSelfPatents + approvedAssistedPatents),
    problemsClaimed: Math.max(normalized.problemsClaimed, claimedWorkspacesCount),
    progressUploads: Math.max(normalized.progressUploads, progressUploadsCount),
  };
};

export const getMyScore = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const cacheKey = `score:${req.user._id}`;
  const cached = await redis.get<string>(cacheKey);

  let scorePayload: {
    score: number;
    breakdown: ReturnType<typeof normalizeScoreBreakdown>;
  };
  let breakdownReconciled = false;

  const cachedPayload = readRedisJson<typeof scorePayload>(cached);
  if (cachedPayload) {
    scorePayload = {
      score: normalizeInnovationScore(cachedPayload.score),
      breakdown: normalizeScoreBreakdown(cachedPayload.breakdown),
    };

    if (
      scorePayload.score !== cachedPayload.score ||
      JSON.stringify(scorePayload.breakdown) !== JSON.stringify(cachedPayload.breakdown ?? {})
    ) {
      await redis.set(cacheKey, JSON.stringify(scorePayload), { ex: 300 });
    }
  } else {
    const user = await User.findById(req.user._id)
      .select('innovationScore scoreBreakdown')
      .lean();

    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const normalizedScore = normalizeInnovationScore(user.innovationScore);
    const normalizedBreakdown = await syncUserScoreBreakdown(req.user._id, user.scoreBreakdown);
    breakdownReconciled = true;

    if (
      normalizedScore !== user.innovationScore ||
      JSON.stringify(normalizedBreakdown) !== JSON.stringify(user.scoreBreakdown ?? {})
    ) {
      await User.updateOne(
        { _id: req.user._id },
        {
          innovationScore: normalizedScore,
          scoreBreakdown: normalizedBreakdown,
        },
      );
    }

    scorePayload = {
      score: normalizedScore,
      breakdown: normalizedBreakdown,
    };

    await redis.set(cacheKey, JSON.stringify(scorePayload), { ex: 300 });
  }

  if (
    !breakdownReconciled &&
    (scorePayload.breakdown.progressUploads === 0 || scorePayload.breakdown.startupsLaunched === 0)
  ) {
    const reconciledBreakdown = await syncUserScoreBreakdown(req.user._id, scorePayload.breakdown);
    scorePayload = { ...scorePayload, breakdown: reconciledBreakdown };
    await Promise.all([
      User.updateOne(
        { _id: req.user._id },
        { scoreBreakdown: reconciledBreakdown },
      ),
      redis.set(cacheKey, JSON.stringify(scorePayload), { ex: 300 }),
    ]);
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [recentEvents, leaderboardUser] = await Promise.all([
    ScoreEvent.find({
      userId: req.user._id,
      createdAt: { $gte: weekAgo },
    })
      .select('delta')
      .lean(),
    User.findById(req.user._id).select('institutionId createdAt').lean(),
  ]);

  if (!leaderboardUser) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  let rank = await redis.zrevrank('lb:global', req.user._id);
  let total = await redis.zcard('lb:global');

  if (rank === null) {
    await redis.zadd('lb:global', { score: scorePayload.score, member: req.user._id });

    if (leaderboardUser.institutionId) {
      const institutionTiebreakerScore =
        scorePayload.score +
        (9999999999999 - leaderboardUser.createdAt.getTime()) / 1_000_000_000_000_000;
      await redis.zadd(`lb:${leaderboardUser.institutionId}`, {
        score: institutionTiebreakerScore,
        member: req.user._id,
      });
    }

    rank = await redis.zrevrank('lb:global', req.user._id);
    total = await redis.zcard('lb:global');
  }

  const weeklyDelta = recentEvents.reduce((sum, event) => sum + (event.delta ?? 0), 0);

  res.json(
    new ApiResponse({
      ...scorePayload,
      weeklyDelta,
      rankPercentile: percentileFromRank(rank, total),
    }),
  );
};

export const getScoreHistory = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const requestedUserId =
    req.params.userId === 'me' || !req.params.userId ? req.user._id : req.params.userId;

  if (req.user.role !== UserRole.ADMIN && requestedUserId !== req.user._id) {
    throw new ApiError(403, 'SCORE_HISTORY_FORBIDDEN', 'You can only view your own score history');
  }

  const events = await ScoreEvent.find({ userId: requestedUserId })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.json(
    new ApiResponse(
      events.map((event) => ({
        ...event,
        scoreAfter: normalizeInnovationScore(event.scoreAfter),
      })),
    ),
  );
};

export const getScoreEvents = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const userId = req.params.userId;
  if (!userId) {
    throw new ApiError(400, 'USER_ID_REQUIRED', 'userId parameter is required');
  }

  const events = await ScoreEvent.find({ userId })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const user = await User.findById(userId)
    .select('innovationScore scoreBreakdown displayName')
    .lean();

  res.json(new ApiResponse({
    user: user
      ? {
          _id: userId,
          displayName: user.displayName,
          innovationScore: normalizeInnovationScore(user.innovationScore),
          scoreBreakdown: normalizeScoreBreakdown(user.scoreBreakdown),
        }
      : null,
    events: events.map((event) => ({
      ...event,
      scoreAfter: normalizeInnovationScore(event.scoreAfter),
    })),
    total: events.length,
  }));
};

export const testScoreTrigger = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  if (env.NODE_ENV === 'production') {
    throw new ApiError(404, 'NOT_FOUND', 'Score test trigger is not available');
  }

  const { userId, trigger } = req.body as { userId?: string; trigger?: string };

  if (!userId || !trigger) {
    throw new ApiError(400, 'MISSING_FIELDS', 'userId and trigger are required');
  }

  const validTriggers = Object.keys(SCORE_DELTAS);
  if (!validTriggers.includes(trigger)) {
    throw new ApiError(400, 'INVALID_TRIGGER', `Valid triggers: ${validTriggers.join(', ')}`);
  }

  const newScore = await applyScore({
    userId,
    trigger: trigger as ScoreTrigger,
    metadata: { triggeredBy: req.user._id, testMode: true },
    idempotencyKey: `score-test-trigger:${userId}:${trigger}`,
  });

  res.json(new ApiResponse({
    userId,
    trigger,
    delta: SCORE_DELTAS[trigger as ScoreTrigger],
    newScore,
  }));
};
