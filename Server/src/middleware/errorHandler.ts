import mongoose from 'mongoose';
import multer from 'multer';
import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { getServiceUnavailableDetails } from '../config/serviceAvailability';
import { logError } from '../config/logger';
import { ApiFailure } from '../types/api.types';
import { ApiError } from '../utils/ApiError';

const buildFailure = (code: string, message: string, details?: unknown[]): ApiFailure => ({
  success: false,
  error: {
    code,
    message,
    ...(details ? { details } : {}),
  },
});

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ApiError) {
    const details =
      error.statusCode === 503 && !error.details
        ? getServiceUnavailableDetails('api', error.message)
        : error.details;
    return res.status(error.statusCode).json(buildFailure(error.code, error.message, details));
  }

  if (error instanceof ZodError) {
    return res
      .status(400)
      .json(
        buildFailure(
          'VALIDATION_ERROR',
          'Validation failed',
          error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        ),
      );
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return res.status(400).json(
      buildFailure(
        'VALIDATION_ERROR',
        'Validation failed',
        Object.values(error.errors).map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      ),
    );
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'File exceeds the 10MB size limit'
        : error.message;
    return res.status(400).json(buildFailure('UPLOAD_ERROR', message));
  }

  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
    return res.status(413).json(buildFailure('PAYLOAD_TOO_LARGE', 'Request body is too large'));
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  ) {
    const duplicateField =
      ('keyPattern' in error &&
      typeof error.keyPattern === 'object' &&
      error.keyPattern !== null &&
      Object.keys(error.keyPattern).length > 0
        ? Object.keys(error.keyPattern)[0]
        : undefined) ||
      ('keyValue' in error &&
      typeof error.keyValue === 'object' &&
      error.keyValue !== null &&
      Object.keys(error.keyValue).length > 0
        ? Object.keys(error.keyValue)[0]
        : undefined);

    if (duplicateField === 'email') {
      return res
        .status(409)
        .json(buildFailure('DUPLICATE_KEY', 'Email already registered'));
    }

    return res
      .status(409)
      .json(
        buildFailure(
          'DUPLICATE_KEY',
          duplicateField
            ? `Duplicate value for ${duplicateField}`
            : 'Duplicate value already exists',
        ),
      );
  }

  logError(`Unhandled application error on ${req.method} ${req.originalUrl}`, error);

  const message =
    env.NODE_ENV === 'production' ? 'Something went wrong' : 'Internal server error';

  return res.status(500).json(buildFailure('INTERNAL_SERVER_ERROR', message));
};
