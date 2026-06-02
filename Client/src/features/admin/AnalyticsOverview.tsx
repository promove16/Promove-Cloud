import { memo, useMemo } from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Coins,
  FileClock,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { type AdminAnalyticsData } from '../../api/admin.api';
import { useAdminAnalyticsContext } from './Analytics';

const scoreBuckets = ['0-50', '51-100', '101-150', '151-200'] as const;
const roleColors = ['bg-cyan-400', 'bg-emerald-400', 'bg-amber-400', 'bg-pink-400', 'bg-blue-400', 'bg-violet-400', 'bg-slate-400'];

const numberFormatter = new Intl.NumberFormat('en-IN');
const currencyFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
});

const AnalyticsOverviewPanel = memo(function AnalyticsOverviewPanel({
  analytics,
  onRoleSelect,
}: {
  analytics: AdminAnalyticsData;
  onRoleSelect: (role: string) => void;
}) {
  const overviewMetrics = useMemo(
    () => [
      {
        label: 'Platform users',
        value: analytics.totalUsers,
        detail: `${analytics.activeThisWeek} active this week`,
        icon: Users,
      },
      {
        label: 'Deal volume',
        value: analytics.totalDeals,
        detail: `${analytics.dealConversionRate}% converted to stage 4`,
        icon: BarChart3,
      },
      {
        label: 'Pending patents',
        value: analytics.patentsPending,
        detail: `${analytics.totalPatents} total patent records`,
        icon: FileClock,
      },
      {
        label: 'Awards queue',
        value: analytics.awardsPending,
        detail: 'Admin review backlog',
        icon: ShieldCheck,
      },
    ],
    [analytics],
  );

  const bucketData = useMemo(
    () =>
      scoreBuckets.map((bucket) => ({
        bucket,
        value: analytics.scoreDistribution[bucket] ?? 0,
      })),
    [analytics],
  );

  const roleData = useMemo(
    () =>
      Object.entries(analytics.usersByRole)
        .map(([role, value], index) => ({
          role,
          value,
          color: roleColors[index % roleColors.length],
        }))
        .sort((left, right) => right.value - left.value),
    [analytics],
  );

  const stageData = useMemo(
    () => [
      { label: 'Stage 1', value: analytics.dealsByStage['1'] ?? 0 },
      { label: 'Stage 2', value: analytics.dealsByStage['2'] ?? 0 },
      { label: 'Stage 3', value: analytics.dealsByStage['3'] ?? 0 },
      { label: 'Stage 4', value: analytics.dealsByStage['4'] ?? 0 },
    ],
    [analytics],
  );

  const totalRoleUsers = roleData.reduce((sum, entry) => sum + entry.value, 0) || 1;
  const maxScoreBucket = Math.max(...bucketData.map((item) => item.value), 1);
  const maxStageValue = Math.max(...stageData.map((item) => item.value), 1);
  const pennyCapital = analytics.investmentTypeBreakdown.pennyCapitalDeployed ?? 0;
  const soleCapital = analytics.investmentTypeBreakdown.soleCapitalDeployed ?? 0;
  const totalCapital = pennyCapital + soleCapital || 1;
  const topBucket = bucketData.reduce((best, current) => (current.value > best.value ? current : best), bucketData[0]);

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden border border-slate-800 bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_38%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),transparent_28%)]" />
        <div className="relative border-b border-slate-800 px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">Admin Analytics</div>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight text-white">Operational overview</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                Live distribution, pipeline health, capital movement, and review activity across the platform.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[30rem]">
              <div className="border border-slate-800 bg-slate-950 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Refresh</div>
                <div className="mt-2 text-sm font-medium text-white">60 second polling</div>
              </div>
              <div className="border border-slate-800 bg-slate-950 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Log feeds</div>
                <div className="mt-2 text-sm font-medium text-white">App logs load on demand</div>
              </div>
              <div className="border border-slate-800 bg-slate-950 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Top signal</div>
                <div className="mt-2 text-sm font-medium text-white">{analytics.dealConversionRate}% deal completion</div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative grid gap-px bg-slate-800 md:grid-cols-2 xl:grid-cols-4">
          {overviewMetrics.map((metric) => (
            <div key={metric.label} className="bg-slate-950 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{metric.label}</div>
                  <div className="mt-3 text-4xl font-semibold text-white">{numberFormatter.format(metric.value)}</div>
                  <div className="mt-2 text-sm text-slate-400">{metric.detail}</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                  <metric.icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </header>

      <section className="overflow-hidden border border-slate-800 bg-slate-950">
        <div className="grid gap-px bg-slate-800 xl:grid-cols-[1.35fr_0.95fr]">
          <div className="bg-slate-950">
            <div className="border-b border-slate-800 px-6 py-5 lg:px-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">Score Distribution</div>
                  <p className="mt-2 text-sm text-slate-400">Innovation score coverage by current user inventory.</p>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Top bucket</div>
                  <div className="mt-2 text-lg font-medium text-white">{topBucket.bucket}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-px bg-slate-800 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-5 bg-slate-950 px-6 py-6 lg:px-8">
                {bucketData.map((bucket) => (
                  <div key={bucket.bucket} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-200">{bucket.bucket}</span>
                      <span className="text-slate-400">{numberFormatter.format(bucket.value)} users</span>
                    </div>
                    <div className="h-2.5 overflow-hidden bg-slate-900">
                      <div
                        className="h-full bg-[linear-gradient(90deg,rgba(59,130,246,0.95),rgba(16,185,129,0.85))] transition-all duration-500"
                        style={{ width: `${(bucket.value / maxScoreBucket) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-slate-950 px-6 py-6">
                <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Pipeline by stage</div>
                <div className="mt-5 space-y-4">
                  {stageData.map((stage) => (
                    <div key={stage.label}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-slate-300">{stage.label}</span>
                        <span className="text-white">{numberFormatter.format(stage.value)}</span>
                      </div>
                      <div className="h-9 overflow-hidden border border-slate-800 bg-slate-900">
                        <div
                          className="flex h-full items-center justify-end bg-gradient-to-r from-sky-500/80 to-cyan-400/80 px-3 text-xs font-semibold text-slate-950"
                          style={{ width: `${(stage.value / maxStageValue) * 100}%` }}
                        >
                          {stage.value > 0 ? `${Math.round((stage.value / Math.max(analytics.totalDeals, 1)) * 100)}%` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-950">
            <div className="border-b border-slate-800 px-6 py-5 lg:px-8">
              <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">Role Mix</div>
              <p className="mt-2 text-sm text-slate-400">Current user allocation across every platform role.</p>
            </div>

            <div className="px-6 py-6 lg:px-8">
              <div className="h-4 overflow-hidden bg-slate-900">
                <div className="flex h-full w-full">
                  {roleData.map((entry) => (
                    <div
                      key={entry.role}
                      className={`${entry.color} h-full`}
                      style={{ width: `${(entry.value / totalRoleUsers) * 100}%` }}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-6 divide-y divide-slate-800 border-y border-slate-800">
                {roleData.map((entry) => (
                  <button
                    key={entry.role}
                    type="button"
                    onClick={() => onRoleSelect(entry.role)}
                    className="grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-1 py-4 text-left transition hover:bg-slate-900"
                  >
                    <span className={`h-2.5 w-2.5 ${entry.color}`} />
                    <div>
                      <div className="text-sm font-medium capitalize text-white">{entry.role}</div>
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        {Math.round((entry.value / totalRoleUsers) * 100)}% of platform users
                      </div>
                    </div>
                    <div className="text-sm text-slate-400">{numberFormatter.format(entry.value)}</div>
                    <ArrowUpRight className="h-4 w-4 text-slate-600" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden border border-slate-800 bg-slate-950">
        <div className="grid gap-px bg-slate-800 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-slate-950">
            <div className="border-b border-slate-800 px-6 py-5 lg:px-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">Capital Allocation</div>
                  <p className="mt-2 text-sm text-slate-400">Comparative view of deployed capital and deal count by investor type.</p>
                </div>
                <Coins className="h-5 w-5 text-cyan-300" />
              </div>
            </div>

            <div className="grid gap-px bg-slate-800 lg:grid-cols-2">
              <div className="bg-slate-950 px-6 py-6 lg:px-8">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Penny capital</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {numberFormatter.format(analytics.investmentTypeBreakdown.pennyCount ?? 0)} investments
                    </div>
                  </div>
                  <div className="text-right text-2xl font-semibold text-white">Rs. {currencyFormatter.format(pennyCapital)}</div>
                </div>
                <div className="mt-5 h-3 overflow-hidden bg-slate-900">
                  <div
                    className="h-full bg-[linear-gradient(90deg,rgba(59,130,246,0.95),rgba(59,130,246,0.85))]"
                    style={{ width: `${(pennyCapital / totalCapital) * 100}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-950 px-6 py-6 lg:px-8">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Sole capital</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {numberFormatter.format(analytics.investmentTypeBreakdown.soleCount ?? 0)} investments
                    </div>
                  </div>
                  <div className="text-right text-2xl font-semibold text-white">Rs. {currencyFormatter.format(soleCapital)}</div>
                </div>
                <div className="mt-5 h-3 overflow-hidden bg-slate-900">
                  <div
                    className="h-full bg-[linear-gradient(90deg,rgba(16,185,129,0.95),rgba(132,204,22,0.82))]"
                    style={{ width: `${(soleCapital / totalCapital) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-950">
            <div className="border-b border-slate-800 px-6 py-5 lg:px-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">Top Innovators</div>
                  <p className="mt-2 text-sm text-slate-400">Highest current innovation scores on the platform.</p>
                </div>
                <Activity className="h-5 w-5 text-cyan-300" />
              </div>
            </div>

            <div className="divide-y divide-slate-800">
              {analytics.topInnovators.map((user, index) => (
                <div key={user._id} className="grid grid-cols-[3rem_1fr_auto] items-center gap-4 px-6 py-4 lg:px-8">
                  <div className="text-2xl font-semibold text-slate-600">0{index + 1}</div>
                  <div>
                    <div className="text-sm font-medium text-white">{user.displayName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-white">{numberFormatter.format(user.innovationScore)}</div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">score</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
});

export default function AnalyticsOverview() {
  const { analytics, onRoleSelect } = useAdminAnalyticsContext();

  return <AnalyticsOverviewPanel analytics={analytics} onRoleSelect={onRoleSelect} />;
}
