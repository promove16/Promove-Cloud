import { Queue } from 'bullmq';
import { env } from './env';

export const bullmqConnection = {
  host: env.UPSTASH_REDIS_HOST,
  port: 6379,
  password: env.UPSTASH_REDIS_REST_TOKEN,
  tls: {},
};

type QueueAddOnly = Pick<Queue, 'add'>;

const createTestQueue = (): QueueAddOnly => ({
  add: async () => ({ id: 'test-job' }) as Awaited<ReturnType<Queue['add']>>,
});

export const scoreQueue: QueueAddOnly =
  env.NODE_ENV === 'test'
    ? createTestQueue()
    : new Queue('score-recalc', { connection: bullmqConnection });

export const notificationQueue: QueueAddOnly =
  env.NODE_ENV === 'test'
    ? createTestQueue()
    : new Queue('notifications', { connection: bullmqConnection });
