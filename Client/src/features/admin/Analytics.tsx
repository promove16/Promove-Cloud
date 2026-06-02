import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { adminApi, type AdminAnalyticsData } from '../../api/admin.api';
import { getOptionTabClassName, getOptionTabsListClassName } from '../../components/ui/OptionTabs';
import { Spinner } from '../../components/ui/Spinner';
import { ADMIN_ANALYTICS_SECTION_LINKS } from './analyticsNavigation';
import { AdminPageHeader } from './AdminPageHeader';

export interface AdminAnalyticsOutletContext {
  analytics: AdminAnalyticsData;
  onRoleSelect: (role: string) => void;
}

export function useAdminAnalyticsContext() {
  return useOutletContext<AdminAnalyticsOutletContext>();
}

export default function Analytics() {
  const location = useLocation();
  const navigate = useNavigate();
  const analyticsQuery = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: adminApi.getAnalytics,
    refetchInterval: 60_000,
    staleTime: 60_000,
  });

  const activeSection =
    ADMIN_ANALYTICS_SECTION_LINKS.find(
      (section) => location.pathname === section.path || location.pathname.startsWith(`${section.path}/`),
    ) ?? ADMIN_ANALYTICS_SECTION_LINKS[0];

  const handleRoleSelect = useCallback(
    (role: string) => {
      navigate(`/dashboard/admin/onboarding/directory?role=${encodeURIComponent(role)}`);
    },
    [navigate],
  );

  const analytics = analyticsQuery.data;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Admin Analytics"
        title={activeSection.label}
        description={activeSection.description}
        stats={
          analytics
            ? [
                { label: 'Total Users', value: analytics.totalUsers, accent: 'cyan' },
                { label: 'Active This Week', value: analytics.activeThisWeek, accent: 'emerald' },
                { label: 'Deal Completion', value: `${analytics.dealConversionRate}%`, accent: 'violet' },
                { label: 'Total Deals', value: analytics.totalDeals, accent: 'amber' },
              ]
            : undefined
        }
      >
        <div className="overflow-x-auto">
          <div className={getOptionTabsListClassName()}>
            {ADMIN_ANALYTICS_SECTION_LINKS.map((section) => {
              const isActive = location.pathname === section.path || location.pathname.startsWith(`${section.path}/`);
              const Icon = section.icon;

              return (
                <NavLink
                  key={section.path}
                  to={section.path}
                  className={getOptionTabClassName({ active: isActive })}
                >
                  <span className={isActive ? 'text-cyan-300' : 'text-slate-500 group-hover:text-slate-300'}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>{section.shortLabel}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </AdminPageHeader>

      {analyticsQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : analyticsQuery.data ? (
        <Outlet context={{ analytics: analyticsQuery.data, onRoleSelect: handleRoleSelect }} />
      ) : (
        <div className="border border-dashed border-slate-800 bg-slate-950 px-6 py-10 text-sm text-slate-400">
          Analytics data is unavailable right now.
        </div>
      )}
    </div>
  );
}
