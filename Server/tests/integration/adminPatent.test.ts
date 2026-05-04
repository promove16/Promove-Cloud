import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { ScoreEvent } from '../../src/modules/innovationScore/score.model';
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

  it('awards patent submission score only after first admin verification and approval score per patent', async () => {
    const { email: adminEmail } = await createApprovedUser({
      role: UserRole.ADMIN,
      displayName: 'Patent Score Admin',
    });
    const { user: studentUser } = await createApprovedUser({
      role: UserRole.STUDENT,
      displayName: 'Patent Score Student',
    });

    const patentPayload = {
      studentId: studentUser._id,
      questionnaire: {
        problemStatement: 'A verified patent scoring workflow problem statement.',
        solutionDifferentiation: 'A verified patent scoring workflow solution.',
        coreInnovation: 'Verified patent score gating.',
        priorArtStatus: 'Prior art has been checked.',
        workingMechanism: 'Admin approval verifies patent score eligibility.',
        keyComponents: 'Patent submission, admin review, score event.',
        developmentStage: 'prototype',
        documentationReadiness: 'Patent documents are ready.',
        inventorOwnership: 'team',
        developmentContext: 'Student product workspace.',
        targetMarkets: 'Student innovation programs.',
        commercializationStrategy: 'build_startup',
        publicDisclosureStatus: 'No public disclosure.',
        legalAgreements: 'No conflicting agreements.',
        ipProtectionType: 'patent',
      },
      supportingDocuments: [],
      status: 'submitted',
      submittedAt: new Date(),
      scoreAwarded: false,
      showcasedInMarketplace: false,
    };

    const firstPatent = await Patent.create({
      ...patentPayload,
      projectTitle: 'First Verified Patent',
    });
    const secondPatent = await Patent.create({
      ...patentPayload,
      projectTitle: 'Second Verified Patent',
    });

    const accessToken = await loginAs(adminEmail);

    const firstApproval = await request(app)
      .patch(`/api/admin/patents/${firstPatent._id.toString()}/approve`)
      .set('Authorization', `Bearer ${accessToken}`);
    const scoreAfterFirst = await User.findById(studentUser._id).select('innovationScore scoreBreakdown').lean();

    const secondApproval = await request(app)
      .patch(`/api/admin/patents/${secondPatent._id.toString()}/approve`)
      .set('Authorization', `Bearer ${accessToken}`);
    const scoreAfterSecond = await User.findById(studentUser._id).select('innovationScore scoreBreakdown').lean();

    expect(firstApproval.status).toBe(200);
    expect(firstApproval.body.data.newScore).toBe(200);
    expect(scoreAfterFirst?.innovationScore).toBe(200);
    expect(scoreAfterFirst?.scoreBreakdown.patentsSubmitted).toBe(1);
    expect(scoreAfterFirst?.scoreBreakdown.patentsApproved).toBe(1);

    expect(secondApproval.status).toBe(200);
    expect(secondApproval.body.data.newScore).toBe(325);
    expect(scoreAfterSecond?.innovationScore).toBe(325);
    expect(scoreAfterSecond?.scoreBreakdown.patentsSubmitted).toBe(1);
    expect(scoreAfterSecond?.scoreBreakdown.patentsApproved).toBe(2);

    const events = await ScoreEvent.find({ userId: studentUser._id }).sort({ createdAt: 1 }).lean();
    expect(events.map((event) => event.trigger)).toEqual([
      'PATENT_SUBMITTED',
      'PATENT_APPROVED',
      'PATENT_APPROVED',
    ]);
    expect(events.map((event) => event.delta)).toEqual([75, 125, 125]);
  });
});
