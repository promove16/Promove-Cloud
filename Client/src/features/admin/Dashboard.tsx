import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, CircleGauge, ShieldCheck, Trophy, Users, type LucideIcon } from 'lucide-react';
import { adminApi } from '../../api/admin.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { useNavigate } from 'react-router-dom';

const scoreBuckets = ['0-50', '51-100', '101-150', '151-200'] as const;

export default function Dashboard() {
  const navigate = useNavigate();
  const analyticsQuery = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: adminApi.getAnalytics,
    refetchInterval: 60_000,
  });
  const capacityQuery = useQuery({
    queryKey: ['admin-capacity'],
    queryFn: adminApi.getCapacity,
    refetchInterval: 60_000,
  });

  const kpis = useMemo<
    Array<{ label: string; value: number; icon: LucideIcon }>
  >(
    () => [
      { label: 'Total Users', value: analyticsQuery.data?.totalUsers ?? 0, icon: Users },
      { label: 'Active This Week', value: analyticsQuery.data?.activeThisWeek ?? 0, icon: ShieldCheck },
      { label: 'Total Deals', value: analyticsQuery.data?.totalDeals ?? 0, icon: BarChart3 },
      { label: 'Patents Pending', value: analyticsQuery.data?.patentsPending ?? 0, icon: Trophy },
      { label: 'Awards Pending', value: analyticsQuery.data?.awardsPending ?? 0, icon: Trophy },
    ],
    [analyticsQuery.data],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Admin Console</div>
          <h1 className="mt-2 text-3xl font-bold text-white">Platform control center</h1>
          <p className="mt-2 text-slate-400">Audit, verify, and monitor platform-wide innovation activity.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate('/dashboard/admin/patents')}>
            Review Patents ({analyticsQuery.data?.patentsPending ?? 0})
          </Button>
          <Button onClick={() => navigate('/dashboard/admin/users')}>Manage Users</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {kpis.map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
              <stat.icon className="h-5 w-5" />
            </div>
            <div className="text-3xl font-bold text-white">{stat.value}</div>
            <div className="mt-2 text-sm text-slate-400">{stat.label}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr,1fr]">
        <Card className="p-6">
          <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Score Distribution</div>
          {analyticsQuery.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-4">
              {scoreBuckets.map((bucket) => {
                const value = analyticsQuery.data?.scoreDistribution[bucket] ?? 0;
                const max = Math.max(...scoreBuckets.map((item) => analyticsQuery.data?.scoreDistribution[item] ?? 0), 1);
                return (
                  <div key={bucket} className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-slate-300">
                      <span>{bucket}</span>
                      <span>{value}</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-800">
                      <div className="h-3 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${(value / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Capacity</div>
            <div className="flex items-center gap-6">
              <div className="relative flex h-28 w-28 items-center justify-center">
                <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
                  <circle cx="50" cy="50" r="40" className="fill-none stroke-slate-800" strokeWidth="12" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="fill-none stroke-cyan-400"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - ((capacityQuery.data?.percentUsed ?? 0) / 100) * 251.2}
                  />
                </svg>
                <div className="absolute text-center">
                  <div className="text-2xl font-bold text-white">{capacityQuery.data?.percentUsed ?? 0}%</div>
                </div>
              </div>
              <div className="space-y-2 text-sm text-slate-300">
                <div>{capacityQuery.data?.current ?? 0} used</div>
                <div>{capacityQuery.data?.remainingSlots ?? 0} remaining</div>
                <div>Max {capacityQuery.data?.max ?? 0}</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Top Innovators</div>
            <div className="space-y-3">
              {(analyticsQuery.data?.topInnovators ?? []).map((user, index) => (
                <div key={user._id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                  <div>
                    <div className="font-semibold text-white">
                      {index + 1}. {user.displayName}
                    </div>
                    <div className="text-sm text-slate-400">{user.role}</div>
                  </div>
                  <Badge>{user.innovationScore}/200</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
