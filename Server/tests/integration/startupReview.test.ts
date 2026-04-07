import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { AdminAuditLog } from '../../src/modules/admin/adminAuditLog.model';
import { Startup } from '../../src/modules/startup/startup.model';
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

describe('startup review readiness integration', () => {
  it('rejects review requests for incomplete startup registration profiles', async () => {
    const founder = await User.create({
      email: `student-${Math.random().toString(36).slice(2, 10)}@example.com`,
      passwordHash: 'hashed-password',
      role: UserRole.STUDENT,
      displayName: 'Startup Founder',
      accessGrantedBy: 'self_registered',
      accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true,
      innovationScore: 52,
      profileComplete: true,
      registrationStage: 'profile_setup',
      verificationStatus: 'verified',
      adminApprovalStatus: 'not_required',
    });

    const startup = await Startup.create({
      founderIds: [founder._id],
      name: 'Incomplete Startup',
      tagline: 'A draft startup without legal setup',
      category: 'Software',
      stage: 'Pre-Launch',
      teamSize: 1,
      activeProducts: 1,
      traction: {
        patentFiled: false,
        mvpBuilt: false,
        revenueGenerating: false,
      },
    });

    const response = await request(app)
      .post(`/api/startup/${startup._id}/request-review`)
      .set(authHeader(founder))
      .send();

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: 'STARTUP_INCOMPLETE',
      }),
    );
    expect(response.body.error.message).toContain('problem statement');
    expect(response.body.error.message).toContain('and');

    const updatedStartup = await Startup.findById(startup._id).lean();
    expect(updatedStartup?.reviewStatus).toBe('draft');
  });

  it('creates admin audit logs for startup approval and change requests', async () => {
    const founder = await User.create({
      email: `student-${Math.random().toString(36).slice(2, 10)}@example.com`,
      passwordHash: 'hashed-password',
      role: UserRole.STUDENT,
      displayName: 'Audited Startup Founder',
      accessGrantedBy: 'self_registered',
      accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true,
      innovationScore: 52,
      profileComplete: true,
      registrationStage: 'profile_setup',
      verificationStatus: 'verified',
      adminApprovalStatus: 'not_required',
    });

    const admin = await User.create({
      email: `admin-${Math.random().toString(36).slice(2, 10)}@example.com`,
      passwordHash: 'hashed-password',
      role: UserRole.ADMIN,
      displayName: 'Startup Review Admin',
      accessGrantedBy: 'admin',
      accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true,
      innovationScore: 0,
      profileComplete: true,
      registrationStage: 'complete',
      verificationStatus: 'not_required',
      adminApprovalStatus: 'approved',
      adminApprovedAt: new Date(),
    });

    const startup = await Startup.create({
      founderIds: [founder._id],
      name: 'Audit Ready Startup',
      tagline: 'A fully documented startup for audit review',
      category: 'Software',
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
          uploadedBy: founder._id,
        },
      ],
      reviewStatus: 'review_requested',
      isActive: true,
    });

    const approveResponse = await request(app)
      .patch(`/api/admin/startups/${startup._id}/review`)
      .set(authHeader(admin))
      .send({ decision: 'approved' });

    expect(approveResponse.status).toBe(200);

    const approveAudit = await AdminAuditLog.findOne({
      targetId: startup._id,
      action: 'STARTUP_APPROVED',
    }).lean();
    expect(approveAudit).toBeTruthy();
    expect(String(approveAudit?.adminId)).toBe(admin._id.toString());

    const changesResponse = await request(app)
      .patch(`/api/admin/startups/${startup._id}/review`)
      .set(authHeader(admin))
      .send({ decision: 'changes_requested', adminNotes: 'Please update the legal agreements and disclosure notes.' });

    expect(changesResponse.status).toBe(200);

    const changesAudit = await AdminAuditLog.findOne({
      targetId: startup._id,
      action: 'STARTUP_CHANGES_REQUESTED',
    }).lean();
    expect(changesAudit).toBeTruthy();
    expect(changesAudit?.metadata).toEqual(
      expect.objectContaining({
        reviewStatus: 'changes_requested',
      }),
    );
  });
});
