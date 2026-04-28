import { RedisOptions } from 'ioredis';
import { env } from './env';

const parseRedisUrl = (url: string): Partial<RedisOptions> => {
  const parsed = new URL(url);
  const isTls = parsed.protocol === 'rediss:';

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    tls: isTls ? {} : undefined,
  };
};

export const resolveRedisOptions = (overrides: RedisOptions = {}): RedisOptions => {
  const base = env.REDIS_URL
    ? parseRedisUrl(env.REDIS_URL)
    : env.UPSTASH_REDIS_HOST
      ? {
          host: env.UPSTASH_REDIS_HOST,
          port: env.UPSTASH_REDIS_PORT ?? 6379,
          password: env.UPSTASH_REDIS_PASSWORD,
          tls: env.UPSTASH_REDIS_TLS ? {} : undefined,
        }
    : {
        host: env.AWS_REDIS_HOST,
        port: env.AWS_REDIS_PORT ?? 6379,
        password: env.AWS_REDIS_AUTH_TOKEN,
        tls: env.AWS_REDIS_HOST && env.AWS_REDIS_TLS ? {} : undefined,
      };

  return {
    ...base,
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: env.REDIS_REQUEST_TIMEOUT_MS,
    commandTimeout: env.REDIS_REQUEST_TIMEOUT_MS,
    retryStrategy: (times) =>
      times <= env.REDIS_REQUEST_RETRIES
        ? Math.min(100 * times, env.REDIS_REQUEST_TIMEOUT_MS)
        : null,
    maxRetriesPerRequest: env.REDIS_REQUEST_RETRIES,
    ...overrides,
  };
};

export const hasRedisConnectionConfig = () =>
  Boolean(
    env.REDIS_URL ||
      env.UPSTASH_REDIS_HOST ||
      (env.AWS_REDIS_HOST && !env.AWS_REDIS_HOST.includes('your-elasticache-primary-endpoint')),
  );
