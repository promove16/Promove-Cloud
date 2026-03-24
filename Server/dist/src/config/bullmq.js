"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationQueue = exports.scoreQueue = exports.bullmqConnection = void 0;
const bullmq_1 = require("bullmq");
const env_1 = require("./env");
exports.bullmqConnection = {
    host: env_1.env.UPSTASH_REDIS_HOST,
    port: 6379,
    password: env_1.env.UPSTASH_REDIS_REST_TOKEN,
    tls: {},
};
const createTestQueue = () => ({
    add: async () => ({ id: 'test-job' }),
});
exports.scoreQueue = env_1.env.NODE_ENV === 'test'
    ? createTestQueue()
    : new bullmq_1.Queue('score-recalc', { connection: exports.bullmqConnection });
exports.notificationQueue = env_1.env.NODE_ENV === 'test'
    ? createTestQueue()
    : new bullmq_1.Queue('notifications', { connection: exports.bullmqConnection });
