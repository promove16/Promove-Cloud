import { useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { BidDetailView } from '../../api/bidding.api';

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

type SortKey = 'amount' | 'equity' | 'score' | 'responseSpeed';

type Props = {
  bids: BidDetailView[];
  onAccept?: (bid: BidDetailView) => void;
  onReject?: (bid: BidDetailView) => void;
  onCounter?: (bid: BidDetailView) => void;
  onSelect?: (bid: BidDetailView) => void;
  className?: string;
};

const computeResponseSpeedScore = (bid: BidDetailView) => {
  // Lower is faster. Hours between creation and view (or now if not viewed).
  const created = new Date(bid.createdAt).getTime();
  const referenced = bid.viewedAt ? new Date(bid.viewedAt).getTime() : Date.now();
  const hours = Math.max(0, (referenced - created) / (1000 * 60 * 60));
  return hours;
};

const isActive = (status: BidDetailView['status']) =>
  status === 'pending' ||
  status === 'viewed' ||
  status === 'negotiating' ||
  status === 'countered';

export const BidComparisonTable = ({
  bids,
  onAccept,
  onReject,
  onCounter,
  onSelect,
  className,
}: Props) => {
  const [sortBy, setSortBy] = useState<SortKey>('amount');
  const [filterActive, setFilterActive] = useState(true);

  const filtered = useMemo(() => {
    const base = filterActive ? bids.filter((b) => isActive(b.status)) : bids;
    const sorted = [...base];
    sorted.sort((a, b) => {
      if (sortBy === 'amount') {
        return (
          (b.counterAmount ?? b.proposedAmount) - (a.counterAmount ?? a.proposedAmount)
        );
      }
      if (sortBy === 'equity') {
        return (
          (a.counterEquity ?? a.proposedEquity) - (b.counterEquity ?? b.proposedEquity)
        );
      }
      if (sortBy === 'score') {
        return (b.investorInnovationScore ?? 0) - (a.investorInnovationScore ?? 0);
      }
      if (sortBy === 'responseSpeed') {
        return computeResponseSpeedScore(a) - computeResponseSpeedScore(b);
      }
      return 0;
    });
    return sorted;
  }, [bids, sortBy, filterActive]);

  const bestOffer = useMemo(() => {
    if (filtered.length === 0) return null;
    // Best = highest amount-to-equity ratio (virtual valuation favours founder).
    let best = filtered[0];
    let bestRatio = -Infinity;
    for (const b of filtered) {
      const amount = b.counterAmount ?? b.proposedAmount;
      const equity = b.counterEquity ?? b.proposedEquity;
      if (equity <= 0) continue;
      const ratio = amount / equity;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = b;
      }
    }
    return best;
  }, [filtered]);

  return (
    <Card className={className ? `${className} p-5` : 'p-5'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Side-by-Side Bid Comparison
          </div>
          <div className="mt-1 text-sm text-slate-400">
            {filtered.length} {filtered.length === 1 ? 'bid' : 'bids'}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setFilterActive((v) => !v)}
            className={`rounded-full border px-3 py-1 ${
              filterActive
                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                : 'border-slate-700 bg-slate-900 text-slate-400'
            }`}
          >
            Active only
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-300"
          >
            <option value="amount">Sort: Amount (high)</option>
            <option value="equity">Sort: Equity (low)</option>
            <option value="score">Sort: Investor score</option>
            <option value="responseSpeed">Sort: Response speed</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-900 p-6 text-center text-sm text-slate-400">
          No bids match the current filter.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.15em] text-slate-500">
                <th className="py-2 pr-3">Investor</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2 pr-3">Equity</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2 pr-3">Speed</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((bid) => {
                const amount = bid.counterAmount ?? bid.proposedAmount;
                const equity = bid.counterEquity ?? bid.proposedEquity;
                const isBest = bestOffer?._id === bid._id;
                return (
                  <tr
                    key={bid._id}
                    className={`border-t border-slate-800 ${
                      isBest ? 'bg-emerald-500/5' : 'hover:bg-slate-900/60'
                    }`}
                    onClick={() => onSelect?.(bid)}
                    role={onSelect ? 'button' : undefined}
                  >
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-cyan-300">
                          {bid.investorName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-white">{bid.investorName}</div>
                          {isBest ? (
                            <Badge className="mt-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                              Best Offer
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-slate-300">
                      {bid.bidType === 'sole' ? 'Sole' : 'Penny'}
                    </td>
                    <td className="py-3 pr-3 font-semibold text-white">{formatINR(amount)}</td>
                    <td className="py-3 pr-3 text-slate-300">{equity}%</td>
                    <td className="py-3 pr-3 text-slate-300">
                      {bid.investorInnovationScore ?? 0}
                    </td>
                    <td className="py-3 pr-3 text-slate-400">
                      {bid.viewedAt
                        ? `${Math.round(computeResponseSpeedScore(bid))}h`
                        : 'unread'}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                        {bid.status}
                      </Badge>
                    </td>
                    <td className="py-3 pr-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1">
                        {onAccept && isActive(bid.status) ? (
                          <button
                            type="button"
                            onClick={() => onAccept(bid)}
                            className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
                          >
                            Accept
                          </button>
                        ) : null}
                        {onCounter && isActive(bid.status) ? (
                          <button
                            type="button"
                            onClick={() => onCounter(bid)}
                            className="rounded-md border border-purple-500/40 bg-purple-500/10 px-2 py-1 text-xs font-semibold text-purple-300 hover:bg-purple-500/20"
                          >
                            Counter
                          </button>
                        ) : null}
                        {onReject && isActive(bid.status) ? (
                          <button
                            type="button"
                            onClick={() => onReject(bid)}
                            className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                          >
                            Reject
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

export default BidComparisonTable;
