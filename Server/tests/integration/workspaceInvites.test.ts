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

describe('workspace upload URL serialization', () => {
  it('returns a presigned HTTPS URL immediately after an S3 upload', async () => {
    const owner = await createStudent('Workspace Upload Owner');
    const workspace = await Workspace.create({
      ownerId: owner._id,
      teamMemberIds: [owner._id],
      title: 'Private Upload Workspace',
      category: 'Documents',
      stage: 'Build',
    });

    const response = await request(app)
      .post(`/api/workspace/${workspace._id}/upload`)
      .set(authHeader(owner))
      .attach('file', Buffer.from('%PDF-1.4\n% ProMove test PDF\n%%EOF'), {
        filename: 'workspace-document.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(200);
    const uploaded = response.body.data.at(-1);
    expect(uploaded).toEqual(
      expect.objectContaining({
        fileName: 'workspace-document.pdf',
        storageProvider: 's3',
      }),
    );
    expect(uploaded.fileUrl).toMatch(/^https:\/\//);
    expect(uploaded.fileUrl).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(uploaded.fileUrl).toContain('X-Amz-Signature=');

    const persisted = await Workspace.findById(workspace._id).lean();
    expect(persisted?.uploads.at(-1)?.fileUrl).not.toContain('X-Amz-Signature=');
    expect(persisted?.uploads.at(-1)?.storageKey).toBeTruthy();
  });

  it('repairs and signs a legacy scheme-less S3 workspace URL', async () => {
    const owner = await createStudent('Legacy Workspace Upload Owner');
    const objectKey = 'promove/workspaces/legacy-workspace-document.pdf';
    const workspace = await Workspace.create({
      ownerId: owner._id,
      teamMemberIds: [owner._id],
      title: 'Legacy Private Upload Workspace',
      category: 'Documents',
      stage: 'Build',
      uploads: [
        {
          fileUrl: `promove-test-bucket.s3.ap-south-1.amazonaws.com/${objectKey}`,
          fileType: 'pdf',
          fileName: 'legacy-workspace-document.pdf',
          fileSizeBytes: 512,
          uploadedBy: owner._id,
          uploadedAt: new Date(),
          category: 'other',
          mimeType: 'application/pdf',
        },
      ],
    });

    const response = await request(app)
      .get(`/api/workspace/${workspace._id}`)
      .set(authHeader(owner));

    expect(response.status).toBe(200);
    const uploaded = response.body.data.uploads.at(-1);
    expect(uploaded.fileUrl).toMatch(/^https:\/\//);
    expect(uploaded.fileUrl).toContain(objectKey);
    expect(uploaded.fileUrl).toContain('X-Amz-Signature=');
  });
});
