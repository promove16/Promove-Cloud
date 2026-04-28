import { Job, JobsOptions, Queue, Worker, WorkerOptions } from 'bullmq';
import IORedis from 'ioredis';
import { env } from './env';
import { logError, logger } from './logger';
import { hasRedisConnectionConfig, resolveRedisOptions } from './redisConnection';
import { ApiRequestActivityPayload } from '../modules/analytics/activity.types';
import {
  queueDepth,
  queueJobDuration,
  queueJobsProcessed,
  queueWaitTime,
} from '../middleware/metrics';

export const hasBullMqRedisConnection = env.BULLMQ_USE_REDIS && hasRedisConnectionConfig();

const DEFAULT_JOB_OPTIONS: Pick<JobsOptions, 'removeOnComplete' | 'removeOnFail'> = {
  removeOnComplete: 100,
  removeOnFail: 100,
};

const baseConnection = resolveRedisOptions({
  connectionName: 'promove:bullmq',
  connectTimeout: env.BULLMQ_CONNECT_TIMEOUT_MS,
  commandTimeout: env.BULLMQ_COMMAND_TIMEOUT_MS,
});

const connection = {
  ...baseConnection,
  maxRetriesPerRequest: 1,
  commandTimeout: env.BULLMQ_COMMAND_TIMEOUT_MS,
};

export const bullmqConnection = connection;

const { commandTimeout: _workerCommandTimeout, ...workerBaseConnection } = baseConnection;
void _workerCommandTimeout;

const workerConnection = {
  ...workerBaseConnection,
  maxRetriesPerRequest: null,
};

const REDIS_REQUEST_LIMIT_PATTERN = /max requests limit exceeded/i;
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

const BULLMQ_RESERVED_SEPARATOR_PATTERN = /:/g;

const toBullMqSafeIdentifier = (value: string) =>
  value.replace(BULLMQ_RESERVED_SEPARATOR_PATTERN, '-');

const sanitizeJobOptions = (opts?: JobsOptions): JobsOptions | undefined => {
  if (!opts?.jobId) {
    return opts;
  }

  return {
    ...opts,
    jobId: toBullMqSafeIdentifier(opts.jobId),
  };
};

const localProcessors = new Map<string, (job: QueueJob<unknown>, opts?: JobsOptions) => Promise<void>>();
const localFailedHandlers = new Map<string, Array<FailedHandler<unknown>>>();

const isBullMqRedisRequestLimitError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return REDIS_REQUEST_LIMIT_PATTERN.test(message);
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
  ...sanitizeJobOptions(opts),
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
    async (job: Job<T>) => {
      // Queue lag = time between enqueue (job.timestamp) and processing start.
      if (typeof job.timestamp === 'number') {
        const waitSeconds = Math.max(0, (Date.now() - job.timestamp) / 1000);
        queueWaitTime.observe({ queue: queueName }, waitSeconds);
      }

      const start = process.hrtime.bigint();
      try {
        await processor({ id: job.id, name: job.name, data: job.data });
        const seconds = Number(process.hrtime.bigint() - start) / 1e9;
        queueJobDuration.observe({ queue: queueName }, seconds);
        queueJobsProcessed.inc({ queue: queueName, status: 'completed' });
      } catch (error) {
        const seconds = Number(process.hrtime.bigint() - start) / 1e9;
        queueJobDuration.observe({ queue: queueName }, seconds);
        queueJobsProcessed.inc({ queue: queueName, status: 'failed' });
        throw error;
      }
    },
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

  // Dead-letter handling: when a job exhausts its retries we forward a snapshot
  // to a sibling DLQ so it can be inspected and replayed manually. This avoids
  // silent data loss when a poison-pill payload keeps failing.
  worker.on('failed', async (job, error) => {
    if (!job) return;
    const attemptsMade = job.attemptsMade ?? 0;
    const attemptsAllowed = job.opts?.attempts ?? 1;
    if (attemptsMade < attemptsAllowed) return; // will retry — not yet dead

    queueJobsProcessed.inc({ queue: queueName, status: 'dlq' });
    try {
      await getDeadLetterQueue(queueName).add(
        'dead-letter',
        {
          originalQueue: queueName,
          jobId: job.id,
          name: job.name,
          data: job.data,
          failedReason: error.message,
          stack: error.stack,
          attemptsMade,
          enqueuedAt: job.timestamp,
          failedAt: Date.now(),
        },
        { removeOnComplete: 1000, removeOnFail: 1000 },
      );
    } catch (dlqError) {
      logError(`BullMQ DLQ add failed for queue "${queueName}"`, dlqError);
    }
  });

  startRemoteWorker(queueName, worker);

  return worker as QueueWorkerLike<T>;
};

const deadLetterQueues = new Map<string, Queue>();
const getDeadLetterQueue = (queueName: string): Queue => {
  const dlqName = toBullMqSafeIdentifier(`${queueName}-dlq`);
  let dlq = deadLetterQueues.get(dlqName);
  if (!dlq) {
    dlq = new Queue(dlqName, { connection });
    deadLetterQueues.set(dlqName, dlq);
    remoteQueues.add(dlq);
  }
  return dlq;
};

/**
 * Periodically polls queue depth (waiting/active/delayed/failed) and exports as
 * Prometheus gauges. Call once at startup.
 */
let depthPoller: NodeJS.Timeout | null = null;
export const startQueueDepthPoller = (intervalMs = 15000) => {
  if (depthPoller || env.NODE_ENV === 'test' || !isRemoteBullMqActive()) {
    return;
  }

  const poll = async () => {
    for (const queue of remoteQueues) {
      try {
        const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
        for (const [state, count] of Object.entries(counts)) {
          queueDepth.set({ queue: queue.name, state }, count as number);
        }
      } catch (error) {
        // Don't crash the app on metric failures.
        logger.debug(`queue depth poll failed for ${queue.name}: ${(error as Error).message}`);
      }
    }
  };

  depthPoller = setInterval(poll, intervalMs);
  // Don't keep the event loop alive just for metrics.
  depthPoller.unref?.();
  void poll();
};

export const stopQueueDepthPoller = () => {
  if (depthPoller) {
    clearInterval(depthPoller);
    depthPoller = null;
  }
};

export const scoreQueue = createSafeQueue('score-recalc');
export const notificationQueue = createSafeQueue('notifications');
export const emailQueue = createSafeQueue('emails');
export const activityQueue = createSafeQueue<ApiRequestActivityPayload>('activity');
export const mongoExcelBackupQueue = createSafeQueue('mongo-excel-backup');
export const institutionVerifyQueue = createSafeQueue<{ userId: string; token: string }>(
  'institution-verify',
);
