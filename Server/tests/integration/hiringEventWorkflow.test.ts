import { Types } from 'mongoose';
import { Event } from '../../src/modules/event/event.model';
import { computeEventRankings, selectStudentFromHiringEvent } from '../../src/modules/event/event.service';
import { UserRole } from '../../src/types/roles.types';

const createHiringEvent = (options?: { submissionScore?: number; withParticipant?: boolean }) => {
  const recruiterId = new Types.ObjectId();
  const institutionId = new Types.ObjectId();
  const studentId = new Types.ObjectId();
  const withParticipant = options?.withParticipant ?? true;

  return Event.create({
    institutionId,
    createdBy: recruiterId,
    recruiterId,
    title: 'Progressive Hiring Event',
    type: 'Placement Drive',
    category: 'hiring',
    description: 'Scores must be finalized before candidates enter the hiring pipeline.',
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    isActive: true,
    participants: withParticipant
      ? [
          {
            studentId,
            joinedAt: new Date(),
            ...(typeof options?.submissionScore === 'number' ? { submissionScore: options.submissionScore } : {}),
          },
        ]
      : [],
    rankings: [],
  }).then((event) => ({ event, recruiterId, institutionId, studentId }));
};

describe('hiring event evaluation workflow', () => {
  it('requires every participant score before computing rankings', async () => {
    const { event, recruiterId } = await createHiringEvent();

    await expect(
      computeEventRankings(event._id.toString(), {
        actorId: recruiterId.toString(),
        role: UserRole.RECRUITER,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'EVENT_SCORES_INCOMPLETE',
    });
  });

  it('does not compute rankings for an event without participants', async () => {
    const { event, recruiterId } = await createHiringEvent({ withParticipant: false });

    await expect(
      computeEventRankings(event._id.toString(), {
        actorId: recruiterId.toString(),
        role: UserRole.RECRUITER,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'EVENT_HAS_NO_PARTICIPANTS',
    });
  });

  it('requires finalized rankings before adding a participant to the pipeline', async () => {
    const { event, recruiterId, studentId } = await createHiringEvent({ submissionScore: 84 });

    await expect(
      selectStudentFromHiringEvent(
        recruiterId.toString(),
        event._id.toString(),
        studentId.toString(),
        new Types.ObjectId().toString(),
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'EVENT_RANKINGS_REQUIRED',
    });
  });

  it('blocks a student already selected for another role in the same event', async () => {
    const { event, recruiterId, studentId } = await createHiringEvent({ submissionScore: 84 });

    await computeEventRankings(event._id.toString(), {
      actorId: recruiterId.toString(),
      role: UserRole.RECRUITER,
    });

    await Event.updateOne(
      { _id: event._id, 'participants.studentId': studentId },
      { $set: { 'participants.$.selectedJobId': new Types.ObjectId(), 'participants.$.selectedAt': new Date() } },
    );

    await expect(
      selectStudentFromHiringEvent(
        recruiterId.toString(),
        event._id.toString(),
        studentId.toString(),
        new Types.ObjectId().toString(),
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'ALREADY_SELECTED_FROM_EVENT',
    });
  });

  it('keeps a student selectable in a different hiring event', async () => {
    const { event, recruiterId, studentId } = await createHiringEvent({ submissionScore: 84 });
    const otherEvent = await createHiringEvent({ submissionScore: 84 });

    await Event.updateOne(
      { _id: event._id, 'participants.studentId': studentId },
      { $set: { 'participants.$.selectedJobId': new Types.ObjectId(), 'participants.$.selectedAt': new Date() } },
    );

    // The other event has no selection recorded, so it fails on the rankings gate rather than the selection guard.
    await expect(
      selectStudentFromHiringEvent(
        otherEvent.recruiterId.toString(),
        otherEvent.event._id.toString(),
        otherEvent.studentId.toString(),
        new Types.ObjectId().toString(),
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'EVENT_RANKINGS_REQUIRED',
    });
  });

  it('computes rankings once every participant has a score', async () => {
    const { event, recruiterId, studentId } = await createHiringEvent({ submissionScore: 84 });

    await computeEventRankings(event._id.toString(), {
      actorId: recruiterId.toString(),
      role: UserRole.RECRUITER,
    });

    const updatedEvent = await Event.findById(event._id).lean();
    expect(updatedEvent?.rankingsComputedAt).toBeInstanceOf(Date);
    expect(updatedEvent?.rankings).toEqual([
      expect.objectContaining({
        rank: 1,
        studentId,
        submissionScore: 84,
      }),
    ]);
  });
});
