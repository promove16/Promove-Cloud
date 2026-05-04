import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Handshake,
  Link2,
  Loader2,
  TrendingUp,
  DollarSign,
  X,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { workspaceApi } from '../../../api/workspace.api';
import { dealApi } from '../../../api/deal.api';
import type { DealSummaryView } from '../../../types/deal.types';
import { DEAL_STAGE_META } from './dealStageMeta';

const formatINR = (value?: number) => {
  if (!value) return '–';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (value?: string) => {
  if (!value) return '–';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

interface LinkWorkspaceButtonProps {
  deal: DealSummaryView;
  onLink: (workspaceId: string) => void;
  isLinking: boolean;
  linkingWorkspaceId?: string;
}

function LinkWorkspaceButton({
  deal,
  onLink,
  isLinking,
  linkingWorkspaceId,
}: LinkWorkspaceButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const workspacesQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceApi.list,
    enabled: showModal,
  });
  const workspaces = (workspacesQuery.data ?? []).filter(
    (workspace) =>
      workspace.isActive &&
      (String(workspace.ownerId) === deal.studentId ||
        (workspace.teamMemberIds ?? []).some((id) => String(id) === deal.studentId)),
  );
  const linkedWorkspaceId = deal.productWorkshop?.workspaceId;

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        disabled={isLinking}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Link2 className="h-3.5 w-3.5" />
        {linkedWorkspaceId ? 'Change Workshop' : isLinking ? 'Linking…' : 'Link Workshop'}
      </button>

      {showModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Link Product Workshop</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 transition hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-400">
              Select a workspace to link to this deal. Investors will see the workshop in their
              Product Workshop view.
            </p>
            {workspacesQuery.isLoading ? (
              <div className="py-6 text-center text-sm text-slate-400">Loading workspaces…</div>
            ) : workspaces.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-center text-sm text-slate-400">
                No active workspaces found. Create one from the Problem Bank first.
              </div>
            ) : (
              <div className="space-y-2">
                {workspaces.map((workspace) => {
                  const isLinked = workspace._id === linkedWorkspaceId;
                  const isLinkingThis = isLinking && linkingWorkspaceId === workspace._id;

                  return (
                    <button
                      key={workspace._id}
                      type="button"
                      onClick={() => {
                        if (isLinked || isLinkingThis) return;
                        onLink(workspace._id);
                        setShowModal(false);
                      }}
                      disabled={isLinked || isLinkingThis}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        isLinked
                          ? 'border-emerald-500/30 bg-emerald-500/10'
                          : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-white">{workspace.title}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {workspace.category} · {workspace.progressPercent ?? 0}% complete
                          </div>
                        </div>
                        {isLinked ? (
                          <span className="text-xs font-semibold text-emerald-400">Linked</span>
                        ) : isLinkingThis ? (
                          <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

export interface DealCardProps {
  deal: DealSummaryView;
  index?: number;
  onRespond?: (decision: 'accepted' | 'rejected') => void;
  isResponding?: boolean;
  onLinkWorkshop?: (workspaceId: string) => void;
  isLinking?: boolean;
  linkingWorkspaceId?: string;
}

const formatINRAmount = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

export function DealCard({
  deal,
  index = 0,
  onRespond,
  isResponding = false,
  onLinkWorkshop,
  isLinking = false,
  linkingWorkspaceId,
}: DealCardProps) {
  const queryClient = useQueryClient();
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterEquity, setCounterEquity] = useState('');
  const [counterError, setCounterError] = useState<string | null>(null);

  const stage = DEAL_STAGE_META[deal.currentStage];
  const investorName = deal.investorDisplayName || `Investor #${index + 1}`;
  const canRespond =
    deal.currentStage === 1 &&
    deal.founderDecision.status === 'pending' &&
    deal.status === 'active' &&
    Boolean(onRespond);

  const negotiation = deal.negotiation;
  const termsAgreed = negotiation?.status === 'terms_agreed';
  const startupAlreadyAccepted = negotiation?.startupAgreed ?? false;
  const investorAlreadyAccepted = negotiation?.investorAgreed ?? false;
  const hasProposedTerms = !!negotiation?.investorProposedAmount;
  const isCounterOffer = negotiation?.status === 'counter_offer';
  const canAcceptTerms =
    deal.currentStage === 0 &&
    deal.status === 'active' &&
    hasProposedTerms &&
    !termsAgreed &&
    !startupAlreadyAccepted;
  const canCounter =
    deal.currentStage === 0 &&
    deal.status === 'active' &&
    hasProposedTerms &&
    !termsAgreed;

  const acceptTermsMutation = useMutation({
    mutationFn: () => dealApi.agreeNegotiationTerms(deal._id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['student-deals'] });
      await queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });

  const counterMutation = useMutation({
    mutationFn: (payload: { amountINR: number; equityPercent: number }) =>
      dealApi.proposeNegotiationTerms(deal._id, payload),
    onSuccess: async () => {
      setShowCounterForm(false);
      setCounterAmount('');
      setCounterEquity('');
      setCounterError(null);
      await queryClient.invalidateQueries({ queryKey: ['student-deals'] });
      await queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
    onError: () => {
      setCounterError('Unable to submit counter offer. Please try again.');
    },
  });

  const handleSubmitCounter = () => {
    const amount = parseFloat(counterAmount);
    const equity = parseFloat(counterEquity);
    if (!counterAmount || !counterEquity || amount < 20000 || equity <= 0 || equity > 100) {
      setCounterError('Enter a valid amount (min ₹20,000) and equity percentage.');
      return;
    }
    setCounterError(null);
    counterMutation.mutate({ amountINR: amount, equityPercent: equity });
  };
  const canLinkWorkshop =
    deal.status === 'active' && deal.currentStage >= 2 && Boolean(onLinkWorkshop);
  const hasLinkedWorkshop = Boolean(deal.productWorkshop);
  const StageIcon = stage.icon;

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-700">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-white">{investorName}</h3>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {deal.startupName} · {deal.investorType === 'sole' ? 'Sole investor' : 'Penny investor'}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${stage.badgeClassName}`}
        >
          <StageIcon className="h-3 w-3" />
          {stage.pipelineLabel}
        </span>
      </header>

      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
        <div className="flex items-center gap-2 text-sm text-slate-200">
          {stage.stage === 4 ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <Clock className="h-4 w-4 text-blue-400" />
          )}
          <span className="min-w-0 truncate">{deal.nextActionLabel}</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">{stage.description}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300">
            <Handshake className="h-3 w-3 text-cyan-400" />
            Founder:{' '}
            {deal.status !== 'active' && deal.founderDecision.status === 'pending'
              ? 'closed without response'
              : deal.founderDecision.status}
          </span>
          {deal.adminApprovedAt ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              Admin approved {formatDate(deal.adminApprovedAt)}
            </span>
          ) : deal.adminApprovalRequired ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300">
              <Clock className="h-3 w-3" />
              Awaiting admin approval
            </span>
          ) : null}
        </div>

        {deal.founderDecision.note ? (
          <p className="mt-3 text-xs leading-5 text-slate-400">
            <span className="font-semibold text-slate-300">Note:</span>{' '}
            {deal.founderDecision.note}
          </p>
        ) : null}
        {deal.stockTransfer.reviewNotes ? (
          <p className="mt-3 text-xs leading-5 text-amber-300">
            <span className="font-semibold">Admin note:</span> {deal.stockTransfer.reviewNotes}
          </p>
        ) : null}

        {canRespond ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isResponding}
              onClick={() => onRespond?.('accepted')}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Accept proposal
            </button>
            <button
              type="button"
              disabled={isResponding}
              onClick={() => onRespond?.('rejected')}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              Decline proposal
            </button>
          </div>
        ) : null}

        {/* Negotiation acceptance — stage 0 */}
        {deal.currentStage === 0 && hasProposedTerms ? (
          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-3">
            <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Proposed Terms</p>
            <div className="mb-3 flex gap-4">
              <span className="flex items-center gap-1 text-sm text-white">
                <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                {formatINRAmount(negotiation!.investorProposedAmount!)}
              </span>
              <span className="flex items-center gap-1 text-sm text-white">
                <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
                {negotiation!.investorProposedEquity}%
              </span>
            </div>

            {isCounterOffer && negotiation?.studentCounterAmount ? (
              <div className="mb-3 rounded-lg border border-orange-500/30 bg-orange-900/10 p-2">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-orange-400">Your Counter Offer</p>
                <div className="flex gap-4 text-sm text-white">
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                    {formatINRAmount(negotiation.studentCounterAmount)}
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
                    {negotiation.studentCounterEquity}%
                  </span>
                </div>
              </div>
            ) : null}

            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className={`rounded-lg border p-2 text-center text-[11px] ${
                investorAlreadyAccepted
                  ? 'border-emerald-500/30 bg-emerald-900/10 text-emerald-400'
                  : 'border-slate-700 text-slate-500'
              }`}>
                <CheckCircle2 className={`mx-auto mb-0.5 h-3.5 w-3.5 ${investorAlreadyAccepted ? 'text-emerald-400' : 'text-slate-600'}`} />
                Investor {investorAlreadyAccepted ? 'accepted' : 'pending'}
              </div>
              <div className={`rounded-lg border p-2 text-center text-[11px] ${
                startupAlreadyAccepted
                  ? 'border-emerald-500/30 bg-emerald-900/10 text-emerald-400'
                  : 'border-slate-700 text-slate-500'
              }`}>
                <CheckCircle2 className={`mx-auto mb-0.5 h-3.5 w-3.5 ${startupAlreadyAccepted ? 'text-emerald-400' : 'text-slate-600'}`} />
                You {startupAlreadyAccepted ? 'accepted' : 'pending'}
              </div>
            </div>

            {termsAgreed ? (
              <div className="flex items-center gap-2 rounded-lg bg-cyan-900/10 px-3 py-2 text-xs text-cyan-300">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Both agreed — awaiting admin review for share allotment
              </div>
            ) : startupAlreadyAccepted ? (
              <div className="flex items-center gap-2 rounded-lg bg-amber-900/10 px-3 py-2 text-xs text-amber-300">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                Waiting for the investor to accept
              </div>
            ) : (
              <div className="flex gap-2">
                {canAcceptTerms && (
                  <button
                    type="button"
                    disabled={acceptTermsMutation.isPending}
                    onClick={() => { setShowCounterForm(false); acceptTermsMutation.mutate(); }}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    {acceptTermsMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    {isCounterOffer ? 'Accept Original' : 'Accept Terms'}
                  </button>
                )}
                {canCounter && (
                  <button
                    type="button"
                    onClick={() => setShowCounterForm((prev) => !prev)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-300 transition hover:bg-orange-500/20"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {showCounterForm ? 'Cancel' : isCounterOffer ? 'Counter Again' : 'Counter Offer'}
                  </button>
                )}
              </div>
            )}

            {showCounterForm && !startupAlreadyAccepted && !termsAgreed && (
              <div className="mt-3 rounded-lg border border-orange-500/20 bg-orange-950/10 p-3">
                <p className="mb-2 text-[10px] uppercase tracking-wider text-orange-400">
                  {isCounterOffer ? 'New Counter Offer' : 'Counter Offer'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] text-slate-400">Amount (INR)</label>
                    <input
                      type="number"
                      min="20000"
                      value={counterAmount}
                      onChange={(e) => setCounterAmount(e.target.value)}
                      placeholder="20000"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-orange-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] text-slate-400">Equity (%)</label>
                    <input
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.01"
                      value={counterEquity}
                      onChange={(e) => setCounterEquity(e.target.value)}
                      placeholder="5"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-orange-500/50 focus:outline-none"
                    />
                  </div>
                </div>
                {counterError && (
                  <p className="mt-2 text-[10px] text-red-400">{counterError}</p>
                )}
                <button
                  type="button"
                  disabled={!counterAmount || !counterEquity || counterMutation.isPending}
                  onClick={handleSubmitCounter}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-300 transition hover:bg-orange-500/20 disabled:opacity-50"
                >
                  {counterMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Submit Counter Offer
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <dt className="uppercase tracking-wider text-slate-500">Investment</dt>
          <dd className="mt-1 font-semibold text-white">
            {deal.amountINR > 0 ? formatINR(deal.amountINR) : '–'}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <dt className="uppercase tracking-wider text-slate-500">Equity</dt>
          <dd className="mt-1 font-semibold text-white">
            {deal.equityPercent > 0 ? `${deal.equityPercent}%` : '–'}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <dt className="uppercase tracking-wider text-slate-500">Shares</dt>
          <dd className="mt-1 font-semibold text-white">
            {deal.sharesAllocated > 0 ? deal.sharesAllocated.toLocaleString('en-IN') : '–'}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <dt className="uppercase tracking-wider text-slate-500">Updated</dt>
          <dd className="mt-1 font-semibold text-white">{formatDate(deal.updatedAt)}</dd>
        </div>
      </dl>

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-cyan-400" />
            <span className="text-xs uppercase tracking-wider text-slate-400">
              Product Workshop
            </span>
          </div>
          {hasLinkedWorkshop ? (
            <span className="text-xs font-semibold text-emerald-400">Linked</span>
          ) : (
            <span className="text-xs text-slate-500">Not linked</span>
          )}
        </div>
        {hasLinkedWorkshop && deal.productWorkshop ? (
          <div className="mt-2">
            <div className="truncate text-sm text-white">{deal.productWorkshop.title}</div>
            <div className="mt-1 text-xs text-slate-500">
              {deal.productWorkshop.progressPercent}% complete · {deal.productWorkshop.stage}
            </div>
          </div>
        ) : null}
        {canLinkWorkshop && onLinkWorkshop ? (
          <div className="mt-3">
            <LinkWorkspaceButton
              deal={deal}
              onLink={onLinkWorkshop}
              isLinking={isLinking}
              linkingWorkspaceId={linkingWorkspaceId}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
