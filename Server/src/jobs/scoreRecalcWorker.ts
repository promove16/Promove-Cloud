import { createQueueWorker, QueueJob } from '../config/bullmq';
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
    console.error(`Score job ${job?.id} failed:`, err.message);
  });

  return worker;
};
