import { Types } from 'mongoose';
import { redis } from '../../config/redis';
import { io } from '../../config/socket';
import { runMongoTransaction } from '../../utils/runMongoTransaction';
import { MentorScoreEvent } from './mentorScoreEvent.model';
import { MentorScore } from './mentorScore.model';
import { MentorVerificationTask } from './mentorVerificationTask.model';
import {
  AwardPointsParams,
  IMentorScore,
  MentorScoreTrigger,
  MentorScoreTriggerType,
  MENTOR_PHASE_CAPS,
  MENTOR_PHASE1_CAPS,
  MENTOR_PHASE2_CAPS,
} from './mentorScore.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const MENTOR_LB_KEY = 'lb:mentor:global';
const SCORE_CACHE_TTL = 300; // 5 min

// Triggers that represent real activity (reset lastActivityAt)
const ACTIVITY_TRIGGERS = new Set<MentorScoreTriggerType>(
  Object.values(MentorScoreTrigger).filter(
    (t) => t !== MentorScoreTrigger.SCORE_DECAY && t !== MentorScoreTrigger.ADMIN_ADJUSTMENT,
  ),
);

const DECAY_THRESHOLD_DAYS = 60;
const DECAY_RATE_PER_DAY   = 0.005; // 0.5 % per day past threshold
const DECAY_MAX_FRACTION   = 0.20;  // never lose more than 20 % of score

// Maps trigger → which phase breakdown sub-field to increment
const PHASE1_FIELD_MAP: Partial<Record<MentorScoreTriggerType, keyof IMentorScore['phase1Breakdown']>> = {
  [MentorScoreTrigger.TRAINING_MODULE_COMPLETED]: 'training',
  [MentorScoreTrigger.QUIZ_PASSED]:               'training',
  [MentorScoreTrigger.LAB_HARDWARE_VERIFIED]:     'labSync',
  [MentorScoreTrigger.CURRICULUM_APPROVED]:       'curriculumMapping',
  [MentorScoreTrigger.CLASS_PHOTO_VERIFIED]:      'curriculumMapping',
};

const PHASE2_FIELD_MAP: Partial<Record<MentorScoreTriggerType, keyof IMentorScore['phase2Breakdown']>> = {
  [MentorScoreTrigger.INDUSTRY_SESSION_VERIFIED]:    'industryConnects',
  [MentorScoreTrigger.STUDENT_PROTOTYPE_TRANSITION]: 'prototypeVelocity',
  [MentorScoreTrigger.DEMO_DAY_VERIFIED]:            'demoDay',
};

