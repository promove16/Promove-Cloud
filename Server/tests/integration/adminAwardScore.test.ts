import { approveAward } from '../../src/modules/admin/admin.service';
import { AdminAward } from '../../src/modules/admin/award.model';
import { ScoreEvent } from '../../src/modules/innovationScore/score.model';
import { User } from '../../src/modules/user/user.model';
import { UserRole } from '../../src/types/roles.types';

const createUser = async (role: UserRole, email: string, displayName: string) =>
  User.create({
    email,
    passwordHash: 'hashed',
    role,
    displayName,
    innovationScore: role === UserRole.STUDENT ? 320 : 0,
    profileComplete: true,
    registrationStage: role === UserRole.STUDENT ? 'profile_setup' : 'complete',
    accessGrantedBy: 'admin',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    verificationStatus: role === UserRole.STUDENT ? 'verified' : 'not_required',
    adminApprovalStatus: role === UserRole.STUDENT ? 'not_required' : 'approved',
  });

describe('admin award scoring', () => {
  it('approves awards without changing innovation score or creating score events', async () => {
    const [admin, student] = await Promise.all([
      createUser(UserRole.ADMIN, 'award-admin@example.com', 'Award Admin'),
      createUser(UserRole.STUDENT, 'award-student@example.com', 'Award Student'),
    ]);

    const award = await AdminAward.create({
      studentId: student._id,
      title: 'National Prototype Prize',
      description: 'Recognized externally, but does not affect Innovation Score.',
      status: 'submitted',
      submittedAt: new Date(),
    });

    await approveAward(String(admin._id), String(award._id));

    const [updatedStudent, updatedAward, scoreEvents] = await Promise.all([
      User.findById(student._id).lean(),
      AdminAward.findById(award._id).lean(),
      ScoreEvent.find({ userId: student._id }).lean(),
    ]);

    expect(updatedStudent?.innovationScore).toBe(320);
    expect(updatedAward?.status).toBe('approved');
    expect(scoreEvents).toHaveLength(0);
  });
});
