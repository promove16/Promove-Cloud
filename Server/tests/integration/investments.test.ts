import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
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
    innovationScoreAtLaunch: 88,
    traction: {
      patentFiled: false,
      mvpBuilt: true,
      revenueGenerating: false,
    },
    ...overrides,
  });

describe('investment workflow integration', () => {
  it('creates a penny investment and increments startup counters', async () => {
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

    const updatedStartup = await Startup.findById(startup._id).lean();
    expect(updatedStartup?.currentPennyCount).toBe(1);
    expect(updatedStartup?.availableShares).toBe(980);
  });

  it('creates a sole investment and blocks a second sole investor', async () => {
    const founder = await createUser(UserRole.STUDENT, { displayName: 'Founder Two' });
    const firstSole = await createUser(UserRole.INVESTOR, { displayName: 'Lead Investor' });
    const secondSole = await createUser(UserRole.INVESTOR, { displayName: 'Backup Investor' });
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

    const secondResponse = await request(app)
      .post(`/api/startups/${startup._id}/sole-investor`)
      .set(authHeader(secondSole))
      .send({
        investorType: 'sole',
        proposedAmountINR: 250000,
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
    const startup = await createStartup(founder._id.toString());

    await request(app)
      .post(`/api/startups/${startup._id}/sole-investor`)
      .set(authHeader(soleInvestor))
      .send({
        investorType: 'sole',
        proposedAmountINR: 300000,
        proposedEquityPercent: 60,
        chosenRole: 'director',
      });

    await request(app)
      .post(`/api/investor/express-interest/${startup._id}`)
      .set(authHeader(pennyInvestor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 20000,
        proposedEquityPercent: 2,
        chosenRole: 'shareholder',
      });

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

  it('returns veto authority only for a sole director', async () => {
    const founder = await createUser(UserRole.STUDENT);
    const soleInvestor = await createUser(UserRole.INVESTOR, { displayName: 'Director Lead' });
    const pennyInvestor = await createUser(UserRole.INVESTOR, { displayName: 'Observer Penny' });
    const startup = await createStartup(founder._id.toString());

    await request(app)
      .post(`/api/startups/${startup._id}/sole-investor`)
      .set(authHeader(soleInvestor))
      .send({
        investorType: 'sole',
        proposedAmountINR: 250000,
        proposedEquityPercent: 60,
        chosenRole: 'director',
      });

    await request(app)
      .post(`/api/investor/express-interest/${startup._id}`)
      .set(authHeader(pennyInvestor))
      .send({
        investorType: 'penny',
        proposedAmountINR: 20000,
        proposedEquityPercent: 2,
        chosenRole: 'observer',
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
});
