import jwt from 'jsonwebtoken';
import request from 'supertest';
import { env } from '../../src/config/env';
import { User } from '../../src/modules/user/user.model';
import { UserRole } from '../../src/types/roles.types';

jest.mock(
  'compression',
  () => () => (_req: unknown, _res: unknown, next: () => void) => next(),
  { virtual: true },
);

import app from '../../src/app';

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

const createUser = async (
  role: UserRole,
  overrides: Partial<Record<string, unknown>> = {},
) =>
  User.create({
    email: `${role}-${Math.random().toString(36).slice(2, 10)}@example.com`,
    passwordHash: 'hashed-password',
    role,
    displayName: `${role} user`,
    accessGrantedBy: 'self_registered',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    profileComplete: true,
    ...overrides,
  });

describe('marketplace integration', () => {
  it('allows mentor dashboards to browse investor marketplace profiles', async () => {
    const mentor = await createUser(UserRole.MENTOR, { displayName: 'Mentor Viewer' });
    const investor = await createUser(UserRole.INVESTOR, {
      displayName: 'Seed Partner',
      headline: 'Early stage investor',
      domain: 'Fintech',
    });

    const response = await request(app)
      .get('/api/marketplace?role=investor')
      .set(authHeader(mentor));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: investor._id.toString(),
          entityType: 'investor',
          displayName: 'Seed Partner',
        }),
      ]),
    );
  });

  it('supports HR aliases and search-driven recruiter filtering', async () => {
    const admin = await createUser(UserRole.ADMIN, { displayName: 'Admin Viewer' });
    const recruiter = await createUser(UserRole.RECRUITER, {
      displayName: 'Campus Hiring Lead',
      headline: 'Campus hiring and intern programs',
      domain: 'Talent',
      skills: [{ name: 'University Recruiting', level: 'advanced' }],
    });
    await createUser(UserRole.RECRUITER, {
      displayName: 'Enterprise Recruiter',
      headline: 'Senior lateral hiring',
      domain: 'People Ops',
    });

    const listResponse = await request(app)
      .get('/api/marketplace?role=hrs&q=campus')
      .set(authHeader(admin));

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.data[0]).toEqual(
      expect.objectContaining({
        _id: recruiter._id.toString(),
        entityType: 'recruiter',
        displayName: 'Campus Hiring Lead',
      }),
    );

    const detailResponse = await request(app)
      .get(`/api/marketplace/entities/hr/${recruiter._id.toString()}`)
      .set(authHeader(admin));

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data).toEqual(
      expect.objectContaining({
        _id: recruiter._id.toString(),
        entityType: 'recruiter',
        displayName: 'Campus Hiring Lead',
      }),
    );
  });
});
