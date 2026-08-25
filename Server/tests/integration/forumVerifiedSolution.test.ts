import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { ForumPost, ForumAnswer } from '../../src/modules/mentorScore/forum.model';
import { MentorScore } from '../../src/modules/mentorScore/mentorScore.model';
import { User } from '../../src/modules/user/user.model';
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

describe('Forum verified solutions', () => {
  it('lets the post author (student) verify a mentor answer and awards +15 pts', async () => {
    const [student, mentor] = await Promise.all([
      createUser(UserRole.STUDENT, 'forum-student@example.com', 'Forum Student'),
      createUser(UserRole.MENTOR, 'forum-mentor@example.com', 'Forum Mentor'),
    ]);

    const post = await ForumPost.create({
      authorId: student._id,
      authorRole: UserRole.STUDENT,
      title: 'How do I wire a relay?',
      body: 'Can someone explain relay wiring?',
      tags: ['iot'],
    });

    const answer = await ForumAnswer.create({
      postId: post._id,
      authorId: mentor._id,
      authorRole: UserRole.MENTOR,
      body: 'Connect the coil pins to the GPIO through a transistor.',
    });

    const res = await request(app)
      .patch(`/api/forum/answers/${answer._id}/verify`)
      .set('Authorization', `Bearer ${makeAccessToken(student)}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.verified).toBe(true);

    const updatedAnswer = await ForumAnswer.findById(answer._id).lean();
    expect(updatedAnswer?.isVerifiedSolution).toBe(true);

    const updatedPost = await ForumPost.findById(post._id).lean();
    expect(updatedPost?.solved).toBe(true);

    const score = await MentorScore.findOne({ mentorId: mentor._id }).lean();
    expect(score?.phase3Breakdown.forum).toBe(15);
    expect(score?.totalScore).toBe(15);
  });

  it('blocks a second verified solution on the same post', async () => {
    const [student, mentor] = await Promise.all([
      createUser(UserRole.STUDENT, 'forum-student2@example.com', 'Forum Student 2'),
      createUser(UserRole.MENTOR, 'forum-mentor2@example.com', 'Forum Mentor 2'),
    ]);

    const post = await ForumPost.create({
      authorId: student._id,
      authorRole: UserRole.STUDENT,
      title: 'Relay question 2',
      body: 'Another relay question',
      tags: ['iot'],
    });

    const [answerA, answerB] = await Promise.all([
      ForumAnswer.create({
        postId: post._id,
        authorId: mentor._id,
        authorRole: UserRole.MENTOR,
        body: 'Answer A',
      }),
      ForumAnswer.create({
        postId: post._id,
        authorId: mentor._id,
        authorRole: UserRole.MENTOR,
        body: 'Answer B',
      }),
    ]);

    const first = await request(app)
      .patch(`/api/forum/answers/${answerA._id}/verify`)
      .set('Authorization', `Bearer ${makeAccessToken(student)}`)
      .send({});
    expect(first.status).toBe(200);

    const second = await request(app)
      .patch(`/api/forum/answers/${answerB._id}/verify`)
      .set('Authorization', `Bearer ${makeAccessToken(student)}`)
      .send({});
    expect(second.status).toBe(400);
    expect(second.body.error?.code).toBe('POST_ALREADY_SOLVED');

    const score = await MentorScore.findOne({ mentorId: mentor._id }).lean();
    expect(score?.phase3Breakdown.forum).toBe(15);
  });

  it('rejects a non-author user and self-verification', async () => {
    const [student, otherStudent, mentor] = await Promise.all([
      createUser(UserRole.STUDENT, 'forum-student3@example.com', 'Forum Student 3'),
      createUser(UserRole.STUDENT, 'forum-student4@example.com', 'Forum Student 4'),
      createUser(UserRole.MENTOR, 'forum-mentor3@example.com', 'Forum Mentor 3'),
    ]);

    const post = await ForumPost.create({
      authorId: student._id,
      authorRole: UserRole.STUDENT,
      title: 'Relay question 3',
      body: 'Another relay question',
      tags: ['iot'],
    });

    const answer = await ForumAnswer.create({
      postId: post._id,
      authorId: mentor._id,
      authorRole: UserRole.MENTOR,
      body: 'Answer from mentor',
    });

    // Non-author cannot verify
    const forbidden = await request(app)
      .patch(`/api/forum/answers/${answer._id}/verify`)
      .set('Authorization', `Bearer ${makeAccessToken(otherStudent)}`)
      .send({});
    expect(forbidden.status).toBe(403);

    // Author cannot verify their own answer
    const ownPost = await ForumPost.create({
      authorId: student._id,
      authorRole: UserRole.STUDENT,
      title: 'My own question',
      body: 'Question I asked myself',
      tags: [],
    });
    const ownAnswer = await ForumAnswer.create({
      postId: ownPost._id,
      authorId: student._id,
      authorRole: UserRole.STUDENT,
      body: 'My own answer',
    });
    const selfVerify = await request(app)
      .patch(`/api/forum/answers/${ownAnswer._id}/verify`)
      .set('Authorization', `Bearer ${makeAccessToken(student)}`)
      .send({});
    expect(selfVerify.status).toBe(400);
    expect(selfVerify.body.error?.code).toBe('CANNOT_VERIFY_OWN');
  });

  it('still allows admins to verify', async () => {
    const [student, mentor, admin] = await Promise.all([
      createUser(UserRole.STUDENT, 'forum-student5@example.com', 'Forum Student 5'),
      createUser(UserRole.MENTOR, 'forum-mentor5@example.com', 'Forum Mentor 5'),
      createUser(UserRole.ADMIN, 'forum-admin@example.com', 'Forum Admin'),
    ]);

    const post = await ForumPost.create({
      authorId: student._id,
      authorRole: UserRole.STUDENT,
      title: 'Relay question 5',
      body: 'Another relay question',
      tags: ['iot'],
    });

    const answer = await ForumAnswer.create({
      postId: post._id,
      authorId: mentor._id,
      authorRole: UserRole.MENTOR,
      body: 'Best relay answer',
    });

    const res = await request(app)
      .patch(`/api/forum/answers/${answer._id}/verify`)
      .set('Authorization', `Bearer ${makeAccessToken(admin)}`)
      .send({});
    expect(res.status).toBe(200);

    const score = await MentorScore.findOne({ mentorId: mentor._id }).lean();
    expect(score?.phase3Breakdown.forum).toBe(15);
  });
});
