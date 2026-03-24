"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyScoreAsync = exports.applyScore = exports.SCORE_DELTAS = void 0;
const redis_1 = require("../config/redis");
const bullmq_1 = require("../config/bullmq");
const socket_1 = require("../config/socket");
const user_model_1 = require("../modules/user/user.model");
const score_model_1 = require("../modules/innovationScore/score.model");
exports.SCORE_DELTAS = {
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
};
const BREAKDOWN_FIELD_MAP = {
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
const applyScore = async ({ userId, trigger, metadata }) => {
    const delta = exports.SCORE_DELTAS[trigger];
    if (delta === 0) {
        const user = await user_model_1.User.findById(userId).select('innovationScore').lean();
        return user?.innovationScore ?? 0;
    }
    const breakdownField = BREAKDOWN_FIELD_MAP[trigger];
    const user = await user_model_1.User.findById(userId).select('innovationScore institutionId').lean();
    if (!user) {
        throw new Error(`User ${userId} not found`);
    }
    const newScore = Math.min(200, user.innovationScore + delta);
    const actualDelta = newScore - user.innovationScore;
    if (actualDelta <= 0) {
        return user.innovationScore;
    }
    await user_model_1.User.findByIdAndUpdate(userId, {
        $inc: {
            innovationScore: actualDelta,
            ...(breakdownField ? { [`scoreBreakdown.${breakdownField}`]: 1 } : {}),
        },
    });
    await score_model_1.ScoreEvent.create({
        userId,
        trigger,
        delta: actualDelta,
        scoreAfter: newScore,
        metadata,
    });
    await redis_1.redis.del(`score:${userId}`);
    await redis_1.redis.zadd('lb:global', { score: newScore, member: userId });
    if (user.institutionId) {
        await redis_1.redis.zadd(`lb:${String(user.institutionId)}`, { score: newScore, member: userId });
    }
    if (socket_1.io) {
        socket_1.io.of('/score').to(`user:${userId}`).emit('score:updated', {
            userId,
            newScore,
            delta: actualDelta,
            trigger,
        });
    }
    return newScore;
};
exports.applyScore = applyScore;
const applyScoreAsync = async (params) => {
    await bullmq_1.scoreQueue.add('apply-score', params, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
    });
};
exports.applyScoreAsync = applyScoreAsync;
