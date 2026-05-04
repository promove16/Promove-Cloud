import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Users,
  User,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  Gavel,
  ChevronDown,
  ChevronUp,
  Star,
  Loader2,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import { isAxiosError } from 'axios';
import { dealApi } from '../../api/deal.api';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { PlaceBidModal } from './PlaceBidModal';
import { NegotiationPanel } from '../investor/NegotiationPanel';
import type { BidBoardSoleBid, DealDetailView, InvestorType } from '../../types/deal.types';

interface StartupBidDrawerProps {
  startupId: string | null;
  open: boolean;
  isFounder?: boolean;
  onClose: () => void;
}

const formatInr = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const getErrorMessage = (error: unknown) => {
  if (isAxiosError<{ error?: { message?: string } }>(error)) {
    return error.response?.data?.error?.message ?? 'Action failed.';
  }
  return error instanceof Error ? error.message : 'Action failed.';
};

const SCORE_MAX = 1000;

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, (score / SCORE_MAX) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-400">
        {score}/{SCORE_MAX}
      </span>
    </div>
  );
}

function PennyPoolSection({
  board,
  onBid,
  deal,
  isDealLoading,
  isFounder,
}: {
  board: NonNullable<ReturnType<typeof useBidBoard>['data']>;
  onBid: () => void;
  deal?: DealDetailView | null;
  isDealLoading?: boolean;
  isFounder?: boolean;
}) {
  const { pennyPool, acceptsPennyInvestors, currentUserBid } = board;
  const poolPct = pennyPool.maxInvestors > 0 ? Math.round((pennyPool.investorCount / pennyPool.maxInvestors) * 100) : 0;
  const amountPct = board.fundingTarget && board.fundingTarget > 0
    ? Math.min(100, Math.round((pennyPool.totalRaised / board.fundingTarget) * 100))
    : null;

  const [expanded, setExpanded] = useState(false);
  const currentUserPennyContributor = pennyPool.contributors.find((contributor) => contributor.isCurrentUser);
  const userInPool = currentUserBid?.investorType === 'penny' || Boolean(currentUserPennyContributor);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-cyan-400" />
          <h3 className="font-semibold text-white">Penny Investor Pool</h3>
        </div>
        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
          {pennyPool.investorCount} / {pennyPool.maxInvestors} investors
        </span>
      </div>

      {/* Pool fill bar (Kickstarter-style) */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
          <span>{formatInr(pennyPool.totalRaised)} raised</span>
          {amountPct !== null && <span>{amountPct}% of target</span>}
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-700"
            style={{ width: `${poolPct}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
          <span>{poolPct}% slots filled</span>
          <span>{pennyPool.maxInvestors - pennyPool.investorCount} open</span>
        </div>
      </div>

      {/* Contributors list */}
      {pennyPool.contributors.length > 0 && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between text-xs text-slate-400 hover:text-slate-300"
          >
            <span>Contributors ({pennyPool.contributors.length})</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              {pennyPool.contributors.map((c) => (
                <div
                  key={c.bidId}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                    c.isCurrentUser
                      ? 'border border-cyan-500/30 bg-cyan-500/10'
                      : 'bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <span className={c.isCurrentUser ? 'font-medium text-cyan-300' : 'text-slate-300'}>
                      {c.isCurrentUser ? 'You' : c.name}
                    </span>
                    <ScoreBar score={c.innovationScore} />
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-white">{formatInr(c.amountINR)}</div>
                    <div className="text-xs text-slate-500">{c.equityPercent}% equity</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {userInPool ? (
        <div className="border-t border-slate-800 pt-4">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">Bid Negotiation</span>
            <span className="ml-auto rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
              In Pool
            </span>
          </div>
          {isDealLoading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : deal ? (
            <NegotiationPanel deal={deal} isInvestor={!isFounder} />
          ) : (
            <p className="py-4 text-center text-sm text-slate-500">
              Could not load negotiation details.
            </p>
          )}
        </div>
      ) : acceptsPennyInvestors ? (
        <Button onClick={onBid} className="w-full">
          Join Penny Pool
        </Button>
      ) : (
        <div className="rounded-lg bg-slate-800 px-4 py-3 text-center text-sm text-slate-500">
          Penny investor pool is full
        </div>
      )}
    </div>
  );
}

function SoleBidCard({
  bid,
  isFounder,
  onAccept,
  isAccepting,
}: {
  bid: BidBoardSoleBid;
  isFounder: boolean;
  onAccept: (bidId: string) => void;
  isAccepting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusColors = {
    pending: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    accepted: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    rejected: 'text-red-400 bg-red-500/10 border-red-500/30',
  };
  const statusIcons = {
    pending: <Clock className="h-3.5 w-3.5" />,
    accepted: <CheckCircle2 className="h-3.5 w-3.5" />,
    rejected: <XCircle className="h-3.5 w-3.5" />,
  };

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        bid.isCurrentUser
          ? 'border-cyan-500/40 bg-cyan-500/5'
          : bid.founderDecisionStatus === 'accepted'
            ? 'border-emerald-500/40 bg-emerald-500/5'
            : 'border-slate-800 bg-slate-900'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-600 text-sm font-bold text-white">
            {bid.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${bid.isCurrentUser ? 'text-cyan-300' : 'text-white'}`}>
                {bid.isCurrentUser ? 'Your Bid' : bid.name}
              </span>
              <span
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${statusColors[bid.founderDecisionStatus]}`}
              >
                {statusIcons[bid.founderDecisionStatus]}
                {bid.founderDecisionStatus}
              </span>
            </div>
            <ScoreBar score={bid.innovationScore} />
          </div>
        </div>

        <div className="text-right">
          <div className="text-lg font-bold text-white">{formatInr(bid.amountINR)}</div>
          <div className="text-xs text-slate-400">{bid.equityPercent}% equity</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
        <span className="capitalize">{bid.role}</span>
        <span>·</span>
        <span>{formatDate(bid.placedAt)}</span>
        {bid.coverLetter && (
          <>
            <span>·</span>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-cyan-400 hover:text-cyan-300"
            >
              {expanded ? 'Hide pitch' : 'View pitch'}
            </button>
          </>
        )}
      </div>

      {expanded && bid.coverLetter && (
        <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-300">
          {bid.coverLetter}
        </div>
      )}

      {isFounder && bid.founderDecisionStatus === 'pending' && (
        <div className="mt-4">
          <Button
            onClick={() => onAccept(bid.bidId)}
            disabled={isAccepting}
            className="w-full bg-emerald-600 hover:bg-emerald-500"
          >
            {isAccepting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Accept This Bid
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

type BoardData = Awaited<ReturnType<typeof dealApi.getStartupBidBoard>>;

function useBidBoard(startupId: string | null) {
  return useQuery({
    queryKey: ['startup-bid-board', startupId],
    queryFn: () => dealApi.getStartupBidBoard(startupId!),
    enabled: Boolean(startupId),
    refetchInterval: 30_000,
  });
}

export function StartupBidDrawer({ startupId, open, isFounder = false, onClose }: StartupBidDrawerProps) {
  const queryClient = useQueryClient();
  const [bidModalType, setBidModalType] = useState<InvestorType | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [acceptingBidId, setAcceptingBidId] = useState<string | null>(null);

  const { data: board, isLoading, isError, error } = useBidBoard(startupId);

  const currentUserPennyBid = board?.pennyPool.contributors.find((contributor) => contributor.isCurrentUser);
  const currentUserSoleBid = board?.soleBids.find((bid) => bid.isCurrentUser);
  const currentUserBidType =
    board?.currentUserBid?.investorType ??
    (currentUserPennyBid ? 'penny' : currentUserSoleBid ? 'sole' : undefined);
  const currentUserBidStatus =
    board?.currentUserBid?.status ?? currentUserSoleBid?.founderDecisionStatus ?? 'pending';
  const dealId = board?.currentUserBid?.bidId ?? currentUserPennyBid?.bidId ?? currentUserSoleBid?.bidId ?? null;
  const hasCurrentUserBid = Boolean(dealId);

  const { data: deal, isLoading: isDealLoading } = useQuery<DealDetailView>({
    queryKey: ['deal', dealId],
    queryFn: () => dealApi.getMyDeal(dealId!),
    enabled: Boolean(dealId),
    refetchInterval: 30_000,
  });

  const acceptBidMutation = useMutation({
    mutationFn: (bidId: string) =>
      dealApi.respondToFounderDecision(bidId, { decision: 'accepted' }),
    onSuccess: async () => {
      setAcceptingBidId(null);
      setAcceptError(null);
      await queryClient.invalidateQueries({ queryKey: ['startup-bid-board', startupId] });
    },
    onError: (err) => {
      setAcceptingBidId(null);
      setAcceptError(getErrorMessage(err));
    },
  });

  const handleAcceptBid = (bidId: string) => {
    setAcceptError(null);
    setAcceptingBidId(bidId);
    acceptBidMutation.mutate(bidId);
  };

  if (!open || !startupId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-slate-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <Gavel className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 className="font-semibold text-white">
                {isLoading ? 'Loading...' : board?.startupName ?? 'Bid Board'}
              </h2>
              {board && (
                <p className="text-xs text-slate-400 line-clamp-1">{board.startupTagline}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : isError ? (
            <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              {getErrorMessage(error)}
            </div>
          ) : board ? (
            <div className="space-y-6">
              {/* Funding target banner */}
              {board.fundingTarget && (
                <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
                  <TrendingUp className="h-4 w-4 text-cyan-400" />
                  <span className="text-slate-300">
                    Funding target:{' '}
                    <span className="font-semibold text-white">{formatInr(board.fundingTarget)}</span>
                  </span>
                </div>
              )}

              {/* Upwork-style workflow strip */}
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs text-slate-400">
                <span className="font-medium text-cyan-300">Bid Placed</span>
                <span className="text-slate-600">→</span>
                <span>Founder Reviews</span>
                <span className="text-slate-600">→</span>
                <span>Decision</span>
                <span className="text-slate-600">→</span>
                <span>Negotiation</span>
                <span className="text-slate-600">→</span>
                <span>Deal Closed</span>
              </div>

              {/* Penny Pool */}
              <PennyPoolSection
                board={board}
                onBid={() => setBidModalType('penny')}
                deal={deal}
                isDealLoading={isDealLoading}
                isFounder={isFounder}
              />

              {/* Sole Investor Bids */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-amber-400" />
                    <h3 className="font-semibold text-white">Sole Investor Bids</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {board.hasSoleInvestorAccepted ? (
                      <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        Filled
                      </span>
                    ) : board.acceptsSoleInvestor ? (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                        {board.soleBids.length} bid{board.soleBids.length !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-500">
                        Not accepting
                      </span>
                    )}
                  </div>
                </div>

                {acceptError && (
                  <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {acceptError}
                  </div>
                )}

                {board.soleBids.length === 0 ? (
                  <div className="py-6 text-center">
                    <Star className="mx-auto mb-3 h-8 w-8 text-slate-700" />
                    <p className="text-sm text-slate-500">
                      {board.acceptsSoleInvestor
                        ? 'No sole bids yet. Be the first to pitch!'
                        : 'Sole investor slot is not open.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {board.soleBids.map((bid) => (
                      <SoleBidCard
                        key={bid.bidId}
                        bid={bid}
                        isFounder={isFounder}
                        onAccept={handleAcceptBid}
                        isAccepting={acceptingBidId === bid.bidId}
                      />
                    ))}
                  </div>
                )}

                {!board.hasSoleInvestorAccepted && board.acceptsSoleInvestor && !hasCurrentUserBid && (
                  <div className="mt-4">
                    <Button
                      variant="secondary"
                      onClick={() => setBidModalType('sole')}
                      className="w-full border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                    >
                      <Gavel className="h-4 w-4" />
                      Place Sole Investor Bid
                    </Button>
                  </div>
                )}

                {currentUserBidType === 'sole' && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Your bid is placed ({' '}
                    <span className="font-semibold capitalize">{currentUserBidStatus}</span>
                    {' '}) — negotiate your terms below.
                  </div>
                )}
              </div>
              {/* Bid Negotiation — shown below for sole investors (penny handles it inline above) */}
              {currentUserBidType === 'sole' && (
                <div className="rounded-2xl border border-violet-500/30 bg-slate-900 p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-violet-400" />
                      <h3 className="font-semibold text-white">Bid Negotiation</h3>
                    </div>
                    <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300 capitalize">
                      sole investor · {currentUserBidStatus}
                    </span>
                  </div>
                  {isDealLoading ? (
                    <div className="flex justify-center py-8">
                      <Spinner />
                    </div>
                  ) : deal ? (
                    <NegotiationPanel deal={deal} isInvestor={!isFounder} />
                  ) : (
                    <p className="py-4 text-center text-sm text-slate-500">
                      Could not load negotiation details.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Place Bid Modal */}
      {bidModalType && board && (
        <PlaceBidModal
          startupId={startupId}
          startupName={board.startupName}
          board={board}
          defaultType={bidModalType}
          onClose={() => setBidModalType(null)}
          onSuccess={() => {
            setBidModalType(null);
            queryClient.invalidateQueries({ queryKey: ['startup-bid-board', startupId] });
          }}
        />
      )}
    </>
  );
}
