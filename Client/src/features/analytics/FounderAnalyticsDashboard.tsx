import { useQuery } from '@tanstack/react-query';
import { analyticsApi, type FounderAnalytics } from '../../api/analytics.api';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, DollarSign, Users, Briefcase, PiggyBank, Activity } from 'lucide-react';

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

const StatCard = ({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) => (
  <Card className="p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-slate-400 font-medium">{label}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
      <div className="p-3 bg-emerald-500/10 rounded-xl">
        <Icon className="w-5 h-5 text-emerald-400" />
      </div>
    </div>
  </Card>
);

export function FounderAnalyticsDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['founder-analytics'],
    queryFn: async () => {
      const res = await analyticsApi.getFounderAnalytics();
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

  const stats: FounderAnalytics = data;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Founder Analytics</h2>
        <p className="text-slate-400 mt-1">Track your startup investment performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Briefcase} label="Total Startups" value={String(stats.totalStartups)} />
        <StatCard icon={TrendingUp} label="Total Bids" value={String(stats.totalBids)} sub={`${stats.pendingBids} pending`} />
        <StatCard icon={DollarSign} label="Total Investment" value={formatINR(stats.totalInvestmentAmount)} />
        <StatCard icon={Users} label="Investors" value={String(stats.investorCount)} sub={`${stats.soleInvestorCount} sole · ${stats.pennyInvestorCount} penny`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Bids Over Time (30 days)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.bidsOverTime}>
                <defs>
                  <linearGradient id="bidGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Area type="monotone" dataKey="count" stroke="#34d399" fill="url(#bidGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-emerald-400" />
            Top Investors
          </h3>
          {stats.topInvestors.length > 0 ? (
            <div className="space-y-3">
              {stats.topInvestors.map((inv, i) => (
                <div key={inv.investorId} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 text-sm font-mono w-6">#{i + 1}</span>
                    <span className="text-white text-sm font-medium">{inv.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-400 text-sm font-semibold">{formatINR(inv.amount)}</p>
                    <p className="text-slate-500 text-xs">{inv.equity}% equity</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No investors yet</p>
          )}
        </Card>
      </div>

      <Card className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
        <h3 className="text-lg font-semibold text-white mb-4">Bid Summary</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-emerald-500/10 rounded-xl">
            <p className="text-2xl font-bold text-emerald-400">{stats.acceptedBids}</p>
            <p className="text-xs text-slate-400 mt-1">Accepted</p>
          </div>
          <div className="text-center p-4 bg-amber-500/10 rounded-xl">
            <p className="text-2xl font-bold text-amber-400">{stats.pendingBids}</p>
            <p className="text-xs text-slate-400 mt-1">Pending</p>
          </div>
          <div className="text-center p-4 bg-red-500/10 rounded-xl">
            <p className="text-2xl font-bold text-red-400">{stats.rejectedBids}</p>
            <p className="text-xs text-slate-400 mt-1">Rejected</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
