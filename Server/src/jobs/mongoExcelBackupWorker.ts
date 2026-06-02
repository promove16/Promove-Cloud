import { Queue } from 'bullmq';
import {
  bullmqConnection,
  closeBullMqQueueSafely,
  createQueueWorker,
  disableRemoteBullMq,
  hasActiveBullMqRedisConnection,
  hasBullMqRedisConnection,
  mongoExcelBackupQueue,
  QueueJob,
  shouldDisableBullMqRedis,
} from '../config/bullmq';
import { env } from '../config/env';
import { logError, logger } from '../config/logger';
import { runMongoDisasterBackup } from '../services/mongoDisasterBackupService';
import { runMongoExcelBackup } from '../services/mongoExcelBackupService';
import { runMongoNativeBackup } from '../services/mongoNativeBackupService';

type MongoExcelBackupJobData = {
  type: 'mongo_excel_backup';
  requestedAt: string;
};

const MONGO_EXCEL_BACKUP_SCHEDULER_ID = 'mongo-excel-backup-daily';
let runOnStartJobQueued = false;

export const startMongoExcelBackupWorker = () =>
  createQueueWorker<MongoExcelBackupJobData>(
    'mongo-excel-backup',
    async (job: QueueJob<MongoExcelBackupJobData>) => {
      if (job.data.type !== 'mongo_excel_backup') {
        logger.warn('Skipping unknown Mongo Excel backup job', {
          jobName: job.name,
          jobId: job.id,
        });
        return;
      }

      // Run each backup independently so one failing engine (e.g. a missing
      // mongodump binary) does not prevent the others from completing.
      const steps: { name: string; run: () => Promise<unknown> }[] = [];
      if (env.MONGO_NATIVE_BACKUP_ENABLED) {
        steps.push({ name: 'native', run: runMongoNativeBackup });
      }
      if (env.MONGO_DISASTER_BACKUP_ENABLED) {
        steps.push({ name: 'disaster', run: runMongoDisasterBackup });
      }
      steps.push({ name: 'excel', run: runMongoExcelBackup });

      const failures: { name: string; error: unknown }[] = [];
      for (const step of steps) {
        try {
          await step.run();
        } catch (error) {
          failures.push({ name: step.name, error });
          logError(`Mongo ${step.name} backup failed`, error);
        }
      }

      // Surface failure to BullMQ only if every backup engine failed, so a
      // partial success is not retried into duplicate uploads.
      if (failures.length === steps.length) {
        throw new Error(
          `All Mongo backups failed: ${failures.map((failure) => failure.name).join(', ')}`,
        );
      }
    },
    {
      concurrency: 1,
    },
  );

export const enqueueMongoExcelBackupNow = async () =>
  mongoExcelBackupQueue.add(
    'mongo-excel-backup:run',
    {
      type: 'mongo_excel_backup',
      requestedAt: new Date().toISOString(),
    },
    {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 60_000,
      },
      removeOnComplete: 20,
      removeOnFail: 50,
    },
  );

export const scheduleMongoExcelBackupJob = async () => {
  if (!env.MONGO_EXCEL_BACKUP_ENABLED) {
    logger.info('Mongo Excel backup BullMQ scheduler is disabled.');
    return;
  }

  if (!hasBullMqRedisConnection) {
    logger.warn('Skipping Mongo Excel backup scheduler because BullMQ Redis is not configured.');
    return;
  }

  if (!hasActiveBullMqRedisConnection()) {
    logger.warn('Skipping Mongo Excel backup scheduler because BullMQ Redis transport is unavailable.');
    return;
  }

  const queue = new Queue<MongoExcelBackupJobData>('mongo-excel-backup', {
    connection: bullmqConnection,
  });
  let shouldForceCloseQueue = false;

  try {
    await queue.upsertJobScheduler(
      MONGO_EXCEL_BACKUP_SCHEDULER_ID,
      { pattern: env.MONGO_EXCEL_BACKUP_CRON, tz: env.MONGO_EXCEL_BACKUP_TIMEZONE },
      {
        name: 'mongo-excel-backup:run',
        data: {
          type: 'mongo_excel_backup',
          requestedAt: new Date().toISOString(),
        },
        opts: {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 60_000,
          },
          removeOnComplete: 20,
          removeOnFail: 50,
        },
      },
    );

    logger.info('Mongo Excel backup BullMQ scheduler registered', {
      cron: env.MONGO_EXCEL_BACKUP_CRON,
      timezone: env.MONGO_EXCEL_BACKUP_TIMEZONE,
      retentionDays: env.MONGO_EXCEL_BACKUP_RETENTION_DAYS,
      nativeBackupEnabled: env.MONGO_NATIVE_BACKUP_ENABLED,
      disasterBackupEnabled: env.MONGO_DISASTER_BACKUP_ENABLED,
    });

    if (env.MONGO_EXCEL_BACKUP_RUN_ON_START && !runOnStartJobQueued) {
      runOnStartJobQueued = true;
      await enqueueMongoExcelBackupNow();
    }
  } catch (error) {
    if (shouldDisableBullMqRedis(error)) {
      shouldForceCloseQueue = true;
      disableRemoteBullMq(error);
      return;
    }

    logError('Failed to schedule Mongo Excel backup job', error);
  } finally {
    await closeBullMqQueueSafely(queue, shouldForceCloseQueue).catch((error) => {
      logError('Failed to close Mongo Excel backup scheduler queue', error);
    });
  }
};
