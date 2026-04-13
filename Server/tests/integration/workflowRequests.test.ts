import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { Event } from '../../src/modules/event/event.model';
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

describe('workflow requests', () => {
  it('shows and accepts direct requests across different institutions', async () => {
    const senderCollege = await createUser(UserRole.COLLEGE, 'Sender College', {
      institutionProfile: {
        institutionName: 'Sender College',
        location: 'Hyderabad',
        totalStudentsEnrolled: 1200,
        academicYear: '2025-26',
        iicStarRating: 4,
      },
    });
    const recipientCollege = await createUser(UserRole.COLLEGE, 'Recipient College', {
      institutionProfile: {
        institutionName: 'Recipient College',
        location: 'Mumbai',
        totalStudentsEnrolled: 980,
        academicYear: '2025-26',
        iicStarRating: 4,
      },
    });
    const sender = await createUser(UserRole.STUDENT, 'Priya Nair', {
      institutionId: senderCollege._id,
      institutionProfile: senderCollege.institutionProfile,
    });
    const recipient = await createUser(UserRole.STUDENT, 'Rohit Patel', {
      institutionId: recipientCollege._id,
      institutionProfile: recipientCollege.institutionProfile,
    });

    const createResponse = await request(app)
      .post('/api/workflow-requests')
      .set(authHeader(sender))
      .send({
        requestType: 'generic',
        actionType: 'connect',
        toUserId: recipient._id.toString(),
        targetEntityType: 'conversation',
        targetEntityId: recipient._id.toString(),
        targetEntityTitle: recipient.displayName,
        message: 'Let us connect about your marketplace profile.',
        deepLink: `/dashboard/messages/${recipient._id.toString()}`,
        acceptRedirect: `/dashboard/messages/${recipient._id.toString()}`,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data).toEqual(
      expect.objectContaining({
        status: 'pending',
        fromUserId: sender._id.toString(),
        toUserId: recipient._id.toString(),
      }),
    );

    const storedRequest = await RequestRecord.findById(createResponse.body.data._id).lean();
    expect(String(storedRequest?.institutionId)).toBe(senderCollege._id.toString());

    const incomingResponse = await request(app)
      .get('/api/workflow-requests/incoming')
      .set(authHeader(recipient));

    expect(incomingResponse.status).toBe(200);
    expect(incomingResponse.body.data).toEqual([
      expect.objectContaining({
        _id: createResponse.body.data._id,
        status: 'pending',
        fromUserId: sender._id.toString(),
        toUserId: recipient._id.toString(),
        targetEntityType: 'conversation',
      }),
    ]);

    const acceptResponse = await request(app)
      .post(`/api/workflow-requests/${createResponse.body.data._id}/accept`)
      .set(authHeader(recipient))
      .send();

    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body.data).toEqual(
      expect.objectContaining({
        _id: createResponse.body.data._id,
        status: 'accepted',
        toUserId: recipient._id.toString(),
      }),
    );

    const outgoingResponse = await request(app)
      .get('/api/workflow-requests/outgoing')
      .set(authHeader(sender));

    expect(outgoingResponse.status).toBe(200);
    expect(outgoingResponse.body.data).toEqual([
      expect.objectContaining({
        _id: createResponse.body.data._id,
        status: 'accepted',
      }),
    ]);
  });

  it('creates a recruiter hiring event only after the college accepts the event invite request', async () => {
    const recruiter = await createUser(UserRole.RECRUITER, 'Apex Recruiter');
    const college = await createUser(UserRole.COLLEGE, 'North Campus', {
      institutionProfile: {
        institutionName: 'North Campus',
        location: 'Warangal',
        totalStudentsEnrolled: 1400,
        academicYear: '2025-26',
        iicStarRating: 4.5,
      },
    });

    await RequestRecord.create({
      type: 'college_recruiter_partnership',
      actionType: 'partner',
      fromUserId: recruiter._id,
      toUserId: college._id,
      targetEntityType: 'college',
      targetEntityId: college._id.toString(),
      targetEntityTitle: college.displayName,
      status: 'accepted',
      message: 'Accepted partnership',
      respondedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      auditTrail: [{ status: 'created', actorUserId: recruiter._id, at: new Date() }],
    });

    const createResponse = await request(app)
      .post('/api/workflow-requests')
      .set(authHeader(recruiter))
      .send({
        requestType: 'college_event_invite',
        actionType: 'approve',
        toUserId: college._id.toString(),
        targetEntityType: 'college',
        targetEntityId: college._id.toString(),
        targetEntityTitle: college.displayName,
        targetRole: 'college',
        requestedRole: 'host',
        requestedPermission: 'college_hiring_event',
        metadata: {
          entityName: 'North Campus Hiring Sprint',
          title: 'North Campus Hiring Sprint',
          type: 'Placement Hackathon',
          date: '2026-05-10T09:00:00.000Z',
          description: 'Shortlist top students through recruiter and college scoring.',
          minimumInnovationScore: 72,
        },
      });

    expect(createResponse.status).toBe(201);
    expect(await Event.find()).toHaveLength(0);

    const acceptResponse = await request(app)
      .post(`/api/workflow-requests/${createResponse.body.data._id}/accept`)
      .set(authHeader(college))
      .send();

    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body.data).toEqual(
      expect.objectContaining({
        status: 'accepted',
        deepLink: expect.stringContaining('/dashboard/recruiter/hiring-events?eventId='),
        acceptRedirect: expect.stringContaining('/dashboard/college/events?tab=hiring&eventId='),
      }),
    );

    const events = await Event.find().lean();
    expect(events).toHaveLength(1);
    expect(String(events[0].sourceRequestId)).toBe(createResponse.body.data._id);
    expect(String(events[0].institutionId)).toBe(college._id.toString());
    expect(String(events[0].recruiterId)).toBe(recruiter._id.toString());
    expect(events[0].title).toBe('North Campus Hiring Sprint');
    expect(events[0].minimumInnovationScore).toBe(72);

    const updatedRequest = await RequestRecord.findById(createResponse.body.data._id).lean();
    expect(updatedRequest?.metadata).toEqual(
      expect.objectContaining({
        title: 'North Campus Hiring Sprint',
        eventId: String(events[0]._id),
      }),
    );
  });
});
