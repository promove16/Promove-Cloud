import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { AdminAuditLog } from '../../src/modules/admin/adminAuditLog.model';
import { DirectMessage } from '../../src/modules/dm/dm.model';
import { Notification } from '../../src/modules/notification/notification.model';
import { Startup } from '../../src/modules/startup/startup.model';
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

describe('startup review readiness integration', () => {
  it('lists review-requested startups for admins without crashing on sparse legacy fields', async () => {
    const founder = await User.create({
      email: `student-${Math.random().toString(36).slice(2, 10)}@example.com`,
      passwordHash: 'hashed-password',
      role: UserRole.STUDENT,
      displayName: 'Legacy Startup Founder',
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
      displayName: 'Admin Startup Reviewer',
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

    await Startup.create({
      founderIds: [founder._id],
      name: 'Legacy Review Startup',
      tagline: 'A startup that should still render in admin review',
      category: 'Software',
      stage: 'Pre-Launch',
      teamSize: 1,
      activeProducts: 1,
      traction: {
        patentFiled: false,
        mvpBuilt: false,
        revenueGenerating: false,
      },
      registrationProfile: {
        problemStatement: 'This startup addresses a validated logistics issue for student founders in distributed teams.',
        solutionDifferentiation: 'It unifies startup readiness, compliance documents, and approval routing in one system.',
        coreInnovation: 'The innovation is an approval-aware startup operating workflow.',
        priorArtStatus: 'Comparable startup tooling was reviewed and gaps remain in governed launch approvals.',
        workingMechanism: 'The workflow validates submissions, missing items, and review status before launch.',
        keyComponents: 'Startup profile, admin review, and supporting documents.',
        developmentStage: 'idea',
        documentationReadiness: 'Core documents are assembled and ready.',
        inventorOwnership: 'team',
        developmentContext: 'Developed within an institution startup launch process.',
        targetMarkets: 'Student founders, incubators, and early-stage investors.',
        commercializationStrategy: 'build_startup',
        publicDisclosureStatus: 'There has been no harmful disclosure.',
        legalAgreements: 'Founder ownership is documented.',
        ipProtectionType: 'patent',
      },
      reviewStatus: 'review_requested',
      reviewRequestedAt: new Date(),
      documents: [],
      isActive: true,
    });

    const response = await request(app)
      .get('/api/admin/startups?status=review_requested')
      .set(authHeader(admin));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Legacy Review Startup',
          reviewStatus: 'review_requested',
        }),
      ]),
    );
  });

  it('returns signed pitch deck URLs in the admin startup review list', async () => {
    const founder = await User.create({
      email: `student-${Math.random().toString(36).slice(2, 10)}@example.com`,
      passwordHash: 'hashed-password',
      role: UserRole.STUDENT,
      displayName: 'Signed Deck Founder',
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
      displayName: 'Signed Deck Admin',
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

    await Startup.create({
      founderIds: [founder._id],
      name: 'Signed Deck Review Startup',
      tagline: 'A startup with a private pitch deck',
      category: 'Software',
      stage: 'Pre-Launch',
      teamSize: 1,
      activeProducts: 1,
      traction: {
        patentFiled: false,
        mvpBuilt: true,
        revenueGenerating: false,
      },
      pitchDeckUrl: 'https://res.cloudinary.com/demo/raw/upload/v123/promove/startups/private-deck.pdf',
      pitchDeckName: 'private-deck.pdf',
      pitchDeckStorageProvider: 'cloudinary',
      pitchDeckStorageKey: 'promove/startups/private-deck',
      registrationProfile: {
        problemStatement: 'This startup addresses a validated logistics issue for student founders in distributed teams.',
        solutionDifferentiation: 'It unifies startup readiness, compliance documents, and approval routing in one system.',
        coreInnovation: 'The innovation is an approval-aware startup operating workflow.',
        priorArtStatus: 'Comparable startup tooling was reviewed and gaps remain in governed launch approvals.',
        workingMechanism: 'The workflow validates submissions, missing items, and review status before launch.',
        keyComponents: 'Startup profile, admin review, and supporting documents.',
        developmentStage: 'idea',
        documentationReadiness: 'Core documents are assembled and ready.',
        inventorOwnership: 'team',
        developmentContext: 'Developed within an institution startup launch process.',
        targetMarkets: 'Student founders, incubators, and early-stage investors.',
        commercializationStrategy: 'build_startup',
        publicDisclosureStatus: 'There has been no harmful disclosure.',
        legalAgreements: 'Founder ownership is documented.',
        ipProtectionType: 'patent',
      },
      reviewStatus: 'review_requested',
      reviewRequestedAt: new Date(),
      documents: [],
      isActive: true,
    });

    const response = await request(app)
      .get('/api/admin/startups?status=review_requested')
      .set(authHeader(admin));

    expect(response.status).toBe(200);
    const startup = response.body.data.find(
      (item: { name: string }) => item.name === 'Signed Deck Review Startup',
    );
    expect(startup).toEqual(
      expect.objectContaining({
        pitchDeckName: 'private-deck.pdf',
      }),
    );
    expect(startup.pitchDeckUrl).toContain('/raw/upload/');
    expect(startup.pitchDeckUrl).toContain('promove/startups/private-deck');
    expect(startup.pitchDeckUrl).toContain('signature=');
    expect(startup.pitchDeckUrl).not.toBe(
      'https://res.cloudinary.com/demo/raw/upload/v123/promove/startups/private-deck.pdf',
    );
  });

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

  it('locks startup edits after the founder submits for admin review', async () => {
    const founder = await User.create({
      email: `student-${Math.random().toString(36).slice(2, 10)}@example.com`,
      passwordHash: 'hashed-password',
      role: UserRole.STUDENT,
      displayName: 'Locked Startup Founder',
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
      name: 'Locked Review Startup',
      tagline: 'Submitted startup should be frozen',
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
      reviewRequestedAt: new Date(),
      isActive: true,
    });

    const response = await request(app)
      .patch(`/api/startup/${startup._id}`)
      .set(authHeader(founder))
      .send({ tagline: 'This should be blocked while review is pending.' });

    expect(response.status).toBe(423);
    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: 'STARTUP_PROFILE_LOCKED',
      }),
    );

    const unchangedStartup = await Startup.findById(startup._id).lean();
    expect(unchangedStartup?.tagline).toBe('Submitted startup should be frozen');
    expect(unchangedStartup?.reviewStatus).toBe('review_requested');
  });

  it('verifies workspace and details, then requires re-verification after an approved edit', async () => {
    const founder = await User.create({
      email: `student-${Math.random().toString(36).slice(2, 10)}@example.com`,
      passwordHash: 'hashed-password',
      role: UserRole.STUDENT,
      displayName: 'Reverification Startup Founder',
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
      displayName: 'Reverification Admin',
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
      name: 'Reverification Ready Startup',
      tagline: 'Every approved edit must return through admin verification',
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
      reviewRequestedAt: new Date(),
      isActive: true,
    });

    const unlinkedVerification = await request(app)
      .patch(`/api/admin/startups/${startup._id}/review`)
      .set(authHeader(admin))
      .send({ decision: 'approved' });

    expect(unlinkedVerification.status).toBe(400);
    expect(unlinkedVerification.body.error).toEqual(
      expect.objectContaining({ code: 'STARTUP_INCOMPLETE' }),
    );
    expect(unlinkedVerification.body.error.message).toContain('linked workspace');

    const workspace = await Workspace.create({
      ownerId: founder._id,
      teamMemberIds: [],
      title: 'Reverification Workspace',
      category: 'Software',
      isActive: true,
    });

    const linkResponse = await request(app)
      .patch(`/api/startup/${startup._id}`)
      .set(authHeader(founder))
      .send({ projectId: workspace._id.toString() });

    expect(linkResponse.status).toBe(200);
    expect(linkResponse.body.data.reviewStatus).toBe('review_requested');

    const verification = await request(app)
      .patch(`/api/admin/startups/${startup._id}/review`)
      .set(authHeader(admin))
      .send({ decision: 'approved' });

    expect(verification.status).toBe(200);
    expect(verification.body.data.reviewStatus).toBe('approved');

    const editResponse = await request(app)
      .patch(`/api/startup/${startup._id}`)
      .set(authHeader(founder))
      .send({ tagline: 'This approved update now requires another admin verification' });

    expect(editResponse.status).toBe(200);
    expect(editResponse.body.data.reviewStatus).toBe('draft');
    expect(editResponse.body.data.editAccess.canEdit).toBe(true);

    const verifyWithoutResubmission = await request(app)
      .patch(`/api/admin/startups/${startup._id}/review`)
      .set(authHeader(admin))
      .send({ decision: 'approved' });

    expect(verifyWithoutResubmission.status).toBe(409);
    expect(verifyWithoutResubmission.body.error).toEqual(
      expect.objectContaining({ code: 'STARTUP_NOT_SUBMITTED_FOR_REVIEW' }),
    );

    const resubmission = await request(app)
      .post(`/api/startup/${startup._id}/request-review`)
      .set(authHeader(founder))
      .send();

    expect(resubmission.status).toBe(200);
    expect(resubmission.body.data.reviewStatus).toBe('review_requested');
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

    const workspace = await Workspace.create({
      ownerId: founder._id,
      teamMemberIds: [],
      title: 'Audit Ready Workspace',
      category: 'Software',
      isActive: true,
    });

    const startup = await Startup.create({
      founderIds: [founder._id],
      projectId: workspace._id,
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

    const founderMessage = await DirectMessage.findOne({
      senderId: admin._id,
      recipientId: founder._id,
      queryType: 'general',
    }).lean();
    expect(founderMessage).toBeTruthy();
    expect(founderMessage?.message).toContain('Edit request for Audit Ready Startup');
    expect(founderMessage?.message).toContain('Please update the legal agreements and disclosure notes.');
    expect(founderMessage?.message).toContain(`/startup-launch/${startup._id}/overview`);

    const founderNotification = await Notification.findOne({
      userId: founder._id,
      type: 'startup_launch',
      title: 'Startup edit request',
    }).lean();
    expect(founderNotification).toBeTruthy();
    expect(founderNotification?.body).toContain('Please update the legal agreements and disclosure notes.');
    expect(founderNotification?.link).toBe(`/startup-launch/${startup._id}/overview`);
    expect(founderNotification?.metadata).toEqual(
      expect.objectContaining({
        startupId: startup._id.toString(),
        reviewStatus: 'changes_requested',
        adminNotes: 'Please update the legal agreements and disclosure notes.',
      }),
    );
  });
});
