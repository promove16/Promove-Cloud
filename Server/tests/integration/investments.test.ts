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
        status: 'terms_proposed',
        investorAgreed: true,
        messages: expect.arrayContaining([
          expect.objectContaining({
            senderRole: 'investor',
            message: 'Let us settle on these terms.',
          }),
        ]),
      }),
    );
  });

  it('lets student and mentor accounts bid as investor-side participants and negotiate', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Multi Role Founder' });
    const studentBidder = await createUser(UserRole.STUDENT, { displayName: 'Student Backer' });
    const mentorBidder = await createUser(UserRole.MENTOR, { displayName: 'Mentor Backer' });
    const startup = await createStartup(founder._id.toString(), { maxPennyInvestors: 5 });

    const studentBidResponse = await request(app)
      .post(`/api/startups/${startup._id}/bid`)
      .set(authHeader(studentBidder))
      .send({
        investorType: 'penny',
        proposedAmountINR: 22000,
        proposedEquityPercent: 2,
        chosenRole: 'shareholder',
      });

    expect(studentBidResponse.status).toBe(201);
    expect(studentBidResponse.body.data.requestOrigin).toBe('investor');

    const studentBoardResponse = await request(app)
      .get(`/api/startups/${startup._id}/bids`)
      .set(authHeader(studentBidder));

    expect(studentBoardResponse.status).toBe(200);
    expect(studentBoardResponse.body.data.currentUserBid).toEqual(
      expect.objectContaining({
        bidId: studentBidResponse.body.data._id,
        investorType: 'penny',
      }),
    );

    const studentMessageResponse = await request(app)
      .post(`/api/deals/${studentBidResponse.body.data._id}/negotiation-message`)
      .set(authHeader(studentBidder))
      .send({ message: 'Student account bidding as backer.' });

    expect(studentMessageResponse.status).toBe(200);
    expect(studentMessageResponse.body.data.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          senderRole: 'investor',
          message: 'Student account bidding as backer.',
        }),
      ]),
    );

    const selfBidResponse = await request(app)
      .post(`/api/startups/${startup._id}/bid`)
      .set(authHeader(founder))
      .send({
        investorType: 'penny',
        proposedAmountINR: 22000,
        proposedEquityPercent: 2,
        chosenRole: 'shareholder',
      });

    expect(selfBidResponse.status).toBe(400);
    expect(selfBidResponse.body.error.code).toBe('SELF_BID');

    const mentorBidResponse = await request(app)
      .post(`/api/startups/${startup._id}/bid`)
      .set(authHeader(mentorBidder))
      .send({
        investorType: 'penny',
        proposedAmountINR: 24000,
        proposedEquityPercent: 2,
        chosenRole: 'observer',
      });

    expect(mentorBidResponse.status).toBe(201);

    const mentorDealResponse = await request(app)
      .get(`/api/deals/${mentorBidResponse.body.data._id}`)
      .set(authHeader(mentorBidder));

    expect(mentorDealResponse.status).toBe(200);
    expect(mentorDealResponse.body.data.investor._id).toBe(mentorBidder._id.toString());

    const mentorTermsResponse = await request(app)
      .post(`/api/deals/${mentorBidResponse.body.data._id}/negotiation-propose`)
      .set(authHeader(mentorBidder))
      .send({ amountINR: 26000, equityPercent: 2.5 });

    expect(mentorTermsResponse.status).toBe(200);
    expect(mentorTermsResponse.body.data.status).toBe('terms_proposed');
    expect(mentorTermsResponse.body.data.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          senderRole: 'investor',
          message: 'Investor proposed terms: INR 26,000 for 2.5% equity.',
        }),
      ]),
    );
  });

  it('uses active penny bids to fill pool slots before admin approval', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Slot Founder' });
    const firstBidder = await createUser(UserRole.INVESTOR, { displayName: 'First Slot' });
    const secondBidder = await createUser(UserRole.INVESTOR, { displayName: 'Second Slot' });
    const startup = await createStartup(founder._id.toString(), { maxPennyInvestors: 1 });

    const firstBidResponse = await request(app)
      .post(`/api/startups/${startup._id}/bid`)
      .set(authHeader(firstBidder))
      .send({
        investorType: 'penny',
        proposedAmountINR: 25000,
        proposedEquityPercent: 2,
        chosenRole: 'shareholder',
      });

    expect(firstBidResponse.status).toBe(201);

    const boardResponse = await request(app)
      .get(`/api/startups/${startup._id}/bids`)
      .set(authHeader(secondBidder));

    expect(boardResponse.status).toBe(200);
    expect(boardResponse.body.data.acceptsPennyInvestors).toBe(false);
    expect(boardResponse.body.data.pennyPool.investorCount).toBe(1);

    const secondBidResponse = await request(app)
      .post(`/api/startups/${startup._id}/bid`)
      .set(authHeader(secondBidder))
      .send({
        investorType: 'penny',
        proposedAmountINR: 26000,
        proposedEquityPercent: 2,
        chosenRole: 'shareholder',
      });

    expect(secondBidResponse.status).toBe(409);
    expect(secondBidResponse.body.error.code).toBe('PENNY_SLOTS_FULL');

    const updatedStartup = await Startup.findById(startup._id).lean();
    expect(updatedStartup?.currentPennyCount).toBe(0);
  });

  it('sends an accepted startup counter offer directly to admin approval', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Counter Founder' });
    const investor = await createUser(UserRole.INVESTOR, { displayName: 'Counter Investor' });
    const startup = await createStartup(founder._id.toString());

    const bidResponse = await request(app)
      .post(`/api/startups/${startup._id}/bid`)
      .set(authHeader(investor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 100000,
        proposedEquityPercent: 10,
        chosenRole: 'shareholder',
      });

    expect(bidResponse.status).toBe(400);
    expect(bidResponse.body.error.code).toBe('PENNY_EQUITY_LIMIT');

    const validBidResponse = await request(app)
      .post(`/api/startups/${startup._id}/bid`)
      .set(authHeader(investor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 100000,
        proposedEquityPercent: 5,
        chosenRole: 'shareholder',
      });

    expect(validBidResponse.status).toBe(201);

    const counterResponse = await request(app)
      .post(`/api/deals/${validBidResponse.body.data._id}/negotiation-propose`)
      .set(authHeader(founder))
      .send({ amountINR: 100000, equityPercent: 4 });

    expect(counterResponse.status).toBe(200);
    expect(counterResponse.body.data).toEqual(
      expect.objectContaining({
        status: 'counter_offer',
        startupAgreed: true,
        investorAgreed: false,
        studentCounterAmount: 100000,
        studentCounterEquity: 4,
      }),
    );

    const agreeResponse = await request(app)
      .post(`/api/deals/${validBidResponse.body.data._id}/negotiation-agree`)
      .set(authHeader(investor));

    expect(agreeResponse.status).toBe(200);
    expect(agreeResponse.body.data).toEqual(
      expect.objectContaining({
        status: 'terms_agreed',
        finalAgreedAmount: 100000,
        finalAgreedEquity: 4,
      }),
    );

    const detailResponse = await request(app)
      .get(`/api/investor/deals/${validBidResponse.body.data._id}`)
      .set(authHeader(investor));

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data).toEqual(
      expect.objectContaining({
        currentStage: 3,
        amountINR: 100000,
        equityPercent: 4,
        adminApprovalRequired: true,
        founderDecision: expect.objectContaining({ status: 'accepted' }),
        mediationStatus: 'under_review',
        stockTransfer: expect.objectContaining({ status: 'pending_review' }),
      }),
    );
  });

  it('updates bid-board contributor terms during counter offers and renegotiation', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Board Founder' });
    const investor = await createUser(UserRole.INVESTOR, { displayName: 'Board Investor' });
    const startup = await createStartup(founder._id.toString(), { maxPennyInvestors: 5 });

    const bidResponse = await request(app)
      .post(`/api/startups/${startup._id}/bid`)
      .set(authHeader(investor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 20000,
        proposedEquityPercent: 2,
        chosenRole: 'shareholder',
      });

    expect(bidResponse.status).toBe(201);

    const initialBoardResponse = await request(app)
      .get(`/api/startups/${startup._id}/bids`)
      .set(authHeader(investor));

    expect(initialBoardResponse.status).toBe(200);
    expect(initialBoardResponse.body.data.pennyPool.contributors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bidId: bidResponse.body.data._id,
          amountINR: 20000,
          equityPercent: 2,
        }),
      ]),
    );

    const counterResponse = await request(app)
      .post(`/api/deals/${bidResponse.body.data._id}/negotiation-propose`)
      .set(authHeader(founder))
      .send({
        amountINR: 100000,
        equityPercent: 4,
      });

    expect(counterResponse.status).toBe(200);

    const counterBoardResponse = await request(app)
      .get(`/api/startups/${startup._id}/bids`)
      .set(authHeader(investor));

    expect(counterBoardResponse.status).toBe(200);
    expect(counterBoardResponse.body.data.pennyPool.totalRaised).toBe(100000);
    expect(counterBoardResponse.body.data.pennyPool.contributors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bidId: bidResponse.body.data._id,
          amountINR: 100000,
          equityPercent: 4,
        }),
      ]),
    );

    const renegotiateResponse = await request(app)
      .post(`/api/deals/${bidResponse.body.data._id}/negotiation-propose`)
      .set(authHeader(investor))
      .send({
        amountINR: 80000,
        equityPercent: 3,
      });

    expect(renegotiateResponse.status).toBe(200);

    const renegotiatedBoardResponse = await request(app)
      .get(`/api/startups/${startup._id}/bids`)
      .set(authHeader(investor));

    expect(renegotiatedBoardResponse.status).toBe(200);
    expect(renegotiatedBoardResponse.body.data.pennyPool.totalRaised).toBe(80000);
    expect(renegotiatedBoardResponse.body.data.pennyPool.contributors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bidId: bidResponse.body.data._id,
          amountINR: 80000,
          equityPercent: 3,
        }),
      ]),
    );
  });

  it('grants investors access to a linked workshop once an accepted deal is connected', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Workshop Founder' });
    const investor = await createUser(UserRole.INVESTOR, { displayName: 'Workshop Investor' });
    const startup = await createStartup(founder._id.toString());
    const linkedWorkspace = await Workspace.create({
      ownerId: founder._id,
      teamMemberIds: [founder._id],
      title: 'Due Diligence Workspace',
      category: 'Software',
      stage: 'Build',
      isActive: true,
    });

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
      .send({ decision: 'accepted' });

    expect(founderAcceptResponse.status).toBe(200);

    const linkResponse = await request(app)
      .patch(`/api/deals/${dealId}/link-workshop`)
      .set(authHeader(founder))
      .send({ workspaceId: linkedWorkspace._id.toString() });

    expect(linkResponse.status).toBe(200);
    expect(linkResponse.body.data.workspaceId).toBe(linkedWorkspace._id.toString());

    const workspaceResponse = await request(app)
      .get(`/api/workspace/${linkedWorkspace._id}`)
      .set(authHeader(investor));

    expect(workspaceResponse.status).toBe(200);
    expect(workspaceResponse.body.data).toEqual(
      expect.objectContaining({
        _id: linkedWorkspace._id.toString(),
        title: 'Due Diligence Workspace',
      }),
    );
  });

  it('does not expose a startup workspace to investors until the founder explicitly links it to the deal', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Implicit Workspace Founder' });
    const investor = await createUser(UserRole.INVESTOR, { displayName: 'Implicit Workspace Investor' });
    const admin = await createUser(UserRole.ADMIN, {
      displayName: 'Implicit Workspace Admin',
      accessGrantedBy: 'admin',
      adminApprovalStatus: 'approved',
      adminApprovedAt: new Date(),
    });
    const startupWorkspace = await Workspace.create({
      ownerId: founder._id,
      teamMemberIds: [founder._id],
      title: 'Startup Execution Workspace',
      category: 'Software',
      stage: 'Build',
      isActive: true,
    });
    const startup = await createStartup(founder._id.toString(), {
      projectId: startupWorkspace._id,
    });

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

    await approveDealThroughAdmin({
      founder,
      investor,
      admin,
      dealId,
      amountINR: 25000,
      equityPercent: 2,
      investorRole: 'shareholder',
    });

    const closeResponse = await request(app)
      .patch(`/api/investor/deals/${dealId}/stage`)
      .set(authHeader(investor))
      .send({ newStage: 4 });

    expect(closeResponse.status).toBe(200);

    const detailResponse = await request(app)
      .get(`/api/investor/deals/${dealId}`)
      .set(authHeader(investor));

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.productWorkshop).toBeUndefined();

    const portfolioResponse = await request(app)
      .get('/api/investor/portfolio')
      .set(authHeader(investor));

    expect(portfolioResponse.status).toBe(200);
    const portfolioItem = portfolioResponse.body.data.items.find(
      (item: { dealId: string; productWorkshop?: unknown }) => item.dealId === dealId,
    );
    expect(portfolioItem).toBeDefined();
    expect(portfolioItem.productWorkshop).toBeUndefined();

    const workspaceResponse = await request(app)
      .get(`/api/workspace/${startupWorkspace._id}`)
      .set(authHeader(investor));

    expect(workspaceResponse.status).toBe(404);
  });

  it('returns a signed pitch deck URL in investor startup detail when cloudinary storage metadata exists', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Pitch Founder' });
    const investor = await createUser(UserRole.INVESTOR, { displayName: 'Pitch Investor' });
    const startup = await createStartup(founder._id.toString(), {
      pitchDeckUrl: 'https://res.cloudinary.com/demo/raw/upload/v123/promove/pitch.pdf',
      pitchDeckStorageProvider: 'cloudinary',
      pitchDeckStorageKey: 'promove/pitch',
    });

    const response = await request(app)
      .get(`/api/investor/startups/${startup._id}`)
      .set(authHeader(investor));

    expect(response.status).toBe(200);
    expect(response.body.data.startup.pitchDeckUrl).toContain('/raw/upload/');
    expect(response.body.data.startup.pitchDeckUrl).toContain('promove/pitch');
    expect(response.body.data.startup.pitchDeckUrl).not.toBe(
      'https://res.cloudinary.com/demo/raw/upload/v123/promove/pitch.pdf',
    );
  });

  it('returns a presigned pitch deck URL in investor startup detail when s3 storage metadata exists', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'S3 Pitch Founder' });
    const investor = await createUser(UserRole.INVESTOR, { displayName: 'S3 Pitch Investor' });
    const startup = await createStartup(founder._id.toString(), {
      pitchDeckUrl: 'https://promove-test-bucket.s3.ap-south-1.amazonaws.com/promove/startups/pitch.pdf',
      pitchDeckStorageProvider: 's3',
      pitchDeckStorageKey: 'promove/startups/pitch.pdf',
    });

    const response = await request(app)
      .get(`/api/investor/startups/${startup._id}`)
      .set(authHeader(investor));

    expect(response.status).toBe(200);
    expect(response.body.data.startup.pitchDeckUrl).toContain('X-Amz-Signature=');
    expect(response.body.data.startup.pitchDeckUrl).toContain('promove/startups/pitch.pdf');
    expect(response.body.data.startup.pitchDeckUrl).not.toBe(
      'https://promove-test-bucket.s3.ap-south-1.amazonaws.com/promove/startups/pitch.pdf',
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

  it('requires both parties to accept again after renegotiation', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Counter Founder' });
    const investor = await createUser(UserRole.INVESTOR, { displayName: 'Counter Investor' });
    const startup = await createStartup(founder._id.toString(), {
      name: 'Counter Startup',
      maxPennyInvestors: 5,
    });

    const bidResponse = await request(app)
      .post(`/api/startups/${startup._id}/bid`)
      .set(authHeader(investor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 100000,
        proposedEquityPercent: 4,
        chosenRole: 'shareholder',
      });

    expect(bidResponse.status).toBe(201);

    const counterResponse = await request(app)
      .post(`/api/deals/${bidResponse.body.data._id}/negotiation-propose`)
      .set(authHeader(founder))
      .send({
        amountINR: 100000,
        equityPercent: 3,
      });

    expect(counterResponse.status).toBe(200);
    expect(counterResponse.body.data).toEqual(
      expect.objectContaining({
        status: 'counter_offer',
        investorAgreed: false,
        startupAgreed: true,
        studentCounterAmount: 100000,
        studentCounterEquity: 3,
      }),
    );

    const renegotiateResponse = await request(app)
      .post(`/api/deals/${bidResponse.body.data._id}/negotiation-propose`)
      .set(authHeader(investor));

    expect(renegotiateResponse.status).toBe(400);

    const validRenegotiateResponse = await request(app)
      .post(`/api/deals/${bidResponse.body.data._id}/negotiation-propose`)
      .set(authHeader(investor))
      .send({
        amountINR: 110000,
        equityPercent: 4,
      });

    expect(validRenegotiateResponse.status).toBe(200);
    expect(validRenegotiateResponse.body.data).toEqual(
      expect.objectContaining({
        status: 'terms_proposed',
        investorAgreed: true,
        startupAgreed: false,
        investorProposedAmount: 110000,
        investorProposedEquity: 4,
      }),
    );

    const investorAgreeAgainResponse = await request(app)
      .post(`/api/deals/${bidResponse.body.data._id}/negotiation-agree`)
      .set(authHeader(investor));

    expect(investorAgreeAgainResponse.status).toBe(200);
    expect(investorAgreeAgainResponse.body.data.status).toBe('terms_proposed');

    const detailResponse = await request(app)
      .get(`/api/deals/${bidResponse.body.data._id}`)
      .set(authHeader(investor));

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data).toEqual(
      expect.objectContaining({
        currentStage: 0,
        amountINR: 100000,
        equityPercent: 4,
        adminApprovalRequired: false,
        negotiation: expect.objectContaining({
          status: 'terms_proposed',
          investorAgreed: true,
          startupAgreed: false,
        }),
        stockTransfer: expect.objectContaining({ status: 'not_started' }),
      }),
    );

    const founderAcceptResponse = await request(app)
      .post(`/api/deals/${bidResponse.body.data._id}/negotiation-agree`)
      .set(authHeader(founder));

    expect(founderAcceptResponse.status).toBe(200);
    expect(founderAcceptResponse.body.data).toEqual(
      expect.objectContaining({
        status: 'terms_agreed',
        investorAgreed: true,
        startupAgreed: true,
        finalAgreedAmount: 110000,
        finalAgreedEquity: 4,
      }),
    );
  });

  it('lets either participant cancel an active bid or deal before final closure', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Cancel Founder' });
    const investor = await createUser(UserRole.INVESTOR, { displayName: 'Cancel Investor' });
    const studentBidder = await createUser(UserRole.STUDENT, { displayName: 'Cancel Student Bidder' });
    const startup = await createStartup(founder._id.toString(), { maxPennyInvestors: 5 });

    const investorBidResponse = await request(app)
      .post(`/api/startups/${startup._id}/bid`)
      .set(authHeader(investor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 30000,
        proposedEquityPercent: 2,
        chosenRole: 'shareholder',
      });

    expect(investorBidResponse.status).toBe(201);

    const founderCancelResponse = await request(app)
      .post(`/api/deals/${investorBidResponse.body.data._id}/cancel`)
      .set(authHeader(founder))
      .send({ reason: 'Not raising from this investor right now.' });

    expect(founderCancelResponse.status).toBe(200);
    expect(founderCancelResponse.body.data).toEqual(
      expect.objectContaining({
        status: 'cancelled',
        mediationStatus: 'rejected',
        founderDecision: expect.objectContaining({
          status: 'rejected',
          note: 'Not raising from this investor right now.',
        }),
        negotiation: expect.objectContaining({
          status: 'cancelled',
        }),
      }),
    );

    const studentBidResponse = await request(app)
      .post(`/api/startups/${startup._id}/bid`)
      .set(authHeader(studentBidder))
      .send({
        investorType: 'penny',
        proposedAmountINR: 35000,
        proposedEquityPercent: 2,
        chosenRole: 'observer',
      });

    expect(studentBidResponse.status).toBe(201);

    const bidderCancelResponse = await request(app)
      .post(`/api/deals/${studentBidResponse.body.data._id}/cancel`)
      .set(authHeader(studentBidder))
      .send({ reason: 'Withdrawing my bid.' });

    expect(bidderCancelResponse.status).toBe(200);
    expect(bidderCancelResponse.body.data).toEqual(
      expect.objectContaining({
        status: 'cancelled',
        negotiation: expect.objectContaining({
          status: 'cancelled',
          notes: 'Withdrawing my bid.',
        }),
      }),
    );
  });

  it('routes agreed deal cancellation through admin review and locks admin-approved deals', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Admin Cancel Founder' });
    const investor = await createUser(UserRole.INVESTOR, { displayName: 'Admin Cancel Investor' });
    const admin = await createUser(UserRole.ADMIN, { displayName: 'Admin Cancel Reviewer' });
    const startup = await createStartup(founder._id.toString(), { maxPennyInvestors: 5 });

    const bidResponse = await request(app)
      .post(`/api/startups/${startup._id}/bid`)
      .set(authHeader(investor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 50000,
        proposedEquityPercent: 3,
        chosenRole: 'shareholder',
      });

    expect(bidResponse.status).toBe(201);
    await agreeToCurrentTerms({ dealId: bidResponse.body.data._id, participant: founder });

    const cancellationRequestResponse = await request(app)
      .post(`/api/deals/${bidResponse.body.data._id}/cancel`)
      .set(authHeader(investor))
      .send({ reason: 'Investor needs admin-reviewed withdrawal.' });

    expect(cancellationRequestResponse.status).toBe(200);
    expect(cancellationRequestResponse.body.data).toEqual(
      expect.objectContaining({
        status: 'active',
        mediationStatus: 'under_review',
        cancellationRequest: expect.objectContaining({
          status: 'pending',
          reason: 'Investor needs admin-reviewed withdrawal.',
          requestedByRole: 'investor',
        }),
      }),
    );

    const duplicateRequestResponse = await request(app)
      .post(`/api/deals/${bidResponse.body.data._id}/cancel`)
      .set(authHeader(founder));

    expect(duplicateRequestResponse.status).toBe(409);
    expect(duplicateRequestResponse.body.error.code).toBe('DEAL_CANCELLATION_REQUEST_PENDING');

    const adminDealsResponse = await request(app)
      .get('/api/admin/deals')
      .set(authHeader(admin));

    expect(adminDealsResponse.status).toBe(200);
    expect(adminDealsResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: bidResponse.body.data._id,
          nextActionLabel: 'Review cancellation request',
          cancellationRequest: expect.objectContaining({ status: 'pending' }),
        }),
      ]),
    );

    const approveCancellationResponse = await request(app)
      .patch(`/api/admin/deals/${bidResponse.body.data._id}/cancellation`)
      .set(authHeader(admin))
      .send({ decision: 'approved', reviewNotes: 'Cancellation approved before transfer approval.' });

    expect(approveCancellationResponse.status).toBe(200);
    expect(approveCancellationResponse.body.data).toEqual(
      expect.objectContaining({
        status: 'cancelled',
        cancellationRequest: expect.objectContaining({
          status: 'approved',
          reviewNotes: 'Cancellation approved before transfer approval.',
        }),
      }),
    );

    const approvedStartup = await createStartup(founder._id.toString(), {
      name: 'Approved Cancellation Lock',
      maxPennyInvestors: 5,
    });
    const approvedBidResponse = await request(app)
      .post(`/api/startups/${approvedStartup._id}/bid`)
      .set(authHeader(investor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 60000,
        proposedEquityPercent: 3,
        chosenRole: 'shareholder',
      });

    expect(approvedBidResponse.status).toBe(201);
    await approveDealThroughAdmin({
      founder,
      investor,
      admin,
      dealId: approvedBidResponse.body.data._id,
      amountINR: 60000,
      equityPercent: 3,
      investorRole: 'shareholder',
    });

    const lockedCancellationResponse = await request(app)
      .post(`/api/deals/${approvedBidResponse.body.data._id}/cancel`)
      .set(authHeader(investor))
      .send({ reason: 'Trying to cancel after approval.' });

    expect(lockedCancellationResponse.status).toBe(400);
    expect(lockedCancellationResponse.body.error.code).toBe('DEAL_CANCELLATION_LOCKED');
  });
});
