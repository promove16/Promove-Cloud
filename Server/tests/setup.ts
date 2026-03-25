import { generateKeyPairSync } from 'crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const { privateKey: accessPrivateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const { privateKey: refreshPrivateKey } = generateKeyPairSync('rsa', {
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

type SetOptions = { ex?: number };

const redisStore = new Map<string, { value: string; expiresAt?: number }>();
const rateState = new Map<string, { count: number; reset: number }>();

const parseWindow = (value: string) => {
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
      async set(key: string, value: string, options?: SetOptions) {
        redisStore.set(key, {
          value,
          expiresAt: options?.ex ? Date.now() + options.ex * 1000 : undefined,
        });
        return 'OK';
      },
      async get<T extends string>(key: string) {
        const item = redisStore.get(key);

        if (!item) {
          return null as T | null;
        }

        if (item.expiresAt && item.expiresAt <= Date.now()) {
          redisStore.delete(key);
          return null as T | null;
        }

        return item.value as T;
      },
      async del(key: string) {
        const existed = redisStore.delete(key);
        return existed ? 1 : 0;
      },
    }),
  },
}));

jest.mock('@upstash/ratelimit', () => {
  class MockRatelimit {
    private readonly limitCount: number;
    private readonly windowMs: number;
    private readonly prefix: string;

    constructor(config: { limiter: { tokens: number; windowMs: number }; prefix: string }) {
      this.limitCount = config.limiter.tokens;
      this.windowMs = config.limiter.windowMs;
      this.prefix = config.prefix;
    }

    static fixedWindow(tokens: number, window: string) {
      return { tokens, windowMs: parseWindow(window) };
    }

    static slidingWindow(tokens: number, window: string) {
      return { tokens, windowMs: parseWindow(window) };
    }

    async limit(identifier: string) {
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

let mongoServer: MongoMemoryServer;
let connectDB: typeof import('../src/config/db').connectDB;
let disconnectDB: typeof import('../src/config/db').disconnectDB;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  ({ connectDB, disconnectDB } = await import('../src/config/db'));
  await connectDB();
});

beforeEach(async () => {
  redisStore.clear();
  rateState.clear();
  await mongoose.connection.db?.dropDatabase();
});

afterAll(async () => {
  await disconnectDB();
  await mongoServer.stop();
});
