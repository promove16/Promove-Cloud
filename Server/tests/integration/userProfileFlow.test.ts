import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { scoreQueue } from '../../src/config/bullmq';
import { InstitutionStudentRosterEntry } from '../../src/modules/institution/studentRoster.model';
import { User } from '../../src/modules/user/user.model';
import { UserRole } from '../../src/types/roles.types';

const PASSWORD = 'Password123!';

const createStudent = async (overrides: Record<string, unknown> = {}) => {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  return User.create({
    email: `student-${randomUUID()}@example.com`,
    passwordHash,
    role: UserRole.STUDENT,
    displayName: 'Student Builder',
    profileComplete: false,
    registrationStage: 'basic',
    accessGrantedBy: 'self_registered',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    institutionToken: null,
    institutionId: null,
    institutionVerificationStatus: 'none',
    verificationStatus: 'not_required',
    adminApprovalStatus: 'not_required',
    ...overrides,
  });
};

const loginAs = async (email: string) => {
  const response = await request(app).post('/api/auth/login').send({
    email,
    password: PASSWORD,
  });

  return response.body.data?.accessToken as string;
};

describe('user profile flow integration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('queues profile-complete scoring only on the first completed profile update', async () => {
    const student = await createStudent();
    const accessToken = await loginAs(student.email);
    const scoreAddSpy = jest.spyOn(scoreQueue, 'add');

    const firstResponse = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ bio: 'Building climate resilience products.' });

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.data.profileComplete).toBe(true);
    expect(firstResponse.body.data.innovationScore).toBe(50);
    expect(scoreAddSpy).not.toHaveBeenCalled();

    scoreAddSpy.mockClear();

    const secondResponse = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ avatar: 'https://example.com/avatar.png' });

    expect(secondResponse.status).toBe(200);
    expect(scoreAddSpy).not.toHaveBeenCalled();
  });

  it('keeps current-session education from institution access while preserving additional user education', async () => {
    const institution = await User.create({
      email: `college-${randomUUID()}@example.com`,
      passwordHash: await bcrypt.hash(PASSWORD, 12),
      role: UserRole.COLLEGE,
      displayName: 'Builder College',
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
      institutionProfile: {
        institutionName: 'Builder College',
        location: 'India',
        totalStudentsEnrolled: 1200,
        academicYear: '2025-26',
        iicStarRating: 4.2,
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

    const student = await createStudent({
      email: `student-${randomUUID()}@example.com`,
      displayName: 'Institution Student',
      institutionId: institution._id,
      institutionToken: 'COL-ACCESS',
      institutionVerificationStatus: 'verified',
      verificationStatus: 'verified',
      institutionVerifiedAt: new Date(),
      verifiedAt: new Date(),
    });

    await InstitutionStudentRosterEntry.create({
      institutionId: institution._id,
      institutionRole: UserRole.COLLEGE,
      createdBy: institution._id,
      displayName: student.displayName,
      email: student.email,
      gradeOrProgram: 'B.Tech CSE',
      notes: 'Innovation cohort',
      source: 'manual',
      status: 'verified',
      linkedUserId: student._id,
      registeredAt: new Date(),
      reviewedAt: new Date(),
      isActive: true,
    });

    const accessToken = await loginAs(student.email);

    const initialProfileResponse = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(initialProfileResponse.status).toBe(200);
    expect(initialProfileResponse.body.data.education[0]).toMatchObject({
      institution: 'Builder College',
      degree: 'B.Tech CSE',
      isCurrent: true,
      source: 'institution',
    });

    const updateResponse = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        education: [
          {
            institution: 'Town High School',
            degree: 'Higher Secondary',
            fieldOfStudy: 'Science',
            startYear: 2021,
            endYear: 2023,
            isCurrent: false,
            grade: '92%',
            activities: 'Robotics club',
            description: 'Built early prototypes.',
            source: 'manual',
          },
        ],
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.education).toHaveLength(2);
    expect(updateResponse.body.data.education[0]).toMatchObject({
      institution: 'Builder College',
      degree: 'B.Tech CSE',
      isCurrent: true,
      source: 'institution',
    });
    expect(updateResponse.body.data.education[1]).toMatchObject({
      institution: 'Town High School',
      degree: 'Higher Secondary',
      source: 'manual',
    });

    const refreshedProfileResponse = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(refreshedProfileResponse.status).toBe(200);
    expect(refreshedProfileResponse.body.data.education).toHaveLength(2);
    expect(refreshedProfileResponse.body.data.education[0]).toMatchObject({
      institution: 'Builder College',
      degree: 'B.Tech CSE',
      source: 'institution',
    });
    expect(refreshedProfileResponse.body.data.education[1]).toMatchObject({
      institution: 'Town High School',
      source: 'manual',
    });
  });

  it('serves only verified public student profiles and filters private GitHub proof', async () => {
    const institution = await User.create({
      email: `college-${randomUUID()}@example.com`,
      passwordHash: await bcrypt.hash(PASSWORD, 12),
      role: UserRole.COLLEGE,
      displayName: 'Verified College',
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
    });

    await createStudent({
      email: `public-${randomUUID()}@example.com`,
      displayName: 'Public Student',
      profileComplete: true,
      registrationStage: 'institution_verified',
      verificationStatus: 'verified',
      institutionVerificationStatus: 'verified',
      institutionVerifiedAt: new Date(),
      verifiedAt: new Date(),
      institutionId: institution._id,
      isProfilePublic: true,
      profileSlug: 'public-student-demo',
      githubProof: {
        importedRepoIds: ['public-1', 'private-1'],
        importedRepos: [
          {
            repoId: 'public-1',
            name: 'public-repo',
            fullName: 'public/student-repo',
            description: 'Public repo',
            url: 'https://github.com/public/student-repo',
            owner: 'public',
            isPrivate: false,
            defaultBranch: 'main',
            primaryLanguage: 'TypeScript',
            languages: ['TypeScript'],
            stars: 3,
            forks: 1,
            openIssues: 0,
            pushedAt: new Date(),
            importedAt: new Date(),
            recentCommits: [],
          },
          {
            repoId: 'private-1',
            name: 'private-repo',
            fullName: 'private/student-repo',
            description: 'Private repo',
            url: 'https://github.com/private/student-repo',
            owner: 'private',
            isPrivate: true,
            defaultBranch: 'main',
            primaryLanguage: 'TypeScript',
            languages: ['TypeScript'],
            stars: 0,
            forks: 0,
            openIssues: 0,
            pushedAt: new Date(),
            importedAt: new Date(),
            recentCommits: [],
          },
        ],
        recentActivity: [
          {
            id: 'activity-public',
            type: 'push',
            repoFullName: 'public/student-repo',
            title: 'Public push',
            summary: 'Pushed a feature branch',
            url: 'https://github.com/public/student-repo/commit/1',
            occurredAt: new Date(),
            commitCount: 2,
            isPrivate: false,
          },
          {
            id: 'activity-private',
            type: 'push',
            repoFullName: 'private/student-repo',
            title: 'Private push',
            summary: 'Pushed internal work',
            url: null,
            occurredAt: new Date(),
            commitCount: 1,
            isPrivate: true,
          },
        ],
        commitCount30Days: 12,
        activeDays30Days: 6,
        pushEvents30Days: 5,
        pullRequests30Days: 2,
        issues30Days: 1,
        lastSyncedAt: new Date(),
      },
    });

    await createStudent({
      email: `pending-${randomUUID()}@example.com`,
      displayName: 'Pending Student',
      profileComplete: true,
      verificationStatus: 'pending',
      institutionVerificationStatus: 'verified',
      institutionId: institution._id,
      isProfilePublic: true,
      profileSlug: 'pending-student-demo',
    });

    const publicResponse = await request(app).get('/api/users/public/public-student-demo');

    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.data.displayName).toBe('Public Student');
    expect(publicResponse.body.data.email).toBeUndefined();
    expect(publicResponse.body.data.institution.displayName).toBe('Verified College');
    expect(publicResponse.body.data.githubProof.importedRepos).toHaveLength(1);
    expect(publicResponse.body.data.githubProof.importedRepos[0].repoId).toBe('public-1');
    expect(publicResponse.body.data.githubProof.recentActivity).toHaveLength(1);
    expect(publicResponse.body.data.githubProof.recentActivity[0].id).toBe('activity-public');

    const pendingResponse = await request(app).get('/api/users/public/pending-student-demo');

    expect(pendingResponse.status).toBe(404);
    expect(pendingResponse.body.error.code).toBe('PUBLIC_PROFILE_NOT_FOUND');
  });
});
