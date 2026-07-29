import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { biddingApi, type BidDetailView, type BidFilters } from '../../api/bidding.api';
import { interestApi } from '../../api/interest.api';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { toast } from 'sonner';
import {
  DollarSign,
  Send,
  X,
  Activity,
  BarChart3,
  Heart,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { NegotiationTimeline } from './NegotiationTimeline';
import { LiveActivityFeed } from '../activity/LiveActivityFeed';
import { FundingProgressBar } from '../funding/FundingProgressBar';
import { AgreementViewer } from '../agreement/AgreementViewer';
import { ReputationCard } from '../reputation/ReputationCard';

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

const STATUS_HELP: Record<string, string> = {
  pending: 'Sent to founder. Waiting for first review.',
  viewed: 'Founder has opened your offer.',
  negotiating: 'Terms are being discussed.',
  countered: 'Founder sent revised terms. Review before responding.',
  accepted: 'Founder accepted. Continue through deal review.',
  rejected: 'Founder declined this offer.',
  expired: 'This offer expired before a decision.',
  closed: 'This bid is no longer active.',
};

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

function InvestorBidCard({
  bid,
  onCounter,
  onSelect,
}: {
  bid: BidDetailView;
  onCounter: (bid: BidDetailView) => void;
  onSelect: (bid: BidDetailView) => void;
}) {
  const style = STATUS_STYLES[bid.status] ?? STATUS_STYLES.pending;
  const isNegotiable = ['countered', 'negotiating'].includes(bid.status);

  return (
    <Card
      onClick={() => onSelect(bid)}
      className="p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl hover:border-white/20 transition-all duration-300 cursor-pointer overflow-hidden"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
            {bid.startupName?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold truncate">{bid.startupName}</p>
            <p className="text-slate-400 text-xs truncate">{bid.startupTagline ?? ''}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${style.bg} ${style.text}`}>
          {style.label}
        </span>
      </div>

      <div className={`mb-4 rounded-xl px-3 py-2 text-xs leading-relaxed ${style.bg} ${style.text}`}>
        {STATUS_HELP[bid.status] ?? 'Track the founder response for this offer.'}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-white/5 rounded-xl min-w-0">
          <p className="text-xs text-slate-500">Your Bid</p>
          <p className="text-white font-semibold truncate">{formatINR(bid.proposedAmount)}</p>
        </div>
        <div className="p-3 bg-white/5 rounded-xl min-w-0">
          <p className="text-xs text-slate-500">Equity</p>
          <p className="text-white font-semibold truncate">{bid.proposedEquity}%</p>
        </div>
        <div className="p-3 bg-white/5 rounded-xl min-w-0">
          <p className="text-xs text-slate-500">Type</p>
          <p className="text-white font-semibold truncate capitalize">{bid.bidType}</p>
        </div>
        <div className="p-3 bg-white/5 rounded-xl min-w-0">
          <p className="text-xs text-slate-500">Category</p>
          <p className="text-white font-semibold truncate">{bid.startupCategory ?? 'N/A'}</p>
        </div>
      </div>

      {bid.counterAmount && (
        <div className="p-3 bg-purple-500/10 rounded-xl mb-3 min-w-0">
          <p className="text-xs text-slate-500">Counter-offer received</p>
          <p className="text-purple-400 font-semibold truncate">{formatINR(bid.counterAmount)} for {bid.counterEquity}% equity</p>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">Compare this with your original offer before sending a new response.</p>
        </div>
      )}

      {isNegotiable && (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onCounter(bid);
          }}
          size="sm"
          className="w-full bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20"
        >
          <Send className="w-3.5 h-3.5 mr-1" /> Respond to Counter-Offer
        </Button>
      )}
    </Card>
  );
}

function InvestCounterModal({ bid, onClose }: { bid: BidDetailView; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(bid.counterAmount ?? bid.proposedAmount);
  const [equity, setEquity] = useState(bid.counterEquity ?? bid.proposedEquity);

  const counterMutation = useMutation({
    mutationFn: () => biddingApi.counterBid(bid._id, { counterAmount: amount, counterEquity: equity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investor-bids'] });
      toast.success('Counter-offer sent');
      onClose();
    },
    onError: () => toast.error('Failed to send counter-offer'),
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-6 bg-slate-900 border border-white/10 rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white mb-4">Respond to {bid.startupName}</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Counter Investment (INR)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
              min={20000}
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Counter Equity (%)</label>
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

function InvestorBidDashboard() {
  const [filter, setFilter] = useState<string | null>(null);
  const [counterBid, setCounterBid] = useState<BidDetailView | null>(null);
  const [selectedBid, setSelectedBid] = useState<BidDetailView | null>(null);

  const currentUserId = useAuthStore((s) => s.user?._id);

  const { data, isLoading } = useQuery({
    queryKey: ['investor-bids', filter],
    queryFn: async () => {
      const filters: BidFilters = {};
      if (filter) filters.status = filter;
      const res = await biddingApi.getInvestorBids(filters);
      return res.data.data;
    },
    refetchInterval: 10000,
  });

  const interestsQuery = useQuery({
    queryKey: ['interest', 'mine'],
    queryFn: async () => {
      const res = await interestApi.mine();
      return res.data.data.items;
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

  const FILTERS = [
    { key: null, label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'negotiating', label: 'Negotiating' },
    { key: 'expired', label: 'Expired' },
  ];

  const bids = data?.items ?? [];

  const totalInvested = bids
    .filter((b) => b.status === 'accepted')
    .reduce((s, b) => s + (b.finalAmount ?? b.proposedAmount), 0);

  const activeCount = bids.filter((b) => ['pending', 'viewed', 'negotiating', 'countered'].includes(b.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Investment Interest Tracker</h2>
          <p className="text-slate-400 text-sm mt-1">
            Follow every offer after Express Interest: founder review, counters, acceptance, and closure.
          </p>
        </div>
      </div>

      <Card className="p-4 bg-cyan-500/10 backdrop-blur-xl border border-cyan-500/20 rounded-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-cyan-100">How this page works</p>
            <p className="mt-1 text-sm text-cyan-200/80">
              Each card is one submitted interest. Pending means it was sent; viewed means the founder opened it; countered means you need to decide the revised terms.
            </p>
          </div>
          <a
            href="/dashboard/investor/startups"
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/20"
          >
            Find more startups
          </a>
        </div>
      </Card>

      <ReputationCard variant="compact" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
          <div className="flex items-center gap-3">
            <Heart className="w-5 h-5 text-cyan-400" />
            <div>
              <p className="text-xs text-slate-400">Interests</p>
              <p className="text-xl font-bold text-white">
                {interestsQuery.data?.length ?? 0}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
          <div className="flex items-center gap-3">
            <Send className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-xs text-slate-400">Total Bids</p>
              <p className="text-xl font-bold text-white">{bids.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-purple-400" />
            <div>
              <p className="text-xs text-slate-400">Active</p>
              <p className="text-xl font-bold text-white">{activeCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-xs text-slate-400">Invested</p>
              <p className="text-xl font-bold text-white">{formatINR(totalInvested)}</p>
            </div>
          </div>
        </Card>
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bids.map((bid) => (
          <InvestorBidCard
            key={bid._id}
            bid={bid}
            onCounter={setCounterBid}
            onSelect={setSelectedBid}
          />
        ))}
      </div>

      {bids.length === 0 && (
        <Card className="p-12 text-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
          <BarChart3 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-lg">No bids yet</p>
          <p className="text-slate-500 text-sm mt-1">Browse the marketplace to find startups to invest in</p>
        </Card>
      )}

      {counterBid && (
        <InvestCounterModal bid={counterBid} onClose={() => setCounterBid(null)} />
      )}

      {selectedBid && !counterBid && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedBid(null)}
        >
          <Card
            className="w-full max-w-3xl p-6 bg-slate-900 border border-white/10 rounded-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Bid on {selectedBid.startupName}
                </h3>
                <p className="text-sm text-slate-400">{selectedBid.startupTagline}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBid(null)}
                className="text-slate-400 hover:text-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
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

              {['countered', 'negotiating'].includes(selectedBid.status) && (
                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      setCounterBid(selectedBid);
                      setSelectedBid(null);
                    }}
                    className="bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20"
                  >
                    <Send className="w-3.5 h-3.5 mr-1" /> Respond to Counter-Offer
                  </Button>
                </div>
              )}

              {selectedBid.startupId && (
                <LiveActivityFeed startupId={selectedBid.startupId} maxItems={15} />
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default InvestorBidDashboard;
