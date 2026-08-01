import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { redis } from '../../src/config/redis';
import { ScoreEvent } from '../../src/modules/innovationScore/score.model';
import { User } from '../../src/modules/user/user.model';
import { UserRole } from '../../src/types/roles.types';

const PASSWORD = 'Password123!';

const createApprovedStudent = async (overrides?: {
  email?: string;
  displayName?: string;
  innovationScore?: number;
  createdAt?: Date;
}) => {
  const email = overrides?.email ?? `student-${randomUUID()}@example.com`;
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const user = await User.create({
    email,
    passwordHash,
    role: UserRole.STUDENT,
    displayName: overrides?.displayName ?? 'Score Student',
    innovationScore: overrides?.innovationScore ?? 0,
    profileComplete: true,
    registrationStage: 'profile_setup',
    accessGrantedBy: 'admin',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    institutionToken: null,
    institutionId: null,
    institutionVerificationStatus: 'none',
    verificationStatus: 'verified',
    adminApprovalStatus: 'not_required',
    ...(overrides?.createdAt ? { createdAt: overrides.createdAt, updatedAt: overrides.createdAt } : {}),
  });

  return { user, email };
};

const loginAs = async (email: string) => {
  const response = await request(app).post('/api/auth/login').send({
    email,
    password: PASSWORD,
  });

  return response.body.data?.accessToken as string;
};

describe('score integration', () => {
  it('normalizes legacy scores, sums only recent deltas, and uses reverse leaderboard rank', async () => {
    const now = Date.now();
    const { user, email } = await createApprovedStudent({
      displayName: 'Top Builder',
      innovationScore: 1360,
      createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000),
    });
    const { user: secondUser } = await createApprovedStudent({
      displayName: 'Second Builder',
      innovationScore: 120,
      createdAt: new Date(now - 9 * 24 * 60 * 60 * 1000),
    });
    const { user: thirdUser } = await createApprovedStudent({
      displayName: 'Third Builder',
      innovationScore: 80,
      createdAt: new Date(now - 8 * 24 * 60 * 60 * 1000),
    });

    await ScoreEvent.create([
      {
        userId: user._id,
        trigger: 'PROGRESS_UPLOADED',
        delta: 15,
        scoreAfter: 1000,
        createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
      },
      {
        userId: user._id,
        trigger: 'PROBLEM_CLAIMED',
        delta: 5,
        scoreAfter: 345,
        createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000),
      },
    ]);

    await redis.zadd('lb:global', { member: String(user._id), score: 1000 });
    await redis.zadd('lb:global', { member: String(secondUser._id), score: 120 });
    await redis.zadd('lb:global', { member: String(thirdUser._id), score: 80 });

    const accessToken = await loginAs(email);

    const response = await request(app)
      .get('/api/score/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.score).toBe(1000);
    expect(response.body.data.weeklyDelta).toBe(15);
    expect(response.body.data.rankPercentile).toBe(33);
    expect(response.body.data.breakdown).toEqual({
      problemsClaimed: 0,
      problemsCompleted: 0,
      skillsCompleted: 0,
      progressUploads: 0,
      patentsSubmitted: 0,
      patentsApproved: 0,
      mvpsVerified: 0,
      marketReadyVerified: 0,
      startupsLaunched: 0,
    });

    const updatedUser = await User.findById(user._id).lean();
    expect(updatedUser?.innovationScore).toBe(1000);
  });

  it('prevents students from reading another student score history', async () => {
    const { email } = await createApprovedStudent({
      displayName: 'History Viewer',
    });
    const { user: otherUser } = await createApprovedStudent({
      displayName: 'Private History Owner',
    });

    await ScoreEvent.create({
      userId: otherUser._id,
      trigger: 'PROGRESS_UPLOADED',
      delta: 15,
      scoreAfter: 15,
      metadata: { workspaceId: 'private-workspace' },
    });

    const accessToken = await loginAs(email);

    const response = await request(app)
      .get(`/api/score/history/${otherUser._id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('SCORE_HISTORY_FORBIDDEN');
  });

  it('persists an onboarding achievement score before the claim succeeds and prevents duplicate awards', async () => {
    const { user, email } = await createApprovedStudent({
      displayName: 'Onboarding Builder',
    });
    await User.updateOne(
      { _id: user._id },
      {
        bio: 'Building verified products',
        domain: 'Product Engineering',
      },
    );
    const accessToken = await loginAs(email);

    const initialScore = await request(app)
      .get('/api/score/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(initialScore.status).toBe(200);
    expect(initialScore.body.data.score).toBe(0);

    const firstClaim = await request(app)
      .post('/api/users/me/onboarding/claim/profile')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(firstClaim.status).toBe(200);
    expect(firstClaim.body.data.awarded).toBe(50);

    const [studentAfterFirstClaim, scoreEvents] = await Promise.all([
      User.findById(user._id).select('innovationScore').lean(),
      ScoreEvent.find({ userId: user._id, trigger: 'ONBOARDING_PROFILE' }).lean(),
    ]);
    expect(studentAfterFirstClaim?.innovationScore).toBe(50);
    expect(scoreEvents).toHaveLength(1);
    expect(scoreEvents[0]?.delta).toBe(50);

    const visibleScore = await request(app)
      .get('/api/score/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(visibleScore.status).toBe(200);
    expect(visibleScore.body.data.score).toBe(50);

    const onboardingStatus = await request(app)
      .get('/api/users/me/onboarding')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(onboardingStatus.status).toBe(200);
    expect(onboardingStatus.body.data.earnedPoints).toBe(50);
    expect(onboardingStatus.body.data.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'profile', completed: true, claimed: true }),
      ]),
    );

    const secondClaim = await request(app)
      .post('/api/users/me/onboarding/claim/profile')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(secondClaim.status).toBe(200);
    expect(secondClaim.body.data.awarded).toBe(0);
    await expect(
      ScoreEvent.countDocuments({ userId: user._id, trigger: 'ONBOARDING_PROFILE' }),
    ).resolves.toBe(1);
    await expect(
      User.findById(user._id).select('innovationScore').lean(),
    ).resolves.toEqual(expect.objectContaining({ innovationScore: 50 }));
  });
});
