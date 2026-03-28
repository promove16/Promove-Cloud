import mongoose from 'mongoose';
import { env } from './env';
import { logError, logger } from './logger';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;
let listenersRegistered = false;

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
