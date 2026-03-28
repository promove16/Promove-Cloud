import { Redis } from '@upstash/redis';
import { env } from './env';

// Profile caching
// profile:{profileSlug}           Hash    TTL: 2 min    Public profile page data
// profile-views:{userId}          String  TTL: 24h      Profile view count (today)
//
// GitHub sync state
// github-sync:{userId}            String  TTL: 1h       Prevents double-sync requests
// github-data:{userId}            Hash    TTL: 30 min   Cached GitHub API response
//
// LinkedIn sync state
// linkedin-sync:{userId}          String  TTL: 1h       Prevents double-sync requests
//
// Team request counts
// team-requests:{userId}          String  TTL: 5 min    Unread team request count
export const redis = Redis.fromEnv({
  keepAlive: true,
  retry: {
    retries: env.REDIS_REQUEST_RETRIES,
    backoff: () => 50,
  },
  signal: () => AbortSignal.timeout(env.REDIS_REQUEST_TIMEOUT_MS),
});
