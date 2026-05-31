import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  FileSignature,
  HandCoins,
  Handshake,
  PenLine,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { biddingApi, type BidDetailView } from '../../api/bidding.api';
import { investorApi } from '../../api/investor.api';
import { agreementApi } from '../../api/agreement.api';
import { dealApi } from '../../api/deal.api';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types/roles.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { Spinner } from '../ui/Spinner';

const formatINR = (value?: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value ?? 0);

const STATUS_LABEL: Record<BidDetailView['status'], string> = {
  pending: 'Offer sent',
  viewed: 'Offer under review',
  negotiating: 'Negotiating',
  countered: 'Counter-offer sent',
  accepted: 'Offer accepted',
  rejected: 'Declined',
  expired: 'Expired',
  closed: 'Closed',
};

const ACTIVE_STATUSES: BidDetailView['status'][] = [
  'pending',
  'viewed',
  'negotiating',
  'countered',
];

type Props = {
  startupId: string;
  counterpartyId: string;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full overflow-hidden rounded-[1.35rem] border border-emerald-400/25 bg-gradient-to-br from-emerald-500/12 via-slate-900 to-slate-950">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
        <HandCoins className="h-3.5 w-3.5" />
        Funding & Investment
      </div>
      <div className="space-y-3 px-4 py-3">{children}</div>
    </div>
  );
}

function TermsRow({ amount, equity, label }: { amount?: number; equity?: number; label: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label} amount</p>
        <p className="mt-0.5 font-semibold text-white">{formatINR(amount)}</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label} equity</p>
        <p className="mt-0.5 font-semibold text-white">{equity ?? 0}%</p>
      </div>
    </div>
  );
}

