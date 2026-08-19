import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import { MentorVerificationTask } from './mentorVerificationTask.model';
import { AdminAuditLog } from '../admin/adminAuditLog.model';
import { User } from '../user/user.model';
import { UserRole } from '../../types/roles.types';
import {
  awardMentorPoints,
  getMentorLeaderboard,
  rebuildMentorScoreCache,
  refreshMentorRanks,
  applyMentorScoreDecay,
} from './mentorScore.service';
import { MentorScoreEvent } from './mentorScoreEvent.model';
import { MentorScore } from './mentorScore.model';
import {
  MentorScoreTrigger,
  MentorScoreTriggerType,
  VerificationTaskStatus,
} from './mentorScore.types';
import { getPhaseForTrigger as _getPhase } from './mentorScore.service';
import { CURRICULUM_PDF_POINTS, getClassPhotoPoints } from './mentorScore.curriculum';

// ─── Verification Queue ───────────────────────────────────────────────────────

export const listVerificationTasks = async (req: Request, res: Response) => {
  const status  = (req.query.status  as VerificationTaskStatus | undefined) ?? 'pending';
  const type    = req.query.type    as string | undefined;
  const page    = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit   = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip    = (page - 1) * limit;

  const filter: Record<string, unknown> = { status };
  if (type) filter.type = type;

  const [tasks, total] = await Promise.all([
    MentorVerificationTask.find(filter)
      .populate('mentorId', 'displayName avatar email')
      .populate('reviewedBy', 'displayName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    MentorVerificationTask.countDocuments(filter),
  ]);

  res.json(new ApiResponse({ tasks, total, page, limit }));
};

export const approveVerificationTask = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const { id } = req.params;
  const pointsOverride = req.body.pointsOverride as number | undefined;

  const task = await MentorVerificationTask.findById(id);
  if (!task) throw new ApiError(404, 'TASK_NOT_FOUND', 'Verification task not found');
  if (task.status !== 'pending') {
    throw new ApiError(400, 'TASK_ALREADY_REVIEWED', 'Task has already been reviewed');
  }

  let defaultPoints = task.pointsToAward;
  if (task.type === 'curriculum_pdf') {
    defaultPoints = CURRICULUM_PDF_POINTS;
  } else if (task.type === 'class_photo') {
    const curriculumTaskId = String(task.submissionData.curriculumTaskId ?? '');
    const classIndex = Number(task.submissionData.classIndex);
    const curriculum = await MentorVerificationTask.findOne({
      _id: curriculumTaskId,
      mentorId: task.mentorId,
      type: 'curriculum_pdf',
      status: 'approved',
    })
      .select('submissionData.plannedClassesCount')
      .lean();
    const plannedClasses = Number(curriculum?.submissionData.plannedClassesCount);

    if (
      !curriculum ||
      !Number.isInteger(plannedClasses) ||
      plannedClasses < 1 ||
      !Number.isInteger(classIndex) ||
      classIndex < 1 ||
      classIndex > plannedClasses
    ) {
      throw new ApiError(
        400,
        'INVALID_CURRICULUM_EVIDENCE',
        'Class photo must reference a valid approved curriculum and planned class index',
      );
    }
    defaultPoints = getClassPhotoPoints(plannedClasses, classIndex);
  }

  const finalPoints = (typeof pointsOverride === 'number' && pointsOverride >= 0)
    ? pointsOverride
    : defaultPoints;

  const triggerMap: Record<string, MentorScoreTriggerType> = {
    lab_sync:          MentorScoreTrigger.LAB_HARDWARE_VERIFIED,
    curriculum_pdf:    MentorScoreTrigger.CURRICULUM_APPROVED,
    class_photo:       MentorScoreTrigger.CLASS_PHOTO_VERIFIED,
    industry_session:  MentorScoreTrigger.INDUSTRY_SESSION_VERIFIED,
    prototype_velocity: MentorScoreTrigger.STUDENT_PROTOTYPE_TRANSITION,
    demo_day:          MentorScoreTrigger.DEMO_DAY_VERIFIED,
    outcome_bonus:     MentorScoreTrigger.MENTEE_OUTCOME_BONUS,
  };

  const trigger = triggerMap[task.type];
  if (!trigger) throw new ApiError(500, 'UNKNOWN_TASK_TYPE', 'Cannot map task to trigger');

  const phase = _getPhase(trigger);

  // Prototype velocity is credited once per student per mentor — use a shared
  // idempotency key so the milestone-verification hook and this task cannot
  // double-award the same transition.
  const idempotencyKey =
    task.type === 'prototype_velocity'
      ? `prototype:${String(task.submissionData.studentId ?? '')}:${task.mentorId}`
      : `task_approved:${task._id}`;

  const newTotal = await awardMentorPoints({
    mentorId:       task.mentorId,
    trigger,
    delta:          finalPoints,
    phase,
    idempotencyKey,
    metadata:       { adminId: req.user._id, taskId: task._id, taskType: task.type },
  });

  task.status     = 'approved';
  task.pointsToAward = finalPoints;
  task.reviewedBy = new Types.ObjectId(String(req.user._id));
  task.reviewedAt = new Date();
  await task.save();

  await AdminAuditLog.create({
    adminId:     req.user._id,
    action:      'AWARD_APPROVED',
    targetId:    task._id,
    targetModel: 'MentorVerificationTask',
    metadata:    { mentorId: task.mentorId, pointsAwarded: finalPoints, trigger },
  });

  res.json(new ApiResponse({ task, newTotal, pointsAwarded: finalPoints }));
};

