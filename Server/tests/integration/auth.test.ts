import bcrypt from 'bcrypt';
import ExcelJS from 'exceljs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { redis } from '../../src/config/redis';
import { InstitutionStudentRosterEntry } from '../../src/modules/institution/studentRoster.model';
import { StudentAccessToken } from '../../src/modules/institution/studentAccessToken.model';
import { User } from '../../src/modules/user/user.model';
import {
  sendInstitutionStudentInviteEmail,
  sendTemporaryStudentCredentialsEmail,
} from '../../src/services/emailService';
import { UserRole } from '../../src/types/roles.types';

const PASSWORD = 'Password123!';

jest.mock('../../src/services/fileStorageService', () => ({
  uploadFile: jest.fn(async ({ folder, fileName }: { folder: string; fileName: string }) => ({
    url: `https://s3.test/${folder}/${fileName}-${randomUUID()}`,
    key: `mock-${randomUUID()}`,
    provider: 's3',
  })),
  deleteStoredAsset: jest.fn(async () => undefined),
}));

jest.mock('../../src/services/emailService', () => ({
  sendTemporaryStudentCredentialsEmail: jest.fn(async () => undefined),
  sendInstitutionStudentInviteEmail: jest.fn(async () => undefined),
}));

const createApprovedUser = async (input: {
  role: UserRole;
  email?: string;
  displayName?: string;
  domain?: string;
  institutionProfile?: {
    institutionName: string;
    location: string;
    totalStudentsEnrolled: number;
    academicYear: string;
    iicStarRating?: number;
  };
}) => {
  const email = input.email ?? `${input.role}-${randomUUID()}@example.com`;
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const user = await User.create({
    email,
    passwordHash,
    role: input.role,
    displayName: input.displayName ?? `${input.role} user`,
    ...(input.domain ? { domain: input.domain } : {}),
    ...(input.institutionProfile ? { institutionProfile: input.institutionProfile } : {}),
    profileComplete: true,
    registrationStage:
      input.role === UserRole.SCHOOL || input.role === UserRole.COLLEGE ? 'complete' : 'profile_setup',
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

const loginAs = async (email: string, password = PASSWORD) => {
  const response = await request(app).post('/api/auth/login').send({
    email,
    password,
  });

  return {
    response,
    accessToken: response.body.data?.accessToken as string | undefined,
    cookie: response.headers['set-cookie']?.[0],
  };
};

const createInstitutionToken = async (role: UserRole.SCHOOL | UserRole.COLLEGE, email: string) => {
  const login = await loginAs(email);
  const endpoint = role === UserRole.SCHOOL ? '/api/school/student-access-tokens' : '/api/college/student-access-tokens';
  const response = await request(app)
    .post(endpoint)
    .set('Authorization', `Bearer ${login.accessToken}`)
    .send({ label: 'Admissions' });

  return {
    response,
    token: response.body.data.token as string,
    accessToken: login.accessToken!,
  };
};

const attachInstitutionDocuments = (
  req: request.Test,
  categories: string[],
) => {
  let currentRequest = req;

  for (const category of categories) {
    currentRequest = currentRequest.attach(
      `institutionDocument:${category}`,
      Buffer.from(`mock-${category}`),
      `${category}.pdf`,
    );
  }

  return currentRequest;
};

describe('auth integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('rejects student signup without an institution token', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: `student-${randomUUID()}@example.com`,
        password: PASSWORD,
        displayName: 'Student User',
        role: 'student',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'institutionToken' }),
        ]),
      );
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('creates a pending student account when the institution token is valid', async () => {
      const schoolEmail = `coordinator-${randomUUID()}@school.test`;
      await createApprovedUser({
        role: UserRole.SCHOOL,
        email: schoolEmail,
        displayName: 'Test School',
        institutionProfile: {
          institutionName: 'Test School',
          location: 'Hyderabad',
          totalStudentsEnrolled: 1200,
          academicYear: '2025-26',
        },
      });
      const { token } = await createInstitutionToken(UserRole.SCHOOL, schoolEmail);

      const response = await request(app).post('/api/auth/register').send({
        email: `student-${randomUUID()}@school.test`,
        password: PASSWORD,
        displayName: 'Student User',
        role: 'student',
        institutionToken: token,
      });

      expect(response.status).toBe(201);
      expect(response.body.data.pendingApproval).toBe(true);
      expect(response.body.data.approvalType).toBe('institution');
      expect(response.body.data.user.accessGrantedBy).toBe('institution_token');
      expect(response.body.data.user.verificationStatus).toBe('pending');
      expect(response.body.data.user.institutionVerificationStatus).toBe('verified');
      expect(response.body.data.user.isActive).toBe(false);
      expect(response.headers['set-cookie']).toBeUndefined();

      const created = await User.findOne({ email: response.body.data.user.email }).lean();
      expect(created?.institutionId).toBeTruthy();
      expect(created?.verificationStatus).toBe('pending');
      expect(created?.isActive).toBe(false);
    });

    it('links rostered student signup to the same institution when token and email match', async () => {
      const schoolEmail = `roster-${randomUUID()}@school.test`;
      await createApprovedUser({
        role: UserRole.SCHOOL,
        email: schoolEmail,
        displayName: 'Roster School',
        institutionProfile: {
          institutionName: 'Roster School',
          location: 'Delhi',
          totalStudentsEnrolled: 900,
          academicYear: '2025-26',
        },
      });

      const { token, accessToken } = await createInstitutionToken(UserRole.SCHOOL, schoolEmail);

      const rosterEmail = `student-${randomUUID()}@school.test`;
      const rosterResponse = await request(app)
        .post('/api/school/student-roster/manual')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          displayName: 'Roster Student',
          email: rosterEmail,
          gradeOrProgram: 'Class 12',
          rollNumber: 'SCH-100',
        });

      expect(rosterResponse.status).toBe(201);

      const response = await request(app).post('/api/auth/register').send({
        email: rosterEmail,
        password: PASSWORD,
        displayName: 'Roster Student',
        role: 'student',
        institutionToken: token,
      });

      expect(response.status).toBe(201);
      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(response.body.data.user.accessGrantedBy).toBe('institution_roster');
      expect(response.body.data.user.verificationStatus).toBe('verified');
      expect(response.body.data.user.institutionVerificationStatus).toBe('verified');
      expect(response.body.data.user.isActive).toBe(true);
      expect(response.body.data.user.registrationStage).toBe('institution_verified');
      expect(response.headers['set-cookie']?.[0]).toContain('refreshToken=');

      const created = await User.findOne({ email: rosterEmail }).lean();
      expect(created?.verificationStatus).toBe('verified');
      expect(created?.isActive).toBe(true);

      const rosterEntry = await InstitutionStudentRosterEntry.findOne({ email: rosterEmail }).lean();
      expect(rosterEntry?.status).toBe('verified');
      expect(String(rosterEntry?.linkedUserId)).toBe(String(created?._id));

      const pendingResponse = await request(app)
        .get('/api/school/student-verifications')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(pendingResponse.status).toBe(200);
      expect(pendingResponse.body.data).toHaveLength(0);

      const loginResponse = await request(app).post('/api/auth/login').send({
        email: rosterEmail,
        password: PASSWORD,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data.user.verificationStatus).toBe('verified');
    });

    it('sends a roster invite email when a school adds a student manually', async () => {
      const schoolEmail = `manual-${randomUUID()}@school.test`;
      await createApprovedUser({
        role: UserRole.SCHOOL,
        email: schoolEmail,
        displayName: 'Manual Invite School',
        institutionProfile: {
          institutionName: 'Manual Invite School',
          location: 'Mumbai',
          totalStudentsEnrolled: 640,
          academicYear: '2025-26',
        },
      });

      const { token, accessToken } = await createInstitutionToken(UserRole.SCHOOL, schoolEmail);
      const rosterEmail = `manual-invite-${randomUUID()}@school.test`;

      const response = await request(app)
        .post('/api/school/student-roster/manual')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          displayName: 'Invite Student',
          email: rosterEmail,
          gradeOrProgram: 'Class 11',
        });

      expect(response.status).toBe(201);
      expect(sendInstitutionStudentInviteEmail).toHaveBeenCalledTimes(1);
      expect(sendInstitutionStudentInviteEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: rosterEmail,
          studentEmail: rosterEmail,
          institutionName: 'Manual Invite School',
          institutionRole: UserRole.SCHOOL,
          inviteLink: expect.stringContaining(`inviteeEmail=${encodeURIComponent(rosterEmail)}`),
        }),
      );
      expect(sendInstitutionStudentInviteEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          inviteLink: expect.stringContaining(`institutionToken=${encodeURIComponent(token)}`),
        }),
      );
    });

    it('creates a roster invite token automatically when no active institution token exists', async () => {
      const schoolEmail = `manual-no-token-${randomUUID()}@school.test`;
      const { user: schoolUser } = await createApprovedUser({
        role: UserRole.SCHOOL,
        email: schoolEmail,
        displayName: 'No Token School',
        institutionProfile: {
          institutionName: 'No Token School',
          location: 'Lucknow',
          totalStudentsEnrolled: 510,
          academicYear: '2025-26',
        },
      });

      const schoolLogin = await loginAs(schoolEmail);
      const rosterEmail = `manual-no-token-${randomUUID()}@school.test`;

      const response = await request(app)
        .post('/api/school/student-roster/manual')
        .set('Authorization', `Bearer ${schoolLogin.accessToken}`)
        .send({
          displayName: 'Invite Student',
          email: rosterEmail,
          gradeOrProgram: 'Class 10',
        });

      expect(response.status).toBe(201);
      expect(sendInstitutionStudentInviteEmail).toHaveBeenCalledTimes(1);
      expect(sendInstitutionStudentInviteEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          inviteLink: expect.stringMatching(/institutionToken=SCH-[A-F0-9]{8}/),
        }),
      );

      const createdToken = await StudentAccessToken.findOne({
        institutionId: schoolUser._id,
        institutionRole: UserRole.SCHOOL,
        label: 'Roster Invite',
      }).lean();

      expect(createdToken?.token).toMatch(/^SCH-[A-F0-9]{8}$/);
    });

    it('keeps the roster write successful when invite email delivery fails', async () => {
      const schoolEmail = `manual-mail-fail-${randomUUID()}@school.test`;
      await createApprovedUser({
        role: UserRole.SCHOOL,
        email: schoolEmail,
        displayName: 'Mail Failure School',
        institutionProfile: {
          institutionName: 'Mail Failure School',
          location: 'Nagpur',
          totalStudentsEnrolled: 430,
          academicYear: '2025-26',
        },
      });
      const schoolLogin = await loginAs(schoolEmail);

      (sendInstitutionStudentInviteEmail as jest.Mock).mockRejectedValueOnce(
        new Error('SMTP temporarily unavailable'),
      );

      const rosterEmail = `manual-mail-fail-${randomUUID()}@school.test`;
      const response = await request(app)
        .post('/api/school/student-roster/manual')
        .set('Authorization', `Bearer ${schoolLogin.accessToken}`)
        .send({
          displayName: 'Student Saved Despite Mail Failure',
          email: rosterEmail,
          gradeOrProgram: 'Class 9',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.email).toBe(rosterEmail);

      const rosterEntry = await InstitutionStudentRosterEntry.findOne({ email: rosterEmail }).lean();
      expect(rosterEntry?.displayName).toBe('Student Saved Despite Mail Failure');
      expect(rosterEntry?.status).toBe('invited');
    });

    it('resends the roster invite email when a pending manual student entry is submitted again', async () => {
      const schoolEmail = `manual-resend-${randomUUID()}@school.test`;
      await createApprovedUser({
        role: UserRole.SCHOOL,
        email: schoolEmail,
        displayName: 'Manual Resend School',
        institutionProfile: {
          institutionName: 'Manual Resend School',
          location: 'Bengaluru',
          totalStudentsEnrolled: 720,
          academicYear: '2025-26',
        },
      });

      const { token, accessToken } = await createInstitutionToken(UserRole.SCHOOL, schoolEmail);
      const rosterEmail = `manual-resend-${randomUUID()}@school.test`;

      const firstResponse = await request(app)
        .post('/api/school/student-roster/manual')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          displayName: 'Invite Student',
          email: rosterEmail,
          gradeOrProgram: 'Class 11',
        });

      expect(firstResponse.status).toBe(201);
      expect(sendInstitutionStudentInviteEmail).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      const secondResponse = await request(app)
        .post('/api/school/student-roster/manual')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          displayName: 'Invite Student Updated',
          email: rosterEmail,
          gradeOrProgram: 'Class 12',
        });

      expect(secondResponse.status).toBe(201);
      expect(sendInstitutionStudentInviteEmail).toHaveBeenCalledTimes(1);
      expect(sendInstitutionStudentInviteEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: rosterEmail,
          studentEmail: rosterEmail,
          institutionName: 'Manual Resend School',
          institutionRole: UserRole.SCHOOL,
          inviteLink: expect.stringContaining(`inviteeEmail=${encodeURIComponent(rosterEmail)}`),
        }),
      );
      expect(sendInstitutionStudentInviteEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          inviteLink: expect.stringContaining(`institutionToken=${encodeURIComponent(token)}`),
        }),
      );

      const rosterEntry = await InstitutionStudentRosterEntry.findOne({ email: rosterEmail }).lean();
      expect(rosterEntry?.displayName).toBe('Invite Student Updated');
      expect(rosterEntry?.gradeOrProgram).toBe('Class 12');
      expect(rosterEntry?.status).toBe('invited');
    });

    it('sends invite emails for created roster rows during import', async () => {
      const schoolEmail = `import-${randomUUID()}@school.test`;
      await createApprovedUser({
        role: UserRole.SCHOOL,
        email: schoolEmail,
        displayName: 'Import Invite School',
        institutionProfile: {
          institutionName: 'Import Invite School',
          location: 'Delhi',
          totalStudentsEnrolled: 1100,
          academicYear: '2025-26',
        },
      });

      const { token, accessToken } = await createInstitutionToken(UserRole.SCHOOL, schoolEmail);
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Students');
      const rows = [
        {
          displayName: 'Import Student One',
          email: `import-one-${randomUUID()}@school.test`,
          gradeOrProgram: 'Class 11',
        },
        {
          displayName: 'Import Student Two',
          email: `import-two-${randomUUID()}@school.test`,
          gradeOrProgram: 'Class 12',
        },
      ];
      worksheet.columns = [
        { header: 'displayName', key: 'displayName' },
        { header: 'email', key: 'email' },
        { header: 'gradeOrProgram', key: 'gradeOrProgram' },
      ];
      worksheet.addRows(rows);
      const workbookBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const response = await request(app)
        .post('/api/school/student-roster/import')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', workbookBuffer, 'students.xlsx');

      expect(response.status).toBe(200);
      expect(response.body.data.createdCount).toBe(2);
      expect(sendInstitutionStudentInviteEmail).toHaveBeenCalledTimes(2);
      rows.forEach((row) => {
        expect(sendInstitutionStudentInviteEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            toEmail: row.email,
            studentEmail: row.email,
            institutionName: 'Import Invite School',
            institutionRole: UserRole.SCHOOL,
            inviteLink: expect.stringContaining(`inviteeEmail=${encodeURIComponent(row.email)}`),
          }),
        );
      });
      expect(sendInstitutionStudentInviteEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          inviteLink: expect.stringContaining(`institutionToken=${encodeURIComponent(token)}`),
        }),
      );
    });

    it('rejects signup when a roster-matched email uses another institution token', async () => {
      const rosterSchoolEmail = `roster-owner-${randomUUID()}@school.test`;
      await createApprovedUser({
        role: UserRole.SCHOOL,
        email: rosterSchoolEmail,
        displayName: 'Roster Owner School',
        institutionProfile: {
          institutionName: 'Roster Owner School',
          location: 'Pune',
          totalStudentsEnrolled: 750,
          academicYear: '2025-26',
        },
      });
      const { accessToken: rosterOwnerAccessToken } = await createInstitutionToken(
        UserRole.SCHOOL,
        rosterSchoolEmail,
      );

      const otherSchoolEmail = `other-owner-${randomUUID()}@school.test`;
      await createApprovedUser({
        role: UserRole.SCHOOL,
        email: otherSchoolEmail,
        displayName: 'Other School',
        institutionProfile: {
          institutionName: 'Other School',
          location: 'Ahmedabad',
          totalStudentsEnrolled: 980,
          academicYear: '2025-26',
        },
      });
      const { token: otherToken } = await createInstitutionToken(UserRole.SCHOOL, otherSchoolEmail);

      const rosterEmail = `mismatch-${randomUUID()}@school.test`;
      const rosterResponse = await request(app)
        .post('/api/school/student-roster/manual')
        .set('Authorization', `Bearer ${rosterOwnerAccessToken}`)
        .send({
          displayName: 'Mismatch Student',
          email: rosterEmail,
          gradeOrProgram: 'Class 9',
        });

      expect(rosterResponse.status).toBe(201);

      const response = await request(app).post('/api/auth/register').send({
        email: rosterEmail,
        password: PASSWORD,
        displayName: 'Mismatch Student',
        role: 'student',
        institutionToken: otherToken,
      });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('INSTITUTION_TOKEN_MISMATCH');
    });

    it('rejects creating a roster entry when the student email is already linked to another institution', async () => {
      const firstSchoolEmail = `first-${randomUUID()}@school.test`;
      const { user: firstSchool } = await createApprovedUser({
        role: UserRole.SCHOOL,
        email: firstSchoolEmail,
        displayName: 'First School',
        institutionProfile: {
          institutionName: 'First School',
          location: 'Chennai',
          totalStudentsEnrolled: 860,
          academicYear: '2025-26',
        },
      });
      const firstSchoolLogin = await loginAs(firstSchoolEmail);

      const claimedEmail = `claimed-${randomUUID()}@school.test`;
      await User.create({
        email: claimedEmail,
        passwordHash: await bcrypt.hash(PASSWORD, 12),
        role: UserRole.STUDENT,
        displayName: 'Claimed Student',
        profileComplete: true,
        registrationStage: 'institution_verified',
        accessGrantedBy: 'institution_roster',
        accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: true,
        institutionToken: 'SCH-CLAIMED',
        institutionId: firstSchool._id,
        institutionVerificationStatus: 'verified',
        verificationStatus: 'verified',
        adminApprovalStatus: 'not_required',
        institutionVerifiedAt: new Date(),
        verificationRequestedAt: new Date(),
        verifiedAt: new Date(),
      });

      const secondSchoolEmail = `second-${randomUUID()}@school.test`;
      await createApprovedUser({
        role: UserRole.SCHOOL,
        email: secondSchoolEmail,
        displayName: 'Second School',
        institutionProfile: {
          institutionName: 'Second School',
          location: 'Jaipur',
          totalStudentsEnrolled: 910,
          academicYear: '2025-26',
        },
      });
      const secondSchoolLogin = await loginAs(secondSchoolEmail);

      const firstRosterResponse = await request(app)
        .post('/api/school/student-roster/manual')
        .set('Authorization', `Bearer ${firstSchoolLogin.accessToken}`)
        .send({
          displayName: 'Claimed Student',
          email: claimedEmail,
          gradeOrProgram: 'Class 12',
        });

      expect(firstRosterResponse.status).toBe(201);

      const secondRosterResponse = await request(app)
        .post('/api/school/student-roster/manual')
        .set('Authorization', `Bearer ${secondSchoolLogin.accessToken}`)
        .send({
          displayName: 'Claimed Student',
          email: claimedEmail,
          gradeOrProgram: 'Class 12',
        });

      expect(secondRosterResponse.status).toBe(409);
      expect(secondRosterResponse.body.error.code).toBe('STUDENT_EMAIL_ALREADY_CLAIMED');
    });

    it('allows a school to cancel a pending student invite', async () => {
      const schoolEmail = `cancel-${randomUUID()}@school.test`;
      await createApprovedUser({
        role: UserRole.SCHOOL,
        email: schoolEmail,
        displayName: 'Cancel School',
        institutionProfile: {
          institutionName: 'Cancel School',
          location: 'Mumbai',
          totalStudentsEnrolled: 800,
          academicYear: '2025-26',
        },
      });

      const schoolLogin = await loginAs(schoolEmail);
      const rosterEmail = `invite-${randomUUID()}@school.test`;

      const createResponse = await request(app)
        .post('/api/school/student-roster/manual')
        .set('Authorization', `Bearer ${schoolLogin.accessToken}`)
        .send({
          displayName: 'Invite Student',
          email: rosterEmail,
          gradeOrProgram: 'Class 10',
        });

      expect(createResponse.status).toBe(201);

      const cancelResponse = await request(app)
        .delete(`/api/school/student-roster/${createResponse.body.data._id as string}`)
        .set('Authorization', `Bearer ${schoolLogin.accessToken}`);

      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.data.cancelled).toBe(true);

      const rosterEntry = await InstitutionStudentRosterEntry.findById(
        createResponse.body.data._id,
      ).lean();
      expect(rosterEntry?.isActive).toBe(false);

      const listResponse = await request(app)
        .get('/api/school/student-roster')
        .set('Authorization', `Bearer ${schoolLogin.accessToken}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data).toHaveLength(0);
    });
  });

  describe('institution token edge-cases', () => {
    it('rejects student signup when the institution token is expired', async () => {
      const schoolEmail = `expired-token-${randomUUID()}@school.test`;
      const { user: schoolUser } = await createApprovedUser({
        role: UserRole.SCHOOL,
        email: schoolEmail,
        displayName: 'Expired Token School',
        institutionProfile: {
          institutionName: 'Expired Token School',
          location: 'Delhi',
          totalStudentsEnrolled: 500,
          academicYear: '2025-26',
        },
      });

      // Insert an already-expired token directly so we can test the error path.
      const expiredToken = await StudentAccessToken.create({
        institutionId: schoolUser._id,
        institutionRole: UserRole.SCHOOL,
        createdBy: schoolUser._id,
        token: 'SCH-EXPIRED1',
        isActive: true,
        expiresAt: new Date(Date.now() - 1000), // already expired
      });

      const response = await request(app).post('/api/auth/register').send({
        email: `student-${randomUUID()}@school.test`,
        password: PASSWORD,
        displayName: 'Expired Student',
        role: 'student',
        institutionToken: expiredToken.token,
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INSTITUTION_TOKEN_EXPIRED');
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('rejects student signup when the institution token is completely invalid', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: `student-${randomUUID()}@example.com`,
        password: PASSWORD,
        displayName: 'Bad Token Student',
        role: 'student',
        institutionToken: 'SCH-DOESNOTEXIST',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_INSTITUTION_TOKEN');
      expect(response.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('institution approval flow', () => {
    it('allows a school to approve a pending student verification', async () => {
      const schoolEmail = `approve-flow-${randomUUID()}@school.test`;
      await createApprovedUser({
        role: UserRole.SCHOOL,
        email: schoolEmail,
        displayName: 'Approve Flow School',
        institutionProfile: {
          institutionName: 'Approve Flow School',
          location: 'Bengaluru',
          totalStudentsEnrolled: 600,
          academicYear: '2025-26',
        },
      });
      const { token, accessToken: schoolAccessToken } = await createInstitutionToken(
        UserRole.SCHOOL,
        schoolEmail,
      );

      // Register a student without a roster entry so they land in pending state.
      const studentEmail = `pending-student-${randomUUID()}@school.test`;
      const registerResponse = await request(app).post('/api/auth/register').send({
        email: studentEmail,
        password: PASSWORD,
        displayName: 'Pending Student',
        role: 'student',
        institutionToken: token,
      });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.data.pendingApproval).toBe(true);
      expect(registerResponse.body.data.user.verificationStatus).toBe('pending');

      const studentId = registerResponse.body.data.user._id as string;

      // Verify the student is blocked from logging in.
      const blockedLogin = await request(app).post('/api/auth/login').send({
        email: studentEmail,
        password: PASSWORD,
      });
      expect(blockedLogin.status).toBe(403);
      expect(blockedLogin.body.error.code).toBe('INSTITUTION_APPROVAL_PENDING');

      // School approves the student.
      const approveResponse = await request(app)
        .patch(`/api/school/student-verifications/${studentId}`)
        .set('Authorization', `Bearer ${schoolAccessToken}`)
        .send({ decision: 'approved' });

      expect(approveResponse.status).toBe(200);
      expect(approveResponse.body.data.status).toBe('verified');

      // Student can now log in.
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: studentEmail,
        password: PASSWORD,
      });
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data.user.verificationStatus).toBe('verified');
      expect(loginResponse.body.data.user.isActive).toBe(true);
      // Token-only students have no pre-existing roster entry, so no roster
      // record is created or updated by the approval step.
    });

    it('allows a college to approve a pending student verification', async () => {
      const collegeEmail = `approve-college-${randomUUID()}@college.test`;
      await createApprovedUser({
        role: UserRole.COLLEGE,
        email: collegeEmail,
        displayName: 'Approve Flow College',
        institutionProfile: {
          institutionName: 'Approve Flow College',
          location: 'Pune',
          totalStudentsEnrolled: 1400,
          academicYear: '2025-26',
        },
      });
      const { token, accessToken: collegeAccessToken } = await createInstitutionToken(
        UserRole.COLLEGE,
        collegeEmail,
      );

      const studentEmail = `pending-college-student-${randomUUID()}@college.test`;
      const registerResponse = await request(app).post('/api/auth/register').send({
        email: studentEmail,
        password: PASSWORD,
        displayName: 'Pending College Student',
        role: 'student',
        institutionToken: token,
      });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.data.pendingApproval).toBe(true);
      const studentId = registerResponse.body.data.user._id as string;

      const approveResponse = await request(app)
        .patch(`/api/college/student-verifications/${studentId}`)
        .set('Authorization', `Bearer ${collegeAccessToken}`)
        .send({ decision: 'approved' });

      expect(approveResponse.status).toBe(200);
      expect(approveResponse.body.data.status).toBe('verified');

      const loginResponse = await request(app).post('/api/auth/login').send({
        email: studentEmail,
        password: PASSWORD,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data.user.verificationStatus).toBe('verified');
      expect(loginResponse.body.data.user.isActive).toBe(true);
    });

    it('allows a school to reject a pending student and blocks their login', async () => {
      const schoolEmail = `reject-flow-${randomUUID()}@school.test`;
      await createApprovedUser({
        role: UserRole.SCHOOL,
        email: schoolEmail,
        displayName: 'Reject Flow School',
        institutionProfile: {
          institutionName: 'Reject Flow School',
          location: 'Chennai',
          totalStudentsEnrolled: 400,
          academicYear: '2025-26',
        },
      });
      const { token, accessToken: schoolAccessToken } = await createInstitutionToken(
        UserRole.SCHOOL,
        schoolEmail,
      );

      const studentEmail = `reject-student-${randomUUID()}@school.test`;
      const registerResponse = await request(app).post('/api/auth/register').send({
        email: studentEmail,
        password: PASSWORD,
        displayName: 'Reject Pending Student',
        role: 'student',
        institutionToken: token,
      });

      expect(registerResponse.status).toBe(201);
      const studentId = registerResponse.body.data.user._id as string;

      // School rejects with a reason.
      const rejectResponse = await request(app)
        .patch(`/api/school/student-verifications/${studentId}`)
        .set('Authorization', `Bearer ${schoolAccessToken}`)
        .send({ decision: 'rejected', reason: 'Cannot confirm enrollment.' });

      expect(rejectResponse.status).toBe(200);
      expect(rejectResponse.body.data.status).toBe('rejected');

      // Rejected student is blocked at login with the specific error code.
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: studentEmail,
        password: PASSWORD,
      });
      expect(loginResponse.status).toBe(403);
      expect(loginResponse.body.error.code).toBe('INSTITUTION_VERIFICATION_REJECTED');
      // Token-only students have no pre-existing roster entry, so no roster
      // record is updated by the rejection step.
    });

    it('allows a college to add a manual roster invite and sends the email link', async () => {
      const collegeEmail = `manual-college-${randomUUID()}@college.test`;
      await createApprovedUser({
        role: UserRole.COLLEGE,
        email: collegeEmail,
        displayName: 'Manual Invite College',
        institutionProfile: {
          institutionName: 'Manual Invite College',
          location: 'Indore',
          totalStudentsEnrolled: 1800,
          academicYear: '2025-26',
        },
      });

      const { token, accessToken } = await createInstitutionToken(UserRole.COLLEGE, collegeEmail);
      const rosterEmail = `manual-college-${randomUUID()}@college.test`;

      const response = await request(app)
        .post('/api/college/student-roster/manual')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          displayName: 'College Invite Student',
          email: rosterEmail,
          gradeOrProgram: 'B.Tech CSE',
        });

      expect(response.status).toBe(201);
      expect(sendInstitutionStudentInviteEmail).toHaveBeenCalledTimes(1);
      expect(sendInstitutionStudentInviteEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: rosterEmail,
          studentEmail: rosterEmail,
          institutionName: 'Manual Invite College',
          institutionRole: UserRole.COLLEGE,
          inviteLink: expect.stringContaining(`institutionToken=${encodeURIComponent(token)}`),
        }),
      );
    });

    it('blocks re-reviewing a student who has already been reviewed', async () => {
      const schoolEmail = `already-reviewed-${randomUUID()}@school.test`;
      await createApprovedUser({
        role: UserRole.SCHOOL,
        email: schoolEmail,
        displayName: 'Already Reviewed School',
        institutionProfile: {
          institutionName: 'Already Reviewed School',
          location: 'Mumbai',
          totalStudentsEnrolled: 700,
          academicYear: '2025-26',
        },
      });
      const { token, accessToken: schoolAccessToken } = await createInstitutionToken(
        UserRole.SCHOOL,
        schoolEmail,
      );

      const studentEmail = `reviewed-once-${randomUUID()}@school.test`;
      const registerResponse = await request(app).post('/api/auth/register').send({
        email: studentEmail,
        password: PASSWORD,
        displayName: 'Already Reviewed Student',
        role: 'student',
        institutionToken: token,
      });

      const studentId = registerResponse.body.data.user._id as string;

      // First review — approve.
      await request(app)
        .patch(`/api/school/student-verifications/${studentId}`)
        .set('Authorization', `Bearer ${schoolAccessToken}`)
        .send({ decision: 'approved' });

      // Second review attempt should be rejected.
      const secondReview = await request(app)
        .patch(`/api/school/student-verifications/${studentId}`)
        .set('Authorization', `Bearer ${schoolAccessToken}`)
        .send({ decision: 'rejected', reason: 'Changed mind.' });

      expect(secondReview.status).toBe(400);
      expect(secondReview.body.error.code).toBe('VERIFICATION_ALREADY_REVIEWED');
    });
  });

  describe('POST /api/auth/register-request', () => {
    it('submits non-student registration requests for admin approval', async () => {
      const response = await request(app).post('/api/auth/register-request').send({
        email: `mentor-${randomUUID()}@example.com`,
        password: PASSWORD,
        displayName: 'Mentor Applicant',
        role: 'mentor',
        domain: 'AI Strategy',
        bio: 'Guides student founders.',
      });

      expect(response.status).toBe(201);
      expect(response.body.data.pendingApproval).toBe(true);
      expect(response.body.data.approvalType).toBe('admin');
      expect(response.body.data.user.adminApprovalStatus).toBe('pending');
      expect(response.body.data.user.isActive).toBe(false);
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('blocks login for non-student accounts until admin approval', async () => {
      const email = `investor-${randomUUID()}@example.com`;
      await request(app).post('/api/auth/register-request').send({
        email,
        password: PASSWORD,
        displayName: 'Investor Applicant',
        role: 'investor',
        domain: 'ClimateTech',
      });

      const response = await request(app).post('/api/auth/login').send({
        email,
        password: PASSWORD,
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('ADMIN_APPROVAL_PENDING');
    });

    it('allows legacy users with a password field to log in and upgrades their record', async () => {
      const email = `legacy-${randomUUID()}@example.com`;
      const legacyPasswordHash = await bcrypt.hash(PASSWORD, 12);

      await User.collection.insertOne({
        email,
        password: legacyPasswordHash,
        role: UserRole.MENTOR,
        displayName: 'Legacy Mentor',
        profileComplete: true,
        registrationStage: 'complete',
        accessGrantedBy: 'admin',
        accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: true,
        institutionToken: null,
        institutionId: null,
        institutionVerificationStatus: 'none',
        verificationStatus: 'not_required',
        adminApprovalStatus: 'approved',
        adminApprovedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app).post('/api/auth/login').send({
        email,
        password: PASSWORD,
      });

      expect(response.status).toBe(200);
      expect(response.body.data.user.email).toBe(email);

      const upgradedUser = await User.collection.findOne(
        { email },
        { projection: { password: 1, passwordHash: 1 } },
      );
      expect(upgradedUser?.passwordHash).toBe(legacyPasswordHash);
      expect(upgradedUser?.password).toBeUndefined();
    });

    it('accepts a college registration request only when required verification documents are uploaded', async () => {
      const email = `college-${randomUUID()}@example.com`;
      const requiredCategories = [
        'governing_body_registration_certificate',
        'authorized_signatory_letter',
        'address_proof',
        'pan_or_tax_registration',
        'affiliation_letter',
        'aicte_approval_letter',
        'ugc_recognition_letter',
      ];

      const response = await attachInstitutionDocuments(
        request(app)
          .post('/api/auth/register-request')
          .field('email', email)
          .field('password', PASSWORD)
          .field('displayName', 'Future Engineering College')
          .field('role', 'college')
          .field('domain', 'Engineering Innovation')
          .field(
            'institutionProfile',
            JSON.stringify({
              institutionName: 'Future Engineering College',
              location: 'Bengaluru',
              totalStudentsEnrolled: 2400,
              academicYear: '2025-26',
              iicStarRating: 3,
            }),
          )
          .field(
            'institutionVerification',
            JSON.stringify({
              regulatoryBodies: ['AICTE', 'UGC'],
              affiliationName: 'Visvesvaraya Technological University',
              referenceCode: 'AISHE-987654',
            }),
          ),
        requiredCategories,
      );

      expect(response.status).toBe(201);
      expect(response.body.data.pendingApproval).toBe(true);
      expect(response.body.data.user.adminApprovalStatus).toBe('pending');
      expect(response.body.data.user.institutionVerification.readiness.isReadyForReview).toBe(true);
      expect(response.body.data.user.institutionVerification.documents).toHaveLength(
        requiredCategories.length,
      );
    });

    it('rejects institution registration requests when required legal documents are missing', async () => {
      const response = await attachInstitutionDocuments(
        request(app)
          .post('/api/auth/register-request')
          .field('email', `college-missing-${randomUUID()}@example.com`)
          .field('password', PASSWORD)
          .field('displayName', 'Incomplete Technical College')
          .field('role', 'college')
          .field(
            'institutionProfile',
            JSON.stringify({
              institutionName: 'Incomplete Technical College',
              location: 'Chennai',
              totalStudentsEnrolled: 1600,
              academicYear: '2025-26',
            }),
          )
          .field(
            'institutionVerification',
            JSON.stringify({
              regulatoryBodies: ['AICTE'],
              affiliationName: 'Anna University',
            }),
          ),
        [
          'governing_body_registration_certificate',
          'authorized_signatory_letter',
          'address_proof',
          'pan_or_tax_registration',
          'affiliation_letter',
        ],
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_INSTITUTION_DOCUMENTS');
      expect(response.body.error.message).toContain('AICTE approval');
    });
  });

  describe('admin registration review', () => {
    it('lists and approves pending registration requests', async () => {
      const { email: adminEmail } = await createApprovedUser({
        role: UserRole.ADMIN,
        email: `admin-${randomUUID()}@example.com`,
        displayName: 'Platform Admin',
      });
      const adminLogin = await loginAs(adminEmail);

      const mentorEmail = `mentor-${randomUUID()}@example.com`;
      const requestResponse = await request(app).post('/api/auth/register-request').send({
        email: mentorEmail,
        password: PASSWORD,
        displayName: 'Mentor Applicant',
        role: 'mentor',
        domain: 'Product Strategy',
      });

      const requestId = requestResponse.body.data.user._id as string;

      const listResponse = await request(app)
        .get('/api/admin/registration-requests')
        .set('Authorization', `Bearer ${adminLogin.accessToken}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            _id: requestId,
            email: mentorEmail,
            status: 'pending',
          }),
        ]),
      );

      const approveResponse = await request(app)
        .patch(`/api/admin/registration-requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${adminLogin.accessToken}`)
        .send({});

      expect(approveResponse.status).toBe(200);

      const loginResponse = await request(app).post('/api/auth/login').send({
        email: mentorEmail,
        password: PASSWORD,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data.user.adminApprovalStatus).toBe('approved');
    });

    it('rejects registration requests with a reason', async () => {
      const { email: adminEmail } = await createApprovedUser({
        role: UserRole.ADMIN,
        email: `admin-${randomUUID()}@example.com`,
        displayName: 'Platform Admin',
      });
      const adminLogin = await loginAs(adminEmail);

      const recruiterEmail = `recruiter-${randomUUID()}@example.com`;
      const requestResponse = await request(app).post('/api/auth/register-request').send({
        email: recruiterEmail,
        password: PASSWORD,
        displayName: 'Recruiter Applicant',
        role: 'recruiter',
        domain: 'Hiring',
      });

      const requestId = requestResponse.body.data.user._id as string;
      const rejectResponse = await request(app)
        .patch(`/api/admin/registration-requests/${requestId}/reject`)
        .set('Authorization', `Bearer ${adminLogin.accessToken}`)
        .send({ rejectionReason: 'Need company verification details first.' });

      expect(rejectResponse.status).toBe(200);

      const loginResponse = await request(app).post('/api/auth/login').send({
        email: recruiterEmail,
        password: PASSWORD,
      });

      expect(loginResponse.status).toBe(403);
      expect(loginResponse.body.error.code).toBe('ADMIN_APPROVAL_REJECTED');
    });

    it('blocks admin approval for institution requests that do not have a complete verification packet', async () => {
      const { email: adminEmail } = await createApprovedUser({
        role: UserRole.ADMIN,
        email: `admin-${randomUUID()}@example.com`,
        displayName: 'Platform Admin',
      });
      const adminLogin = await loginAs(adminEmail);
      const passwordHash = await bcrypt.hash(PASSWORD, 12);
      const collegeEmail = `pending-college-${randomUUID()}@example.com`;

      const pendingCollege = await User.create({
        email: collegeEmail,
        passwordHash,
        role: UserRole.COLLEGE,
        displayName: 'Pending College',
        profileComplete: false,
        registrationStage: 'complete',
        accessGrantedBy: 'admin',
        accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: false,
        institutionToken: null,
        institutionId: null,
        institutionVerificationStatus: 'none',
        verificationStatus: 'not_required',
        adminApprovalStatus: 'pending',
        adminApprovalRequestedAt: new Date(),
        institutionProfile: {
          institutionName: 'Pending College',
          location: 'Hyderabad',
          totalStudentsEnrolled: 1800,
          academicYear: '2025-26',
          iicStarRating: 0,
          policies: [],
          stats: {
            totalInnovationActivities: 0,
            patentsFiled: 0,
            totalMentoringHours: 0,
            startupsLaunched: 0,
            industryCollaborations: 0,
          },
        },
      });

      const approveResponse = await request(app)
        .patch(`/api/admin/registration-requests/${pendingCollege._id.toString()}/approve`)
        .set('Authorization', `Bearer ${adminLogin.accessToken}`)
        .send({});

      expect(approveResponse.status).toBe(400);
      expect(approveResponse.body.error.code).toBe('INSTITUTION_DOCUMENTS_REQUIRED');
    });
  });

  describe('admin credential limit', () => {
    it('blocks creating a fourth admin account through role promotion', async () => {
      const { email: primaryAdminEmail } = await createApprovedUser({
        role: UserRole.ADMIN,
        email: `admin-primary-${randomUUID()}@example.com`,
        displayName: 'Primary Admin',
      });
      await createApprovedUser({
        role: UserRole.ADMIN,
        email: `admin-second-${randomUUID()}@example.com`,
        displayName: 'Second Admin',
      });
      await createApprovedUser({
        role: UserRole.ADMIN,
        email: `admin-third-${randomUUID()}@example.com`,
        displayName: 'Third Admin',
      });

      const adminLogin = await loginAs(primaryAdminEmail);
      const { user: mentorUser } = await createApprovedUser({
        role: UserRole.MENTOR,
        email: `mentor-${randomUUID()}@example.com`,
        displayName: 'Mentor To Promote',
        domain: 'Product Strategy',
      });

      const response = await request(app)
        .patch(`/api/admin/users/${mentorUser._id.toString()}/role`)
        .set('Authorization', `Bearer ${adminLogin.accessToken}`)
        .send({ role: UserRole.ADMIN });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('ADMIN_CREDENTIAL_LIMIT_REACHED');

      const updatedMentor = await User.findById(mentorUser._id).lean();
      expect(updatedMentor?.role).toBe(UserRole.MENTOR);
    });
  });

  describe('institution-managed temporary student credentials', () => {
    it('allows a school to create temporary student credentials on its own domain', async () => {
      const schoolEmail = `admin-${randomUUID()}@campus.test`;
      await createApprovedUser({
        role: UserRole.SCHOOL,
        email: schoolEmail,
        displayName: 'Campus School',
        institutionProfile: {
          institutionName: 'Campus School',
          location: 'Pune',
          totalStudentsEnrolled: 700,
          academicYear: '2025-26',
        },
      });

      const schoolLogin = await loginAs(schoolEmail);
      const studentEmail = `student-${randomUUID()}@campus.test`;

      const response = await request(app)
        .post('/api/school/student-temp-credentials')
        .set('Authorization', `Bearer ${schoolLogin.accessToken}`)
        .send({
          displayName: 'Managed Student',
          email: studentEmail,
          gradeOrProgram: 'Class 11',
          rollNumber: 'CMP-001',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.temporaryPassword).toEqual(expect.any(String));
      expect(response.body.data.student.email).toBe(studentEmail);

      const loginResponse = await request(app).post('/api/auth/login').send({
        email: studentEmail,
        password: response.body.data.temporaryPassword,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data.user.accessGrantedBy).toBe('institution_admin');
    });

    it('allows temporary student credentials for a different email domain', async () => {
      const collegeEmail = `dean-${randomUUID()}@college.test`;
      const { user: college } = await createApprovedUser({
        role: UserRole.COLLEGE,
        email: collegeEmail,
        displayName: 'Future College',
        institutionProfile: {
          institutionName: 'Future College',
          location: 'Bengaluru',
          totalStudentsEnrolled: 1800,
          academicYear: '2025-26',
        },
      });

      const collegeLogin = await loginAs(collegeEmail);
      const studentEmail = `student-${randomUUID()}@external.test`;
      const response = await request(app)
        .post('/api/college/student-temp-credentials')
        .set('Authorization', `Bearer ${collegeLogin.accessToken}`)
        .send({
          displayName: 'External Student',
          email: studentEmail,
          gradeOrProgram: 'B.Tech',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.student.email).toBe(studentEmail);

      const student = await User.findOne({ email: studentEmail }).lean();
      expect(String(student?.institutionId)).toBe(college._id.toString());
      expect(student?.verificationStatus).toBe('verified');
    });

    it('creates student credentials from a mixed-domain Excel roster import and allows login', async () => {
      const schoolEmail = `excel-${randomUUID()}@campus.test`;
      const { user: schoolUser } = await createApprovedUser({
        role: UserRole.SCHOOL,
        email: schoolEmail,
        displayName: 'Excel School',
        institutionProfile: {
          institutionName: 'Excel School',
          location: 'Chennai',
          totalStudentsEnrolled: 950,
          academicYear: '2025-26',
        },
      });

      const schoolLogin = await loginAs(schoolEmail);
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Students');
      const rows = [
        {
          displayName: 'Excel Student One',
          email: `excel-one-${randomUUID()}@personal.test`,
          gradeOrProgram: 'Class 11',
          rollNumber: 'EX-001',
        },
        {
          displayName: 'Excel Student Two',
          email: `excel-two-${randomUUID()}@another-domain.test`,
          gradeOrProgram: 'Class 12',
          rollNumber: 'EX-002',
        },
      ];
      worksheet.columns = [
        { header: 'displayName', key: 'displayName' },
        { header: 'email', key: 'email' },
        { header: 'gradeOrProgram', key: 'gradeOrProgram' },
        { header: 'rollNumber', key: 'rollNumber' },
      ];
      worksheet.addRows(rows);
      const workbookBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const previewResponse = await request(app)
        .post('/api/school/student-roster/preview-credentials')
        .set('Authorization', `Bearer ${schoolLogin.accessToken}`)
        .attach('file', workbookBuffer, 'students.xlsx');

      expect(previewResponse.status).toBe(200);
      expect(previewResponse.body.data).toMatchObject({
        fileName: 'students.xlsx',
        summary: { total: 2, ready: 2, errors: 0 },
        rows: [
          expect.objectContaining({
            displayName: rows[0].displayName,
            email: rows[0].email,
            gradeOrProgram: rows[0].gradeOrProgram,
            rollNumber: rows[0].rollNumber,
            status: 'ready',
          }),
          expect.objectContaining({
            displayName: rows[1].displayName,
            email: rows[1].email,
            gradeOrProgram: rows[1].gradeOrProgram,
            rollNumber: rows[1].rollNumber,
            status: 'ready',
          }),
        ],
      });
      expect(await User.countDocuments({ email: { $in: rows.map((row) => row.email) } })).toBe(0);
      expect(
        await InstitutionStudentRosterEntry.countDocuments({
          institutionId: schoolUser._id,
          email: { $in: rows.map((row) => row.email) },
        }),
      ).toBe(0);
      expect(sendTemporaryStudentCredentialsEmail).not.toHaveBeenCalled();

      const importResponse = await request(app)
        .post('/api/school/student-roster/import-credentials')
        .set('Authorization', `Bearer ${schoolLogin.accessToken}`)
        .attach('file', workbookBuffer, 'students.xlsx');

      expect(importResponse.status).toBe(200);
      expect(importResponse.body.data.errors).toHaveLength(0);
      expect(importResponse.body.data.results).toHaveLength(2);

      const firstCredential = importResponse.body.data.results[0] as {
        student: { email: string };
        temporaryPassword: string;
      };

      const loginResponse = await request(app).post('/api/auth/login').send({
        email: firstCredential.student.email,
        password: firstCredential.temporaryPassword,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data.user.accessGrantedBy).toBe('institution_admin');
      expect(loginResponse.body.data.user.mustChangePasswordOnNextLogin).toBe(true);

      const rosterEntries = await InstitutionStudentRosterEntry.find({
        institutionId: schoolUser._id,
        isActive: true,
      }).lean();

      expect(rosterEntries).toHaveLength(2);
      expect(rosterEntries.every((entry) => entry.status === 'verified')).toBe(true);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('rotates the refresh token for approved users', async () => {
      const { email } = await createApprovedUser({
        role: UserRole.MENTOR,
        email: `mentor-${randomUUID()}@example.com`,
        displayName: 'Approved Mentor',
        domain: 'Product Strategy',
      });

      const login = await loginAs(email);
      const firstRefresh = await request(app).post('/api/auth/refresh').set('Cookie', login.cookie);
      const secondRefresh = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', firstRefresh.headers['set-cookie'][0]);

      expect(firstRefresh.status).toBe(200);
      expect(secondRefresh.status).toBe(200);
    });

    it('rejects expired refresh tokens', async () => {
      const { user } = await createApprovedUser({
        role: UserRole.STUDENT,
        email: `student-${randomUUID()}@example.com`,
        displayName: 'Expired Token Student',
      });

      const expiredToken = jwt.sign(
        {
          _id: user._id.toString(),
          email: user.email,
          role: user.role,
          tokenId: 'expired-token-id',
          type: 'refresh',
        },
        env.JWT_REFRESH_SECRET,
        { algorithm: 'RS256', expiresIn: '-1s' },
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('falls back to JWT refresh when Redis session reads time out and fallback is enabled', async () => {
      const originalFallback = env.AUTH_ALLOW_REDIS_AUTH_FALLBACK;
      env.AUTH_ALLOW_REDIS_AUTH_FALLBACK = true;

      const { email } = await createApprovedUser({
        role: UserRole.STUDENT,
        email: `student-${randomUUID()}@example.com`,
        displayName: 'Redis Fallback Student',
      });

      const login = await loginAs(email);
      const redisGetSpy = jest
        .spyOn(redis, 'get')
        .mockRejectedValueOnce(new Error('The operation was aborted due to timeout'));

      try {
        const response = await request(app)
          .post('/api/auth/refresh')
          .set('Cookie', login.cookie!);

        expect(response.status).toBe(200);
        expect(response.body.data.accessToken).toEqual(expect.any(String));
        expect(response.headers['set-cookie']?.[0]).toContain('refreshToken=');
      } finally {
        env.AUTH_ALLOW_REDIS_AUTH_FALLBACK = originalFallback;
        redisGetSpy.mockRestore();
      }
    });

    it('skips Redis rotation and session persistence after a refresh read timeout when fallback is enabled', async () => {
      const originalFallback = env.AUTH_ALLOW_REDIS_AUTH_FALLBACK;
      env.AUTH_ALLOW_REDIS_AUTH_FALLBACK = true;

      const { email } = await createApprovedUser({
        role: UserRole.STUDENT,
        email: `student-${randomUUID()}@example.com`,
        displayName: 'Read Timeout Student',
      });

      const login = await loginAs(email);
      const redisGetSpy = jest
        .spyOn(redis, 'get')
        .mockRejectedValueOnce(new Error('The operation was aborted due to timeout'));
      const redisDelSpy = jest.spyOn(redis, 'del');
      const redisSetSpy = jest.spyOn(redis, 'set');
      const redisSaddSpy = jest.spyOn(redis, 'sadd');
      const redisExpireSpy = jest.spyOn(redis, 'expire');

      try {
        const response = await request(app)
          .post('/api/auth/refresh')
          .set('Cookie', login.cookie!);

        expect(response.status).toBe(200);
        expect(redisDelSpy).not.toHaveBeenCalled();
        expect(redisSetSpy).not.toHaveBeenCalled();
        expect(redisSaddSpy).not.toHaveBeenCalled();
        expect(redisExpireSpy).not.toHaveBeenCalled();
      } finally {
        env.AUTH_ALLOW_REDIS_AUTH_FALLBACK = originalFallback;
        redisGetSpy.mockRestore();
        redisDelSpy.mockRestore();
        redisSetSpy.mockRestore();
        redisSaddSpy.mockRestore();
        redisExpireSpy.mockRestore();
      }
    });

    it('skips new Redis session persistence after a refresh rotation timeout when fallback is enabled', async () => {
      const originalFallback = env.AUTH_ALLOW_REDIS_AUTH_FALLBACK;
      env.AUTH_ALLOW_REDIS_AUTH_FALLBACK = true;

      const { email } = await createApprovedUser({
        role: UserRole.STUDENT,
        email: `student-${randomUUID()}@example.com`,
        displayName: 'Rotate Timeout Student',
      });

      const login = await loginAs(email);
      const redisDelSpy = jest
        .spyOn(redis, 'del')
        .mockRejectedValueOnce(new Error('The operation was aborted due to timeout'));
      const redisSetSpy = jest.spyOn(redis, 'set');
      const redisSaddSpy = jest.spyOn(redis, 'sadd');
      const redisExpireSpy = jest.spyOn(redis, 'expire');

      try {
        const response = await request(app)
          .post('/api/auth/refresh')
          .set('Cookie', login.cookie!);

        expect(response.status).toBe(200);
        expect(redisSetSpy).not.toHaveBeenCalled();
        expect(redisSaddSpy).not.toHaveBeenCalled();
        expect(redisExpireSpy).not.toHaveBeenCalled();
      } finally {
        env.AUTH_ALLOW_REDIS_AUTH_FALLBACK = originalFallback;
        redisDelSpy.mockRestore();
        redisSetSpy.mockRestore();
        redisSaddSpy.mockRestore();
        redisExpireSpy.mockRestore();
      }
    });

    it('returns 503 when Redis session reads time out and fallback is disabled', async () => {
      const originalFallback = env.AUTH_ALLOW_REDIS_AUTH_FALLBACK;
      env.AUTH_ALLOW_REDIS_AUTH_FALLBACK = false;

      const { email } = await createApprovedUser({
        role: UserRole.STUDENT,
        email: `student-${randomUUID()}@example.com`,
        displayName: 'Strict Redis Student',
      });

      const login = await loginAs(email);
      const redisGetSpy = jest
        .spyOn(redis, 'get')
        .mockRejectedValueOnce(new Error('The operation was aborted due to timeout'));

      try {
        const response = await request(app)
          .post('/api/auth/refresh')
          .set('Cookie', login.cookie!);

        expect(response.status).toBe(503);
        expect(response.body.error.code).toBe('AUTH_SESSION_STORE_UNAVAILABLE');
      } finally {
        env.AUTH_ALLOW_REDIS_AUTH_FALLBACK = originalFallback;
        redisGetSpy.mockRestore();
      }
    });
  });
});
