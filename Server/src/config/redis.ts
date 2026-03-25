import { Redis } from '@upstash/redis';
import { env } from './env';

export const redis = Redis.fromEnv({
  keepAlive: true,
  retry: {
    retries: env.REDIS_REQUEST_RETRIES,
    backoff: () => 50,
  },
  signal: () => AbortSignal.timeout(env.REDIS_REQUEST_TIMEOUT_MS),
});
