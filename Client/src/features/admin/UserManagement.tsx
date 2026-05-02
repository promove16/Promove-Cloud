import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { adminApi, type AdminUserListItem } from '../../api/admin.api';
import { Spinner } from '../../components/ui/Spinner';
import { AdminSectionTabs } from './AdminSectionTabs';
import { ADMIN_USERS_SECTION_LINKS } from './usersNavigation';

export interface AdminUsersOutletContext {
  users: AdminUserListItem[];
  isLoading: boolean;
}

export function useAdminUsersContext() {
  return useOutletContext<AdminUsersOutletContext>();
}

export default function UserManagement() {
  const location = useLocation();

  const usersQuery = useQuery({
    queryKey: ['admin-users', 'workspace'],
    queryFn: () => adminApi.getUsers({ page: 1, limit: 100 }),
    refetchInterval: 60_000,
  });

  const users = usersQuery.data?.items ?? [];
  const pendingRequests = useMemo(
    () =>
      users.filter(
        (user) =>
          user.adminApprovalStatus === 'pending' && user.role !== 'student',
      ).length,
    [users],
  );
  const activeUsers = useMemo(
    () => users.filter((user) => user.isActive).length,
    [users],
  );
  const inactiveUsers = users.length - activeUsers;

  return (
    <div className="space-y-8">
      <section className="border-b border-slate-800/80 pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <AdminSectionTabs links={ADMIN_USERS_SECTION_LINKS} />

          <div className="shrink-0 px-1 pb-2 text-sm text-slate-400">
            <span className="font-medium text-slate-100">{users.length}</span>{' '}
            accounts
            <span className="mx-2 text-slate-700">/</span>
            <span className="font-medium text-slate-100">
              {pendingRequests}
            </span>{' '}
            pending
            <span className="mx-2 text-slate-700">/</span>
            <span className="font-medium text-slate-100">
              {activeUsers}
            </span>{' '}
            active
            {inactiveUsers > 0 ? (
              <>
                <span className="mx-2 text-slate-700">/</span>
                <span className="font-medium text-slate-100">
                  {inactiveUsers}
                </span>{' '}
                inactive
              </>
            ) : null}
          </div>
        </div>
      </section>

      {usersQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : usersQuery.isError ? (
        <div className="py-10 text-sm text-slate-400">
          User data is unavailable right now.
        </div>
      ) : (
        <div key={location.pathname}>
          <Outlet context={{ users, isLoading: usersQuery.isLoading }} />
        </div>
      )}
    </div>
  );
}
