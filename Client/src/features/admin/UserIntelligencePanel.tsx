import { memo, useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import {
  adminApi,
  type AdminAnalyticsData,
  type AdminUserActivityDetail,
  type UserActivitySummary,
} from '../../api/admin.api';
import { Spinner } from '../../components/ui/Spinner';

const numberFormatter = new Intl.NumberFormat('en-IN');

function UserDetailPanel({
  detail,
  isLoading,
}: {
  detail?: AdminUserActivityDetail;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!detail) {
    return <div className="px-6 py-10 text-sm text-slate-400 lg:px-8">Select a user to inspect activity.</div>;
  }

  const maxDailyValue = Math.max(
    ...detail.dailyUsage.map((day) => Math.max(day.pageViews, day.apiRequests, day.writeActions)),
    1,
  );

  return (
    <div className="space-y-6 px-6 py-6 lg:px-8">
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Total events', value: detail.summary.totalEvents },
          { label: 'Page views', value: detail.summary.pageViews },
          { label: 'API requests', value: detail.summary.apiRequests },
          { label: 'Write actions', value: detail.summary.writeActions },
        ].map((metric) => (
          <div key={metric.label} className="border border-slate-800 bg-slate-900 px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{metric.label}</div>
            <div className="mt-3 text-3xl font-semibold text-white">{numberFormatter.format(metric.value)}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-px bg-slate-800 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="bg-slate-950 px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-300">User snapshot</div>
              <div className="mt-3 text-2xl font-semibold text-white">{detail.summary.displayName}</div>
              <div className="mt-2 text-sm text-slate-400">{detail.summary.email}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">{detail.summary.role}</div>
            </div>
            <div className="text-right text-sm text-slate-400">
              <div>{detail.summary.activeDays} active day(s)</div>
              <div className="mt-2">
                {detail.summary.lastSeenAt ? `Last seen ${new Date(detail.summary.lastSeenAt).toLocaleString('en-IN')}` : 'No recent activity'}
              </div>
              <div className="mt-2">
                {detail.summary.trackedSince ? `Tracked since ${new Date(detail.summary.trackedSince).toLocaleDateString('en-IN')}` : 'Tracking started recently'}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Last 14 days</div>
            <div className="mt-4 grid grid-cols-7 gap-3 xl:grid-cols-14">
              {detail.dailyUsage.map((day) => (
                <div key={day.date} className="space-y-3">
                  <div className="flex h-24 items-end gap-1">
                    {[
                      { key: 'pageViews', value: day.pageViews, className: 'bg-emerald-400/90' },
                      { key: 'apiRequests', value: day.apiRequests, className: 'bg-blue-400/90' },
                      { key: 'writeActions', value: day.writeActions, className: 'bg-amber-400/90' },
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
          <div className="border-b border-slate-800 px-6 py-4 lg:px-8">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Recent activity</div>
          </div>
          {detail.recentActivity.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-400 lg:px-8">No user activity recorded yet.</div>
          ) : (
            <div className="divide-y divide-slate-800">
              {detail.recentActivity.slice(0, 10).map((entry) => (
                <div key={entry._id} className="px-6 py-4 lg:px-8">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">{entry.label}</div>
                      <div className="mt-1 truncate font-mono text-xs text-slate-500">{entry.path}</div>
                    </div>
                    <div className="text-right text-xs uppercase tracking-[0.18em] text-slate-500">
                      {entry.eventType.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                    {entry.method ? <span>{entry.method}</span> : null}
                    {entry.statusCode ? <span>Status {entry.statusCode}</span> : null}
                    {entry.durationMs !== undefined ? <span>{entry.durationMs} ms</span> : null}
                    <span>{new Date(entry.createdAt).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const UserIntelligencePanel = memo(function UserIntelligencePanel({
  analytics,
}: {
  analytics: AdminAnalyticsData;
}) {
  const [searchValue, setSearchValue] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(analytics.mostActiveUsers[0]?.userId);
  const deferredSearchValue = useDeferredValue(searchValue.trim());

  const usersQuery = useQuery({
    queryKey: ['admin-analytics-users', deferredSearchValue],
    queryFn: () =>
      adminApi.getAnalyticsUsers({
        ...(deferredSearchValue ? { q: deferredSearchValue } : {}),
        limit: 8,
      }),
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  });

  const directoryItems = usersQuery.data?.items ?? analytics.mostActiveUsers;

  useEffect(() => {
    if (!directoryItems.some((item) => item.userId === selectedUserId)) {
      setSelectedUserId(directoryItems[0]?.userId);
    }
  }, [directoryItems, selectedUserId]);

  const userDetailQuery = useQuery({
    queryKey: ['admin-analytics-user-detail', selectedUserId],
    queryFn: () => adminApi.getAnalyticsUserDetail(selectedUserId!),
    enabled: Boolean(selectedUserId),
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  });

  return (
    <section className="overflow-hidden border border-slate-800 bg-slate-950">
      <div className="grid gap-px bg-slate-800 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="bg-slate-950">
          <div className="border-b border-slate-800 px-6 py-5 lg:px-8">
            <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">User Intelligence</div>
            <p className="mt-2 text-sm text-slate-400">Search by user name or email to inspect usage, activity days, and recent platform behavior.</p>
          </div>

          <div className="border-b border-slate-800 px-6 py-5 lg:px-8">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search users by name or email"
                className="w-full border border-slate-800 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none transition focus:border-cyan-500/40"
              />
            </label>
          </div>

          <div className="divide-y divide-slate-800">
            {directoryItems.map((user: UserActivitySummary) => (
              <button
                key={user.userId}
                type="button"
                onClick={() => setSelectedUserId(user.userId)}
                className={`grid w-full grid-cols-[1fr_auto] gap-4 px-6 py-4 text-left transition lg:px-8 ${
                  selectedUserId === user.userId ? 'bg-cyan-500/10' : 'hover:bg-slate-900'
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{user.displayName}</div>
                  <div className="mt-1 truncate text-sm text-slate-400">{user.email}</div>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <span>{user.role}</span>
                    <span>{user.activeDays} active day(s)</span>
                    <span>{user.totalEvents} events</span>
                  </div>
                </div>
                <div className="text-right text-sm text-slate-400">
                  <div className="font-semibold text-white">{numberFormatter.format(user.totalEvents)}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleDateString('en-IN') : 'No activity'}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="border-t border-slate-800">
            <div className="border-b border-slate-800 px-6 py-4 lg:px-8">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Recent platform activity</div>
            </div>
            <div className="divide-y divide-slate-800">
              {analytics.recentUserActivity.slice(0, 6).map((entry) => (
                <div key={entry._id} className="px-6 py-4 lg:px-8">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">{entry.displayName}</div>
                      <div className="mt-1 truncate text-sm text-slate-400">{entry.label}</div>
                    </div>
                    <div className="text-right text-xs uppercase tracking-[0.18em] text-slate-500">
                      {entry.eventType.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div className="mt-2 truncate font-mono text-xs text-slate-500">{entry.path}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-950">
          <div className="border-b border-slate-800 px-6 py-5 lg:px-8">
            <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">Selected User Detail</div>
            <p className="mt-2 text-sm text-slate-400">Day-by-day usage and recent tracked events for the selected user.</p>
          </div>
          <UserDetailPanel detail={userDetailQuery.data} isLoading={userDetailQuery.isLoading && !userDetailQuery.data} />
        </div>
      </div>
    </section>
  );
});
