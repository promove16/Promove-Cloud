import {
  TEMPORARY_MEMORY_CLEANUP_INTERVAL_MS,
} from '../modules/temporaryMemory/temporaryMemory.constants';
import { runTemporaryMemoryCleanupOnce } from '../services/temporaryMemoryCleanupService';

let cleanupTimer: NodeJS.Timeout | null = null;

export const startTemporaryMemoryCleanupJob = () => {
  if (cleanupTimer) {
    return cleanupTimer;
  }

  void runTemporaryMemoryCleanupOnce();
  cleanupTimer = setInterval(() => {
    void runTemporaryMemoryCleanupOnce();
  }, TEMPORARY_MEMORY_CLEANUP_INTERVAL_MS);

  cleanupTimer.unref?.();

  return cleanupTimer;
};
