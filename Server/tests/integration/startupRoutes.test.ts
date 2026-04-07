import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { Patent } from '../../src/modules/patent/patent.model';
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

const createStudent = async (displayName: string) =>
  User.create({
    email: `student-${Math.random().toString(36).slice(2, 10)}@example.com`,
    passwordHash: 'hashed-password',
    role: UserRole.STUDENT,
    displayName,
    accessGrantedBy: 'self_registered',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    innovationScore: 52,
    profileComplete: true,
    registrationStage: 'profile_setup',
    verificationStatus: 'verified',
    adminApprovalStatus: 'not_required',
  });

const createRoleUser = async (role: UserRole, displayName: string) =>
  User.create({
    email: `${role}-${Math.random().toString(36).slice(2, 10)}@example.com`,
    passwordHash: 'hashed-password',
    role,
    displayName,
    accessGrantedBy: 'self_registered',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    innovationScore: 52,
    profileComplete: true,
    registrationStage: 'profile_setup',
    verificationStatus: 'verified',
    adminApprovalStatus: 'not_required',
  });

const completeRegistrationProfile = {
  problemStatement: 'This innovation solves a persistent logistics visibility problem for city teams.',
  solutionDifferentiation: 'The solution differs by combining workflow state, team context, and live launch signals.',
  coreInnovation: 'A governed launch workflow that ties workspace progress to investor readiness.',
  priorArtStatus: 'The team reviewed adjacent workflow products and found no identical launch gate.',
  workingMechanism: 'The workflow validates project completion, patent approval, pitch readiness, and marketplace launch.',
  keyComponents: 'Workspace progress, patent approval, startup profile, pitch deck, and investor marketplace.',
  developmentStage: 'idea',
  documentationReadiness: 'Required launch documentation is available for admin review.',
  inventorOwnership: 'team',
  developmentContext: 'The innovation was developed in a ProMove student project workspace.',
  targetMarkets: 'Student startups, campus incubators, and early-stage investor discovery workflows.',
  commercializationStrategy: 'build_startup',
  publicDisclosureStatus: 'No harmful public disclosure has been made before review.',
  legalAgreements: 'Team ownership is captured with founder consent and workspace membership.',
  ipProtectionType: 'patent',
} as const;

type CreatedStudent = Awaited<ReturnType<typeof createStudent>>;
type WorkspaceWithId = { _id: Types.ObjectId };

const createApprovedLaunchStartup = async (
  founder: CreatedStudent,
  workspace: WorkspaceWithId,
  overrides: Partial<Record<string, unknown>> = {},
) =>
  Startup.create({
    founderIds: [founder._id],
    projectId: workspace._id,
    name: 'Workflow Launch Startup',
    tagline: 'A governed launch profile for investor pitch listing',
    category: 'AI',
    stage: 'Pre-Launch',
    pitchDeckUrl: 'https://example.com/pitch.pdf',
    activeProducts: 1,
    teamSize: 1,
    traction: {
      patentFiled: false,
      mvpBuilt: true,
      revenueGenerating: false,
    },
    registrationProfile: completeRegistrationProfile,
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
    reviewStatus: 'approved',
    isActive: true,
    ...overrides,
  });

const createApprovedPatent = async (
  founder: CreatedStudent,
  workspace: WorkspaceWithId,
) =>
  Patent.create({
    studentId: founder._id,
    workspaceId: workspace._id,
    projectTitle: 'Workflow Launch Patent',
    questionnaire: completeRegistrationProfile,
    supportingDocuments: [],
    status: 'approved',
    submittedAt: new Date(),
    adminReviewedAt: new Date(),
    adminReviewedBy: founder._id,
    scoreAwarded: true,
    showcasedInMarketplace: false,
  });

