import { ComponentType, lazy } from 'react';

/**
 * Resilient lazy loader wrapper that automatically catches dynamic import chunk errors
 * (e.g. after new deployments when old chunk hashes 404) and reloads the page once to fetch latest bundles.
 */
export function safeLazy<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T } | T>
) {
  return lazy(async () => {
    try {
      const module = await factory();
      return 'default' in module ? module : { default: module };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error ?? '');
      const isChunkError =
        errorMessage.includes('Failed to fetch dynamically imported module') ||
        errorMessage.includes('Importing a module script failed') ||
        errorMessage.includes('Loading chunk') ||
        (error instanceof Error && error.name === 'ChunkLoadError');

      if (isChunkError) {
        const reloadKey = 'chunk_reload_' + window.location.pathname;
        const hasReloaded = sessionStorage.getItem(reloadKey);
        if (!hasReloaded) {
          sessionStorage.setItem(reloadKey, 'true');
          window.location.reload();
          return new Promise(() => {});
        }
      }
      throw error;
    }
  });
}
