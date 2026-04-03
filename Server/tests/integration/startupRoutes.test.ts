import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
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
});