export const rejectVerificationTask = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const { id } = req.params;
  const note = (req.body.note as string | undefined)?.trim();

  const task = await MentorVerificationTask.findById(id);
  if (!task) throw new ApiError(404, 'TASK_NOT_FOUND', 'Verification task not found');
  if (task.status !== 'pending') {
    throw new ApiError(400, 'TASK_ALREADY_REVIEWED', 'Task has already been reviewed');
  }

  task.status        = 'rejected';
  task.reviewedBy    = new Types.ObjectId(String(req.user._id));
  task.reviewedAt    = new Date();
  task.rejectionNote = note;
  await task.save();

  await AdminAuditLog.create({
    adminId:     req.user._id,
    action:      'AWARD_REJECTED',
    targetId:    task._id,
    targetModel: 'MentorVerificationTask',
    metadata:    { mentorId: task.mentorId, reason: note },
  });

  res.json(new ApiResponse({ task }));
};

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export const getMentorLeaderboardHandler = async (req: Request, res: Response) => {
  const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const phase = req.query.phase as string | undefined;

  let data;
  if (phase && ['1', '2', '3'].includes(phase)) {
    const phaseKey = `phase${phase}Score` as 'phase1Score' | 'phase2Score' | 'phase3Score';
    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      MentorScore.find()
        .sort({ [phaseKey]: -1 })
        .skip(skip)
        .limit(limit)
        .populate('mentorId', 'displayName avatar headline')
        .lean(),
      MentorScore.countDocuments(),
    ]);
    data = { docs, total, page, limit };
  } else {
    data = await getMentorLeaderboard(page, limit);
  }

  res.json(new ApiResponse(data));
};

// ─── Score History (admin view) ────────────────────────────────────────────────

export const getMentorScoreHistory = async (req: Request, res: Response) => {
  const mentorIdInput = String(req.params.mentorId).trim();
  if (!mentorIdInput) throw new ApiError(400, 'MENTOR_ID_REQUIRED', 'mentorId is required');

  let resolvedMentorId: Types.ObjectId | null = null;
  if (Types.ObjectId.isValid(mentorIdInput)) {
    resolvedMentorId = new Types.ObjectId(mentorIdInput);
  } else {
    // Attempt lookup by email or case-insensitive displayName
    const user = await User.findOne({
      role: UserRole.MENTOR,
      $or: [
        { email: mentorIdInput },
        { displayName: { $regex: new RegExp(`^${mentorIdInput}$`, 'i') } },
      ],
    }).select('_id').lean();

    if (user) {
      resolvedMentorId = user._id;
    }
  }

  if (!resolvedMentorId) {
    return res.json(new ApiResponse({ scoreDoc: null, events: [], total: 0 }));
  }

  const events = await MentorScoreEvent.find({ mentorId: resolvedMentorId })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const scoreDoc = await MentorScore.findOne({ mentorId: resolvedMentorId }).lean();

  res.json(new ApiResponse({ scoreDoc, events, total: events.length }));
};

