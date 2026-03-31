import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
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
    registrationStage: 'profile_setup',
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

  return response.body.data?.accessToken as string;
};

describe('report integration', () => {
  it('creates a report for another user', async () => {
    const { email: reporterEmail } = await createApprovedUser({
      role: UserRole.STUDENT,
      displayName: 'Reporter',
    });
    const { user: reportedUser } = await createApprovedUser({
      role: UserRole.MENTOR,
      displayName: 'Reported',
    });
    const accessToken = await loginAs(reporterEmail);

    const response = await request(app)
      .post('/api/report')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        reportedUserId: reportedUser._id.toString(),
        reason: 'harassment',
        description: '  Repeated threats in direct messages.  ',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.reason).toBe('harassment');
    expect(response.body.data.description).toBe('Repeated threats in direct messages.');
  });

  it('rejects invalid report reasons', async () => {
    const { email: reporterEmail } = await createApprovedUser({
      role: UserRole.STUDENT,
      displayName: 'Reporter',
    });
    const { user: reportedUser } = await createApprovedUser({
      role: UserRole.MENTOR,
      displayName: 'Reported',
    });
    const accessToken = await loginAs(reporterEmail);

    const response = await request(app)
      .post('/api/report')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        reportedUserId: reportedUser._id.toString(),
        reason: 'not_a_real_reason',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_REASON');
  });

  it('rejects reports for missing users', async () => {
    const { email: reporterEmail } = await createApprovedUser({
      role: UserRole.STUDENT,
      displayName: 'Reporter',
    });
    const accessToken = await loginAs(reporterEmail);

    const response = await request(app)
      .post('/api/report')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        reportedUserId: '507f1f77bcf86cd799439011',
        reason: 'spam',
      });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('USER_NOT_FOUND');
  });
});
