import { Server } from 'socket.io';
import IORedis from 'ioredis';
import { logError } from './logger';
import { hasRedisConnectionConfig, resolveRedisOptions } from './redisConnection';

/**
 * Cross-process notification fanout.
 *
 * Notifications created by the BullMQ worker run in a separate process that has
 * no connected Socket.IO clients (the API process owns them). To deliver
 * realtime `notification:new` events regardless of which process created the
 * notification, the creating process publishes the serialized notification to a
 * Redis channel and every API replica subscribes and broadcasts it to the
 * recipient's room.
 *
 * In single-process (RUN_WORKERS_INLINE) / no-Redis deployments the in-process
 * socket emit inside `fanoutNotification` is sufficient; the Redis publish is a
 * best-effort no-op when Redis is not configured.
 */

const FANOUT_CHANNEL = 'promove:notification-fanout';

const EMIT_DEDUPE_TTL_MS = 60_000;

// Short-lived set of notification ids already broadcast by this process so a
// self-published message is not emitted twice (emit + subscriber echo).
const recentlyEmitted = new Map<string, number>();

export const markNotificationEmitted = (id: string) => {
  recentlyEmitted.set(id, Date.now());
};

export const wasNotificationEmitted = (id: string): boolean => {
  const at = recentlyEmitted.get(id);
  if (at === undefined) {
    return false;
  }
  if (Date.now() - at > EMIT_DEDUPE_TTL_MS) {
    recentlyEmitted.delete(id);
    return false;
  }
  return true;
};

// Periodic cleanup to prevent unbounded growth of the dedup map.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, at] of recentlyEmitted) {
    if (now - at > EMIT_DEDUPE_TTL_MS) {
      recentlyEmitted.delete(id);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

let publishClient: IORedis | null = null;

const getPublishClient = (): IORedis | null => {
  if (!hasRedisConnectionConfig()) {
    return null;
  }
  if (!publishClient) {
    publishClient = new IORedis(
      resolveRedisOptions({
        connectionName: 'promove:notif-fanout-pub',
        maxRetriesPerRequest: 1,
      }),
    );
    publishClient.on('error', (error) => {
      logError('Notification fanout publish client error', error);
    });
  }
  return publishClient;
};

export const publishNotificationFanout = (notification: Record<string, unknown>) => {
  try {
    const client = getPublishClient();
    if (!client) {
      return;
    }
    const payload = JSON.stringify({ notification });
    void client.publish(FANOUT_CHANNEL, payload).catch((error) => {
      logError('Failed to publish notification fanout', error);
    });
  } catch (error) {
    logError('Failed to publish notification fanout', error);
  }
};

let subscriptionStarted = false;

export const ensureNotificationFanoutSubscription = (server: Server) => {
  if (subscriptionStarted || !hasRedisConnectionConfig()) {
    return;
  }
  subscriptionStarted = true;

  const subClient = new IORedis(
    resolveRedisOptions({
      connectionName: 'promove:notif-fanout-sub',
      maxRetriesPerRequest: null,
    }),
  );
  subClient.on('error', (error) => {
    logError('Notification fanout subscriber error', error);
  });

  const start = async () => {
    try {
      await subClient.connect();
      await subClient.subscribe(FANOUT_CHANNEL);
    } catch (error) {
      logError('Failed to start notification fanout subscriber', error);
    }
  };
  void start();

  subClient.on('message', (_channel, message) => {
    try {
      const { notification } = JSON.parse(message) as {
        notification: { _id: unknown; userId: string };
      };
      if (!notification?._id || !notification?.userId) {
        return;
      }
      const id = String(notification._id);
      if (wasNotificationEmitted(id)) {
        return;
      }
      markNotificationEmitted(id);
      server.of('/notifications').to(`user:${String(notification.userId)}`).emit('notification:new', notification);
    } catch (error) {
      logError('Failed to handle notification fanout message', error);
    }
  });
};
