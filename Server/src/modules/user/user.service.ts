import { z } from 'zod';
import { User } from './user.model';
import { IUser, LaunchToRecruitersResult, SanitizedUser, StudentMentorSessionView } from './user.types';
import { ApiError } from '../../utils/ApiError';
import { MentorSession } from '../mentor/mentorSession.model';
import { UserRole } from '../../types/roles.types';
import { RelevanceBridge } from '../recruiter/relevanceBridge.model';
import { PlacementRecord } from '../college/placementRecord.model';
import { NotificationService } from '../notification/notification.service';
import { io } from '../../config/socket';
import { getStudentCollegeId } from '../recruiter/recruiter.mappers';

export const updateMeSchema = z
  .object({
    displayName: z.string().trim().min(2).max(100).optional(),
    avatar: z.string().trim().url().optional().or(z.literal('')),
    bio: z.string().trim().max(500).optional().or(z.literal('')),
    domain: z.string().trim().max(120).optional().or(z.literal('')),
    profileComplete: z.boolean().optional(),
    discoverableToRecruiters: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

type UserLike = Omit<IUser, '_id' | 'institutionId'> & {
  _id: { toString(): string };
  institutionId?: { toString(): string };
};

export const toSanitizedUser = (user: UserLike): SanitizedUser => ({
  _id: user._id.toString(),
  email: user.email,
  role: user.role,
  displayName: user.displayName,
  ...(user.avatar ? { avatar: user.avatar } : {}),
  ...(user.bio ? { bio: user.bio } : {}),
  ...(user.domain ? { domain: user.domain } : {}),
  profileComplete: user.profileComplete,
  innovationScore: user.innovationScore,
  scoreBreakdown: user.scoreBreakdown,
  accessGrantedBy: user.accessGrantedBy,
  accessExpiresAt: user.accessExpiresAt,
  isActive: user.isActive,
  ...(user.lastLogin ? { lastLogin: user.lastLogin } : {}),
  discoverableToRecruiters: user.discoverableToRecruiters ?? false,
  ...(user.institutionId ? { institutionId: user.institutionId.toString() } : {}),
  ...(user.institutionProfile ? { institutionProfile: user.institutionProfile } : {}),
  verificationStatus: user.verificationStatus,
  ...(user.verificationRequestedAt ? { verificationRequestedAt: user.verificationRequestedAt } : {}),
  ...(user.verifiedAt ? { verifiedAt: user.verifiedAt } : {}),
  ...(user.verificationRejectedAt ? { verificationRejectedAt: user.verificationRejectedAt } : {}),
  ...(user.verificationRejectedReason
    ? { verificationRejectedReason: user.verificationRejectedReason }
    : {}),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const getCurrentUser = async (userId: string) => {
  const user = await User.findById(userId).lean();

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  return toSanitizedUser(user as UserLike);
};

export const getCurrentUserMentorSessions = async (
  studentId: string,
): Promise<StudentMentorSessionView[]> => {
  const sessions = await MentorSession.find({ studentId }).sort({ scheduledAt: 1 }).lean();
  const mentorIds = sessions.map((session) => session.mentorId);
  const mentors =
    mentorIds.length > 0
      ? await User.find({ _id: { $in: mentorIds } }).select('_id displayName avatar').lean()
      : [];

  const mentorMap = new Map(mentors.map((mentor) => [String(mentor._id), mentor]));

  return sessions.map((session) => {
    const mentor = mentorMap.get(String(session.mentorId));

    return {
      _id: String(session._id),
      mentor: {
        _id: String(session.mentorId),
        displayName: mentor?.displayName ?? 'Mentor',
        ...(mentor?.avatar ? { avatar: mentor.avatar } : {}),
      },
      ...(session.workspaceId ? { workspaceId: String(session.workspaceId) } : {}),
      title: session.title,
      scheduledAt: session.scheduledAt,
      durationMinutes: session.durationMinutes,
      ...(session.meetLink ? { meetLink: session.meetLink } : {}),
      status: session.status,
      ...(session.mentorNotes ? { mentorNotes: session.mentorNotes } : {}),
      ...(session.studentFeedback ? { studentFeedback: session.studentFeedback } : {}),
      createdAt: session.createdAt,
    };
  });
};

export const launchCurrentUserToRecruiters = async (studentId: string): Promise<LaunchToRecruitersResult> => {
  const student = await User.findById(studentId).select('_id role institutionId innovationScore displayName').lean();

  if (!student || student.role !== UserRole.STUDENT) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }

  const recruiters = await User.find({ role: UserRole.RECRUITER, isActive: true })
    .select('_id')
    .lean();
  const collegeId = await getStudentCollegeId(studentId);

  await Promise.all(
    recruiters.map((recruiter) =>
      RelevanceBridge.updateOne(
        {
          studentId,
          recruiterId: recruiter._id,
        },
        {
          studentId,
          recruiterId: recruiter._id,
          bridgeType: 'LAUNCH_TRIGGER',
          isActive: true,
        },
        {
          upsert: true,
        },
      ),
    ),
  );

  if (collegeId) {
    await Promise.all(
      recruiters.map((recruiter) =>
        PlacementRecord.findOneAndUpdate(
          {
            studentId,
            recruiterId: recruiter._id,
            collegeId,
          },
          {
            studentId,
            recruiterId: recruiter._id,
            collegeId,
            status: 'Discovered',
            innovationScoreAtTime: student.innovationScore ?? 0,
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          },
        ),
      ),
    );
  }

  const notification = await NotificationService.create({
    userId: studentId,
    type: 'system',
    title: 'Your profile is now visible to all active recruiters',
    body: 'Your profile is now visible to all active recruiters.',
    link: '/dashboard/student/profile',
  });

  if (io) {
    io.of('/notifications').to(`user:${studentId}`).emit('notification:new', notification);
  }

  return {
    bridgesCreated: recruiters.length,
  };
};

export const updateCurrentUser = async (
  userId: string,
  payload: z.infer<typeof updateMeSchema>,
) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  if (payload.displayName !== undefined) {
    user.displayName = payload.displayName;
  }

  if (payload.avatar !== undefined) {
    user.avatar = payload.avatar || undefined;
  }

  if (payload.bio !== undefined) {
    user.bio = payload.bio || undefined;
  }

  if (payload.domain !== undefined) {
    user.domain = payload.domain || undefined;
  }

  if (payload.profileComplete !== undefined) {
    user.profileComplete = payload.profileComplete;
  }

  if (payload.discoverableToRecruiters !== undefined) {
    user.discoverableToRecruiters = payload.discoverableToRecruiters;
  }

  await user.save();

  return toSanitizedUser(user.toObject() as UserLike);
};
