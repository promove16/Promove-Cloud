import {
  QueueJob,
  mentorDecayQueue,
  createQueueWorker,
  hasActiveBullMqRedisConnection,
  hasBullMqRedisConnection,
} from '../config/bullmq';
import { logError, logger } from '../config/logger';
import { applyMentorScoreDecay, refreshMentorRanks } from '../modules/mentorScore/mentorScore.service';

type MentorDecayJobData = {
  type: 'mentor_score_decay';
  triggeredAt: string;
};

// 24-hour interval (fires every day from when the scheduler first starts)
const DECAY_INTERVAL_MS  = 24 * 60 * 60 * 1000;
const DECAY_SCHEDULER_ID = 'mentor-score-decay-daily';

export const startMentorDecayWorker = () =>
  createQueueWorker<MentorDecayJobData>(
    'mentor-score-decay',
    async (job: QueueJob<MentorDecayJobData>) => {
      if (job.data.type !== 'mentor_score_decay') {
        logger.warn('Skipping unknown mentor decay job', { jobName: job.name, jobId: job.id });
        return;
      }

      logger.info('Mentor score decay run started', { triggeredAt: job.data.triggeredAt });

      const { affected } = await applyMentorScoreDecay();

      if (affected > 0) {
        await refreshMentorRanks();
      }

      logger.info('Mentor score decay run complete', { affected });
    },
    { concurrency: 1 },
  );

export const scheduleMentorDecayJob = async () => {
  if (!hasBullMqRedisConnection) {
    logger.warn('Skipping mentor decay scheduler: BullMQ Redis not configured.');
    return;
  }

  if (!hasActiveBullMqRedisConnection()) {
    logger.warn('Skipping mentor decay scheduler: BullMQ Redis transport unavailable.');
    return;
  }

  try {
    await mentorDecayQueue.add(
      'mentor-score-decay:daily',
      {
        type:        'mentor_score_decay',
        triggeredAt: new Date().toISOString(),
      },
      {
        repeat:          { every: DECAY_INTERVAL_MS },
        jobId:           DECAY_SCHEDULER_ID,
        removeOnComplete: 10,
        removeOnFail:     50,
      },
    );

    logger.info('Mentor score decay scheduler registered', { interval: '24h' });
  } catch (error) {
    logError('Failed to schedule mentor decay job', error);
  }
};
