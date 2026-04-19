import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, TrendingUp, Users, User, ChevronDown, AlertCircle } from 'lucide-react';
import { isAxiosError } from 'axios';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { dealApi } from '../../api/deal.api';
import type { InvestorRole, InvestorType, PlaceBidPayload, StartupBidBoardResponse } from '../../types/deal.types';

interface PlaceBidModalProps {
  startupId: string;
  startupName: string;
  board: StartupBidBoardResponse;
  defaultType?: InvestorType;
  onClose: () => void;
  onSuccess: () => void;
}

const formatInr = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const getErrorMessage = (error: unknown) => {
  if (isAxiosError<{ error?: { message?: string } }>(error)) {
    return error.response?.data?.error?.message ?? 'Unable to place your bid right now.';
  }
  return error instanceof Error ? error.message : 'Unable to place your bid right now.';
};

const MIN_AMOUNT = 20_000;
const MAX_PENNY_AMOUNT = 500_000;

export function PlaceBidModal({ startupId, startupName, board, defaultType = 'penny', onClose, onSuccess }: PlaceBidModalProps) {
  const queryClient = useQueryClient();

  const [investorType, setInvestorType] = useState<InvestorType>(
    !board.acceptsPennyInvestors && board.acceptsSoleInvestor ? 'sole' : defaultType,
  );
  const [amount, setAmount] = useState('20000');
  const [equity, setEquity] = useState('2');
  const [role, setRole] = useState<InvestorRole>('observer');
  const [coverLetter, setCoverLetter] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset equity when switching types
  useEffect(() => {
    if (investorType === 'penny') {
      setEquity('2');
    } else {
      setEquity('10');
    }
  }, [investorType]);

  const placeBidMutation = useMutation({
    mutationFn: (payload: PlaceBidPayload) => dealApi.placeBid(startupId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['startup-bid-board', startupId] });
      onSuccess();
    },
    onError: (err) => {
      setError(getErrorMessage(err));
    },
  });

  const handleSubmit = () => {
    setError(null);
    const amountNum = Number(amount);
    const equityNum = Number(equity);

    if (!Number.isFinite(amountNum) || amountNum < MIN_AMOUNT) {
      setError(`Minimum bid is ${formatInr(MIN_AMOUNT)}.`);
      return;
    }

    if (investorType === 'penny' && amountNum > MAX_PENNY_AMOUNT) {
      setError(`Penny investor cap is ${formatInr(MAX_PENNY_AMOUNT)}.`);
      return;
    }

    if (!Number.isFinite(equityNum) || equityNum <= 0 || equityNum > 49) {
      setError('Equity must be between 0.01% and 49%.');
      return;
    }

    placeBidMutation.mutate({
      investorType,
      proposedAmountINR: amountNum,
      proposedEquityPercent: equityNum,
      chosenRole: role,
      coverLetter: coverLetter.trim() || undefined,
    });
  };

  const canPenny = board.acceptsPennyInvestors;
  const canSole = board.acceptsSoleInvestor && !board.hasSoleInvestorAccepted;
  const existingBid = board.currentUserBid;

  if (existingBid) {
    return (
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-6">
        <div className="mx-auto flex min-h-full items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl shadow-black/40">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-semibold text-white">Already Bidding</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-900 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            You already have an active {existingBid.investorType === 'penny' ? 'penny' : 'sole'} investor bid on{' '}
            <span className="text-white">{startupName}</span>. Status:{' '}
            <span
              className={
                existingBid.status === 'accepted'
                  ? 'text-emerald-400'
                  : existingBid.status === 'rejected'
                    ? 'text-red-400'
                    : 'text-amber-400'
              }
            >
              {existingBid.status}
            </span>
          </p>
          <Button className="mt-6 w-full" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-6">
      <div className="mx-auto flex min-h-full items-center justify-center">
      <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/40 sm:max-h-[calc(100vh-3rem)]">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-800 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Place Investment Bid</h2>
            <p className="text-sm text-slate-400">{startupName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-900 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-5">
          {/* Investor type selector */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Investor Type
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={!canPenny}
                onClick={() => setInvestorType('penny')}
                className={`rounded-xl border p-4 text-left transition-all ${
                  investorType === 'penny'
                    ? 'border-cyan-500/60 bg-cyan-500/10'
                    : canPenny
                      ? 'border-slate-700 hover:border-slate-600'
                      : 'cursor-not-allowed border-slate-800 opacity-40'
                }`}
              >
                <Users className={`mb-2 h-5 w-5 ${investorType === 'penny' ? 'text-cyan-400' : 'text-slate-500'}`} />
                <div className={`text-sm font-semibold ${investorType === 'penny' ? 'text-cyan-300' : 'text-white'}`}>
                  Penny Investor
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Join the pool — up to {board.pennyPool.maxInvestors} investors, small equity each
                </div>
                {!canPenny && (
                  <div className="mt-1 text-xs text-red-400">Pool full</div>
                )}
              </button>

              <button
                type="button"
                disabled={!canSole}
                onClick={() => setInvestorType('sole')}
                className={`rounded-xl border p-4 text-left transition-all ${
                  investorType === 'sole'
                    ? 'border-amber-500/60 bg-amber-500/10'
                    : canSole
                      ? 'border-slate-700 hover:border-slate-600'
                      : 'cursor-not-allowed border-slate-800 opacity-40'
                }`}
              >
                <User className={`mb-2 h-5 w-5 ${investorType === 'sole' ? 'text-amber-400' : 'text-slate-500'}`} />
                <div className={`text-sm font-semibold ${investorType === 'sole' ? 'text-amber-300' : 'text-white'}`}>
                  Sole Investor
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Exclusive bid — founder picks one, others get declined
                </div>
                {!canSole && (
                  <div className="mt-1 text-xs text-red-400">
                    {board.hasSoleInvestorAccepted ? 'Already filled' : 'Not accepting'}
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Amount + Equity */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Amount (INR) — min ₹20,000
              </label>
              <Input
                type="number"
                min={MIN_AMOUNT}
                max={investorType === 'penny' ? MAX_PENNY_AMOUNT : undefined}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="20000"
              />
              {investorType === 'penny' && (
                <div className="mt-1 text-xs text-slate-500">Cap: {formatInr(MAX_PENNY_AMOUNT)}</div>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Equity % — max 49%
              </label>
              <Input
                type="number"
                min={0.01}
                max={49}
                step={0.01}
                value={equity}
                onChange={(e) => setEquity(e.target.value)}
                placeholder="2"
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Your Role
            </label>
            <div className="relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as InvestorRole)}
                className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 pr-10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="observer">Observer — view progress, no voting</option>
                <option value="shareholder">Shareholder — voting rights</option>
                <option value="director">Director — board seat + veto rights</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Cover Letter */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Investment Pitch{' '}
              <span className="text-slate-600">(optional — shown to founder)</span>
            </label>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Why do you want to invest? What value do you bring beyond capital? (max 1000 chars)"
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <div className="mt-1 text-right text-xs text-slate-600">{coverLetter.length}/1000</div>
          </div>

          {/* Upwork-style info strip */}
          <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-xs text-slate-400">
            <div className="flex items-start gap-2">
              <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
              <span>
                {investorType === 'penny'
                  ? 'Your bid joins the penny pool. The founder sees all penny bids. No individual accept/reject — all penny bids are live unless the startup closes.'
                  : 'Your bid competes for the sole investor slot. The founder reviews all sole bids and accepts one — others are automatically declined when one is accepted.'}
              </span>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-800 px-5 py-4 sm:flex-row sm:px-6">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={placeBidMutation.isPending || (!canPenny && !canSole)}
            className="flex-1"
          >
            {placeBidMutation.isPending ? 'Placing Bid...' : 'Place Bid'}
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}
