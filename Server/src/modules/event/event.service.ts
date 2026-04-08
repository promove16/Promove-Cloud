import { z } from 'zod';
import { redis } from '../../config/redis';
import { io } from '../../config/socket';
import { ApiError } from '../../utils/ApiError';
import { User } from '../user/user.model';
import { Event } from './event.model';
import { EventParticipantView, EventRankingView } from './event.types';
import { UserRole } from '../../types/roles.types';

export const createEventSchema = z.object({
  title: z.string().trim().min(2).max(160),
  type: z.enum([
    'Industry Connect Session',
    'Placement Hackathon',
    'Innovation Drive',
    'Other',
  ]),
  date: z.string().datetime(),
  description: z.string().trim().min(10).max(2000),
  targetRoles: z.array(z.enum(['student', 'all'])).optional(),
});

export const eventSubmissionSchema = z.object({
  score: z.number().min(0).max(100),
});

const eventTenantFilter = (eventId: string, institutionId?: string | null) => ({
  _id: eventId,
  ...(institutionId ? { institutionId } : {}),
});

export const createEvent = async (
  institutionId: string,
  createdBy: string,
  payload: z.infer<typeof createEventSchema>,
) => {
  const event = await Event.create({
    institutionId,
    createdBy,
    title: payload.title,
    type: payload.type,
    description: payload.description,
    scheduledAt: new Date(payload.date),
    isActive: true,
    participants: [],
    rankings: [],
  });

  return {
    _id: String(event._id),
    title: event.title,
    type: event.type,
    description: event.description,
    scheduledAt: event.scheduledAt.toISOString(),
    participantsCount: 0,
    participants: [] as EventParticipantView[],
    rankingsComputedAt: undefined,
  };
};

const buildParticipantViewMap = async (
  events: Array<{
    _id: { toString(): string };
    participants: Array<{
      studentId: { toString(): string };
      joinedAt: Date;
      submissionScore?: number;
    }>;
  }>,
) => {
  const studentIds = [...new Set(events.flatMap((event) => event.participants.map((participant) => String(participant.studentId))))];

  const students =
    studentIds.length > 0
      ? await User.find({ _id: { $in: studentIds } })
          .select('_id displayName avatar innovationScore')
          .lean()
      : [];

  const studentMap = new Map(students.map((student) => [String(student._id), student]));

  return new Map(
    events.map((event) => [
      String(event._id),
      event.participants.map((participant) => {
        const student = studentMap.get(String(participant.studentId));

        return {
          studentId: String(participant.studentId),
          studentName: student?.displayName ?? 'Student',
          ...(student?.avatar ? { avatar: student.avatar } : {}),
          innovationScore: student?.innovationScore ?? 0,
          registeredAt: participant.joinedAt.toISOString(),
          ...(typeof participant.submissionScore === 'number'
            ? { submissionScore: participant.submissionScore }
            : {}),
        } satisfies EventParticipantView;
      }),
    ]),
  );
};

export const listInstitutionEvents = async (institutionId: string) => {
  const events = await Event.find({ institutionId }).sort({ scheduledAt: -1 }).lean();
  const participantMap = await buildParticipantViewMap(events);

  return events.map((event) => ({
    _id: String(event._id),
    title: event.title,
    type: event.type,
    description: event.description,
    scheduledAt: event.scheduledAt.toISOString(),
    participantsCount: event.participants.length,
    participants: participantMap.get(String(event._id)) ?? [],
    ...(event.rankingsComputedAt
      ? { rankingsComputedAt: event.rankingsComputedAt.toISOString() }
      : {}),
  }));
};

export const joinEvent = async (
  eventId: string,
  studentId: string,
  institutionId?: string | null,
): Promise<void> => {
  const [event, student] = await Promise.all([
    Event.findOne(eventTenantFilter(eventId, institutionId)),
    User.findById(studentId).select('_id institutionId role').lean(),
  ]);

  if (!event) {
    throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }

  if (!student || student.role !== UserRole.STUDENT) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }

  if (String(student.institutionId) !== String(event.institutionId)) {
    throw new ApiError(403, 'FORBIDDEN', 'Student cannot join an event outside their institution');
  }

  const alreadyJoined = event.participants.some(
    (participant) => String(participant.studentId) === studentId,
  );

  if (!alreadyJoined) {
    event.participants.push({
      studentId: student._id,
      joinedAt: new Date(),
    });
    await event.save();
  }
};

