import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext, useParams } from 'react-router-dom';
import { biddingApi, type BidDetailView } from '../../api/bidding.api';
import { analyticsApi } from '../../api/analytics.api';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { toast } from 'sonner';
import { Eye, X, Check, TrendingUp, MessageCircle, ArrowLeft, DollarSign, Users } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { NegotiationTimeline } from './NegotiationTimeline';
import { BidComparisonTable } from './BidComparisonTable';
import { LiveActivityFeed } from '../activity/LiveActivityFeed';
import { FundingProgressBar } from '../funding/FundingProgressBar';
import { AgreementViewer } from '../agreement/AgreementViewer';

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: 'Pending' },
  viewed: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Viewed' },
  negotiating: { bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'Negotiating' },
  countered: { bg: 'bg-pink-500/10', text: 'text-pink-400', label: 'Countered' },
  accepted: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Accepted' },
  rejected: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Rejected' },
  expired: { bg: 'bg-slate-500/10', text: 'text-slate-400', label: 'Expired' },
  closed: { bg: 'bg-slate-600/10', text: 'text-slate-500', label: 'Closed' },
};

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

const FILTERS = [
  { key: null as string | null, label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'negotiating', label: 'Negotiating' },
];

type StartupOutletContext = {
  startupId?: string;
};

