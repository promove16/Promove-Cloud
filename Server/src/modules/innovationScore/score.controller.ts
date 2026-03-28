import { Request, Response } from 'express';
import { redis } from '../../config/redis';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import { readRedisJson } from '../../utils/redisJson';
import { User } from '../user/user.model';
import { ScoreEvent } from './score.model';

const percentileFromRank = (rank: number | null, total: number) => {
  if (rank === null || total <= 1) {
    return 100;
  }

  const fraction = 1 - rank / Math.max(total - 1, 1);
  return Math.max(1, Math.round(fraction * 100));
};

export const getMyScore = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const cacheKey = `score:${req.user._id}`;
  const cached = await redis.get<string>(cacheKey);

  let scorePayload: {
    score: number;
    breakdown: unknown;
  };

  const cachedPayload = readRedisJson<typeof scorePayload>(cached);
  if (cachedPayload) {
    scorePayload = cachedPayload;
  } else {
    const user = await User.findById(req.user._id)
      .select('innovationScore scoreBreakdown')
      .lean();

    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }

    scorePayload = {
      score: user.innovationScore,
      breakdown: user.scoreBreakdown,
    };

    await redis.set(cacheKey, JSON.stringify(scorePayload), { ex: 300 });
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const latest = await ScoreEvent.findOne({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
  const earlier = await ScoreEvent.findOne({
    userId: req.user._id,
    createdAt: { $lte: weekAgo },
  })
    .sort({ createdAt: -1 })
    .lean();

  const rank = await redis.zrank('lb:global', req.user._id);
  const total = await redis.zcard('lb:global');

  res.json(
    new ApiResponse({
      ...scorePayload,
      weeklyDelta: (latest?.scoreAfter ?? scorePayload.score) - (earlier?.scoreAfter ?? 0),
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

  const events = await ScoreEvent.find({ userId: requestedUserId })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.json(new ApiResponse(events));
};
