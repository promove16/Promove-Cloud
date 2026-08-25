import { Request, Response } from 'express';
import { sendMessage } from '../../src/modules/dm/dm.controller';
import { Settings } from '../../src/modules/settings/settings.model';
import { Startup } from '../../src/modules/startup/startup.model';
import { User } from '../../src/modules/user/user.model';
import { UserRole } from '../../src/types/roles.types';

const createUser = (role: UserRole, displayName: string) =>
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
  });

const createStartup = (
  founderId: string,
  overrides: { name: string; launchedToInvestors: boolean; reviewStatus: 'approved' | 'draft' },
) =>
  Startup.create({
    founderIds: [founderId],
    name: overrides.name,
    tagline: 'Marketplace pitch eligibility test',
    category: 'CleanTech',
    stage: overrides.launchedToInvestors ? 'Launched' : 'Pre-Launch',
    launchedToInvestors: overrides.launchedToInvestors,
    reviewStatus: overrides.reviewStatus,
    innovationScoreAtLaunch: overrides.launchedToInvestors ? 80 : 0,
    activeProducts: 1,
    teamSize: 1,
    traction: {
      patentFiled: false,
      mvpBuilt: true,
      revenueGenerating: false,
    },
  });

const sendPitch = async (params: {
  founder: Awaited<ReturnType<typeof createUser>>;
  investor: Awaited<ReturnType<typeof createUser>>;
  startupId: string;
}) => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const req = {
    user: {
      _id: String(params.founder._id),
      email: params.founder.email,
      role: params.founder.role,
    },
    params: { userId: String(params.investor._id) },
    body: {
      message: 'Please review our marketplace startup.',
      messageType: 'text',
      queryType: 'investor',
      pitchContext: { startupId: params.startupId },
    },
  } as unknown as Request;
  const res = { status, json } as unknown as Response;

  await sendMessage(req, res);

  return { json, status };
};

describe('investor pitch DM access', () => {
  it('allows an approved live startup pitch as a connection request', async () => {
    const founder = await createUser(UserRole.STUDENT, 'Marketplace Pitch Founder');
    const investor = await createUser(UserRole.INVESTOR, 'Connection Only Investor');
    const startup = await createStartup(String(founder._id), {
      name: 'Verified Marketplace Pitch',
      launchedToInvestors: true,
      reviewStatus: 'approved',
    });
    await Settings.create({
      userId: investor._id,
      privacy: { allowDMs: 'connections' },
    });

    const response = await sendPitch({
      founder,
      investor,
      startupId: String(startup._id),
    });

    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        queryType: 'investor',
        startupId: String(startup._id),
      }),
    });
  });

  it('rejects a pitch when the startup is not approved and live', async () => {
    const founder = await createUser(UserRole.STUDENT, 'Draft Pitch Founder');
    const investor = await createUser(UserRole.INVESTOR, 'Draft Pitch Investor');
    const startup = await createStartup(String(founder._id), {
      name: 'Draft Marketplace Pitch',
      launchedToInvestors: false,
      reviewStatus: 'draft',
    });

    await expect(
      sendPitch({ founder, investor, startupId: String(startup._id) }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVESTOR_PITCH_NOT_ELIGIBLE',
    });
  });

  it('continues to block pitches when the investor disables direct messages', async () => {
    const founder = await createUser(UserRole.STUDENT, 'Closed Pitch Founder');
    const investor = await createUser(UserRole.INVESTOR, 'Closed Pitch Investor');
    const startup = await createStartup(String(founder._id), {
      name: 'Closed Investor Marketplace Pitch',
      launchedToInvestors: true,
      reviewStatus: 'approved',
    });
    await Settings.create({
      userId: investor._id,
      privacy: { allowDMs: 'none' },
    });

    await expect(
      sendPitch({ founder, investor, startupId: String(startup._id) }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'DM_PERMISSION_DENIED',
    });
  });
});
