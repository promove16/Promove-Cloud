import { useEffect } from 'react';
import { useSettings } from './useSettings';

export type AppTheme = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'promove-theme';

/** Apply a theme to the document root immediately (synchronous, safe to call outside React). */
export function applyTheme(theme: AppTheme): void {
  const root = document.documentElement;
  localStorage.setItem(STORAGE_KEY, theme);

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
    root.classList.toggle('light', !prefersDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
  }
}

/** Read the stored theme preference (for pre-React initialization). */
export function getStoredTheme(): AppTheme {
  return (localStorage.getItem(STORAGE_KEY) as AppTheme | null) ?? 'dark';
}

/**
 * Hook for the app root — syncs the DOM theme class whenever the user's
 * saved appearance preference changes. Also reacts to system preference
 * changes when theme === 'system'.
 */
export function useThemeInit(): void {
  const { settings } = useSettings();
  const theme = settings?.appearance?.theme ?? getStoredTheme();

  useEffect(() => {
    applyTheme(theme as AppTheme);

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);
}