function BidCard({ bid, onView, onRespond }: { bid: BidDetailView; onView: () => void; onRespond: (decision: 'accepted' | 'rejected', reason?: string) => void }) {
  const style = STATUS_STYLES[bid.status] ?? STATUS_STYLES.pending;
  const isActive = ['pending', 'viewed', 'negotiating', 'countered'].includes(bid.status);

  return (
    <Card className="p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl hover:border-white/20 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
            {bid.investorName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-white font-semibold">{bid.investorName}</p>
            <p className="text-slate-400 text-xs">Score: {bid.investorInnovationScore}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
          {style.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-white/5 rounded-xl">
          <p className="text-xs text-slate-500">Amount</p>
          <p className="text-white font-semibold">{formatINR(bid.proposedAmount)}</p>
        </div>
        <div className="p-3 bg-white/5 rounded-xl">
          <p className="text-xs text-slate-500">Equity</p>
          <p className="text-white font-semibold">{bid.proposedEquity}%</p>
        </div>
        <div className="p-3 bg-white/5 rounded-xl">
          <p className="text-xs text-slate-500">Type</p>
          <p className="text-white font-semibold capitalize">{bid.bidType}</p>
        </div>
        <div className="p-3 bg-white/5 rounded-xl">
          <p className="text-xs text-slate-500">Startup</p>
          <p className="text-white font-semibold truncate">{bid.startupName}</p>
        </div>
      </div>

      {bid.coverLetter && (
        <p className="text-sm text-slate-400 mb-4 italic line-clamp-2">&ldquo;{bid.coverLetter}&rdquo;</p>
      )}

      {isActive && (
        <div className="flex gap-2">
          {bid.status === 'pending' && (
            <Button onClick={onView} size="sm" className="flex-1 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20">
              <Eye className="w-3.5 h-3.5 mr-1" /> View
            </Button>
          )}
          <Button onClick={() => onRespond('accepted')} size="sm" className="flex-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20">
            <Check className="w-3.5 h-3.5 mr-1" /> Accept
          </Button>
          <Button onClick={() => onRespond('rejected')} size="sm" className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20">
            <X className="w-3.5 h-3.5 mr-1" /> Decline
          </Button>
        </div>
      )}

      {bid.rejectionReason && (
        <p className="text-xs text-red-400 mt-2">Reason: {bid.rejectionReason}</p>
      )}
    </Card>
  );
}

function CounterModal({
  bid,
  onClose,
  onSuccess,
}: {
  bid: BidDetailView;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [amount, setAmount] = useState(bid.counterAmount ?? bid.proposedAmount);
  const [equity, setEquity] = useState(bid.counterEquity ?? bid.proposedEquity);

  const counterMutation = useMutation({
    mutationFn: () => biddingApi.counterBid(bid._id, { counterAmount: amount, counterEquity: equity }),
    onSuccess: () => {
      onSuccess?.();
      toast.success('Counter-offer sent');
      onClose();
    },
    onError: () => toast.error('Failed to send counter-offer'),
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-6 bg-slate-900 border border-white/10 rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white mb-4">Counter Offer</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Investment Amount (INR)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
              min={20000}
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Equity (%)</label>
            <input
              type="number"
              value={equity}
              onChange={(e) => setEquity(Number(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
              min={0.01}
              max={100}
              step={0.1}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
            <Button
              onClick={() => counterMutation.mutate()}
              className="flex-1 bg-purple-500 hover:bg-purple-600 text-white"
              disabled={counterMutation.isPending}
            >
              {counterMutation.isPending ? 'Sending...' : 'Send Counter-Offer'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function StartupAnalyticsCard({ startupId }: { startupId: string }) {
  const { data } = useQuery({
    queryKey: ['startup-analytics', startupId],
    queryFn: async () => {
      const res = await analyticsApi.getFounderStartupAnalytics(startupId);
      return res.data.data;
    },
    enabled: !!startupId,
  });

  if (!data) return null;

  return (
    <Card className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Startup Analytics</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-white text-sm">{data.totalBids} bids</span>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-white text-sm">{formatINR(data.totalProposedAmount)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-white text-sm">{data.investorEngagement}% engaged</span>
        </div>
        <div className="flex items-center gap-2">
          <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-white text-sm">{data.negotiatingBids} negotiating</span>
        </div>
      </div>
    </Card>
  );
}

function FounderBidDashboard() {
  const [selectedBid, setSelectedBid] = useState<BidDetailView | null>(null);
  const [showCounter, setShowCounter] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'compare'>('cards');
  const params = useParams<{ startupId?: string }>();
  const outletContext = useOutletContext<StartupOutletContext | undefined>();
  const startupId = outletContext?.startupId ?? params.startupId;

  const currentUserId = useAuthStore((s) => s.user?._id);
  const queryClient = useQueryClient();
  const bidQueryKey = ['startup-bids', startupId];
  const invalidateBidQueries = () => {
    if (startupId) {
      queryClient.invalidateQueries({ queryKey: bidQueryKey });
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: bidQueryKey,
    queryFn: async () => {
      if (!startupId) {
        throw new Error('Startup ID is required to load bids');
      }
      const res = await biddingApi.getStartupBids(startupId);
      return res.data.data;
    },
    enabled: Boolean(startupId),
    refetchInterval: 10000,
  });

  const respondMutation = useMutation({
    mutationFn: ({ bidId, decision, reason }: { bidId: string; decision: 'accepted' | 'rejected'; reason?: string }) =>
      biddingApi.respondToBid(bidId, { decision, rejectionReason: reason }),
    onSuccess: () => {
      invalidateBidQueries();
      toast.success('Bid response recorded');
      setSelectedBid(null);
    },
    onError: () => toast.error('Failed to respond to bid'),
  });

  const viewMutation = useMutation({
    mutationFn: (bidId: string) => biddingApi.markViewed(bidId),
    onSuccess: () => invalidateBidQueries(),
  });

  const allBids = data?.items ?? [];
  const bids = useMemo(
    () => (filter ? allBids.filter((bid) => bid.status === filter) : allBids),
    [allBids, filter],
  );
  const startupBidStats = useMemo(() => {
    const accepted = allBids.filter((bid) => bid.status === 'accepted');
    const active = allBids.filter((bid) =>
      ['pending', 'viewed', 'negotiating', 'countered'].includes(bid.status),
    );
    const funded = accepted.reduce(
      (sum, bid) => sum + (bid.finalAmount ?? bid.counterAmount ?? bid.proposedAmount),
      0,
    );

    return {
      total: allBids.length,
      active: active.length,
      accepted: accepted.length,
      funded,
    };
  }, [allBids]);

  if (!startupId) {
    return (
      <Card className="p-8 text-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
        <p className="text-slate-300 text-lg font-semibold">Select a startup to view bids</p>
        <p className="text-slate-500 text-sm mt-1">Bids are managed inside each startup workspace.</p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Investment Bids</h2>
          <p className="text-slate-400 text-sm mt-1">Manage incoming investment bids for this startup</p>
        </div>
      </div>

      <Card className="p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Startup bid summary</p>
          <p className="mt-1 text-sm text-slate-400">Only bids attached to this startup are counted here.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryStat label="Total bids" value={startupBidStats.total} />
          <SummaryStat label="Active" value={startupBidStats.active} />
          <SummaryStat label="Accepted" value={startupBidStats.accepted} />
          <SummaryStat label="Funded" value={formatINR(startupBidStats.funded)} />
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key ?? 'all'}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === f.key
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1 text-sm">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              viewMode === 'cards' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode('compare')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              viewMode === 'compare' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Compare
          </button>
        </div>
      </div>

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bids.map((bid) => (
            <BidCard
              key={bid._id}
              bid={bid}
              onView={() => {
                viewMutation.mutate(bid._id);
                setSelectedBid(bid);
              }}
              onRespond={(decision, reason) => {
                if (decision === 'rejected') {
                  const r = window.prompt('Reason for rejection (optional):');
                  respondMutation.mutate({ bidId: bid._id, decision, reason: r ?? undefined });
                } else {
                  respondMutation.mutate({ bidId: bid._id, decision });
                }
              }}
            />
          ))}
        </div>
      ) : (
        <BidComparisonTable
          bids={bids}
          onSelect={(b) => setSelectedBid(b)}
          onAccept={(b) =>
            respondMutation.mutate({ bidId: b._id, decision: 'accepted' })
          }
          onReject={(b) => {
            const r = window.prompt('Reason for rejection (optional):');
            respondMutation.mutate({
              bidId: b._id,
              decision: 'rejected',
              reason: r ?? undefined,
            });
          }}
          onCounter={(b) => {
            setSelectedBid(b);
            setShowCounter(true);
          }}
        />
      )}

      {bids.length === 0 && (
        <Card className="p-12 text-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
          <p className="text-slate-400 text-lg">No bids yet</p>
          <p className="text-slate-500 text-sm mt-1">This startup has not received investment bids yet</p>
        </Card>
      )}

      {selectedBid && showCounter && (
        <CounterModal
          bid={selectedBid}
          onClose={() => setShowCounter(false)}
          onSuccess={invalidateBidQueries}
        />
      )}

      {selectedBid && !showCounter && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedBid(null)}>
          <Card className="w-full max-w-3xl p-6 bg-slate-900 border border-white/10 rounded-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Bid Details</h3>
              <button onClick={() => setSelectedBid(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                  {selectedBid.investorName.charAt(0)}
                </div>
                <div>
                  <p className="text-white font-semibold text-lg">{selectedBid.investorName}</p>
                  <p className="text-slate-400 text-sm">Innovation Score: {selectedBid.investorInnovationScore}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-white/5 rounded-xl">
                  <p className="text-xs text-slate-500">Proposed Amount</p>
                  <p className="text-xl font-bold text-emerald-400">{formatINR(selectedBid.proposedAmount)}</p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl">
                  <p className="text-xs text-slate-500">Equity Requested</p>
                  <p className="text-xl font-bold text-white">{selectedBid.proposedEquity}%</p>
                </div>
              </div>

              {selectedBid.counterAmount && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-purple-500/10 rounded-xl">
                    <p className="text-xs text-slate-500">Counter Amount</p>
                    <p className="text-lg font-bold text-purple-400">{formatINR(selectedBid.counterAmount)}</p>
                  </div>
                  <div className="p-4 bg-purple-500/10 rounded-xl">
                    <p className="text-xs text-slate-500">Counter Equity</p>
                    <p className="text-lg font-bold text-purple-400">{selectedBid.counterEquity}%</p>
                  </div>
                </div>
              )}

              {selectedBid.coverLetter && (
                <div className="p-4 bg-white/5 rounded-xl">
                  <p className="text-xs text-slate-500 mb-2">Cover Letter</p>
                  <p className="text-white text-sm">{selectedBid.coverLetter}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span>Bid: {selectedBid.bidType}</span>
                <span>Role: {selectedBid.investorRole}</span>
                {selectedBid.expiresAt && <span>Expires: {new Date(selectedBid.expiresAt).toLocaleDateString()}</span>}
              </div>

              {selectedBid.startupId && (
                <StartupAnalyticsCard startupId={selectedBid.startupId} />
              )}

              {selectedBid.startupId && (
                <FundingProgressBar startupId={selectedBid.startupId} compact />
              )}

              <NegotiationTimeline bid={selectedBid} currentUserId={currentUserId} />

              {selectedBid.status === 'accepted' && (
                <AgreementViewer
                  bidId={selectedBid._id}
                  currentUserId={currentUserId}
                />
              )}

              {selectedBid.startupId && (
                <LiveActivityFeed startupId={selectedBid.startupId} maxItems={15} />
              )}

              <div className="flex gap-2 pt-4 border-t border-white/10">
                <Button
                  onClick={() => {
                    setShowCounter(true);
                  }}
                  className="flex-1 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Counter
                </Button>
                <Button
                  onClick={() => respondMutation.mutate({ bidId: selectedBid._id, decision: 'accepted' })}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                  disabled={respondMutation.isPending}
                >
                  <Check className="w-3.5 h-3.5 mr-1" /> Accept
                </Button>
                <Button
                  onClick={() => {
                    const reason = window.prompt('Reason for rejection (optional):');
                    respondMutation.mutate({ bidId: selectedBid._id, decision: 'rejected', reason: reason ?? undefined });
                  }}
                  className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                  disabled={respondMutation.isPending}
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Decline
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default FounderBidDashboard;
