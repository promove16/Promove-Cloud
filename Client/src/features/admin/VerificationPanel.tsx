import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, AdminStartupReviewItem } from '../../api/admin.api';
import { verificationApi } from '../../api/verification.api';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { toast } from 'sonner';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Users,
  Rocket,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react';

function FraudCheckPanel({ startupId }: { startupId: string }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['fraud-check', startupId],
    queryFn: async () => {
      const res = await verificationApi.runFraudCheck(startupId);
      return res.data.data;
    },
    enabled: false,
  });

  const flagMutation = useMutation({
    mutationFn: (data: { severity: 'low' | 'medium' | 'high' | 'critical'; description: string }) =>
      verificationApi.flagFraud(startupId, data.severity, data.description),
    onSuccess: () => {
      toast.success('Fraud flag raised');
      refetch();
    },
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-2">
      <Button onClick={() => refetch()} size="sm" className="bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20">
        <Search className="w-3.5 h-3.5 mr-1" /> Run Fraud Check
      </Button>
      {data && (
        <div className={`p-3 rounded-xl ${data.flagged ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
          <p className="text-sm font-medium flex items-center gap-2 text-white">
            {data.flagged ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {data.flagged ? `${data.flags.length} issue(s) found` : 'No issues detected'}
          </p>
          {data.flags.map((flag, i) => (
            <div key={i} className="mt-2 text-xs text-slate-400">
              <span className="text-rose-300 capitalize">{flag.severity}</span>: {flag.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StartupReviewCard({ startup }: { startup: AdminStartupReviewItem }) {
  const queryClient = useQueryClient();

  const reviewMutation = useMutation({
    mutationFn: ({ id, decision, notes }: { id: string; decision: 'approved' | 'rejected'; notes?: string }) =>
      verificationApi.verifyStartup(id, decision, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-startups'] });
      toast.success('Startup review updated');
    },
    onError: () => toast.error('Failed to update review'),
  });

  return (
    <Card className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0">
        {startup.name?.charAt(0) ?? '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-white font-semibold truncate">{startup.name ?? 'Unnamed Startup'}</p>
            <p className="text-xs text-slate-400 truncate">{startup.tagline ?? ''}</p>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 uppercase shrink-0">
            {startup.reviewStatus?.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="flex gap-2 mt-3">
          <Button
            onClick={() => {
              const notes = window.prompt('Admin notes (optional):');
              reviewMutation.mutate({ id: startup._id, decision: 'approved', notes: notes ?? undefined });
            }}
            size="sm"
            className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
            disabled={reviewMutation.isPending}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
          </Button>
          <Button
            onClick={() => {
              const notes = window.prompt('Reason for rejection:');
              if (notes) reviewMutation.mutate({ id: startup._id, decision: 'rejected', notes });
            }}
            size="sm"
            className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
            disabled={reviewMutation.isPending}
          >
            <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
          </Button>
          <FraudCheckPanel startupId={startup._id} />
        </div>
      </div>
    </Card>
  );
}

function AdminVerificationPanel() {


  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['verification-stats'],
    queryFn: async () => {
      const res = await verificationApi.getStats();
      return res.data.data;
    },
    refetchInterval: 15000,
  });

  const { data: startups, isLoading: startupsLoading } = useQuery({
    queryKey: ['admin-startups', 'review_requested'],
    queryFn: () => adminApi.getStartupReviews({ status: 'review_requested' }),
    refetchInterval: 10000,
  });

  const [tab, setTab] = useState<'startups' | 'investors' | 'fraud'>('startups');

  if (statsLoading || startupsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Verification Dashboard</h2>
        <p className="text-slate-400 text-sm mt-1">Review startups and investor KYC verifications</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
          <div className="flex items-center gap-3">
            <Rocket className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-sm text-slate-400">Pending Startups</p>
              <p className="text-2xl font-bold text-white">{stats?.startups.pending ?? 0}</p>
              <p className="text-xs text-slate-500">{stats?.startups.approvalRate ?? 0}% approval rate</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-sm text-slate-400">Investors Pending</p>
              <p className="text-2xl font-bold text-white">{stats?.investors.pending ?? 0}</p>
              <p className="text-xs text-slate-500">{stats?.investors.verificationRate ?? 0}% verified</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <div>
              <p className="text-sm text-slate-400">Platform Activity</p>
              <p className="text-2xl font-bold text-white">{stats?.activity.totalBids ?? 0}</p>
              <p className="text-xs text-slate-500">{stats?.activity.totalDeals ?? 0} deals completed</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex gap-2">
        {[
          { key: 'startups' as const, label: 'Startup Reviews', icon: Rocket },
          { key: 'investors' as const, label: 'Investor KYC', icon: Users },
          { key: 'fraud' as const, label: 'Fraud Monitoring', icon: ShieldAlert },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'startups' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Pending Startup Reviews</h3>
            <span className="text-sm text-slate-400">{startups?.length ?? 0} pending</span>
          </div>
          {startups && startups.length > 0 ? (
            startups.map((startup) => (
              <StartupReviewCard key={startup._id} startup={startup} />
            ))
          ) : (
            <Card className="p-8 text-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-slate-400">All caught up — no pending startup reviews</p>
            </Card>
          )}
        </div>
      )}

      {tab === 'investors' && (
        <Card className="p-8 text-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
          <ShieldCheck className="w-8 h-8 text-blue-400 mx-auto mb-2" />
          <p className="text-slate-400 text-lg">Investor KYC Management</p>
          <p className="text-slate-500 text-sm mt-1">
            {stats?.investors.pending ?? 0} investors pending verification out of {stats?.investors.total ?? 0} total
          </p>
        </Card>
      )}

      {tab === 'fraud' && (
        <Card className="p-8 text-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
          <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <p className="text-slate-400 text-lg">Fraud Monitoring</p>
          <p className="text-slate-500 text-sm mt-1">Use the "Run Fraud Check" button on any startup card to scan for suspicious patterns</p>
        </Card>
      )}
    </div>
  );
}

export default AdminVerificationPanel;
