import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import request from 'supertest';
import app from '../../src/app';
import { PatentRequest } from '../../src/modules/patent/patentRequest.model';
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
    registrationStage:
      input.role === UserRole.STUDENT ? 'profile_setup' : 'complete',
    accessGrantedBy: 'admin',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    institutionToken: null,
    institutionId: null,
    institutionVerificationStatus: 'none',
    verificationStatus:
      input.role === UserRole.STUDENT ? 'verified' : 'not_required',
    adminApprovalStatus:
      input.role === UserRole.STUDENT ? 'not_required' : 'approved',
    adminApprovedAt:
      input.role === UserRole.STUDENT ? undefined : new Date(),
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

describe('patent support request integration', () => {
  it('accepts questionnaire answers and staged workspace uploads in a support request', async () => {
    const { user: studentUser, email: studentEmail } = await createApprovedUser({
      role: UserRole.STUDENT,
      displayName: 'Support Request Founder',
    });

    const uploadId = new Types.ObjectId();
    const workspace = await Workspace.create({
      ownerId: studentUser._id,
      teamMemberIds: [studentUser._id],
      title: 'Founder Workspace',
      category: 'Software',
      stage: 'Build',
      uploads: [
        {
          _id: uploadId,
          fileUrl: 'https://example.com/prior-art.pdf',
          fileType: 'pdf',
          fileName: 'prior-art.pdf',
          fileSizeBytes: 2048,
          uploadedBy: studentUser._id,
          uploadedAt: new Date(),
          category: 'other',
          note: 'Prior-art notes',
        },
      ],
    });

    const accessToken = await loginAs(studentEmail);

    const response = await request(app)
      .post('/api/patents/requests')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        workspaceId: workspace._id.toString(),
        projectTitle: 'Adaptive Patent Workflow',
        description:
          'A guided workflow that collects invention context, routes supporting files, and sends a clean patent support request to the admin team.',
        patentType: 'invention',
        questionnaire: {
          problemStatement:
            'Student founders need one place to capture the invention problem and the people affected by it.',
          solutionDifferentiation:
            'The request combines a structured intake with workspace-linked files instead of scattered chat messages.',
          coreInnovation:
            'The core innovation is the workspace-to-patent support bridge with structured admin intake.',
          priorArtStatus:
            'The team reviewed prior-art workflow tools and attached notes for admin review.',
          workingMechanism:
            'Students answer the intake, attach files, and the system creates a patent support request with context.',
          keyComponents: 'Workspace, intake questionnaire, admin queue, and supporting file links.',
          developmentStage: 'prototype',
          documentationReadiness:
            'Early draft notes and supporting files are ready and attached.',
          inventorOwnership: 'team',
          developmentContext:
            'The product was built independently inside the team workspace.',
          targetMarkets:
            'Incubators, colleges, and startup support teams can use this workflow.',
          commercializationStrategy: 'build_startup',
          publicDisclosureStatus:
            'No public disclosure has happened outside the internal team.',
          legalAgreements:
            'No external legal agreements are currently in place.',
          ipProtectionType: 'patent',
        },
        documentUploads: [
          {
            uploadId: uploadId.toString(),
            category: 'prior_art_report',
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        projectTitle: 'Adaptive Patent Workflow',
        status: 'submitted',
      }),
    );
    expect(response.body.data.documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: 'prior-art.pdf',
          documentCategory: 'prior_art_report',
        }),
      ]),
    );

    const patentRequest = await PatentRequest.findOne({
      studentId: studentUser._id,
    }).lean();
    expect(patentRequest?.documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: 'prior-art.pdf',
          documentCategory: 'prior_art_report',
          uploadId,
        }),
      ]),
    );
  });
});
