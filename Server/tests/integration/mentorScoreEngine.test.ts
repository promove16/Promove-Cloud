import { Types } from 'mongoose';
import { awardMentorPoints, getMentorScore, applyMentorScoreDecay, rebuildMentorScoreCache, refreshMentorRanks } from '../../src/modules/mentorScore/mentorScore.service';
import { MentorScore } from '../../src/modules/mentorScore/mentorScore.model';
import { MentorScoreEvent } from '../../src/modules/mentorScore/mentorScoreEvent.model';
import { MentorScoreTrigger } from '../../src/modules/mentorScore/mentorScore.types';
import { User } from '../../src/modules/user/user.model';
import { UserRole } from '../../src/types/roles.types';

const createMentorUser = async (email: string, name: string) =>
  User.create({
    email,
    passwordHash: 'hashed',
    role: UserRole.MENTOR,
    displayName: name,
    profileComplete: true,
    registrationStage: 'complete',
    accessGrantedBy: 'admin',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    verificationStatus: 'not_required',
    adminApprovalStatus: 'approved',
  });

describe('Mentor Score Engine', () => {
  it('awards points and respects Phase 1 and Phase 2 caps', async () => {
    const mentor = await createMentorUser('mentor1@example.com', 'Dr. Smith');
    const mentorId = String(mentor._id);

    // 1. Award Phase 1: Lab Sync (+40 pts)
    const total1 = await awardMentorPoints({
      mentorId,
      trigger: MentorScoreTrigger.LAB_HARDWARE_VERIFIED,
      delta: 40,
      phase: 1,
      idempotencyKey: 'idemp-1',
    });
    expect(total1).toBe(40);

    // 2. Award Phase 1: Curriculum Approved (+40 pts)
    const total2 = await awardMentorPoints({
      mentorId,
      trigger: MentorScoreTrigger.CURRICULUM_APPROVED,
      delta: 40,
      phase: 1,
      idempotencyKey: 'idemp-2',
    });
    expect(total2).toBe(80);

    // 3. Award Phase 1: Training Module Completed (+60 pts) - Phase 1 limit is 140.
    // Total is 80. Limit is 140, so remaining is 60. Let's award 70 points. It should cap at 60.
    const total3 = await awardMentorPoints({
      mentorId,
      trigger: MentorScoreTrigger.TRAINING_MODULE_COMPLETED,
      delta: 70,
      phase: 1,
      idempotencyKey: 'idemp-3',
    });
    expect(total3).toBe(140);

    const score = await getMentorScore(mentorId);
    expect(score?.phase1Score).toBe(140);
    expect(score?.phase1Breakdown.training).toBe(60); // Cap of training is 60, rest is discarded.
    expect(score?.phase1Breakdown.labSync).toBe(40);
    expect(score?.phase1Breakdown.curriculumMapping).toBe(40);

    // 4. Award Phase 2: Demo Day (+50 pts)
    const total4 = await awardMentorPoints({
      mentorId,
      trigger: MentorScoreTrigger.DEMO_DAY_VERIFIED,
      delta: 50,
      phase: 2,
      idempotencyKey: 'idemp-4',
    });
    expect(total4).toBe(190); // 140 + 50
  });

  it('handles idempotency key and rejects duplicate transactions', async () => {
    const mentor = await createMentorUser('mentor2@example.com', 'Dr. Jones');
    const mentorId = String(mentor._id);

    const score1 = await awardMentorPoints({
      mentorId,
      trigger: MentorScoreTrigger.LAB_HARDWARE_VERIFIED,
      delta: 40,
      phase: 1,
      idempotencyKey: 'idemp-unique-123',
    });

    const score2 = await awardMentorPoints({
      mentorId,
      trigger: MentorScoreTrigger.LAB_HARDWARE_VERIFIED,
      delta: 40,
      phase: 1,
      idempotencyKey: 'idemp-unique-123',
    });

    expect(score1).toBe(40);
    expect(score2).toBe(40); // Second attempt should be ignored, returning same score

    const events = await MentorScoreEvent.find({ mentorId }).lean();
    expect(events).toHaveLength(1);
  });

  it('correctly calculates and applies inactivity decay', async () => {
    const mentor = await createMentorUser('mentor3@example.com', 'Dr. Inactive');
    const mentorId = String(mentor._id);

    // Give mentor 100 points
    await awardMentorPoints({
      mentorId,
      trigger: MentorScoreTrigger.LAB_HARDWARE_VERIFIED,
      delta: 40,
      phase: 1,
      idempotencyKey: 'idemp-decay-1',
    });
    await awardMentorPoints({
      mentorId,
      trigger: MentorScoreTrigger.CURRICULUM_APPROVED,
      delta: 40,
      phase: 1,
      idempotencyKey: 'idemp-decay-2',
    });

    // Make lastActivityAt 70 days ago (threshold is 60 days)
    const activityDate = new Date();
    activityDate.setDate(activityDate.getDate() - 70);
    await MentorScore.updateOne({ mentorId }, { $set: { lastActivityAt: activityDate } });

    // Apply decay
    const { affected } = await applyMentorScoreDecay();
    expect(affected).toBe(1);

    const score = await getMentorScore(mentorId);
    // 70 days ago is 10 days past threshold (60 days)
    // Decay fraction is 10 * 0.005 = 5%
    // 80 * 0.05 = 4 pts decayed (decay amount is -4)
    expect(score?.totalScore).toBe(76); // 80 - 4 = 76
  });

  it('rebuilds the cache correctly from events', async () => {
    const mentor = await createMentorUser('mentor4@example.com', 'Dr. Rebuilt');
    const mentorId = String(mentor._id);

    // Manually create some events in the DB
    await MentorScoreEvent.create([
      {
        mentorId: new Types.ObjectId(mentorId),
        trigger: MentorScoreTrigger.LAB_HARDWARE_VERIFIED,
        delta: 40,
        scoreAfter: 40,
        phase: 1,
        idempotencyKey: 'r1',
      },
      {
        mentorId: new Types.ObjectId(mentorId),
        trigger: MentorScoreTrigger.DEMO_DAY_VERIFIED,
        delta: 50,
        scoreAfter: 90,
        phase: 2,
        idempotencyKey: 'r2',
      },
    ]);

    await rebuildMentorScoreCache(mentorId);

    const score = await getMentorScore(mentorId);
    expect(score?.totalScore).toBe(90);
    expect(score?.phase1Score).toBe(40);
    expect(score?.phase2Score).toBe(50);
  });

  it('refreshes and sorts leaderboard ranks correctly', async () => {
    const [mentor1, mentor2] = await Promise.all([
      createMentorUser('m1@example.com', 'Mentor A'),
      createMentorUser('m2@example.com', 'Mentor B'),
    ]);

    await awardMentorPoints({
      mentorId: String(mentor1._id),
      trigger: MentorScoreTrigger.LAB_HARDWARE_VERIFIED,
      delta: 40,
      phase: 1,
      idempotencyKey: 'rank-1',
    });

    await awardMentorPoints({
      mentorId: String(mentor2._id),
      trigger: MentorScoreTrigger.LAB_HARDWARE_VERIFIED,
      delta: 20,
      phase: 1,
      idempotencyKey: 'rank-2',
    });

    await refreshMentorRanks();

    const score1 = await getMentorScore(String(mentor1._id));
    const score2 = await getMentorScore(String(mentor2._id));

    expect(score1?.rank).toBe(1); // Higher score (40) gets rank #1
    expect(score2?.rank).toBe(2); // Lower score (20) gets rank #2
  });
});
