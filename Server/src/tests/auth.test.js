const request = require('supertest');

jest.mock('../utils/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

const app = require('../app');
const emailService = require('../utils/emailService');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const SchoolProfile = require('../models/SchoolProfile');
const CollegeProfile = require('../models/CollegeProfile');
const InvestorProfile = require('../models/InvestorProfile');
const MentorProfile = require('../models/MentorProfile');
const HrProfile = require('../models/HrProfile');
const RefreshToken = require('../models/RefreshToken');
const ActionToken = require('../models/ActionToken');

async function registerAndVerify(role = 'student', email = `user-${Date.now()}@example.com`) {
  const password = 'StrongPass1!';

  await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: `${role} User`,
      email,
      password,
      role,
    });

  const verificationToken = emailService.sendVerificationEmail.mock.calls.at(-1)[2];

  await request(app)
    .get('/api/v1/auth/verify-email')
    .query({ token: verificationToken });

  return { email, password };
}

beforeEach(async () => {
  emailService.sendVerificationEmail.mockClear();
  emailService.sendPasswordResetEmail.mockClear();
  await Promise.all([
    User.deleteMany({}),
    StudentProfile.deleteMany({}),
    SchoolProfile.deleteMany({}),
    CollegeProfile.deleteMany({}),
    InvestorProfile.deleteMany({}),
    MentorProfile.deleteMany({}),
    HrProfile.deleteMany({}),
    RefreshToken.deleteMany({}),
    ActionToken.deleteMany({}),
  ]);
});

describe('POST /api/v1/auth/register', () => {
  it('returns 201 with success message for role student', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Student User',
        email: 'student@example.com',
        password: 'StrongPass1!',
        role: 'student',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Registration successful. Please verify your email.',
    });
  });

  it('returns 201 for each of the other roles', async () => {
    const roles = ['school', 'college', 'investor', 'mentor', 'hr', 'superadmin'];

    for (const role of roles) {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: `${role} User`,
          email: `${role}@example.com`,
          password: 'StrongPass1!',
          role,
        });

      expect(response.status).toBe(201);
    }
  });

  it('returns 409 when registering the same email twice', async () => {
    const payload = {
      name: 'Repeat User',
      email: 'repeat@example.com',
      password: 'StrongPass1!',
      role: 'student',
    };

    await request(app).post('/api/v1/auth/register').send(payload);
    const response = await request(app).post('/api/v1/auth/register').send(payload);

    expect(response.status).toBe(409);
  });

  it('returns 422 when password has no uppercase', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Weak Password',
        email: 'weak-uppercase@example.com',
        password: 'strongpass1!',
        role: 'student',
      });

    expect(response.status).toBe(422);
  });

  it('returns 422 when password has no special character', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Weak Password',
        email: 'weak-special@example.com',
        password: 'StrongPass12',
        role: 'student',
      });

    expect(response.status).toBe(422);
  });

  it('returns 422 when email is invalid format', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Bad Email',
        email: 'not-an-email',
        password: 'StrongPass1!',
        role: 'student',
      });

    expect(response.status).toBe(422);
  });

  it('returns 422 when role is not valid', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Bad Role',
        email: 'role@example.com',
        password: 'StrongPass1!',
        role: 'invalid',
      });

    expect(response.status).toBe(422);
  });
});

describe('GET /api/v1/auth/verify-email', () => {
  it('returns 400 when token is missing', async () => {
    const response = await request(app).get('/api/v1/auth/verify-email');

    expect(response.status).toBe(400);
  });

  it('returns 400 when token is wrong or expired', async () => {
    const response = await request(app)
      .get('/api/v1/auth/verify-email')
      .query({ token: 'invalid-token' });

    expect(response.status).toBe(400);
  });

  it('returns 200 and marks the user as verified when token is valid', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Verify Me',
        email: 'verify@example.com',
        password: 'StrongPass1!',
        role: 'student',
      });

    const verificationToken = emailService.sendVerificationEmail.mock.calls[0][2];
    const response = await request(app)
      .get('/api/v1/auth/verify-email')
      .query({ token: verificationToken });

    const user = await User.findOne({ email: 'verify@example.com' });

    expect(response.status).toBe(200);
    expect(user.isVerified).toBe(true);
  });
});

