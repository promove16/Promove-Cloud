import { useEffect } from 'react';
import { useSettings } from './useSettings';

/**
 * Hook for the app root — syncs compact-mode / reduce-motion DOM flags
 * whenever the user's saved appearance preference changes. The app is
 * dark-only; there is no theme to switch.
 */
export function useThemeInit(): void {
  const { settings } = useSettings();
  const appearance = settings?.appearance;

  useEffect(() => {
    document.documentElement.dataset.compactMode = appearance?.compactMode ? 'true' : 'false';
    document.documentElement.dataset.reduceMotion = appearance?.showAnimations === false ? 'true' : 'false';
  }, [appearance?.compactMode, appearance?.showAnimations]);
}
