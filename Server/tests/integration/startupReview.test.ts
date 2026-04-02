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
});
