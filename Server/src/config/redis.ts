import IORedis from 'ioredis';
import { env } from './env';
import { hasRedisConnectionConfig, resolveRedisOptions } from './redisConnection';
import { shouldFailOpenForService } from './serviceAvailability';

type SetOptions = { ex?: number };
type ZMember = { score: number; member: string };

let clearMemoryRedisState = () => {};

export type RedisClient = {
  set: <T>(key: string, value: T, options?: SetOptions) => Promise<'OK'>;
  get: <T = string>(key: string) => Promise<T | null>;
  del: (...keys: string[]) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  incr: (key: string) => Promise<number>;
  ttl: (key: string) => Promise<number>;
  zadd: (key: string, ...members: ZMember[]) => Promise<number>;
  zcard: (key: string) => Promise<number>;
  zrank: (key: string, member: string) => Promise<number | null>;
  zrevrank: (key: string, member: string) => Promise<number | null>;
  zrange: <T = string[]>(key: string, start: number, stop: number, options?: { rev?: boolean }) => Promise<T>;
  lpush: (key: string, value: string) => Promise<number>;
  ltrim: (key: string, start: number, stop: number) => Promise<'OK'>;
  lrange: (key: string, start: number, stop: number) => Promise<string[]>;
  sadd: (key: string, ...members: string[]) => Promise<number>;
  srem: (key: string, ...members: string[]) => Promise<number>;
  smembers: (key: string) => Promise<string[]>;
  scard: (key: string) => Promise<number>;
  scan: (cursor: string | number, options?: { match?: string; count?: number }) => Promise<[string, string[]]>;
  ping: () => Promise<string>;
};

const encode = <T>(value: T) => (typeof value === 'string' ? value : JSON.stringify(value));

const decode = <T>(value: string | null): T | null => {
  if (value === null) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
};

const createIoredisClient = (): RedisClient => {
  const fallback = createMemoryRedisClient();
  const client = new IORedis(
    resolveRedisOptions({
      connectionName: 'promove:app',
    }),
  );

  client.on('error', () => {
    // Command callers handle and log Redis failures with request context.
  });

  let connectPromise: Promise<void> | null = null;

  const ensureConnected = async () => {
    if (client.status === 'ready') {
      return;
    }

    if (!connectPromise) {
      connectPromise = client.connect().finally(() => {
        connectPromise = null;
      });
    }

    await connectPromise;
  };

  const run = async <T>(operation: () => Promise<T>, fallbackOperation: () => Promise<T>) => {
    try {
      await ensureConnected();
      return await operation();
    } catch (error) {
      if (shouldFailOpenForService('redis')) {
        return fallbackOperation();
      }

      throw error;
    }
  };

  return {
    async set(key, value, options) {
      return run(async () => {
        if (options?.ex) {
          await client.set(key, encode(value), 'EX', options.ex);
          return 'OK' as const;
        }
        await client.set(key, encode(value));
        return 'OK' as const;
      }, () => fallback.set(key, value, options));
    },
    async get<T = string>(key: string) {
      return run(async () => decode<T>(await client.get(key)), () => fallback.get<T>(key));
    },
    async del(...keys) {
      if (keys.length === 0) return 0;
      return run(() => client.del(...keys), () => fallback.del(...keys));
    },
    expire: (key, seconds) => run(() => client.expire(key, seconds), () => fallback.expire(key, seconds)),
    incr: (key) => run(() => client.incr(key), () => fallback.incr(key)),
    ttl: (key) => run(() => client.ttl(key), () => fallback.ttl(key)),
    async zadd(key, ...members) {
      if (members.length === 0) return 0;
      const args = members.flatMap(({ score, member }) => [String(score), member]);
      return run(() => client.zadd(key, ...args), () => fallback.zadd(key, ...members));
    },
    zcard: (key) => run(() => client.zcard(key), () => fallback.zcard(key)),
    zrank: (key, member) => run(() => client.zrank(key, member), () => fallback.zrank(key, member)),
    zrevrank: (key, member) =>
      run(() => client.zrevrank(key, member), () => fallback.zrevrank(key, member)),
    async zrange<T = string[]>(key: string, start: number, stop: number, options?: { rev?: boolean }) {
      return run(async () => {
        const result = options?.rev
          ? await client.zrevrange(key, start, stop)
          : await client.zrange(key, start, stop);
        return result as T;
      }, () => fallback.zrange<T>(key, start, stop, options));
    },
    lpush: (key, value) => run(() => client.lpush(key, value), () => fallback.lpush(key, value)),
    async ltrim(key, start, stop) {
      return run(async () => {
        await client.ltrim(key, start, stop);
        return 'OK' as const;
      }, () => fallback.ltrim(key, start, stop));
    },
    lrange: (key, start, stop) =>
      run(() => client.lrange(key, start, stop), () => fallback.lrange(key, start, stop)),
    sadd: (key, ...members) => run(() => client.sadd(key, ...members), () => fallback.sadd(key, ...members)),
    srem: (key, ...members) => run(() => client.srem(key, ...members), () => fallback.srem(key, ...members)),
    smembers: (key) => run(() => client.smembers(key), () => fallback.smembers(key)),
    scard: (key) => run(() => client.scard(key), () => fallback.scard(key)),
    scan: async (cursor, options) => {
      const args: string[] = [];
      if (options?.match) args.push('MATCH', options.match);
      if (options?.count) args.push('COUNT', String(options.count));
      const scan = client.scan as unknown as (
        cursor: string,
        ...args: string[]
      ) => Promise<[string, string[]]>;
      return run(() => scan(String(cursor), ...args), () => fallback.scan(cursor, options));
    },
    ping: () => run(() => client.ping(), () => fallback.ping()),
  };
};

