import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { Settings } from '../../src/modules/settings/settings.model';
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
    registrationStage:
      input.role === UserRole.SCHOOL || input.role === UserRole.COLLEGE ? 'complete' : 'profile_setup',
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

describe('settings integration', () => {
  it('creates a default settings document on first fetch', async () => {
    const { user, email } = await createApprovedUser({
      role: UserRole.STUDENT,
      email: `student-${randomUUID()}@example.com`,
    });
    const accessToken = await loginAs(email);

    const response = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.userId).toBe(user._id.toString());
    expect(response.body.data.timezone).toBe('UTC');
    expect(response.body.data.language).toBe('en');
    expect(response.body.data.notifications.email.messages).toBe(true);
    expect(response.body.data.privacy.profileVisibility).toBe('public');
    expect(response.body.data.appearance.theme).toBe('dark');
  });

  it('stores only student role settings and syncs recruiter discoverability', async () => {
    const { user, email } = await createApprovedUser({
      role: UserRole.STUDENT,
      email: `student-role-${randomUUID()}@example.com`,
    });
    const accessToken = await loginAs(email);

    const response = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        roleSettings: {
          jobSeeking: true,
          openToMentorship: true,
          innovationVisibility: 'private',
          minInvestmentSize: 1000,
          activelyHiring: true,
          publicProfile: false,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.data.roleSettings.jobSeeking).toBe(true);
    expect(response.body.data.roleSettings.openToMentorship).toBe(true);
    expect(response.body.data.roleSettings.innovationVisibility).toBe('private');
    expect(response.body.data.roleSettings.minInvestmentSize).toBeUndefined();
    expect(response.body.data.roleSettings.activelyHiring).toBeUndefined();
    expect(response.body.data.roleSettings.publicProfile).toBeUndefined();

    const storedUser = await User.findById(user._id).lean();
    const storedSettings = await Settings.findOne({ userId: user._id }).lean();

    expect(storedUser?.discoverableToRecruiters).toBe(true);
    expect(storedSettings?.roleSettings).toMatchObject({
      jobSeeking: true,
      openToMentorship: true,
      innovationVisibility: 'private',
    });
    expect(storedSettings?.roleSettings?.minInvestmentSize).toBeUndefined();
  });

  it('stores only institution role settings and syncs profile visibility', async () => {
    const { user, email } = await createApprovedUser({
      role: UserRole.SCHOOL,
      email: `school-${randomUUID()}@example.com`,
    });
    const accessToken = await loginAs(email);

    const response = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        roleSettings: {
          publicProfile: false,
          allowStudentApplications: true,
          jobSeeking: true,
          preferredRoles: ['Designer'],
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.data.roleSettings.publicProfile).toBe(false);
    expect(response.body.data.roleSettings.allowStudentApplications).toBe(true);
    expect(response.body.data.roleSettings.jobSeeking).toBeUndefined();
    expect(response.body.data.roleSettings.preferredRoles).toBeUndefined();

    const storedUser = await User.findById(user._id).lean();
    expect(storedUser?.isProfilePublic).toBe(false);
  });

  it('syncs account profile visibility from privacy settings', async () => {
    const { user, email } = await createApprovedUser({
      role: UserRole.STUDENT,
      email: `student-privacy-${randomUUID()}@example.com`,
    });
    const accessToken = await loginAs(email);

    const response = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        privacy: {
          profileVisibility: 'private',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.data.privacy.profileVisibility).toBe('private');

    const storedUser = await User.findById(user._id).lean();
    expect(storedUser?.isProfilePublic).toBe(false);
  });

  it('blocks first-contact DMs when the recipient disables incoming messages', async () => {
    const { email: studentEmail } = await createApprovedUser({
      role: UserRole.STUDENT,
      email: `dm-sender-${randomUUID()}@example.com`,
    });
    const { user: mentor, email: mentorEmail } = await createApprovedUser({
      role: UserRole.MENTOR,
      email: `dm-recipient-${randomUUID()}@example.com`,
    });
    const [studentToken, mentorToken] = await Promise.all([loginAs(studentEmail), loginAs(mentorEmail)]);

    const savePrivacy = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({
        privacy: {
          allowDMs: 'none',
        },
      });

    expect(savePrivacy.status).toBe(200);

    const dmResponse = await request(app)
      .post(`/api/dm/${mentor._id.toString()}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        message: 'I would like to discuss my project.',
        queryType: 'general',
      });

    expect(dmResponse.status).toBe(403);
    expect(dmResponse.body.error.code).toBe('DM_PERMISSION_DENIED');
  });

  it('rejects invalid investor ranges', async () => {
    const { email } = await createApprovedUser({
      role: UserRole.INVESTOR,
      email: `investor-${randomUUID()}@example.com`,
    });
    const accessToken = await loginAs(email);

    const response = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        roleSettings: {
          minInvestmentSize: 500000,
          maxInvestmentSize: 100000,
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Minimum investment size cannot exceed maximum');
  });
});
