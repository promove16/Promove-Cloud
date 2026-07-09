import { mkdirSync } from 'fs';
import path from 'path';
import winston from 'winston';

const logsDir = path.resolve(__dirname, '../../../logs');
const logFilePath = path.join(logsDir, 'app.log');

mkdirSync(logsDir, { recursive: true });

const serializeUnknown = (value: unknown) => {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const logFormat = winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
  const renderedMessage = stack ? `${message}\n${stack}` : message;
  const baseMessage = `${timestamp} [${level}] ${renderedMessage}`;

  const filteredMeta = Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value !== undefined),
  );

  if (Object.keys(filteredMeta).length === 0) {
    return baseMessage;
  }

  return `${baseMessage} ${JSON.stringify(filteredMeta)}`;
});

const shouldLogToConsole = process.env.LOG_TO_CONSOLE !== 'false' && process.env.NODE_ENV !== 'test';

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    logFormat,
  ),
  transports: [
    new winston.transports.File({
      filename: logFilePath,
    }),
    ...(shouldLogToConsole
      ? [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.timestamp({ format: 'HH:mm:ss' }),
              logFormat,
            ),
          }),
        ]
      : []),
  ],
  exitOnError: false,
});

export const httpLogStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export const logError = (message: string, error: unknown) => {
  if (error instanceof Error) {
    logger.error(message, { stack: error.stack ?? error.message });
    return;
  }

  logger.error(`${message} ${serializeUnknown(error)}`);
};

export const logFile = logFilePath;
