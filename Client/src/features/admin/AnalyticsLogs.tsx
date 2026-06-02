import { memo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type AdminAnalyticsLogEntry } from '../../api/admin.api';
import { adminApi } from '../../api/admin.api';
import { Spinner } from '../../components/ui/Spinner';
import { useAdminAnalyticsContext } from './Analytics';

const APP_LOG_INITIAL_LIMIT = 50;
const APP_LOG_INCREMENT = 50;

type AnalyticsLogView = 'admin' | 'application';

const AnalyticsLogConsole = memo(function AnalyticsLogConsole({
  adminLogs,
}: {
  adminLogs: Array<{
    _id: string;
    adminId: string;
    action: string;
    targetId: string;
    targetModel: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
  }>;
}) {
  const [logView, setLogView] = useState<AnalyticsLogView>('admin');
  const [logLimit, setLogLimit] = useState(APP_LOG_INITIAL_LIMIT);

  const applicationLogsQuery = useQuery({
    queryKey: ['admin-analytics-logs', logLimit],
    queryFn: () => adminApi.getAnalyticsLogs({ limit: logLimit, page: 1 }),
    enabled: logView === 'application',
    staleTime: 15_000,
    gcTime: 60_000,
    refetchInterval: logView === 'application' ? 30_000 : false,
    placeholderData: (previousData) => previousData,
  });

  const isLoading = applicationLogsQuery.isLoading && logLimit === APP_LOG_INITIAL_LIMIT;
  const response = applicationLogsQuery.data;
  const applicationLogs = response?.logs ?? [];
  const totalLogs = response?.total ?? 0;
  const hasMore = response ? logLimit < response.total : false;

  const handleLoadMore = useCallback(() => {
    setLogLimit((prev) => prev + APP_LOG_INCREMENT);
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      await adminApi.downloadLogs();
    } catch {
      // handled by interceptor
    }
  }, []);

  const handleTabChange = useCallback((key: AnalyticsLogView) => {
    setLogView(key);
    if (key === 'application') {
      setLogLimit(APP_LOG_INITIAL_LIMIT);
    }
  }, []);

  const activeLogs = logView === 'admin' ? adminLogs : applicationLogs;

  return (
    <section className="overflow-hidden border border-slate-800 bg-slate-950">
      <div className="border-b border-slate-800 px-6 py-5 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">Log Console</div>
            <p className="mt-2 text-sm text-slate-400">
              All app logs from start to present, browsable and downloadable.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {logView === 'application' && (
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 text-sm text-slate-400 transition hover:bg-slate-900 hover:text-white border border-slate-800"
              >
                Download All Logs
              </button>
            )}
            <div className="inline-flex w-full border border-slate-800 bg-slate-950 sm:w-auto">
              {([
                { key: 'admin', label: 'Admin Logs' },
                { key: 'application', label: 'App Logs' },
              ] as const).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handleTabChange(option.key)}
                  className={`px-4 py-2 text-sm transition ${
                    logView === option.key
                      ? 'bg-cyan-500/10 text-cyan-200'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : activeLogs.length === 0 ? (
        <div className="px-6 py-10 text-sm text-slate-400 lg:px-8">No log entries available.</div>
      ) : logView === 'admin' ? (
        <div>
          <div className="max-h-[65vh] overflow-y-auto">
            <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1.2fr)_160px_220px] border-b border-slate-800 bg-slate-950 px-6 py-3 text-[11px] uppercase tracking-[0.24em] text-slate-500 lg:px-8">
              <div>Action</div>
              <div>Target</div>
              <div>Timestamp</div>
            </div>
            <div className="divide-y divide-slate-800">
              {adminLogs.map((action) => (
                <div
                  key={action._id}
                  className="grid grid-cols-[minmax(0,1.2fr)_160px_220px] items-start px-6 py-4 text-sm transition hover:bg-slate-900 lg:px-8"
                >
                  <div className="font-medium uppercase tracking-[0.12em] text-white">
                    {action.action.replace(/_/g, ' ')}
                  </div>
                  <div className="text-slate-400">{action.targetModel}</div>
                  <div className="text-slate-500">{new Date(action.createdAt).toLocaleString('en-IN')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="max-h-[65vh] overflow-y-auto">
            <div className="sticky top-0 z-10 grid grid-cols-[120px_120px_minmax(0,1fr)_220px] border-b border-slate-800 bg-slate-950 px-6 py-3 text-[11px] uppercase tracking-[0.24em] text-slate-500 lg:px-8">
              <div>Level</div>
              <div>Source</div>
              <div>Message</div>
              <div>Timestamp</div>
            </div>
            <div className="divide-y divide-slate-800 font-mono text-[13px]">
              {applicationLogs.map((entry: AdminAnalyticsLogEntry) => (
                <div
                  key={entry._id}
                  className="grid grid-cols-[120px_120px_minmax(0,1fr)_220px] items-start px-6 py-4 transition hover:bg-slate-900 lg:px-8"
                >
                  <div className="text-cyan-300">{entry.level}</div>
                  <div className="uppercase text-slate-400">{entry.source}</div>
                  <div className="whitespace-pre-wrap break-words text-slate-200">{entry.message}</div>
                  <div className="text-slate-500">
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleString('en-IN') : 'Timestamp unavailable'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {hasMore && (
            <div className="border-t border-slate-800 px-6 py-4 text-center lg:px-8">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={applicationLogsQuery.isFetching}
                className="px-6 py-2 text-sm text-cyan-300 transition hover:bg-slate-900 border border-slate-800 disabled:opacity-40"
              >
                {applicationLogsQuery.isFetching ? 'Loading...' : `Load More (${totalLogs - logLimit} remaining)`}
              </button>
            </div>
          )}

          {totalLogs > 0 && (
            <div className="border-t border-slate-800 px-6 py-3 text-center text-[11px] uppercase tracking-[0.2em] text-slate-600">
              Showing {applicationLogs.length} of {totalLogs} log entries
            </div>
          )}
        </div>
      )}
    </section>
  );
});

export default function AnalyticsLogs() {
  const { analytics } = useAdminAnalyticsContext();

  return <AnalyticsLogConsole adminLogs={analytics.recentAdminActions} />;
}
