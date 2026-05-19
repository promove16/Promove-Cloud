import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { BidDetailView, CounterOfferEntryView } from '../../api/bidding.api';

type Props = {
  bid: BidDetailView;
  currentUserId?: string;
  className?: string;
};

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const buildEntries = (bid: BidDetailView): CounterOfferEntryView[] => {
  if (bid.counterOfferHistory && bid.counterOfferHistory.length > 0) {
    return bid.counterOfferHistory;
  }
  // Synthesize from top-level fields when no history persisted yet.
  const entries: CounterOfferEntryView[] = [
    {
      by: 'investor',
      actorId: bid.investorId,
      actorName: bid.investorName,
      actorAvatar: bid.investorAvatar,
      amount: bid.proposedAmount,
      equity: bid.proposedEquity,
      message: bid.coverLetter,
      at: bid.createdAt,
    },
  ];
  if (bid.counterAmount !== undefined && bid.counterEquity !== undefined) {
    entries.push({
      by: 'founder',
      actorId: bid.founderId,
      actorName: bid.founderName,
      amount: bid.counterAmount,
      equity: bid.counterEquity,
      at: bid.updatedAt,
    });
  }
  return entries;
};

const statusBadge = (status: BidDetailView['status']) => {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Pending', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
    viewed: { label: 'Viewed', cls: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300' },
    negotiating: { label: 'Negotiating', cls: 'border-purple-500/30 bg-purple-500/10 text-purple-300' },
    countered: { label: 'Countered', cls: 'border-purple-500/30 bg-purple-500/10 text-purple-300' },
    accepted: { label: 'Accepted', cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
    rejected: { label: 'Rejected', cls: 'border-red-500/30 bg-red-500/10 text-red-300' },
    expired: { label: 'Expired', cls: 'border-slate-700 bg-slate-900 text-slate-400' },
    closed: { label: 'Closed', cls: 'border-slate-700 bg-slate-900 text-slate-400' },
  };
  const e = map[status] ?? map.pending;
  return <Badge className={e.cls}>{e.label}</Badge>;
};

export const NegotiationTimeline = ({ bid, currentUserId, className }: Props) => {
  const entries = buildEntries(bid);

  return (
    <Card className={className ? `${className} p-5` : 'p-5'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Negotiation Timeline
          </div>
          <div className="mt-1 text-sm text-slate-400">
            {entries.length} {entries.length === 1 ? 'round' : 'rounds'} of negotiation
          </div>
        </div>
        {statusBadge(bid.status)}
      </div>

      <div className="mt-5 space-y-3">
        {entries.map((entry, index) => {
          const isMine = currentUserId && entry.actorId === currentUserId;
          const side = entry.by === 'founder' ? 'right' : 'left';
          return (
            <div
              key={entry._id ?? `${entry.actorId}-${entry.at}-${index}`}
              className={`flex ${side === 'right' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl border px-4 py-3 ${
                  entry.by === 'founder'
                    ? 'border-purple-500/30 bg-purple-500/10'
                    : 'border-cyan-500/30 bg-cyan-500/10'
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-xs text-slate-300">
                  <span className="font-semibold">
                    {entry.actorName ?? (entry.by === 'founder' ? 'Founder' : 'Investor')}
                    {isMine ? ' (you)' : ''}
                  </span>
                  <span className="text-slate-500">{formatDateTime(entry.at)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-lg font-bold text-white">{formatINR(entry.amount)}</span>
                  <span className="text-sm text-slate-400">for {entry.equity}% equity</span>
                </div>
                {entry.message ? (
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
                    {entry.message}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        {bid.status === 'accepted' && bid.finalAmount !== undefined ? (
          <div className="flex justify-center">
            <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              Final terms: {formatINR(bid.finalAmount)} for {bid.finalEquity}% equity
            </Badge>
          </div>
        ) : null}

        {bid.status === 'rejected' && bid.rejectionReason ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-200">
            <span className="font-semibold">Rejected:</span> {bid.rejectionReason}
          </div>
        ) : null}
      </div>
    </Card>
  );
};

export default NegotiationTimeline;
