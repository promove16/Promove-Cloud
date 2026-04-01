import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { trackPageView } from '../lib/activityTracker';

export const useRouteActivityTracking = () => {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const previousPathRef = useRef<string>();

  useEffect(() => {
    if (!isAuthenticated) {
      previousPathRef.current = undefined;
      return;
    }

    trackPageView(location.pathname, previousPathRef.current);
    previousPathRef.current = location.pathname;
  }, [isAuthenticated, location.pathname]);
};
