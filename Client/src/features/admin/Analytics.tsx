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
    <div className="space-y-6">
      <section className="overflow-hidden border border-slate-800 bg-slate-950">
        <div className="border-b border-slate-800 px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">Admin Analytics</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{activeSection.label}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{activeSection.description}</p>
            </div>

            {analyticsQuery.data ? (
              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[30rem]">
                <div className="border border-slate-800 bg-slate-950 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Platform users</div>
                  <div className="mt-2 text-sm font-medium text-white">{analyticsQuery.data.totalUsers}</div>
                </div>
                <div className="border border-slate-800 bg-slate-950 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Active this week</div>
                  <div className="mt-2 text-sm font-medium text-white">{analyticsQuery.data.activeThisWeek}</div>
                </div>
                <div className="border border-slate-800 bg-slate-950 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Deal completion</div>
                  <div className="mt-2 text-sm font-medium text-white">{analyticsQuery.data.dealConversionRate}%</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto px-6 py-3 lg:px-8">
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
