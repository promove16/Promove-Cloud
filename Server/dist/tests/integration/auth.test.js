"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = require("crypto");
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../src/app"));
const env_1 = require("../../src/config/env");
const user_model_1 = require("../../src/modules/user/user.model");
const roles_types_1 = require("../../src/types/roles.types");
const PASSWORD = 'Password123!';
const API_ORIGIN = 'http://127.0.0.1';
const createApprovedUser = async (input) => {
    const email = input.email ?? `${input.role}-${(0, crypto_1.randomUUID)()}@example.com`;
    const passwordHash = await bcrypt_1.default.hash(PASSWORD, 12);
    const user = await user_model_1.User.create({
        email,
        passwordHash,
        role: input.role,
        displayName: input.displayName ?? `${input.role} user`,
        ...(input.domain ? { domain: input.domain } : {}),
        ...(input.institutionProfile ? { institutionProfile: input.institutionProfile } : {}),
        profileComplete: true,
        registrationStage: input.role === roles_types_1.UserRole.SCHOOL || input.role === roles_types_1.UserRole.COLLEGE ? 'complete' : 'profile_setup',
        accessGrantedBy: 'admin',
        accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: true,
        institutionToken: null,
        institutionId: null,
        institutionVerificationStatus: 'none',
        verificationStatus: input.role === roles_types_1.UserRole.STUDENT ? 'verified' : 'not_required',
        adminApprovalStatus: input.role === roles_types_1.UserRole.STUDENT ? 'not_required' : 'approved',
        adminApprovedAt: input.role === roles_types_1.UserRole.STUDENT ? undefined : new Date(),
    });
    return { user, email };
};
const loginAs = async (email, password = PASSWORD) => {
    const response = await (0, supertest_1.default)(app_1.default).post('/api/auth/login').send({
        email,
        password,
    });
    return {
        response,
        accessToken: response.body.data?.accessToken,
        cookie: response.headers['set-cookie']?.[0],
    };
};
const createInstitutionToken = async (role, email) => {
    const login = await loginAs(email);
    const endpoint = role === roles_types_1.UserRole.SCHOOL ? '/api/school/student-access-tokens' : '/api/college/student-access-tokens';
    const response = await (0, supertest_1.default)(app_1.default)
        .post(endpoint)
        .set('Authorization', `Bearer ${login.accessToken}`)
        .send({ label: 'Admissions' });
    return {
        response,
        token: response.body.data.token,
        accessToken: login.accessToken,
    };
};
const restoreFetch = (mock) => {
    mock.mockRestore();
};
const mockOAuthFetch = (provider, email) => jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (provider === 'google') {
        if (url === 'https://oauth2.googleapis.com/token') {
            return {
                ok: true,
                json: async () => ({
                    access_token: 'google-access-token',
                    id_token: 'google-id-token',
                }),
            };
        }
        if (url === 'https://openidconnect.googleapis.com/v1/userinfo') {
            return {
                ok: true,
                json: async () => ({
                    sub: 'google-user-123',
                    email,
                    email_verified: true,
                    name: 'OAuth User',
                    picture: 'https://example.com/google-avatar.png',
                }),
            };
        }
    }
    if (provider === 'linkedin') {
        if (url === 'https://www.linkedin.com/oauth/v2/accessToken') {
            return {
                ok: true,
                json: async () => ({
                    access_token: 'linkedin-access-token',
                    id_token: 'linkedin-id-token',
                }),
            };
        }
        if (url === 'https://api.linkedin.com/v2/userinfo') {
            return {
                ok: true,
                json: async () => ({
                    sub: 'linkedin-user-456',
                    email,
                    email_verified: true,
                    name: 'OAuth User',
                    picture: 'https://example.com/linkedin-avatar.png',
                }),
            };
        }
    }
    throw new Error(`Unexpected fetch call: ${url}`);
});
describe('auth integration', () => {
    describe('POST /api/auth/register', () => {
        it('requires an institution token for student signup', async () => {
            const response = await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send({
                email: `student-${(0, crypto_1.randomUUID)()}@example.com`,
                password: PASSWORD,
                displayName: 'Student User',
                role: 'student',
            });
            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });
        it('creates a pending student account when the institution token is valid', async () => {
            const schoolEmail = `coordinator-${(0, crypto_1.randomUUID)()}@school.test`;
            await createApprovedUser({
                role: roles_types_1.UserRole.SCHOOL,
                email: schoolEmail,
                displayName: 'Test School',
                institutionProfile: {
                    institutionName: 'Test School',
                    location: 'Hyderabad',
                    totalStudentsEnrolled: 1200,
                    academicYear: '2025-26',
                },
            });
            const { token } = await createInstitutionToken(roles_types_1.UserRole.SCHOOL, schoolEmail);
            const response = await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send({
                email: `student-${(0, crypto_1.randomUUID)()}@school.test`,
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
            const created = await user_model_1.User.findOne({ email: response.body.data.user.email }).lean();
            expect(created?.institutionId).toBeTruthy();
            expect(created?.verificationStatus).toBe('pending');
            expect(created?.isActive).toBe(false);
        });
        it('links rostered student signup to the same institution when token and email match', async () => {
            const schoolEmail = `roster-${(0, crypto_1.randomUUID)()}@school.test`;
            await createApprovedUser({
                role: roles_types_1.UserRole.SCHOOL,
                email: schoolEmail,
                displayName: 'Roster School',
                institutionProfile: {
                    institutionName: 'Roster School',
                    location: 'Delhi',
                    totalStudentsEnrolled: 900,
                    academicYear: '2025-26',
                },
            });
            const { token, accessToken } = await createInstitutionToken(roles_types_1.UserRole.SCHOOL, schoolEmail);
            const rosterEmail = `student-${(0, crypto_1.randomUUID)()}@school.test`;
            const rosterResponse = await (0, supertest_1.default)(app_1.default)
                .post('/api/school/student-roster/manual')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                displayName: 'Roster Student',
                email: rosterEmail,
                gradeOrProgram: 'Class 12',
                rollNumber: 'SCH-100',
            });
            expect(rosterResponse.status).toBe(201);
            const response = await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send({
                email: rosterEmail,
                password: PASSWORD,
                displayName: 'Roster Student',
                role: 'student',
                institutionToken: token,
            });
            expect(response.status).toBe(201);
            expect(response.body.data.user.accessGrantedBy).toBe('institution_roster');
            expect(response.body.data.user.verificationStatus).toBe('pending');
        });
    });
    describe('POST /api/auth/register-request', () => {
        it('submits non-student registration requests for admin approval', async () => {
            const response = await (0, supertest_1.default)(app_1.default).post('/api/auth/register-request').send({
                email: `mentor-${(0, crypto_1.randomUUID)()}@example.com`,
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
            const email = `investor-${(0, crypto_1.randomUUID)()}@example.com`;
            await (0, supertest_1.default)(app_1.default).post('/api/auth/register-request').send({
                email,
                password: PASSWORD,
                displayName: 'Investor Applicant',
                role: 'investor',
                domain: 'ClimateTech',
            });
            const response = await (0, supertest_1.default)(app_1.default).post('/api/auth/login').send({
                email,
                password: PASSWORD,
            });
            expect(response.status).toBe(403);
            expect(response.body.error.code).toBe('ADMIN_APPROVAL_PENDING');
        });
    });
    describe('admin registration review', () => {
        it('lists and approves pending registration requests', async () => {
            const { email: adminEmail } = await createApprovedUser({
                role: roles_types_1.UserRole.ADMIN,
                email: `admin-${(0, crypto_1.randomUUID)()}@example.com`,
                displayName: 'Platform Admin',
            });
            const adminLogin = await loginAs(adminEmail);
            const mentorEmail = `mentor-${(0, crypto_1.randomUUID)()}@example.com`;
            const requestResponse = await (0, supertest_1.default)(app_1.default).post('/api/auth/register-request').send({
                email: mentorEmail,
                password: PASSWORD,
                displayName: 'Mentor Applicant',
                role: 'mentor',
                domain: 'Product Strategy',
            });
            const requestId = requestResponse.body.data.user._id;
            const listResponse = await (0, supertest_1.default)(app_1.default)
                .get('/api/admin/registration-requests')
                .set('Authorization', `Bearer ${adminLogin.accessToken}`);
            expect(listResponse.status).toBe(200);
            expect(listResponse.body.data.items).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    _id: requestId,
                    email: mentorEmail,
                    status: 'pending',
                }),
            ]));
            const approveResponse = await (0, supertest_1.default)(app_1.default)
                .patch(`/api/admin/registration-requests/${requestId}/approve`)
                .set('Authorization', `Bearer ${adminLogin.accessToken}`)
                .send({});
            expect(approveResponse.status).toBe(200);
            const loginResponse = await (0, supertest_1.default)(app_1.default).post('/api/auth/login').send({
                email: mentorEmail,
                password: PASSWORD,
            });
            expect(loginResponse.status).toBe(200);
            expect(loginResponse.body.data.user.adminApprovalStatus).toBe('approved');
        });
        it('rejects registration requests with a reason', async () => {
            const { email: adminEmail } = await createApprovedUser({
                role: roles_types_1.UserRole.ADMIN,
                email: `admin-${(0, crypto_1.randomUUID)()}@example.com`,
                displayName: 'Platform Admin',
            });
            const adminLogin = await loginAs(adminEmail);
            const recruiterEmail = `recruiter-${(0, crypto_1.randomUUID)()}@example.com`;
            const requestResponse = await (0, supertest_1.default)(app_1.default).post('/api/auth/register-request').send({
                email: recruiterEmail,
                password: PASSWORD,
                displayName: 'Recruiter Applicant',
                role: 'recruiter',
                domain: 'Hiring',
            });
            const requestId = requestResponse.body.data.user._id;
            const rejectResponse = await (0, supertest_1.default)(app_1.default)
                .patch(`/api/admin/registration-requests/${requestId}/reject`)
                .set('Authorization', `Bearer ${adminLogin.accessToken}`)
                .send({ rejectionReason: 'Need company verification details first.' });
            expect(rejectResponse.status).toBe(200);
            const loginResponse = await (0, supertest_1.default)(app_1.default).post('/api/auth/login').send({
                email: recruiterEmail,
                password: PASSWORD,
            });
            expect(loginResponse.status).toBe(403);
            expect(loginResponse.body.error.code).toBe('ADMIN_APPROVAL_REJECTED');
        });
    });
    describe('admin credential limit', () => {
        it('blocks creating a fourth admin account through role promotion', async () => {
            const { email: primaryAdminEmail } = await createApprovedUser({
                role: roles_types_1.UserRole.ADMIN,
                email: `admin-primary-${(0, crypto_1.randomUUID)()}@example.com`,
                displayName: 'Primary Admin',
            });
            await createApprovedUser({
                role: roles_types_1.UserRole.ADMIN,
                email: `admin-second-${(0, crypto_1.randomUUID)()}@example.com`,
                displayName: 'Second Admin',
            });
            await createApprovedUser({
                role: roles_types_1.UserRole.ADMIN,
                email: `admin-third-${(0, crypto_1.randomUUID)()}@example.com`,
                displayName: 'Third Admin',
            });
            const adminLogin = await loginAs(primaryAdminEmail);
            const { user: mentorUser } = await createApprovedUser({
                role: roles_types_1.UserRole.MENTOR,
                email: `mentor-${(0, crypto_1.randomUUID)()}@example.com`,
                displayName: 'Mentor To Promote',
                domain: 'Product Strategy',
            });
            const response = await (0, supertest_1.default)(app_1.default)
                .patch(`/api/admin/users/${mentorUser._id.toString()}/role`)
                .set('Authorization', `Bearer ${adminLogin.accessToken}`)
                .send({ role: roles_types_1.UserRole.ADMIN });
            expect(response.status).toBe(409);
            expect(response.body.error.code).toBe('ADMIN_CREDENTIAL_LIMIT_REACHED');
            const updatedMentor = await user_model_1.User.findById(mentorUser._id).lean();
            expect(updatedMentor?.role).toBe(roles_types_1.UserRole.MENTOR);
        });
    });
    describe('institution-managed temporary student credentials', () => {
        it('allows a school to create temporary student credentials on its own domain', async () => {
            const schoolEmail = `admin-${(0, crypto_1.randomUUID)()}@campus.test`;
            await createApprovedUser({
                role: roles_types_1.UserRole.SCHOOL,
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
            const studentEmail = `student-${(0, crypto_1.randomUUID)()}@campus.test`;
            const response = await (0, supertest_1.default)(app_1.default)
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
            const loginResponse = await (0, supertest_1.default)(app_1.default).post('/api/auth/login').send({
                email: studentEmail,
                password: response.body.data.temporaryPassword,
            });
            expect(loginResponse.status).toBe(200);
            expect(loginResponse.body.data.user.accessGrantedBy).toBe('institution_admin');
        });
        it('rejects temporary student credentials for a different email domain', async () => {
            const collegeEmail = `dean-${(0, crypto_1.randomUUID)()}@college.test`;
            await createApprovedUser({
                role: roles_types_1.UserRole.COLLEGE,
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
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/college/student-temp-credentials')
                .set('Authorization', `Bearer ${collegeLogin.accessToken}`)
                .send({
                displayName: 'External Student',
                email: `student-${(0, crypto_1.randomUUID)()}@external.test`,
                gradeOrProgram: 'B.Tech',
            });
            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('INSTITUTION_EMAIL_DOMAIN_REQUIRED');
        });
    });
    describe.skip('OAuth login', () => {
        it('signs in an approved user with Google OAuth and keeps manual login intact', async () => {
            const { email } = await createApprovedUser({
                role: roles_types_1.UserRole.MENTOR,
                email: `mentor-${(0, crypto_1.randomUUID)()}@example.com`,
                displayName: 'OAuth Mentor',
                domain: 'AI Strategy',
            });
            const fetchMock = mockOAuthFetch('google', email);
            try {
                const startResponse = await (0, supertest_1.default)(app_1.default).get('/api/auth/oauth/google');
                expect(startResponse.status).toBe(302);
                const authorizationUrl = new URL(startResponse.headers.location, API_ORIGIN);
                const state = authorizationUrl.searchParams.get('state');
                expect(state).toBeTruthy();
                const callbackResponse = await (0, supertest_1.default)(app_1.default).get(`/api/auth/oauth/google/callback?code=test-google-code&state=${state}`);
                expect(callbackResponse.status).toBe(302);
                expect(callbackResponse.headers.location).toContain('/auth/callback?provider=google&status=success');
                const oauthCookie = callbackResponse.headers['set-cookie']?.[0];
                expect(oauthCookie).toContain('refreshToken=');
                const refreshResponse = await (0, supertest_1.default)(app_1.default)
                    .post('/api/auth/refresh')
                    .set('Cookie', oauthCookie);
                expect(refreshResponse.status).toBe(200);
                expect(refreshResponse.body.data.user.email).toBe(email);
                expect(refreshResponse.body.data.user.connectedAccounts.google.userId).toBe('google-user-123');
                const manualLogin = await (0, supertest_1.default)(app_1.default).post('/api/auth/login').send({
                    email,
                    password: PASSWORD,
                });
                expect(manualLogin.status).toBe(200);
            }
            finally {
                restoreFetch(fetchMock);
            }
        });
        it('signs in an approved user with LinkedIn OAuth', async () => {
            const { email } = await createApprovedUser({
                role: roles_types_1.UserRole.RECRUITER,
                email: `recruiter-${(0, crypto_1.randomUUID)()}@example.com`,
                displayName: 'OAuth Recruiter',
                domain: 'Campus Hiring',
            });
            const fetchMock = mockOAuthFetch('linkedin', email);
            try {
                const startResponse = await (0, supertest_1.default)(app_1.default).get('/api/auth/oauth/linkedin');
                const authorizationUrl = new URL(startResponse.headers.location, API_ORIGIN);
                const state = authorizationUrl.searchParams.get('state');
                expect(startResponse.status).toBe(302);
                expect(state).toBeTruthy();
                const callbackResponse = await (0, supertest_1.default)(app_1.default).get(`/api/auth/oauth/linkedin/callback?code=test-linkedin-code&state=${state}`);
                expect(callbackResponse.status).toBe(302);
                expect(callbackResponse.headers.location).toContain('/auth/callback?provider=linkedin&status=success');
                const refreshResponse = await (0, supertest_1.default)(app_1.default)
                    .post('/api/auth/refresh')
                    .set('Cookie', callbackResponse.headers['set-cookie']?.[0]);
                expect(refreshResponse.status).toBe(200);
                expect(refreshResponse.body.data.user.email).toBe(email);
                expect(refreshResponse.body.data.user.connectedAccounts.linkedin.userId).toBe('linkedin-user-456');
            }
            finally {
                restoreFetch(fetchMock);
            }
        });
    });
    describe('POST /api/auth/refresh', () => {
        it('rotates the refresh token for approved users', async () => {
            const { email } = await createApprovedUser({
                role: roles_types_1.UserRole.MENTOR,
                email: `mentor-${(0, crypto_1.randomUUID)()}@example.com`,
                displayName: 'Approved Mentor',
                domain: 'Product Strategy',
            });
            const login = await loginAs(email);
            const firstRefresh = await (0, supertest_1.default)(app_1.default).post('/api/auth/refresh').set('Cookie', login.cookie);
            const secondRefresh = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/refresh')
                .set('Cookie', firstRefresh.headers['set-cookie'][0]);
            expect(firstRefresh.status).toBe(200);
            expect(secondRefresh.status).toBe(200);
        });
        it('rejects expired refresh tokens', async () => {
            const { user } = await createApprovedUser({
                role: roles_types_1.UserRole.STUDENT,
                email: `student-${(0, crypto_1.randomUUID)()}@example.com`,
                displayName: 'Expired Token Student',
            });
            const expiredToken = jsonwebtoken_1.default.sign({
                _id: user._id.toString(),
                email: user.email,
                role: user.role,
                tokenId: 'expired-token-id',
                type: 'refresh',
            }, env_1.env.JWT_REFRESH_SECRET, { algorithm: 'RS256', expiresIn: '-1s' });
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/refresh')
                .set('Cookie', `refreshToken=${expiredToken}`);
            expect(response.status).toBe(401);
            expect(response.body.error.code).toBe('UNAUTHORIZED');
        });
    });
});
