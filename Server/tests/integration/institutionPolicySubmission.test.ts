import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { User } from '../../src/modules/user/user.model';
import { UserRole } from '../../src/types/roles.types';

const PASSWORD = 'Password123!';

const createApprovedUser = async (input: {
  role: UserRole;
  email?: string;
  displayName?: string;
  policies?: Array<{
    name: string;
    status: 'Active' | 'On Track' | 'Pending' | 'Inactive';
    lastUpdated?: Date;
    evidence: Array<{
      title: string;
      type: 'policy_document';
      url: string;
      submittedAt?: Date;
    }>;
  }>;
}) => {
  const email = input.email ?? `${input.role}-${randomUUID()}@example.com`;
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const isInstitution = input.role === UserRole.SCHOOL || input.role === UserRole.COLLEGE;

  const user = await User.create({
    email,
    passwordHash,
    role: input.role,
    displayName: input.displayName ?? `${input.role} user`,
    profileComplete: true,
    registrationStage: isInstitution ? 'complete' : 'profile_setup',
    accessGrantedBy: 'admin',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    institutionToken: null,
    institutionId: null,
    ...(isInstitution
      ? {
          institutionProfile: {
            institutionName: input.displayName ?? 'Test Institution',
            location: 'Bengaluru',
            totalStudentsEnrolled: 1200,
            academicYear: '2026-27',
            iicStarRating: 0,
            specialties: [],
            locations: [],
            policies: input.policies ?? [],
            stats: {
              totalInnovationActivities: 0,
              patentsFiled: 0,
              totalMentoringHours: 0,
              startupsLaunched: 0,
              industryCollaborations: 0,
            },
          },
        }
      : {}),
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

describe('institution policy submissions', () => {
  it('accepts a partial packet and ignores unsubmitted framework rows', async () => {
    const { email } = await createApprovedUser({
      role: UserRole.SCHOOL,
      email: `school-${randomUUID()}@example.com`,
    });
    const accessToken = await loginAs(email);

    const response = await request(app)
      .put('/api/school/compliance/submission')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        policies: [
          {
            name: 'IIC (Institution Innovation Council)',
            status: 'Pending',
            lastUpdated: '2026-05-02',
            evidence: [
              {
                title: '',
                type: 'policy_document',
                url: 'https://example.com/iic-policy.pdf',
              },
            ],
          },
          {
            name: 'Attendance Governance',
            status: 'Pending',
            evidence: [{ title: '', type: 'policy_document', url: '' }],
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.data.policies).toHaveLength(1);
    expect(response.body.data.policies[0]).toMatchObject({
      name: 'IIC (Institution Innovation Council)',
      status: 'Pending',
      evidence: [
        {
          title: 'policy document',
          type: 'policy_document',
          url: 'https://example.com/iic-policy.pdf',
        },
      ],
    });
  });

  it('keeps submitted evidence immutable while allowing new evidence on a pending packet', async () => {
    const { email } = await createApprovedUser({
      role: UserRole.SCHOOL,
      email: `school-${randomUUID()}@example.com`,
    });
    const accessToken = await loginAs(email);

    const firstResponse = await request(app)
      .put('/api/school/compliance/submission')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        policies: [
          {
            name: 'IIC (Institution Innovation Council)',
            status: 'Pending',
            evidence: [
              {
                title: 'Original proof',
                type: 'policy_document',
                url: 'https://example.com/iic-original.pdf',
              },
            ],
          },
        ],
      });

    expect(firstResponse.status).toBe(200);

    const noNewEvidenceResponse = await request(app)
      .put('/api/school/compliance/submission')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        policies: [
          {
            name: 'IIC (Institution Innovation Council)',
            status: 'Pending',
            evidence: [
              {
                title: 'Edited proof should not replace submitted proof',
                type: 'activity_report',
                url: 'https://example.com/iic-original.pdf',
              },
            ],
          },
        ],
      });

    expect(noNewEvidenceResponse.status).toBe(409);
    expect(noNewEvidenceResponse.body.error.code).toBe('COMPLIANCE_SUBMISSION_NO_NEW_EVIDENCE');

    const addEvidenceResponse = await request(app)
      .put('/api/school/compliance/submission')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        policies: [
          {
            name: 'IIC (Institution Innovation Council)',
            status: 'On Track',
            evidence: [
              {
                title: 'Edited proof should not replace submitted proof',
                type: 'activity_report',
                url: 'https://example.com/iic-original.pdf',
              },
              {
                title: 'Fresh activity report',
                type: 'activity_report',
                url: 'https://example.com/iic-new-report.pdf',
              },
            ],
          },
        ],
      });

    expect(addEvidenceResponse.status).toBe(200);
    expect(addEvidenceResponse.body.data.policies[0]).toMatchObject({
      name: 'IIC (Institution Innovation Council)',
      status: 'On Track',
      evidence: [
        {
          title: 'Original proof',
          type: 'policy_document',
          url: 'https://example.com/iic-original.pdf',
        },
        {
          title: 'Fresh activity report',
          type: 'activity_report',
          url: 'https://example.com/iic-new-report.pdf',
        },
      ],
    });
  });

  it('merges approved partial rows into existing institution policies', async () => {
    const existingPolicyDate = new Date('2026-04-15T00:00:00.000Z');
    const { user: school, email: schoolEmail } = await createApprovedUser({
      role: UserRole.SCHOOL,
      email: `school-${randomUUID()}@example.com`,
      policies: [
        {
          name: 'NEP 2020 Compliance',
          status: 'Active',
          lastUpdated: existingPolicyDate,
          evidence: [
            {
              title: 'Existing NEP proof',
              type: 'policy_document',
              url: 'https://example.com/nep-existing.pdf',
              submittedAt: existingPolicyDate,
            },
          ],
        },
      ],
    });
    const { email: adminEmail } = await createApprovedUser({
      role: UserRole.ADMIN,
      email: `admin-${randomUUID()}@example.com`,
    });
    const schoolAccessToken = await loginAs(schoolEmail);
    const adminAccessToken = await loginAs(adminEmail);

    const submitResponse = await request(app)
      .put('/api/school/compliance/submission')
      .set('Authorization', `Bearer ${schoolAccessToken}`)
      .send({
        policies: [
          {
            name: 'IIC (Institution Innovation Council)',
            status: 'On Track',
            evidence: [
              {
                title: '',
                type: 'policy_document',
                url: 'https://example.com/iic-updated.pdf',
              },
            ],
          },
        ],
      });

    expect(submitResponse.status).toBe(200);

    const reviewResponse = await request(app)
      .patch(`/api/admin/compliance-submissions/${submitResponse.body.data._id}/review`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ decision: 'approved' });

    expect(reviewResponse.status).toBe(200);

    const storedSchool = await User.findById(school._id).lean();
    expect(storedSchool?.institutionProfile?.policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'NEP 2020 Compliance',
          status: 'Active',
        }),
        expect.objectContaining({
          name: 'IIC (Institution Innovation Council)',
          status: 'On Track',
          evidence: [
            expect.objectContaining({
              title: 'policy document',
              url: 'https://example.com/iic-updated.pdf',
            }),
          ],
        }),
      ]),
    );
    expect(storedSchool?.institutionProfile?.policies).toHaveLength(2);
  });
});
