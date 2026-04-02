import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { adminApi, type AdminUserListItem } from '../../api/admin.api';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { AdminSectionTabs, getActiveAdminSection } from './AdminSectionTabs';
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
  const activeSection = getActiveAdminSection(location.pathname, ADMIN_USERS_SECTION_LINKS);

  const usersQuery = useQuery({
    queryKey: ['admin-users', 'workspace'],
    queryFn: () => adminApi.getUsers({ page: 1, limit: 100 }),
    refetchInterval: 60_000,
  });

  const users = usersQuery.data?.items ?? [];
  const pendingRequests = useMemo(
    () => users.filter((user) => user.adminApprovalStatus === 'pending' && user.role !== 'student').length,
    [users],
  );
  const activeUsers = useMemo(() => users.filter((user) => user.isActive).length, [users]);
  const inactiveUsers = users.length - activeUsers;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden border border-slate-800 bg-slate-950">
        <div className="border-b border-slate-800 px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">Admin Users</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{activeSection.label}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{activeSection.description}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[32rem]">
              <div className="border border-slate-800/80 bg-slate-950/80 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Tracked accounts</div>
                <div className="mt-2 text-sm font-medium text-white">{users.length}</div>
              </div>
              <div className="border border-slate-800/80 bg-slate-950/80 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Pending requests</div>
                <div className="mt-2 text-sm font-medium text-white">{pendingRequests}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="border border-slate-800/80 bg-slate-950/80 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Active</div>
                  <div className="mt-2 text-sm font-medium text-white">{activeUsers}</div>
                </div>
                <div className="border border-slate-800/80 bg-slate-950/80 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Inactive</div>
                  <div className="mt-2 text-sm font-medium text-white">{inactiveUsers}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <AdminSectionTabs links={ADMIN_USERS_SECTION_LINKS} />
      </section>

      {usersQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : usersQuery.isError ? (
        <Card className="border-dashed p-6 text-sm text-slate-400">
          User data is unavailable right now.
        </Card>
      ) : (
        <Outlet context={{ users, isLoading: usersQuery.isLoading }} />
      )}
    </div>
  );
}
