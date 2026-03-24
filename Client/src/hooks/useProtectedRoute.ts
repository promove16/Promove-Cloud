import { useAuthStore } from '../store/authStore';
import { UserRole } from '../types/roles.types';
import { roleRedirect } from '../utils/roleRedirect';

export const useProtectedRoute = (allowedRoles?: UserRole[]) => {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return { status: 'loading' as const };
  }

  if (!isAuthenticated || !user) {
    return { status: 'unauthorized' as const, redirectTo: '/login' };
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return { status: 'forbidden' as const, redirectTo: roleRedirect(user.role) };
  }

  return { status: 'authorized' as const };
};
