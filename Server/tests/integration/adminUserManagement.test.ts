import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { AdminAuditLog } from '../../src/modules/admin/adminAuditLog.model';
import { User } from '../../src/modules/user/user.model';
import { UserRole } from '../../src/types/roles.types';

const PASSWORD = 'Password123!';

const createApprovedUser = async (input: {
  role: UserRole;
  email?: string;
  displayName?: string;
}) => {
  const email = input.email ?? `${input.role}-${randomUUID()}@example.com`;
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const user = await User.create({
    email,
    passwordHash,
    role: input.role,
    displayName: input.displayName ?? `${input.role} user`,
    profileComplete: true,
    registrationStage: input.role === UserRole.STUDENT ? 'profile_setup' : 'complete',
    accessGrantedBy: 'admin',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    institutionToken: null,
    institutionId: null,
    institutionVerificationStatus: 'none',
    verificationStatus: input.role === UserRole.STUDENT ? 'verified' : 'not_required',
    adminApprovalStatus: input.role === UserRole.STUDENT ? 'not_required' : 'approved',
    adminApprovedAt: input.role === UserRole.STUDENT ? undefined : new Date(),
  });

  return { user, email };
};

const loginAs = async (email: string) => {
  const response = await request(app).post('/api/auth/login').send({
    email,
    password: PASSWORD,
  });

  return {
    response,
    accessToken: response.body.data?.accessToken as string | undefined,
  };
};

describe('admin user management', () => {
  it('deletes non-admin users and records an audit log', async () => {
    const { email: adminEmail } = await createApprovedUser({
      role: UserRole.ADMIN,
      email: `admin-${randomUUID()}@example.com`,
      displayName: 'Platform Admin',
    });
    const { user: mentorUser, email: mentorEmail } = await createApprovedUser({
      role: UserRole.MENTOR,
      email: `mentor-${randomUUID()}@example.com`,
      displayName: 'Mentor To Delete',
    });
    const adminLogin = await loginAs(adminEmail);

    const response = await request(app)
      .delete(`/api/admin/users/${mentorUser._id.toString()}`)
      .set('Authorization', `Bearer ${adminLogin.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ deleted: true });
    await expect(User.findById(mentorUser._id).lean()).resolves.toBeNull();

    const auditLog = await AdminAuditLog.findOne({
      action: 'USER_DELETED',
      targetId: mentorUser._id,
    }).lean();
    expect(auditLog?.metadata).toMatchObject({
      role: UserRole.MENTOR,
      email: mentorEmail,
      displayName: 'Mentor To Delete',
    });
  });

  it('rejects deleting admin users', async () => {
    const { email: primaryAdminEmail } = await createApprovedUser({
      role: UserRole.ADMIN,
      email: `admin-primary-${randomUUID()}@example.com`,
      displayName: 'Primary Admin',
    });
    const { user: secondaryAdmin } = await createApprovedUser({
      role: UserRole.ADMIN,
      email: `admin-secondary-${randomUUID()}@example.com`,
      displayName: 'Secondary Admin',
    });
    const adminLogin = await loginAs(primaryAdminEmail);

    const response = await request(app)
      .delete(`/api/admin/users/${secondaryAdmin._id.toString()}`)
      .set('Authorization', `Bearer ${adminLogin.accessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ADMIN_USER_DELETE_FORBIDDEN');
    await expect(User.findById(secondaryAdmin._id).lean()).resolves.toEqual(
      expect.objectContaining({ role: UserRole.ADMIN }),
    );
  });
});
