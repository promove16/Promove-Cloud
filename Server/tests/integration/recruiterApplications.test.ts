import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { PlacementRecord } from '../../src/modules/college/placementRecord.model';
import { RequestRecord } from '../../src/modules/request/request.model';
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

describe('recruiter applications pipeline', () => {
  it('tracks job applicants and syncs recruiter stage updates into the placement flow', async () => {
    const recruiter = await createUser(UserRole.RECRUITER, 'Pipeline Recruiter');
    const college = await createUser(UserRole.COLLEGE, 'Pipeline College', {
      institutionProfile: {
        institutionName: 'Pipeline College',
        location: 'Bengaluru, Karnataka',
        totalStudentsEnrolled: 1200,
        academicYear: '2025-26',
        iicStarRating: 4,
      },
    });
    const student = await createUser(UserRole.STUDENT, 'Applied Student', {
      institutionId: college._id,
      discoverableToRecruiters: true,
      institutionProfile: {
        institutionName: 'Pipeline College',
        location: 'Bengaluru, Karnataka',
        totalStudentsEnrolled: 1200,
        academicYear: '2025-26',
        iicStarRating: 4,
      },
    });

    const createJobResponse = await request(app)
      .post('/api/recruiter/jobs')
      .set(authHeader(recruiter))
      .send({
        title: 'Graduate Software Engineer',
        company: 'ProMove Labs',
        description: 'Build product features and collaborate with the hiring team on delivery.',
        domain: 'Software Engineering',
        minimumInnovationScore: 60,
        type: 'Full-time',
        location: 'Bengaluru',
      });

    expect(createJobResponse.status).toBe(201);
    const jobId = createJobResponse.body.data._id as string;

    const applyResponse = await request(app)
      .post(`/api/recruiter/jobs/${jobId}/apply`)
      .set(authHeader(student));

    expect(applyResponse.status).toBe(200);
    expect(applyResponse.body.data).toEqual({
      applied: true,
      alreadyApplied: false,
    });

    const initialPipelineResponse = await request(app)
      .get(`/api/recruiter/jobs/${jobId}/applications`)
      .set(authHeader(recruiter));

    expect(initialPipelineResponse.status).toBe(200);
    expect(initialPipelineResponse.body.data.job.applicantIds).toEqual([student._id.toString()]);
    expect(initialPipelineResponse.body.data.applications).toEqual([
      expect.objectContaining({
        _id: student._id.toString(),
        displayName: 'Applied Student',
        stage: 'Applied',
      }),
    ]);

    const interviewUpdateResponse = await request(app)
      .patch(`/api/recruiter/jobs/${jobId}/applications/${student._id}`)
      .set(authHeader(recruiter))
      .send({
        stage: 'Interview',
      });

    expect(interviewUpdateResponse.status).toBe(200);
    expect(interviewUpdateResponse.body.data.stage).toBe('Interview');

    const inProgressPlacement = await PlacementRecord.findOne({
      recruiterId: recruiter._id,
      studentId: student._id,
      collegeId: college._id,
    }).lean();

    expect(inProgressPlacement?.status).toBe('In Progress');
    expect(inProgressPlacement?.companyName).toBe('ProMove Labs');

    const hiredUpdateResponse = await request(app)
      .patch(`/api/recruiter/jobs/${jobId}/applications/${student._id}`)
      .set(authHeader(recruiter))
      .send({
        stage: 'Hired',
      });

    expect(hiredUpdateResponse.status).toBe(200);
    expect(hiredUpdateResponse.body.data.stage).toBe('Hired');

    const finalPlacement = await PlacementRecord.findOne({
      recruiterId: recruiter._id,
      studentId: student._id,
      collegeId: college._id,
    }).lean();

    expect(finalPlacement?.status).toBe('Hired');

    const finalPipelineResponse = await request(app)
      .get(`/api/recruiter/jobs/${jobId}/applications`)
      .set(authHeader(recruiter));

    expect(finalPipelineResponse.status).toBe(200);
    expect(finalPipelineResponse.body.data.job.shortlistedIds).toEqual([student._id.toString()]);
    expect(finalPipelineResponse.body.data.applications).toEqual([
      expect.objectContaining({
        _id: student._id.toString(),
        stage: 'Hired',
      }),
    ]);
  });

  it('lets recruiters invite a marketplace student into a job and exposes it on the student applications page', async () => {
    const recruiter = await createUser(UserRole.RECRUITER, 'Invite Recruiter');
    const college = await createUser(UserRole.COLLEGE, 'Invite College', {
      institutionProfile: {
        institutionName: 'Invite College',
        location: 'Hyderabad, Telangana',
        totalStudentsEnrolled: 900,
        academicYear: '2025-26',
        iicStarRating: 4,
      },
    });
    const student = await createUser(UserRole.STUDENT, 'Invited Student', {
      institutionId: college._id,
      discoverableToRecruiters: true,
      institutionProfile: {
        institutionName: 'Invite College',
        location: 'Hyderabad, Telangana',
        totalStudentsEnrolled: 900,
        academicYear: '2025-26',
        iicStarRating: 4,
      },
    });

    const createJobResponse = await request(app)
      .post('/api/recruiter/jobs')
      .set(authHeader(recruiter))
      .send({
        title: 'Product Analyst',
        company: 'ProMove Hiring',
        description: 'Join the analyst pod and move recruiter workflows into production.',
        domain: 'Product',
        minimumInnovationScore: 50,
        type: 'Internship',
        location: 'Remote',
      });

    expect(createJobResponse.status).toBe(201);
    const jobId = createJobResponse.body.data._id as string;

    const inviteResponse = await request(app)
      .post(`/api/recruiter/jobs/${jobId}/invite/${student._id}`)
      .set(authHeader(recruiter))
      .send({
        note: 'Your agri-tech project is a strong fit for this role.',
      });

    expect(inviteResponse.status).toBe(200);
    expect(inviteResponse.body.data).toEqual({
      invited: true,
      alreadyApplied: false,
      alreadyInvited: false,
    });

    const recruiterPipelineResponse = await request(app)
      .get(`/api/recruiter/jobs/${jobId}/applications`)
      .set(authHeader(recruiter));

    expect(recruiterPipelineResponse.status).toBe(200);
    expect(recruiterPipelineResponse.body.data.job.applicantIds).toEqual([]);
    expect(recruiterPipelineResponse.body.data.applications).toEqual([
      expect.objectContaining({
        _id: student._id.toString(),
        stage: 'Invited Pending',
        source: 'recruiter_invite',
        note: 'Your agri-tech project is a strong fit for this role.',
      }),
    ]);

    const workflowRequest = await RequestRecord.findOne({
      type: 'recruiter_job_invite',
      toUserId: student._id,
      targetEntityType: 'recruiter_job',
      targetEntityId: jobId,
      status: 'pending',
    }).lean();

    expect(workflowRequest).toEqual(
      expect.objectContaining({
        actionType: 'hire',
        targetEntityTitle: 'Product Analyst',
        requestedPermission: 'job_application',
      }),
    );

    const acceptInviteResponse = await request(app)
      .post(`/api/workflow-requests/${workflowRequest!._id.toString()}/accept`)
      .set(authHeader(student))
      .send();

    expect(acceptInviteResponse.status).toBe(200);
    expect(acceptInviteResponse.body.data).toEqual(
      expect.objectContaining({
        status: 'accepted',
        acceptRedirect: '/dashboard/student/applications',
      }),
    );

    const studentApplicationsResponse = await request(app)
      .get('/api/recruiter/applications/me')
      .set(authHeader(student));

    expect(studentApplicationsResponse.status).toBe(200);
    expect(studentApplicationsResponse.body.data).toEqual([
      expect.objectContaining({
        stage: 'Invite Accepted',
        source: 'recruiter_invite',
        note: 'Your agri-tech project is a strong fit for this role.',
        recruiter: expect.objectContaining({
          _id: recruiter._id.toString(),
          displayName: 'Invite Recruiter',
        }),
        job: expect.objectContaining({
          _id: jobId,
          title: 'Product Analyst',
          applicationSource: 'recruiter_invite',
          applicationStage: 'Invite Accepted',
          hasApplied: true,
        }),
      }),
    ]);
  });
});
