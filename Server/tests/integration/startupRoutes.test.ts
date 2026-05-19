import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
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
  coreInnovation: 'A governed launch workflow that keeps startup readiness independent from learning modules.',
  priorArtStatus: 'The team reviewed adjacent workflow products and found no identical launch model.',
  workingMechanism: 'The workflow validates startup profile, pitch readiness, admin review, and marketplace launch.',
  keyComponents: 'Startup profile, founder context, pitch deck, admin review, and investor marketplace.',
  developmentStage: 'idea',
  documentationReadiness: 'Required launch documentation is available for admin review.',
  inventorOwnership: 'team',
  developmentContext: 'The innovation was developed in a student-led startup preparation flow.',
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
  workspace?: WorkspaceWithId,
  overrides: Partial<Record<string, unknown>> = {},
) =>
  Startup.create({
    founderIds: [founder._id],
    ...(workspace ? { projectId: workspace._id } : {}),
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

const rubricText =
  'This response is intentionally long enough to satisfy the rubric evidence threshold.';

const startupDocument = (
  founder: CreatedStudent,
  category: string,
  fileName = `${category}.pdf`,
) => ({
  category,
  fileUrl: `https://example.com/${fileName}`,
  fileType: 'pdf',
  fileName,
  fileSizeBytes: 1024,
  uploadedAt: new Date(),
  uploadedBy: founder._id,
});

const createRubricStartup = async (
  founder: CreatedStudent,
  overrides: Partial<Record<string, any>> = {},
) => {
  const baseCompanyProfile = {
    legalStructure: 'private_limited',
    cinNumber: 'U12345KA2026PTC000001',
    dpiitRecognitionNumber: 'DPIIT-2026-12345',
    msmeUdyamNumber: 'UDYAM-KA-00-1234567',
    otherGovernmentCertificationName: 'State Startup Mission',
    otherGovernmentCertificationNumber: 'SSM-7788',
    websiteUrl: 'https://startup.example.com',
    productDemoUrl: 'https://demo.example.com',
    portfolioUrl: 'https://portfolio.example.com',
  };
  const baseTractionProfile = {
    startupStage: 'revenue_generating',
    problemClarity: rubricText,
    uniqueSolution: rubricText,
    marketDifferentiation: rubricText,
    patentStatus: 'published',
    hasItrFiling: true,
    hasRevenueProof: true,
    hasGovernmentGrant: true,
    hasAwardRecognition: true,
    fundingStatus: 'vc',
    activeUsersCustomers: 850,
    monthlyGrowthRate: 24,
    retentionRate: 68,
  };
  const innovationProfile = {
    rubricVersion: 'startup_innovation_1000',
    ...(overrides.innovationProfile ?? {}),
    companyProfile: {
      ...baseCompanyProfile,
      ...(overrides.innovationProfile?.companyProfile ?? {}),
    },
    tractionProfile: {
      ...baseTractionProfile,
      ...(overrides.innovationProfile?.tractionProfile ?? {}),
    },
  };

  const { innovationProfile: _ignoredInnovationProfile, ...startupOverrides } = overrides;

  return Startup.create({
    founderIds: [founder._id],
    name: 'Rubric Edge Startup',
    tagline: 'A startup for rubric edge case validation',
    category: 'DeepTech',
    stage: 'Pre-Launch',
    activeProducts: 1,
    teamSize: 1,
    innovationProfile,
    reviewStatus: 'draft',
    isActive: true,
    ...startupOverrides,
  });
};

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

  it('calculates the full 1000-point rubric score for a fully evidenced startup launch', async () => {
    const founder = await createStudent('Rubric Score Founder');

    const startup = await Startup.create({
      founderIds: [founder._id],
      name: 'Rubric Score Startup',
      tagline: 'A fully evidenced startup innovation submission',
      category: 'DeepTech',
      stage: 'Pre-Launch',
      pitchDeckUrl: 'https://example.com/pitch-deck.pptx',
      pitchDeckName: 'pitch-deck.pptx',
      activeProducts: 2,
      teamSize: 4,
      innovationProfile: {
        rubricVersion: 'startup_innovation_1000',
        companyProfile: {
          legalStructure: 'private_limited',
          cinNumber: 'U12345KA2026PTC000001',
          dpiitRecognitionNumber: 'DPIIT-2026-12345',
          msmeUdyamNumber: 'UDYAM-KA-00-1234567',
          otherGovernmentCertificationName: 'State Startup Mission',
          otherGovernmentCertificationNumber: 'SSM-7788',
          websiteUrl: 'https://startup.example.com',
          productDemoUrl: 'https://demo.example.com',
          portfolioUrl: 'https://portfolio.example.com',
        },
        tractionProfile: {
          startupStage: 'revenue_generating',
          problemClarity:
            'The startup addresses fragmented operational workflows for fast-growing campus ventures.',
          uniqueSolution:
            'It unifies compliance, traction evidence, and startup launch scoring in one product workflow.',
          marketDifferentiation:
            'The product differentiates through a score-linked evidence model built for startup review and launch readiness.',
          patentStatus: 'published',
          hasItrFiling: true,
          hasRevenueProof: true,
          hasGovernmentGrant: true,
          hasAwardRecognition: true,
          fundingStatus: 'vc',
          activeUsersCustomers: 850,
          monthlyGrowthRate: 24,
          retentionRate: 68,
        },
      },
      documents: [
        {
          category: 'incorporation_certificate',
          fileUrl: 'https://example.com/incorporation.pdf',
          fileType: 'pdf',
          fileName: 'incorporation.pdf',
          fileSizeBytes: 1024,
          uploadedAt: new Date(),
          uploadedBy: founder._id,
        },
        {
          category: 'dpiit_certificate',
          fileUrl: 'https://example.com/dpiit.pdf',
          fileType: 'pdf',
          fileName: 'dpiit.pdf',
          fileSizeBytes: 1024,
          uploadedAt: new Date(),
          uploadedBy: founder._id,
        },
        {
          category: 'udyam_certificate',
          fileUrl: 'https://example.com/udyam.pdf',
          fileType: 'pdf',
          fileName: 'udyam.pdf',
          fileSizeBytes: 1024,
          uploadedAt: new Date(),
          uploadedBy: founder._id,
        },
        {
          category: 'government_certificate_other',
          fileUrl: 'https://example.com/state.pdf',
          fileType: 'pdf',
          fileName: 'state.pdf',
          fileSizeBytes: 1024,
          uploadedAt: new Date(),
          uploadedBy: founder._id,
        },
        {
          category: 'patent_proof',
          fileUrl: 'https://example.com/patent.pdf',
          fileType: 'pdf',
          fileName: 'patent.pdf',
          fileSizeBytes: 1024,
          uploadedAt: new Date(),
          uploadedBy: founder._id,
        },
        {
          category: 'itr_filing',
          fileUrl: 'https://example.com/itr.pdf',
          fileType: 'pdf',
          fileName: 'itr.pdf',
          fileSizeBytes: 1024,
          uploadedAt: new Date(),
          uploadedBy: founder._id,
        },
        {
          category: 'revenue_proof',
          fileUrl: 'https://example.com/revenue.pdf',
          fileType: 'pdf',
          fileName: 'revenue.pdf',
          fileSizeBytes: 1024,
          uploadedAt: new Date(),
          uploadedBy: founder._id,
        },
        {
          category: 'grant_certificate',
          fileUrl: 'https://example.com/grant.pdf',
          fileType: 'pdf',
          fileName: 'grant.pdf',
          fileSizeBytes: 1024,
          uploadedAt: new Date(),
          uploadedBy: founder._id,
        },
        {
          category: 'award_certificate',
          fileUrl: 'https://example.com/award.pdf',
          fileType: 'pdf',
          fileName: 'award.pdf',
          fileSizeBytes: 1024,
          uploadedAt: new Date(),
          uploadedBy: founder._id,
        },
        {
          category: 'funding_proof',
          fileUrl: 'https://example.com/funding.pdf',
          fileType: 'pdf',
          fileName: 'funding.pdf',
          fileSizeBytes: 1024,
          uploadedAt: new Date(),
          uploadedBy: founder._id,
        },
      ],
      reviewStatus: 'approved',
      isActive: true,
    });

    const response = await request(app)
      .post(`/api/startup/${startup._id}/launch`)
      .set(authHeader(founder))
      .send({ launchTo: 'investors', termsAccepted: true });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        launchedToInvestors: true,
        innovationScoreAtLaunch: 1000,
      }),
    );
  });

  it('keeps proof-gated rubric claims at zero when evidence uploads are missing', async () => {
    const founder = await createStudent('Missing Proof Founder');
    const startup = await createRubricStartup(founder, {
      pitchDeckUrl: 'https://example.com/pitch.pdf',
      documents: [],
    });

    const response = await request(app)
      .get(`/api/startup/${startup._id}`)
      .set(authHeader(founder));

    expect(response.status).toBe(200);
    expect(response.body.data.innovationScorePreview.companyProfile).toEqual(
      expect.objectContaining({
        legalStructure: 50,
        cinNumber: 0,
        governmentRecognition: 0,
      }),
    );
    expect(response.body.data.innovationScorePreview.healthAndTraction).toEqual(
      expect.objectContaining({
        patentStrength: 0,
        patentFiled: 0,
        patentPublished: 0,
        revenueValidation: 0,
        grantsAndRecognition: 0,
        fundingStatus: 0,
      }),
    );
  });

  it('caps government recognition at 100 and accepts Startup India as other government proof', async () => {
    const founder = await createStudent('Government Cap Founder');
    const startup = await createRubricStartup(founder, {
      pitchDeckUrl: 'https://example.com/pitch.pdf',
      documents: [
        startupDocument(founder, 'dpiit_certificate'),
        startupDocument(founder, 'udyam_certificate'),
        startupDocument(founder, 'government_certificate_other'),
        startupDocument(founder, 'startup_india_certificate'),
      ],
    });

    const response = await request(app)
      .get(`/api/startup/${startup._id}`)
      .set(authHeader(founder));

    expect(response.status).toBe(200);
    expect(response.body.data.innovationScorePreview.companyProfile.governmentRecognition).toBe(100);
  });

  it('scores patent filed and patent published as separate capped sub-scores', async () => {
    const founder = await createStudent('Patent Score Founder');
    const filedStartup = await createRubricStartup(founder, {
      innovationProfile: {
        tractionProfile: {
          patentStatus: 'filed',
        },
      },
      documents: [startupDocument(founder, 'patent_proof')],
    });
    const publishedStartup = await createRubricStartup(founder, {
      innovationProfile: {
        tractionProfile: {
          patentStatus: 'published',
        },
      },
      documents: [startupDocument(founder, 'patent_proof')],
    });

    const filedResponse = await request(app)
      .get(`/api/startup/${filedStartup._id}`)
      .set(authHeader(founder));
    const publishedResponse = await request(app)
      .get(`/api/startup/${publishedStartup._id}`)
      .set(authHeader(founder));

    expect(filedResponse.status).toBe(200);
    expect(filedResponse.body.data.innovationScorePreview.healthAndTraction).toEqual(
      expect.objectContaining({
        patentFiled: 40,
        patentPublished: 0,
        patentStrength: 40,
      }),
    );
    expect(publishedResponse.status).toBe(200);
    expect(publishedResponse.body.data.innovationScorePreview.healthAndTraction).toEqual(
      expect.objectContaining({
        patentFiled: 40,
        patentPublished: 80,
        patentStrength: 120,
      }),
    );
  });

  it('requires proof for Angel/Seed and VC funding while bootstrapped scores without proof', async () => {
    const founder = await createStudent('Funding Score Founder');
    const angelWithoutProof = await createRubricStartup(founder, {
      innovationProfile: {
        tractionProfile: {
          fundingStatus: 'angel_seed',
        },
      },
      documents: [],
    });
    const angelWithProof = await createRubricStartup(founder, {
      innovationProfile: {
        tractionProfile: {
          fundingStatus: 'angel_seed',
        },
      },
      documents: [startupDocument(founder, 'funding_proof')],
    });
    const vcWithProof = await createRubricStartup(founder, {
      innovationProfile: {
        tractionProfile: {
          fundingStatus: 'vc',
        },
      },
      documents: [startupDocument(founder, 'funding_proof')],
    });
    const bootstrapped = await createRubricStartup(founder, {
      innovationProfile: {
        tractionProfile: {
          fundingStatus: 'bootstrapped',
        },
      },
      documents: [],
    });

    const [angelMissingResponse, angelResponse, vcResponse, bootstrappedResponse] =
      await Promise.all([
        request(app).get(`/api/startup/${angelWithoutProof._id}`).set(authHeader(founder)),
        request(app).get(`/api/startup/${angelWithProof._id}`).set(authHeader(founder)),
        request(app).get(`/api/startup/${vcWithProof._id}`).set(authHeader(founder)),
        request(app).get(`/api/startup/${bootstrapped._id}`).set(authHeader(founder)),
      ]);

    expect(angelMissingResponse.status).toBe(200);
    expect(angelMissingResponse.body.data.innovationScorePreview.healthAndTraction.fundingStatus).toBe(0);
    expect(angelResponse.status).toBe(200);
    expect(angelResponse.body.data.innovationScorePreview.healthAndTraction.fundingStatus).toBe(40);
    expect(vcResponse.status).toBe(200);
    expect(vcResponse.body.data.innovationScorePreview.healthAndTraction.fundingStatus).toBe(60);
    expect(bootstrappedResponse.status).toBe(200);
    expect(bootstrappedResponse.body.data.innovationScorePreview.healthAndTraction.fundingStatus).toBe(20);
  });

  it('rejects oversized startup pitch decks and proof documents', async () => {
    const founder = await createStudent('Oversized Upload Founder');
    const startup = await createRubricStartup(founder);

    const oversizedPitchResponse = await request(app)
      .post(`/api/startup/${startup._id}/upload-pitch`)
      .set(authHeader(founder))
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), {
        filename: 'pitch.pdf',
        contentType: 'application/pdf',
      });

    const oversizedDocumentResponse = await request(app)
      .post(`/api/startup/${startup._id}/documents`)
      .set(authHeader(founder))
      .field('category', 'revenue_proof')
      .attach('file', Buffer.alloc(3 * 1024 * 1024 + 1), {
        filename: 'revenue.pdf',
        contentType: 'application/pdf',
      });

    expect(oversizedPitchResponse.status).toBe(400);
    expect(oversizedPitchResponse.body.error).toEqual(
      expect.objectContaining({
        code: 'UPLOAD_ERROR',
        message: 'File exceeds the configured upload size limit',
      }),
    );
    expect(oversizedDocumentResponse.status).toBe(400);
    expect(oversizedDocumentResponse.body.error).toEqual(
      expect.objectContaining({
        code: 'UPLOAD_ERROR',
        message: 'File exceeds the configured upload size limit',
      }),
    );
  });

  it('rejects empty startup pitch decks and proof documents', async () => {
    const founder = await createStudent('Empty Upload Founder');
    const startup = await createRubricStartup(founder);

    const emptyPitchResponse = await request(app)
      .post(`/api/startup/${startup._id}/upload-pitch`)
      .set(authHeader(founder))
      .attach('file', Buffer.alloc(0), {
        filename: 'pitch.pdf',
        contentType: 'application/pdf',
      });

    const emptyDocumentResponse = await request(app)
      .post(`/api/startup/${startup._id}/documents`)
      .set(authHeader(founder))
      .field('category', 'revenue_proof')
      .attach('file', Buffer.alloc(0), {
        filename: 'revenue.pdf',
        contentType: 'application/pdf',
      });

    expect(emptyPitchResponse.status).toBe(400);
    expect(emptyPitchResponse.body.error).toEqual(
      expect.objectContaining({
        code: 'EMPTY_FILE',
        message: 'Pitch deck file cannot be empty',
      }),
    );
    expect(emptyDocumentResponse.status).toBe(400);
    expect(emptyDocumentResponse.body.error).toEqual(
      expect.objectContaining({
        code: 'EMPTY_FILE',
        message: 'Document file cannot be empty',
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
      .send({ launchTo: 'recruiters', termsAccepted: true });

    expect(response.status).toBe(403);
    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: 'STARTUP_REVIEW_REQUIRED',
      }),
    );
  });

  it('allows investor launch for an approved startup without workspace or patent coupling', async () => {
    const founder = await createStudent('Investor Launch Founder');
    const startup = await createApprovedLaunchStartup(founder);

    const response = await request(app)
      .post(`/api/startup/${startup._id}/launch`)
      .set(authHeader(founder))
      .send({ launchTo: 'investors', termsAccepted: true });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        _id: startup._id.toString(),
        launchedToInvestors: true,
        stage: 'Launched',
        marketplaceTermsVersion: 'marketplace-launch-v1',
      }),
    );
    expect(response.body.data.marketplaceTermsAcceptedAt).toEqual(expect.any(String));
    expect(response.body.data.marketplaceTermsAcceptedBy).toBe(founder._id.toString());
  });

  it('requires marketplace terms acceptance before startup launch', async () => {
    const founder = await createStudent('Launch Terms Founder');
    const startup = await createApprovedLaunchStartup(founder);

    const response = await request(app)
      .post(`/api/startup/${startup._id}/launch`)
      .set(authHeader(founder))
      .send({ launchTo: 'investors' });

    expect(response.status).toBe(400);
    const persisted = await Startup.findById(startup._id).lean();
    expect(persisted?.launchedToInvestors).toBe(false);
    expect(persisted?.marketplaceTermsAcceptedAt).toBeUndefined();
  });

  it('blocks founder deletion after marketplace launch and keeps the startup active', async () => {
    const founder = await createStudent('Launched Delete Founder');
    const startup = await createApprovedLaunchStartup(founder);

    const launchResponse = await request(app)
      .post(`/api/startup/${startup._id}/launch`)
      .set(authHeader(founder))
      .send({ launchTo: 'investors', termsAccepted: true });

    expect(launchResponse.status).toBe(200);

    const deleteResponse = await request(app)
      .delete(`/api/startup/${startup._id}`)
      .set(authHeader(founder));

    expect(deleteResponse.status).toBe(400);
    expect(deleteResponse.body.error).toEqual(
      expect.objectContaining({
        code: 'STARTUP_LAUNCHED_DELETION_REQUIRES_ADMIN',
      }),
    );
    const persisted = await Startup.findById(startup._id).lean();
    expect(persisted?.isActive).toBe(true);
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

    const investorLaunchResponse = await request(app)
      .post(`/api/startup/${startup._id}/launch`)
      .set(authHeader(founder))
      .send({ launchTo: 'investors', termsAccepted: true });

    expect(investorLaunchResponse.status).toBe(200);
    expect(investorLaunchResponse.body.data.launchedToInvestors).toBe(true);

    const recruiterLaunchResponse = await request(app)
      .post(`/api/startup/${startup._id}/launch`)
      .set(authHeader(founder))
      .send({ launchTo: 'recruiters', termsAccepted: true });

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
      .send({ launchTo: 'recruiters', termsAccepted: true });

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

});
