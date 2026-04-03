import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import request from 'supertest';
import app from '../../src/app';
import { Patent } from '../../src/modules/patent/patent.model';
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

const buildPatentPayload = ({
  workspaceId,
  uploadId,
  includeFilingDocuments = true,
}: {
  workspaceId: string;
  uploadId?: string;
  includeFilingDocuments?: boolean;
}) => ({
  projectTitle: 'Founder-Owned Innovation Platform',
  workspaceId,
  documentUploads: uploadId
    ? [
        {
          uploadId,
          category: 'specification_draft' as const,
        },
      ]
    : [],
  questionnaire: {
    problemStatement:
      'Student innovators struggle to send a clear patent intake request to admins with the problem, stakeholders, and product context captured in one place.',
    solutionDifferentiation:
      'This flow combines product evidence, intake questions, and admin review in one workspace instead of scattering invention details across chats and documents.',
    coreInnovation:
      'The unique part is an admin-ready intake layer that connects invention context, ownership details, and supporting uploads in one student workflow.',
    priorArtStatus:
      'The team reviewed adjacent innovation workflow platforms and noted similar admin tools, but no matching student patent intake flow.',
    workingMechanism:
      'The system collects structured intake answers, links them to workspace uploads, and submits one request package into the admin patent review queue.',
    keyComponents:
      'Key components include the student workspace, upload vault, intake form, validation layer, and admin review dashboard.',
    developmentStage: 'prototype',
    documentationReadiness:
      'UI mockups, draft process notes, and early supporting documents are ready and can be attached for admin review.',
    inventorOwnership: 'team',
    developmentContext:
      'The innovation was developed by the student team inside an internal product workspace without being tied to a problem-bank challenge.',
    targetMarkets:
      'The solution can be applied in student innovation programs, colleges, incubators, and IPR support desks that review invention requests.',
    commercializationStrategy: 'build_startup',
    publicDisclosureStatus:
      'No public disclosure has been made beyond private product discussions within the student build team.',
    legalAgreements:
      'There are no NDAs yet, but the team has not signed conflicting legal agreements with outside parties.',
    ipProtectionType: 'patent',
  },
  ...(includeFilingDocuments
    ? {
        filingDocuments: {
          inventionCategory: 'software_hardware_integration' as const,
          specificationType: 'provisional' as const,
          inventorJournalSummary:
            'The inventor journal records problem framing, design options, prototype decisions, and the validation notes that shaped the final concept.',
          priorArtSearchSummary:
            'Prior-art review covered startup operations platforms, product workspace systems, and related filing support software for overlap analysis.',
          prototypeStatus: 'working_prototype' as const,
          specificationDraft:
            'The specification draft explains the workspace architecture, workflow states, evidence model, and filing-readiness orchestration in implementation detail.',
          abstractDraft:
            'A founder-owned innovation workspace that connects execution evidence with patent filing readiness.',
          claimsDraft:
            'Claims focus on the coordination of student-owned workspace evidence, filing-readiness validation, and invention submission workflows.',
          drawingsPrepared: true,
          drawingsNotes: 'Architecture and workflow diagrams are prepared for legal review.',
          form1ApplicantDetailsConfirmed: true,
          form5InventorshipConfirmed: true,
          form26PowerOfAttorneyRequired: false,
          examinationRequestPlan: 'Proceed with standard examination after the provisional filing review is complete.',
          publicDisclosureChecked: true,
          professionalSupportNeeded: true,
        },
      }
    : {}),
});

describe('patent submission integration', () => {
  it('rejects submissions from problem-bank workspaces', async () => {
    const { user: studentUser, email: studentEmail } = await createApprovedUser({
      role: UserRole.STUDENT,
      displayName: 'Patent Founder',
    });

    const uploadId = new Types.ObjectId();
    const workspace = await Workspace.create({
      ownerId: studentUser._id,
      teamMemberIds: [studentUser._id],
      claimedProblemId: new Types.ObjectId(),
      title: 'Admin Problem Workspace',
      category: 'Energy',
      stage: 'Problem',
      uploads: [
        {
          _id: uploadId,
          fileUrl: 'https://example.com/specification.pdf',
          fileType: 'pdf',
          fileName: 'specification.pdf',
          fileSizeBytes: 2048,
          uploadedBy: studentUser._id,
          uploadedAt: new Date(),
          category: 'other',
        },
      ],
    });

    const accessToken = await loginAs(studentEmail);

    const response = await request(app)
      .post('/api/patents/submit')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(buildPatentPayload({ workspaceId: workspace._id.toString(), uploadId: uploadId.toString() }));

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: 'PATENT_WORKSPACE_NOT_ELIGIBLE',
      }),
    );
    expect(response.body.error.message).toContain('own product workspace');

    const patentCount = await Patent.countDocuments({ studentId: studentUser._id });
    expect(patentCount).toBe(0);
  });

  it('accepts questionnaire-only submissions without legacy filing documents', async () => {
    const { user: studentUser, email: studentEmail } = await createApprovedUser({
      role: UserRole.STUDENT,
      displayName: 'Questionnaire Only Founder',
    });

    const workspace = await Workspace.create({
      ownerId: studentUser._id,
      teamMemberIds: [studentUser._id],
      title: 'Independent Innovation Workspace',
      category: 'Healthcare',
      stage: 'Patent',
      uploads: [],
    });

    const accessToken = await loginAs(studentEmail);

    const response = await request(app)
      .post('/api/patents/submit')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(buildPatentPayload({ workspaceId: workspace._id.toString(), includeFilingDocuments: false }));

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        projectTitle: 'Founder-Owned Innovation Platform',
        supportingDocuments: [],
      }),
    );
    expect(response.body.data.filingDocuments).toBeUndefined();

    const patent = await Patent.findOne({ studentId: studentUser._id }).lean();
    expect(patent).toBeTruthy();
    expect(patent?.filingDocuments).toBeUndefined();
  });
});
