import { applyScore } from '../../src/services/scoreEngine';
import { ScoreEvent } from '../../src/modules/innovationScore/score.model';
import { User } from '../../src/modules/user/user.model';
import { UserRole } from '../../src/types/roles.types';

const createStudent = async (email: string) =>
  User.create({
    email,
    passwordHash: 'hashed',
    role: UserRole.STUDENT,
    displayName: 'Score Student',
    accessGrantedBy: 'admin',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  });

describe('score engine one-time triggers', () => {
  beforeEach(async () => {
    await ScoreEvent.syncIndexes();
  });

  it('awards each profile-completion trigger only once', async () => {
    const user = await createStudent('score-student@example.com');

    const firstGithubScore = await applyScore({ userId: String(user._id), trigger: 'GITHUB_CONNECTED' });
    const secondGithubScore = await applyScore({ userId: String(user._id), trigger: 'GITHUB_CONNECTED' });
    const firstLinkedInScore = await applyScore({ userId: String(user._id), trigger: 'LINKEDIN_CONNECTED' });
    const secondLinkedInScore = await applyScore({ userId: String(user._id), trigger: 'LINKEDIN_CONNECTED' });
    const firstResumeScore = await applyScore({ userId: String(user._id), trigger: 'RESUME_UPLOADED' });
    const secondResumeScore = await applyScore({ userId: String(user._id), trigger: 'RESUME_UPLOADED' });
    const firstCompletionScore = await applyScore({ userId: String(user._id), trigger: 'PROFILE_COMPLETE' });
    const secondCompletionScore = await applyScore({ userId: String(user._id), trigger: 'PROFILE_COMPLETE' });

    expect(firstGithubScore).toBe(25);
    expect(secondGithubScore).toBe(25);
    expect(firstLinkedInScore).toBe(50);
    expect(secondLinkedInScore).toBe(50);
    expect(firstResumeScore).toBe(65);
    expect(secondResumeScore).toBe(65);
    expect(firstCompletionScore).toBe(115);
    expect(secondCompletionScore).toBe(115);

    const finalUser = await User.findById(user._id).lean();
    expect(finalUser?.innovationScore).toBe(115);

    const events = await ScoreEvent.find({ userId: user._id }).sort({ createdAt: 1 }).lean();
    expect(events).toHaveLength(4);
    expect(events.map((event) => event.trigger)).toEqual([
      'GITHUB_CONNECTED',
      'LINKEDIN_CONNECTED',
      'RESUME_UPLOADED',
      'PROFILE_COMPLETE',
    ]);
  });

  it('keeps one-time triggers idempotent under concurrent requests', async () => {
    const user = await createStudent('score-concurrent@example.com');

    const scores = await Promise.all(
      Array.from({ length: 5 }, () =>
        applyScore({ userId: String(user._id), trigger: 'GITHUB_CONNECTED' }),
      ),
    );

    expect(Math.max(...scores)).toBe(25);

    const finalUser = await User.findById(user._id).lean();
    expect(finalUser?.innovationScore).toBe(25);

    const events = await ScoreEvent.find({ userId: user._id, trigger: 'GITHUB_CONNECTED' }).lean();
    expect(events).toHaveLength(1);
  });

  it('awards a custom idempotency key only once', async () => {
    const user = await createStudent('score-custom-idempotency@example.com');

    const firstScore = await applyScore({
      userId: String(user._id),
      trigger: 'PROGRESS_UPLOADED',
      idempotencyKey: 'workspace-progress:workspace-1:Final Delivery',
    });
    const secondScore = await applyScore({
      userId: String(user._id),
      trigger: 'PROGRESS_UPLOADED',
      idempotencyKey: 'workspace-progress:workspace-1:Final Delivery',
    });

    expect(firstScore).toBe(15);
    expect(secondScore).toBe(15);

    const finalUser = await User.findById(user._id).lean();
    expect(finalUser?.innovationScore).toBe(15);
    expect(finalUser?.scoreBreakdown.progressUploads).toBe(1);

    const events = await ScoreEvent.find({ userId: user._id, trigger: 'PROGRESS_UPLOADED' }).lean();
    expect(events).toHaveLength(1);
  });

  it('rejects repeatable score triggers without an idempotency key', async () => {
    const user = await createStudent('score-repeatable-guard@example.com');

    await expect(
      applyScore({
        userId: String(user._id),
        trigger: 'PATENT_APPROVED',
      }),
    ).rejects.toThrow('Score trigger PATENT_APPROVED requires an idempotencyKey');

    const finalUser = await User.findById(user._id).lean();
    expect(finalUser?.innovationScore ?? 0).toBe(0);

    const events = await ScoreEvent.find({ userId: user._id }).lean();
    expect(events).toHaveLength(0);
  });

  it('does not exceed the max score when concurrent awards hit the cap', async () => {
    const user = await createStudent('score-cap@example.com');
    await User.updateOne({ _id: user._id }, { innovationScore: 950 });

    await Promise.all([
      applyScore({
        userId: String(user._id),
        trigger: 'MARKET_READY_VERIFIED',
        idempotencyKey: 'cap-test:one',
      }),
      applyScore({
        userId: String(user._id),
        trigger: 'MARKET_READY_VERIFIED',
        idempotencyKey: 'cap-test:two',
      }),
    ]);

    const finalUser = await User.findById(user._id).lean();
    expect(finalUser?.innovationScore).toBe(1000);

    const events = await ScoreEvent.find({ userId: user._id }).lean();
    expect(events.reduce((sum, event) => sum + event.delta, 0)).toBe(50);
  });
});
