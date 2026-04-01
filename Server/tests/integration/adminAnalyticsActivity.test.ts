import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { User } from '../../src/modules/user/user.model';
import { UserActivity } from '../../src/modules/analytics/userActivity.model';
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

const waitForActivityFlush = async () =>
  new Promise((resolve) => {
    setTimeout(resolve, 50);
  });

describe('admin analytics user activity integration', () => {
  it('captures user activity and exposes searchable analytics by user name', async () => {
    const { email: adminEmail } = await createApprovedUser({
      role: UserRole.ADMIN,
      email: `admin-${randomUUID()}@example.com`,
      displayName: 'Activity Admin',
    });
    const { user: mentorUser, email: mentorEmail } = await createApprovedUser({
      role: UserRole.MENTOR,
      email: `mentor-${randomUUID()}@example.com`,
      displayName: 'Usage Mentor',
    });

    const mentorLogin = await loginAs(mentorEmail);
    expect(mentorLogin.response.status).toBe(200);

    await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${mentorLogin.accessToken}`);
    await waitForActivityFlush();

    await request(app)
      .post('/api/users/me/activity')
      .set('Authorization', `Bearer ${mentorLogin.accessToken}`)
      .send({
        eventType: 'page_view',
        path: '/dashboard/mentor',
      });
    await waitForActivityFlush();

    const trackedEvents = await UserActivity.countDocuments({ userId: mentorUser._id });
    expect(trackedEvents).toBeGreaterThanOrEqual(3);

    const adminLogin = await loginAs(adminEmail);
    expect(adminLogin.response.status).toBe(200);

    const analyticsResponse = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', `Bearer ${adminLogin.accessToken}`);

    expect(analyticsResponse.status).toBe(200);
    expect(analyticsResponse.body.data.usageSummary.pageViewsLast7Days).toBeGreaterThanOrEqual(1);
    expect(analyticsResponse.body.data.mostActiveUsers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayName: 'Usage Mentor',
        }),
      ]),
    );

    const searchResponse = await request(app)
      .get('/api/admin/analytics/users')
      .query({ q: 'Usage Mentor' })
      .set('Authorization', `Bearer ${adminLogin.accessToken}`);

    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayName: 'Usage Mentor',
          userId: mentorUser._id.toString(),
        }),
      ]),
    );

    const detailResponse = await request(app)
      .get(`/api/admin/analytics/users/${mentorUser._id.toString()}`)
      .set('Authorization', `Bearer ${adminLogin.accessToken}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.summary.displayName).toBe('Usage Mentor');
    expect(detailResponse.body.data.recentActivity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'page_view',
          path: '/dashboard/mentor',
        }),
      ]),
    );
    expect(
      detailResponse.body.data.dailyUsage.some(
        (day: { pageViews: number; apiRequests: number }) =>
          day.pageViews > 0 || day.apiRequests > 0,
      ),
    ).toBe(true);
  });
});