// ─── Manual Admin Adjustment ──────────────────────────────────────────────────

export const adminAdjustMentorScore = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const { mentorId, delta, reason, phase } = req.body as {
    mentorId: string;
    delta:    number;
    reason:   string;
    phase:    1 | 2 | 3;
  };

  if (!mentorId || delta === undefined || !phase) {
    throw new ApiError(400, 'MISSING_FIELDS', 'mentorId, delta, and phase are required');
  }

  const key = `admin_adjust:${mentorId}:${Date.now()}`;
  const newTotal = await awardMentorPoints({
    mentorId,
    trigger:        MentorScoreTrigger.ADMIN_ADJUSTMENT,
    delta:          Number(delta),
    phase:          phase as 1 | 2 | 3,
    idempotencyKey: key,
    metadata:       { adminId: req.user._id, reason },
  });

  res.json(new ApiResponse({ mentorId, delta, newTotal }));
};

// ─── Content Creator Bonus ──────────────────────────────────────────────────────

export const awardContentCreatorBonus = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const { mentorId, points, reason } = req.body as {
    mentorId: string;
    points: number;
    reason: string;
  };

  if (!mentorId || !points) {
    throw new ApiError(400, 'MISSING_FIELDS', 'mentorId and points are required');
  }

  if (points <= 0 || points > 50) {
    throw new ApiError(400, 'INVALID_POINTS', 'Points must be between 1 and 50');
  }

  const newTotal = await awardMentorPoints({
    mentorId,
    trigger:        MentorScoreTrigger.CONTENT_CREATOR_BONUS,
    delta:          points,
    phase:          3,
    idempotencyKey: `content_creator:${mentorId}:${Date.now()}`,
    metadata:       { points, reason, adminId: String(req.user._id) },
  });

  res.json(new ApiResponse({ mentorId, pointsAwarded: points, newTotal }));
};

// ─── Outcome Bonus ────────────────────────────────────────────────────────────

export const awardOutcomeBonus = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const { mentorId, studentId, achievementType, evidenceUrl } = req.body as {
    mentorId:        string;
    studentId:       string;
    achievementType: 'competition_win' | 'funded';
    evidenceUrl?:    string;
  };

  if (!mentorId || !studentId || !achievementType) {
    throw new ApiError(400, 'MISSING_FIELDS', 'mentorId, studentId, and achievementType are required');
  }

  const newTotal = await awardMentorPoints({
    mentorId,
    trigger:        MentorScoreTrigger.MENTEE_OUTCOME_BONUS,
    delta:          50,
    phase:          3,
    idempotencyKey: `outcome:${mentorId}:${studentId}:${achievementType}`,
    metadata:       { studentId, achievementType, evidenceUrl, adminId: String(req.user._id) },
  });

  res.json(new ApiResponse({ mentorId, studentId, achievementType, pointsAwarded: 50, newTotal }));
};

// ─── LOI Record (Equity Mentorship) ──────────────────────────────────────────

export const recordEquityLOI = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const { mentorId, bidId, note } = req.body as {
    mentorId: string;
    bidId:    string;
    note?:    string;
  };

  if (!mentorId || !bidId) {
    throw new ApiError(400, 'MISSING_FIELDS', 'mentorId and bidId are required');
  }

  const newTotal = await awardMentorPoints({
    mentorId,
    trigger:        MentorScoreTrigger.EQUITY_LOI_SIGNED,
    delta:          15,
    phase:          3,
    idempotencyKey: `loi:${bidId}`,
    metadata:       { bidId, adminId: String(req.user._id), note },
  });

  res.json(new ApiResponse({ mentorId, bidId, newTotal, pointsAwarded: 15 }));
};

// ─── Maintenance ──────────────────────────────────────────────────────────────

export const triggerRebuildCache = async (req: Request, res: Response) => {
  const mentorId = String(req.params.mentorId);
  await rebuildMentorScoreCache(mentorId);
  await refreshMentorRanks();
  res.json(new ApiResponse({ message: 'Cache rebuilt and ranks refreshed' }));
};

export const triggerDecay = async (_req: Request, res: Response) => {
  const result = await applyMentorScoreDecay();
  res.json(new ApiResponse(result));
};
