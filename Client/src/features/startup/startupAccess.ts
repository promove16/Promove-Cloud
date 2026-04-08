import type { Startup } from '../../types/startup.types';

export const isStartupFounder = (
  startup: Startup | undefined,
  userId: string | undefined,
) =>
  Boolean(
    userId && startup?.founderIds.some((founderId) => founderId === userId),
  );
