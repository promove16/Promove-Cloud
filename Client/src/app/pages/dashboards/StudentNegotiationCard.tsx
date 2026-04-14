import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Send,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  ArrowRightCircle,
} from 'lucide-react';
import { dealApi } from '../../../api/deal.api';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card } from '../../../components/ui/Card';
import { getApiErrorMessage } from '../../../utils/apiError';
import type { DealSummaryView, DealNegotiation } from '../../../types/deal.types';

interface StudentNegotiationCardProps {
  deal: DealSummaryView;
  investorIndex: number;
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

export function StudentNegotiationCard({ deal, investorIndex }: StudentNegotiationCardProps) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [proposedAmount, setProposedAmount] = useState('');
  const [proposedEquity, setProposedEquity] = useState('');
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [error, setError] = useState('');

  const negotiation = deal.negotiation as DealNegotiation | undefined;
  const statusConfig = negotiation ? NEGOTIATION_STATUS_CONFIG[negotiation.status] : NEGOTIATION_STATUS_CONFIG['initial'];
  const investorName = deal.investorDisplayName || `Investor #${investorIndex + 1}`;
  const hasAgreed = negotiation?.status === 'terms_agreed';

  const sendMessageMutation = useMutation({
    mutationFn: (msg: string) => dealApi.sendNegotiationMessage(deal._id, msg),
    onSuccess: () => {
      setMessage('');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['student', 'active-deals'] });
    },
    onError: (mutationError) => {
      setError(getApiErrorMessage(mutationError, 'Unable to send your negotiation message right now.'));
    },
  });

  const counterOfferMutation = useMutation({
    mutationFn: (payload: { amountINR: number; equityPercent: number }) =>
      dealApi.counterOfferNegotiationTerms(deal._id, payload),
    onSuccess: () => {
      setShowProposalForm(false);
      setProposedAmount('');
      setProposedEquity('');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['student', 'active-deals'] });
    },
    onError: (mutationError) => {
      setError(getApiErrorMessage(mutationError, 'Unable to submit the counter-offer right now.'));
    },
  });

  const agreeTermsMutation = useMutation({
    mutationFn: () => dealApi.agreeNegotiationTerms(deal._id),
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['student', 'active-deals'] });
    },
    onError: (mutationError) => {
      setError(getApiErrorMessage(mutationError, 'Unable to accept the current terms right now.'));
    },
  });

  const handleSendMessage = () => {
    if (message.trim()) {
      setError('');
      sendMessageMutation.mutate(message.trim());
    }
  };

  const handleCounterOffer = () => {
    const amount = parseFloat(proposedAmount);
    const equity = parseFloat(proposedEquity);

    if (amount >= 20000 && equity > 0 && equity <= 100) {
      setError('');
      counterOfferMutation.mutate({ amountINR: amount, equityPercent: equity });
      return;
    }

    setError('Enter a valid amount and equity split before sending a counter-offer.');
  };

  const handleAcceptTerms = () => {
    agreeTermsMutation.mutate();
  };

  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-900 p-0">
      <div className="border-b border-slate-800 bg-slate-950 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-white">{investorName}</div>
            <div className="mt-0.5 text-xs text-slate-400">Startup: {deal.startupName}</div>
          </div>
          <div className={`rounded-full px-3 py-1 text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
            {statusConfig.label}
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-950 p-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <DollarSign className="h-3.5 w-3.5" />
              Proposed Amount
            </div>
            <div className="mt-1 text-lg font-bold text-white">
              {formatInr(negotiation?.investorProposedAmount || deal.amountINR)}
            </div>
          </div>
          <div className="rounded-lg bg-slate-950 p-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <TrendingUp className="h-3.5 w-3.5" />
              Proposed Equity
            </div>
            <div className="mt-1 text-lg font-bold text-white">
              {negotiation?.investorProposedEquity || deal.equityPercent}%
            </div>
          </div>
        </div>

        {negotiation?.studentCounterAmount && (
          <div className="rounded-lg border border-orange-500/30 bg-orange-900/10 p-3">
            <div className="text-xs text-orange-400">Your Counter Offer</div>
            <div className="mt-1 text-white font-medium">
              {formatInr(negotiation.studentCounterAmount)} / {negotiation.studentCounterEquity}%
            </div>
          </div>
        )}

        {negotiation?.finalAgreedAmount && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-900/10 p-3">
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Agreed Terms
            </div>
            <div className="mt-1 text-lg font-bold text-white">
              {formatInr(negotiation.finalAgreedAmount)} / {negotiation.finalAgreedEquity}%
            </div>
          </div>
        )}

        {hasAgreed && (
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-900/10 p-3">
            <div className="flex items-center gap-2 text-sm text-cyan-300">
              <CheckCircle2 className="h-4 w-4" />
              Terms agreed! Click below to proceed to due diligence.
            </div>
          </div>
        )}

        {!hasAgreed && (
          <div className="flex gap-2">
            <Button
              onClick={() => setShowProposalForm(!showProposalForm)}
              variant="outline"
              className="flex-1 border-amber-500/30 text-amber-400 hover:bg-amber-900/20"
              size="sm"
            >
              {showProposalForm ? 'Cancel' : 'Counter Offer'}
            </Button>
            {negotiation?.investorProposedAmount && (
              <Button
                onClick={handleAcceptTerms}
                variant="outline"
                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/20"
                size="sm"
                disabled={agreeTermsMutation.isPending}
              >
                Accept Terms
              </Button>
            )}
          </div>
        )}

        {showProposalForm && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/10 p-4 space-y-3">
            <div className="text-sm font-medium text-white">Submit Counter Offer</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Amount (INR)</label>
                <Input
                  type="number"
                  min="20000"
                  value={proposedAmount}
                  onChange={(e) => setProposedAmount(e.target.value)}
                  placeholder="25000"
                  className="h-9"
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
                  placeholder="8"
                  className="h-9"
                />
              </div>
            </div>
            <Button
              onClick={handleCounterOffer}
              disabled={!proposedAmount || !proposedEquity || counterOfferMutation.isPending}
              className="w-full"
              size="sm"
            >
              Submit Counter Offer
            </Button>
          </div>
        )}

        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400 mb-2">
            <MessageSquare className="h-3.5 w-3.5" />
            Messages
          </div>
          <div className="max-h-40 space-y-2 overflow-y-auto mb-3">
            {(!negotiation?.messages || negotiation.messages.length === 0) ? (
              <div className="py-2 text-center text-xs text-slate-500">
                No messages yet.
              </div>
            ) : (
              negotiation.messages.map((msg) => (
                <div
                  key={msg._id}
                  className={`rounded-lg p-2 text-sm ${
                    msg.senderRole === 'student'
                      ? 'ml-8 bg-amber-900/20 border border-amber-500/30'
                      : 'mr-8 bg-cyan-900/20 border border-cyan-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${
                      msg.senderRole === 'student' ? 'text-amber-400' : 'text-cyan-400'
                    }`}>
                      {msg.senderRole === 'student' ? 'You' : 'Investor'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(msg.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-white">{msg.message}</p>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || sendMessageMutation.isPending}
              size="sm"
              className="h-8 px-3"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {error ? <div className="rounded-lg border border-red-500/30 bg-red-900/10 px-3 py-2 text-sm text-red-300">{error}</div> : null}
      </div>
    </Card>
  );
}
