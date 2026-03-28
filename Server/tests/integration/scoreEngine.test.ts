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

    expect(firstGithubScore).toBe(5);
    expect(secondGithubScore).toBe(5);
    expect(firstLinkedInScore).toBe(10);
    expect(secondLinkedInScore).toBe(10);
    expect(firstResumeScore).toBe(13);
    expect(secondResumeScore).toBe(13);
    expect(firstCompletionScore).toBe(23);
    expect(secondCompletionScore).toBe(23);

    const finalUser = await User.findById(user._id).lean();
    expect(finalUser?.innovationScore).toBe(23);

    const events = await ScoreEvent.find({ userId: user._id }).sort({ createdAt: 1 }).lean();
    expect(events).toHaveLength(4);
    expect(events.map((event) => event.trigger)).toEqual([
      'GITHUB_CONNECTED',
      'LINKEDIN_CONNECTED',
      'RESUME_UPLOADED',
      'PROFILE_COMPLETE',
    ]);
  });
});
