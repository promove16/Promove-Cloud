import { memo, useMemo } from 'react';
import { Activity, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { type AdminAnalyticsData } from '../../api/admin.api';

const numberFormatter = new Intl.NumberFormat('en-IN');

const insightToneClasses = {
  info: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-100',
  warning: 'border-amber-500/20 bg-amber-500/10 text-amber-100',
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100',
} as const;

function ActivityRouteList({
  routes,
}: {
  routes: AdminAnalyticsData['topRoutes'];
}) {
  if (routes.length === 0) {
    return <div className="px-6 py-10 text-sm text-slate-400 lg:px-8">No tracked routes yet.</div>;
  }

  return (
    <div className="divide-y divide-slate-800">
      {routes.map((route) => (
        <div key={`${route.eventType}-${route.path}-${route.label}`} className="grid grid-cols-[minmax(0,1fr)_100px_100px] gap-4 px-6 py-4 lg:px-8">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white">{route.label}</div>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500">
              <span>{route.eventType.replace(/_/g, ' ')}</span>
              <span>{route.feature}</span>
            </div>
            <div className="mt-2 truncate font-mono text-xs text-slate-400">{route.path}</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-white">{numberFormatter.format(route.count)}</div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">events</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-white">{numberFormatter.format(route.uniqueUsers)}</div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">users</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export const UsagePulsePanel = memo(function UsagePulsePanel({
  analytics,
}: {
  analytics: AdminAnalyticsData;
}) {
  const usageMetrics = useMemo(
    () => [
      {
        label: 'Tracked events',
        value: analytics.usageSummary.trackedEventsLast7Days,
        detail: `${analytics.usageSummary.avgEventsPerActiveUser} avg per active user`,
        icon: TrendingUp,
      },
      {
        label: 'Active users',
        value: analytics.usageSummary.activeUsersLast7Days,
        detail: 'Tracked in the last 7 days',
        icon: Users,
      },
      {
        label: 'Page views',
        value: analytics.usageSummary.pageViewsLast7Days,
        detail: 'Client-side route visits',
        icon: Activity,
      },
      {
        label: 'Write actions',
        value: analytics.usageSummary.writeActionsLast7Days,
        detail: `${analytics.usageSummary.apiRequestsLast7Days} API requests`,
        icon: ShieldCheck,
      },
    ],
    [analytics],
  );

  const maxDailyValue = Math.max(
    ...analytics.dailyUsage.map((day) => Math.max(day.pageViews, day.apiRequests, day.activeUsers)),
    1,
  );

  return (
    <section className="overflow-hidden border border-slate-800 bg-slate-950">
      <div className="grid gap-px bg-slate-800 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="bg-slate-950">
          <div className="border-b border-slate-800 px-6 py-5 lg:px-8">
            <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">Usage Pulse</div>
            <p className="mt-2 text-sm text-slate-400">Tracked behavior by authenticated usage, page navigation, and write intensity.</p>
          </div>

          <div className="grid gap-px bg-slate-800 md:grid-cols-2">
            {usageMetrics.map((metric) => (
              <div key={metric.label} className="bg-slate-950 px-6 py-5 lg:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{metric.label}</div>
                    <div className="mt-3 text-3xl font-semibold text-white">{numberFormatter.format(metric.value)}</div>
                    <div className="mt-2 text-sm text-slate-400">{metric.detail}</div>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                    <metric.icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-800 px-6 py-6 lg:px-8">
            <div className="mb-5">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Daily activity</div>
              <div className="mt-2 text-sm text-slate-400">Last 14 days of active users, page views, and API traffic.</div>
            </div>

            <div className="grid grid-cols-7 gap-3 xl:grid-cols-14">
              {analytics.dailyUsage.map((day) => (
                <div key={day.date} className="space-y-3">
                  <div className="flex h-28 items-end gap-1">
                    {[
                      { key: 'activeUsers', value: day.activeUsers, className: 'bg-cyan-400/90' },
                      { key: 'pageViews', value: day.pageViews, className: 'bg-emerald-400/90' },
                      { key: 'apiRequests', value: day.apiRequests, className: 'bg-blue-400/90' },
                    ].map((entry) => (
                      <div
                        key={entry.key}
                        className={`w-full ${entry.className}`}
                        style={{ height: `${Math.max((entry.value / maxDailyValue) * 100, entry.value > 0 ? 8 : 0)}%` }}
                        title={`${entry.key}: ${entry.value}`}
                      />
                    ))}
                  </div>
                  <div className="text-center text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    {new Date(day.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-950">
          <div className="border-b border-slate-800 px-6 py-5 lg:px-8">
            <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">Insights & Routes</div>
            <p className="mt-2 text-sm text-slate-400">Practical signals from recent platform behavior.</p>
          </div>

          <div className="space-y-4 px-6 py-6 lg:px-8">
            {analytics.insights.map((insight) => (
              <div key={insight.title} className={`border px-4 py-4 ${insightToneClasses[insight.tone]}`}>
                <div className="text-sm font-semibold text-white">{insight.title}</div>
                <div className="mt-2 text-sm leading-6">{insight.description}</div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-800">
            <div className="border-b border-slate-800 px-6 py-4 lg:px-8">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Top routes</div>
            </div>
            <ActivityRouteList routes={analytics.topRoutes} />
          </div>
        </div>
      </div>
    </section>
  );
});
