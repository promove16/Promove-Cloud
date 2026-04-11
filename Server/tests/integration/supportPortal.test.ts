import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { Startup } from '../../src/modules/startup/startup.model';
import { SupportTicket } from '../../src/modules/support/support.model';
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
    innovationScore: 81,
    profileComplete: true,
    registrationStage: role === UserRole.STUDENT ? 'profile_setup' : 'complete',
    verificationStatus: role === UserRole.STUDENT ? 'verified' : 'not_required',
    adminApprovalStatus: role === UserRole.STUDENT ? 'not_required' : 'approved',
  });

describe('support portal', () => {
  it('supports the core ticket lifecycle for users and admins', async () => {
    const admin = await createUser(UserRole.ADMIN, 'Support Admin');
    const student = await createUser(UserRole.STUDENT, 'Asha Student');

    const createResponse = await request(app)
      .post('/api/support/tickets')
      .set(authHeader(student))
      .send({
        title: 'Workspace blocked after invite accepted',
        category: 'workspace_collaboration',
        description:
          'I accepted the workspace invite but the workspace still shows blocked when I try to open files.',
        priority: 'high',
        referenceText: 'workspace-123',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data).toEqual(
      expect.objectContaining({
        title: 'Workspace blocked after invite accepted',
        category: 'workspace_collaboration',
        status: 'open',
        priority: 'high',
      }),
    );
    expect(createResponse.body.data.ticketCode).toMatch(/^SUP-\d{8}-\d{4}$/);

    const ticketId = createResponse.body.data._id as string;

    const myTicketsResponse = await request(app)
      .get('/api/support/tickets')
      .set(authHeader(student));

    expect(myTicketsResponse.status).toBe(200);
    expect(myTicketsResponse.body.data).toHaveLength(1);

    const adminQueueResponse = await request(app)
      .get('/api/support/admin/tickets')
      .set(authHeader(admin));

    expect(adminQueueResponse.status).toBe(200);
    expect(adminQueueResponse.body.data[0]).toEqual(
      expect.objectContaining({
        _id: ticketId,
        createdBy: student._id.toString(),
        status: 'open',
      }),
    );

    const assignResponse = await request(app)
      .post(`/api/support/admin/tickets/${ticketId}/assign`)
      .set(authHeader(admin))
      .send({ assignedTo: admin._id.toString() });

    expect(assignResponse.status).toBe(200);
    expect(assignResponse.body.data.assignedTo).toBe(admin._id.toString());

    const adminReplyResponse = await request(app)
      .post(`/api/support/admin/tickets/${ticketId}/reply`)
      .set(authHeader(admin))
      .send({ body: 'We checked the workspace access controls and are applying a fix now.' });

    expect(adminReplyResponse.status).toBe(200);
    expect(adminReplyResponse.body.data.firstRespondedAt).toBeTruthy();
    expect(adminReplyResponse.body.data.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'admin_reply',
          body: 'We checked the workspace access controls and are applying a fix now.',
        }),
      ]),
    );

    const resolveResponse = await request(app)
      .post(`/api/support/admin/tickets/${ticketId}/status`)
      .set(authHeader(admin))
      .send({ status: 'resolved', note: 'Permissions were resynced for the affected workspace.' });

    expect(resolveResponse.status).toBe(200);
    expect(resolveResponse.body.data.status).toBe('resolved');
    expect(resolveResponse.body.data.resolvedAt).toBeTruthy();

    const reopenResponse = await request(app)
      .post(`/api/support/tickets/${ticketId}/reopen`)
      .set(authHeader(student))
      .send({ note: 'The issue is still happening on refresh.' });

    expect(reopenResponse.status).toBe(200);
    expect(reopenResponse.body.data.status).toBe('open');
    expect(reopenResponse.body.data.reopenedCount).toBe(1);

    const analyticsResponse = await request(app)
      .get('/api/support/admin/analytics')
      .set(authHeader(admin));

    expect(analyticsResponse.status).toBe(200);
    expect(analyticsResponse.body.data).toEqual(
      expect.objectContaining({
        open: expect.any(Number),
        inProgress: expect.any(Number),
        resolvedToday: expect.any(Number),
        overdue: expect.any(Number),
      }),
    );

    const storedTicket = await SupportTicket.findById(ticketId).lean();
    expect(storedTicket?.ticketCode).toMatch(/^SUP-\d{8}-\d{4}$/);
    expect(storedTicket?.reopenedCount).toBe(1);
    expect(storedTicket?.assignedTo?.toString()).toBe(admin._id.toString());
  });

  it('lets an admin approve a startup edit unlock from a support ticket', async () => {
    const admin = await createUser(UserRole.ADMIN, 'Startup Unlock Admin');
    const student = await createUser(UserRole.STUDENT, 'Locked Startup Student');

    const startup = await Startup.create({
      founderIds: [student._id],
      name: 'Support Unlock Startup',
      tagline: 'Locked after submission',
      category: 'AI',
      stage: 'Pre-Launch',
      teamSize: 1,
      activeProducts: 1,
      pitchDeckUrl: 'https://example.com/pitch.pdf',
      traction: {
        patentFiled: false,
        mvpBuilt: true,
        revenueGenerating: false,
      },
      registrationProfile: {
        problemStatement: 'This innovation solves a verified logistics workflow issue for distributed student teams.',
        solutionDifferentiation: 'It combines startup review readiness, patent gating, and launch approval into one workflow.',
        coreInnovation: 'The core innovation is a governed startup launch workflow tied to admin decisions.',
        priorArtStatus: 'Adjacent products were reviewed and no matching workflow was identified.',
        workingMechanism: 'The system validates startup data, documents, and admin review before marketplace launch.',
        keyComponents: 'Startup profile, review workflow, supporting documents, and approval history.',
        developmentStage: 'idea',
        documentationReadiness: 'Required startup documentation is complete.',
        inventorOwnership: 'team',
        developmentContext: 'Built in a student-led startup preparation flow.',
        targetMarkets: 'Student founders, campus incubators, and early-stage investors.',
        commercializationStrategy: 'build_startup',
        publicDisclosureStatus: 'No harmful public disclosure has happened.',
        legalAgreements: 'Founder ownership and consent are documented.',
        ipProtectionType: 'patent',
      },
      documents: [
        {
          category: 'design_plan_sketch',
          fileUrl: 'https://example.com/sketch.png',
          fileType: 'image',
          fileName: 'sketch.png',
          fileSizeBytes: 512,
          uploadedAt: new Date(),
          uploadedBy: student._id,
        },
      ],
      reviewStatus: 'approved',
      reviewRequestedAt: new Date(),
      adminReviewedAt: new Date(),
      adminReviewedBy: admin._id,
      isActive: true,
    });

    const ticketResponse = await request(app)
      .post('/api/support/tickets')
      .set(authHeader(student))
      .send({
        title: 'Need startup edit unlock',
        category: 'startup_patent',
        description:
          'The startup is approved and locked, but I need an admin-approved unlock to update the pitch content.',
        relatedEntityType: 'startup',
        relatedEntityId: startup._id.toString(),
        referenceText: startup.name,
      });

    expect(ticketResponse.status).toBe(201);
    const ticketId = ticketResponse.body.data._id as string;

    const unlockResponse = await request(app)
      .post(`/api/support/admin/tickets/${ticketId}/startup-edit-unlock`)
      .set(authHeader(admin))
      .send({ note: 'You may update the startup and resubmit it for review.' });

    console.log(JSON.stringify(unlockResponse.body, null, 2));
    expect(unlockResponse.status).toBe(200);
    expect(unlockResponse.body.data.status).toBe('resolved');
    expect(unlockResponse.body.data.relatedStartup).toEqual(
      expect.objectContaining({
        _id: startup._id.toString(),
        editAccess: expect.objectContaining({
          isLocked: false,
          unlockedByAdmin: true,
        }),
      }),
    );

    const editResponse = await request(app)
      .patch(`/api/startup/${startup._id}`)
      .set(authHeader(student))
      .send({ tagline: 'Updated after admin-approved unlock' });

    expect(editResponse.status).toBe(200);
    expect(editResponse.body.data).toEqual(
      expect.objectContaining({
        reviewStatus: 'draft',
        tagline: 'Updated after admin-approved unlock',
      }),
    );
    expect(editResponse.body.data.editAccess).toEqual(
      expect.objectContaining({
        isLocked: false,
        unlockedByAdmin: false,
      }),
    );
  });
});
