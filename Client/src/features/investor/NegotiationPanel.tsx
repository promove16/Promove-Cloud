import { useRef, useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Send,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { dealApi } from '../../api/deal.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { getApiErrorMessage } from '../../utils/apiError';
import type { DealDetailView, DealNegotiation } from '../../types/deal.types';

interface OptimisticMessage {
  _id: string;
  senderId: string;
  senderRole: 'investor' | 'student';
  message: string;
  timestamp: string;
  _optimistic?: true;
  _failed?: boolean;
}

interface NegotiationPanelProps {
  deal: DealDetailView;
  isInvestor: boolean;
}

const formatInr = (amount: number) => `₹${amount.toLocaleString()}`;

const NEGOTIATION_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  initial: { label: 'Initial Terms', color: 'text-slate-400', bg: 'bg-slate-900' },
  terms_proposed: { label: 'Terms Proposed', color: 'text-amber-400', bg: 'bg-amber-900/20' },
  counter_offer: { label: 'Counter Offer', color: 'text-orange-400', bg: 'bg-orange-900/20' },
  terms_agreed: { label: 'Terms Agreed', color: 'text-emerald-400', bg: 'bg-emerald-900/20' },
  stalled: { label: 'Stalled', color: 'text-red-400', bg: 'bg-red-900/20' },
  cancelled: { label: 'Cancelled', color: 'text-slate-500', bg: 'bg-slate-900' },
};

