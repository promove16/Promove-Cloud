import { ScoreEvent } from '../../src/modules/innovationScore/score.model';
import { verifyMilestone } from '../../src/modules/admin/admin.service';
import { User } from '../../src/modules/user/user.model';
import { Workspace } from '../../src/modules/workspace/workspace.model';
import { UserRole } from '../../src/types/roles.types';

const createUser = async (role: UserRole, email: string, displayName: string) =>
  User.create({
    email,
    passwordHash: 'hashed',
    role,
    displayName,
    profileComplete: true,
    registrationStage: role === UserRole.STUDENT ? 'profile_setup' : 'complete',
    accessGrantedBy: 'admin',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    verificationStatus: role === UserRole.STUDENT ? 'verified' : 'not_required',
    adminApprovalStatus: role === UserRole.STUDENT ? 'not_required' : 'approved',
  });

describe('admin milestone scoring', () => {
  it('does not award score again when the same milestone is re-verified', async () => {
    const [admin, student] = await Promise.all([
      createUser(UserRole.ADMIN, 'milestone-admin@example.com', 'Milestone Admin'),
      createUser(UserRole.STUDENT, 'milestone-student@example.com', 'Milestone Student'),
    ]);

    const workspace = await Workspace.create({
      ownerId: student._id,
      teamMemberIds: [student._id],
      title: 'Milestone Workspace',
      category: 'AI',
      stage: 'Build',
      progressPercent: 80,
      milestones: [
        {
          name: 'Design & Prototyping',
          isCompleted: true,
          completionPercent: 100,
          completedBy: student._id,
          completedAt: new Date(Date.now() - 60_000),
        },
      ],
    });
    const milestoneId = String(workspace.milestones[0]._id);

    const firstScore = await verifyMilestone(String(admin._id), milestoneId, 'MVP');
    const secondScore = await verifyMilestone(String(admin._id), milestoneId, 'MVP');

    expect(firstScore).toBe(100);
    expect(secondScore).toBe(100);

    const updatedStudent = await User.findById(student._id).lean();
    expect(updatedStudent?.innovationScore).toBe(100);

    const scoreEvents = await ScoreEvent.find({
      userId: student._id,
      'metadata.milestoneId': milestoneId,
    }).lean();

    expect(scoreEvents).toHaveLength(1);
    expect(scoreEvents[0]).toEqual(
      expect.objectContaining({
        trigger: 'MVP_VERIFIED',
        delta: 100,
        scoreAfter: 100,
      }),
    );
  });
});