const createMemoryRedisClient = (): RedisClient => {
  const store = new Map<string, { value: string; expiresAt?: number }>();
  const lists = new Map<string, string[]>();
  const sortedSets = new Map<string, Map<string, number>>();
  const sets = new Map<string, Set<string>>();

  clearMemoryRedisState = () => {
    store.clear();
    lists.clear();
    sortedSets.clear();
    sets.clear();
  };

  const purgeExpired = (key: string) => {
    const item = store.get(key);
    if (item?.expiresAt && item.expiresAt <= Date.now()) {
      store.delete(key);
    }
  };

  const getSortedSet = (key: string) => {
    const existing = sortedSets.get(key);
    if (existing) return existing;
    const created = new Map<string, number>();
    sortedSets.set(key, created);
    return created;
  };

  const sortedEntries = (key: string, direction: 'asc' | 'desc' = 'asc') =>
    Array.from((sortedSets.get(key) ?? new Map<string, number>()).entries()).sort(
      ([leftMember, leftScore], [rightMember, rightScore]) => {
        if (leftScore === rightScore) return leftMember.localeCompare(rightMember);
        return direction === 'asc' ? leftScore - rightScore : rightScore - leftScore;
      },
    );

  return {
    async set(key, value, options) {
      store.set(key, {
        value: encode(value),
        expiresAt: options?.ex ? Date.now() + options.ex * 1000 : undefined,
      });
      return 'OK';
    },
    async get<T = string>(key: string) {
      purgeExpired(key);
      return decode<T>(store.get(key)?.value ?? null);
    },
    async del(...keys) {
      let deleted = 0;
      keys.forEach((key) => {
        if (store.delete(key)) deleted += 1;
        lists.delete(key);
        sortedSets.delete(key);
        sets.delete(key);
      });
      return deleted;
    },
    async expire(key, seconds) {
      const item = store.get(key);
      if (item) {
        item.expiresAt = Date.now() + seconds * 1000;
        return 1;
      }
      return lists.has(key) || sortedSets.has(key) || sets.has(key) ? 1 : 0;
    },
    async incr(key) {
      purgeExpired(key);
      const next = Number(store.get(key)?.value ?? '0') + 1;
      store.set(key, { value: String(next), expiresAt: store.get(key)?.expiresAt });
      return next;
    },
    async ttl(key) {
      purgeExpired(key);
      const expiresAt = store.get(key)?.expiresAt;
      if (!store.has(key)) return -2;
      if (!expiresAt) return -1;
      return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    },
    async zadd(key, ...members) {
      const sortedSet = getSortedSet(key);
      members.forEach(({ score, member }) => sortedSet.set(member, score));
      return members.length;
    },
    async zcard(key) {
      return sortedSets.get(key)?.size ?? 0;
    },
    async zrank(key, member) {
      const rank = sortedEntries(key, 'asc').findIndex(([entryMember]) => entryMember === member);
      return rank === -1 ? null : rank;
    },
    async zrevrank(key, member) {
      const rank = sortedEntries(key, 'desc').findIndex(([entryMember]) => entryMember === member);
      return rank === -1 ? null : rank;
    },
    async zrange<T = string[]>(key: string, start: number, stop: number, options?: { rev?: boolean }) {
      const entries = sortedEntries(key, options?.rev ? 'desc' : 'asc');
      const normalizedStop = stop < 0 ? entries.length + stop : stop;
      return entries.slice(start, normalizedStop + 1).map(([member]) => member) as T;
    },
    async lpush(key, value) {
      const existing = lists.get(key) ?? [];
      lists.set(key, [value, ...existing]);
      return lists.get(key)?.length ?? 0;
    },
    async ltrim(key, start, stop) {
      const existing = lists.get(key) ?? [];
      const normalizedStop = stop < 0 ? existing.length + stop : stop;
      lists.set(key, existing.slice(start, normalizedStop + 1));
      return 'OK';
    },
    async lrange(key, start, stop) {
      const existing = lists.get(key) ?? [];
      const normalizedStop = stop < 0 ? existing.length + stop : stop;
      return existing.slice(start, normalizedStop + 1);
    },
    async sadd(key, ...members) {
      const current = sets.get(key) ?? new Set<string>();
      members.forEach((member) => current.add(member));
      sets.set(key, current);
      return current.size;
    },
    async srem(key, ...members) {
      const current = sets.get(key) ?? new Set<string>();
      members.forEach((member) => current.delete(member));
      sets.set(key, current);
      return current.size;
    },
    async smembers(key) {
      return Array.from(sets.get(key) ?? new Set<string>());
    },
    async scard(key) {
      return sets.get(key)?.size ?? 0;
    },
    async scan(cursor, options) {
      const keys = Array.from(store.keys()).filter((key) => {
        if (!options?.match) return true;
        const pattern = new RegExp(`^${options.match.replace(/\*/g, '.*')}$`);
        return pattern.test(key);
      });
      return [String(cursor) === '0' ? '0' : '0', keys];
    },
    async ping() {
      return 'PONG';
    },
  };
};

// Tests and local development without a real Redis endpoint use the in-memory
// adapter so startup remains usable. Production still requires Redis via env.ts.
export const redis =
  env.NODE_ENV === 'test' || !hasRedisConnectionConfig()
    ? createMemoryRedisClient()
    : createIoredisClient();

export const clearRedisForTests = () => {
  if (env.NODE_ENV === 'test') {
    clearMemoryRedisState();
  }
};
