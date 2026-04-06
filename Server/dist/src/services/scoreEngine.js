"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyScoreAsync = exports.applyScore = exports.SCORE_DELTAS = void 0;
const user_model_1 = require("../modules/user/user.model");
const redis_1 = require("../config/redis");
const bullmq_1 = require("../config/bullmq");
const socket_1 = require("../config/socket");
const logger_1 = require("../config/logger");
const score_model_1 = require("../modules/innovationScore/score.model");
const score_utils_1 = require("../modules/innovationScore/score.utils");
exports.SCORE_DELTAS = {
    PROBLEM_CLAIMED: 25,
    PROBLEM_COMPLETED: 100,
    SKILL_COMPLETED: 40,
    PROGRESS_UPLOADED: 15,
    PATENT_SUBMITTED: 75,
    PATENT_APPROVED: 125,
    MVP_VERIFIED: 100,
    MARKET_READY_VERIFIED: 150,
    STARTUP_LAUNCHED: 50,
    AWARD_SUBMITTED: 0,
    AWARD_APPROVED: 75,
    GITHUB_CONNECTED: 25,
    LINKEDIN_CONNECTED: 25,
    RESUME_UPLOADED: 15,
    PROFILE_COMPLETE: 50,
    ONBOARDING_PROFILE: 50,
    ONBOARDING_PROJECT: 100,
    ONBOARDING_GITHUB: 150,
    ONBOARDING_SHARE: 50,
};
const BREAKDOWN_FIELD_MAP = {
    PROBLEM_CLAIMED: 'problemsClaimed',
    PROBLEM_COMPLETED: null,
    SKILL_COMPLETED: 'skillsCompleted',
    PROGRESS_UPLOADED: 'progressUploads',
    PATENT_SUBMITTED: 'patentsSubmitted',
    PATENT_APPROVED: 'patentsApproved',
    MVP_VERIFIED: 'mvpsVerified',
    MARKET_READY_VERIFIED: 'marketReadyVerified',
    STARTUP_LAUNCHED: 'startupsLaunched',
    AWARD_SUBMITTED: null,
    AWARD_APPROVED: 'awardsApproved',
    GITHUB_CONNECTED: null,
    LINKEDIN_CONNECTED: null,
    RESUME_UPLOADED: null,
    PROFILE_COMPLETE: null,
    ONBOARDING_PROFILE: null,
    ONBOARDING_PROJECT: null,
    ONBOARDING_GITHUB: null,
    ONBOARDING_SHARE: null,
};
const ONE_TIME_SCORE_TRIGGERS = [
    'GITHUB_CONNECTED',
    'LINKEDIN_CONNECTED',
    'RESUME_UPLOADED',
    'PROFILE_COMPLETE',
    'ONBOARDING_PROFILE',
    'ONBOARDING_PROJECT',
    'ONBOARDING_GITHUB',
    'ONBOARDING_SHARE',
];
const MAX_TIEBREAKER_EPOCH = 9999999999999;
const getInstitutionLeaderboardScore = (score, createdAt) => {
    const tiebreaker = (MAX_TIEBREAKER_EPOCH - createdAt.getTime()) / 1_000_000_000_000_000;
    return score + tiebreaker;
};
const applyScore = async ({ userId, trigger, metadata }) => {
    const delta = exports.SCORE_DELTAS[trigger];
    if (delta === 0)
        return 0;
    if (ONE_TIME_SCORE_TRIGGERS.includes(trigger)) {
        const alreadyAwarded = await score_model_1.ScoreEvent.exists({ userId, trigger });
        if (alreadyAwarded) {
            const existingUser = await user_model_1.User.findById(userId).select('innovationScore').lean();
            return existingUser?.innovationScore ?? 0;
        }
    }
    const breakdownField = BREAKDOWN_FIELD_MAP[trigger];
    const user = await user_model_1.User.findById(userId).select('innovationScore institutionId createdAt').lean();
    if (!user)
        throw new Error(`User ${userId} not found`);
    const currentScore = (0, score_utils_1.normalizeInnovationScore)(user.innovationScore);
    const newScore = (0, score_utils_1.normalizeInnovationScore)(currentScore + delta);
    const actualDelta = newScore - currentScore;
    if (actualDelta <= 0)
        return currentScore;
    const updateOp = {
        $inc: { innovationScore: actualDelta },
    };
    if (breakdownField) {
        updateOp.$inc[`scoreBreakdown.${breakdownField}`] = 1;
    }
    await user_model_1.User.findByIdAndUpdate(userId, updateOp);
    await redis_1.redis.del(`score:${userId}`);
    await redis_1.redis.zadd('lb:global', { score: newScore, member: userId });
    if (user.institutionId) {
        await redis_1.redis.zadd(`lb:${user.institutionId}`, {
            score: getInstitutionLeaderboardScore(newScore, user.createdAt),
            member: userId,
        });
    }
    await redis_1.redis.lpush(`student:activity:${userId}`, JSON.stringify({
        trigger,
        newScore,
        delta: actualDelta,
        timestamp: new Date().toISOString(),
    }));
    await redis_1.redis.ltrim(`student:activity:${userId}`, 0, 49);
    await redis_1.redis.expire(`student:activity:${userId}`, 7 * 24 * 60 * 60);
    const mentorIds = (await redis_1.redis.smembers(`student:watchers:${userId}`));
    if (mentorIds.length > 0) {
        const activityPayload = JSON.stringify({
            studentId: userId,
            trigger,
            newScore,
            delta: actualDelta,
            timestamp: new Date().toISOString(),
        });
        await Promise.all(mentorIds.map(async (mentorId) => {
            await redis_1.redis.lpush(`mentor:feed:${mentorId}`, activityPayload);
            await redis_1.redis.ltrim(`mentor:feed:${mentorId}`, 0, 49);
            await redis_1.redis.expire(`mentor:feed:${mentorId}`, 7 * 24 * 60 * 60);
        }));
    }
    try {
        await score_model_1.ScoreEvent.create({
            userId,
            trigger,
            delta: actualDelta,
            scoreAfter: newScore,
            metadata,
        });
    }
    catch (err) {
        (0, logger_1.logError)('Failed to create ScoreEvent log', err);
    }
    if (socket_1.io) {
        socket_1.io.of('/score').to(`user:${userId}`).emit('score:updated', {
            userId,
            newScore,
            delta: actualDelta,
            trigger,
        });
        socket_1.io.of('/mentor').to(`student-feed:${userId}`).emit('student:activity', {
            studentId: userId,
            trigger,
            newScore,
            delta: actualDelta,
            timestamp: new Date().toISOString(),
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
