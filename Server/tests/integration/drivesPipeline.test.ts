import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { CampusDrive } from '../../src/modules/recruiter/campusDrive.model';
import { RequestRecord } from '../../src/modules/request/request.model';
import { User } from '../../src/modules/user/user.model';
import { UserRole } from '../../src/types/roles.types';

const makeAccessToken = (user: { _id: { toString(): string }; email: string; role: UserRole; institutionId?: any }) =>
  jwt.sign(
    {
      _id: user._id.toString(),
      email: user.email,
      role: user.role,
      institutionId: user.institutionId ? user.institutionId.toString() : null,
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
    innovationScore: 100,
    profileComplete: true,
    registrationStage: role === UserRole.STUDENT ? 'profile_setup' : 'complete',
    verificationStatus: role === UserRole.STUDENT ? 'verified' : 'not_required',
    adminApprovalStatus: role === UserRole.STUDENT ? 'not_required' : 'approved',
    ...overrides,
  });

describe('College & Student Campus Drives Opportunities Pipeline', () => {
  let college: any;
  let student: any;
  let recruiter: any;
  let drive: any;

  beforeEach(async () => {
    college = await createUser(UserRole.COLLEGE, 'Engineering College', {
      institutionProfile: {
        institutionName: 'Engineering College',
        location: 'Mumbai',
        totalStudentsEnrolled: 500,
        academicYear: '2026-27',
        iicStarRating: 5,
      },
    });

    student = await createUser(UserRole.STUDENT, 'Jane Doe', {
      institutionId: college._id,
      innovationScore: 750,
      discoverableToRecruiters: true,
    });

    recruiter = await createUser(UserRole.RECRUITER, 'Google Recruiter', {
      domain: 'google.com',
    });

    // Setup partnership request to simulate an accepted connection
    await RequestRecord.create({
      type: 'college_recruiter_partnership',
      actionType: 'partner',
      fromUserId: recruiter._id,
      toUserId: college._id,
      targetEntityType: 'college',
      targetEntityId: college._id,
      targetEntityTitle: college.displayName,
      targetRole: UserRole.COLLEGE,
      requestedRole: 'partner',
      status: 'accepted',
      message: 'Partnership request',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    drive = await CampusDrive.create({
      recruiterId: recruiter._id,
      collegeId: college._id,
      title: 'Software Engineer Drive',
      description: 'Full-time role drive at Google.',
      type: 'Placement Drive',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
      minimumInnovationScore: 600,
      isActive: true,
    });
  });

  afterEach(async () => {
    await User.deleteMany({ _id: { $in: [college._id, student._id, recruiter._id] } });
    await CampusDrive.deleteMany({ _id: drive._id });
    await RequestRecord.deleteMany({ targetEntityId: college._id });
  });

  it('allows college to retrieve scheduled drives with recruiter company context', async () => {
    const res = await request(app)
      .get('/api/college/drives')
      .set(authHeader(college))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    
    const matchedDrive = res.body.data.find((d: any) => d._id === drive._id.toString());
    expect(matchedDrive).toBeDefined();
    expect(matchedDrive.title).toBe('Software Engineer Drive');
    expect(matchedDrive.recruiterName).toBe('Google Recruiter');
    expect(matchedDrive.recruiterCompany).toBe('google.com Hiring');
  });

  it('allows students to retrieve active targeted drives', async () => {
    const res = await request(app)
      .get('/api/events/drives')
      .set(authHeader(student))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const matchedDrive = res.body.data.find((d: any) => d._id === drive._id.toString());
    expect(matchedDrive).toBeDefined();
    expect(matchedDrive.recruiterName).toBe('Google Recruiter');
    expect(matchedDrive.recruiterCompany).toBe('google.com Hiring');
  });

  it('allows students to register for campus drives', async () => {
    const res = await request(app)
      .post(`/api/recruiter/drives/${drive._id}/register`)
      .set(authHeader(student))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.registered).toBe(true);

    // Verify registration lists student in roster
    const updatedDrive = await CampusDrive.findById(drive._id).lean();
    expect(updatedDrive?.registeredStudents.length).toBe(1);
    expect(updatedDrive?.registeredStudents[0].studentId.toString()).toBe(student._id.toString());
  });
});

describe('Recruiter-College partnership establishment via hiring event acceptance', () => {
  let college: any;
  let recruiter: any;

  beforeEach(async () => {
    college = await createUser(UserRole.COLLEGE, 'Unlinked College', {
      institutionProfile: {
        institutionName: 'Unlinked College',
        location: 'Pune',
        totalStudentsEnrolled: 300,
        academicYear: '2026-27',
        iicStarRating: 3,
      },
    });

    recruiter = await createUser(UserRole.RECRUITER, 'Unlinked Recruiter', {
      domain: 'unlinked.com',
    });
  });

  afterEach(async () => {
    await User.deleteMany({ _id: { $in: [college._id, recruiter._id] } });
    await RequestRecord.deleteMany({ fromUserId: recruiter._id });
    await CampusDrive.deleteMany({ recruiterId: recruiter._id });
  });

  it('rejects drive creation for a college the recruiter has no accepted partnership with', async () => {
    const res = await request(app)
      .post('/api/recruiter/drives')
      .set(authHeader(recruiter))
      .send({
        title: 'Cold Outreach Drive',
        collegeId: college._id.toString(),
        type: 'Placement Drive',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        description: 'Should be rejected since there is no partnership yet.',
        minimumInnovationScore: 0,
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toEqual(expect.objectContaining({ code: 'COLLEGE_NOT_LINKED' }));
  });

  it('lets a recruiter send a hiring event invite without a prior partnership, and establishes the partnership once the college accepts it', async () => {
    const inviteRes = await request(app)
      .post(`/api/events/hiring-invite/${college._id.toString()}`)
      .set(authHeader(recruiter))
      .send({
        title: 'Unlinked College Hiring Sprint',
        type: 'Placement Drive',
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        description: 'First contact hiring event invite with no existing partnership.',
        minimumInnovationScore: 0,
      });

    expect(inviteRes.status).toBe(201);

    const pendingRequest = await RequestRecord.findOne({
      type: 'college_event_invite',
      fromUserId: recruiter._id,
      targetEntityId: college._id.toString(),
    });
    expect(pendingRequest).not.toBeNull();

    const acceptRes = await request(app)
      .post(`/api/workflow-requests/${pendingRequest!._id}/accept`)
      .set(authHeader(college))
      .send();

    expect(acceptRes.status).toBe(200);

    const partnership = await RequestRecord.findOne({
      type: 'college_recruiter_partnership',
      fromUserId: recruiter._id,
      targetEntityType: 'college',
      targetEntityId: college._id.toString(),
    }).lean();

    expect(partnership).not.toBeNull();
    expect(partnership?.status).toBe('accepted');

    const driveRes = await request(app)
      .post('/api/recruiter/drives')
      .set(authHeader(recruiter))
      .send({
        title: 'Now-Linked Drive',
        collegeId: college._id.toString(),
        type: 'Placement Drive',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        description: 'Should succeed now that the partnership is established.',
        minimumInnovationScore: 0,
      });

    expect(driveRes.status).toBe(201);
  });
});
