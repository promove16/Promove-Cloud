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

const createUser = async (role: UserRole, displayName: string) =>
  User.create({
    email: `${role}-${Math.random().toString(36).slice(2, 10)}@example.com`,
    passwordHash: 'hashed-password',
    role,
    displayName,
    accessGrantedBy: 'self_registered',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    innovationScore: 88,
    profileComplete: true,
    registrationStage: role === UserRole.STUDENT ? 'profile_setup' : 'complete',
    verificationStatus: role === UserRole.STUDENT ? 'verified' : 'not_required',
    adminApprovalStatus: role === UserRole.STUDENT ? 'not_required' : 'approved',
  });

describe('admin help desk', () => {
  it('lists and resolves help desk tickets from the admin queue', async () => {
    const admin = await createUser(UserRole.ADMIN, 'Primary Admin');
    const sender = await createUser(UserRole.STUDENT, 'Asha Support');

    const createResponse = await request(app)
      .post('/api/workflow-requests')
      .set(authHeader(sender))
      .send({
        requestType: 'helpdesk_ticket',
        actionType: 'connect',
        toUserId: admin._id.toString(),
        targetEntityType: 'help_desk',
        targetEntityId: 'admin-support',
        targetEntityTitle: 'ProMove Help Desk',
        message: 'I cannot access the startup review screen after submitting the checklist.',
        metadata: {
          issueType: 'startup',
          mediatorReplies: [
            'I understand the startup issue. I am preparing a help desk ticket.',
            'Please include the startup name and blocked review step.',
          ],
        },
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.requestType).toBe('helpdesk_ticket');

    const pendingQueueResponse = await request(app)
      .get('/api/admin/help-desk')
      .set(authHeader(admin));

    expect(pendingQueueResponse.status).toBe(200);
    expect(pendingQueueResponse.body.data).toEqual([
      expect.objectContaining({
        _id: createResponse.body.data._id,
        requestType: 'helpdesk_ticket',
        status: 'pending',
        fromUserId: sender._id.toString(),
      }),
    ]);

    const resolveResponse = await request(app)
      .patch(`/api/admin/help-desk/${createResponse.body.data._id}/resolve`)
      .set(authHeader(admin))
      .send({
        resolutionNotes:
          'Startup review access has been restored. Refresh the page and reopen the launch workspace.',
      });

    expect(resolveResponse.status).toBe(200);
    expect(resolveResponse.body.data).toEqual(
      expect.objectContaining({
        _id: createResponse.body.data._id,
        status: 'completed',
      }),
    );
    expect(resolveResponse.body.data.metadata).toEqual(
      expect.objectContaining({
        issueType: 'startup',
        resolutionNotes:
          'Startup review access has been restored. Refresh the page and reopen the launch workspace.',
      }),
    );

    const storedTicket = await RequestRecord.findById(createResponse.body.data._id).lean();
    expect(storedTicket?.status).toBe('completed');
    expect(storedTicket?.metadata).toEqual(
      expect.objectContaining({
        resolutionNotes:
          'Startup review access has been restored. Refresh the page and reopen the launch workspace.',
      }),
    );
  });
});
