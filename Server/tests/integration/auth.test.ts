import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { institutionVerifyQueue } from '../../src/config/bullmq';
import { User } from '../../src/modules/user/user.model';

const buildValidRegisterPayload = (overrides?: Partial<{
  email: string;
  password: string;
  displayName: string;
  role: 'mentor';
  domain: string;
}>) => ({
  email: `mentor-${randomUUID()}@example.com`,
  password: 'Password123!',
  displayName: 'Mentor User',
  role: 'mentor',
  domain: 'Product Strategy',
  ...overrides,
} as const);

const registerAndExtract = async (payload = buildValidRegisterPayload()) => {
  const response = await request(app).post('/api/auth/register').send(payload);
  const cookie = response.headers['set-cookie']?.[0];
  const accessToken = response.body.data.accessToken as string;
  return { response, cookie, accessToken, payload };
};

describe('auth integration', () => {
  describe('POST /api/auth/register', () => {
    it('creates non-student accounts without an access code', async () => {
      const payload = buildValidRegisterPayload();
      const response = await request(app).post('/api/auth/register').send(payload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(response.body.data.user.email).toBe(payload.email);
      expect(response.body.data.user.accessGrantedBy).toBe('self_registered');
      expect(response.body.data.nextStep).toBe('profile_setup');
      expect(response.headers['set-cookie']?.[0]).toContain('refreshToken=');
    });

    it('creates a student without an institution token', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'student-without-token@example.com',
        password: 'Password123!',
        displayName: 'Student User',
        role: 'student',
      });

      expect(response.status).toBe(201);
      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(response.body.data.user.registrationStage).toBe('basic');
      expect(response.body.data.user.institutionVerificationStatus).toBe('none');
      expect(response.body.data.user.profileSlug).toMatch(/^student-user-[a-f0-9]{4}$/);
      expect(response.headers['set-cookie']?.[0]).toContain('refreshToken=');
    });

    it('creates a student with an institution token and returns a pending verification response', async () => {
      const queueSpy = jest.spyOn(institutionVerifyQueue, 'add');

      const response = await request(app).post('/api/auth/register').send({
        email: 'student@example.com',
        password: 'Password123!',
        displayName: 'Student User',
        role: 'student',
        institutionToken: 'SCH-AB12CD34',
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.requiresVerification).toBe(true);
      expect(response.body.data.user.registrationStage).toBe('institution_pending');
      expect(response.body.data.user.institutionVerificationStatus).toBe('pending');
      expect(response.body.data.user.accessGrantedBy).toBe('institution_token');
      expect(response.body.data.user.passwordHash).toBeUndefined();
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(queueSpy).toHaveBeenCalledWith(
        'verify',
        expect.objectContaining({
          userId: response.body.data.user._id,
          token: 'SCH-AB12CD34',
        }),
        expect.any(Object),
      );
    });

    it('creates a roster-linked student without a token and leaves the account pending approval', async () => {
      const schoolRegister = await request(app).post('/api/auth/register').send({
        email: 'school-roster@example.com',
        password: 'Password123!',
        displayName: 'Roster School',
        role: 'school',
        institutionProfile: {
          institutionName: 'Roster School',
          location: 'Hyderabad',
          totalStudentsEnrolled: 850,
          academicYear: '2025-26',
        },
      });

      const schoolToken = schoolRegister.body.data.accessToken as string;

      const rosterResponse = await request(app)
        .post('/api/school/student-roster/manual')
        .set('Authorization', `Bearer ${schoolToken}`)
        .send({
          displayName: 'Roster Student',
          email: 'student.roster@school.test',
          gradeOrProgram: 'Class 12',
          rollNumber: 'SCH-001',
        });

      expect(rosterResponse.status).toBe(201);

      const response = await request(app).post('/api/auth/register').send({
        email: 'student.roster@school.test',
        password: 'Password123!',
        displayName: 'Roster Student',
        role: 'student',
      });

      expect(response.status).toBe(201);
      expect(response.body.data.requiresVerification).toBe(true);
      expect(response.body.data.user.accessGrantedBy).toBe('institution_roster');
      expect(response.body.data.user.institutionVerificationStatus).toBe('verified');
      expect(response.body.data.user.verificationStatus).toBe('pending');
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('rejects duplicate email registrations', async () => {
      const payload = buildValidRegisterPayload();
      await request(app).post('/api/auth/register').send(payload);
      const response = await request(app).post('/api/auth/register').send(payload);

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('DUPLICATE_KEY');
    });

    it('rejects when capacity is reached', async () => {
      const payload = buildValidRegisterPayload();
      const previousMax = env.MAX_USERS_YEAR_ONE;
      env.MAX_USERS_YEAR_ONE = 1;

      await request(app).post('/api/auth/register').send(payload);

      const response = await request(app).post('/api/auth/register').send({
        ...payload,
        email: 'second@example.com',
      });

      env.MAX_USERS_YEAR_ONE = previousMax;

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CAPACITY_REACHED');
    });

    it('rejects invalid role payloads', async () => {
      const payload = buildValidRegisterPayload();
      const response = await request(app).post('/api/auth/register').send({
        ...payload,
        role: 'company',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('stores institution details for school registrations', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'school@example.com',
        password: 'Password123!',
        displayName: 'Innovation Coordinator',
        role: 'school',
        institutionProfile: {
          institutionName: 'Future Ready School',
          location: 'Hyderabad',
          totalStudentsEnrolled: 950,
          academicYear: '2025-26',
        },
      });

      expect(response.status).toBe(201);
      expect(response.body.data.user.institutionProfile.institutionName).toBe('Future Ready School');
      expect(response.body.data.user.profileComplete).toBe(true);
    });

    it('stores institution details for college registrations', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'college@example.com',
        password: 'Password123!',
        displayName: 'Incubation Program Lead',
        role: 'college',
        institutionProfile: {
          institutionName: 'Future Ready College',
          location: 'Bengaluru',
          totalStudentsEnrolled: 1200,
          academicYear: '2025-26',
        },
      });

      expect(response.status).toBe(201);
      expect(response.body.data.user.role).toBe('college');
      expect(response.body.data.user.institutionProfile.institutionName).toBe('Future Ready College');
      expect(response.body.data.user.profileComplete).toBe(true);
    });
  });

  describe('POST /api/auth/submit-institution-token', () => {
    it('submits an institution token after registration and enqueues verification', async () => {
      const queueSpy = jest.spyOn(institutionVerifyQueue, 'add');
      const registerResponse = await request(app).post('/api/auth/register').send({
        email: 'late-token@example.com',
        password: 'Password123!',
        displayName: 'Late Token Student',
        role: 'student',
      });

      const response = await request(app)
        .post('/api/auth/submit-institution-token')
        .set('Authorization', `Bearer ${registerResponse.body.data.accessToken}`)
        .send({ institutionToken: 'COL-XYZ12345' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Token submitted. Verification in progress.');
      expect(queueSpy).toHaveBeenCalledWith(
        'verify',
        expect.objectContaining({
          userId: registerResponse.body.data.user._id,
          token: 'COL-XYZ12345',
        }),
        expect.any(Object),
      );

      const user = await User.findById(registerResponse.body.data.user._id).lean();
      expect(user?.institutionVerificationStatus).toBe('pending');
      expect(user?.registrationStage).toBe('institution_pending');
      expect(user?.institutionToken).toBe('COL-XYZ12345');
    });

    it('rejects token submission when institution is already verified', async () => {
      const registerResponse = await request(app).post('/api/auth/register').send({
        email: 'verified-student@example.com',
        password: 'Password123!',
        displayName: 'Verified Student',
        role: 'student',
      });

      await User.findByIdAndUpdate(registerResponse.body.data.user._id, {
        institutionVerificationStatus: 'verified',
      });

      const response = await request(app)
        .post('/api/auth/submit-institution-token')
        .set('Authorization', `Bearer ${registerResponse.body.data.accessToken}`)
        .send({ institutionToken: 'SCH-READY01' });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('INSTITUTION_ALREADY_VERIFIED');
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in successfully', async () => {
      const payload = buildValidRegisterPayload();
      await request(app).post('/api/auth/register').send(payload);

      const response = await request(app).post('/api/auth/login').send({
        email: payload.email,
        password: payload.password,
        role: payload.role,
      });

      expect(response.status).toBe(200);
      expect(response.body.data.user.role).toBe('mentor');
      expect(response.headers['set-cookie']?.[0]).toContain('refreshToken=');
    });

    it('rejects wrong password', async () => {
      const payload = buildValidRegisterPayload();
      await request(app).post('/api/auth/register').send(payload);

      const response = await request(app).post('/api/auth/login').send({
        email: payload.email,
        password: 'WrongPassword123!',
        role: payload.role,
      });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('blocks student login while institution verification is pending', async () => {
      await request(app).post('/api/auth/register').send({
        email: 'pending-student@example.com',
        password: 'Password123!',
        displayName: 'Pending Student',
        role: 'student',
        institutionToken: 'SCH-PENDING1',
      });

      const response = await request(app).post('/api/auth/login').send({
        email: 'pending-student@example.com',
        password: 'Password123!',
        role: 'student',
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('INSTITUTION_APPROVAL_PENDING');
    });

    it('rejects role mismatch', async () => {
      const payload = buildValidRegisterPayload();
      await request(app).post('/api/auth/register').send(payload);

      const response = await request(app).post('/api/auth/login').send({
        email: payload.email,
        password: payload.password,
        role: 'investor',
      });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('ROLE_MISMATCH');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('rotates the refresh token', async () => {
      const { cookie } = await registerAndExtract();
      const firstRefresh = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
      const secondRefresh = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', firstRefresh.headers['set-cookie'][0]);

      expect(firstRefresh.status).toBe(200);
      expect(firstRefresh.body.data.accessToken).toEqual(expect.any(String));
      expect(secondRefresh.status).toBe(200);
    });

    it('rejects invalid refresh tokens', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects expired refresh tokens', async () => {
      const user = await User.create({
        email: 'expired@example.com',
        passwordHash: 'hashed',
        role: 'student',
        displayName: 'Expired Token',
        accessGrantedBy: 'self_registered',
        accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      const expiredToken = jwt.sign(
        {
          _id: user._id.toString(),
          email: user.email,
          role: user.role,
          tokenId: 'expired-token-id',
          type: 'refresh',
        },
        env.JWT_REFRESH_SECRET,
        { algorithm: 'RS256', expiresIn: '-1s' },
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('logs out successfully', async () => {
      const { cookie, accessToken } = await registerAndExtract();

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['set-cookie']?.[0]).toContain('refreshToken=;');
    });

    it('returns success when already logged out', async () => {
      const { cookie, accessToken } = await registerAndExtract();

      await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .set('Authorization', `Bearer ${accessToken}`);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/users/me', () => {
    it('returns the authenticated user without passwordHash', async () => {
      const { accessToken, payload } = await registerAndExtract();

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.email).toBe(payload.email);
      expect(response.body.data.passwordHash).toBeUndefined();
    });

    it('rejects when no token is provided', async () => {
      const response = await request(app).get('/api/users/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects expired access tokens', async () => {
      const { response: registerResponse } = await registerAndExtract();
      const userId = registerResponse.body.data.user._id as string;

      const expiredAccessToken = jwt.sign(
        {
          _id: userId,
          email: registerResponse.body.data.user.email,
          role: 'student',
          type: 'access',
        },
        env.JWT_ACCESS_SECRET,
        { algorithm: 'RS256', expiresIn: '-1s' },
      );

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${expiredAccessToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('institution student roster', () => {
    it('lets a school add and bulk import student roster entries', async () => {
      const schoolRegister = await request(app).post('/api/auth/register').send({
        email: 'school-import@example.com',
        password: 'Password123!',
        displayName: 'Import School',
        role: 'school',
        institutionProfile: {
          institutionName: 'Import School',
          location: 'Delhi',
          totalStudentsEnrolled: 1100,
          academicYear: '2025-26',
        },
      });

      const schoolToken = schoolRegister.body.data.accessToken as string;

      const manualResponse = await request(app)
        .post('/api/school/student-roster/manual')
        .set('Authorization', `Bearer ${schoolToken}`)
        .send({
          displayName: 'Manual Student',
          email: 'manual@student.test',
          gradeOrProgram: 'Class 11',
          rollNumber: 'M-001',
        });

      expect(manualResponse.status).toBe(201);
      expect(manualResponse.body.data.email).toBe('manual@student.test');

      const csv = [
        'name,email,class,roll number,notes',
        'CSV Student,csv@student.test,Class 10,C-001,Imported via CSV',
        'Second Student,second@student.test,Class 9,C-002,Imported via CSV',
      ].join('\n');

      const importResponse = await request(app)
        .post('/api/school/student-roster/import')
        .set('Authorization', `Bearer ${schoolToken}`)
        .attach('file', Buffer.from(csv), 'students.csv');

      expect(importResponse.status).toBe(200);
      expect(importResponse.body.data.createdCount).toBe(2);
      expect(importResponse.body.data.skippedCount).toBe(0);

      const listResponse = await request(app)
        .get('/api/school/student-roster')
        .set('Authorization', `Bearer ${schoolToken}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ email: 'manual@student.test' }),
          expect.objectContaining({ email: 'csv@student.test' }),
          expect.objectContaining({ email: 'second@student.test' }),
        ]),
      );
    });
  });

  describe('rate limiting', () => {
    it('blocks more than 10 auth attempts within the window', async () => {
      let response;

      for (let attempt = 0; attempt < 11; attempt += 1) {
        response = await request(app)
          .post('/api/auth/login')
          .set('X-Forwarded-For', '203.0.113.10')
          .send({
            email: 'missing@example.com',
            password: 'Password123!',
            role: 'student',
          });
      }

      expect(response?.status).toBe(429);
      expect(response?.body.error.code).toBe('RATE_LIMITED');
    });
  });
});
