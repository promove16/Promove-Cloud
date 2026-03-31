import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { Patent } from '../../src/modules/patent/patent.model';
import { User } from '../../src/modules/user/user.model';
import { UserRole } from '../../src/types/roles.types';

const PASSWORD = 'Password123!';

const createApprovedUser = async (input: {
  role: UserRole;
  email?: string;
  displayName?: string;
}) => {
  const email = input.email ?? `${input.role}-${randomUUID()}@example.com`;
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const user = await User.create({
    email,
    passwordHash,
    role: input.role,
    displayName: input.displayName ?? `${input.role} user`,
    profileComplete: true,
    registrationStage: input.role === UserRole.STUDENT ? 'profile_setup' : 'complete',
    accessGrantedBy: 'admin',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    institutionToken: null,
    institutionId: null,
    institutionVerificationStatus: 'none',
    verificationStatus: input.role === UserRole.STUDENT ? 'verified' : 'not_required',
    adminApprovalStatus: input.role === UserRole.STUDENT ? 'not_required' : 'approved',
    adminApprovedAt: input.role === UserRole.STUDENT ? undefined : new Date(),
  });

  return { user, email };
};

const loginAs = async (email: string) => {
  const response = await request(app).post('/api/auth/login').send({
    email,
    password: PASSWORD,
  });

  return response.body.data?.accessToken as string;
};

describe('admin patent review integration', () => {
  it('rejects a legacy patent record that is missing filingDocuments', async () => {
    const { user: adminUser, email: adminEmail } = await createApprovedUser({
      role: UserRole.ADMIN,
      displayName: 'Admin Reviewer',
    });
    const { user: studentUser } = await createApprovedUser({
      role: UserRole.STUDENT,
      displayName: 'Patent Student',
    });

    const insertResult = await Patent.collection.insertOne({
      studentId: studentUser._id,
      projectTitle: 'Legacy Patent Submission',
      questionnaire: {
        whatIsYourInnovation: 'A legacy patent created before filing checklists were introduced.',
        noveltyExplanation: 'It uses an earlier schema version and intentionally omits filing documents.',
        technicalDetails: 'The admin review workflow should still be able to review this record safely.',
        marketUseCase: 'This test confirms that review actions do not fail on legacy saved data.',
        priorArtAwareness: 'Legacy data may not satisfy newer schema requirements during later updates.',
      },
      supportingDocuments: [],
      status: 'submitted',
      submittedAt: new Date(),
      scoreAwarded: false,
      showcasedInMarketplace: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const accessToken = await loginAs(adminEmail);

    const response = await request(app)
      .patch(`/api/admin/patents/${insertResult.insertedId.toString()}/reject`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        adminNotes: 'Legacy patent submission rejected because the filing checklist is incomplete.',
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ rejected: true });

    const updatedPatent = await Patent.findById(insertResult.insertedId).lean();
    expect(updatedPatent?.status).toBe('rejected');
    expect(updatedPatent?.adminNotes).toBe('Legacy patent submission rejected because the filing checklist is incomplete.');
    expect(String(updatedPatent?.adminReviewedBy)).toBe(adminUser._id.toString());
    expect(updatedPatent?.adminReviewedAt).toBeTruthy();
    expect(updatedPatent?.filingDocuments).toBeUndefined();
  });
});
