import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { ScoreEvent } from '../../src/modules/innovationScore/score.model';
import { Patent } from '../../src/modules/patent/patent.model';
import { RelevanceBridge } from '../../src/modules/recruiter/relevanceBridge.model';
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

const createUser = async (role: UserRole, displayName: string, overrides: Partial<Record<string, unknown>> = {}) =>
  User.create({
    email: `${role}-${Math.random().toString(36).slice(2, 10)}@example.com`,
    passwordHash: 'hashed-password',
    role,
    displayName,
    accessGrantedBy: 'self_registered',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    innovationScore: 72,
    profileComplete: true,
    registrationStage: 'profile_setup',
    verificationStatus: 'verified',
    adminApprovalStatus: 'not_required',
    ...overrides,
  });

describe('marketplace access control', () => {
  it('limits recruiter visibility to public student profiles and unlocks sensitive talent detail only after a bridge exists', async () => {
    const recruiter = await createUser(UserRole.RECRUITER, 'Talent Recruiter');
    const publicStudent = await createUser(UserRole.STUDENT, 'Public Candidate', {
      discoverableToRecruiters: true,
    });
    const privateStudent = await createUser(UserRole.STUDENT, 'Private Candidate');

    const workspace = await Workspace.create({
      ownerId: publicStudent._id,
      teamMemberIds: [publicStudent._id],
      title: 'Vision Workspace',
      category: 'AI',
      stage: 'Build',
      progressPercent: 68,
    });

    await Patent.create({
      studentId: publicStudent._id,
      workspaceId: workspace._id,
      projectTitle: 'Vision Patent',
      questionnaire: {
        problemStatement: 'Sensitive patent problem statement',
        solutionDifferentiation: 'Differentiated workflow',
        coreInnovation: 'Computer vision stack',
        priorArtStatus: 'Reviewed',
        workingMechanism: 'Pipeline',
        keyComponents: 'Capture and inference',
        developmentStage: 'mvp',
        documentationReadiness: 'Ready',
        inventorOwnership: 'team',
        developmentContext: 'Workspace',
        targetMarkets: 'Industrial safety',
        commercializationStrategy: 'build_startup',
        publicDisclosureStatus: 'No disclosure',
        legalAgreements: 'Signed',
        ipProtectionType: 'patent',
      },
      supportingDocuments: [],
      status: 'approved',
      submittedAt: new Date(),
      scoreAwarded: true,
    });

    await ScoreEvent.create({
      userId: publicStudent._id,
      trigger: 'workspace_progress',
      delta: 12,
      scoreAfter: 84,
    });

    const marketplaceResponse = await request(app)
      .get('/api/marketplace?role=student')
      .set(authHeader(recruiter));

    expect(marketplaceResponse.status).toBe(200);
    expect(marketplaceResponse.body.data.map((item: { displayName: string }) => item.displayName)).toEqual([
      'Public Candidate',
    ]);

    const limitedProfileResponse = await request(app)
      .get(`/api/recruiter/talent/${publicStudent._id}`)
      .set(authHeader(recruiter));

    expect(limitedProfileResponse.status).toBe(200);
    expect(limitedProfileResponse.body.data.scoreTimeline).toEqual([]);
    expect(limitedProfileResponse.body.data.workspaces).toEqual([]);
    expect(limitedProfileResponse.body.data.patents[0]).toEqual(
      expect.objectContaining({
        projectTitle: 'Vision Patent',
      }),
    );
    expect(limitedProfileResponse.body.data.patents[0].problemStatement).toBeUndefined();

    await RelevanceBridge.create({
      recruiterId: recruiter._id,
      studentId: publicStudent._id,
      bridgeType: 'HR_SHORTLIST',
      isActive: true,
    });

    const expandedProfileResponse = await request(app)
      .get(`/api/recruiter/talent/${publicStudent._id}`)
      .set(authHeader(recruiter));

    expect(expandedProfileResponse.status).toBe(200);
    expect(expandedProfileResponse.body.data.scoreTimeline).toHaveLength(1);
    expect(expandedProfileResponse.body.data.workspaces).toHaveLength(1);
    expect(expandedProfileResponse.body.data.patents[0].problemStatement).toBe('Sensitive patent problem statement');

    const privateProfileResponse = await request(app)
      .get(`/api/recruiter/talent/${privateStudent._id}`)
      .set(authHeader(recruiter));

    expect(privateProfileResponse.status).toBe(403);
    expect(privateProfileResponse.body.error.code).toBe('RECRUITER_PROFILE_FORBIDDEN');
  });

  it('enforces first-contact dm permissions for recruiter and investor flows', async () => {
    const recruiter = await createUser(UserRole.RECRUITER, 'Outbound Recruiter');
    const discoverableStudent = await createUser(UserRole.STUDENT, 'Discoverable Student', {
      discoverableToRecruiters: true,
    });
    const hiddenStudent = await createUser(UserRole.STUDENT, 'Hidden Student');
    const investor = await createUser(UserRole.INVESTOR, 'Direct Investor');
    const founder = await createUser(UserRole.STUDENT, 'Fundable Founder');
    const teammateSeeker = await createUser(UserRole.STUDENT, 'Teammate Seeker');
    const teammateCandidate = await createUser(UserRole.STUDENT, 'Teammate Candidate');

    const hiddenSearchResponse = await request(app)
      .get('/api/users/search')
      .query({ q: 'Hidden Student' })
      .set(authHeader(recruiter));

    expect(hiddenSearchResponse.status).toBe(200);
    expect(hiddenSearchResponse.body.data).toEqual([]);

    const discoverableSearchResponse = await request(app)
      .get('/api/users/search')
      .query({ q: 'Discoverable Student' })
      .set(authHeader(recruiter));

    expect(discoverableSearchResponse.status).toBe(200);
    expect(discoverableSearchResponse.body.data).toEqual([
      expect.objectContaining({
        displayName: 'Discoverable Student',
      }),
    ]);

    const blockedRecruiterDm = await request(app)
      .post(`/api/dm/${hiddenStudent._id}`)
      .set(authHeader(recruiter))
      .send({
        message: 'This should be blocked',
        messageType: 'text',
      });

    expect(blockedRecruiterDm.status).toBe(403);
    expect(blockedRecruiterDm.body.error.code).toBe('DM_PERMISSION_DENIED');

    const allowedRecruiterDm = await request(app)
      .post(`/api/dm/${discoverableStudent._id}`)
      .set(authHeader(recruiter))
      .send({
        message: 'Recruitment outreach',
        messageType: 'text',
      });

    expect(allowedRecruiterDm.status).toBe(201);

    const generalStudentDm = await request(app)
      .post(`/api/dm/${teammateCandidate._id}`)
      .set(authHeader(teammateSeeker))
      .send({
        message: 'Plain hello should not open a teammate thread',
        messageType: 'text',
      });

    expect(generalStudentDm.status).toBe(403);
    expect(generalStudentDm.body.error.code).toBe('DM_PERMISSION_DENIED');

    const teammateDm = await request(app)
      .post(`/api/dm/${teammateCandidate._id}`)
      .set(authHeader(teammateSeeker))
      .send({
        message: 'I am building a startup and looking for a teammate for product and research.',
        messageType: 'text',
        queryType: 'project_join',
      });

    expect(teammateDm.status).toBe(201);

    const startup = await Startup.create({
      founderIds: [founder._id],
      name: 'Investor Discovery Startup',
      tagline: 'Open for investor review',
      category: 'FinTech',
      stage: 'Launched',
      launchedToInvestors: true,
      reviewStatus: 'approved',
      innovationScoreAtLaunch: 80,
      activeProducts: 1,
      teamSize: 1,
      traction: {
        patentFiled: false,
        mvpBuilt: true,
        revenueGenerating: false,
      },
    });

    const blockedInvestorDm = await request(app)
      .post(`/api/dm/${founder._id}`)
      .set(authHeader(investor))
      .send({
        message: 'Skipping the investment workflow',
        messageType: 'text',
      });

    expect(blockedInvestorDm.status).toBe(403);
    expect(blockedInvestorDm.body.error.code).toBe('DM_PERMISSION_DENIED');

    const expressInterestResponse = await request(app)
      .post(`/api/investor/express-interest/${startup._id}`)
      .set(authHeader(investor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 25000,
        proposedEquityPercent: 2,
        chosenRole: 'shareholder',
      });

    expect(expressInterestResponse.status).toBe(201);

    const allowedInvestorDm = await request(app)
      .post(`/api/dm/${founder._id}`)
      .set(authHeader(investor))
      .send({
        message: 'Following up on the submitted proposal',
        messageType: 'text',
      });

    expect(allowedInvestorDm.status).toBe(201);
  });

  it('hides internal startup data from recruiter marketplace detail while keeping mentor-facing progress visible', async () => {
    const recruiter = await createUser(UserRole.RECRUITER, 'Marketplace Recruiter');
    const mentor = await createUser(UserRole.MENTOR, 'Marketplace Mentor');
    const founder = await createUser(UserRole.STUDENT, 'Marketplace Founder');

    const workspace = await Workspace.create({
      ownerId: founder._id,
      teamMemberIds: [founder._id],
      title: 'Mentorship Workspace',
      category: 'Robotics',
      stage: 'Launch',
      progressPercent: 91,
      milestones: [
        { name: 'Research & Planning', isCompleted: true, completionPercent: 100 },
      ],
      tasks: [{ title: 'Review GTM', done: false }],
      uploads: [{ fileUrl: 'https://example.com/mockup.png', fileType: 'image', fileName: 'mockup.png', fileSizeBytes: 128, uploadedBy: founder._id }],
      repoSubmissions: [{ provider: 'github', repoUrl: 'https://github.com/example/repo', displayName: 'repo', uploadedBy: founder._id }],
      progressUpdates: [{ submittedBy: founder._id, note: 'Pilot customers lined up.' }],
    });

    const startup = await Startup.create({
      founderIds: [founder._id],
      projectId: workspace._id,
      name: 'Mentor Visible Startup',
      tagline: 'Built for mentoring and hiring reviews',
      category: 'Robotics',
      stage: 'Launched',
      pitchDeckUrl: 'https://promove-test-bucket.s3.ap-south-1.amazonaws.com/promove/startups/mentor-visible.pdf',
      pitchDeckStorageProvider: 's3',
      pitchDeckStorageKey: 'promove/startups/mentor-visible.pdf',
      launchedToMentors: true,
      launchedToRecruiters: true,
      reviewStatus: 'approved',
      innovationScoreAtLaunch: 91,
      activeProducts: 2,
      teamSize: 1,
      businessProfile: {
        problemStatement: 'Schools need safer lab automation review workflows.',
        solutionSummary: 'A robotics review assistant audits lab setups before live demos.',
        targetCustomers: 'Institution innovation labs and robotics clubs.',
        marketAnalysis: 'Campus labs need lightweight safety checks before competitions.',
        revenueModel: 'Annual lab subscription with paid deployment support.',
        goToMarketPlan: 'Start with partner institutions and convert mentor-led pilots.',
      },
      initializationProfile: {
        vision: 'Make robotics lab validation easy for student teams.',
        mission: 'Give mentors a faster way to review prototypes before launch.',
        productOverview: 'A workspace-linked review layer for robotics prototypes.',
        currentTraction: 'Pilot customers lined up.',
        upcomingMilestones: 'Complete the first institution pilot and publish results.',
        fundingAsk: 'Seeking seed support for pilot hardware kits.',
      },
      innovationProfile: {
        tractionProfile: {
          startupStage: 'mvp_ready',
          problemClarity: 'Student teams need clear safety review gates before public demos.',
          uniqueSolution: 'The product links workspace progress with mentor-reviewed lab checks.',
          marketDifferentiation: 'It combines project workflow, mentorship and compliance evidence.',
          patentStatus: 'filed',
          fundingStatus: 'bootstrapped',
          hasRevenueProof: true,
        },
      },
      totalShares: 1000,
      availableShares: 760,
      reservedForSole: 510,
      maxPennyInvestors: 10,
      currentPennyCount: 2,
      traction: {
        patentFiled: false,
        mvpBuilt: true,
        revenueGenerating: false,
      },
    });

    const recruiterDetailResponse = await request(app)
      .get(`/api/marketplace/entities/startup/${startup._id}`)
      .set(authHeader(recruiter));
    const mentorDetailResponse = await request(app)
      .get(`/api/marketplace/entities/startup/${startup._id}`)
      .set(authHeader(mentor));

    expect(recruiterDetailResponse.status).toBe(200);
    expect(recruiterDetailResponse.body.data.project).toBeUndefined();
    expect(recruiterDetailResponse.body.data.sharePool).toBeUndefined();
    expect(recruiterDetailResponse.body.data.pitchDeckUrl).toContain('X-Amz-Signature=');
    expect(recruiterDetailResponse.body.data.publicDetails.business).toEqual(
      expect.objectContaining({
        problemStatement: 'Schools need safer lab automation review workflows.',
        solutionSummary: 'A robotics review assistant audits lab setups before live demos.',
      }),
    );

    expect(mentorDetailResponse.status).toBe(200);
    expect(mentorDetailResponse.body.data.project).toEqual(
      expect.objectContaining({
        title: 'Mentorship Workspace',
        progressPercent: 91,
      }),
    );
    expect(mentorDetailResponse.body.data.sharePool).toBeUndefined();
    expect(mentorDetailResponse.body.data.publicDetails.launch).toEqual(
      expect.objectContaining({
        currentTraction: 'Pilot customers lined up.',
        fundingAsk: 'Seeking seed support for pilot hardware kits.',
      }),
    );
    expect(mentorDetailResponse.body.data.publicDetails.innovation).toEqual(
      expect.objectContaining({
        fundingStatus: 'bootstrapped',
        patentStatus: 'filed',
      }),
    );
  });

  it('shows teammate discovery in the student marketplace', async () => {
    const studentViewer = await createUser(UserRole.STUDENT, 'Marketplace Viewer');
    await createUser(UserRole.STUDENT, 'Prototype Researcher', {
      headline: 'Researcher focused on startup validation',
      domain: 'DeepTech',
    });

    const teammateResponse = await request(app)
      .get('/api/marketplace?role=student')
      .set(authHeader(studentViewer));

    expect(teammateResponse.status).toBe(200);
    expect(
      teammateResponse.body.data.some(
        (item: { displayName: string }) => item.displayName === 'Prototype Researcher',
      ),
    ).toBe(true);
  });
});
