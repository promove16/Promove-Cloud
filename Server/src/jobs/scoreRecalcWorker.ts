import { Job, Worker } from 'bullmq';
import { bullmqConnection } from '../config/bullmq';
import { ApplyScoreParams, applyScore } from '../services/scoreEngine';

export const startScoreWorker = () => {
  const worker = new Worker(
    'score-recalc',
    async (job: Job<ApplyScoreParams>) => {
      await applyScore(job.data);
    },
    {
      connection: bullmqConnection,
      concurrency: 10,
    },
  );

  worker.on('failed', (job: Job<ApplyScoreParams> | undefined, err: Error) => {
    console.error(`Score job ${job?.id} failed:`, err.message);
  });

  return worker;
};
