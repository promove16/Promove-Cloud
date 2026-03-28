import { createQueueWorker, QueueJob } from '../config/bullmq';
import { logError } from '../config/logger';
import { ApplyScoreParams, applyScore } from '../services/scoreEngine';

export const startScoreWorker = () => {
  const worker = createQueueWorker<ApplyScoreParams>(
    'score-recalc',
    async (job: QueueJob<ApplyScoreParams>) => {
      await applyScore(job.data);
    },
    {
      concurrency: 10,
    },
  );

  worker.on('failed', (job: QueueJob<ApplyScoreParams> | undefined, err: Error) => {
    logError(`Score job ${job?.id ?? 'unknown'} failed`, err);
  });

  return worker;
};