export const addSubmissionScore = async (
  eventId: string,
  studentId: string,
  score: number,
  institutionId?: string | null,
): Promise<void> => {
  const event = await Event.findOne(eventTenantFilter(eventId, institutionId));

  if (!event) {
    throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }

  const participant = event.participants.find(
    (item) => String(item.studentId) === studentId,
  );

  if (!participant) {
    throw new ApiError(404, 'PARTICIPANT_NOT_FOUND', 'Student is not part of this event');
  }

  participant.submissionScore = score;
  await event.save();
};

export const computeEventRankings = async (
  eventId: string,
  institutionId?: string | null,
): Promise<void> => {
  const event = await Event.findOne(eventTenantFilter(eventId, institutionId));

  if (!event) {
    throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }

  const participantIds = event.participants.map((participant) => participant.studentId);
  const users =
    participantIds.length > 0
      ? await User.find({
          _id: { $in: participantIds },
          institutionId: event.institutionId,
          role: UserRole.STUDENT,
        })
          .select('_id innovationScore')
          .lean()
      : [];
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  const rankings = event.participants
    .map((participant) => {
      const user = userMap.get(String(participant.studentId));
      const innovationScore = user?.innovationScore ?? 0;
      const submissionScore = participant.submissionScore ?? 0;
      const compositeScore = Number(
        ((submissionScore * 0.6) + (innovationScore * 0.4)).toFixed(2),
      );

      return {
        studentId: participant.studentId,
        innovationScore,
        submissionScore,
        compositeScore,
      };
    })
    .sort((left, right) => {
      if (right.compositeScore !== left.compositeScore) {
        return right.compositeScore - left.compositeScore;
      }

      return right.innovationScore - left.innovationScore;
    })
    .map((ranking, index) => ({
      rank: index + 1,
      ...ranking,
    }));

  event.rankings = rankings;
  event.rankingsComputedAt = new Date();
  event.isActive = event.scheduledAt > new Date();
  await event.save();

  const rankingKey = `event:rankings:${eventId}`;
  await redis.del(rankingKey);
  if (rankings.length > 0) {
    const [firstRanking, ...remainingRankings] = rankings.map((ranking) => ({
      member: String(ranking.studentId),
      score: ranking.compositeScore,
    }));
    await redis.zadd(rankingKey, firstRanking, ...remainingRankings);
    await redis.expire(rankingKey, 60 * 60 * 24);
  }

  if (io) {
    io.of('/score').to(`college:${String(event.institutionId)}`).emit('event:rankings-computed', {
      eventId,
      institutionId: String(event.institutionId),
      formula: '(submissionScore * 0.6) + (innovationScore * 0.4)',
      computedAt: event.rankingsComputedAt.toISOString(),
    });
  }
};

export const getEventRankings = async (
  eventId: string,
  institutionId?: string | null,
): Promise<EventRankingView[]> => {
  const event = await Event.findOne(eventTenantFilter(eventId, institutionId)).lean();

  if (!event) {
    throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }

  if (event.rankings.length === 0) {
    return [];
  }

  const students = await User.find({
    _id: { $in: event.rankings.map((ranking) => ranking.studentId) },
    institutionId: event.institutionId,
    role: UserRole.STUDENT,
  })
    .select('_id displayName avatar')
    .lean();
  const studentMap = new Map(students.map((student) => [String(student._id), student]));

  return event.rankings.map((ranking) => {
    const student = studentMap.get(String(ranking.studentId));
    return {
      rank: ranking.rank,
      studentId: String(ranking.studentId),
      studentName: student?.displayName ?? 'Student',
      ...(student?.avatar ? { avatar: student.avatar } : {}),
      compositeScore: ranking.compositeScore,
      innovationScore: ranking.innovationScore,
      submissionScore: ranking.submissionScore,
    };
  });
};
