import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { verifyMilestone } from '../../src/modules/admin/admin.service';
import { onPrototypeMilestoneVerified } from '../../src/modules/mentorScore/mentorScore.hooks';
import { MentorScore } from '../../src/modules/mentorScore/mentorScore.model';
import { User } from '../../src/modules/user/user.model';
import { Workspace } from '../../src/modules/workspace/workspace.model';
import { UserRole } from '../../src/types/roles.types';

const createUser = async (role: UserRole, email: string, displayName: string) =>
  User.create({
    email,
    passwordHash: 'hashed',
    role,
    displayName,
    profileComplete: true,
    registrationStage: role === UserRole.STUDENT ? 'profile_setup' : 'complete',
    accessGrantedBy: 'admin',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    verificationStatus: role === UserRole.STUDENT ? 'verified' : 'not_required',
    adminApprovalStatus: role === UserRole.STUDENT ? 'not_required' : 'approved',
  });

const makeAccessToken = (user: { _id: Types.ObjectId; email: string; role: UserRole }) =>
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

describe('Prototype Velocity scoring', () => {
  it('awards prototype velocity points to the workspace-assigned mentor and is idempotent per student', async () => {
    const [mentor, student] = await Promise.all([
      createUser(UserRole.MENTOR, 'pv-mentor@example.com', 'PV Mentor'),
      createUser(UserRole.STUDENT, 'pv-student@example.com', 'PV Student'),
    ]);

    const workspace = await Workspace.create({
      ownerId: student._id,
      teamMemberIds: [student._id],
      title: 'Student Project',
      category: 'IoT',
      stage: 'Build',
      chatParticipants: [
        {
          userId: mentor._id,
          role: 'mentor',
          addedBy: student._id,
          addedAt: new Date(),
        },
      ],
    });

    await onPrototypeMilestoneVerified(String(student._id), String(workspace._id));

    const score = await MentorScore.findOne({ mentorId: mentor._id }).lean();
    expect(score?.totalScore).toBe(10);
    expect(score?.phase2Score).toBe(10);
    expect(score?.phase2Breakdown.prototypeVelocity).toBe(10);

    // Same student reaching prototype again must not double-award
    await onPrototypeMilestoneVerified(String(student._id), String(workspace._id));
    const scoreAfter = await MentorScore.findOne({ mentorId: mentor._id }).lean();
    expect(scoreAfter?.totalScore).toBe(10);
    expect(scoreAfter?.phase2Breakdown.prototypeVelocity).toBe(10);
  });

  it('submits prototype velocity evidence as a mentor and awards points on admin approval', async () => {
    const [mentor, student, admin] = await Promise.all([
      createUser(UserRole.MENTOR, 'pv-evidence-mentor@example.com', 'PV Evidence Mentor'),
      createUser(UserRole.STUDENT, 'pv-evidence-student@example.com', 'PV Evidence Student'),
      createUser(UserRole.ADMIN, 'pv-admin@example.com', 'PV Admin'),
    ]);

    const submitResponse = await request(app)
      .post('/api/mentor-score/submit/prototype-velocity')
      .set('Authorization', `Bearer ${makeAccessToken(mentor)}`)
      .send({
        studentId: String(student._id),
        projectTitle: 'Solar Tracker',
        stage: 'Prototype',
        photoUrls: ['https://example.com/prototype.jpg'],
      });

    expect(submitResponse.status).toBe(201);
    const taskId = submitResponse.body.data._id as string;

    const approveResponse = await request(app)
      .post(`/api/admin/mentor-score/verifications/${taskId}/approve`)
      .set('Authorization', `Bearer ${makeAccessToken(admin)}`)
      .send({});

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.pointsAwarded).toBe(10);

    const score = await MentorScore.findOne({ mentorId: mentor._id }).lean();
    expect(score?.phase2Breakdown.prototypeVelocity).toBe(10);
    expect(score?.totalScore).toBe(10);

    // Duplicate submission for the same student must be rejected
    const duplicateResponse = await request(app)
      .post('/api/mentor-score/submit/prototype-velocity')
      .set('Authorization', `Bearer ${makeAccessToken(mentor)}`)
      .send({
        studentId: String(student._id),
        projectTitle: 'Solar Tracker v2',
        stage: 'Prototype',
        photoUrls: ['https://example.com/prototype2.jpg'],
      });

    expect(duplicateResponse.status).toBe(400);
  });

  it('fires prototype velocity attribution when admin verifies a PROTOTYPE milestone', async () => {
    const [mentor, student, admin] = await Promise.all([
      createUser(UserRole.MENTOR, 'pv-milestone-mentor@example.com', 'PV Milestone Mentor'),
      createUser(UserRole.STUDENT, 'pv-milestone-student@example.com', 'PV Milestone Student'),
      createUser(UserRole.ADMIN, 'pv-milestone-admin@example.com', 'PV Milestone Admin'),
    ]);

    const workspace = await Workspace.create({
      ownerId: student._id,
      teamMemberIds: [student._id],
      title: 'Milestone Project',
      category: 'AI',
      stage: 'Build',
      chatParticipants: [
        {
          userId: mentor._id,
          role: 'mentor',
          addedBy: student._id,
          addedAt: new Date(),
        },
      ],
    });
    const milestoneId = String(workspace.milestones[0]._id);

    await verifyMilestone(String(admin._id), milestoneId, 'PROTOTYPE');

    // Verification does not return until mentor attribution has completed.
    const score = await MentorScore.findOne({ mentorId: mentor._id }).lean();
    expect(score?.phase2Breakdown.prototypeVelocity).toBe(10);
    expect(score?.totalScore).toBe(10);
  });
});
