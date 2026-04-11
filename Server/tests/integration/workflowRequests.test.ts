import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
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
});
