import { createQueueWorker, QueueJob } from '../config/bullmq';
import { logError } from '../config/logger';
import {
  recordApiRequestActivity,
} from '../modules/analytics/activity.service';
import { ApiRequestActivityPayload } from '../modules/analytics/activity.types';

export const startActivityWorker = () => {
  const worker = createQueueWorker<ApiRequestActivityPayload>(
    'activity',
    async (job: QueueJob<ApiRequestActivityPayload>) => {
      await recordApiRequestActivity(job.data);
    },
  );

  worker.on('failed', (job: QueueJob<ApiRequestActivityPayload> | undefined, error: Error) => {
    logError(`Activity job ${job?.id ?? 'unknown'} failed`, error);
  });

  return worker;
};
