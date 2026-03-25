"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../src/app"));
const env_1 = require("../../src/config/env");
const user_model_1 = require("../../src/modules/user/user.model");
const validRegisterPayload = {
    email: 'mentor@example.com',
    password: 'Password123!',
    displayName: 'Mentor User',
    role: 'mentor',
    domain: 'Product Strategy',
};
const registerAndExtract = async () => {
    const response = await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send(validRegisterPayload);
    const cookie = response.headers['set-cookie']?.[0];
    const accessToken = response.body.data.accessToken;
    return { response, cookie, accessToken };
};
describe('auth integration', () => {
    describe('POST /api/auth/register', () => {
        it('creates non-student accounts without an access code', async () => {
            const response = await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send(validRegisterPayload);
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.accessToken).toEqual(expect.any(String));
            expect(response.body.data.user.email).toBe(validRegisterPayload.email);
            expect(response.body.data.user.accessGrantedBy).toBe('self_registered');
            expect(response.headers['set-cookie']?.[0]).toContain('refreshToken=');
        });
        it('creates a user, returns an access token, and sets a cookie', async () => {
            const schoolRegistration = await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send({
                email: 'school@example.com',
                password: 'Password123!',
                displayName: 'Innovation Coordinator',
                role: 'school',
                institutionProfile: {
                    institutionName: 'Future Ready School',
                    location: 'Hyderabad',
                    totalStudentsEnrolled: 950,
                    academicYear: '2025-26',
                },
            });
            const tokenResponse = await (0, supertest_1.default)(app_1.default)
                .post('/api/school/student-access-tokens')
                .set('Authorization', `Bearer ${schoolRegistration.body.data.accessToken}`)
                .send({ label: 'Class 12 innovators' });
            const response = await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send({
                email: 'student@example.com',
                password: 'Password123!',
                displayName: 'Student User',
                role: 'student',
                institutionToken: tokenResponse.body.data.token,
            });
            expect(response.status).toBe(202);
            expect(response.body.success).toBe(true);
            expect(response.body.data.requiresVerification).toBe(true);
            expect(response.body.data.accessToken).toBeUndefined();
            expect(response.body.data.user.email).toBe('student@example.com');
            expect(response.body.data.user.verificationStatus).toBe('pending');
            expect(response.body.data.user.isActive).toBe(false);
            expect(response.body.data.user.passwordHash).toBeUndefined();
            expect(response.headers['set-cookie']).toBeUndefined();
        });
        it('rejects duplicate email registrations', async () => {
            await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send(validRegisterPayload);
            const response = await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send(validRegisterPayload);
            expect(response.status).toBe(409);
            expect(response.body.error.code).toBe('DUPLICATE_KEY');
        });
        it('rejects when capacity is reached', async () => {
            const previousMax = env_1.env.MAX_USERS_YEAR_ONE;
            env_1.env.MAX_USERS_YEAR_ONE = 1;
            await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send(validRegisterPayload);
            const response = await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send({
                ...validRegisterPayload,
                email: 'second@example.com',
            });
            env_1.env.MAX_USERS_YEAR_ONE = previousMax;
            expect(response.status).toBe(403);
            expect(response.body.error.code).toBe('CAPACITY_REACHED');
        });
        it('rejects invalid role payloads', async () => {
            const response = await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send({
                ...validRegisterPayload,
                role: 'company',
            });
            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });
        it('stores institution details for school registrations', async () => {
            const response = await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send({
                email: 'school@example.com',
                password: 'Password123!',
                displayName: 'Innovation Coordinator',
                role: 'school',
                institutionProfile: {
                    institutionName: 'Future Ready School',
                    location: 'Hyderabad',
                    totalStudentsEnrolled: 950,
                    academicYear: '2025-26',
                },
            });
            expect(response.status).toBe(201);
            expect(response.body.data.user.institutionProfile.institutionName).toBe('Future Ready School');
            expect(response.body.data.user.profileComplete).toBe(true);
        });
        it('rejects student registrations without an institution token', async () => {
            const response = await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send({
                email: 'student-without-token@example.com',
                password: 'Password123!',
                displayName: 'Student User',
                role: 'student',
            });
            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });
    });
    describe('POST /api/auth/login', () => {
        it('logs in successfully', async () => {
            await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send(validRegisterPayload);
            const response = await (0, supertest_1.default)(app_1.default).post('/api/auth/login').send({
                email: validRegisterPayload.email,
                password: validRegisterPayload.password,
                role: validRegisterPayload.role,
            });
            expect(response.status).toBe(200);
            expect(response.body.data.user.role).toBe('mentor');
            expect(response.headers['set-cookie']?.[0]).toContain('refreshToken=');
        });
        it('rejects wrong password', async () => {
            await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send(validRegisterPayload);
            const response = await (0, supertest_1.default)(app_1.default).post('/api/auth/login').send({
                email: validRegisterPayload.email,
                password: 'WrongPassword123!',
                role: validRegisterPayload.role,
            });
            expect(response.status).toBe(401);
            expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
        });
        it('blocks student login while institution approval is pending', async () => {
            const schoolRegistration = await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send({
                email: 'school-login@example.com',
                password: 'Password123!',
                displayName: 'Innovation Coordinator',
                role: 'school',
                institutionProfile: {
                    institutionName: 'Future Ready School',
                    location: 'Hyderabad',
                    totalStudentsEnrolled: 950,
                    academicYear: '2025-26',
                },
            });
            const tokenResponse = await (0, supertest_1.default)(app_1.default)
                .post('/api/school/student-access-tokens')
                .set('Authorization', `Bearer ${schoolRegistration.body.data.accessToken}`)
                .send({});
            await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send({
                email: 'pending-student@example.com',
                password: 'Password123!',
                displayName: 'Pending Student',
                role: 'student',
                institutionToken: tokenResponse.body.data.token,
            });
            const response = await (0, supertest_1.default)(app_1.default).post('/api/auth/login').send({
                email: 'pending-student@example.com',
                password: 'Password123!',
                role: 'student',
            });
            expect(response.status).toBe(403);
            expect(response.body.error.code).toBe('INSTITUTION_VERIFICATION_PENDING');
        });
        it('allows a student to log in after institution approval', async () => {
            const schoolRegistration = await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send({
                email: 'approver-school@example.com',
                password: 'Password123!',
                displayName: 'Innovation Coordinator',
                role: 'school',
                institutionProfile: {
                    institutionName: 'Future Ready School',
                    location: 'Hyderabad',
                    totalStudentsEnrolled: 950,
                    academicYear: '2025-26',
                },
            });
            const schoolAccessToken = schoolRegistration.body.data.accessToken;
            const tokenResponse = await (0, supertest_1.default)(app_1.default)
                .post('/api/school/student-access-tokens')
                .set('Authorization', `Bearer ${schoolAccessToken}`)
                .send({ label: 'Founders cohort' });
            const registerResponse = await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send({
                email: 'approved-student@example.com',
                password: 'Password123!',
                displayName: 'Approved Student',
                role: 'student',
                institutionToken: tokenResponse.body.data.token,
            });
            await (0, supertest_1.default)(app_1.default)
                .patch(`/api/school/student-verifications/${registerResponse.body.data.user._id}`)
                .set('Authorization', `Bearer ${schoolAccessToken}`)
                .send({ decision: 'approved' });
            const response = await (0, supertest_1.default)(app_1.default).post('/api/auth/login').send({
                email: 'approved-student@example.com',
                password: 'Password123!',
                role: 'student',
            });
            expect(response.status).toBe(200);
            expect(response.body.data.user.role).toBe('student');
            expect(response.body.data.user.verificationStatus).toBe('verified');
        });
        it('rejects role mismatch', async () => {
            await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send(validRegisterPayload);
            const response = await (0, supertest_1.default)(app_1.default).post('/api/auth/login').send({
                email: validRegisterPayload.email,
                password: validRegisterPayload.password,
                role: 'investor',
            });
            expect(response.status).toBe(401);
            expect(response.body.error.code).toBe('ROLE_MISMATCH');
        });
    });
    describe('POST /api/auth/refresh', () => {
        it('rotates the refresh token', async () => {
            const { cookie } = await registerAndExtract();
            const firstRefresh = await (0, supertest_1.default)(app_1.default).post('/api/auth/refresh').set('Cookie', cookie);
            const secondRefresh = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/refresh')
                .set('Cookie', firstRefresh.headers['set-cookie'][0]);
            expect(firstRefresh.status).toBe(200);
            expect(firstRefresh.body.data.accessToken).toEqual(expect.any(String));
            expect(secondRefresh.status).toBe(200);
        });
        it('rejects invalid refresh tokens', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/refresh')
                .set('Cookie', 'refreshToken=invalid-token');
            expect(response.status).toBe(401);
            expect(response.body.error.code).toBe('UNAUTHORIZED');
        });
        it('rejects expired refresh tokens', async () => {
            const user = await user_model_1.User.create({
                email: 'expired@example.com',
                passwordHash: 'hashed',
                role: 'student',
                displayName: 'Expired Token',
                accessGrantedBy: 'self_registered',
                accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
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
    describe('POST /api/auth/logout', () => {
        it('logs out successfully', async () => {
            const { cookie, accessToken } = await registerAndExtract();
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/logout')
                .set('Cookie', cookie)
                .set('Authorization', `Bearer ${accessToken}`);
            expect(response.status).toBe(200);
            expect(response.headers['set-cookie']?.[0]).toContain('refreshToken=;');
        });
        it('returns success when already logged out', async () => {
            const { cookie, accessToken } = await registerAndExtract();
            await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/logout')
                .set('Cookie', cookie)
                .set('Authorization', `Bearer ${accessToken}`);
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/logout')
                .set('Cookie', cookie)
                .set('Authorization', `Bearer ${accessToken}`);
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });
    describe('GET /api/users/me', () => {
        it('returns the authenticated user without passwordHash', async () => {
            const { accessToken } = await registerAndExtract();
            const response = await (0, supertest_1.default)(app_1.default)
                .get('/api/users/me')
                .set('Authorization', `Bearer ${accessToken}`);
            expect(response.status).toBe(200);
            expect(response.body.data.email).toBe(validRegisterPayload.email);
            expect(response.body.data.passwordHash).toBeUndefined();
        });
        it('rejects when no token is provided', async () => {
            const response = await (0, supertest_1.default)(app_1.default).get('/api/users/me');
            expect(response.status).toBe(401);
            expect(response.body.error.code).toBe('UNAUTHORIZED');
        });
        it('rejects expired access tokens', async () => {
            const { response: registerResponse } = await registerAndExtract();
            const userId = registerResponse.body.data.user._id;
            const expiredAccessToken = jsonwebtoken_1.default.sign({
                _id: userId,
                email: validRegisterPayload.email,
                role: 'student',
                type: 'access',
            }, env_1.env.JWT_ACCESS_SECRET, { algorithm: 'RS256', expiresIn: '-1s' });
            const response = await (0, supertest_1.default)(app_1.default)
                .get('/api/users/me')
                .set('Authorization', `Bearer ${expiredAccessToken}`);
            expect(response.status).toBe(401);
            expect(response.body.error.code).toBe('UNAUTHORIZED');
        });
    });
    describe('rate limiting', () => {
        it('blocks more than 10 auth attempts within the window', async () => {
            let response;
            for (let attempt = 0; attempt < 11; attempt += 1) {
                response = await (0, supertest_1.default)(app_1.default)
                    .post('/api/auth/login')
                    .set('X-Forwarded-For', '203.0.113.10')
                    .send({
                    email: 'missing@example.com',
                    password: 'Password123!',
                    role: 'student',
                });
            }
            expect(response?.status).toBe(429);
            expect(response?.body.error.code).toBe('RATE_LIMITED');
        });
    });
});
