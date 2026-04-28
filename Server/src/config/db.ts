import mongoose from 'mongoose';
import dns from 'dns';
import { env } from './env';
import { logError, logger } from './logger';
import { slowQueryPlugin } from '../utils/slowQueryLogger';

// Register plugins BEFORE any model is compiled so every schema picks them up.
mongoose.plugin(slowQueryPlugin);

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;
let listenersRegistered = false;
let dnsResolversConfigured = false;

/**
 * Mongo connection options tuned for production traffic at ~10k users.
 *
 * - maxPoolSize bounded so a single replica cannot exhaust the cluster.
 * - serverSelectionTimeoutMS short enough that a dead primary fails fast and
 *   backpressure middleware can shed requests instead of hanging.
 * - socketTimeoutMS long enough to cover slow-but-legitimate queries.
 */
const mongoConnectOptions: mongoose.ConnectOptions = {
  maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 50,
  minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE) || 5,
  serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 5000,
  socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS) || 30000,
  connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS) || 10000,
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const registerConnectionListeners = () => {
  if (listenersRegistered) {
    return;
  }

  mongoose.connection.on('error', (error) => {
    logError('MongoDB connection error', error);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });

  listenersRegistered = true;
};

const configureDnsResolvers = () => {
  if (dnsResolversConfigured || !env.DNS_RESOLVERS) {
    return;
  }

  const resolvers = env.DNS_RESOLVERS.split(',')
    .map((resolver) => resolver.trim())
    .filter(Boolean);

  if (resolvers.length === 0) {
    return;
  }

  dns.setServers(resolvers);
  dnsResolversConfigured = true;
  logger.info(`Using custom DNS resolvers for MongoDB lookups: ${resolvers.join(', ')}`);
};

export const connectDB = async () => {
  registerConnectionListeners();
  configureDnsResolvers();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      logger.info(`Connecting to MongoDB (attempt ${attempt}/${MAX_RETRIES})`);
      await mongoose.connect(env.MONGODB_URI, mongoConnectOptions);
      logger.info(
        `MongoDB connected (poolSize=${mongoConnectOptions.maxPoolSize}, ` +
          `serverSelectionTimeoutMS=${mongoConnectOptions.serverSelectionTimeoutMS})`,
      );
      return;
    } catch (error) {
      logError(`MongoDB connection attempt ${attempt} failed`, error);

      if (attempt === MAX_RETRIES) {
        throw error;
      }

      await delay(RETRY_DELAY_MS);
    }
  }
};

export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};
