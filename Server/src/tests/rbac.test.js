const request = require('supertest');

jest.mock('../utils/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

const app = require('../app');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const SchoolProfile = require('../models/SchoolProfile');
const CollegeProfile = require('../models/CollegeProfile');
const InvestorProfile = require('../models/InvestorProfile');
const MentorProfile = require('../models/MentorProfile');
const HrProfile = require('../models/HrProfile');
const RefreshToken = require('../models/RefreshToken');
const ActionToken = require('../models/ActionToken');

async function registerAndLogin(role, email = `${role}-${Date.now()}@example.com`) {
  const password = 'StrongPass1!';

  await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: `${role} User`,
      email,
      password,
      role,
    });

  await User.updateOne({ email }, { isVerified: true });

  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  return {
    accessToken: loginResponse.body.accessToken,
    cookie: loginResponse.headers['set-cookie'],
  };
}

beforeEach(async () => {
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

describe('RBAC role middleware', () => {
  it('returns 401 when no token is provided', async () => {
    const response = await request(app).get('/api/v1/test/student-only');

    expect(response.status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    const response = await request(app)
      .get('/api/v1/test/student-only')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
  });

  it('returns 403 for school role on student-only route', async () => {
    const { accessToken } = await registerAndLogin('school');

    const response = await request(app)
      .get('/api/v1/test/student-only')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
  });

  it('returns 200 for student role on student-only route', async () => {
    const { accessToken } = await registerAndLogin('student');

    const response = await request(app)
      .get('/api/v1/test/student-only')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
  });

  it('returns 200 for superadmin role on student-only route', async () => {
    const { accessToken } = await registerAndLogin('superadmin');

    const response = await request(app)
      .get('/api/v1/test/student-only')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
  });
});

describe('RBAC permission middleware', () => {
  it('returns 200 for student on project:create', async () => {
    const { accessToken } = await registerAndLogin('student');

    const response = await request(app)
      .get('/api/v1/test/project-create')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
  });

  it('returns 403 for hr on project:create', async () => {
    const { accessToken } = await registerAndLogin('hr');

    const response = await request(app)
      .get('/api/v1/test/project-create')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
  });

  it('returns 200 for superadmin on project:create', async () => {
    const { accessToken } = await registerAndLogin('superadmin');

    const response = await request(app)
      .get('/api/v1/test/project-create')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
  });
});
