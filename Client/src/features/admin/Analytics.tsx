import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { adminApi, type AdminAnalyticsData } from '../../api/admin.api';
import { getOptionTabClassName, getOptionTabsListClassName } from '../../components/ui/OptionTabs';
import { Spinner } from '../../components/ui/Spinner';
import { ADMIN_ANALYTICS_SECTION_LINKS } from './analyticsNavigation';

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
      navigate(`/dashboard/admin/users/directory?role=${encodeURIComponent(role)}`);
    },
    [navigate],
  );

  return (
    <div className="space-y-8">
      <section className="border-b border-slate-800/80 pb-3">
        <div className="px-1 pb-6">
          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr),auto] 2xl:items-end">
            <div className="min-w-0 max-w-3xl">
              <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">Admin Analytics</div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{activeSection.label}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{activeSection.description}</p>
            </div>

            {analyticsQuery.data ? (
              <div className="text-sm text-slate-400">
                <span className="font-medium text-slate-100">{analyticsQuery.data.totalUsers}</span> users
                <span className="mx-2 text-slate-700">/</span>
                <span className="font-medium text-slate-100">{analyticsQuery.data.activeThisWeek}</span> active this week
                <span className="mx-2 text-slate-700">/</span>
                <span className="font-medium text-slate-100">{analyticsQuery.data.dealConversionRate}%</span> deal completion
              </div>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto px-1">
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
      </section>

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
