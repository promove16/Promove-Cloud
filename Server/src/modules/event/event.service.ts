import { z } from 'zod';
import { redis } from '../../config/redis';
import { io } from '../../config/socket';
import { ApiError } from '../../utils/ApiError';
import { User } from '../user/user.model';
import { Event } from './event.model';
import { EventParticipantView, EventRankingView } from './event.types';
import { UserRole } from '../../types/roles.types';
import { JobPost } from '../recruiter/jobPost.model';
import { createBridge, notifyUser } from '../recruiter/recruiter.mappers';
import { createRequestRecord, registerRequestHandler } from '../request/request.service';

const HIRING_EVENT_TYPES = [
  'Industry Connect Session',
  'Placement Hackathon',
  'Innovation Drive',
  'Placement Drive',
  'Internship Drive',
  'Hackathon',
  'Other',
] as const;

const EVENT_NOTIFICATION_BATCH_SIZE = 50;

const notifyUsersInBatches = async (userIds: string[], title: string, body: string, link: string) => {
  for (let index = 0; index < userIds.length; index += EVENT_NOTIFICATION_BATCH_SIZE) {
    const batch = userIds.slice(index, index + EVENT_NOTIFICATION_BATCH_SIZE);
    await Promise.allSettled(batch.map((userId) => notifyUser(userId, title, body, link)));
  }
};

export const createEventSchema = z.object({
  title: z.string().trim().min(2).max(160),
  type: z.enum(['Industry Connect Session', 'Placement Hackathon', 'Innovation Drive', 'Other']),
  date: z
    .string()
    .datetime()
    .refine(
      (val) => {
        return new Date(val).getTime() >= Date.now() - 1000 * 60 * 5;
      },
      { message: 'Event date cannot be in the past' },
    ),
  description: z.string().trim().min(10).max(2000),
  targetRoles: z.array(z.enum(['student', 'all'])).optional(),
});

export const eventSubmissionSchema = z.object({
  score: z.number().min(0).max(100),
});

export const selectStudentFromEventSchema = z.object({
  jobId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid job ID'),
  note: z.string().trim().min(2).max(500).optional(),
});

export const sendHiringEventInviteSchema = z.object({
  title: z.string().trim().min(2).max(160),
  type: z.enum(HIRING_EVENT_TYPES),
  date: z
    .string()
    .datetime()
    .refine(
      (val) => {
        return new Date(val).getTime() >= Date.now() - 1000 * 60 * 5;
      },
      { message: 'Event date cannot be in the past' },
    ),
  description: z.string().trim().min(10).max(2000),
  linkedJobId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  minimumInnovationScore: z.coerce.number().min(0).default(0),
  message: z.string().trim().max(500).optional(),
});

const collegeEventInviteMetadataSchema = z.object({
  title: z.string().trim().min(2).max(160),
  type: z.enum(HIRING_EVENT_TYPES),
  date: z.string().datetime(),
  description: z.string().trim().min(10).max(2000),
  linkedJobId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  minimumInnovationScore: z.coerce.number().min(0).default(0),
});

const eventTenantFilter = (eventId: string, institutionId?: string | null) => ({
  _id: eventId,
  ...(institutionId ? { institutionId } : {}),
});

type EventManagementActor = {
  actorId: string;
  role: UserRole;
  institutionId?: string | null;
};

const findManagedEvent = async (eventId: string, actor?: EventManagementActor) => {
  if (!actor) {
    return Event.findOne({ _id: eventId });
  }

  if (actor.role === UserRole.RECRUITER) {
    return Event.findOne({
      _id: eventId,
      recruiterId: actor.actorId,
      category: 'hiring',
    });
  }

  if (actor.role === UserRole.COLLEGE || actor.role === UserRole.SCHOOL) {
    return Event.findOne({
      _id: eventId,
      institutionId: actor.institutionId ?? actor.actorId,
    });
  }

  return Event.findOne(eventTenantFilter(eventId, actor.institutionId));
};

