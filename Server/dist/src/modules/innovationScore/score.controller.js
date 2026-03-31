"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testScoreTrigger = exports.getScoreEvents = exports.getScoreHistory = exports.getMyScore = void 0;
const redis_1 = require("../../config/redis");
const ApiError_1 = require("../../utils/ApiError");
const ApiResponse_1 = require("../../utils/ApiResponse");
const redisJson_1 = require("../../utils/redisJson");
const user_model_1 = require("../user/user.model");
const score_model_1 = require("./score.model");
const scoreEngine_1 = require("../../services/scoreEngine");
const score_utils_1 = require("./score.utils");
const percentileFromRank = (rank, total) => {
    if (rank === null || total <= 0) {
        return 100;
    }
    if (total === 1) {
        return 1;
    }
    return Math.min(100, Math.max(1, Math.round(((rank + 1) / total) * 100)));
};
const getMyScore = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const cacheKey = `score:${req.user._id}`;
    const cached = await redis_1.redis.get(cacheKey);
    let scorePayload;
    const cachedPayload = (0, redisJson_1.readRedisJson)(cached);
    if (cachedPayload) {
        scorePayload = {
            score: (0, score_utils_1.normalizeInnovationScore)(cachedPayload.score),
            breakdown: (0, score_utils_1.normalizeScoreBreakdown)(cachedPayload.breakdown),
        };
        if (scorePayload.score !== cachedPayload.score ||
            JSON.stringify(scorePayload.breakdown) !== JSON.stringify(cachedPayload.breakdown ?? {})) {
            await redis_1.redis.set(cacheKey, JSON.stringify(scorePayload), { ex: 300 });
        }
    }
    else {
        const user = await user_model_1.User.findById(req.user._id)
            .select('innovationScore scoreBreakdown')
            .lean();
        if (!user) {
            throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
        }
        const normalizedScore = (0, score_utils_1.normalizeInnovationScore)(user.innovationScore);
        const normalizedBreakdown = (0, score_utils_1.normalizeScoreBreakdown)(user.scoreBreakdown);
        if (normalizedScore !== user.innovationScore ||
            JSON.stringify(normalizedBreakdown) !== JSON.stringify(user.scoreBreakdown ?? {})) {
            await user_model_1.User.updateOne({ _id: req.user._id }, {
                innovationScore: normalizedScore,
                scoreBreakdown: normalizedBreakdown,
            });
        }
        scorePayload = {
            score: normalizedScore,
            breakdown: normalizedBreakdown,
        };
        await redis_1.redis.set(cacheKey, JSON.stringify(scorePayload), { ex: 300 });
    }
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recentEvents, leaderboardUser] = await Promise.all([
        score_model_1.ScoreEvent.find({
            userId: req.user._id,
            createdAt: { $gte: weekAgo },
        })
            .select('delta')
            .lean(),
        user_model_1.User.findById(req.user._id).select('institutionId createdAt').lean(),
    ]);
    if (!leaderboardUser) {
        throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    let rank = await redis_1.redis.zrevrank('lb:global', req.user._id);
    let total = await redis_1.redis.zcard('lb:global');
    if (rank === null) {
        await redis_1.redis.zadd('lb:global', { score: scorePayload.score, member: req.user._id });
        if (leaderboardUser.institutionId) {
            const institutionTiebreakerScore = scorePayload.score +
                (9999999999999 - leaderboardUser.createdAt.getTime()) / 1_000_000_000_000_000;
            await redis_1.redis.zadd(`lb:${leaderboardUser.institutionId}`, {
                score: institutionTiebreakerScore,
                member: req.user._id,
            });
        }
        rank = await redis_1.redis.zrevrank('lb:global', req.user._id);
        total = await redis_1.redis.zcard('lb:global');
    }
    const weeklyDelta = recentEvents.reduce((sum, event) => sum + (event.delta ?? 0), 0);
    res.json(new ApiResponse_1.ApiResponse({
        ...scorePayload,
        weeklyDelta,
        rankPercentile: percentileFromRank(rank, total),
    }));
};
exports.getMyScore = getMyScore;
const getScoreHistory = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const requestedUserId = req.params.userId === 'me' || !req.params.userId ? req.user._id : req.params.userId;
    const events = await score_model_1.ScoreEvent.find({ userId: requestedUserId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
    res.json(new ApiResponse_1.ApiResponse(events.map((event) => ({
        ...event,
        scoreAfter: (0, score_utils_1.normalizeInnovationScore)(event.scoreAfter),
    }))));
};
exports.getScoreHistory = getScoreHistory;
const getScoreEvents = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const userId = req.params.userId;
    if (!userId) {
        throw new ApiError_1.ApiError(400, 'USER_ID_REQUIRED', 'userId parameter is required');
    }
    const events = await score_model_1.ScoreEvent.find({ userId })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();
    const user = await user_model_1.User.findById(userId)
        .select('innovationScore scoreBreakdown displayName')
        .lean();
    res.json(new ApiResponse_1.ApiResponse({
        user: user
            ? {
                _id: userId,
                displayName: user.displayName,
                innovationScore: (0, score_utils_1.normalizeInnovationScore)(user.innovationScore),
                scoreBreakdown: (0, score_utils_1.normalizeScoreBreakdown)(user.scoreBreakdown),
            }
            : null,
        events: events.map((event) => ({
            ...event,
            scoreAfter: (0, score_utils_1.normalizeInnovationScore)(event.scoreAfter),
        })),
        total: events.length,
    }));
};
exports.getScoreEvents = getScoreEvents;
const testScoreTrigger = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const { userId, trigger } = req.body;
    if (!userId || !trigger) {
        throw new ApiError_1.ApiError(400, 'MISSING_FIELDS', 'userId and trigger are required');
    }
    const validTriggers = Object.keys(scoreEngine_1.SCORE_DELTAS);
    if (!validTriggers.includes(trigger)) {
        throw new ApiError_1.ApiError(400, 'INVALID_TRIGGER', `Valid triggers: ${validTriggers.join(', ')}`);
    }
    const newScore = await (0, scoreEngine_1.applyScore)({
        userId,
        trigger: trigger,
        metadata: { triggeredBy: req.user._id, testMode: true },
    });
    res.json(new ApiResponse_1.ApiResponse({
        userId,
        trigger,
        delta: scoreEngine_1.SCORE_DELTAS[trigger],
        newScore,
    }));
};
exports.testScoreTrigger = testScoreTrigger;
