import { NextFunction, Request, Response } from 'express';
import { redis } from '../config/redis';
import { logError } from '../config/logger';
import { ApiError } from '../utils/ApiError';

const STORAGE_QUOTA_BYTES = 500 * 1024 * 1024; // 500 MB per user
const STORAGE_KEY_PREFIX = 'storage:bytes:';
const STORAGE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days (auto-cleanup)

const resolveKey = (req: Request): string | null => {
  if (req.user?._id) return `${STORAGE_KEY_PREFIX}${req.user._id}`;
  return null;
};

/**
 * Middleware that enforces a per-user storage quota.
 * Must be placed AFTER multer processes the file so req.file is available.
 * Tracks cumulative bytes uploaded per user in Redis.
 */
export const enforceStorageQuota =
  () => async (req: Request, _res: Response, next: NextFunction) => {
    const key = resolveKey(req);
    if (!key) return next();

    const fileSize = req.file?.size;
    if (!fileSize) return next();

    try {
      const currentBytes = parseInt((await redis.get(key)) ?? '0', 10);

      if (currentBytes + fileSize > STORAGE_QUOTA_BYTES) {
        const remainingMB = Math.max(0, (STORAGE_QUOTA_BYTES - currentBytes) / (1024 * 1024)).toFixed(1);
        const totalMB = (STORAGE_QUOTA_BYTES / (1024 * 1024)).toFixed(0);
        return next(
          new ApiError(
            413,
            'STORAGE_QUOTA_EXCEEDED',
            `Storage quota exceeded. You have ${remainingMB} MB remaining of ${totalMB} MB total.`,
          ),
        );
      }

      // Atomically increment and set TTL on first write
      const newBytes = await redis.incrby(key, fileSize);
      if (newBytes === fileSize) {
        await redis.expire(key, STORAGE_TTL_SECONDS);
      }

      return next();
    } catch (error) {
      // Fail-open: if Redis is unavailable, allow the upload but log the error
      logError('Storage quota check failed, allowing upload', error);
      return next();
    }
  };

/**
 * Get current storage usage for a user (bytes).
 */
export const getStorageUsage = async (userId: string): Promise<number> => {
  const key = `${STORAGE_KEY_PREFIX}${userId}`;
  const bytes = await redis.get(key);
  return parseInt(bytes ?? '0', 10);
};

/**
 * Deduct bytes from a user's storage quota (e.g., on file deletion).
 */
export const deductStorageUsage = async (userId: string, bytes: number): Promise<void> => {
  const key = `${STORAGE_KEY_PREFIX}${userId}`;
  await redis.decrby(key, Math.max(0, bytes));
};
