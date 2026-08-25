import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { ScoreEvent } from '../../src/modules/innovationScore/score.model';
import { Problem } from '../../src/modules/problemBank/problem.model';
import { Startup } from '../../src/modules/startup/startup.model';
import { User } from '../../src/modules/user/user.model';
import { Workspace } from '../../src/modules/workspace/workspace.model';
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

describe('problem bank integration', () => {
  it('creates isolated problem workspaces per student and keeps repeat claims idempotent', async () => {
    const { user: firstStudent, email: firstEmail } = await createApprovedUser({
      role: UserRole.STUDENT,
      displayName: 'First Claimant',
    });
    const { user: secondStudent, email: secondEmail } = await createApprovedUser({
      role: UserRole.STUDENT,
      displayName: 'Second Claimant',
    });

    const firstToken = await loginAs(firstEmail);
    const secondToken = await loginAs(secondEmail);

    const listResponse = await request(app)
      .get('/api/problems')
      .set('Authorization', `Bearer ${firstToken}`);
    const problemId = listResponse.body.data[0]._id as string;

    const responses = await Promise.all([
      request(app)
        .post(`/api/problems/${problemId}/claim`)
        .set('Authorization', `Bearer ${firstToken}`),
      request(app)
        .post(`/api/problems/${problemId}/claim`)
        .set('Authorization', `Bearer ${secondToken}`),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 200]);

    const firstWorkspaceId = responses[0].body.data._id as string;
    const secondWorkspaceId = responses[1].body.data._id as string;
    expect(firstWorkspaceId).not.toBe(secondWorkspaceId);
    expect(responses[0].body.data.ownerId).toBe(String(firstStudent._id));
    expect(responses[1].body.data.ownerId).toBe(String(secondStudent._id));

    const retryResponse = await request(app)
      .post(`/api/problems/${problemId}/claim`)
      .set('Authorization', `Bearer ${firstToken}`);

    expect(retryResponse.status).toBe(200);
    expect(retryResponse.body.data._id).toBe(firstWorkspaceId);
    expect(await Workspace.countDocuments({ claimedProblemId: problemId })).toBe(2);

    const claimedProblem = await Problem.findById(problemId).lean();
    expect(claimedProblem?.claimStatus).toBe('open');
    expect(claimedProblem?.claimedBy).toBeUndefined();
    expect(claimedProblem?.claimedAt).toBeUndefined();

    const firstProgressResponse = await request(app)
      .post(`/api/workspace/${firstWorkspaceId}/progress`)
      .set('Authorization', `Bearer ${firstToken}`)
      .send({
        note: 'First student evidence is isolated to their own problem workspace.',
        milestoneRef: 'Research & Planning',
        completionPercent: 100,
      });
    expect(firstProgressResponse.status).toBe(200);

    const forbiddenWorkspaceResponse = await request(app)
      .get(`/api/workspace/${firstWorkspaceId}`)
      .set('Authorization', `Bearer ${secondToken}`);
    expect(forbiddenWorkspaceResponse.status).toBe(404);

    const [firstDetailResponse, secondDetailResponse] = await Promise.all([
      request(app)
        .get(`/api/problems/${problemId}`)
        .set('Authorization', `Bearer ${firstToken}`),
      request(app)
        .get(`/api/problems/${problemId}`)
        .set('Authorization', `Bearer ${secondToken}`),
    ]);

    expect(firstDetailResponse.status).toBe(200);
    expect(secondDetailResponse.status).toBe(200);
    expect(firstDetailResponse.body.data.viewerState.workspaceId).toBe(firstWorkspaceId);
    expect(firstDetailResponse.body.data.viewerState.progressPercent).toBeGreaterThan(0);
    expect(secondDetailResponse.body.data.viewerState.workspaceId).toBe(secondWorkspaceId);
    expect(secondDetailResponse.body.data.viewerState.progressPercent).toBe(0);

    const firstStudentAfterClaim = await User.findById(firstStudent._id).lean();
    const secondStudentAfterClaim = await User.findById(secondStudent._id).lean();
    expect(firstStudentAfterClaim?.innovationScore).toBe(0);
    expect(secondStudentAfterClaim?.innovationScore).toBe(0);
    expect(
      await ScoreEvent.exists({
        trigger: 'PROBLEM_CLAIMED',
        userId: { $in: [firstStudent._id, secondStudent._id] },
      }),
    ).toBeNull();

    expect(
      await ScoreEvent.exists({
        trigger: 'PROBLEM_CLAIMED',
      }),
    ).toBeNull();
  });

  it('requires the problem claim endpoint for problem-backed workspaces', async () => {
    const { email } = await createApprovedUser({
      role: UserRole.STUDENT,
      displayName: 'Workspace Bypass Student',
    });
    const token = await loginAs(email);

    const listResponse = await request(app)
      .get('/api/problems')
      .set('Authorization', `Bearer ${token}`);
    const problemId = listResponse.body.data[0]._id as string;

    const bypassResponse = await request(app)
      .post('/api/workspace')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Bypass attempt',
        category: 'Technology',
        claimedProblemId: problemId,
      });

    expect(bypassResponse.status).toBe(400);
    expect(bypassResponse.body.error.code).toBe('PROBLEM_CLAIM_ENDPOINT_REQUIRED');
    expect(await Workspace.countDocuments({ claimedProblemId: problemId })).toBe(0);
  });

  it('rejects progress updates with fake milestone names so progress score cannot be farmed', async () => {
    const { user, email } = await createApprovedUser({
      role: UserRole.STUDENT,
      displayName: 'Progress Guard Student',
    });
    const token = await loginAs(email);

    const workspaceResponse = await request(app)
      .post('/api/workspace')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Progress Guard Workspace',
        category: 'Technology',
      });

    expect(workspaceResponse.status).toBe(201);
    const workspaceId = workspaceResponse.body.data._id as string;

    const invalidProgressResponse = await request(app)
      .post(`/api/workspace/${workspaceId}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        note: 'Trying to create a fake milestone score event.',
        milestoneRef: 'Fake Milestone 001',
        completionPercent: 100,
      });

    expect(invalidProgressResponse.status).toBe(400);
    expect(invalidProgressResponse.body.error).toEqual(
      expect.objectContaining({
        code: 'INVALID_MILESTONE_REF',
      }),
    );

    const refreshedUser = await User.findById(user._id).select('innovationScore scoreBreakdown').lean();
    const scoreEvents = await ScoreEvent.find({ userId: user._id }).lean();
    expect(refreshedUser?.innovationScore ?? 0).toBe(0);
    expect(refreshedUser?.scoreBreakdown.progressUploads ?? 0).toBe(0);
    expect(scoreEvents).toHaveLength(0);
  });

  it('supports review requests, admin approval, and problem leaderboard ranking', async () => {
    const { user: studentUser, email: studentEmail } = await createApprovedUser({
      role: UserRole.STUDENT,
      displayName: 'Problem Student',
    });
    const { email: adminEmail } = await createApprovedUser({
      role: UserRole.ADMIN,
      displayName: 'Problem Admin',
    });

    const studentToken = await loginAs(studentEmail);
    const adminToken = await loginAs(adminEmail);

    const listResponse = await request(app)
      .get('/api/problems')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.length).toBeGreaterThan(0);

    const problemId = listResponse.body.data[0]._id as string;

    const claimResponse = await request(app)
      .post(`/api/problems/${problemId}/claim`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(claimResponse.status).toBe(200);
    const workspaceId = claimResponse.body.data._id as string;

    const linkedStartup = await Startup.create({
      founderIds: [studentUser._id],
      teamMemberIds: [],
      projectId: workspaceId,
      name: 'Problem Review Startup',
      tagline: 'A startup linked to the claimed problem workspace',
      category: 'Software',
      stage: 'MVP',
      isActive: true,
    });

    const progressResponse = await request(app)
      .post(`/api/workspace/${workspaceId}/progress`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        note: 'Completed the prototype, validation, and final delivery evidence.',
        milestoneRef: 'Final Delivery',
        completionPercent: 100,
      });

    expect(progressResponse.status).toBe(200);

    const reviewRequestResponse = await request(app)
      .post(`/api/problems/${problemId}/review-request`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        workspaceId,
        requestNote:
          'The team completed the prototype, uploaded supporting evidence, and is ready for admin review.',
      });

    expect(reviewRequestResponse.status).toBe(202);

    const reviewQueueResponse = await request(app)
      .get('/api/admin/problems/review-requests')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(reviewQueueResponse.status).toBe(200);
    expect(reviewQueueResponse.body.data).toHaveLength(1);
    expect(reviewQueueResponse.body.data[0].problem._id).toBe(problemId);

    const submissionId = reviewQueueResponse.body.data[0]._id as string;

    const approveResponse = await request(app)
      .patch(`/api/admin/problems/review-requests/${submissionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        decision: 'approved',
        pointsAwarded: 40,
        adminNotes: 'Verified team completion and evidence quality.',
      });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.reviewStatus).toBe('approved');
    expect(approveResponse.body.data.pointsAwarded).toBe(40);

    const leaderboardResponse = await request(app)
      .get(`/api/problems/${problemId}/leaderboard`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(leaderboardResponse.status).toBe(200);
    expect(leaderboardResponse.body.data.total).toBe(1);
    expect(leaderboardResponse.body.data.items[0]).toEqual(
      expect.objectContaining({
        workspaceId,
        pointsAwarded: 40,
        rank: 1,
      }),
    );

    const detailResponse = await request(app)
      .get(`/api/problems/${problemId}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.viewerState.status).toBe('approved');
    expect(detailResponse.body.data.viewerState.pointsAwarded).toBe(40);

    const retryApproveResponse = await request(app)
      .patch(`/api/admin/problems/review-requests/${submissionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        decision: 'approved',
        pointsAwarded: 40,
        adminNotes: 'Verified team completion and evidence quality.',
      });

    expect(retryApproveResponse.status).toBe(200);

    const updatedStudent = await User.findById(studentUser._id).lean();
    expect(updatedStudent?.innovationScore).toBe(350);
    expect(updatedStudent?.scoreBreakdown.problemsCompleted).toBe(1);
    expect(updatedStudent?.scoreBreakdown.mvpsVerified).toBe(1);
    expect(updatedStudent?.scoreBreakdown.marketReadyVerified).toBe(1);

    const updatedWorkspace = await Workspace.findById(workspaceId).lean();
    expect(updatedWorkspace?.stage).toBe('Build');

    const updatedStartup = await Startup.findById(linkedStartup._id).lean();
    expect(updatedStartup?.stage).toBe('Pre-Launch');
    expect(updatedStartup?.traction.mvpBuilt).toBe(true);
    expect(updatedStartup?.registrationProfile.developmentStage).toBe('market_ready');
    expect(updatedStartup?.initializationProfile.productStage).toBe('market_ready');
    expect(updatedStartup?.innovationProfile?.tractionProfile.startupStage).toBe('market_ready');

    const verificationEvents = await ScoreEvent.find({
      userId: studentUser._id,
      trigger: {
        $in: ['PROBLEM_COMPLETED', 'MVP_VERIFIED', 'MARKET_READY_VERIFIED'],
      },
    }).lean();
    expect(verificationEvents).toHaveLength(3);
  });
});
