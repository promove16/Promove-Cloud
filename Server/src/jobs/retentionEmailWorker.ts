import { Queue } from 'bullmq';
import { bullmqConnection, createQueueWorker, hasBullMqRedisConnection, QueueJob } from '../config/bullmq';
import { logError, logger } from '../config/logger';
import {
  createWeeklyProgressSchedulerJob,
  enqueueWeeklyProgressSummaryEmails,
  getWeeklySummaryWeekKey,
  RetentionEmailJobData,
  RetentionEmailSchedulerJobData,
  sendRetentionEmailJob,
} from '../services/retentionEmailService';

type EmailQueueJob = RetentionEmailJobData | RetentionEmailSchedulerJobData;

const WEEKLY_PROGRESS_SCHEDULER_ID = 'weekly-progress-summary';

export const startRetentionEmailWorker = () =>
  createQueueWorker<EmailQueueJob>('emails', async (job: QueueJob<EmailQueueJob>) => {
    const payload = job.data;

    if (payload.type === 'weekly_progress_summary_scheduler') {
      await enqueueWeeklyProgressSummaryEmails(getWeeklySummaryWeekKey());
      return;
    }

    await sendRetentionEmailJob(payload);
  });

export const scheduleWeeklyProgressSummaryJob = async () => {
  if (!hasBullMqRedisConnection) {
    logger.info('Skipping weekly progress summary scheduler because BullMQ Redis is not configured.');
    return;
  }

  const queue = new Queue<EmailQueueJob>('emails', { connection: bullmqConnection });

  try {
    const schedulerJob = createWeeklyProgressSchedulerJob();

    await queue.upsertJobScheduler(
      WEEKLY_PROGRESS_SCHEDULER_ID,
      { pattern: '0 9 * * 1', tz: 'UTC' },
      {
        name: 'weekly-progress-summary:run',
        data: schedulerJob,
        opts: {
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      },
    );
  } catch (error) {
    logError('Failed to schedule weekly progress summary emails', error);
  } finally {
    await queue.close().catch((error) => {
      logError('Failed to close weekly progress summary queue', error);
    });
  }
};
