"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
jest.setTimeout(180_000);
const { privateKey: accessPrivateKey } = (0, crypto_1.generateKeyPairSync)('rsa', {
    modulusLength: 2048,
});
const { privateKey: refreshPrivateKey } = (0, crypto_1.generateKeyPairSync)('rsa', {
    modulusLength: 2048,
});
process.env.NODE_ENV = 'test';
process.env.PORT = '5000';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.RATE_LIMIT_ENABLED = 'true';
process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
process.env.UPSTASH_REDIS_HOST = 'example.upstash.io';
process.env.JWT_ACCESS_SECRET = accessPrivateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
process.env.JWT_REFRESH_SECRET = refreshPrivateKey
    .export({ type: 'pkcs8', format: 'pem' })
    .toString();
process.env.JWT_ACCESS_EXPIRES = '15m';
process.env.JWT_REFRESH_EXPIRES = '30d';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
process.env.GITHUB_CLIENT_ID = 'github-client-id';
process.env.GITHUB_CLIENT_SECRET = 'github-client-secret';
process.env.GITHUB_OAUTH_CALLBACK_URL = 'http://localhost:5000/api/users/github/callback';
process.env.AWS_REGION = 'ap-south-1';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.FROM_EMAIL = 'noreply@promovecyc.com';
const redisStore = new Map();
const redisLists = new Map();
const redisSortedSets = new Map();
const redisSets = new Map();
const rateState = new Map();
const getSortedSet = (key) => {
    const existing = redisSortedSets.get(key);
    if (existing) {
        return existing;
    }
    const created = new Map();
    redisSortedSets.set(key, created);
    return created;
};
const sortedEntries = (key, direction = 'asc') => {
    const entries = Array.from((redisSortedSets.get(key) ?? new Map()).entries()).sort(([leftMember, leftScore], [rightMember, rightScore]) => {
        if (leftScore === rightScore) {
            return leftMember.localeCompare(rightMember);
        }
        return direction === 'asc' ? leftScore - rightScore : rightScore - leftScore;
    });
    return entries;
};
const parseWindow = (value) => {
    const match = /^(\d+)([mh])$/.exec(value);
    if (!match) {
        return 60_000;
    }
    const amount = Number(match[1]);
    return match[2] === 'h' ? amount * 60 * 60 * 1000 : amount * 60 * 1000;
};
jest.mock('@upstash/redis', () => ({
    Redis: {
        fromEnv: () => ({
            async set(key, value, options) {
                redisStore.set(key, {
                    value,
                    expiresAt: options?.ex ? Date.now() + options.ex * 1000 : undefined,
                });
                return 'OK';
            },
            async get(key) {
                const item = redisStore.get(key);
                if (!item) {
                    return null;
                }
                if (item.expiresAt && item.expiresAt <= Date.now()) {
                    redisStore.delete(key);
                    return null;
                }
                return item.value;
            },
            async del(key) {
                const existed = redisStore.delete(key);
                redisLists.delete(key);
                redisSortedSets.delete(key);
                redisSets.delete(key);
                return existed ? 1 : 0;
            },
            async zadd(key, ...members) {
                const sortedSet = getSortedSet(key);
                members.forEach(({ score, member }) => {
                    sortedSet.set(member, score);
                });
                return members.length;
            },
            async zcard(key) {
                return redisSortedSets.get(key)?.size ?? 0;
            },
            async zrank(key, member) {
                const rank = sortedEntries(key, 'asc').findIndex(([entryMember]) => entryMember === member);
                return rank === -1 ? null : rank;
            },
            async zrevrank(key, member) {
                const rank = sortedEntries(key, 'desc').findIndex(([entryMember]) => entryMember === member);
                return rank === -1 ? null : rank;
            },
            async zrange(key, start, stop, options) {
                const entries = sortedEntries(key, options?.rev ? 'desc' : 'asc');
                const normalizedStop = stop < 0 ? entries.length + stop : stop;
                return entries.slice(start, normalizedStop + 1).map(([member]) => member);
            },
            async lpush(key, value) {
                const existing = redisLists.get(key) ?? [];
                redisLists.set(key, [value, ...existing]);
                return redisLists.get(key)?.length ?? 0;
            },
            async ltrim(key, start, stop) {
                const existing = redisLists.get(key) ?? [];
                const normalizedStop = stop < 0 ? existing.length + stop : stop;
                redisLists.set(key, existing.slice(start, normalizedStop + 1));
                return 'OK';
            },
            async lrange(key, start, stop) {
                const existing = redisLists.get(key) ?? [];
                const normalizedStop = stop < 0 ? existing.length + stop : stop;
                return existing.slice(start, normalizedStop + 1);
            },
            async expire() {
                return 1;
            },
            async sadd(key, ...members) {
                const current = redisSets.get(key) ?? new Set();
                members.forEach((member) => current.add(member));
                redisSets.set(key, current);
                return current.size;
            },
            async srem(key, ...members) {
                const current = redisSets.get(key) ?? new Set();
                members.forEach((member) => current.delete(member));
                redisSets.set(key, current);
                return current.size;
            },
            async smembers(key) {
                return Array.from(redisSets.get(key) ?? new Set());
            },
            async scard(key) {
                return redisSets.get(key)?.size ?? 0;
            },
        }),
    },
}));
jest.mock('@upstash/ratelimit', () => {
    class MockRatelimit {
        limitCount;
        windowMs;
        prefix;
        constructor(config) {
            this.limitCount = config.limiter.tokens;
            this.windowMs = config.limiter.windowMs;
            this.prefix = config.prefix;
        }
        static fixedWindow(tokens, window) {
            return { tokens, windowMs: parseWindow(window) };
        }
        static slidingWindow(tokens, window) {
            return { tokens, windowMs: parseWindow(window) };
        }
        async limit(identifier) {
            const key = `${this.prefix}:${identifier}`;
            const now = Date.now();
            const current = rateState.get(key);
            if (!current || current.reset <= now) {
                const reset = now + this.windowMs;
                rateState.set(key, { count: 1, reset });
                return {
                    success: true,
                    limit: this.limitCount,
                    remaining: this.limitCount - 1,
                    reset,
                };
            }
            current.count += 1;
            rateState.set(key, current);
            return {
                success: current.count <= this.limitCount,
                limit: this.limitCount,
                remaining: Math.max(this.limitCount - current.count, 0),
                reset: current.reset,
            };
        }
    }
    return { Ratelimit: MockRatelimit };
});
let mongoServer;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const dropDatabaseWithRetry = async (attempts = 5) => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            await mongoose_1.default.connection.db?.dropDatabase();
            return;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : '';
            if (!message.includes('currently being dropped') || attempt === attempts - 1) {
                throw error;
            }
            await wait(50 * (attempt + 1));
        }
    }
};
beforeAll(async () => {
    mongoServer = await mongodb_memory_server_1.MongoMemoryServer.create();
    await mongoose_1.default.connect(mongoServer.getUri());
});
beforeEach(async () => {
    redisStore.clear();
    redisLists.clear();
    redisSortedSets.clear();
    redisSets.clear();
    rateState.clear();
    await dropDatabaseWithRetry();
});
afterAll(async () => {
    if (mongoose_1.default.connection.readyState !== 0) {
        await mongoose_1.default.disconnect();
    }
    await mongoServer.stop();
});
