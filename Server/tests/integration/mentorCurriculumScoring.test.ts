import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
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
    registrationStage: 'complete',
    accessGrantedBy: 'admin',
    accessExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isActive: true,
    verificationStatus: 'not_required',
    adminApprovalStatus: 'approved',
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

describe('Mentor curriculum mapping scoring', () => {
  it('awards 20 points for the PDF and 20 flat points per class photo, capped at 40 total', async () => {
    const [mentor, admin] = await Promise.all([
      createUser(UserRole.MENTOR, 'curriculum-mentor@example.com', 'Curriculum Mentor'),
      createUser(UserRole.ADMIN, 'curriculum-admin@example.com', 'Curriculum Admin'),
    ]);
    const mentorToken = makeAccessToken(mentor);
    const adminToken = makeAccessToken(admin);

    const curriculumResponse = await request(app)
      .post('/api/mentor-score/submit/curriculum')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({
        pdfUrl: 'https://example.com/curriculum.pdf',
        plannedClassesCount: 6,
        academicYear: '2025-2026',
      });

    expect(curriculumResponse.status).toBe(201);
    expect(curriculumResponse.body.data.pointsToAward).toBe(20);
    const curriculumTaskId = curriculumResponse.body.data._id as string;

    const curriculumApproval = await request(app)
      .post(`/api/admin/mentor-score/verifications/${curriculumTaskId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(curriculumApproval.status).toBe(200);
    expect(curriculumApproval.body.data.pointsAwarded).toBe(20);

    const classPointAwards: number[] = [];
    for (let classIndex = 1; classIndex <= 6; classIndex += 1) {
      const classResponse = await request(app)
        .post('/api/mentor-score/submit/class-photo')
        .set('Authorization', `Bearer ${mentorToken}`)
        .send({
          photoUrls: [`https://example.com/class-${classIndex}.jpg`],
          curriculumTaskId,
          classIndex,
          classDate: '2026-08-01',
          topic: `Class ${classIndex}`,
        });

      expect(classResponse.status).toBe(201);
      const taskId = classResponse.body.data._id as string;
      const approvalResponse = await request(app)
        .post(`/api/admin/mentor-score/verifications/${taskId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(approvalResponse.status).toBe(200);
      classPointAwards.push(approvalResponse.body.data.pointsAwarded as number);
    }

    // Each class photo awards flat 20 pts, but cap is 40 total.
    // Curriculum (20) + class 1 (20) = 40. Classes 2-6 get capped at 0.
    expect(classPointAwards).toEqual([20, 0, 0, 0, 0, 0]);

    const score = await MentorScore.findOne({ mentorId: mentor._id }).lean();
    expect(score?.phase1Breakdown.curriculumMapping).toBe(40);
    expect(score?.phase1Score).toBe(40);
    expect(score?.totalScore).toBe(40);
  });

  it('rejects class evidence outside the planned class range', async () => {
    const [mentor, admin] = await Promise.all([
      createUser(UserRole.MENTOR, 'class-range-mentor@example.com', 'Class Range Mentor'),
      createUser(UserRole.ADMIN, 'class-range-admin@example.com', 'Class Range Admin'),
    ]);
    const mentorToken = makeAccessToken(mentor);
    const adminToken = makeAccessToken(admin);

    const curriculumResponse = await request(app)
      .post('/api/mentor-score/submit/curriculum')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({
        pdfUrl: 'https://example.com/range-curriculum.pdf',
        plannedClassesCount: 2,
        academicYear: '2025-2026',
      });
    const curriculumTaskId = curriculumResponse.body.data._id as string;

    await request(app)
      .post(`/api/admin/mentor-score/verifications/${curriculumTaskId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    const response = await request(app)
      .post('/api/mentor-score/submit/class-photo')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({
        photoUrls: ['https://example.com/out-of-range.jpg'],
        curriculumTaskId,
        classIndex: 3,
        classDate: '2026-08-01',
        topic: 'Unexpected class',
      });

    expect(response.status).toBe(400);
    expect(response.body.error?.code ?? response.body.code).toBe('INVALID_CLASS_INDEX');
  });
});