describe('startup route validation', () => {
  it('rejects non-ObjectId startup ids before mongoose casting', async () => {
    const founder = await createStudent('Startup Founder');

    const response = await request(app)
      .get('/api/startup/new')
      .set(authHeader(founder));

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: 'INVALID_ID',
        message: 'Invalid ID format',
      }),
    );
  });

  it('rejects startup creation when the linked workspace belongs to another student', async () => {
    const founder = await createStudent('Founder');
    const otherStudent = await createStudent('Other Student');

    const workspace = await Workspace.create({
      ownerId: otherStudent._id,
      teamMemberIds: [otherStudent._id],
      title: 'Other Workspace',
      category: 'AI',
      stage: 'Ideation',
    });

    const response = await request(app)
      .post('/api/startup')
      .set(authHeader(founder))
      .send({
        projectId: workspace._id.toString(),
        name: 'Tenant Guard Startup',
        tagline: 'Should not attach to another student workspace',
        category: 'AI',
        stage: 'Pre-Launch',
        activeProducts: 1,
        teamSize: 1,
        traction: {
          patentFiled: false,
          mvpBuilt: false,
          revenueGenerating: false,
        },
        businessProfile: {
          problemStatement: '',
          solutionSummary: '',
          targetCustomers: '',
          marketAnalysis: '',
          revenueModel: '',
          goToMarketPlan: '',
        },
        registrationProfile: {
          problemStatement: '',
          solutionDifferentiation: '',
          coreInnovation: '',
          priorArtStatus: '',
          workingMechanism: '',
          keyComponents: '',
          developmentStage: 'idea',
          documentationReadiness: '',
          inventorOwnership: 'individual',
          developmentContext: '',
          targetMarkets: '',
          commercializationStrategy: 'build_startup',
          publicDisclosureStatus: '',
          legalAgreements: '',
          ipProtectionType: 'patent',
        },
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: 'WORKSPACE_NOT_FOUND',
      }),
    );
  });

  it('allows a workspace teammate to see workspace-linked startups in mine and by id', async () => {
    const owner = await createStudent('Workspace Owner');
    const teammate = await createStudent('Workspace Teammate');

    const workspace = await Workspace.create({
      ownerId: owner._id,
      teamMemberIds: [owner._id, teammate._id],
      title: 'Shared Startup Workspace',
      category: 'Climate',
      stage: 'Launch',
    });

    const createdResponse = await request(app)
      .post('/api/startup')
      .set(authHeader(owner))
      .send({
        projectId: workspace._id.toString(),
        name: 'Shared Startup',
        tagline: 'Built by a workspace team',
        category: 'Climate',
        stage: 'Pre-Launch',
        activeProducts: 1,
        teamSize: 1,
        traction: {
          patentFiled: false,
          mvpBuilt: true,
          revenueGenerating: false,
        },
        businessProfile: {
          problemStatement: '',
          solutionSummary: '',
          targetCustomers: '',
          marketAnalysis: '',
          revenueModel: '',
          goToMarketPlan: '',
        },
        registrationProfile: {
          problemStatement: '',
          solutionDifferentiation: '',
          coreInnovation: '',
          priorArtStatus: '',
          workingMechanism: '',
          keyComponents: '',
          developmentStage: 'idea',
          documentationReadiness: '',
          inventorOwnership: 'team',
          developmentContext: '',
          targetMarkets: '',
          commercializationStrategy: 'build_startup',
          publicDisclosureStatus: '',
          legalAgreements: '',
          ipProtectionType: 'patent',
        },
      });

    expect(createdResponse.status).toBe(201);
    expect(createdResponse.body.data.teamSize).toBe(2);

    const startupId = createdResponse.body.data._id as string;

    const startup = await Startup.findById(startupId).lean();
    expect(startup?.founderIds.map(String)).toEqual(
      expect.arrayContaining([owner._id.toString(), teammate._id.toString()]),
    );

    const teammateMineResponse = await request(app)
      .get('/api/startup/mine')
      .set(authHeader(teammate));

    expect(teammateMineResponse.status).toBe(200);
    expect(teammateMineResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: startupId,
          projectId: workspace._id.toString(),
        }),
      ]),
    );

    const teammateDetailResponse = await request(app)
      .get(`/api/startup/${startupId}`)
      .set(authHeader(teammate));

    expect(teammateDetailResponse.status).toBe(200);
    expect(teammateDetailResponse.body.data).toEqual(
      expect.objectContaining({
        _id: startupId,
        teamSize: 2,
      }),
    );
  });

  it('allows startup creation with a fully filled long-form payload', async () => {
    const founder = await createStudent('Large Payload Founder');
    const longText = 'Detailed startup launch answer. '.repeat(22);

    const response = await request(app)
      .post('/api/startup')
      .set(authHeader(founder))
      .send({
        name: 'Long Form Startup',
        tagline: 'Launch profile with a large but valid questionnaire payload',
        category: 'DeepTech',
        stage: 'Pre-Launch',
        fundingNeeded: 2500000,
        activeProducts: 3,
        teamSize: 1,
        traction: {
          patentFiled: true,
          mvpBuilt: true,
          revenueGenerating: false,
          usersCount: 120,
        },
        businessProfile: {
          problemStatement: longText,
          solutionSummary: longText,
          targetCustomers: longText,
          marketAnalysis: longText,
          revenueModel: longText,
          goToMarketPlan: longText,
        },
        registrationProfile: {
          problemStatement: longText,
          solutionDifferentiation: longText,
          coreInnovation: longText,
          priorArtStatus: longText,
          workingMechanism: longText,
          keyComponents: longText,
          developmentStage: 'prototype',
          documentationReadiness: longText,
          inventorOwnership: 'team',
          developmentContext: longText,
          targetMarkets: longText,
          commercializationStrategy: 'build_startup',
          publicDisclosureStatus: longText,
          legalAgreements: longText,
          ipProtectionType: 'patent',
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        name: 'Long Form Startup',
        category: 'DeepTech',
        stage: 'Pre-Launch',
      }),
    );
  });

  it('does not expose startups in marketplace listings based on stage alone', async () => {
    const founder = await createStudent('Marketplace Founder');
    const viewer = await createStudent('Marketplace Viewer');

    await Startup.create({
      founderIds: [founder._id],
      name: 'Stage Only Startup',
      tagline: 'Looks launched but was never actually launched',
      category: 'AI',
      stage: 'Launched',
      activeProducts: 1,
      teamSize: 1,
      traction: {
        patentFiled: false,
        mvpBuilt: true,
        revenueGenerating: false,
      },
      launchedToInvestors: false,
      launchedToMentors: false,
      launchedToRecruiters: false,
      isActive: true,
    });

    const marketplaceResponse = await request(app)
      .get('/api/marketplace?role=startup')
      .set(authHeader(viewer));

    expect(marketplaceResponse.status).toBe(200);
    const startupNames = marketplaceResponse.body.data.map((startup: { name: string }) => startup.name);
    expect(startupNames).not.toContain('Stage Only Startup');
  });

  it('scopes startup marketplace visibility to the requester role launch target', async () => {
    const founder = await createStudent('Launch Target Founder');
    const investor = await createRoleUser(UserRole.INVESTOR, 'Marketplace Investor');
    const mentor = await createRoleUser(UserRole.MENTOR, 'Marketplace Mentor');
    const recruiter = await createRoleUser(UserRole.RECRUITER, 'Marketplace Recruiter');

    const investorStartup = await Startup.create({
      founderIds: [founder._id],
      name: 'Investor Only Startup',
      tagline: 'Visible only to investor discovery',
      category: 'AI',
      stage: 'Launched',
      activeProducts: 1,
      teamSize: 1,
      traction: {
        patentFiled: false,
        mvpBuilt: true,
        revenueGenerating: false,
      },
      reviewStatus: 'approved',
      launchedAt: new Date(),
      innovationScoreAtLaunch: 82,
      launchedToInvestors: true,
      launchedToMentors: false,
      launchedToRecruiters: false,
      isActive: true,
    });

    const mentorStartup = await Startup.create({
      founderIds: [founder._id],
      name: 'Mentor Only Startup',
      tagline: 'Visible only to mentorship discovery',
      category: 'Education',
      stage: 'Launched',
      activeProducts: 1,
      teamSize: 1,
      traction: {
        patentFiled: false,
        mvpBuilt: true,
        revenueGenerating: false,
      },
      reviewStatus: 'approved',
      launchedAt: new Date(),
      innovationScoreAtLaunch: 79,
      launchedToInvestors: false,
      launchedToMentors: true,
      launchedToRecruiters: false,
      isActive: true,
    });

    await Startup.create({
      founderIds: [founder._id],
      name: 'Recruiter Only Startup',
      tagline: 'Visible only to recruiter discovery',
      category: 'Software',
      stage: 'Launched',
      activeProducts: 1,
      teamSize: 1,
      traction: {
        patentFiled: false,
        mvpBuilt: true,
        revenueGenerating: false,
      },
      reviewStatus: 'approved',
      launchedAt: new Date(),
      innovationScoreAtLaunch: 77,
      launchedToInvestors: false,
      launchedToMentors: false,
      launchedToRecruiters: true,
      isActive: true,
    });

    const investorResponse = await request(app)
      .get('/api/marketplace?role=startup')
      .set(authHeader(investor));
    const mentorResponse = await request(app)
      .get('/api/marketplace?role=startup')
      .set(authHeader(mentor));
    const recruiterResponse = await request(app)
      .get('/api/marketplace?role=startup')
      .set(authHeader(recruiter));

    expect(investorResponse.status).toBe(200);
    expect(investorResponse.body.data.map((startup: { name: string }) => startup.name)).toEqual([
      'Investor Only Startup',
    ]);
    expect(mentorResponse.status).toBe(200);
    expect(mentorResponse.body.data.map((startup: { name: string }) => startup.name)).toEqual([
      'Mentor Only Startup',
    ]);
    expect(recruiterResponse.status).toBe(200);
    expect(recruiterResponse.body.data.map((startup: { name: string }) => startup.name)).toEqual([
      'Recruiter Only Startup',
    ]);

    const blockedDetailResponse = await request(app)
      .get(`/api/marketplace/entities/startup/${mentorStartup._id}`)
      .set(authHeader(investor));
    const allowedDetailResponse = await request(app)
      .get(`/api/marketplace/entities/startup/${investorStartup._id}`)
      .set(authHeader(investor));

    expect(blockedDetailResponse.status).toBe(404);
    expect(blockedDetailResponse.body.error.code).toBe('STARTUP_NOT_FOUND');
    expect(allowedDetailResponse.status).toBe(200);
    expect(allowedDetailResponse.body.data.name).toBe('Investor Only Startup');
  });

  it('blocks recruiter marketplace launch before admin startup approval', async () => {
    const founder = await createStudent('Recruiter Review Gate Founder');
    const workspace = await Workspace.create({
      ownerId: founder._id,
      teamMemberIds: [founder._id],
      title: 'Recruiter Review Gate Workspace',
      category: 'AI',
      stage: 'Launch',
      progressPercent: 100,
    });
    const startup = await createApprovedLaunchStartup(founder, workspace, {
      reviewStatus: 'draft',
    });

    const response = await request(app)
      .post(`/api/startup/${startup._id}/launch`)
      .set(authHeader(founder))
      .send({ launchTo: 'recruiters' });

    expect(response.status).toBe(403);
    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: 'STARTUP_REVIEW_REQUIRED',
      }),
    );
  });

  it('blocks investor launch until the linked workspace has an approved patent', async () => {
    const founder = await createStudent('Patent Gate Founder');
    const workspace = await Workspace.create({
      ownerId: founder._id,
      teamMemberIds: [founder._id],
      title: 'Patent Gate Workspace',
      category: 'AI',
      stage: 'Launch',
      progressPercent: 100,
      milestones: [
        { name: 'Research & Planning', isCompleted: true, completionPercent: 100 },
        { name: 'Design & Prototyping', isCompleted: true, completionPercent: 100 },
        { name: 'Development', isCompleted: true, completionPercent: 100 },
        { name: 'Testing & Validation', isCompleted: true, completionPercent: 100 },
        { name: 'Final Delivery', isCompleted: true, completionPercent: 100 },
      ],
    });
    const startup = await createApprovedLaunchStartup(founder, workspace);

    await Patent.create({
      studentId: founder._id,
      workspaceId: workspace._id,
      projectTitle: 'Pending Patent',
      questionnaire: completeRegistrationProfile,
      supportingDocuments: [],
      status: 'submitted',
      submittedAt: new Date(),
      scoreAwarded: false,
      showcasedInMarketplace: false,
    });

    const response = await request(app)
      .post(`/api/startup/${startup._id}/launch`)
      .set(authHeader(founder))
      .send({ launchTo: 'investors' });

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: 'PATENT_APPROVAL_REQUIRED',
      }),
    );
  });

  it('allows investor launch after project completion and patent approval', async () => {
    const founder = await createStudent('Investor Launch Founder');
    const workspace = await Workspace.create({
      ownerId: founder._id,
      teamMemberIds: [founder._id],
      title: 'Approved Launch Workspace',
      category: 'AI',
      stage: 'Launch',
      progressPercent: 100,
      milestones: [
        { name: 'Research & Planning', isCompleted: true, completionPercent: 100 },
        { name: 'Design & Prototyping', isCompleted: true, completionPercent: 100 },
        { name: 'Development', isCompleted: true, completionPercent: 100 },
        { name: 'Testing & Validation', isCompleted: true, completionPercent: 100 },
        { name: 'Final Delivery', isCompleted: true, completionPercent: 100 },
      ],
    });
    const startup = await createApprovedLaunchStartup(founder, workspace);
    await createApprovedPatent(founder, workspace);

    const response = await request(app)
      .post(`/api/startup/${startup._id}/launch`)
      .set(authHeader(founder))
      .send({ launchTo: 'investors' });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        _id: startup._id.toString(),
        launchedToInvestors: true,
        stage: 'Launched',
      }),
    );
  });

  it('preserves existing launch channels when adding a recruiter launch', async () => {
    const founder = await createStudent('Multi Channel Launch Founder');
    const workspace = await Workspace.create({
      ownerId: founder._id,
      teamMemberIds: [founder._id],
      title: 'Multi Channel Launch Workspace',
      category: 'AI',
      stage: 'Launch',
      progressPercent: 100,
      milestones: [
        { name: 'Research & Planning', isCompleted: true, completionPercent: 100 },
        { name: 'Design & Prototyping', isCompleted: true, completionPercent: 100 },
        { name: 'Development', isCompleted: true, completionPercent: 100 },
        { name: 'Testing & Validation', isCompleted: true, completionPercent: 100 },
        { name: 'Final Delivery', isCompleted: true, completionPercent: 100 },
      ],
    });
    const startup = await createApprovedLaunchStartup(founder, workspace);
    await createApprovedPatent(founder, workspace);

    const investorLaunchResponse = await request(app)
      .post(`/api/startup/${startup._id}/launch`)
      .set(authHeader(founder))
      .send({ launchTo: 'investors' });

    expect(investorLaunchResponse.status).toBe(200);
    expect(investorLaunchResponse.body.data.launchedToInvestors).toBe(true);

    const recruiterLaunchResponse = await request(app)
      .post(`/api/startup/${startup._id}/launch`)
      .set(authHeader(founder))
      .send({ launchTo: 'recruiters' });

    expect(recruiterLaunchResponse.status).toBe(200);
    expect(recruiterLaunchResponse.body.data).toEqual(
      expect.objectContaining({
        launchedToInvestors: true,
        launchedToRecruiters: true,
      }),
    );
  });

  it('blocks recruiter launch until the startup review is approved', async () => {
    const founder = await createStudent('Recruiter Launch Founder');
    const workspace = await Workspace.create({
      ownerId: founder._id,
      teamMemberIds: [founder._id],
      title: 'Recruiter Launch Workspace',
      category: 'AI',
      stage: 'Launch',
      progressPercent: 100,
    });

    const startup = await Startup.create({
      founderIds: [founder._id],
      projectId: workspace._id,
      name: 'Recruiter Pending Startup',
      tagline: 'Not yet admin approved',
      category: 'AI',
      stage: 'Pre-Launch',
      pitchDeckUrl: 'https://example.com/pitch.pdf',
      activeProducts: 1,
      teamSize: 1,
      traction: {
        patentFiled: false,
        mvpBuilt: true,
        revenueGenerating: false,
      },
      registrationProfile: completeRegistrationProfile,
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
      reviewStatus: 'draft',
      isActive: true,
    });

    const response = await request(app)
      .post(`/api/startup/${startup._id}/launch`)
      .set(authHeader(founder))
      .send({ launchTo: 'recruiters' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('STARTUP_REVIEW_REQUIRED');
  });

  it('does not expose recruiter-launched startups in marketplace without admin approval', async () => {
    const founder = await createStudent('Recruiter Marketplace Founder');
    const viewer = await createStudent('Recruiter Marketplace Viewer');

    await Startup.create({
      founderIds: [founder._id],
      name: 'Recruiter Draft Startup',
      tagline: 'Recruiter launch should not bypass admin review',
      category: 'AI',
      stage: 'Launched',
      activeProducts: 1,
      teamSize: 1,
      traction: {
        patentFiled: false,
        mvpBuilt: true,
        revenueGenerating: false,
      },
      launchedToRecruiters: true,
      reviewStatus: 'draft',
      isActive: true,
    });

    const marketplaceResponse = await request(app)
      .get('/api/marketplace?role=startup')
      .set(authHeader(viewer));

    expect(marketplaceResponse.status).toBe(200);
    const startupNames = marketplaceResponse.body.data.map((startup: { name: string }) => startup.name);
    expect(startupNames).not.toContain('Recruiter Draft Startup');
  });

  it('blocks investor launch when the latest patent submission was rejected until a corrected patent is approved', async () => {
    const founder = await createStudent('Rejected Patent Founder');
    const workspace = await Workspace.create({
      ownerId: founder._id,
      teamMemberIds: [founder._id],
      title: 'Rejected Patent Workspace',
      category: 'AI',
      stage: 'Launch',
      progressPercent: 100,
      milestones: [
        { name: 'Research & Planning', isCompleted: true, completionPercent: 100 },
        { name: 'Design & Prototyping', isCompleted: true, completionPercent: 100 },
        { name: 'Development', isCompleted: true, completionPercent: 100 },
        { name: 'Testing & Validation', isCompleted: true, completionPercent: 100 },
        { name: 'Final Delivery', isCompleted: true, completionPercent: 100 },
      ],
    });
    const startup = await createApprovedLaunchStartup(founder, workspace);

    await Patent.create({
      studentId: founder._id,
      workspaceId: workspace._id,
      projectTitle: 'Rejected Patent',
      questionnaire: completeRegistrationProfile,
      supportingDocuments: [],
      status: 'rejected',
      submittedAt: new Date(),
      adminReviewedAt: new Date(),
      adminReviewedBy: founder._id,
      adminNotes: 'Needs correction',
      scoreAwarded: false,
      showcasedInMarketplace: false,
    });

    const blockedResponse = await request(app)
      .post(`/api/startup/${startup._id}/launch`)
      .set(authHeader(founder))
      .send({ launchTo: 'investors' });

    expect(blockedResponse.status).toBe(400);
    expect(blockedResponse.body.error.code).toBe('PATENT_REJECTED');

    await Patent.create({
      studentId: founder._id,
      workspaceId: workspace._id,
      projectTitle: 'Corrected Patent',
      questionnaire: completeRegistrationProfile,
      supportingDocuments: [],
      status: 'approved',
      submittedAt: new Date(Date.now() + 1000),
      adminReviewedAt: new Date(),
      adminReviewedBy: founder._id,
      scoreAwarded: true,
      showcasedInMarketplace: false,
    });

    const approvedResponse = await request(app)
      .post(`/api/startup/${startup._id}/launch`)
      .set(authHeader(founder))
      .send({ launchTo: 'investors' });

    expect(approvedResponse.status).toBe(200);
    expect(approvedResponse.body.data.launchedToInvestors).toBe(true);
  });
});