export function NegotiationPanel({ deal, isInvestor }: NegotiationPanelProps) {
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  const [proposedAmount, setProposedAmount] = useState('');
  const [proposedEquity, setProposedEquity] = useState('');
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);

  const negotiation = deal.negotiation as DealNegotiation | undefined;
  const statusConfig = negotiation ? NEGOTIATION_STATUS_CONFIG[negotiation.status] : NEGOTIATION_STATUS_CONFIG['initial'];

  const allMessages: OptimisticMessage[] = [
    ...(negotiation?.messages ?? []),
    ...optimisticMessages.filter(
      (opt) => !(negotiation?.messages ?? []).some((m) => m.message === opt.message && m.senderRole === opt.senderRole && !opt._failed),
    ),
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length]);

  const sendMessageMutation = useMutation({
    mutationFn: (msg: string) => dealApi.sendNegotiationMessage(deal._id, msg),
    onSuccess: async (_data, sentMsg) => {
      setMessage('');
      setFailedMessage(null);
      setOptimisticMessages((prev) => prev.filter((m) => m.message !== sentMsg));
      setFeedback(null);
      await queryClient.invalidateQueries({ queryKey: ['deal', deal._id] });
      await queryClient.invalidateQueries({ queryKey: ['investor-deal', deal._id] });
      await queryClient.invalidateQueries({ queryKey: ['investor-deals'] });
    },
    onError: (error, sentMsg) => {
      setOptimisticMessages((prev) =>
        prev.map((m) => (m.message === sentMsg ? { ...m, _failed: true } : m)),
      );
      setFailedMessage(sentMsg);
      setFeedback({
        type: 'error',
        message: getApiErrorMessage(error, 'Unable to send your message right now.'),
      });
    },
  });

  const proposeTermsMutation = useMutation({
    mutationFn: (payload: { amountINR: number; equityPercent: number }) => 
      dealApi.proposeNegotiationTerms(deal._id, payload),
    onSuccess: async () => {
      setShowProposalForm(false);
      setProposedAmount('');
      setProposedEquity('');
      setFeedback({ type: 'success', message: 'Terms updated.' });
      await queryClient.invalidateQueries({ queryKey: ['deal', deal._id] });
      await queryClient.invalidateQueries({ queryKey: ['investor-deal', deal._id] });
      await queryClient.invalidateQueries({ queryKey: ['investor-deals'] });
    },
    onError: (error) => {
      setFeedback({
        type: 'error',
        message: getApiErrorMessage(error, 'Unable to update the terms right now.'),
      });
    },
  });

  const agreeTermsMutation = useMutation({
    mutationFn: () => dealApi.agreeNegotiationTerms(deal._id),
    onSuccess: async () => {
      setFeedback(null);
      await queryClient.invalidateQueries({ queryKey: ['deal', deal._id] });
      await queryClient.invalidateQueries({ queryKey: ['investor-deal', deal._id] });
      await queryClient.invalidateQueries({ queryKey: ['investor-deals'] });
      await queryClient.invalidateQueries({ queryKey: ['startup-bid-board', deal.startupId] });
      await queryClient.invalidateQueries({ queryKey: ['startup-bid-board', deal.startupId] });
    },
    onError: (error) => {
      setFeedback({
        type: 'error',
        message: getApiErrorMessage(error, 'Unable to agree to the current terms right now.'),
      });
    },
  });

  const cancelDealMutation = useMutation({
    mutationFn: () =>
      dealApi.cancelDeal(deal._id, {
        reason: cancelReason.trim() || undefined,
      }),
    onSuccess: async () => {
      setShowCancelForm(false);
      setCancelReason('');
      setFeedback({ type: 'success', message: 'Deal cancelled.' });
      await queryClient.invalidateQueries({ queryKey: ['deal', deal._id] });
      await queryClient.invalidateQueries({ queryKey: ['investor-deal', deal._id] });
      await queryClient.invalidateQueries({ queryKey: ['investor-deals'] });
      await queryClient.invalidateQueries({ queryKey: ['startup-bid-board', deal.startupId] });
    },
    onError: (error) => {
      setFeedback({
        type: 'error',
        message: getApiErrorMessage(error, 'Unable to cancel this deal right now.'),
      });
    },
  });

  const handleSendMessage = () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setFeedback(null);
    setFailedMessage(null);

    const optimistic: OptimisticMessage = {
      _id: `opt-${Date.now()}`,
      senderId: '',
      senderRole: isInvestor ? 'investor' : 'student',
      message: trimmed,
      timestamp: new Date().toISOString(),
      _optimistic: true,
    };
    setOptimisticMessages((prev) => [...prev, optimistic]);
    setMessage('');
    sendMessageMutation.mutate(trimmed);
  };

  const handleRetry = () => {
    if (!failedMessage) return;
    setOptimisticMessages((prev) => prev.filter((m) => m._failed));
    setFeedback(null);

    const optimistic: OptimisticMessage = {
      _id: `opt-${Date.now()}`,
      senderId: '',
      senderRole: isInvestor ? 'investor' : 'student',
      message: failedMessage,
      timestamp: new Date().toISOString(),
      _optimistic: true,
    };
    setOptimisticMessages((prev) => [...prev.filter((m) => !m._failed), optimistic]);
    sendMessageMutation.mutate(failedMessage);
    setFailedMessage(null);
  };

  const handleProposeTerms = () => {
    const amount = parseFloat(proposedAmount);
    const equity = parseFloat(proposedEquity);
    
    if (!(amount >= 20000 && equity > 0 && equity <= 100)) {
      setFeedback({ type: 'error', message: 'Enter a valid amount and equity split before sending terms.' });
      return;
    }

    if (deal.investorType === 'penny' && equity > 5) {
      setFeedback({ type: 'error', message: 'Penny investors cannot request more than 5% equity.' });
      return;
    }

    if (deal.investorType === 'sole' && deal.investorRole === 'director' && equity < 51) {
      setFeedback({ type: 'error', message: 'Director role requires at least 51% equity.' });
      return;
    }

    setFeedback(null);
    proposeTermsMutation.mutate({ amountINR: amount, equityPercent: equity });
  };

  const hasAgreed = negotiation?.status === 'terms_agreed';
  const isCancelled = deal.status === 'cancelled' || negotiation?.status === 'cancelled';
  const isAdminReviewPending = deal.currentStage === 3 && deal.adminApprovalRequired && !deal.adminApprovedAt;
  const myAgreed = isInvestor ? negotiation?.investorAgreed : negotiation?.startupAgreed;
  const isCounterOffer = negotiation?.status === 'counter_offer';
  const hasCounterOffer =
    typeof negotiation?.studentCounterAmount === 'number' &&
    typeof negotiation?.studentCounterEquity === 'number';
  const hasFinalTerms =
    typeof negotiation?.finalAgreedAmount === 'number' &&
    typeof negotiation?.finalAgreedEquity === 'number';
  const activeTerms = hasFinalTerms
    ? {
        amount: negotiation.finalAgreedAmount!,
        equity: negotiation.finalAgreedEquity!,
        label: 'Agreed Terms',
        tone: 'emerald' as const,
      }
    : hasCounterOffer
      ? {
          amount: negotiation.studentCounterAmount!,
          equity: negotiation.studentCounterEquity!,
          label: isInvestor ? 'Startup Counter Offer' : 'Your Counter Offer',
          tone: 'orange' as const,
        }
      : typeof negotiation?.investorProposedAmount === 'number' &&
          typeof negotiation?.investorProposedEquity === 'number'
        ? {
            amount: negotiation.investorProposedAmount,
            equity: negotiation.investorProposedEquity,
            label: isInvestor ? 'Your Proposed Terms' : 'Investor Proposed Terms',
            tone: 'cyan' as const,
          }
        : {
            amount: deal.amountINR,
            equity: deal.equityPercent,
            label: 'Initial Bid Terms',
            tone: 'slate' as const,
          };
  const canPropose = deal.currentStage === 0 && !hasAgreed && !isCancelled;
  const hasTerms =
    typeof negotiation?.investorProposedAmount === 'number' || hasCounterOffer;
  const isInvestorCounterOffer = isInvestor && isCounterOffer && hasCounterOffer;
  const canAgree =
    deal.currentStage === 0 &&
    hasTerms &&
    !hasAgreed &&
    !myAgreed &&
    !isCancelled;
  const canCancel = deal.status === 'active' && deal.currentStage < 4 && !deal.adminApprovedAt;
  const proposalActionLabel = showProposalForm
    ? 'Cancel'
    : isInvestorCounterOffer
      ? 'Renegotiate'
      : isInvestor
        ? hasTerms
          ? myAgreed
            ? 'Revise Terms'
            : 'Update Terms'
          : 'Propose Terms'
        : myAgreed
          ? 'Revise Counter'
          : isCounterOffer
          ? 'Counter Again'
          : 'Make Counter Offer';
  const proposalFormTitle = isInvestorCounterOffer
    ? 'Renegotiate Counter Offer'
    : isInvestor
      ? hasTerms
        ? 'Update Proposed Terms'
        : 'Propose New Terms'
      : 'Make a Counter Offer';

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className={`rounded-xl border border-slate-800 p-4 ${statusConfig.bg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isCancelled ? (
              <XCircle className="h-5 w-5 text-red-400" />
            ) : hasAgreed ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <Clock className="h-5 w-5 text-amber-400" />
            )}
            <span className={`font-medium ${statusConfig.color}`}>{statusConfig.label}</span>
          </div>
          {isCancelled ? (
            <span className="text-sm text-red-400">Deal cancelled</span>
          ) : hasAgreed && (
            <span className="text-sm text-emerald-400">Both parties agreed on terms</span>
          )}
        </div>
      </div>

      {myAgreed && !hasAgreed && !isCancelled && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-900/10 px-4 py-3 text-sm text-amber-300">
          <Clock className="h-4 w-4 shrink-0" />
          You've accepted. Waiting for the {isInvestor ? 'startup' : 'investor'} to accept.
        </div>
      )}

      {hasAgreed && !isCancelled && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            isAdminReviewPending
              ? 'border-violet-500/30 bg-violet-900/10 text-violet-300'
              : 'border-cyan-500/30 bg-cyan-900/10 text-cyan-300'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {isAdminReviewPending
            ? 'Both parties agreed. Deal submitted to admin approval for share-transfer review.'
            : 'Both parties agreed. The deal is ready to move into due diligence.'}
        </div>
      )}

      {isCancelled && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/10 px-4 py-3 text-sm text-red-300">
          <XCircle className="h-4 w-4 shrink-0" />
          This deal has been cancelled.
        </div>
      )}

      {/* Current Terms Display */}
      <Card className="border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Current Investment Terms
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-slate-950 p-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <DollarSign className="h-3.5 w-3.5" />
              Amount
            </div>
            <div className="mt-1 text-xl font-bold text-white">
              {formatInr(activeTerms.amount)}
            </div>
          </div>
          <div className="rounded-lg bg-slate-950 p-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <TrendingUp className="h-3.5 w-3.5" />
              Equity
            </div>
            <div className="mt-1 text-xl font-bold text-white">
              {activeTerms.equity}%
            </div>
          </div>
        </div>

        <div
          className={`mt-4 rounded-lg border p-3 ${
            activeTerms.tone === 'emerald'
              ? 'border-emerald-500/30 bg-emerald-900/10'
              : activeTerms.tone === 'orange'
                ? 'border-orange-500/30 bg-orange-900/10'
                : activeTerms.tone === 'cyan'
                  ? 'border-cyan-500/30 bg-cyan-900/10'
                  : 'border-slate-700 bg-slate-950'
          }`}
        >
          <div
            className={`flex items-center gap-2 text-sm ${
              activeTerms.tone === 'emerald'
                ? 'text-emerald-400'
                : activeTerms.tone === 'orange'
                  ? 'text-orange-400'
                  : activeTerms.tone === 'cyan'
                    ? 'text-cyan-400'
                    : 'text-slate-400'
            }`}
          >
            {activeTerms.tone === 'emerald' ? <CheckCircle2 className="h-4 w-4" /> : null}
            {activeTerms.label}
          </div>
          <div className="mt-1 text-base font-semibold text-white">
            {formatInr(activeTerms.amount)} / {activeTerms.equity}%
          </div>
        </div>
      </Card>

      {feedback?.type === 'success' ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-900/10 px-4 py-3 text-sm text-emerald-300">
          {feedback.message}
        </div>
      ) : null}

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {canAgree && (
          <Button
            onClick={() => agreeTermsMutation.mutate()}
            disabled={agreeTermsMutation.isPending}
            variant="outline"
            className="w-full flex-1 gap-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/20"
          >
            {agreeTermsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                {isInvestorCounterOffer ? 'Accept Counter Offer' : 'Accept Terms'}
              </>
            )}
          </Button>
        )}
        {canPropose && (
          <Button
            onClick={() => setShowProposalForm(!showProposalForm)}
            variant={isInvestorCounterOffer ? 'outline' : 'primary'}
            className="w-full flex-1 gap-2"
          >
            {showProposalForm ? (
              proposalActionLabel
            ) : isInvestorCounterOffer ? (
              <>
                <RotateCcw className="h-4 w-4" />
                {proposalActionLabel}
              </>
            ) : (
              proposalActionLabel
            )}
          </Button>
        )}
        {canCancel && (
          <Button
            onClick={() => setShowCancelForm((value) => !value)}
            variant="outline"
            className="w-full flex-1 gap-2 border-red-500/30 text-red-300 hover:bg-red-900/20"
          >
            <XCircle className="h-4 w-4" />
            {showCancelForm ? 'Keep Deal' : 'Cancel Deal'}
          </Button>
        )}
      </div>

      {showCancelForm && canCancel && (
        <Card className="border-red-500/30 bg-red-950/10 p-4">
          <h4 className="mb-3 font-semibold text-white">Cancel Deal</h4>
          <textarea
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Reason for cancellation (optional)"
            className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
          />
          <Button
            onClick={() => cancelDealMutation.mutate()}
            disabled={cancelDealMutation.isPending}
            variant="outline"
            className="mt-3 w-full border-red-500/30 text-red-300 hover:bg-red-900/20"
          >
            {cancelDealMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Cancel'}
          </Button>
        </Card>
      )}

      {/* Proposal Form */}
      {showProposalForm && (
        <Card className="border-amber-500/30 bg-amber-950/10 p-4">
          <h4 className="mb-4 font-semibold text-white">{proposalFormTitle}</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Amount (INR)</label>
              <Input
                type="number"
                min="20000"
                value={proposedAmount}
                onChange={(e) => setProposedAmount(e.target.value)}
                placeholder="20000"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Equity (%)</label>
              <Input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={proposedEquity}
                onChange={(e) => setProposedEquity(e.target.value)}
                placeholder="5"
              />
            </div>
          </div>
          <Button
            onClick={handleProposeTerms}
            disabled={!proposedAmount || !proposedEquity || proposeTermsMutation.isPending}
            className="mt-4 w-full"
          >
            {proposeTermsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
          </Button>
        </Card>
      )}

      {/* Messages Section */}
      <Card className="border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          <MessageSquare className="h-4 w-4" />
          Negotiation Room
        </h3>
        
        <div className="mb-4 max-h-64 space-y-3 overflow-y-auto">
          {allMessages.length === 0 ? (
            <div className="py-4 text-center text-sm text-slate-500">
              No negotiation messages yet.
            </div>
          ) : (
            allMessages.map((msg) => (
              <div
                key={msg._id}
                className={`rounded-lg p-3 ${
                  (msg as OptimisticMessage)._failed
                    ? 'ml-8 border border-red-500/30 bg-red-900/20'
                    : msg.senderRole === 'investor'
                      ? 'ml-8 border border-cyan-500/30 bg-cyan-900/20'
                      : 'mr-8 border border-amber-500/30 bg-amber-900/20'
                } ${(msg as OptimisticMessage)._optimistic && !(msg as OptimisticMessage)._failed ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${
                    (msg as OptimisticMessage)._failed
                      ? 'text-red-400'
                      : msg.senderRole === 'investor' ? 'text-cyan-400' : 'text-amber-400'
                  }`}>
                    {msg.senderRole === (isInvestor ? 'investor' : 'student')
                      ? 'You'
                      : isInvestor ? 'Student' : 'Investor'}
                    {(msg as OptimisticMessage)._optimistic && !(msg as OptimisticMessage)._failed && (
                      <span className="ml-2 text-slate-500">Sending...</span>
                    )}
                    {(msg as OptimisticMessage)._failed && (
                      <span className="ml-2 text-red-400">Failed to send</span>
                    )}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(msg.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-sm text-white">{msg.message}</p>
                {(msg as OptimisticMessage)._failed && (
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="mt-2 flex items-center gap-1 text-xs text-red-300 hover:text-red-200"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Retry
                  </button>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {feedback?.type === 'error' && (
          <div className="mb-3 flex items-center justify-between rounded-lg border border-red-500/30 bg-red-900/10 px-3 py-2 text-sm text-red-300">
            <span>{feedback.message}</span>
            {failedMessage && (
              <button
                type="button"
                onClick={handleRetry}
                className="flex items-center gap-1 text-xs font-medium text-red-200 hover:text-white"
              >
                <RotateCcw className="h-3 w-3" />
                Retry
              </button>
            )}
          </div>
        )}

        {/* Message Input */}
        <div className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write negotiation message..."
              disabled={isCancelled}
              onKeyDown={(e) => e.key === 'Enter' && !sendMessageMutation.isPending && !isCancelled && handleSendMessage()}
            />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || sendMessageMutation.isPending || isCancelled}
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </Card>

      {/* Founder Response Status */}
      {deal.currentStage > 0 && deal.founderDecision?.status === 'pending' && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-4 py-3 text-amber-300">
          <Clock className="h-4 w-4" />
          <span className="text-sm">Waiting for founder to respond to your interest</span>
        </div>
      )}

      {deal.currentStage > 0 && deal.founderDecision?.status === 'accepted' && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-3 text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm">Founder accepted the deal terms</span>
        </div>
      )}

      {deal.currentStage > 0 && deal.founderDecision?.status === 'rejected' && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-red-300">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Founder rejected the deal</span>
        </div>
      )}
    </div>
  );
}
