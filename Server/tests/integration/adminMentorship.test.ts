import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { InstitutionMentorshipProgram } from '../../src/modules/mentor/mentorshipProgram.model';
import { RequestRecord } from '../../src/modules/request/request.model';
import { Startup } from '../../src/modules/startup/startup.model';
import { User } from '../../src/modules/user/user.model';
import { Workspace } from '../../src/modules/workspace/workspace.model';
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

  return response.body.data?.accessToken as string;
};

describe('admin mentorship integration', () => {
  it('lets student workspace owners invite project mentors directly and exposes assigned projects to mentors', async () => {
    const { user: mentorUser, email: mentorEmail } = await createApprovedUser({
      role: UserRole.MENTOR,
      displayName: 'Assigned Mentor',
    });
    const { user: studentUser, email: studentEmail } = await createApprovedUser({
      role: UserRole.STUDENT,
      displayName: 'Student Builder',
    });

    const workspace = await Workspace.create({
      ownerId: studentUser._id,
      teamMemberIds: [],
      title: 'Smart Mobility Workspace',
      category: 'Mobility Tech',
      stage: 'Build',
      progressPercent: 62,
    });

    await Startup.create({
      founderIds: [studentUser._id],
      projectId: workspace._id,
      name: 'MoveSense',
      tagline: 'Better mobility analytics',
      category: 'Mobility Tech',
      stage: 'MVP',
      launchedToMentors: true,
      launchedAt: new Date(),
      innovationScoreAtLaunch: 118,
      isActive: true,
    });

    const studentAccessToken = await loginAs(studentEmail);
    const mentorAccessToken = await loginAs(mentorEmail);

    const studentAssignAttempt = await request(app)
      .post(`/api/workspace/${workspace._id.toString()}/chat-participants`)
      .set('Authorization', `Bearer ${studentAccessToken}`)
      .send({
        userId: mentorUser._id.toString(),
        role: 'mentor',
      });

    expect(studentAssignAttempt.status).toBe(201);

    const mentorRequest = await RequestRecord.findOne({
      type: 'workspace_chat_access',
      targetEntityType: 'workspace',
      targetEntityId: workspace._id.toString(),
      toUserId: mentorUser._id,
      requestedRole: 'mentor',
      status: 'pending',
    }).lean();

    expect(mentorRequest?._id).toBeDefined();

    const mentorAcceptResponse = await request(app)
      .post(`/api/requests/${mentorRequest!._id.toString()}/accept`)
      .set('Authorization', `Bearer ${mentorAccessToken}`);

    expect(mentorAcceptResponse.status).toBe(200);

    const updatedWorkspace = await Workspace.findById(workspace._id).lean();
    expect(updatedWorkspace?.chatParticipants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: mentorUser._id,
          role: 'mentor',
        }),
      ]),
    );

    const mentorStudentsResponse = await request(app)
      .get('/api/mentor/students')
      .set('Authorization', `Bearer ${mentorAccessToken}`);

    expect(mentorStudentsResponse.status).toBe(200);
    expect(mentorStudentsResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workspaceId: workspace._id.toString(),
          studentId: studentUser._id.toString(),
          startupName: 'MoveSense',
        }),
      ]),
    );

    const mentorDashboardResponse = await request(app)
      .get('/api/mentor/dashboard')
      .set('Authorization', `Bearer ${mentorAccessToken}`);

    expect(mentorDashboardResponse.status).toBe(200);
    expect(mentorDashboardResponse.body.data.assignedProjectsCount).toBe(1);
    expect(mentorDashboardResponse.body.data.activeStudentCount).toBe(1);
  });

  it('removes admin project mentorship access endpoints', async () => {
    const { email: adminEmail } = await createApprovedUser({
      role: UserRole.ADMIN,
      displayName: 'Mentorship Admin',
    });
    const { user: studentUser } = await createApprovedUser({
      role: UserRole.STUDENT,
      displayName: 'Student Builder',
    });
    const { user: mentorUser } = await createApprovedUser({
      role: UserRole.MENTOR,
      displayName: 'Unavailable Admin Route Mentor',
    });

    const workspace = await Workspace.create({
      ownerId: studentUser._id,
      teamMemberIds: [],
      title: 'Legacy Workspace',
      category: 'DeepTech',
      stage: 'Build',
      progressPercent: 48,
      isActive: true,
    });

    const adminAccessToken = await loginAs(adminEmail);
    const listResponse = await request(app)
      .get('/api/admin/project-mentorships')
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(listResponse.status).toBe(404);

    const patchResponse = await request(app)
      .patch(`/api/admin/project-mentorships/${workspace._id.toString()}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        decision: 'assigned',
        mentorId: mentorUser._id.toString(),
      });

    expect(patchResponse.status).toBe(404);
  });

  it('only allows admin-approved mentors to be assigned to institution mentorship requests', async () => {
    const { email: adminEmail } = await createApprovedUser({
      role: UserRole.ADMIN,
      displayName: 'Institution Mentorship Admin',
    });
    const { user: schoolUser, email: schoolEmail } = await createApprovedUser({
      role: UserRole.SCHOOL,
      displayName: 'Promove School',
    });
    const { user: approvedMentorUser, email: approvedMentorEmail } = await createApprovedUser({
      role: UserRole.MENTOR,
      displayName: 'Approved Mentor',
    });
    const { user: pendingMentorUser, email: pendingMentorEmail } = await createApprovedUser({
      role: UserRole.MENTOR,
      displayName: 'Pending Mentor',
    });

    await User.updateOne(
      { _id: pendingMentorUser._id },
      {
        $set: {
          adminApprovalStatus: 'pending',
          adminApprovedAt: null,
          adminApprovedBy: null,
        },
      },
    );

    const schoolAccessToken = await loginAs(schoolEmail);
    const adminAccessToken = await loginAs(adminEmail);
    const approvedMentorAccessToken = await loginAs(approvedMentorEmail);
    await loginAs(pendingMentorEmail);

    const createProgramResponse = await request(app)
      .post('/api/school/mentorship-programs')
      .set('Authorization', `Bearer ${schoolAccessToken}`)
      .send({
        title: 'Future Founders Mentorship Day',
        objective: 'Connect students with startup mentors for idea validation and market readiness.',
        preferredDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        durationMinutes: 90,
        expectedParticipants: 120,
        deliveryMode: 'Online',
        platform: 'Google Meet',
        meetingLink: 'https://meet.google.com/future-founders',
        preferredExpertise: 'Early stage product strategy',
      });

    expect(createProgramResponse.status).toBe(201);
    expect(createProgramResponse.body.data.status).toBe('Pending');

    const programId = createProgramResponse.body.data._id as string;

    const pendingAssignmentAttempt = await request(app)
      .patch(`/api/admin/mentorship-programs/${programId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        decision: 'assigned',
        mentorId: pendingMentorUser._id.toString(),
        scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        deliveryMode: 'Online',
        platform: 'Google Meet',
        meetingLink: 'https://meet.google.com/admin-review',
      });

    expect(pendingAssignmentAttempt.status).toBe(404);
    expect(pendingAssignmentAttempt.body.error.code).toBe('MENTOR_NOT_FOUND');

    const approvedAssignmentResponse = await request(app)
      .patch(`/api/admin/mentorship-programs/${programId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        decision: 'assigned',
        mentorId: approvedMentorUser._id.toString(),
        scheduledAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
        deliveryMode: 'Online',
        platform: 'Google Meet',
        meetingLink: 'https://meet.google.com/assigned-mentor',
        adminNotes: 'Confirmed with the school operations team.',
      });

    expect(approvedAssignmentResponse.status).toBe(200);
    expect(approvedAssignmentResponse.body.data).toEqual(
      expect.objectContaining({
        _id: programId,
        status: 'Assigned',
        mentor: expect.objectContaining({
          _id: approvedMentorUser._id.toString(),
          displayName: 'Approved Mentor',
        }),
        institution: expect.objectContaining({
          _id: schoolUser._id.toString(),
          type: 'school',
        }),
      }),
    );

    const storedProgram = await InstitutionMentorshipProgram.findById(programId).lean();
    expect(storedProgram).toEqual(
      expect.objectContaining({
        mentorId: approvedMentorUser._id,
        status: 'Assigned',
      }),
    );

    const approvedMentorDashboardResponse = await request(app)
      .get('/api/mentor/dashboard')
      .set('Authorization', `Bearer ${approvedMentorAccessToken}`);

    expect(approvedMentorDashboardResponse.status).toBe(200);
    expect(approvedMentorDashboardResponse.body.data.assignedProgramsCount).toBe(1);
    expect(approvedMentorDashboardResponse.body.data.institutionPrograms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: programId,
          title: 'Future Founders Mentorship Day',
          institution: expect.objectContaining({
            _id: schoolUser._id.toString(),
            type: 'school',
          }),
        }),
      ]),
    );
  });

  it('allows admins to create a mentorship program for a college and assign an available mentor immediately', async () => {
    const { email: adminEmail } = await createApprovedUser({
      role: UserRole.ADMIN,
      displayName: 'Programme Admin',
    });
    const { user: collegeUser } = await createApprovedUser({
      role: UserRole.COLLEGE,
      displayName: 'Promove College',
    });
    const { user: mentorUser, email: mentorEmail } = await createApprovedUser({
      role: UserRole.MENTOR,
      displayName: 'Operations Mentor',
    });

    const adminAccessToken = await loginAs(adminEmail);
    const mentorAccessToken = await loginAs(mentorEmail);

    const preferredDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const scheduledAt = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();

    const createProgramResponse = await request(app)
      .post('/api/admin/mentorship-programs')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        institutionId: collegeUser._id.toString(),
        mentorId: mentorUser._id.toString(),
        title: 'Campus Startup Sprint',
        objective: 'Guide college teams through problem validation, mentor feedback, and investor readiness.',
        preferredDate,
        scheduledAt,
        durationMinutes: 120,
        expectedParticipants: 80,
        deliveryMode: 'Online',
        platform: 'Google Meet',
        meetingLink: 'https://meet.google.com/campus-startup-sprint',
        preferredExpertise: 'Startup validation',
        adminNotes: 'Created directly by admin for campus innovation week.',
      });

    expect(createProgramResponse.status).toBe(201);
    expect(createProgramResponse.body.data).toEqual(
      expect.objectContaining({
        status: 'Assigned',
        title: 'Campus Startup Sprint',
        institution: expect.objectContaining({
          _id: collegeUser._id.toString(),
          type: 'college',
        }),
        mentor: expect.objectContaining({
          _id: mentorUser._id.toString(),
          displayName: 'Operations Mentor',
        }),
      }),
    );

    const programId = createProgramResponse.body.data._id as string;
    const storedProgram = await InstitutionMentorshipProgram.findById(programId).lean();
    expect(storedProgram).toEqual(
      expect.objectContaining({
        institutionId: collegeUser._id,
        mentorId: mentorUser._id,
        status: 'Assigned',
      }),
    );

    const mentorDashboardResponse = await request(app)
      .get('/api/mentor/dashboard')
      .set('Authorization', `Bearer ${mentorAccessToken}`);

    expect(mentorDashboardResponse.status).toBe(200);
    expect(mentorDashboardResponse.body.data.assignedProgramsCount).toBe(1);
    expect(mentorDashboardResponse.body.data.institutionPrograms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: programId,
          title: 'Campus Startup Sprint',
          institution: expect.objectContaining({
            _id: collegeUser._id.toString(),
            type: 'college',
          }),
        }),
      ]),
    );
  });

  it('rejects overlapping institution mentorship assignments for the same mentor', async () => {
    const { email: adminEmail } = await createApprovedUser({
      role: UserRole.ADMIN,
      displayName: 'Conflict Admin',
    });
    const { user: schoolOne, email: schoolOneEmail } = await createApprovedUser({
      role: UserRole.SCHOOL,
      displayName: 'School One',
    });
    const { user: schoolTwo, email: schoolTwoEmail } = await createApprovedUser({
      role: UserRole.SCHOOL,
      displayName: 'School Two',
    });
    const { user: mentorUser } = await createApprovedUser({
      role: UserRole.MENTOR,
      displayName: 'Booked Mentor',
    });

    const adminAccessToken = await loginAs(adminEmail);
    const schoolOneAccessToken = await loginAs(schoolOneEmail);
    const schoolTwoAccessToken = await loginAs(schoolTwoEmail);

    const firstRequest = await request(app)
      .post('/api/school/mentorship-programs')
      .set('Authorization', `Bearer ${schoolOneAccessToken}`)
      .send({
        title: 'School One Innovation Day',
        objective: 'A mentoring day for startup idea validation and pitch readiness.',
        preferredDate: new Date('2026-04-15T10:00:00.000Z').toISOString(),
        durationMinutes: 90,
        expectedParticipants: 80,
        deliveryMode: 'Online',
        platform: 'Google Meet',
      });

    expect(firstRequest.status).toBe(201);

    const firstAssignment = await request(app)
      .patch(`/api/admin/mentorship-programs/${firstRequest.body.data._id as string}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        decision: 'assigned',
        mentorId: mentorUser._id.toString(),
        scheduledAt: new Date('2026-04-16T10:00:00.000Z').toISOString(),
        deliveryMode: 'Online',
        platform: 'Google Meet',
        meetingLink: 'https://meet.google.com/school-one',
      });

    expect(firstAssignment.status).toBe(200);

    const secondRequest = await request(app)
      .post('/api/school/mentorship-programs')
      .set('Authorization', `Bearer ${schoolTwoAccessToken}`)
      .send({
        title: 'School Two Innovation Day',
        objective: 'A follow-up mentoring day for prototype validation and roadmap planning.',
        preferredDate: new Date('2026-04-15T11:00:00.000Z').toISOString(),
        durationMinutes: 60,
        expectedParticipants: 60,
        deliveryMode: 'Online',
        platform: 'Google Meet',
      });

    expect(secondRequest.status).toBe(201);

    const conflictingAssignment = await request(app)
      .patch(`/api/admin/mentorship-programs/${secondRequest.body.data._id as string}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        decision: 'assigned',
        mentorId: mentorUser._id.toString(),
        scheduledAt: new Date('2026-04-16T10:30:00.000Z').toISOString(),
        deliveryMode: 'Online',
        platform: 'Google Meet',
        meetingLink: 'https://meet.google.com/school-two',
      });

    expect(conflictingAssignment.status).toBe(409);
    expect(conflictingAssignment.body.error.code).toBe('MENTOR_SCHEDULE_CONFLICT');

    const secondProgram = await InstitutionMentorshipProgram.findById(secondRequest.body.data._id).lean();
    expect(secondProgram?.status).toBe('Pending');
    expect(secondProgram?.mentorId).toBeUndefined();

    expect(conflictingAssignment.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'mentorId',
        }),
      ]),
    );
  });

  it('blocks mentor sessions that overlap with an assigned institution mentorship program', async () => {
    const { email: adminEmail } = await createApprovedUser({
      role: UserRole.ADMIN,
      displayName: 'Scheduling Admin',
    });
    const { user: schoolUser } = await createApprovedUser({
      role: UserRole.SCHOOL,
      displayName: 'Scheduled School',
    });
    const { user: mentorUser, email: mentorEmail } = await createApprovedUser({
      role: UserRole.MENTOR,
      displayName: 'Session Mentor',
    });
    const { user: studentUser } = await createApprovedUser({
      role: UserRole.STUDENT,
      displayName: 'Session Student',
    });

    const workspace = await Workspace.create({
      ownerId: studentUser._id,
      teamMemberIds: [],
      title: 'Mentored Workspace',
      category: 'EdTech',
      stage: 'Build',
      progressPercent: 40,
      chatParticipants: [
        {
          userId: mentorUser._id,
          role: 'mentor',
          addedBy: studentUser._id,
          addedAt: new Date(),
        },
      ],
    });

    const adminAccessToken = await loginAs(adminEmail);
    const mentorAccessToken = await loginAs(mentorEmail);

    const createProgramResponse = await request(app)
      .post('/api/admin/mentorship-programs')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        institutionId: schoolUser._id.toString(),
        mentorId: mentorUser._id.toString(),
        title: 'Institution Booking',
        objective: 'A scheduled institution mentorship booking.',
        preferredDate: new Date('2026-04-20T09:00:00.000Z').toISOString(),
        scheduledAt: new Date('2026-04-20T10:00:00.000Z').toISOString(),
        durationMinutes: 120,
        expectedParticipants: 100,
        deliveryMode: 'Online',
        platform: 'Google Meet',
        meetingLink: 'https://meet.google.com/institution-booking',
      });

    expect(createProgramResponse.status).toBe(201);

    const createSessionResponse = await request(app)
      .post('/api/mentor/sessions')
      .set('Authorization', `Bearer ${mentorAccessToken}`)
      .send({
        studentId: studentUser._id.toString(),
        workspaceId: workspace._id.toString(),
        title: 'Overlapping Student Session',
        scheduledAt: new Date('2026-04-20T10:30:00.000Z').toISOString(),
        durationMinutes: 45,
        meetLink: 'https://meet.google.com/student-session',
      });

    expect(createSessionResponse.status).toBe(409);
    expect(createSessionResponse.body.error.code).toBe('MENTOR_SCHEDULE_CONFLICT');
    expect(createSessionResponse.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'mentorId',
        }),
      ]),
    );

    const storedSessions = await request(app)
      .get('/api/mentor/sessions')
      .set('Authorization', `Bearer ${mentorAccessToken}`);

    expect(storedSessions.status).toBe(200);
    expect(storedSessions.body.data.upcoming).toHaveLength(0);
  });
});
