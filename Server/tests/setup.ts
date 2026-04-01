import { generateKeyPairSync } from 'crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.setTimeout(180_000);

const { privateKey: accessPrivateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const { privateKey: refreshPrivateKey } = generateKeyPairSync('rsa', {
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
process.env.AWS_REGION = 'ap-south-1';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.FROM_EMAIL = 'noreply@promovecyc.com';

type SetOptions = { ex?: number };

const redisStore = new Map<string, { value: string; expiresAt?: number }>();
const redisLists = new Map<string, string[]>();
const redisSortedSets = new Map<string, Map<string, number>>();
const redisSets = new Map<string, Set<string>>();
const rateState = new Map<string, { count: number; reset: number }>();

const getSortedSet = (key: string) => {
  const existing = redisSortedSets.get(key);
  if (existing) {
    return existing;
  }

  const created = new Map<string, number>();
  redisSortedSets.set(key, created);
  return created;
};

const sortedEntries = (key: string, direction: 'asc' | 'desc' = 'asc') => {
  const entries = Array.from((redisSortedSets.get(key) ?? new Map<string, number>()).entries()).sort(
    ([leftMember, leftScore], [rightMember, rightScore]) => {
      if (leftScore === rightScore) {
        return leftMember.localeCompare(rightMember);
      }

      return direction === 'asc' ? leftScore - rightScore : rightScore - leftScore;
    },
  );

  return entries;
};

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
        redisLists.delete(key);
        redisSortedSets.delete(key);
        redisSets.delete(key);
        return existed ? 1 : 0;
      },
      async zadd(key: string, ...members: Array<{ score: number; member: string }>) {
        const sortedSet = getSortedSet(key);
        members.forEach(({ score, member }) => {
          sortedSet.set(member, score);
        });
        return members.length;
      },
      async zcard(key: string) {
        return redisSortedSets.get(key)?.size ?? 0;
      },
      async zrank(key: string, member: string) {
        const rank = sortedEntries(key, 'asc').findIndex(([entryMember]) => entryMember === member);
        return rank === -1 ? null : rank;
      },
      async zrevrank(key: string, member: string) {
        const rank = sortedEntries(key, 'desc').findIndex(([entryMember]) => entryMember === member);
        return rank === -1 ? null : rank;
      },
      async zrange<T extends string[]>(
        key: string,
        start: number,
        stop: number,
        options?: { rev?: boolean },
      ) {
        const entries = sortedEntries(key, options?.rev ? 'desc' : 'asc');
        const normalizedStop = stop < 0 ? entries.length + stop : stop;
        return entries.slice(start, normalizedStop + 1).map(([member]) => member) as T;
      },
      async lpush(key: string, value: string) {
        const existing = redisLists.get(key) ?? [];
        redisLists.set(key, [value, ...existing]);
        return redisLists.get(key)?.length ?? 0;
      },
      async ltrim(key: string, start: number, stop: number) {
        const existing = redisLists.get(key) ?? [];
        const normalizedStop = stop < 0 ? existing.length + stop : stop;
        redisLists.set(key, existing.slice(start, normalizedStop + 1));
        return 'OK';
      },
      async lrange(key: string, start: number, stop: number) {
        const existing = redisLists.get(key) ?? [];
        const normalizedStop = stop < 0 ? existing.length + stop : stop;
        return existing.slice(start, normalizedStop + 1);
      },
      async expire() {
        return 1;
      },
      async sadd(key: string, ...members: string[]) {
        const current = redisSets.get(key) ?? new Set<string>();
        members.forEach((member) => current.add(member));
        redisSets.set(key, current);
        return current.size;
      },
      async srem(key: string, ...members: string[]) {
        const current = redisSets.get(key) ?? new Set<string>();
        members.forEach((member) => current.delete(member));
        redisSets.set(key, current);
        return current.size;
      },
      async smembers(key: string) {
        return Array.from(redisSets.get(key) ?? new Set<string>());
      },
      async scard(key: string) {
        return redisSets.get(key)?.size ?? 0;
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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const dropDatabaseWithRetry = async (attempts = 5) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await mongoose.connection.db?.dropDatabase();
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';

      if (!message.includes('currently being dropped') || attempt === attempts - 1) {
        throw error;
      }

      await wait(50 * (attempt + 1));
    }
  }
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
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
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoServer.stop();
});
