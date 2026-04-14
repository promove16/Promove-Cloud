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

const createUser = async (role: UserRole, overrides: Partial<Record<string, unknown>> = {}) =>
  User.create({
    email: `${role}-${Math.random().toString(36).slice(2, 10)}@example.com`,
    passwordHash: 'hashed-password',
    role,
    displayName: `${role} user`,
    accessGrantedBy: 'self_registered',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    innovationScore: 88,
    ...overrides,
  });

const createStartup = async (
  founderId: string,
  overrides: Partial<Record<string, unknown>> = {},
) =>
  Startup.create({
    founderIds: [founderId],
    name: 'Orbit Labs',
    tagline: 'Autonomous logistics for Indian cities',
    category: 'Software',
    stage: 'Launched',
    launchedToInvestors: true,
    reviewStatus: 'approved',
    innovationScoreAtLaunch: 88,
    traction: {
      patentFiled: false,
      mvpBuilt: true,
      revenueGenerating: false,
    },
    ...overrides,
  });

const agreeToCurrentTerms = async ({
  dealId,
  participant,
}: {
  dealId: string;
  participant: { _id: { toString(): string }; email: string; role: UserRole };
}) => {
  const response = await request(app)
    .post(`/api/deals/${dealId}/negotiation-agree`)
    .set(authHeader(participant));
  expect(response.status).toBe(200);
};

const moveToDueDiligence = async ({
  dealId,
  investor,
}: {
  dealId: string;
  investor: { _id: { toString(): string }; email: string; role: UserRole };
}) => {
  const response = await request(app)
    .patch(`/api/investor/deals/${dealId}/stage`)
    .set(authHeader(investor))
    .send({ newStage: 1 });
  expect(response.status).toBe(200);
};

const approveDealThroughAdmin = async ({
  founder,
  investor,
  admin,
  dealId,
  amountINR,
  equityPercent,
  investorRole,
}: {
  founder: { _id: { toString(): string }; email: string; role: UserRole };
  investor: { _id: { toString(): string }; email: string; role: UserRole };
  admin: { _id: { toString(): string }; email: string; role: UserRole };
  dealId: string;
  amountINR: number;
  equityPercent: number;
  investorRole: 'shareholder' | 'director' | 'observer';
}) => {
  await agreeToCurrentTerms({ dealId, participant: founder });
  await moveToDueDiligence({ dealId, investor });

  const founderAcceptResponse = await request(app)
    .patch(`/api/deals/${dealId}/founder-decision`)
    .set(authHeader(founder))
    .send({ decision: 'accepted' });
  expect(founderAcceptResponse.status).toBe(200);

  const stageTwoResponse = await request(app)
    .patch(`/api/investor/deals/${dealId}/stage`)
    .set(authHeader(investor))
    .send({
      newStage: 2,
      stageData: { amountINR },
    });
  expect(stageTwoResponse.status).toBe(200);

  const stageThreeResponse = await request(app)
    .patch(`/api/investor/deals/${dealId}/stage`)
    .set(authHeader(investor))
    .send({
      newStage: 3,
      stageData: { equityPercent, investorRole },
    });
  expect(stageThreeResponse.status).toBe(200);

  const approveResponse = await request(app)
    .patch(`/api/admin/deals/${dealId}/approve-stage`)
    .set(authHeader(admin));
  expect(approveResponse.status).toBe(200);
};

