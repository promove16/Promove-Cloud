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