const PHASE3_FIELD_MAP: Partial<Record<MentorScoreTriggerType, keyof IMentorScore['phase3Breakdown']>> = {
  [MentorScoreTrigger.RESOURCE_MILESTONE_REACHED]: 'resourceLibrary',
  [MentorScoreTrigger.FORUM_ANSWER_HELPFUL]:       'forum',
  [MentorScoreTrigger.FORUM_VERIFIED_SOLUTION]:    'forum',
  [MentorScoreTrigger.SESSION_TOKEN_RELEASED]:     'sessions',
  [MentorScoreTrigger.EQUITY_LOI_SIGNED]:          'equityLOIs',
  [MentorScoreTrigger.MENTEE_OUTCOME_BONUS]:       'outcomeBonuses',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isDuplicateKeyError = (err: unknown) =>
  typeof err === 'object' && err !== null && 'code' in err &&
  (err as { code?: number }).code === 11000;

const cacheKey = (mentorId: string) => `mentor:score:${mentorId}`;

const getPhaseCap = (
  phase: 1 | 2 | 3,
  trigger: MentorScoreTriggerType,
  current: IMentorScore,
): number => {
  if (phase === 1) {
    const field = PHASE1_FIELD_MAP[trigger];
    if (!field) return Math.max(0, MENTOR_PHASE_CAPS.phase1 - current.phase1Score);
    const limit = MENTOR_PHASE1_CAPS[field as keyof typeof MENTOR_PHASE1_CAPS] ?? MENTOR_PHASE_CAPS.phase1;
    const currentVal = current.phase1Breakdown[field as keyof IMentorScore['phase1Breakdown']] ?? 0;
    return Math.max(0, limit - currentVal);
  }
  if (phase === 2) {
    const field = PHASE2_FIELD_MAP[trigger];
    if (field === 'industryConnects') return Math.max(0, MENTOR_PHASE2_CAPS.industryConnects - current.phase2Breakdown.industryConnects);
    if (field === 'prototypeVelocity') return Math.max(0, MENTOR_PHASE2_CAPS.prototypeVelocity - current.phase2Breakdown.prototypeVelocity);
    if (field === 'demoDay') return Math.max(0, MENTOR_PHASE2_CAPS.demoDay - current.phase2Breakdown.demoDay);
    return Math.max(0, MENTOR_PHASE_CAPS.phase2 - current.phase2Score);
  }
  // Phase 3 is intentionally uncapped at sub-field level per spec
  return Number.MAX_SAFE_INTEGER;
};

// ─── Core Service ─────────────────────────────────────────────────────────────

/**
 * The single gateway for all mentor point mutations.
 * Every award — positive or negative — flows through here.
 */
export const awardMentorPoints = async (params: AwardPointsParams): Promise<number> => {
  const { trigger, delta, phase, idempotencyKey, metadata } = params;
  const mentorId = String(params.mentorId);

  if (delta === 0) return 0;

  let result: { awarded: boolean; newTotal: number; actualDelta: number };

  try {
    result = await runMongoTransaction(async (session) => {
      // ① Idempotency guard
      const existing = await MentorScoreEvent.findOne({ mentorId, idempotencyKey })
        .select('scoreAfter')
        .session(session)
        .lean();

      if (existing) {
        return { awarded: false, newTotal: existing.scoreAfter, actualDelta: 0 };
      }

      // ② Fetch or create MentorScore cache doc
      let scoreDoc = await MentorScore.findOne({ mentorId }).session(session);
      if (!scoreDoc) {
        [scoreDoc] = await MentorScore.create([{ mentorId }], { session });
      }

      // ③ Apply phase-level cap for positive deltas
      let actualDelta = delta;
      if (delta > 0) {
        const remaining = getPhaseCap(phase, trigger, scoreDoc);
        actualDelta = Math.min(delta, remaining);
      }
      if (actualDelta === 0) {
        return { awarded: false, newTotal: scoreDoc.totalScore, actualDelta: 0 };
      }

      const newTotal = Math.max(0, scoreDoc.totalScore + actualDelta);

      // ④ Build $inc update for the right breakdown field
      const inc: Record<string, number> = {
        totalScore: actualDelta,
        [`phase${phase}Score`]: actualDelta,
      };

      const p1Field = PHASE1_FIELD_MAP[trigger];
      const p2Field = PHASE2_FIELD_MAP[trigger];
      const p3Field = PHASE3_FIELD_MAP[trigger];

      if (phase === 1 && p1Field) inc[`phase1Breakdown.${p1Field}`] = actualDelta;
      if (phase === 2 && p2Field) inc[`phase2Breakdown.${p2Field}`] = actualDelta;
      if (phase === 3 && p3Field) inc[`phase3Breakdown.${p3Field}`] = actualDelta;

      const setOp: Record<string, unknown> = { updatedAt: new Date() };
      if (ACTIVITY_TRIGGERS.has(trigger)) setOp.lastActivityAt = new Date();

      await MentorScore.updateOne(
        { mentorId },
        { $inc: inc, $set: setOp },
        { session },
      );

      // ⑤ Write immutable ledger entry
      await MentorScoreEvent.create(
        [{
          mentorId,
          trigger,
          delta:         actualDelta,
          scoreAfter:    newTotal,
          phase,
          idempotencyKey,
          metadata,
        }],
        { session },
      );

      return { awarded: true, newTotal, actualDelta };
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const doc = await MentorScore.findOne({ mentorId }).select('totalScore').lean();
      return doc?.totalScore ?? 0;
    }
    throw err;
  }

  if (!result.awarded) return result.newTotal;

  // ⑥ Invalidate Redis cache
  await redis.del(cacheKey(mentorId));

  // ⑦ Update global leaderboard sorted set
  await redis.zadd(MENTOR_LB_KEY, { score: result.newTotal, member: mentorId });

  // ⑧ Emit real-time event
  if (io) {
    io.of('/score').to(`user:${mentorId}`).emit('mentor:score:updated', {
      mentorId,
      newTotal: result.newTotal,
      delta:    result.actualDelta,
      trigger,
      phase,
    });
  }

  return result.newTotal;
};

// ─── Score Retrieval ──────────────────────────────────────────────────────────

export const getMentorScore = async (mentorId: string): Promise<IMentorScore | null> => {
  const cached = await redis.get<string>(cacheKey(mentorId));
  if (cached) {
    try {
      return JSON.parse(cached) as IMentorScore;
    } catch {
      // fall through to DB
    }
  }

  const doc = await MentorScore.findOne({ mentorId }).lean();
  if (!doc) return null;

  // Compute incubationRate: prototype transitions / total unique students with class photos
  const [prototypeEvents, uniqueStudentsCount] = await Promise.all([
    MentorScoreEvent.countDocuments({ mentorId, trigger: MentorScoreTrigger.STUDENT_PROTOTYPE_TRANSITION }),
    MentorVerificationTask.distinct('submissionData.curriculumTaskId', {
      mentorId,
      type:   'class_photo',
      status: 'approved',
    }).then((ids) => ids.length),
  ]);

  const denominator = Math.max(uniqueStudentsCount, 1);
  (doc as IMentorScore & { incubationRate: number }).incubationRate =
    parseFloat((Math.min(1, prototypeEvents / denominator)).toFixed(3));

  await redis.set(cacheKey(mentorId), JSON.stringify(doc), { ex: SCORE_CACHE_TTL });
  return doc;
};

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export const getMentorLeaderboard = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const docs = await MentorScore.find()
    .sort({ totalScore: -1 })
    .skip(skip)
    .limit(limit)
    .populate('mentorId', 'displayName avatar headline')
    .lean();

  const total = await MentorScore.countDocuments();
  return { docs, total, page, limit };
};

// ─── Cache Rebuild (recovery tool) ────────────────────────────────────────────

export const rebuildMentorScoreCache = async (mentorId: string): Promise<void> => {
  const events = await MentorScoreEvent.find({ mentorId }).lean();

  const phase1Breakdown = { training: 0, labSync: 0, curriculumMapping: 0 };
  const phase2Breakdown = { industryConnects: 0, prototypeVelocity: 0, demoDay: 0 };
  const phase3Breakdown = { resourceLibrary: 0, forum: 0, sessions: 0, equityLOIs: 0, outcomeBonuses: 0 };
  let phase1Score = 0, phase2Score = 0, phase3Score = 0;

  for (const event of events) {
    const d = event.delta;
    if (event.phase === 1) {
      phase1Score += d;
      const f = PHASE1_FIELD_MAP[event.trigger];
      if (f) phase1Breakdown[f] += d;
    } else if (event.phase === 2) {
      phase2Score += d;
      const f = PHASE2_FIELD_MAP[event.trigger];
      if (f) phase2Breakdown[f] += d;
    } else if (event.phase === 3) {
      phase3Score += d;
      const f = PHASE3_FIELD_MAP[event.trigger];
      if (f) phase3Breakdown[f] += d;
    }
  }

  const totalScore = phase1Score + phase2Score + phase3Score;

  await MentorScore.findOneAndUpdate(
    { mentorId },
    {
      $set: {
        totalScore, phase1Score, phase2Score, phase3Score,
        phase1Breakdown, phase2Breakdown, phase3Breakdown,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );

  await redis.del(cacheKey(mentorId));
};

// ─── Decay Engine ─────────────────────────────────────────────────────────────

/**
 * Called by a daily cron job.
 * Applies score decay to mentors inactive for 60+ days.
 */
export const applyMentorScoreDecay = async (): Promise<{ affected: number }> => {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - DECAY_THRESHOLD_DAYS);

  const inactive = await MentorScore.find({
    lastActivityAt: { $lt: threshold },
    totalScore:     { $gt: 0 },
  }).lean();

  const today = new Date().toISOString().slice(0, 10);
  let affected = 0;

  for (const scoreDoc of inactive) {
    const mentorId = String(scoreDoc.mentorId);
    const msPerDay = 86_400_000;
    const daysOver = Math.floor((Date.now() - scoreDoc.lastActivityAt.getTime()) / msPerDay) - DECAY_THRESHOLD_DAYS;
    const fraction = Math.min(DECAY_MAX_FRACTION, daysOver * DECAY_RATE_PER_DAY);
    const decayAmt = -Math.floor(scoreDoc.totalScore * fraction);

    if (decayAmt >= 0) continue;

    const key = `decay:${mentorId}:${today}`;
    try {
      const phase = scoreDoc.phase3Score > 0 ? 3 : scoreDoc.phase2Score > 0 ? 2 : 1;
      await awardMentorPoints({
        mentorId,
        trigger:        MentorScoreTrigger.SCORE_DECAY,
        delta:          decayAmt,
        phase:          phase as 1 | 2 | 3,
        idempotencyKey: key,
        metadata:       { daysOverThreshold: daysOver, fraction },
      });
      affected++;
    } catch {
      // Idempotency collision means decay already ran today — skip
    }
  }

  return { affected };
};

// ─── Mentorship Rating Update ─────────────────────────────────────────────────

export const updateMentorRating = async (
  mentorId: string,
  newRating: number,
): Promise<void> => {
  await MentorScore.findOneAndUpdate(
    { mentorId },
    { $set: { mentorshipRating: Math.min(5, Math.max(0, newRating)), updatedAt: new Date() } },
    { upsert: true },
  );
  await redis.del(cacheKey(mentorId));
};

// ─── Rank Refresh (run after bulk score changes) ──────────────────────────────

export const refreshMentorRanks = async (): Promise<void> => {
  const docs = await MentorScore.find().sort({ totalScore: -1 }).select('mentorId').lean();
  const bulkOps = docs.map((doc, idx) => ({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: { rank: idx + 1 } },
    },
  }));
  if (bulkOps.length) await MentorScore.bulkWrite(bulkOps);
};

// ─── Phase-aware helper used by admin controllers ─────────────────────────────

export const getPhaseForTrigger = (trigger: MentorScoreTriggerType): 1 | 2 | 3 => {
  if (PHASE1_FIELD_MAP[trigger] !== undefined ||
      trigger === MentorScoreTrigger.TRAINING_MODULE_COMPLETED ||
      trigger === MentorScoreTrigger.QUIZ_PASSED) return 1;
  if (PHASE2_FIELD_MAP[trigger] !== undefined) return 2;
  return 3;
};
