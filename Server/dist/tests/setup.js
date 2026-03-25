"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
const { privateKey: accessPrivateKey } = (0, crypto_1.generateKeyPairSync)('rsa', {
    modulusLength: 2048,
});
const { privateKey: refreshPrivateKey } = (0, crypto_1.generateKeyPairSync)('rsa', {
    modulusLength: 2048,
});
process.env.NODE_ENV = 'test';
process.env.PORT = '5000';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
process.env.UPSTASH_REDIS_HOST = 'example.upstash.io';
process.env.JWT_ACCESS_SECRET = accessPrivateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
process.env.JWT_REFRESH_SECRET = refreshPrivateKey
    .export({ type: 'pkcs8', format: 'pem' })
    .toString();
process.env.JWT_ACCESS_EXPIRES = '15m';
process.env.JWT_REFRESH_EXPIRES = '30d';
process.env.MAX_USERS_YEAR_ONE = '2000';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
process.env.AWS_REGION = 'ap-south-1';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.FROM_EMAIL = 'noreply@promovecyc.com';
const redisStore = new Map();
const rateState = new Map();
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
                return existed ? 1 : 0;
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
let connectDB;
let disconnectDB;
beforeAll(async () => {
    mongoServer = await mongodb_memory_server_1.MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    ({ connectDB, disconnectDB } = await Promise.resolve().then(() => __importStar(require('../src/config/db'))));
    await connectDB();
});
beforeEach(async () => {
    redisStore.clear();
    rateState.clear();
    await mongoose_1.default.connection.db?.dropDatabase();
});
afterAll(async () => {
    await disconnectDB();
    await mongoServer.stop();
});
