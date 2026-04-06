export type TemporaryMemoryMode = 'standard' | 'temporary';

export const TEMPORARY_MEMORY_RETENTION_HOURS = 48;

export const isTemporaryMemory = (memoryMode?: TemporaryMemoryMode | null) =>
  memoryMode === 'temporary';

export const getTemporaryMemorySummary = (memoryMode?: TemporaryMemoryMode | null) =>
  isTemporaryMemory(memoryMode)
    ? `Temporary memory: clears after ${TEMPORARY_MEMORY_RETENTION_HOURS} hours`
    : 'Standard memory: kept until you remove it';

export const formatTemporaryMemoryExpiry = (expiresAt?: string | null) => {
  if (!expiresAt) {
    return `Clears in ${TEMPORARY_MEMORY_RETENTION_HOURS}h`;
  }

  return `Clears ${new Date(expiresAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};
