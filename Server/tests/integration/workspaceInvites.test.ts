import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { TeamRequest } from '../../src/modules/social/teamRequest.model';
import { User } from '../../src/modules/user/user.model';
import { Workspace } from '../../src/modules/workspace/workspace.model';
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

const createStudent = async (displayName: string) =>
  User.create({
    email: `student-${Math.random().toString(36).slice(2, 10)}@example.com`,
    passwordHash: 'hashed-password',
    role: UserRole.STUDENT,
    displayName,
    accessGrantedBy: 'self_registered',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    innovationScore: 42,
    profileComplete: true,
    registrationStage: 'profile_setup',
    verificationStatus: 'verified',
    adminApprovalStatus: 'not_required',
  });

describe('workspace invite acceptance flow', () => {
  it('keeps an existing-user invite pending until the recipient accepts', async () => {
    const owner = await createStudent('Workspace Owner');
    const invitee = await createStudent('Workspace Invitee');

    const workspace = await Workspace.create({
      ownerId: owner._id,
      teamMemberIds: [owner._id],
      title: 'Pending Invite Workspace',
      category: 'AI',
      stage: 'Ideation',
    });

    const inviteResponse = await request(app)
      .post(`/api/workspace/${workspace._id}/invite`)
      .set(authHeader(owner))
      .send({ userId: invitee._id.toString() });

    expect(inviteResponse.status).toBe(200);
    expect(inviteResponse.body.data.teamMemberIds.map(String)).toEqual([owner._id.toString()]);
    expect(inviteResponse.body.data.pendingInvites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toUserId: invitee._id.toString(),
          status: 'pending',
        }),
      ]),
    );

    const reloadedWorkspace = await Workspace.findById(workspace._id).lean();
    expect(reloadedWorkspace?.teamMemberIds.map(String)).toEqual([owner._id.toString()]);

    const pendingInvite = await TeamRequest.findOne({
      workspaceId: workspace._id,
      toUserId: invitee._id,
      status: 'pending',
    }).lean();
    expect(pendingInvite).toBeTruthy();

    const beforeAcceptResponse = await request(app)
      .get(`/api/workspace/${workspace._id}`)
      .set(authHeader(invitee));
    expect(beforeAcceptResponse.status).toBe(404);

    const acceptResponse = await request(app)
      .post(`/api/workspace/${workspace._id}/invites/${pendingInvite!._id.toString()}/accept`)
      .set(authHeader(invitee))
      .send();

    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body.data.teamMemberIds.map(String)).toEqual(
      expect.arrayContaining([owner._id.toString(), invitee._id.toString()]),
    );

    const updatedInvite = await TeamRequest.findById(pendingInvite!._id).lean();
    expect(updatedInvite?.status).toBe('accepted');
    expect(updatedInvite?.respondedAt).toBeTruthy();

    const afterAcceptResponse = await request(app)
      .get(`/api/workspace/${workspace._id}`)
      .set(authHeader(invitee));
    expect(afterAcceptResponse.status).toBe(200);
    expect(afterAcceptResponse.body.data.teamMemberIds.map(String)).toEqual(
      expect.arrayContaining([owner._id.toString(), invitee._id.toString()]),
    );
  });

  it('rejects non-student users as workspace team invitees', async () => {
    const owner = await createStudent('Workspace Owner');
    const mentor = await User.create({
      email: `mentor-${Math.random().toString(36).slice(2, 10)}@example.com`,
      passwordHash: 'hashed-password',
      role: UserRole.MENTOR,
      displayName: 'Mentor Invitee',
      accessGrantedBy: 'self_registered',
      accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true,
      innovationScore: 42,
      profileComplete: true,
      registrationStage: 'profile_setup',
      verificationStatus: 'verified',
      adminApprovalStatus: 'approved',
    });

    const workspace = await Workspace.create({
      ownerId: owner._id,
      teamMemberIds: [owner._id],
      title: 'Restricted Invite Workspace',
      category: 'AI',
      stage: 'Ideation',
    });

    const response = await request(app)
      .post(`/api/workspace/${workspace._id}/invite`)
      .set(authHeader(owner))
      .send({ userId: mentor._id.toString() });

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: 'ROLE_NOT_SUPPORTED',
      }),
    );

    const invite = await TeamRequest.findOne({
      workspaceId: workspace._id,
      toUserId: mentor._id,
    }).lean();
    expect(invite).toBeNull();
  });
});
