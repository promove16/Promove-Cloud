import mongoose from 'mongoose';
import multer from 'multer';
import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
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

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json(buildFailure(error.code, error.message, error.details));
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

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  ) {
    return res
      .status(409)
      .json(buildFailure('DUPLICATE_KEY', 'Email already registered'));
  }

  console.error(error);

  const message =
    env.NODE_ENV === 'production' ? 'Something went wrong' : 'Internal server error';

  return res.status(500).json(buildFailure('INTERNAL_SERVER_ERROR', message));
};
