import { userApi } from '../api/user.api';
import { useAuthStore } from '../store/authStore';

const PAGE_VIEW_DEDUPE_MS = 1500;
const lastPageViewStorageKey = 'promove:last-page-view';

const hasActiveSession = () => {
  const state = useAuthStore.getState();
  return Boolean(state.isAuthenticated && state.accessToken);
};

const shouldSkipPageView = (path: string) => {
  try {
    const raw = sessionStorage.getItem(lastPageViewStorageKey);
    if (!raw) return false;

    const parsed = JSON.parse(raw) as { path?: string; timestamp?: number };
    if (parsed.path !== path) return false;
    if (typeof parsed.timestamp !== 'number') return false;
    return Date.now() - parsed.timestamp < PAGE_VIEW_DEDUPE_MS;
  } catch {
    return false;
  }
};

const markPageView = (path: string) => {
  try {
    sessionStorage.setItem(
      lastPageViewStorageKey,
      JSON.stringify({
        path,
        timestamp: Date.now(),
      }),
    );
  } catch {
    return;
  }
};

export const trackPageView = (path: string, referrerPath?: string) => {
  if (!hasActiveSession() || shouldSkipPageView(path)) {
    return;
  }

  markPageView(path);
  void userApi
    .trackActivity({
      eventType: 'page_view',
      path,
      ...(referrerPath ? { referrerPath } : {}),
    })
    .catch(() => undefined);
};

export const trackNavigationClick = (path: string, label: string) => {
  if (!hasActiveSession()) {
    return;
  }

  void userApi
    .trackActivity({
      eventType: 'navigation_click',
      path,
      label,
    })
    .catch(() => undefined);
};
