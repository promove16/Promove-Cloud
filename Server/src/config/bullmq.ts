import { Job, JobsOptions, Queue, Worker, WorkerOptions } from 'bullmq';
import IORedis from 'ioredis';
import { env } from './env';
import { logError, logger } from './logger';
import { ApiRequestActivityPayload } from '../modules/analytics/activity.types';

export const hasBullMqRedisConnection = env.BULLMQ_USE_REDIS && Boolean(env.UPSTASH_REDIS_PASSWORD);

const DEFAULT_JOB_OPTIONS: Pick<JobsOptions, 'removeOnComplete' | 'removeOnFail'> = {
  removeOnComplete: 100,
  removeOnFail: 100,
};

const baseConnection = {
  host: env.UPSTASH_REDIS_HOST,
  port: 6379,
  password: env.UPSTASH_REDIS_PASSWORD ?? env.UPSTASH_REDIS_REST_TOKEN,
  tls: {},
  lazyConnect: true,
  enableOfflineQueue: false,
  connectTimeout: env.BULLMQ_CONNECT_TIMEOUT_MS,
  retryStrategy: () => null,
};

const connection = {
  ...baseConnection,
  maxRetriesPerRequest: 1,
  commandTimeout: env.BULLMQ_COMMAND_TIMEOUT_MS,
};

export const bullmqConnection = connection;

const workerConnection = {
  ...baseConnection,
  maxRetriesPerRequest: null,
};

const UPSTASH_REQUEST_LIMIT_PATTERN = /max requests limit exceeded/i;
const NON_RECOVERABLE_REDIS_TRANSPORT_PATTERNS = [
  /stream isn't writeable/i,
  /connection is closed/i,
  /connection lost/i,
  /socket closed unexpectedly/i,
  /ready check failed/i,
  /econnrefused/i,
  /econnreset/i,
  /etimedout/i,
  /enotfound/i,
  /network is unreachable/i,
  /connection ended unexpectedly/i,
];
const BULLMQ_IOREDIS_STACK_PATTERN = /node_modules[\\/]+bullmq[\\/]+node_modules[\\/]+ioredis/i;

let remoteBullMqDisabledReason: string | null = null;

const remoteQueues = new Set<Queue>();
const remoteWorkers = new Set<Worker>();
const remoteWorkerRuns = new Map<Worker, Promise<void>>();

type BullMqQueueConnection = {
  close: (force?: boolean) => Promise<void>;
};

type BullMqQueueWithInternalConnection = Queue & {
  connection?: BullMqQueueConnection;
};

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

const isBullMqRedisRequestLimitError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return UPSTASH_REQUEST_LIMIT_PATTERN.test(message);
};

const isBullMqRedisTransportError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return NON_RECOVERABLE_REDIS_TRANSPORT_PATTERNS.some((pattern) => pattern.test(message));
};

const shouldDisableRemoteBullMq = (error: unknown) =>
  isBullMqRedisRequestLimitError(error) || isBullMqRedisTransportError(error);

const isRemoteBullMqActive = () => hasBullMqRedisConnection && !remoteBullMqDisabledReason;

export const hasActiveBullMqRedisConnection = () => isRemoteBullMqActive();

const closeBullMqQueue = async (queue: Queue, force = false) => {
  if (!force) {
    await queue.close();
    return;
  }

  // Queue does not expose a force-close API, but transport failures need an immediate disconnect.
  const internalConnection = (queue as BullMqQueueWithInternalConnection).connection;
  if (internalConnection?.close) {
    await internalConnection.close(true);
    return;
  }

  await queue.disconnect();
};

export const closeBullMqQueueSafely = async (queue: Queue, force = false) => {
  await closeBullMqQueue(queue, force);
};

const closeRemoteBullMqResources = () => {
  const workers = Array.from(remoteWorkers);
  const queues = Array.from(remoteQueues);

  remoteWorkers.clear();
  remoteQueues.clear();
  remoteWorkerRuns.clear();

  workers.forEach((worker) => {
    void worker.close(true).catch((error) => {
      logError('Failed to close BullMQ worker after Redis shutdown', error);
    });
  });

  queues.forEach((queue) => {
    void closeBullMqQueue(queue, true).catch((error) => {
      logError('Failed to close BullMQ queue after Redis shutdown', error);
    });
  });
};

const startRemoteWorker = (queueName: string, worker: Worker) => {
  const runPromise = worker
    .run()
    .catch((error) => {
      if (shouldDisableRemoteBullMq(error)) {
        disableRemoteBullMq(error);
        return;
      }

      if (remoteBullMqDisabledReason && isBullMqRedisTransportError(error)) {
        return;
      }

      logError(`BullMQ worker "${queueName}" run failed`, error);
    })
    .finally(() => {
      remoteWorkerRuns.delete(worker);
    });

  remoteWorkerRuns.set(worker, runPromise);
};

