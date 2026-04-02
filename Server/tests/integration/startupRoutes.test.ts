import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
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

describe('startup route validation', () => {
  it('rejects non-ObjectId startup ids before mongoose casting', async () => {
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
});