describe('POST /api/v1/auth/login', () => {
  it('returns 422 when body is missing', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({});

    expect(response.status).toBe(422);
  });

  it('returns 401 when email is not found', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'missing@example.com',
        password: 'StrongPass1!',
      });

    expect(response.status).toBe(401);
  });

  it('returns 401 when password is wrong', async () => {
    await registerAndVerify('student', 'login-wrong@example.com');

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'login-wrong@example.com',
        password: 'WrongPass1!',
      });

    expect(response.status).toBe(401);
  });

  it('returns 403 when email is not verified', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Unverified User',
        email: 'unverified@example.com',
        password: 'StrongPass1!',
        role: 'student',
      });

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'unverified@example.com',
        password: 'StrongPass1!',
      });

    expect(response.status).toBe(403);
  });

  it('returns 200 with accessToken in body on success', async () => {
    await registerAndVerify('student', 'login-success@example.com');

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'login-success@example.com',
        password: 'StrongPass1!',
      });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBeTruthy();
  });

  it('sets an httpOnly refresh token cookie', async () => {
    await registerAndVerify('student', 'login-cookie@example.com');

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'login-cookie@example.com',
        password: 'StrongPass1!',
      });

    const cookies = response.headers['set-cookie'] || [];

    expect(cookies.some((cookie) => cookie.includes('rft='))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes('HttpOnly'))).toBe(true);
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('returns 401 when no rft cookie is present', async () => {
    const response = await request(app).post('/api/v1/auth/refresh');

    expect(response.status).toBe(401);
  });

  it('returns 401 when cookie value is garbage', async () => {
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', ['rft=garbage']);

    expect(response.status).toBe(401);
  });

  it('returns 200 with a new access token when cookie is valid', async () => {
    await registerAndVerify('student', 'refresh-success@example.com');

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'refresh-success@example.com',
        password: 'StrongPass1!',
      });

    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', loginResponse.headers['set-cookie']);

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBeTruthy();
  });

  it('revokes the old refresh token after use', async () => {
    await registerAndVerify('student', 'refresh-revoke@example.com');

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'refresh-revoke@example.com',
        password: 'StrongPass1!',
      });

    const originalCookie = loginResponse.headers['set-cookie'];
    await request(app).post('/api/v1/auth/refresh').set('Cookie', originalCookie);

    const user = await User.findOne({ email: 'refresh-revoke@example.com' });
    const tokenRecords = await RefreshToken.find({ userId: user._id });
    const revokedToken = tokenRecords.find((token) => token.isRevoked);

    expect(revokedToken).toBeTruthy();
  });

  it('reusing a revoked token returns 401 and revokes the whole family', async () => {
    await registerAndVerify('student', 'refresh-family@example.com');

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'refresh-family@example.com',
        password: 'StrongPass1!',
      });

    const originalCookie = loginResponse.headers['set-cookie'];

    await request(app).post('/api/v1/auth/refresh').set('Cookie', originalCookie);
    const reuseResponse = await request(app).post('/api/v1/auth/refresh').set('Cookie', originalCookie);

    const tokenRecords = await RefreshToken.find({});

    expect(reuseResponse.status).toBe(401);
    expect(tokenRecords.every((token) => token.isRevoked)).toBe(true);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('returns 200 even without a cookie', async () => {
    const response = await request(app).post('/api/v1/auth/logout');

    expect(response.status).toBe(200);
  });

  it('returns 200 when a valid cookie is provided', async () => {
    await registerAndVerify('student', 'logout@example.com');

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'logout@example.com',
        password: 'StrongPass1!',
      });

    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', loginResponse.headers['set-cookie']);

    expect(response.status).toBe(200);
  });

  it('returns 401 when using the same cookie after logout', async () => {
    await registerAndVerify('student', 'logout-reuse@example.com');

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'logout-reuse@example.com',
        password: 'StrongPass1!',
      });

    const cookie = loginResponse.headers['set-cookie'];

    await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    const refreshResponse = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

    expect(refreshResponse.status).toBe(401);
  });
});

describe('POST /api/v1/auth/forgot-password', () => {
  it('returns 200 regardless of whether the email exists', async () => {
    const missingResponse = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'missing@example.com' });

    await registerAndVerify('student', 'forgot@example.com');

    const existingResponse = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'forgot@example.com' });

    expect(missingResponse.status).toBe(200);
    expect(existingResponse.status).toBe(200);
  });
});

describe('POST /api/v1/auth/reset-password', () => {
  it('returns 400 when token is invalid', async () => {
    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: 'invalid-token',
        newPassword: 'NewStrongPass1!',
      });

    expect(response.status).toBe(400);
  });

  it('returns 200 and changes the password when token is valid', async () => {
    await registerAndVerify('student', 'reset@example.com');

    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'reset@example.com' });

    const resetToken = emailService.sendPasswordResetEmail.mock.calls[0][2];

    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: resetToken,
        newPassword: 'NewStrongPass1!',
      });

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'reset@example.com',
        password: 'NewStrongPass1!',
      });

    expect(response.status).toBe(200);
    expect(loginResponse.status).toBe(200);
  });

  it('revokes all existing refresh tokens after reset', async () => {
    await registerAndVerify('student', 'reset-revoke@example.com');

    await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'reset-revoke@example.com',
        password: 'StrongPass1!',
      });

    await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'reset-revoke@example.com',
        password: 'StrongPass1!',
      });

    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'reset-revoke@example.com' });

    const resetToken = emailService.sendPasswordResetEmail.mock.calls[0][2];

    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: resetToken,
        newPassword: 'NewStrongPass1!',
      });

    const tokenRecords = await RefreshToken.find({});

    expect(tokenRecords.length).toBeGreaterThan(0);
    expect(tokenRecords.every((token) => token.isRevoked)).toBe(true);
  });
});
