/**
 * Side-effect hooks called from other modules when mentor-relevant events occur.
 * Import these into the source modules — never import the source modules here.
 */

import { MentorSession } from '../mentor/mentorSession.model';
import { User } from '../user/user.model';
import { MentorScore } from './mentorScore.model';
import { awardMentorPoints } from './mentorScore.service';
import { MentorScoreTrigger, MENTOR_PHASE2_CAPS } from './mentorScore.types';
import { logError } from '../../config/logger';

// ─── Prototype Velocity ───────────────────────────────────────────────────────

const PROTOTYPE_POINTS_PER_STUDENT = 10;

/**
 * Call this when a student's PROTOTYPE milestone is verified by admin.
 * Awards points to every mentor who has had a completed session with that student.
 *
 * @param studentId  - the student (workspace owner) whose milestone was just verified
 * @param workspaceId - the workspace containing the milestone (for idempotency)
 */
export const onPrototypeMilestoneVerified = async (
  studentId: string,
  workspaceId: string,
): Promise<void> => {
  try {
    // Find all mentors with at least one completed session with this student
    const sessions = await MentorSession.find({
      studentId,
      status: 'Completed',
    })
      .select('mentorId')
      .lean();

    if (!sessions.length) return;

    const uniqueMentorIds = [...new Set(sessions.map((s) => String(s.mentorId)))];

    await Promise.all(
      uniqueMentorIds.map(async (mentorId) => {
        // Check if this mentor has already hit their phase 2 cap
        const scoreDoc = await MentorScore.findOne({ mentorId })
          .select('phase2Breakdown')
          .lean();

        const currentVelocity = scoreDoc?.phase2Breakdown?.prototypeVelocity ?? 0;
        if (currentVelocity >= MENTOR_PHASE2_CAPS.prototypeVelocity) return;

        await awardMentorPoints({
          mentorId,
          trigger:        MentorScoreTrigger.STUDENT_PROTOTYPE_TRANSITION,
          delta:          PROTOTYPE_POINTS_PER_STUDENT,
          phase:          2,
          idempotencyKey: `prototype:${workspaceId}:${mentorId}`,
          metadata:       { studentId, workspaceId },
        });
      }),
    );
  } catch (err) {
    logError('onPrototypeMilestoneVerified hook failed', err);
  }
};

// ─── Training Completion ──────────────────────────────────────────────────────

/**
 * Call this when a mentor completes a training module or passes a quiz.
 * Points are distributed proportionally across the 60-pt training cap.
 *
 * @param mentorId    - the mentor who completed training
 * @param moduleId    - unique identifier for the training module
 * @param modulePoints - points this specific module is worth (configured externally)
 */
export const onTrainingModuleCompleted = async (
  mentorId: string,
  moduleId: string,
  modulePoints: number,
): Promise<void> => {
  try {
    await awardMentorPoints({
      mentorId,
      trigger:        MentorScoreTrigger.TRAINING_MODULE_COMPLETED,
      delta:          modulePoints,
      phase:          1,
      idempotencyKey: `training:${mentorId}:${moduleId}`,
      metadata:       { moduleId, modulePoints },
    });
  } catch (err) {
    logError('onTrainingModuleCompleted hook failed', err);
  }
};

export const onQuizPassed = async (
  mentorId: string,
  quizId: string,
  quizPoints: number,
): Promise<void> => {
  try {
    await awardMentorPoints({
      mentorId,
      trigger:        MentorScoreTrigger.QUIZ_PASSED,
      delta:          quizPoints,
      phase:          1,
      idempotencyKey: `quiz:${mentorId}:${quizId}`,
      metadata:       { quizId, quizPoints },
    });
  } catch (err) {
    logError('onQuizPassed hook failed', err);
  }
};

// ─── Equity LOI Signed ────────────────────────────────────────────────────────

const LOI_POINTS = 15;

/**
 * Call this when a mentor's bid is accepted (equity-for-mentorship LOI signed).
 *
 * @param mentorId - the mentor who accepted equity
 * @param bidId    - the MentorBid document id (used as idempotency key)
 */
export const onMentorBidAccepted = async (
  mentorId: string,
  bidId: string,
): Promise<void> => {
  try {
    await awardMentorPoints({
      mentorId,
      trigger:        MentorScoreTrigger.EQUITY_LOI_SIGNED,
      delta:          LOI_POINTS,
      phase:          3,
      idempotencyKey: `loi:${bidId}`,
      metadata:       { bidId },
    });
  } catch (err) {
    logError('onMentorBidAccepted hook failed', err);
  }
};
