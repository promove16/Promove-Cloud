import mongoose from 'mongoose';
import winston from 'winston';
import { env } from './env';

const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack }) =>
      `${timestamp} [${level}] ${stack ?? message}`,
    ),
  ),
  transports: [new winston.transports.Console()],
});

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;
let listenersRegistered = false;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const registerConnectionListeners = () => {
  if (listenersRegistered) {
    return;
  }

  mongoose.connection.on('error', (error) => {
    logger.error(`MongoDB connection error: ${error.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  listenersRegistered = true;
};

export const connectDB = async () => {
  registerConnectionListeners();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      logger.info(`Connecting to MongoDB (attempt ${attempt}/${MAX_RETRIES})`);
      await mongoose.connect(env.MONGODB_URI);
      logger.info('MongoDB connected');
      return;
    } catch (error) {
      logger.error(
        `MongoDB connection attempt ${attempt} failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );

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
