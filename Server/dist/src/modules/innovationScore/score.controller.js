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
const percentileFromRank = (rank, total) => {
    if (rank === null || total <= 1) {
        return 100;
    }
    const fraction = 1 - rank / Math.max(total - 1, 1);
    return Math.max(1, Math.round(fraction * 100));
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
        scorePayload = cachedPayload;
    }
    else {
        const user = await user_model_1.User.findById(req.user._id)
            .select('innovationScore scoreBreakdown')
            .lean();
        if (!user) {
            throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
        }
        scorePayload = {
            score: user.innovationScore,
            breakdown: user.scoreBreakdown,
        };
        await redis_1.redis.set(cacheKey, JSON.stringify(scorePayload), { ex: 300 });
    }
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const latest = await score_model_1.ScoreEvent.findOne({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    const earlier = await score_model_1.ScoreEvent.findOne({
        userId: req.user._id,
        createdAt: { $lte: weekAgo },
    })
        .sort({ createdAt: -1 })
        .lean();
    const rank = await redis_1.redis.zrank('lb:global', req.user._id);
    const total = await redis_1.redis.zcard('lb:global');
    res.json(new ApiResponse_1.ApiResponse({
        ...scorePayload,
        weeklyDelta: (latest?.scoreAfter ?? scorePayload.score) - (earlier?.scoreAfter ?? 0),
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
    res.json(new ApiResponse_1.ApiResponse(events));
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
        user: user ? { _id: userId, displayName: user.displayName, innovationScore: user.innovationScore, scoreBreakdown: user.scoreBreakdown } : null,
        events,
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
