import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/admin.api';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { SCORE_BUCKETS } from '../../constants/score';

const scoreBuckets = SCORE_BUCKETS;

export default function Analytics() {
  const analyticsQuery = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: adminApi.getAnalytics,
    refetchInterval: 60_000,
  });

  const bucketData = useMemo(
    () =>
      scoreBuckets.map((bucket) => ({
        bucket,
        value: analyticsQuery.data?.scoreDistribution[bucket] ?? 0,
      })),
    [analyticsQuery.data],
  );

  const roleData = useMemo(
    () => Object.entries(analyticsQuery.data?.usersByRole ?? {}).map(([role, value]) => ({ role, value })),
    [analyticsQuery.data],
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Analytics</div>
        <h1 className="mt-2 text-3xl font-bold text-white">Platform analytics</h1>
        <p className="mt-2 text-slate-400">Score, deal, patent, and role distribution snapshots.</p>
      </div>

      {analyticsQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-6 xl:col-span-2">
            <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Investment Type Breakdown</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="text-sm text-slate-400">Penny Investments</div>
                <div className="mt-2 text-3xl font-bold text-white">
                  {analyticsQuery.data?.investmentTypeBreakdown.pennyCount ?? 0}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  ₹{analyticsQuery.data?.investmentTypeBreakdown.pennyCapitalDeployed ?? 0} deployed
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="text-sm text-slate-400">Sole Investments</div>
                <div className="mt-2 text-3xl font-bold text-white">
                  {analyticsQuery.data?.investmentTypeBreakdown.soleCount ?? 0}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  ₹{analyticsQuery.data?.investmentTypeBreakdown.soleCapitalDeployed ?? 0} deployed
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Score Distribution</div>
            <div className="space-y-4">
              {bucketData.map((bucket) => {
                const max = Math.max(...bucketData.map((item) => item.value), 1);
                return (
                  <div key={bucket.bucket} className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-slate-300">
                      <span>{bucket.bucket}</span>
                      <span>{bucket.value}</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-800">
                      <div
                        className="h-3 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                        style={{ width: `${(bucket.value / max) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Role Breakdown</div>
            <div className="flex flex-wrap gap-3">
              {roleData.map((entry) => (
                <Badge key={entry.role}>
                  {entry.role}: {entry.value}
                </Badge>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-center">
              <svg viewBox="0 0 120 120" className="h-56 w-56">
                <circle cx="60" cy="60" r="42" className="fill-none stroke-slate-800" strokeWidth="16" />
                {bucketData.map((bucket, index) => {
                  const total = bucketData.reduce((sum, item) => sum + item.value, 0) || 1;
                  const circumference = 2 * Math.PI * 42;
                  const offset = bucketData.slice(0, index).reduce((sum, item) => sum + item.value, 0);
                  return (
                    <circle
                      key={bucket.bucket}
                      cx="60"
                      cy="60"
                      r="42"
                      className="fill-none"
                      stroke={['#22d3ee', '#34d399', '#fbbf24', '#fb7185'][index]}
                      strokeWidth="16"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference - (bucket.value / total) * circumference}
                      transform="rotate(-90 60 60)"
                    />
                  );
                })}
              </svg>
            </div>
          </Card>

          <Card className="p-6 xl:col-span-2">
            <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Recent Admin Actions</div>
            <div className="space-y-3">
              {(analyticsQuery.data?.recentAdminActions ?? []).map((action) => (
                <div key={action._id} className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="font-semibold text-white">{action.action.replace(/_/g, ' ')}</div>
                    <div className="text-sm text-slate-400">{action.targetModel}</div>
                  </div>
                  <div className="text-sm text-slate-500">{new Date(action.createdAt).toLocaleString('en-IN')}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
