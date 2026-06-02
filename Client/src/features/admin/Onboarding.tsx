import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useLocation } from 'react-router-dom';
import { adminApi } from '../../api/admin.api';
import { AdminSectionTabs } from './AdminSectionTabs';
import { ADMIN_ONBOARDING_SECTION_LINKS } from './usersNavigation';
import type { AdminUsersOutletContext } from './UserManagement';
import { AdminPageHeader, type AdminHeaderStat } from './AdminPageHeader';

export default function Onboarding() {
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
        (user) => user.adminApprovalStatus === 'pending' && user.role !== 'student',
      ).length,
    [users],
  );
  const activeUsers = useMemo(() => users.filter((user) => user.isActive).length, [users]);
  const inactiveUsers = users.length - activeUsers;

  const context: AdminUsersOutletContext = { users, isLoading: usersQuery.isLoading };

  const stats: AdminHeaderStat[] = [
    { label: 'Accounts', value: users.length, accent: 'cyan' },
    { label: 'Pending', value: pendingRequests, accent: 'amber' },
    { label: 'Active', value: activeUsers, accent: 'emerald' },
    { label: 'Inactive', value: inactiveUsers, accent: 'rose' },
  ];

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Admin · Onboarding"
        title="User management"
        description="Approve registrations, manage roles, and inspect operator activity across the platform."
        stats={stats}
      >
        <AdminSectionTabs links={ADMIN_ONBOARDING_SECTION_LINKS} />
      </AdminPageHeader>

      <div key={location.pathname}>
        <Outlet context={context} />
      </div>
    </div>
  );
}
