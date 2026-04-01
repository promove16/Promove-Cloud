import { Job, JobsOptions, Queue, Worker, WorkerOptions } from 'bullmq';
import { env } from './env';
import { logError, logger } from './logger';
import { ApiRequestActivityPayload } from '../modules/analytics/activity.types';

export const hasBullMqRedisConnection = Boolean(env.UPSTASH_REDIS_PASSWORD);

const connection = {
  host: env.UPSTASH_REDIS_HOST,
  port: 6379,
  password: env.UPSTASH_REDIS_PASSWORD ?? env.UPSTASH_REDIS_REST_TOKEN,
  tls: {},
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  connectTimeout: env.BULLMQ_CONNECT_TIMEOUT_MS,
  commandTimeout: env.BULLMQ_COMMAND_TIMEOUT_MS,
};

export const bullmqConnection = connection;

export type QueueJob<T> = {
  id?: string;
  name: string;
  data: T;
};

type QueueWorkerOptions = Omit<WorkerOptions, 'connection'>;
type FailedHandler<T> = (job: QueueJob<T> | undefined, error: Error) => void;

type QueueLike<T = unknown> = {
  add: (name: string, data: T, opts?: JobsOptions) => Promise<unknown>;
};

type QueueWorkerLike<T> = {
  on: (event: 'failed', handler: FailedHandler<T>) => QueueWorkerLike<T>;
};

const createMockQueue = <T>(): QueueLike<T> => ({
  add: async () => ({ id: 'mock-job' } as never),
});

const localProcessors = new Map<string, (job: QueueJob<unknown>, opts?: JobsOptions) => Promise<void>>();
const localFailedHandlers = new Map<string, Array<FailedHandler<unknown>>>();

const getBackoffDelay = (opts?: JobsOptions, attempt = 1) => {
  const backoff = opts?.backoff;

  if (!backoff) {
    return 0;
  }

  if (typeof backoff === 'number') {
    return backoff;
  }

  const baseDelay = backoff.delay ?? 0;
  if (backoff.type === 'exponential') {
    return baseDelay * 2 ** Math.max(attempt - 1, 0);
  }

  return baseDelay;
};

const emitLocalFailure = <T>(queueName: string, job: QueueJob<T>, error: Error) => {
  const handlers = localFailedHandlers.get(queueName) ?? [];
  handlers.forEach((handler) => handler(job as QueueJob<unknown> | undefined, error));
};

const createLocalWorker = <T>(
  queueName: string,
  processor: (job: QueueJob<T>) => Promise<void>,
): QueueWorkerLike<T> => {
  localProcessors.set(queueName, async (job, opts) => {
    const attempts = Math.max(opts?.attempts ?? 1, 1);

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await processor(job as QueueJob<T>);
        return;
      } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        if (attempt === attempts) {
          emitLocalFailure(queueName, job as QueueJob<T>, normalizedError);
          throw normalizedError;
        }

        const delay = getBackoffDelay(opts, attempt);
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  });

  const worker: QueueWorkerLike<T> = {
    on: (event, handler) => {
      if (event === 'failed') {
        const existingHandlers = localFailedHandlers.get(queueName) ?? [];
        existingHandlers.push(handler as FailedHandler<unknown>);
        localFailedHandlers.set(queueName, existingHandlers);
      }

      return worker;
    },
  };

  return worker;
};

const createSafeQueue = <T>(queueName: string): QueueLike<T> => {
  if (env.NODE_ENV === 'test') {
    return createMockQueue<T>();
  }

  if (!hasBullMqRedisConnection) {
    return {
      add: async (jobName: string, data: T, opts?: JobsOptions) => {
        const id = `${queueName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const processor = localProcessors.get(queueName) as
          | ((job: QueueJob<T>, options?: JobsOptions) => Promise<void>)
          | undefined;

        if (!processor) {
          logger.warn(
            `No local queue processor registered for "${queueName}". Skipping job "${jobName}".`,
          );
          return { id };
        }

        void Promise.resolve().then(async () => {
          try {
            await processor({ id, name: jobName, data }, opts);
          } catch (error) {
            logError(`Local queue "${queueName}" job "${jobName}" failed`, error);
          }
        });

        return { id };
      },
    };
  }

  const queue = new Queue(queueName, { connection });

  queue.on('error', (error) => {
    logError(`BullMQ queue "${queueName}" connection error`, error);
  });

  return {
    add: async (jobName: string, data: unknown, opts?: JobsOptions) => {
      try {
        return await queue.add(jobName, data, opts);
      } catch (error) {
        logError(`BullMQ queue "${queueName}" add failed for job "${jobName}"`, error);
        return { id: `skipped-${queueName}-${Date.now()}` };
      }
    },
  };
};

export const createQueueWorker = <T>(
  queueName: string,
  processor: (job: QueueJob<T>) => Promise<void>,
  options?: QueueWorkerOptions,
): QueueWorkerLike<T> => {
  if (env.NODE_ENV === 'test') {
    const worker: QueueWorkerLike<T> = {
      on: () => worker,
    };

    return worker;
  }

  if (!hasBullMqRedisConnection) {
    return createLocalWorker(queueName, processor);
  }

  const worker = new Worker(
    queueName,
    async (job: Job<T>) => processor({ id: job.id, name: job.name, data: job.data }),
    {
      connection: bullmqConnection,
      ...options,
    },
  );

  worker.on('error', (error) => {
    logError(`BullMQ worker "${queueName}" error`, error);
  });

  return worker as QueueWorkerLike<T>;
};

export const scoreQueue = createSafeQueue('score-recalc');
export const notificationQueue = createSafeQueue('notifications');
export const activityQueue = createSafeQueue<ApiRequestActivityPayload>('activity');
export const institutionVerifyQueue = createSafeQueue<{ userId: string; token: string }>(
  'institution-verify',
);
