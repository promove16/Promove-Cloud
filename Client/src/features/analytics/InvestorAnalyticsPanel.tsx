import { useQuery } from '@tanstack/react-query';
import { analyticsApi, type InvestorAnalytics } from '../../api/analytics.api';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, DollarSign, PieChart as PieIcon, Target } from 'lucide-react';

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  viewed: '#3b82f6',
  negotiating: '#8b5cf6',
  countered: '#ec4899',
  accepted: '#10b981',
  rejected: '#ef4444',
  expired: '#64748b',
  closed: '#1e293b',
};

const StatCard = ({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) => (
  <Card className="p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-slate-400 font-medium">{label}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
      <div className="p-3 bg-indigo-500/10 rounded-xl">
        <Icon className="w-5 h-5 text-indigo-400" />
      </div>
    </div>
  </Card>
);

export function InvestorAnalyticsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['investor-analytics'],
    queryFn: async () => {
      const res = await analyticsApi.getInvestorAnalytics();
      return res.data.data;
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  if (!data) return null;

  const stats: InvestorAnalytics = data;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Investment Analytics</h2>
        <p className="text-slate-400 mt-1">Your investor performance overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Total Bids" value={String(stats.totalBids)} sub={`${stats.activeBids} active`} />
        <StatCard icon={DollarSign} label="Total Invested" value={formatINR(stats.totalInvested)} />
        <StatCard icon={Target} label="Portfolio Size" value={String(stats.portfolioSize)} sub={`Avg: ${formatINR(stats.avgDealSize)}`} />
        <StatCard icon={PieIcon} label="Equity Held" value={`${stats.totalEquityHeld}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
          <h3 className="text-lg font-semibold text-white mb-4">Bids by Status</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.bidsByStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent, payload }: { name?: string | number; percent?: number; payload?: { status?: string } }) => `${payload?.status ?? name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                >
                  {stats.bidsByStatus.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#64748b'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
          <h3 className="text-lg font-semibold text-white mb-4">Performance Summary</h3>
          <div className="space-y-4">
            <div className="flex justify-between p-3 bg-white/5 rounded-xl">
              <span className="text-slate-300">Accepted Bids</span>
              <span className="text-emerald-400 font-semibold">{stats.acceptedBids}</span>
            </div>
            <div className="flex justify-between p-3 bg-white/5 rounded-xl">
              <span className="text-slate-300">Rejected Bids</span>
              <span className="text-red-400 font-semibold">{stats.rejectedBids}</span>
            </div>
            <div className="flex justify-between p-3 bg-white/5 rounded-xl">
              <span className="text-slate-300">Active Bids</span>
              <span className="text-blue-400 font-semibold">{stats.activeBids}</span>
            </div>
            <div className="flex justify-between p-3 bg-white/5 rounded-xl">
              <span className="text-slate-300">Success Rate</span>
              <span className="text-emerald-400 font-semibold">
                {stats.totalBids > 0 ? ((stats.acceptedBids / stats.totalBids) * 100).toFixed(1) : '0'}%
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
