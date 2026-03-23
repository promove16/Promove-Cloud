import { useSelector } from 'react-redux';
import PERMISSION_MAP from '../constants/permissions';
import {
  selectAccessToken,
  selectIsAuthenticated,
  selectIsLoading,
  selectUser,
} from '../features/auth/authSlice';

export default function useAuth() {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectIsLoading);
  const accessToken = useSelector(selectAccessToken);

  const hasPermission = (permissionString) => {
    if (!user?.role) {
      return false;
    }

    const permissions = PERMISSION_MAP[user.role] || [];
    return permissions.includes('*') || permissions.includes(permissionString);
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    accessToken,
    hasPermission,
  };
}
