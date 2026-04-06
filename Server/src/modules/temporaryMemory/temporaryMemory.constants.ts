export type TemporaryMemoryMode = 'standard' | 'temporary';

export const DEFAULT_TEMPORARY_MEMORY_MODE: TemporaryMemoryMode = 'standard';
export const TEMPORARY_MEMORY_RETENTION_HOURS = 48;
export const TEMPORARY_MEMORY_RETENTION_MS = TEMPORARY_MEMORY_RETENTION_HOURS * 60 * 60 * 1000;
export const TEMPORARY_MEMORY_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export const isTemporaryMemoryMode = (value: unknown): value is TemporaryMemoryMode =>
  value === 'standard' || value === 'temporary';

export const normalizeTemporaryMemoryMode = (value: unknown): TemporaryMemoryMode =>
  value === 'temporary' ? 'temporary' : DEFAULT_TEMPORARY_MEMORY_MODE;

export const getTemporaryMemoryExpiry = (now = new Date()) =>
  new Date(now.getTime() + TEMPORARY_MEMORY_RETENTION_MS);

export const buildTemporaryMemoryMetadata = (value: unknown) => {
  const memoryMode = normalizeTemporaryMemoryMode(value);

  if (memoryMode === 'temporary') {
    return {
      memoryMode,
      expiresAt: getTemporaryMemoryExpiry(),
    };
  }

  return {
    memoryMode,
    expiresAt: undefined,
  };
};

export const isTemporaryMemoryExpired = (
  value:
    | {
        memoryMode?: string | null;
        expiresAt?: Date | string | null;
      }
    | null
    | undefined,
  now = Date.now(),
) => {
  if (!value || value.memoryMode !== 'temporary' || !value.expiresAt) {
    return false;
  }

  return new Date(value.expiresAt).getTime() <= now;
};
