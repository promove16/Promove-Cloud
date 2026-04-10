import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { PlacementRecord } from '../../src/modules/college/placementRecord.model';
import { CampusDrive } from '../../src/modules/recruiter/campusDrive.model';
import { JobPost } from '../../src/modules/recruiter/jobPost.model';
import { User } from '../../src/modules/user/user.model';
import { UserRole } from '../../src/types/roles.types';

const makeAccessToken = (user: { _id: { toString(): string }; email: string; role: UserRole }) =>
  jwt.sign(
    {
      _id: user._id.toString(),
      email: user.email,
      role: user.role,
      type: 'access',
    },
    env.JWT_ACCESS_SECRET,
    { algorithm: 'RS256', expiresIn: '15m' },
  );

const authHeader = (user: { _id: { toString(): string }; email: string; role: UserRole }) => ({
  Authorization: `Bearer ${makeAccessToken(user)}`,
});

const createUser = async (role: UserRole, displayName: string, overrides: Partial<Record<string, unknown>> = {}) =>
  User.create({
    email: `${role}-${Math.random().toString(36).slice(2, 10)}@example.com`,
    passwordHash: 'hashed-password',
    role,
    displayName,
    accessGrantedBy: 'self_registered',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    innovationScore: 78,
    profileComplete: true,
    registrationStage: role === UserRole.STUDENT ? 'profile_setup' : 'complete',
    verificationStatus: role === UserRole.STUDENT ? 'verified' : 'not_required',
    adminApprovalStatus: role === UserRole.STUDENT ? 'not_required' : 'approved',
    ...overrides,
  });

describe('college placement data', () => {
  it('scopes placement tracker and recruiter directory data to the logged-in college', async () => {
    const collegeA = await createUser(UserRole.COLLEGE, 'Alpha College', {
      institutionProfile: {
        institutionName: 'Alpha College',
        location: 'Bengaluru, Karnataka',
        totalStudentsEnrolled: 600,
        academicYear: '2025-26',
        iicStarRating: 4,
      },
    });
    const collegeB = await createUser(UserRole.COLLEGE, 'Beta College', {
      institutionProfile: {
        institutionName: 'Beta College',
        location: 'Hyderabad, Telangana',
        totalStudentsEnrolled: 800,
        academicYear: '2025-26',
        iicStarRating: 3,
      },
    });

    const recruiterA = await createUser(UserRole.RECRUITER, 'Alpha Recruiter', {
      domain: 'Software',
    });
    const recruiterB = await createUser(UserRole.RECRUITER, 'Beta Recruiter', {
      domain: 'Manufacturing',
    });

    const studentA = await createUser(UserRole.STUDENT, 'Alpha Student', {
      institutionId: collegeA._id,
      innovationScore: 840,
      discoverableToRecruiters: true,
    });
    const studentB = await createUser(UserRole.STUDENT, 'Beta Student', {
      institutionId: collegeB._id,
      innovationScore: 620,
      discoverableToRecruiters: true,
    });

    await JobPost.create([
      {
        recruiterId: recruiterA._id,
        title: 'Platform Engineer',
        company: 'Alpha Systems',
        description: 'Build platform workflows.',
        domain: 'Software',
        minimumInnovationScore: 70,
        type: 'Full-time',
        location: 'Bengaluru',
        isActive: true,
      },
      {
        recruiterId: recruiterB._id,
        title: 'Operations Analyst',
        company: 'Beta Industries',
        description: 'Improve plant operations.',
        domain: 'Manufacturing',
        minimumInnovationScore: 60,
        type: 'Internship',
        location: 'Hyderabad',
        isActive: true,
      },
    ]);

    await CampusDrive.create([
      {
        recruiterId: recruiterA._id,
        collegeId: collegeA._id,
        title: 'Alpha Campus Drive',
        description: 'Drive for Alpha College students.',
        type: 'Placement Drive',
        scheduledAt: new Date('2026-04-20T00:00:00.000Z'),
        minimumInnovationScore: 65,
        isActive: true,
      },
      {
        recruiterId: recruiterB._id,
        collegeId: collegeB._id,
        title: 'Beta Campus Drive',
        description: 'Drive for Beta College students.',
        type: 'Placement Drive',
        scheduledAt: new Date('2026-04-22T00:00:00.000Z'),
        minimumInnovationScore: 55,
        isActive: true,
      },
    ]);

    await PlacementRecord.create([
      {
        studentId: studentA._id,
        collegeId: collegeA._id,
        recruiterId: recruiterA._id,
        companyName: 'Alpha Systems',
        status: 'Shortlisted',
        innovationScoreAtTime: 840,
      },
      {
        studentId: studentB._id,
        collegeId: collegeB._id,
        recruiterId: recruiterB._id,
        companyName: 'Beta Industries',
        status: 'Hired',
        innovationScoreAtTime: 620,
      },
    ]);

    const placementResponse = await request(app)
      .get('/api/college/placement')
      .set(authHeader(collegeA));

    expect(placementResponse.status).toBe(200);
    expect(placementResponse.body.data.hiringPartners).toEqual([
      expect.objectContaining({
        _id: recruiterA._id.toString(),
        displayName: 'Alpha Recruiter',
        openPositions: 1,
        activeDrives: 1,
      }),
    ]);
    expect(placementResponse.body.data.placementTable).toEqual([
      expect.objectContaining({
        studentId: studentA._id.toString(),
        recruiterId: recruiterA._id.toString(),
        studentName: 'Alpha Student',
      }),
    ]);

    const recruitersResponse = await request(app)
      .get('/api/college/recruiters')
      .set(authHeader(collegeA));

    expect(recruitersResponse.status).toBe(200);
    expect(recruitersResponse.body.data).toEqual([
      expect.objectContaining({
        _id: recruiterA._id.toString(),
        displayName: 'Alpha Recruiter',
        activePositions: 1,
        activeDrives: 1,
      }),
    ]);

    const dashboardResponse = await request(app)
      .get('/api/college/dashboard')
      .set(authHeader(collegeA));

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.body.data.stats.activeHRPartners).toBe(1);
    expect(dashboardResponse.body.data.stats.studentsPlaced).toBe(0);
  });
});
