import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import IORedis, { RedisOptions } from 'ioredis';
import { env } from './env';
import { logError, logger } from './logger';
import { hasRedisConnectionConfig, resolveRedisOptions } from './redisConnection';
import { initScoreSocket } from '../sockets/scoreSocket';
import { initChatSocket } from '../sockets/chatSocket';
import { initNotificationSocket } from '../sockets/notificationSocket';
import { initMentorSocket } from '../sockets/mentorSocket';
import { initDmSocket } from '../sockets/dmSocket';
import { initBidSocket } from '../sockets/bidSocket';
import { socketConnections } from '../middleware/metrics';
import { ensureNotificationFanoutSubscription } from './notificationFanout';

let warnedAboutMissingSocketServer = false;

const createNoopSocketServer = () =>
  ({
    of: () => ({
      to: () => ({
        emit: () => {
          if (!warnedAboutMissingSocketServer) {
            warnedAboutMissingSocketServer = true;
            logger.warn(
              'Socket.IO emit skipped because this process did not initialize a Socket.IO server.',
            );
          }
          return false;
        },
      }),
      emit: () => {
        if (!warnedAboutMissingSocketServer) {
          warnedAboutMissingSocketServer = true;
          logger.warn(
            'Socket.IO emit skipped because this process did not initialize a Socket.IO server.',
          );
        }
        return false;
      },
    }),
  }) as unknown as SocketServer;

export let io: SocketServer = createNoopSocketServer();

const NAMESPACES_TO_INSTRUMENT = ['/', '/score', '/chat', '/notifications', '/mentor', '/dm', '/bids'];

const attachConnectionMetrics = (server: SocketServer) => {
  for (const ns of NAMESPACES_TO_INSTRUMENT) {
    const namespace = server.of(ns);
    namespace.on('connection', (socket) => {
      socketConnections.inc({ namespace: ns });
      socket.on('disconnect', () => {
        socketConnections.dec({ namespace: ns });
      });
    });
  }
};

/**
 * Wires the Socket.IO Redis adapter so room broadcasts work across multiple API
 * replicas. Requires two dedicated ioredis connections (pub + sub). If Redis is
 * unavailable, falls back to single-node memory and logs the degradation.
 */
const attachRedisAdapter = async (server: SocketServer) => {
  if (env.NODE_ENV === 'test') return;
  if (!hasRedisConnectionConfig()) {
    logger.warn(
      'Socket.IO Redis adapter not attached: Redis connection config missing. ' +
        'Single-node mode only - broadcasts will not cross replicas.',
    );
    return;
  }

  const redisOpts: RedisOptions = resolveRedisOptions({
    connectionName: 'promove:socket',
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  let pubClient: IORedis | null = null;
  let subClient: IORedis | null = null;

  try {
    pubClient = new IORedis(redisOpts);
    subClient = pubClient.duplicate();

    pubClient.on('error', (err) => logError('socket.io pub client error', err));
    subClient.on('error', (err) => logError('socket.io sub client error', err));
    pubClient.on('end', () => logger.warn('Socket.IO Redis pub client disconnected.'));
    subClient.on('end', () => logger.warn('Socket.IO Redis sub client disconnected.'));

    await pubClient.connect();
    await subClient.connect();
    await Promise.all([pubClient.ping(), subClient.ping()]);

    server.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO Redis adapter attached.');
  } catch (error) {
    logError('Failed to attach Socket.IO Redis adapter; running single-node', error);
    pubClient?.disconnect();
    subClient?.disconnect();
  }
};

export const initSocket = async (httpServer: HttpServer): Promise<SocketServer> => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: env.ALLOWED_ORIGINS,
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 30000,
  });

  await attachRedisAdapter(io);
  attachConnectionMetrics(io);
  ensureNotificationFanoutSubscription(io);

  initScoreSocket(io);
  initChatSocket(io);
  initNotificationSocket(io);
  initMentorSocket(io);
  initDmSocket(io);
  initBidSocket(io);

  return io;
};