function OfferForm({
  title,
  initialAmount,
  initialEquity,
  showType,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  title: string;
  initialAmount?: number;
  initialEquity?: number;
  showType?: boolean;
  busy: boolean;
  submitLabel: string;
  onSubmit: (values: {
    amount: number;
    equity: number;
    investorType: 'penny' | 'sole';
    role: 'shareholder' | 'director' | 'observer';
  }) => void;
  onCancel?: () => void;
}) {
  const [amount, setAmount] = useState(String(initialAmount ?? 20000));
  const [equity, setEquity] = useState(String(initialEquity ?? 2));
  const [investorType, setInvestorType] = useState<'penny' | 'sole'>('penny');
  const [role, setRole] = useState<'shareholder' | 'director' | 'observer'>('shareholder');

  const numericAmount = Number(amount);
  const numericEquity = Number(equity);
  const valid = numericAmount >= 20000 && numericEquity > 0 && numericEquity <= 100;

  return (
    <div className="space-y-3 rounded-xl border border-emerald-400/20 bg-black/20 p-3">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-slate-400">Amount (INR)</span>
          <input
            type="number"
            min={20000}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-slate-400">Equity (%)</span>
          <input
            type="number"
            min={0.01}
            max={100}
            step={0.1}
            value={equity}
            onChange={(e) => setEquity(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
          />
        </label>
      </div>
      {showType ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-400">Type</span>
            <select
              value={investorType}
              onChange={(e) => setInvestorType(e.target.value as 'penny' | 'sole')}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
            >
              <option value="penny">Penny (portfolio)</option>
              <option value="sole">Sole (lead)</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-400">Role</span>
            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as 'shareholder' | 'director' | 'observer')
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
            >
              <option value="shareholder">Shareholder</option>
              <option value="director">Director</option>
              <option value="observer">Observer</option>
            </select>
          </label>
        </div>
      ) : null}
      <div className="flex gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          disabled={!valid || busy}
          onClick={() => onSubmit({ amount: numericAmount, equity: numericEquity, investorType, role })}
          className="flex-[2] rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-40"
        >
          {busy ? 'Working…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

export function ChatInvestmentNegotiation({ startupId, counterpartyId }: Props) {
  const currentUser = useAuthStore((s) => s.user);
  const currentUserId = currentUser?._id;
  const isInvestor = currentUser?.role === UserRole.INVESTOR;
  const isFounder = currentUser?.role === UserRole.STUDENT;
  const queryClient = useQueryClient();
  const [showCounter, setShowCounter] = useState(false);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['chat-investment'] });
    queryClient.invalidateQueries({ queryKey: ['startup-bids', startupId] });
    queryClient.invalidateQueries({ queryKey: ['investor-bids'] });
  };

  const bidQuery = useQuery({
    queryKey: ['chat-investment', 'bid', startupId, counterpartyId, currentUserId],
    enabled: Boolean(startupId && (isInvestor || isFounder)),
    refetchInterval: 8000,
    queryFn: async () => {
      const items: BidDetailView[] = isFounder
        ? (await biddingApi.getStartupBids(startupId)).data.data.items
        : (await biddingApi.getInvestorBids()).data.data.items;
      const matches = items
        .filter((b) =>
          isFounder ? b.investorId === counterpartyId : b.startupId === startupId,
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return matches[0] ?? null;
    },
  });

  const bid = bidQuery.data ?? null;

  const agreementQuery = useQuery({
    queryKey: ['chat-investment', 'agreement', bid?._id],
    enabled: Boolean(bid && bid.status === 'accepted'),
    refetchInterval: 8000,
    queryFn: async () => (await agreementApi.getByBid(bid!._id)).data.data,
  });
  const agreement = agreementQuery.data ?? null;

  const dealQuery = useQuery({
    queryKey: ['chat-investment', 'deal', bid?.dealId, currentUserId],
    enabled: Boolean(bid?.dealId && bid?.status === 'accepted'),
    refetchInterval: 8000,
    queryFn: async () => {
      if (isFounder) {
        const res = await dealApi.getMyDeals();
        return res.items.find((d) => d._id === bid!.dealId) ?? null;
      }
      const groups = await dealApi.getInvestorDeals();
      return groups.flatMap((g) => g.deals).find((d) => d._id === bid!.dealId) ?? null;
    },
  });
  const deal = dealQuery.data ?? null;

  // Founders must view a pending offer before they can accept or counter it.
  const markViewedMutation = useMutation({
    mutationFn: (bidId: string) => biddingApi.markViewed(bidId),
    onSuccess: () => bidQuery.refetch(),
  });
  useEffect(() => {
    if (isFounder && bid && bid.status === 'pending' && !markViewedMutation.isPending) {
      markViewedMutation.mutate(bid._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFounder, bid?._id, bid?.status]);

  const offerMutation = useMutation({
    mutationFn: (values: {
      amount: number;
      equity: number;
      investorType: 'penny' | 'sole';
      role: 'shareholder' | 'director' | 'observer';
    }) => {
      const payload = {
        investorType: values.investorType,
        proposedAmountINR: values.amount,
        proposedEquityPercent: values.equity,
        chosenRole: values.role,
      };
      return values.investorType === 'sole'
        ? investorApi.expressSoleInterest(startupId, payload)
        : investorApi.expressInterest(startupId, payload);
    },
    onSuccess: () => {
      toast.success('Offer sent to the founder.');
      invalidateAll();
      void bidQuery.refetch();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not send your offer right now.')),
  });

  const counterMutation = useMutation({
    mutationFn: (values: { amount: number; equity: number }) =>
      biddingApi.counterBid(bid!._id, {
        counterAmount: values.amount,
        counterEquity: values.equity,
      }),
    onSuccess: () => {
      toast.success('Counter-offer sent.');
      setShowCounter(false);
      invalidateAll();
      void bidQuery.refetch();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not send the counter-offer.')),
  });

  const respondMutation = useMutation({
    mutationFn: (decision: 'accepted' | 'rejected') =>
      biddingApi.respondToBid(bid!._id, { decision }),
    onSuccess: () => {
      invalidateAll();
      void bidQuery.refetch();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not record your response.')),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: () => agreementApi.acknowledge(agreement!._id),
    onSuccess: () => {
      toast.success('Agreement signed.');
      void agreementQuery.refetch();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not sign the agreement.')),
  });

  const confirmTermsMutation = useMutation({
    mutationFn: () => dealApi.agreeNegotiationTerms(bid!.dealId!),
    onSuccess: () => {
      toast.success('Investment terms confirmed. Equity updated on your cap table.');
      void dealQuery.refetch();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not confirm the terms.')),
  });

  const currentTerms = useMemo(() => {
    if (!bid) return { amount: 0, equity: 0 };
    return {
      amount: bid.finalAmount ?? bid.counterAmount ?? bid.proposedAmount,
      equity: bid.finalEquity ?? bid.counterEquity ?? bid.proposedEquity,
    };
  }, [bid]);

  if (!isInvestor && !isFounder) return null;

  if (bidQuery.isLoading) {
    return (
      <Shell>
        <div className="flex justify-center py-2">
          <Spinner />
        </div>
      </Shell>
    );
  }

  // No offer placed yet.
  if (!bid) {
    return (
      <Shell>
        {isInvestor ? (
          <>
            <p className="text-sm text-slate-300">
              Ready to back this startup? Send your investment offer below — the founder can
              accept, counter, or negotiate right here.
            </p>
            <OfferForm
              title="Make an investment offer"
              showType
              busy={offerMutation.isPending}
              submitLabel="Send offer"
              onSubmit={(values) => offerMutation.mutate(values)}
            />
          </>
        ) : (
          <p className="text-sm text-slate-300">
            Funding requested. Waiting for the investor to send an investment offer. You&apos;ll be
            able to accept or negotiate it here.
          </p>
        )}
      </Shell>
    );
  }

  const isActive = ACTIVE_STATUSES.includes(bid.status);
  const bothSigned = Boolean(
    agreement?.acknowledgedByInvestorAt && agreement?.acknowledgedByFounderAt,
  );
  const myAck = isInvestor
    ? Boolean(agreement?.acknowledgedByInvestorAt)
    : Boolean(agreement?.acknowledgedByFounderAt);
  const termsAgreed = deal?.negotiation?.status === 'terms_agreed' || (deal?.currentStage ?? 0) >= 1;

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">
          {STATUS_LABEL[bid.status] ?? bid.status}
        </span>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-200 capitalize">
          {bid.bidType} · {bid.investorRole}
        </span>
      </div>

      <TermsRow
        amount={currentTerms.amount}
        equity={currentTerms.equity}
        label={bid.status === 'accepted' ? 'Final' : 'Current'}
      />

      {/* Active negotiation */}
      {isActive ? (
        showCounter ? (
          <OfferForm
            title="Send a counter-offer"
            initialAmount={currentTerms.amount}
            initialEquity={currentTerms.equity}
            busy={counterMutation.isPending}
            submitLabel="Send counter-offer"
            onSubmit={(values) => counterMutation.mutate(values)}
            onCancel={() => setShowCounter(false)}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {isFounder ? (
              <button
                type="button"
                disabled={respondMutation.isPending || markViewedMutation.isPending}
                onClick={() => respondMutation.mutate('accepted')}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-40"
              >
                <Check className="h-4 w-4" /> Accept
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowCounter(true)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            >
              <PenLine className="h-4 w-4" /> Counter
            </button>
            {isFounder ? (
              <button
                type="button"
                disabled={respondMutation.isPending}
                onClick={() => respondMutation.mutate('rejected')}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
              >
                <X className="h-4 w-4" /> Decline
              </button>
            ) : null}
          </div>
        )
      ) : null}

      {isActive && isInvestor ? (
        <p className="text-xs text-slate-400">
          Waiting for the founder to accept or respond to your offer.
        </p>
      ) : null}

      {/* Accepted → agreement */}
      {bid.status === 'accepted' ? (
        agreementQuery.isLoading ? (
          <div className="flex justify-center py-1">
            <Spinner />
          </div>
        ) : !agreement ? (
          <p className="text-xs text-slate-400">Generating your virtual agreement…</p>
        ) : (
          <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <FileSignature className="h-4 w-4 text-emerald-300" />
              {agreement.agreementNumber}
            </div>
            <div className="text-xs text-slate-400">
              <div>
                Investor: {agreement.acknowledgedByInvestorAt ? '✓ signed' : 'pending signature'}
              </div>
              <div>
                Founder: {agreement.acknowledgedByFounderAt ? '✓ signed' : 'pending signature'}
              </div>
            </div>
            {!myAck ? (
              <button
                type="button"
                disabled={acknowledgeMutation.isPending}
                onClick={() => acknowledgeMutation.mutate()}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-40"
              >
                <PenLine className="h-4 w-4" /> Sign agreement
              </button>
            ) : (
              <Link
                to={`/agreements/${agreement._id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300 hover:text-emerald-200"
              >
                View full agreement <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )
      ) : null}

      {/* Both signed → founder confirms terms → cap table */}
      {bid.status === 'accepted' && bothSigned ? (
        termsAgreed ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            <CheckCircle2 className="h-4 w-4" />
            Deal is live — equity is reflected on the cap table.
          </div>
        ) : isFounder ? (
          <button
            type="button"
            disabled={confirmTermsMutation.isPending}
            onClick={() => confirmTermsMutation.mutate()}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-40"
          >
            <Handshake className="h-4 w-4" /> Confirm investment terms
          </button>
        ) : (
          <p className="text-xs text-slate-400">
            Both parties signed. Waiting for the founder to confirm the final terms.
          </p>
        )
      ) : null}

      {bid.status === 'rejected' ? (
        <p className="text-xs text-red-300">This offer was declined.</p>
      ) : null}
      {bid.status === 'expired' || bid.status === 'closed' ? (
        <p className="text-xs text-slate-400">This offer is no longer active.</p>
      ) : null}
    </Shell>
  );
}

export default ChatInvestmentNegotiation;
