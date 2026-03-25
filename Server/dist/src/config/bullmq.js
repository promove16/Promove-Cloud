"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationQueue = exports.scoreQueue = exports.bullmqConnection = void 0;
const bullmq_1 = require("bullmq");
const env_1 = require("./env");
const connection = {
    host: env_1.env.UPSTASH_REDIS_HOST,
    port: 6379,
    password: env_1.env.UPSTASH_REDIS_REST_TOKEN,
    tls: {},
};
exports.bullmqConnection = connection;
const createMockQueue = () => ({
    add: async () => ({ id: 'mock-job' }),
});
exports.scoreQueue = env_1.env.NODE_ENV === 'test' ? createMockQueue() : new bullmq_1.Queue('score-recalc', { connection });
exports.notificationQueue = env_1.env.NODE_ENV === 'test' ? createMockQueue() : new bullmq_1.Queue('notifications', { connection });
