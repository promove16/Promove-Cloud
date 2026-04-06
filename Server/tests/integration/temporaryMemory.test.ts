import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';

jest.mock(
  'compression',
  () => () => (_req: unknown, _res: unknown, next: () => void) => next(),
  { virtual: true },
);

import app from '../../src/app';
import { cleanupTemporaryMemory } from '../../src/services/temporaryMemoryCleanupService';
import { ChatMessage } from '../../src/modules/chat/chat.model';
import { DirectMessage } from '../../src/modules/dm/dm.model';
import { User } from '../../src/modules/user/user.model';
import { Workspace } from '../../src/modules/workspace/workspace.model';
import { UserRole } from '../../src/types/roles.types';
import { deleteFromCloudinary, uploadToCloudinary } from '../../src/services/cloudinaryService';

jest.mock('../../src/services/cloudinaryService', () => ({
  uploadToCloudinary: jest.fn(async (_buffer: Buffer, folder: string) => ({
    secure_url: `https://cloudinary.test/${folder}/${randomUUID()}`,
    public_id: `public-${randomUUID()}`,
  })),
  deleteFromCloudinary: jest.fn(async () => undefined),
}));

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

describe('temporary memory integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides expired temporary direct messages and workspace chat messages, then cleans them up', async () => {
    const { user: sender, email: senderEmail } = await createApprovedUser({
      role: UserRole.STUDENT,
      displayName: 'Temporary Sender',
    });
    const { user: recipient, email: recipientEmail } = await createApprovedUser({
      role: UserRole.STUDENT,
      displayName: 'Temporary Recipient',
    });

    const workspace = await Workspace.create({
      ownerId: sender._id,
      teamMemberIds: [sender._id, recipient._id],
      title: 'Temporary Memory Workspace',
      category: 'Mobility',
      stage: 'Build',
      progressPercent: 20,
    });

    const senderAccessToken = await loginAs(senderEmail);
    const recipientAccessToken = await loginAs(recipientEmail);

    const dmResponse = await request(app)
      .post(`/api/dm/${recipient._id.toString()}`)
      .set('Authorization', `Bearer ${senderAccessToken}`)
      .send({
        message: 'This note should disappear after the temporary window.',
        memoryMode: 'temporary',
      });

    expect(dmResponse.status).toBe(201);
    expect(dmResponse.body.data.memoryMode).toBe('temporary');
    expect(dmResponse.body.data.expiresAt).toBeTruthy();

    const threadBeforeExpiry = await request(app)
      .get(`/api/dm/${sender._id.toString()}`)
      .set('Authorization', `Bearer ${recipientAccessToken}`);

    expect(threadBeforeExpiry.status).toBe(200);
    expect(threadBeforeExpiry.body.data).toHaveLength(1);

    const chatMessage = await ChatMessage.create({
      workspaceId: workspace._id,
      senderId: sender._id,
      message: 'Temporary workspace chat',
      memoryMode: 'temporary',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      sentAt: new Date(),
    });

    const chatBeforeExpiry = await request(app)
      .get(`/api/chat/workspace/${workspace._id.toString()}`)
      .set('Authorization', `Bearer ${recipientAccessToken}`);

    expect(chatBeforeExpiry.status).toBe(200);
    expect(chatBeforeExpiry.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: chatMessage._id.toString(),
          memoryMode: 'temporary',
        }),
      ]),
    );

    const expiredAt = new Date(Date.now() - 5 * 60 * 1000);
    await DirectMessage.updateOne(
      { _id: dmResponse.body.data._id as string },
      { $set: { expiresAt: expiredAt } },
    );
    await ChatMessage.updateOne(
      { _id: chatMessage._id },
      { $set: { expiresAt: expiredAt } },
    );

    const threadAfterExpiry = await request(app)
      .get(`/api/dm/${sender._id.toString()}`)
      .set('Authorization', `Bearer ${recipientAccessToken}`);

    expect(threadAfterExpiry.status).toBe(200);
    expect(threadAfterExpiry.body.data).toEqual([]);

    const chatAfterExpiry = await request(app)
      .get(`/api/chat/workspace/${workspace._id.toString()}`)
      .set('Authorization', `Bearer ${recipientAccessToken}`);

    expect(chatAfterExpiry.status).toBe(200);
    expect(chatAfterExpiry.body.data).toEqual([]);

    const cleanupResult = await cleanupTemporaryMemory(new Date());
    expect(cleanupResult.deletedDirectMessages).toBe(1);
    expect(cleanupResult.deletedWorkspaceMessages).toBe(1);

    expect(await DirectMessage.countDocuments()).toBe(0);
    expect(await ChatMessage.countDocuments()).toBe(0);
  });

  it('stores temporary upload expiry metadata, hides expired uploads, and removes media on cleanup', async () => {
    const { user: student, email } = await createApprovedUser({
      role: UserRole.STUDENT,
      displayName: 'Temporary Upload Owner',
    });

    const workspace = await Workspace.create({
      ownerId: student._id,
      teamMemberIds: [student._id],
      title: 'Temporary Upload Workspace',
      category: 'AI',
      stage: 'Build',
      progressPercent: 55,
    });

    const accessToken = await loginAs(email);

    const uploadResponse = await request(app)
      .post(`/api/workspace/${workspace._id.toString()}/upload`)
      .set('Authorization', `Bearer ${accessToken}`)
      .field('note', 'Temporary design mockup')
      .field('memoryMode', 'temporary')
      .attach('file', Buffer.from('temporary image'), 'temporary.png');

    expect(uploadResponse.status).toBe(200);
    expect(uploadResponse.body.data).toHaveLength(1);
    expect(uploadResponse.body.data[0]).toEqual(
      expect.objectContaining({
        memoryMode: 'temporary',
      }),
    );
    expect(uploadResponse.body.data[0].expiresAt).toBeTruthy();
    expect(uploadToCloudinary).toHaveBeenCalled();

    const storedWorkspace = await Workspace.findById(workspace._id);
    expect(storedWorkspace?.uploads).toHaveLength(1);

    storedWorkspace!.uploads[0].expiresAt = new Date(Date.now() - 10 * 60 * 1000);
    await storedWorkspace!.save();

    const workspaceAfterExpiry = await request(app)
      .get(`/api/workspace/${workspace._id.toString()}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(workspaceAfterExpiry.status).toBe(200);
    expect(workspaceAfterExpiry.body.data.uploads).toEqual([]);

    const cleanupResult = await cleanupTemporaryMemory(new Date());
    expect(cleanupResult.deletedWorkspaceUploads).toBe(1);
    expect(deleteFromCloudinary).toHaveBeenCalledTimes(1);

    const cleanedWorkspace = await Workspace.findById(workspace._id).lean();
    expect(cleanedWorkspace?.uploads ?? []).toHaveLength(0);
  });
});