export const createEvent = async (institutionId: string, createdBy: string, payload: z.infer<typeof createEventSchema>) => {
  const event = await Event.create({
    institutionId,
    createdBy,
    title: payload.title,
    type: payload.type,
    category: 'internal',
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
      selectedJobId?: { toString(): string };
      selectedAt?: Date;
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

  const selectedJobIds = [
    ...new Set(
      events.flatMap((event) =>
        event.participants.filter((participant) => participant.selectedJobId).map((participant) => String(participant.selectedJobId)),
      ),
    ),
  ];

  const selectedJobs =
    selectedJobIds.length > 0
      ? await JobPost.find({ _id: { $in: selectedJobIds } })
          .select('_id title')
          .lean()
      : [];

  const selectedJobMap = new Map(selectedJobs.map((job) => [String(job._id), job.title]));

  return new Map(
    events.map((event) => [
      String(event._id),
      event.participants.map((participant) => {
        const student = studentMap.get(String(participant.studentId));
        const selectedJobTitle = participant.selectedJobId ? selectedJobMap.get(String(participant.selectedJobId)) : undefined;

        return {
          studentId: String(participant.studentId),
          studentName: student?.displayName ?? 'Student',
          ...(student?.avatar ? { avatar: student.avatar } : {}),
          innovationScore: student?.innovationScore ?? 0,
          registeredAt: participant.joinedAt.toISOString(),
          ...(typeof participant.submissionScore === 'number' ? { submissionScore: participant.submissionScore } : {}),
          ...(participant.selectedJobId ? { selectedJobId: String(participant.selectedJobId) } : {}),
          ...(selectedJobTitle ? { selectedJobTitle } : {}),
          ...(participant.selectedAt ? { selectedAt: participant.selectedAt.toISOString() } : {}),
        } satisfies EventParticipantView;
      }),
    ]),
  );
};

export const listInstitutionEvents = async (institutionId: string) => {
  const events = await Event.find({ institutionId }).sort({ scheduledAt: -1 }).lean();
  const participantMap = await buildParticipantViewMap(events);

  const recruiterIds = [...new Set(events.filter((event) => event.category === 'hiring' && event.recruiterId).map((event) => String(event.recruiterId)))];
  const recruiters =
    recruiterIds.length > 0
      ? await User.find({ _id: { $in: recruiterIds } })
          .select('_id displayName domain')
          .lean()
      : [];
  const recruiterMap = new Map(recruiters.map((r) => [String(r._id), r]));

  const jobIds = [...new Set(events.filter((event) => event.linkedJobId).map((event) => String(event.linkedJobId)))];
  const jobs =
    jobIds.length > 0
      ? await JobPost.find({ _id: { $in: jobIds } })
          .select('_id title company')
          .lean()
      : [];
  const jobMap = new Map(jobs.map((j) => [String(j._id), j]));

  return events.map((event) => {
    const job = event.linkedJobId ? jobMap.get(String(event.linkedJobId)) : null;
    const recruiter = event.recruiterId ? recruiterMap.get(String(event.recruiterId)) : null;
    return {
      _id: String(event._id),
      title: event.title,
      type: event.type,
      category: event.category ?? 'internal',
      description: event.description,
      scheduledAt: event.scheduledAt.toISOString(),
      isActive: event.isActive,
      participantsCount: event.participants.length,
      participants: participantMap.get(String(event._id)) ?? [],
      ...(event.rankingsComputedAt ? { rankingsComputedAt: event.rankingsComputedAt.toISOString() } : {}),
      ...(event.recruiterId
        ? {
            recruiterId: String(event.recruiterId),
            recruiterName: recruiter?.displayName ?? 'Recruiter',
            recruiterCompany: recruiter?.domain ? `${recruiter.domain} Hiring` : undefined,
          }
        : {}),
      ...(event.linkedJobId ? { linkedJobId: String(event.linkedJobId) } : {}),
      ...(job ? { jobTitle: job.title, companyName: job.company } : {}),
      ...(typeof event.minimumInnovationScore === 'number' ? { minimumInnovationScore: event.minimumInnovationScore } : {}),
    };
  });
};

export const joinEvent = async (eventId: string, studentId: string, institutionId?: string | null): Promise<void> => {
  const [event, student] = await Promise.all([
    Event.findOne(eventTenantFilter(eventId, institutionId)),
    User.findById(studentId).select('_id institutionId role innovationScore').lean(),
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

  if (event.isActive === false || event.rankingsComputedAt) {
    throw new ApiError(409, 'EVENT_REGISTRATION_CLOSED', 'Registration is closed for this event');
  }

  if (
    event.category === 'hiring' &&
    typeof event.minimumInnovationScore === 'number' &&
    event.minimumInnovationScore > 0 &&
    (student.innovationScore ?? 0) < event.minimumInnovationScore
  ) {
    throw new ApiError(403, 'SCORE_TOO_LOW', 'Your innovation score does not meet the minimum requirement for this event');
  }

  const alreadyJoined = event.participants.some((participant) => String(participant.studentId) === studentId);

  if (!alreadyJoined) {
    event.participants.push({
      studentId: student._id,
      joinedAt: new Date(),
    });
    await event.save();
  }
};

export const addSubmissionScore = async (eventId: string, studentId: string, score: number, actor?: EventManagementActor): Promise<void> => {
  const event = await findManagedEvent(eventId, actor);

  if (!event) {
    throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }

  if (event.rankingsComputedAt) {
    throw new ApiError(409, 'EVENT_RANKINGS_FINALIZED', 'Submission scores cannot be changed after rankings are computed');
  }

  const participant = event.participants.find((item) => String(item.studentId) === studentId);

  if (!participant) {
    throw new ApiError(404, 'PARTICIPANT_NOT_FOUND', 'Student is not part of this event');
  }

  participant.submissionScore = score;
  await event.save();
};

export const computeEventRankings = async (eventId: string, actor?: EventManagementActor): Promise<void> => {
  const event = await findManagedEvent(eventId, actor);

  if (!event) {
    throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }

  if (event.rankingsComputedAt) {
    throw new ApiError(409, 'EVENT_RANKINGS_FINALIZED', 'Rankings have already been computed for this event');
  }

  if (event.category === 'hiring' && event.participants.length === 0) {
    throw new ApiError(409, 'EVENT_HAS_NO_PARTICIPANTS', 'At least one registered participant is required before rankings can be computed');
  }

  const unscoredParticipantCount = event.participants.filter((participant) => typeof participant.submissionScore !== 'number').length;
  if (event.category === 'hiring' && unscoredParticipantCount > 0) {
    throw new ApiError(
      409,
      'EVENT_SCORES_INCOMPLETE',
      `Score all registered participants before computing rankings. ${unscoredParticipantCount} participant${unscoredParticipantCount === 1 ? '' : 's'} still need${unscoredParticipantCount === 1 ? 's' : ''} a score.`,
    );
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
      const compositeScore = Number((submissionScore * 0.6 + innovationScore * 0.4).toFixed(2));

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
    io.of('/score')
      .to(`college:${String(event.institutionId)}`)
      .emit('event:rankings-computed', {
        eventId,
        institutionId: String(event.institutionId),
        formula: '(submissionScore * 0.6) + (innovationScore * 0.4)',
        computedAt: event.rankingsComputedAt.toISOString(),
      });
  }
};

export const getEventRankings = async (eventId: string, institutionId?: string | null): Promise<EventRankingView[]> => {
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

export const getManagedEventRankings = async (eventId: string, actor: EventManagementActor): Promise<EventRankingView[]> => {
  const event = await findManagedEvent(eventId, actor);

  if (!event) {
    throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }

  return getEventRankings(eventId, String(event.institutionId));
};

export const sendHiringEventInvite = async (recruiterId: string, collegeId: string, payload: z.infer<typeof sendHiringEventInviteSchema>) => {
  const college = await User.findOne({ _id: collegeId, role: UserRole.COLLEGE, isActive: true }).select('_id displayName').lean();

  if (!college) {
    throw new ApiError(404, 'COLLEGE_NOT_FOUND', 'College not found');
  }

  const recruiter = await User.findById(recruiterId).select('displayName').lean();
  const recruiterName = recruiter?.displayName ?? 'A recruiter';

  const { message, ...eventMetadata } = payload;
  const body = message?.trim() || `${recruiterName} is requesting to host "${payload.title}" at ${college.displayName}.`;

  await createRequestRecord({
    type: 'college_event_invite',
    actionType: 'assign',
    fromUserId: recruiterId,
    toUserId: String(college._id),
    targetEntityType: 'college',
    targetEntityId: String(college._id),
    targetEntityTitle: college.displayName,
    targetRole: UserRole.COLLEGE,
    requestedRole: 'host',
    message: body,
    metadata: eventMetadata,
    deepLink: '/dashboard/college/events?tab=hiring',
    acceptRedirect: '/dashboard/college/events?tab=hiring',
    declineRedirect: '/dashboard/college/events?tab=hiring',
  });

  return { sent: true };
};

export const listRecruiterHiringEvents = async (recruiterId: string) => {
  const events = await Event.find({ recruiterId, category: 'hiring' }).sort({ scheduledAt: -1 }).lean();

  const collegeIds = [...new Set(events.map((event) => String(event.institutionId)))];
  const colleges =
    collegeIds.length > 0
      ? await User.find({ _id: { $in: collegeIds } })
          .select('_id displayName')
          .lean()
      : [];
  const collegeMap = new Map(colleges.map((c) => [String(c._id), c.displayName]));

  const participantMap = await buildParticipantViewMap(events);
  const rankingsAll = await Promise.all(
    events.map(async (event) => ({
      eventId: String(event._id),
      rankings: await getEventRankings(String(event._id)),
    })),
  );
  const rankingMap = new Map(rankingsAll.map((entry) => [entry.eventId, entry.rankings]));

  const jobIds = [...new Set(events.filter((event) => event.linkedJobId).map((event) => String(event.linkedJobId)))];
  const jobs =
    jobIds.length > 0
      ? await JobPost.find({ _id: { $in: jobIds } })
          .select('_id title company')
          .lean()
      : [];
  const jobMap = new Map(jobs.map((j) => [String(j._id), j]));

  return events.map((event) => {
    const job = event.linkedJobId ? jobMap.get(String(event.linkedJobId)) : null;
    return {
      _id: String(event._id),
      title: event.title,
      type: event.type,
      category: 'hiring' as const,
      description: event.description,
      scheduledAt: event.scheduledAt.toISOString(),
      isActive: event.isActive,
      institutionId: String(event.institutionId),
      collegeName: collegeMap.get(String(event.institutionId)) ?? 'College',
      recruiterId: String(event.recruiterId),
      ...(event.linkedJobId ? { linkedJobId: String(event.linkedJobId) } : {}),
      ...(job ? { jobTitle: job.title, companyName: job.company } : {}),
      minimumInnovationScore: event.minimumInnovationScore ?? 0,
      participantsCount: event.participants.length,
      participants: participantMap.get(String(event._id)) ?? [],
      ...(event.rankingsComputedAt ? { rankingsComputedAt: event.rankingsComputedAt.toISOString() } : {}),
      rankings: rankingMap.get(String(event._id)) ?? [],
    };
  });
};

export const listStudentInstitutionEvents = async (institutionId: string) => {
  const events = await listInstitutionEvents(institutionId);
  const rankingsAll = await Promise.all(
    events.map(async (event) => ({
      eventId: event._id,
      rankings: await getEventRankings(event._id, institutionId),
    })),
  );
  const rankingMap = new Map(rankingsAll.map((entry) => [entry.eventId, entry.rankings]));

  return events.map((event) => ({
    ...event,
    rankings: rankingMap.get(event._id) ?? [],
  }));
};

export const listCollegeHiringEvents = async (collegeId: string) => {
  const events = await Event.find({ institutionId: collegeId, category: 'hiring' }).sort({ scheduledAt: -1 }).lean();

  const recruiterIds = [...new Set(events.filter((e) => e.recruiterId).map((e) => String(e.recruiterId)))];
  const recruiters =
    recruiterIds.length > 0
      ? await User.find({ _id: { $in: recruiterIds } })
          .select('_id displayName domain')
          .lean()
      : [];
  const recruiterMap = new Map(recruiters.map((r) => [String(r._id), r]));

  const participantMap = await buildParticipantViewMap(events);

  const rankingsAll = await Promise.all(
    events.map(async (event) => ({
      eventId: String(event._id),
      rankings: await getEventRankings(String(event._id), collegeId),
    })),
  );
  const rankingMap = new Map(rankingsAll.map((entry) => [entry.eventId, entry.rankings]));

  const jobIds = [...new Set(events.filter((event) => event.linkedJobId).map((event) => String(event.linkedJobId)))];
  const jobs =
    jobIds.length > 0
      ? await JobPost.find({ _id: { $in: jobIds } })
          .select('_id title company')
          .lean()
      : [];
  const jobMap = new Map(jobs.map((j) => [String(j._id), j]));

  return events.map((event) => {
    const job = event.linkedJobId ? jobMap.get(String(event.linkedJobId)) : null;
    const recruiter = event.recruiterId ? recruiterMap.get(String(event.recruiterId)) : null;
    return {
      _id: String(event._id),
      title: event.title,
      type: event.type,
      category: 'hiring' as const,
      description: event.description,
      scheduledAt: event.scheduledAt.toISOString(),
      isActive: event.isActive,
      participantsCount: event.participants.length,
      participants: participantMap.get(String(event._id)) ?? [],
      ...(event.rankingsComputedAt ? { rankingsComputedAt: event.rankingsComputedAt.toISOString() } : {}),
      rankings: rankingMap.get(String(event._id)) ?? [],
      recruiterId: String(event.recruiterId),
      recruiterName: recruiter?.displayName ?? 'Recruiter',
      recruiterCompany: recruiter?.domain ? `${recruiter.domain} Hiring` : undefined,
      ...(event.linkedJobId ? { linkedJobId: String(event.linkedJobId) } : {}),
      ...(job ? { jobTitle: job.title, companyName: job.company } : {}),
      minimumInnovationScore: event.minimumInnovationScore ?? 0,
    };
  });
};

export const selectStudentFromHiringEvent = async (recruiterId: string, eventId: string, studentId: string, jobId: string, note?: string) => {
  const event = await Event.findOne({ _id: eventId, recruiterId, category: 'hiring' });
  if (!event) {
    throw new ApiError(404, 'EVENT_NOT_FOUND', 'Hiring event not found');
  }

  const participant = event.participants.find((p) => String(p.studentId) === studentId);
  if (!participant) {
    throw new ApiError(404, 'PARTICIPANT_NOT_FOUND', 'Student is not a participant of this event');
  }

  if (participant.selectedJobId) {
    const selectedJob = await JobPost.findById(participant.selectedJobId).select('title').lean();
    throw new ApiError(
      409,
      'ALREADY_SELECTED_FROM_EVENT',
      selectedJob
        ? `Student is already selected for "${selectedJob.title}" in this event and cannot be selected for another role.`
        : 'Student is already selected for a role in this event and cannot be selected for another role.',
    );
  }

  if (!event.rankingsComputedAt) {
    throw new ApiError(409, 'EVENT_RANKINGS_REQUIRED', 'Compute the event rankings before adding a participant to the hiring pipeline');
  }

  const isRankedParticipant = event.rankings.some((ranking) => String(ranking.studentId) === studentId);
  if (!isRankedParticipant) {
    throw new ApiError(409, 'PARTICIPANT_NOT_RANKED', 'Only ranked event participants can be added to the hiring pipeline');
  }

  const job = await JobPost.findOne({ _id: jobId, recruiterId, isActive: true });
  if (!job) {
    throw new ApiError(404, 'JOB_NOT_FOUND', 'Job not found or inactive');
  }

  const existingApplication = job.applicationRecords.find((r) => String(r.studentId) === studentId);
  if (existingApplication) {
    throw new ApiError(409, 'ALREADY_APPLIED', 'Student already has an application for this job');
  }

  job.applicationRecords.push({
    studentId: studentId as unknown as import('mongoose').Types.ObjectId,
    source: 'hiring_event',
    stage: 'Applied',
    appliedAt: new Date(),
    updatedAt: new Date(),
    note: note?.trim() || `Selected from hiring event: ${event.title}`,
  });

  if (!job.applicantIds.some((id) => String(id) === studentId)) {
    job.applicantIds.push(studentId as unknown as import('mongoose').Types.ObjectId);
  }

  await job.save();

  participant.selectedJobId = job._id;
  participant.selectedAt = new Date();
  await event.save();

  await createBridge(recruiterId, studentId, 'ACTIVE_APPLICATION');

  const recruiter = await User.findById(recruiterId).select('displayName').lean();
  const recruiterName = recruiter?.displayName ?? 'A recruiter';
  await notifyUser(
    studentId,
    `You have been selected from "${event.title}"`,
    `${recruiterName} selected you from the hiring event "${event.title}" for the position "${job.title}". Check your applications for details.`,
    '/dashboard/student/applications',
  );

  return { selected: true };
};

export const closeEvent = async (eventId: string, actor: EventManagementActor): Promise<{ updated: boolean }> => {
  const event = await findManagedEvent(eventId, actor);

  if (!event) {
    throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }

  event.isActive = false;
  await event.save();

  return { updated: true };
};

registerRequestHandler('college_event_invite', {
  validateAccept: async (request, actorUserId) => {
    if (String(request.toUserId) !== actorUserId) {
      throw new ApiError(403, 'FORBIDDEN', 'Only the target college can accept this hiring event plan');
    }

    const payload = collegeEventInviteMetadataSchema.parse(request.metadata ?? {});
    const collegeId = request.targetEntityId;

    const college = await User.findOne({
      _id: collegeId,
      role: UserRole.COLLEGE,
      isActive: true,
    })
      .select('_id')
      .lean();

    if (!college) {
      throw new ApiError(404, 'COLLEGE_NOT_FOUND', 'College not found');
    }

    if (payload.linkedJobId) {
      const job = await JobPost.findOne({
        _id: payload.linkedJobId,
        recruiterId: request.fromUserId,
        isActive: true,
      })
        .select('_id')
        .lean();

      if (!job) {
        throw new ApiError(404, 'JOB_NOT_FOUND', 'Linked job not found');
      }
    }
  },
  onAccept: async (request) => {
    const payload = collegeEventInviteMetadataSchema.parse(request.metadata ?? {});
    const collegeId = request.targetEntityId;

    let event = await Event.findOne({ sourceRequestId: request._id });

    if (!event) {
      event = await Event.create({
        institutionId: collegeId,
        createdBy: request.fromUserId,
        sourceRequestId: request._id,
        recruiterId: request.fromUserId,
        title: payload.title,
        type: payload.type,
        category: 'hiring',
        description: payload.description,
        scheduledAt: new Date(payload.date),
        isActive: true,
        participants: [],
        rankings: [],
        ...(payload.linkedJobId ? { linkedJobId: payload.linkedJobId } : {}),
        minimumInnovationScore: payload.minimumInnovationScore,
      });
    }

    const recruiterPath = `/dashboard/recruiter/hiring-events?eventId=${String(event._id)}`;
    const collegePath = `/dashboard/college/events?tab=hiring&eventId=${String(event._id)}`;

    request.metadata = {
      ...(request.metadata ?? {}),
      eventId: String(event._id),
    };
    request.deepLink = recruiterPath;
    request.acceptRedirect = collegePath;
    request.declineRedirect = '/dashboard/invitations';
    await request.save();

    const college = await User.findById(collegeId).select('displayName').lean();
    const eligibleStudents = await User.find({
      institutionId: collegeId,
      role: UserRole.STUDENT,
      isActive: true,
      ...(payload.minimumInnovationScore > 0 ? { innovationScore: { $gte: payload.minimumInnovationScore } } : {}),
    })
      .select('_id')
      .lean<Array<{ _id: { toString(): string } }>>();

    const collegeName = college?.displayName ?? 'The college';
    const studentPath = '/dashboard/student/events';
    const scheduledLabel = new Date(payload.date).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    });

    await Promise.all([
      notifyUsersInBatches(
        eligibleStudents.map((student) => String(student._id)),
        `New hiring event: ${payload.title}`,
        `${collegeName} approved a hiring event scheduled for ${scheduledLabel}. Open Events to review the details and register.`,
        studentPath,
      ),
      notifyUser(
        String(request.fromUserId),
        'Hiring event approved',
        `${collegeName} accepted "${payload.title}". You can now score participants and move top students into the hiring pipeline.`,
        recruiterPath,
      ),
    ]);
  },
});

export const listStudentInstitutionDrives = async (institutionId: string) => {
  const events = await Event.find({ institutionId, category: 'hiring' }).sort({ scheduledAt: -1 }).lean();

  const recruiterIds = [...new Set(events.filter((e) => e.recruiterId).map((e) => String(e.recruiterId)))];
  const recruiters =
    recruiterIds.length > 0
      ? await User.find({ _id: { $in: recruiterIds } })
          .select('_id displayName domain')
          .lean()
      : [];
  const recruiterMap = new Map(recruiters.map((r) => [String(r._id), r]));

  const participantMap = await buildParticipantViewMap(events);

  const collegeIds = [...new Set(events.map((e) => String(e.institutionId)))];
  const colleges =
    collegeIds.length > 0
      ? await User.find({ _id: { $in: collegeIds } })
          .select('_id displayName')
          .lean()
      : [];
  const collegeMap = new Map(colleges.map((c) => [String(c._id), c.displayName]));

  const jobIds = [...new Set(events.filter((event) => event.linkedJobId).map((event) => String(event.linkedJobId)))];
  const jobs =
    jobIds.length > 0
      ? await JobPost.find({ _id: { $in: jobIds } })
          .select('_id title company')
          .lean()
      : [];
  const jobMap = new Map(jobs.map((j) => [String(j._id), j]));

  const rankingsAll = await Promise.all(
    events.map(async (event) => ({
      eventId: String(event._id),
      rankings: await getEventRankings(String(event._id), institutionId),
    })),
  );
  const rankingMap = new Map(rankingsAll.map((entry) => [entry.eventId, entry.rankings]));

  return events.map((event) => {
    const job = event.linkedJobId ? jobMap.get(String(event.linkedJobId)) : null;
    const recruiter = event.recruiterId ? recruiterMap.get(String(event.recruiterId)) : null;
    return {
      _id: String(event._id),
      title: event.title,
      type: event.type,
      category: 'hiring' as const,
      description: event.description,
      scheduledAt: event.scheduledAt.toISOString(),
      isActive: event.isActive,
      institutionId: String(event.institutionId),
      collegeName: collegeMap.get(String(event.institutionId)) ?? 'College',
      recruiterId: String(event.recruiterId),
      ...(event.linkedJobId ? { linkedJobId: String(event.linkedJobId) } : {}),
      ...(job ? { jobTitle: job.title, companyName: job.company } : {}),
      minimumInnovationScore: event.minimumInnovationScore ?? 0,
      participantsCount: event.participants.length,
      participants: participantMap.get(String(event._id)) ?? [],
      ...(event.rankingsComputedAt ? { rankingsComputedAt: event.rankingsComputedAt.toISOString() } : {}),
      rankings: rankingMap.get(String(event._id)) ?? [],
      recruiterName: recruiter?.displayName ?? 'Recruiter',
      recruiterCompany: recruiter?.domain ? `${recruiter.domain} Hiring` : undefined,
    };
  });
};
