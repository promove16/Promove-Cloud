import { Queue } from 'bullmq';
import { env } from './env';

const connection = {
  host: env.UPSTASH_REDIS_HOST,
  port: 6379,
  password: env.UPSTASH_REDIS_REST_TOKEN,
  tls: {},
};

export const bullmqConnection = connection;

type QueueLike = Pick<Queue, 'add'>;

const createMockQueue = (): QueueLike => ({
  add: async () => ({ id: 'mock-job' } as never),
});

export const scoreQueue: QueueLike =
  env.NODE_ENV === 'test' ? createMockQueue() : new Queue('score-recalc', { connection });
export const notificationQueue: QueueLike =
  env.NODE_ENV === 'test' ? createMockQueue() : new Queue('notifications', { connection });