describe('investment workflow integration', () => {
  it('lists admin deals from the admin router', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Admin Deals Founder' });
    const investor = await createUser(UserRole.INVESTOR, { displayName: 'Admin Deals Investor' });
    const admin = await createUser(UserRole.ADMIN, {
      displayName: 'Admin Deals Reviewer',
      accessGrantedBy: 'admin',
      adminApprovalStatus: 'approved',
      adminApprovedAt: new Date(),
    });
    const startup = await createStartup(founder._id.toString());

    const expressResponse = await request(app)
      .post(`/api/investor/express-interest/${startup._id}`)
      .set(authHeader(investor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 25000,
        proposedEquityPercent: 2,
        chosenRole: 'shareholder',
      });

    expect(expressResponse.status).toBe(201);

    const response = await request(app)
      .get('/api/admin/deals')
      .set(authHeader(admin));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: expressResponse.body.data._id,
        }),
      ]),
    );
  });

  it('creates a penny investment without changing startup allocation before admin approval', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Founder One' });
    const investor = await createUser(UserRole.INVESTOR, { displayName: 'Penny Investor' });
    const startup = await createStartup(founder._id.toString());

    const response = await request(app)
      .post(`/api/investor/express-interest/${startup._id}`)
      .set(authHeader(investor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 20000,
        proposedEquityPercent: 2,
        chosenRole: 'shareholder',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.investorType).toBe('penny');
    expect(response.body.data.sharesAllocated).toBe(20);
    expect(response.body.data.founderDecision.status).toBe('pending');

    const updatedStartup = await Startup.findById(startup._id).lean();
    expect(updatedStartup?.currentPennyCount).toBe(0);
    expect(updatedStartup?.availableShares).toBe(1000);

    const capTableResponse = await request(app)
      .get(`/api/startups/${startup._id}/cap-table`)
      .set(authHeader(founder));

    expect(capTableResponse.status).toBe(200);
    expect(capTableResponse.body.data.pennyInvestors).toHaveLength(0);
    expect(capTableResponse.body.data.availableShares).toBe(1000);
  });

  it('allows pending sole proposals, but blocks a second sole investor after admin approval', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Founder Two' });
    const firstSole = await createUser(UserRole.INVESTOR, { displayName: 'Lead Investor' });
    const secondSole = await createUser(UserRole.INVESTOR, { displayName: 'Backup Investor' });
    const admin = await createUser(UserRole.ADMIN, { displayName: 'Deal Admin' });
    const startup = await createStartup(founder._id.toString(), { reservedForSole: 510 });

    const firstResponse = await request(app)
      .post(`/api/startups/${startup._id}/sole-investor`)
      .set(authHeader(firstSole))
      .send({
        investorType: 'sole',
        proposedAmountINR: 200000,
        proposedEquityPercent: 60,
        chosenRole: 'director',
      });

    expect(firstResponse.status).toBe(201);
    expect(firstResponse.body.data.canVeto).toBe(true);

    const pendingSecondResponse = await request(app)
      .post(`/api/startups/${startup._id}/sole-investor`)
      .set(authHeader(secondSole))
      .send({
        investorType: 'sole',
        proposedAmountINR: 250000,
        proposedEquityPercent: 55,
        chosenRole: 'director',
      });

    expect(pendingSecondResponse.status).toBe(201);

    await approveDealThroughAdmin({
      founder,
      investor: firstSole,
      admin,
      dealId: firstResponse.body.data._id,
      amountINR: 200000,
      equityPercent: 60,
      investorRole: 'director',
    });

    const secondResponse = await request(app)
      .post(`/api/startups/${startup._id}/sole-investor`)
      .set(authHeader(await createUser(UserRole.INVESTOR, { displayName: 'Third Sole Investor' })))
      .send({
        investorType: 'sole',
        proposedAmountINR: 275000,
        proposedEquityPercent: 55,
        chosenRole: 'director',
      });

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.error.code).toBe('SOLE_INVESTOR_EXISTS');
  });

  it('rejects a penny investor requesting director authority', async () => {
    const founder = await createUser(UserRole.STUDENT);
    const investor = await createUser(UserRole.INVESTOR);
    const startup = await createStartup(founder._id.toString());

    const response = await request(app)
      .post(`/api/investor/express-interest/${startup._id}`)
      .set(authHeader(investor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 25000,
        proposedEquityPercent: 2,
        chosenRole: 'director',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('DIRECTOR_ROLE_RESERVED');
  });

  it('rejects investments below the ₹20,000 guardrail', async () => {
    const founder = await createUser(UserRole.STUDENT);
    const investor = await createUser(UserRole.INVESTOR);
    const startup = await createStartup(founder._id.toString());

    const response = await request(app)
      .post(`/api/investor/express-interest/${startup._id}`)
      .set(authHeader(investor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 19999,
        proposedEquityPercent: 1,
        chosenRole: 'observer',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects investments that exceed the available share pool', async () => {
    const founder = await createUser(UserRole.STUDENT);
    const investor = await createUser(UserRole.INVESTOR);
    const startup = await createStartup(founder._id.toString(), {
      totalShares: 10,
      availableShares: 1,
    });

    const response = await request(app)
      .post(`/api/investor/express-interest/${startup._id}`)
      .set(authHeader(investor))
      .send({
        investorType: 'sole',
        proposedAmountINR: 80000,
        proposedEquityPercent: 20,
        chosenRole: 'shareholder',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INSUFFICIENT_SHARES');
  });

  it('rejects penny investments that breach the collective 49% cap', async () => {
    const founder = await createUser(UserRole.STUDENT);
    const admin = await createUser(UserRole.ADMIN, { displayName: 'Penny Cap Admin' });
    const startup = await createStartup(founder._id.toString(), {
      maxPennyInvestors: 12,
    });

    for (let index = 0; index < 9; index += 1) {
      const investor = await createUser(UserRole.INVESTOR, { displayName: `Penny ${index}` });
      const response = await request(app)
        .post(`/api/investor/express-interest/${startup._id}`)
        .set(authHeader(investor))
        .send({
          investorType: 'penny',
          proposedAmountINR: 20000 + index,
          proposedEquityPercent: 5,
          chosenRole: 'shareholder',
      });

      expect(response.status).toBe(201);

      await approveDealThroughAdmin({
        founder,
        investor,
        admin,
        dealId: response.body.data._id,
        amountINR: 20000 + index,
        equityPercent: 5,
        investorRole: 'shareholder',
      });
    }

    const overflowInvestor = await createUser(UserRole.INVESTOR, { displayName: 'Overflow Penny' });
    const overflowResponse = await request(app)
      .post(`/api/investor/express-interest/${startup._id}`)
      .set(authHeader(overflowInvestor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 30000,
        proposedEquityPercent: 5,
        chosenRole: 'shareholder',
      });

    expect(overflowResponse.status).toBe(400);
    expect(overflowResponse.body.error.code).toBe('PENNY_EQUITY_CAP');
  });

  it('limits penny investors to their own cap-table row while founders get the full table', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Cap Table Founder' });
    const soleInvestor = await createUser(UserRole.INVESTOR, { displayName: 'Sole Lead' });
    const pennyInvestor = await createUser(UserRole.INVESTOR, { displayName: 'Penny Backer' });
    const admin = await createUser(UserRole.ADMIN, { displayName: 'Cap Table Admin' });
    const startup = await createStartup(founder._id.toString());

    const soleResponse = await request(app)
      .post(`/api/startups/${startup._id}/sole-investor`)
      .set(authHeader(soleInvestor))
      .send({
        investorType: 'sole',
        proposedAmountINR: 300000,
        proposedEquityPercent: 60,
        chosenRole: 'director',
      });

    expect(soleResponse.status).toBe(201);

    const pennyResponse = await request(app)
      .post(`/api/investor/express-interest/${startup._id}`)
      .set(authHeader(pennyInvestor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 20000,
        proposedEquityPercent: 2,
        chosenRole: 'shareholder',
      });

    expect(pennyResponse.status).toBe(201);

    for (const [dealId, investor, amount, equityPercent, investorRole] of [
      [soleResponse.body.data._id, soleInvestor, 300000, 60, 'director'],
      [pennyResponse.body.data._id, pennyInvestor, 20000, 2, 'shareholder'],
    ] as const) {
      await agreeToCurrentTerms({ dealId, participant: founder });
      await moveToDueDiligence({ dealId, investor });

      const founderAcceptResponse = await request(app)
        .patch(`/api/deals/${dealId}/founder-decision`)
        .set(authHeader(founder))
        .send({ decision: 'accepted' });

      expect(founderAcceptResponse.status).toBe(200);

      const stageTwoResponse = await request(app)
        .patch(`/api/investor/deals/${dealId}/stage`)
        .set(authHeader(investor))
        .send({
          newStage: 2,
          stageData: { amountINR: amount },
        });

      expect(stageTwoResponse.status).toBe(200);

      const stageThreeResponse = await request(app)
        .patch(`/api/investor/deals/${dealId}/stage`)
        .set(authHeader(investor))
        .send({
          newStage: 3,
          stageData: { equityPercent, investorRole },
        });

      expect(stageThreeResponse.status).toBe(200);

      const approveResponse = await request(app)
        .patch(`/api/admin/deals/${dealId}/approve-stage`)
        .set(authHeader(admin));

      expect(approveResponse.status).toBe(200);
    }

    const founderView = await request(app)
      .get(`/api/startups/${startup._id}/cap-table`)
      .set(authHeader(founder));

    expect(founderView.status).toBe(200);
    expect(founderView.body.data.visibility).toBe('full');
    expect(founderView.body.data.soleInvestor.name).toBe('Sole Lead');
    expect(founderView.body.data.pennyInvestors).toHaveLength(1);

    const pennyView = await request(app)
      .get(`/api/startups/${startup._id}/cap-table`)
      .set(authHeader(pennyInvestor));

    expect(pennyView.status).toBe(200);
    expect(pennyView.body.data.visibility).toBe('limited');
    expect(pennyView.body.data.pennyInvestors).toHaveLength(1);
    expect(pennyView.body.data.pennyInvestors[0].name).toBe('Penny Backer');
    expect(pennyView.body.data.soleInvestor.name).toBeUndefined();
  });

  it('allows a workspace teammate to view startup deal lists and details', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Deal Founder' });
    const teammate = await createUser(UserRole.STUDENT, { displayName: 'Deal Teammate' });
    const investor = await createUser(UserRole.INVESTOR, { displayName: 'Deal Investor' });

    const workspace = await Workspace.create({
      ownerId: founder._id,
      teamMemberIds: [teammate._id],
      title: 'Shared Deal Workspace',
      category: 'FinTech',
      stage: 'Launch',
    });

    const startup = await createStartup(founder._id.toString(), {
      founderIds: [founder._id, teammate._id],
      projectId: workspace._id,
    });

    const expressResponse = await request(app)
      .post(`/api/investor/express-interest/${startup._id}`)
      .set(authHeader(investor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 20000,
        proposedEquityPercent: 2,
        chosenRole: 'shareholder',
      });

    expect(expressResponse.status).toBe(201);

    const listResponse = await request(app)
      .get('/api/deals')
      .set(authHeader(teammate));

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: expressResponse.body.data._id,
          startupId: startup._id.toString(),
        }),
      ]),
    );

    const detailResponse = await request(app)
      .get(`/api/deals/${expressResponse.body.data._id}`)
      .set(authHeader(teammate));

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data).toEqual(
      expect.objectContaining({
        _id: expressResponse.body.data._id,
        startupId: startup._id.toString(),
      }),
    );
  });

  it('returns veto authority only for a sole director', async () => {
    const founder = await createUser(UserRole.STUDENT);
    const soleInvestor = await createUser(UserRole.INVESTOR, { displayName: 'Director Lead' });
    const pennyInvestor = await createUser(UserRole.INVESTOR, { displayName: 'Observer Penny' });
    const admin = await createUser(UserRole.ADMIN, { displayName: 'Authority Admin' });
    const startup = await createStartup(founder._id.toString());

    const soleResponse = await request(app)
      .post(`/api/startups/${startup._id}/sole-investor`)
      .set(authHeader(soleInvestor))
      .send({
        investorType: 'sole',
        proposedAmountINR: 250000,
        proposedEquityPercent: 60,
        chosenRole: 'director',
      });
    expect(soleResponse.status).toBe(201);

    const pennyResponse = await request(app)
      .post(`/api/investor/express-interest/${startup._id}`)
      .set(authHeader(pennyInvestor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 20000,
        proposedEquityPercent: 2,
        chosenRole: 'observer',
      });
    expect(pennyResponse.status).toBe(201);

    await approveDealThroughAdmin({
      founder,
      investor: soleInvestor,
      admin,
      dealId: soleResponse.body.data._id,
      amountINR: 250000,
      equityPercent: 60,
      investorRole: 'director',
    });
    await approveDealThroughAdmin({
      founder,
      investor: pennyInvestor,
      admin,
      dealId: pennyResponse.body.data._id,
      amountINR: 20000,
      equityPercent: 2,
      investorRole: 'observer',
    });

    const soleAuthority = await request(app)
      .get('/api/investor/portfolio/authority')
      .set(authHeader(soleInvestor));
    const pennyAuthority = await request(app)
      .get('/api/investor/portfolio/authority')
      .set(authHeader(pennyInvestor));

    expect(soleAuthority.status).toBe(200);
    expect(soleAuthority.body.data.items[0].canVeto).toBe(true);
    expect(pennyAuthority.status).toBe(200);
    expect(pennyAuthority.body.data.items[0].canVeto).toBe(false);
  });

  it('blocks finalization after admin rejects a transfer and allows resubmission', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Review Founder' });
    const investor = await createUser(UserRole.INVESTOR, { displayName: 'Review Investor' });
    const admin = await createUser(UserRole.ADMIN, { displayName: 'Admin Reviewer' });
    const startup = await createStartup(founder._id.toString());

    const expressResponse = await request(app)
      .post(`/api/investor/express-interest/${startup._id}`)
      .set(authHeader(investor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 25000,
        proposedEquityPercent: 2,
        chosenRole: 'shareholder',
      });

    expect(expressResponse.status).toBe(201);
    const dealId = expressResponse.body.data._id;

    await agreeToCurrentTerms({ dealId, participant: founder });
    await moveToDueDiligence({ dealId, investor });

    const founderAcceptResponse = await request(app)
      .patch(`/api/deals/${dealId}/founder-decision`)
      .set(authHeader(founder))
      .send({
        decision: 'accepted',
      });

    expect(founderAcceptResponse.status).toBe(200);

    const fundTransferResponse = await request(app)
      .patch(`/api/investor/deals/${dealId}/stage`)
      .set(authHeader(investor))
      .send({
        newStage: 2,
        stageData: { amountINR: 25000 },
      });

    expect(fundTransferResponse.status).toBe(200);

    const transferReviewResponse = await request(app)
      .patch(`/api/investor/deals/${dealId}/stage`)
      .set(authHeader(investor))
      .send({
        newStage: 3,
        stageData: {
          equityPercent: 2,
          investorRole: 'shareholder',
        },
      });

    expect(transferReviewResponse.status).toBe(200);
    expect(transferReviewResponse.body.data.requiresAdminApproval).toBe(true);

    const rejectResponse = await request(app)
      .patch(`/api/admin/deals/${dealId}/review`)
      .set(authHeader(admin))
      .send({
        stockTransferStatus: 'rejected',
        reviewNotes: 'Cap table documents do not match the submitted transfer terms.',
      });

    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.data).toEqual(
      expect.objectContaining({
        mediationStatus: 'rejected',
        adminApprovalRequired: false,
      }),
    );
    expect(rejectResponse.body.data.stockTransfer.status).toBe('rejected');

    const blockedCloseResponse = await request(app)
      .patch(`/api/investor/deals/${dealId}/stage`)
      .set(authHeader(investor))
      .send({ newStage: 4 });

    expect(blockedCloseResponse.status).toBe(400);
    expect(blockedCloseResponse.body.error.code).toBe('ADMIN_APPROVAL_REQUIRED');

    const resubmissionResponse = await request(app)
      .patch(`/api/investor/deals/${dealId}/stage`)
      .set(authHeader(investor))
      .send({
        newStage: 3,
        stageData: {
          equityPercent: 2,
          investorRole: 'shareholder',
        },
      });

    expect(resubmissionResponse.status).toBe(200);
    expect(resubmissionResponse.body.data.requiresAdminApproval).toBe(true);

    const approveResponse = await request(app)
      .patch(`/api/admin/deals/${dealId}/approve-stage`)
      .set(authHeader(admin));

    expect(approveResponse.status).toBe(200);

    const closeResponse = await request(app)
      .patch(`/api/investor/deals/${dealId}/stage`)
      .set(authHeader(investor))
      .send({ newStage: 4 });

    expect(closeResponse.status).toBe(200);
    expect(closeResponse.body.data.deal).toEqual(
      expect.objectContaining({
        currentStage: 4,
        status: 'closed',
      }),
    );

  });

  it('blocks fund transfer until a founder accepts the proposal', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Gate Founder' });
    const investor = await createUser(UserRole.INVESTOR, { displayName: 'Gate Investor' });
    const startup = await createStartup(founder._id.toString());

    const expressResponse = await request(app)
      .post(`/api/investor/express-interest/${startup._id}`)
      .set(authHeader(investor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 22000,
        proposedEquityPercent: 2,
        chosenRole: 'shareholder',
      });

    expect(expressResponse.status).toBe(201);

    await agreeToCurrentTerms({ dealId: expressResponse.body.data._id, participant: founder });
    await moveToDueDiligence({ dealId: expressResponse.body.data._id, investor });

    const blockedResponse = await request(app)
      .patch(`/api/investor/deals/${expressResponse.body.data._id}/stage`)
      .set(authHeader(investor))
      .send({
        newStage: 2,
        stageData: { amountINR: 22000 },
      });

    expect(blockedResponse.status).toBe(400);
    expect(blockedResponse.body.error.code).toBe('FOUNDER_ACCEPTANCE_REQUIRED');
  });

  it('keeps startup allocation unchanged when the founder rejects a pending proposal', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Reject Founder' });
    const investor = await createUser(UserRole.INVESTOR, { displayName: 'Reject Investor' });
    const startup = await createStartup(founder._id.toString());

    const expressResponse = await request(app)
      .post(`/api/investor/express-interest/${startup._id}`)
      .set(authHeader(investor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 24000,
        proposedEquityPercent: 2,
        chosenRole: 'shareholder',
      });

    expect(expressResponse.status).toBe(201);

    await agreeToCurrentTerms({ dealId: expressResponse.body.data._id, participant: founder });
    await moveToDueDiligence({ dealId: expressResponse.body.data._id, investor });

    const rejectResponse = await request(app)
      .patch(`/api/deals/${expressResponse.body.data._id}/founder-decision`)
      .set(authHeader(founder))
      .send({
        decision: 'rejected',
        note: 'We are not taking external capital on this project yet.',
      });

    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.data.status).toBe('cancelled');
    expect(rejectResponse.body.data.founderDecision.status).toBe('rejected');

    const updatedStartup = await Startup.findById(startup._id).lean();
    expect(updatedStartup?.currentPennyCount).toBe(0);
    expect(updatedStartup?.availableShares).toBe(1000);

  });

  it('requires founder acceptance before an investor can advance and keeps allocation unchanged after rejection', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Founder Gatekeeper' });
    const investor = await createUser(UserRole.INVESTOR, { displayName: 'Waiting Investor' });
    const startup = await createStartup(founder._id.toString());

    const expressResponse = await request(app)
      .post(`/api/investor/express-interest/${startup._id}`)
      .set(authHeader(investor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 25000,
        proposedEquityPercent: 2,
        chosenRole: 'shareholder',
      });

    expect(expressResponse.status).toBe(201);
    expect(expressResponse.body.data.founderDecision.status).toBe('pending');

    await agreeToCurrentTerms({ dealId: expressResponse.body.data._id, participant: founder });
    await moveToDueDiligence({ dealId: expressResponse.body.data._id, investor });

    const blockedAdvanceResponse = await request(app)
      .patch(`/api/investor/deals/${expressResponse.body.data._id}/stage`)
      .set(authHeader(investor))
      .send({
        newStage: 2,
        stageData: { amountINR: 25000 },
      });

    expect(blockedAdvanceResponse.status).toBe(400);
    expect(blockedAdvanceResponse.body.error.code).toBe('FOUNDER_ACCEPTANCE_REQUIRED');

    const rejectionResponse = await request(app)
      .patch(`/api/deals/${expressResponse.body.data._id}/founder-decision`)
      .set(authHeader(founder))
      .send({
        decision: 'rejected',
        note: 'The current proposal terms do not fit our round.',
      });

    expect(rejectionResponse.status).toBe(200);
    expect(rejectionResponse.body.data).toEqual(
      expect.objectContaining({
        status: 'cancelled',
        founderDecision: expect.objectContaining({
          status: 'rejected',
        }),
      }),
    );

    const restoredStartup = await Startup.findById(startup._id).lean();
    expect(restoredStartup?.availableShares).toBe(1000);
    expect(restoredStartup?.currentPennyCount).toBe(0);

    const resubmittedResponse = await request(app)
      .post(`/api/investor/express-interest/${startup._id}`)
      .set(authHeader(investor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 30000,
        proposedEquityPercent: 3,
        chosenRole: 'shareholder',
      });

    expect(resubmittedResponse.status).toBe(201);

    await agreeToCurrentTerms({ dealId: resubmittedResponse.body.data._id, participant: founder });
    await moveToDueDiligence({ dealId: resubmittedResponse.body.data._id, investor });

    const acceptanceResponse = await request(app)
      .patch(`/api/deals/${resubmittedResponse.body.data._id}/founder-decision`)
      .set(authHeader(founder))
      .send({
        decision: 'accepted',
        note: 'Proceed with diligence.',
      });

    expect(acceptanceResponse.status).toBe(200);
    expect(acceptanceResponse.body.data.founderDecision).toEqual(
      expect.objectContaining({
        status: 'accepted',
      }),
    );

    const advanceResponse = await request(app)
      .patch(`/api/investor/deals/${resubmittedResponse.body.data._id}/stage`)
      .set(authHeader(investor))
      .send({
        newStage: 2,
        stageData: { amountINR: 30000 },
      });

    expect(advanceResponse.status).toBe(200);
    expect(advanceResponse.body.data.deal.currentStage).toBe(2);
  });

  it('persists negotiation messages and exposes them in investor deal detail', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Negotiation Founder' });
    const investor = await createUser(UserRole.INVESTOR, { displayName: 'Negotiation Investor' });
    const startup = await createStartup(founder._id.toString());

    const expressResponse = await request(app)
      .post(`/api/investor/express-interest/${startup._id}`)
      .set(authHeader(investor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 25000,
        proposedEquityPercent: 2,
        chosenRole: 'shareholder',
      });

    expect(expressResponse.status).toBe(201);

    const messageResponse = await request(app)
      .post(`/api/deals/${expressResponse.body.data._id}/negotiation-message`)
      .set(authHeader(investor))
      .send({ message: 'Let us settle on these terms.' });

    expect(messageResponse.status).toBe(200);
    expect(messageResponse.body.data.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          senderRole: 'investor',
          message: 'Let us settle on these terms.',
        }),
      ]),
    );

    const detailResponse = await request(app)
      .get(`/api/investor/deals/${expressResponse.body.data._id}`)
      .set(authHeader(investor));

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.negotiation).toEqual(
      expect.objectContaining({
        status: 'initial',
        messages: expect.arrayContaining([
          expect.objectContaining({
            senderRole: 'investor',
            message: 'Let us settle on these terms.',
          }),
        ]),
      }),
    );
  });

  it('moves a deal from negotiation to due diligence after terms are agreed', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Stage Zero Founder' });
    const investor = await createUser(UserRole.INVESTOR, { displayName: 'Stage Zero Investor' });
    const startup = await createStartup(founder._id.toString());

    const expressResponse = await request(app)
      .post(`/api/investor/express-interest/${startup._id}`)
      .set(authHeader(investor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 26000,
        proposedEquityPercent: 2,
        chosenRole: 'shareholder',
      });

    expect(expressResponse.status).toBe(201);

    await agreeToCurrentTerms({ dealId: expressResponse.body.data._id, participant: founder });

    const stageOneResponse = await request(app)
      .patch(`/api/investor/deals/${expressResponse.body.data._id}/stage`)
      .set(authHeader(investor))
      .send({ newStage: 1 });

    expect(stageOneResponse.status).toBe(200);
    expect(stageOneResponse.body.data.deal).toEqual(
      expect.objectContaining({
        currentStage: 1,
        negotiation: expect.objectContaining({
          status: 'terms_agreed',
        }),
      }),
    );
  });
});