const registerRemoteQueue = (queueName: string) => {
  const queue = new Queue(queueName, { connection });

  remoteQueues.add(queue);
  queue.on('error', (error) => {
    if (shouldDisableRemoteBullMq(error)) {
      disableRemoteBullMq(error);
      return;
    }

    logError(`BullMQ queue "${queueName}" connection error`, error);
  });

  return queue;
};

export const disableRemoteBullMq = (error: unknown) => {
  if (remoteBullMqDisabledReason) {
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  remoteBullMqDisabledReason = message;

  logger.warn(
    `BullMQ Redis transport disabled. Falling back to local in-process queues. Reason: ${message}`,
  );
  closeRemoteBullMqResources();
};

export const shouldDisableBullMqRedis = (error: unknown) => shouldDisableRemoteBullMq(error);

export const shouldIgnoreBullMqUnhandledRejection = (error: unknown) => {
  if (!remoteBullMqDisabledReason) {
    return false;
  }

  if (isBullMqRedisRequestLimitError(error)) {
    return true;
  }

  if (!isBullMqRedisTransportError(error)) {
    return false;
  }

  const stack = error instanceof Error ? error.stack ?? '' : '';
  return BULLMQ_IOREDIS_STACK_PATTERN.test(stack);
};

export const initializeBullMqRedisTransport = async () => {
  if (env.NODE_ENV === 'test' || !isRemoteBullMqActive()) {
    return isRemoteBullMqActive();
  }

  const probe = new IORedis({
    ...connection,
    connectionName: 'bullmq:startup-probe',
  });

  try {
    await probe.connect();
    return true;
  } catch (error) {
    if (!shouldDisableRemoteBullMq(error)) {
      logError('BullMQ Redis startup probe failed', error);
    }

    disableRemoteBullMq(error);
    return false;
  } finally {
    probe.disconnect();
  }
};

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

const withDefaultJobOptions = (opts?: JobsOptions): JobsOptions => ({
  ...opts,
  removeOnComplete: opts?.removeOnComplete ?? DEFAULT_JOB_OPTIONS.removeOnComplete,
  removeOnFail: opts?.removeOnFail ?? DEFAULT_JOB_OPTIONS.removeOnFail,
});

const addLocalJob = async <T>(
  queueName: string,
  jobName: string,
  data: T,
  opts?: JobsOptions,
) => {
  const normalizedOpts = withDefaultJobOptions(opts);
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
      await processor({ id, name: jobName, data }, normalizedOpts);
    } catch (error) {
      logError(`Local queue "${queueName}" job "${jobName}" failed`, error);
    }
  });

  return { id };
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
  let queue: Queue | null = null;

  const getRemoteQueue = () => {
    if (!isRemoteBullMqActive()) {
      return null;
    }

    if (!queue) {
      queue = registerRemoteQueue(queueName);
    }

    return queue;
  };

  return {
    add: async (jobName: string, data: T, opts?: JobsOptions) => {
      const normalizedOpts = withDefaultJobOptions(opts);
      const remoteQueue = getRemoteQueue();

      if (!remoteQueue || !isRemoteBullMqActive()) {
        return addLocalJob(queueName, jobName, data, normalizedOpts);
      }

      try {
        return await remoteQueue.add(jobName, data, normalizedOpts);
      } catch (error) {
        if (shouldDisableRemoteBullMq(error)) {
          disableRemoteBullMq(error);
          return addLocalJob(queueName, jobName, data, normalizedOpts);
        }

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

  if (env.NODE_ENV === 'test') {
    const worker: QueueWorkerLike<T> = {
      on: () => worker,
    };

    return worker;
  }

  if (!isRemoteBullMqActive()) {
    return createLocalWorker(queueName, processor);
  }

  const worker = new Worker(
    queueName,
    async (job: Job<T>) => processor({ id: job.id, name: job.name, data: job.data }),
    {
      ...options,
      autorun: false,
      connection: workerConnection,
    },
  );

  remoteWorkers.add(worker);

  worker.on('error', (error) => {
    if (shouldDisableRemoteBullMq(error)) {
      disableRemoteBullMq(error);
      return;
    }

    logError(`BullMQ worker "${queueName}" error`, error);
  });

  startRemoteWorker(queueName, worker);

  return worker as QueueWorkerLike<T>;
};

export const scoreQueue = createSafeQueue('score-recalc');
export const notificationQueue = createSafeQueue('notifications');
export const emailQueue = createSafeQueue('emails');
export const activityQueue = createSafeQueue<ApiRequestActivityPayload>('activity');
export const institutionVerifyQueue = createSafeQueue<{ userId: string; token: string }>(
  'institution-verify',
);
