import { useQuery } from '@tanstack/react-query';
import { analyticsApi, type AdminPlatformAnalytics } from '../../api/analytics.api';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Briefcase, TrendingUp, DollarSign, ShieldAlert, FileText } from 'lucide-react';

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
      <div className="p-3 bg-violet-500/10 rounded-xl">
        <Icon className="w-5 h-5 text-violet-400" />
      </div>
    </div>
  </Card>
);

function AdminPlatformAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-platform-analytics'],
    queryFn: async () => {
      const res = await analyticsApi.getAdminAnalytics();
      return res.data.data;
    },
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  if (!data) return null;

  const stats: AdminPlatformAnalytics = data;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Platform Analytics</h2>
        <p className="text-slate-400 mt-1">Real-time platform metrics and insights</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={String(stats.totalUsers)} />
        <StatCard icon={Briefcase} label="Active Startups" value={String(stats.totalStartups)} sub={`${stats.pendingVerifications} pending review`} />
        <StatCard icon={TrendingUp} label="Total Bids" value={String(stats.totalBids)} />
        <StatCard icon={DollarSign} label="Investment Volume" value={formatINR(stats.totalInvestmentVolume)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
          <h3 className="text-lg font-semibold text-white mb-4">Users by Role</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.usersByRole}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="role" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
          <h3 className="text-lg font-semibold text-white mb-4">Startups by Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.startupsByStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="status" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Bar dataKey="count" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <h3 className="font-semibold text-white">Fraud Flags</h3>
          </div>
          <p className="text-3xl font-bold text-red-400">{stats.fraudFlags}</p>
          <p className="text-xs text-slate-500 mt-1">Startups with active fraud flags</p>
        </Card>

        <Card className="p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-white">Pending Verifications</h3>
          </div>
          <p className="text-3xl font-bold text-amber-400">{stats.pendingVerifications}</p>
          <p className="text-xs text-slate-500 mt-1">Startups awaiting review</p>
        </Card>

        <Card className="p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-white">Deal Stages</h3>
          </div>
          <div className="space-y-2">
            {Array.isArray(stats.dealsByStage) ? stats.dealsByStage.map((d) => (
              <div key={d.stage} className="flex justify-between text-sm">
                <span className="text-slate-400">Stage {d.stage}</span>
                <span className="text-white font-medium">{d.count}</span>
              </div>
            )) : null}
          </div>
        </Card>
      </div>

      <Card className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {stats.recentActivity.slice(0, 10).map((activity: any, i: number) => (
            <div key={i} className="flex items-center gap-3 p-2 text-sm text-slate-300">
              <span className="text-xs text-slate-500 font-mono w-16 shrink-0">
                {activity.createdAt ? new Date(activity.createdAt).toLocaleDateString() : ''}
              </span>
              <span className="capitalize text-slate-400">{activity.action?.replace(/_/g, ' ').toLowerCase()}</span>
              <span className="text-slate-600 truncate">{activity.entityType}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default AdminPlatformAnalytics;
