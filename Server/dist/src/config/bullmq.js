"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.institutionVerifyQueue = exports.activityQueue = exports.emailQueue = exports.notificationQueue = exports.scoreQueue = exports.createQueueWorker = exports.bullmqConnection = exports.hasBullMqRedisConnection = void 0;
const bullmq_1 = require("bullmq");
const env_1 = require("./env");
const logger_1 = require("./logger");
exports.hasBullMqRedisConnection = Boolean(env_1.env.UPSTASH_REDIS_PASSWORD);
const baseConnection = {
    host: env_1.env.UPSTASH_REDIS_HOST,
    port: 6379,
    password: env_1.env.UPSTASH_REDIS_PASSWORD ?? env_1.env.UPSTASH_REDIS_REST_TOKEN,
    tls: {},
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: env_1.env.BULLMQ_CONNECT_TIMEOUT_MS,
};
const connection = {
    ...baseConnection,
    maxRetriesPerRequest: 1,
    commandTimeout: env_1.env.BULLMQ_COMMAND_TIMEOUT_MS,
};
exports.bullmqConnection = connection;
const workerConnection = {
    ...baseConnection,
    maxRetriesPerRequest: null,
};
const createMockQueue = () => ({
    add: async () => ({ id: 'mock-job' }),
});
const localProcessors = new Map();
const localFailedHandlers = new Map();
const getBackoffDelay = (opts, attempt = 1) => {
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
const emitLocalFailure = (queueName, job, error) => {
    const handlers = localFailedHandlers.get(queueName) ?? [];
    handlers.forEach((handler) => handler(job, error));
};
const createLocalWorker = (queueName, processor) => {
    localProcessors.set(queueName, async (job, opts) => {
        const attempts = Math.max(opts?.attempts ?? 1, 1);
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
            try {
                await processor(job);
                return;
            }
            catch (error) {
                const normalizedError = error instanceof Error ? error : new Error(String(error));
                if (attempt === attempts) {
                    emitLocalFailure(queueName, job, normalizedError);
                    throw normalizedError;
                }
                const delay = getBackoffDelay(opts, attempt);
                if (delay > 0) {
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }
    });
    const worker = {
        on: (event, handler) => {
            if (event === 'failed') {
                const existingHandlers = localFailedHandlers.get(queueName) ?? [];
                existingHandlers.push(handler);
                localFailedHandlers.set(queueName, existingHandlers);
            }
            return worker;
        },
    };
    return worker;
};
const createSafeQueue = (queueName) => {
    if (env_1.env.NODE_ENV === 'test') {
        return createMockQueue();
    }
    if (!exports.hasBullMqRedisConnection) {
        return {
            add: async (jobName, data, opts) => {
                const id = `${queueName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                const processor = localProcessors.get(queueName);
                if (!processor) {
                    logger_1.logger.warn(`No local queue processor registered for "${queueName}". Skipping job "${jobName}".`);
                    return { id };
                }
                void Promise.resolve().then(async () => {
                    try {
                        await processor({ id, name: jobName, data }, opts);
                    }
                    catch (error) {
                        (0, logger_1.logError)(`Local queue "${queueName}" job "${jobName}" failed`, error);
                    }
                });
                return { id };
            },
        };
    }
    const queue = new bullmq_1.Queue(queueName, { connection });
    queue.on('error', (error) => {
        (0, logger_1.logError)(`BullMQ queue "${queueName}" connection error`, error);
    });
    return {
        add: async (jobName, data, opts) => {
            try {
                return await queue.add(jobName, data, opts);
            }
            catch (error) {
                (0, logger_1.logError)(`BullMQ queue "${queueName}" add failed for job "${jobName}"`, error);
                return { id: `skipped-${queueName}-${Date.now()}` };
            }
        },
    };
};
const createQueueWorker = (queueName, processor, options) => {
    if (env_1.env.NODE_ENV === 'test') {
        const worker = {
            on: () => worker,
        };
        return worker;
    }
    if (!exports.hasBullMqRedisConnection) {
        return createLocalWorker(queueName, processor);
    }
    const worker = new bullmq_1.Worker(queueName, async (job) => processor({ id: job.id, name: job.name, data: job.data }), {
        ...options,
        connection: workerConnection,
    });
    worker.on('error', (error) => {
        (0, logger_1.logError)(`BullMQ worker "${queueName}" error`, error);
    });
    return worker;
};
exports.createQueueWorker = createQueueWorker;
exports.scoreQueue = createSafeQueue('score-recalc');
exports.notificationQueue = createSafeQueue('notifications');
exports.emailQueue = createSafeQueue('emails');
exports.activityQueue = createSafeQueue('activity');
exports.institutionVerifyQueue = createSafeQueue('institution-verify');
