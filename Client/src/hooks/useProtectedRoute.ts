import { useAuthStore } from '../store/authStore';
import { UserRole } from '../types/roles.types';
import { roleRedirect } from '../utils/roleRedirect';
import { useLocation } from 'react-router-dom';
import { buildLoginRedirectPath } from '../utils/authRedirect';

export const useProtectedRoute = (allowedRoles?: UserRole[]) => {
  const location = useLocation();
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return { status: 'loading' as const };
  }

  if (!isAuthenticated || !user) {
    const nextPath = `${location.pathname}${location.search}${location.hash}`;

    return {
      status: 'unauthorized' as const,
      redirectTo: buildLoginRedirectPath({
        next: nextPath,
        intent: 'access_protected_page',
      }),
    };
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return { status: 'forbidden' as const, redirectTo: roleRedirect(user.role) };
  }

  return { status: 'authorized' as const };
};
