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
          <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-end 2xl:justify-between">
            <div className="min-w-0 max-w-4xl">
              <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">Admin Users</div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {activeSection.label}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{activeSection.description}</p>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 2xl:max-w-[34rem] 2xl:shrink-0">
              <div className="min-w-0 border border-slate-800 bg-slate-950 px-3 py-2.5">
                <div className="truncate text-[10px] uppercase tracking-[0.2em] text-slate-500">Tracked accounts</div>
                <div className="mt-2 text-sm font-medium text-white">{users.length}</div>
              </div>
              <div className="min-w-0 border border-slate-800 bg-slate-950 px-3 py-2.5">
                <div className="truncate text-[10px] uppercase tracking-[0.2em] text-slate-500">Pending requests</div>
                <div className="mt-2 text-sm font-medium text-white">{pendingRequests}</div>
              </div>
              <div className="min-w-0 border border-slate-800 bg-slate-950 px-3 py-2.5">
                <div className="truncate text-[10px] uppercase tracking-[0.2em] text-slate-500">Active</div>
                <div className="mt-2 text-sm font-medium text-white">{activeUsers}</div>
              </div>
              <div className="min-w-0 border border-slate-800 bg-slate-950 px-3 py-2.5">
                <div className="truncate text-[10px] uppercase tracking-[0.2em] text-slate-500">Inactive</div>
                <div className="mt-2 text-sm font-medium text-white">{inactiveUsers}</div>
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
        <div key={location.pathname}>
          <Outlet context={{ users, isLoading: usersQuery.isLoading }} />
        </div>
      )}
    </div>
  );
}
