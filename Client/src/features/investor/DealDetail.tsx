import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import { Check, X, DollarSign, TrendingUp, Activity, ShieldCheck } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { dealApi } from '../../api/deal.api';
import { DealDetailView } from '../../types/deal.types';
import { NegotiationPanel } from './NegotiationPanel';

type Props = {
  dealId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const investorRoles = ['shareholder', 'director', 'observer'] as const;
const formatRoleLabel = (role: (typeof investorRoles)[number]) => role.charAt(0).toUpperCase() + role.slice(1);
const formatInvestorTypeLabel = (type: string) =>
  type === 'penny' ? 'Penny Investor' : type === 'sole' ? 'Sole Investor' : type;
const formatInr = (amount: number) => `INR ${amount.toLocaleString()}`;
const stageLabels: Record<number, string> = {
  0: 'Negotiation',
  1: 'Due Diligence',
  2: 'Payment',
  3: 'Admin Review',
  4: 'Portfolio',
};
const getDealWorkflowErrorMessage = (error: unknown) => {
  if (isAxiosError<{ error?: { message?: string } }>(error)) {
    return error.response?.data?.error?.message ?? 'Unable to update this deal right now.';
  }

  return error instanceof Error ? error.message : 'Unable to update this deal right now.';
};

export function DealDetail({ dealId, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [equityPercent, setEquityPercent] = useState('10');
  const [investorRole, setInvestorRole] = useState<(typeof investorRoles)[number]>('shareholder');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [awaitingAdminApproval, setAwaitingAdminApproval] = useState(false);

  const dealQuery = useQuery({
    queryKey: ['investor-deal', dealId],
    queryFn: () => dealApi.getInvestorDeal(dealId!),
    enabled: open && Boolean(dealId),
  });

  useEffect(() => {
    if (dealQuery.data) {
      setError('');
      setNotice('');
      setEquityPercent(String(dealQuery.data.equityPercent || 10));
      setInvestorRole(dealQuery.data.investorRole);
      setAwaitingAdminApproval(Boolean(dealQuery.data.adminApprovalRequired && !dealQuery.data.adminApprovedAt));
    }
  }, [dealQuery.data]);

  useEffect(() => {
    if (!open) {
      setEquityPercent('10');
      setInvestorRole('shareholder');
      setError('');
      setNotice('');
      setAwaitingAdminApproval(false);
    }
  }, [open]);

  const advanceMutation = useMutation({
    mutationFn: (payload: {
      newStage: 1 | 2 | 3 | 4;
      stageData?: {
        amountINR?: number;
        equityPercent?: number;
        investorRole?: (typeof investorRoles)[number];
      };
    }) =>
      dealId ? dealApi.advanceInvestorDealStage(dealId, payload) : Promise.reject(new Error('Missing deal')),
    onSuccess: async (result) => {
      if (result.requiresAdminApproval) {
        setNotice(result.message ?? 'Awaiting admin verification.');
        setAwaitingAdminApproval(true);
      } else {
        setNotice('Deal updated successfully.');
      }
      await queryClient.invalidateQueries({ queryKey: ['investor-deal', dealId] });
      await queryClient.invalidateQueries({ queryKey: ['investor-deals'] });
      await queryClient.invalidateQueries({ queryKey: ['investor-dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['investor-portfolio'] });
    },
    onError: (mutationError) => {
      setError(getDealWorkflowErrorMessage(mutationError));
    },
  });

  const deal = dealQuery.data as DealDetailView | undefined;
  const canAdvanceFromNegotiation = Boolean(deal?.negotiation?.termsAgreedAt);

  const handleAdvance = () => {
    if (!deal) {
      return;
    }

    setError('');
    if (deal.currentStage === 0) {
      if (!deal.negotiation?.termsAgreedAt) {
        setError('Both parties must agree on terms before due diligence can begin.');
        return;
      }

      advanceMutation.mutate({ newStage: 1 });
      return;
    }

    if (deal.currentStage === 1) {
      if (deal.founderDecision.status !== 'accepted') {
        setError('Founder acceptance is required before opening the payment placeholder.');
        return;
      }

      onOpenChange(false);
      navigate(`/dashboard/investor/deals/${deal._id}/payment`);
      return;
    }

    if (deal.currentStage === 2) {
      submitStageThreeTransfer(deal);
      return;
    }

    if (deal.currentStage === 3 && deal.stockTransfer.status === 'rejected') {
      submitStageThreeTransfer(deal);
      return;
    }

    if (deal.currentStage === 3 && deal.adminApprovedAt) {
      advanceMutation.mutate({ newStage: 4 });
      return;
    }

    if (deal.currentStage === 4) {
      setNotice('This deal is already in your portfolio.');
    }
  };

  const submitStageThreeTransfer = (deal: DealDetailView) => {
    const parsedEquity = Number(equityPercent);
    if (!Number.isFinite(parsedEquity) || parsedEquity <= 0 || parsedEquity > 100) {
      setError('Enter a valid equity percentage between 0.01 and 100.');
      return;
    }

    if (deal.investorType === 'penny' && parsedEquity > 5) {
      setError('A penny investor cannot request more than 5% equity.');
      return;
    }

    if (deal.investorType === 'sole' && investorRole === 'director' && parsedEquity < 51) {
      setError('A sole investor needs at least 51% equity to take the director role.');
      return;
    }

    advanceMutation.mutate({
      newStage: 3,
      stageData: {
        equityPercent: parsedEquity,
        investorRole,
      },
    });
  };

  if (!open) {
    return null;
  }

  const advanceDisabled = !deal
    ? true
    : advanceMutation.isPending ||
      (deal.currentStage === 1 && deal.founderDecision.status !== 'accepted') ||
      (awaitingAdminApproval && deal.stockTransfer.status !== 'rejected') ||
      (deal.currentStage === 3 && deal.stockTransfer.status !== 'rejected' && !deal.adminApprovedAt);

  const advanceLabel = !deal
    ? ''
    : advanceMutation.isPending
      ? 'Updating...'
      : deal.currentStage === 0
        ? 'Advance to Due Diligence'
        : deal.currentStage === 1
          ? deal.founderDecision.status === 'accepted'
            ? 'View Payment Placeholder'
            : 'Awaiting Founder Acceptance'
          : deal.currentStage === 2
            ? awaitingAdminApproval
              ? 'Awaiting Admin Verification'
              : 'Submit for Admin Approval'
            : deal.currentStage === 3
              ? deal.stockTransfer.status === 'rejected'
                ? 'Resubmit for Admin Approval'
                : 'Move to Portfolio'
              : 'Already in Portfolio';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/85 backdrop-blur-sm" onClick={() => onOpenChange(false)}>
      <div
        className="flex h-full w-full max-w-6xl flex-col border-l border-slate-800 bg-slate-950 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-950/95 px-6 py-4 backdrop-blur">
          <div>
            <div className="text-2xl font-bold text-white">Deal Detail</div>
            <div className="mt-1 text-sm text-slate-400">
              Stage progression is sequential and stage 3 requires admin verification.
            </div>
          </div>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>

        {dealQuery.isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : deal ? (
          <div className="grid flex-1 gap-6 overflow-y-auto px-6 py-6 lg:grid-cols-[340px,1fr]">
            {/* LEFT RAIL: summary, vertical timeline, primary action */}
            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <Card className="p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Startup
                </div>
                <div className="mt-1 text-2xl font-bold leading-tight text-white">
                  {deal.startupName}
                </div>
                <div className="mt-1 text-sm text-slate-400">{deal.startupCategory}</div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge>Stage {deal.currentStage}</Badge>
                  <Badge
                    className={
                      deal.investorType === 'sole'
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                        : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                    }
                  >
                    {formatInvestorTypeLabel(deal.investorType)}
                  </Badge>
                  {deal.adminApprovalRequired ? (
                    <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                      <ShieldCheck className="mr-1 inline h-3 w-3" />
                      Awaiting Admin
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      <DollarSign className="h-3 w-3" />
                      Amount
                    </div>
                    <div className="mt-1 text-base font-semibold text-white">
                      {formatInr(deal.amountINR)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      <TrendingUp className="h-3 w-3" />
                      Equity
                    </div>
                    <div className="mt-1 text-base font-semibold text-white">
                      {deal.equityPercent}%
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-200">
                  <Activity className="h-3.5 w-3.5 shrink-0" />
                  <span>Next: {deal.nextActionLabel}</span>
                </div>
              </Card>

              <Card className="p-5">
                <div className="mb-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Deal Progress
                </div>
                <ol className="relative space-y-4">
                  {[0, 1, 2, 3, 4].map((stage, index, arr) => {
                    const state =
                      stage < deal.currentStage
                        ? 'done'
                        : stage === deal.currentStage
                          ? 'active'
                          : 'pending';
                    const isLast = index === arr.length - 1;
                    return (
                      <li key={stage} className="relative flex items-start gap-3">
                        {!isLast && (
                          <span
                            className={`absolute left-[11px] top-6 h-[calc(100%-4px)] w-px ${
                              state === 'done' ? 'bg-emerald-500/40' : 'bg-slate-800'
                            }`}
                          />
                        )}
                        <div
                          className={`relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                            state === 'done'
                              ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                              : state === 'active'
                                ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200 shadow-[0_0_0_3px_rgba(34,211,238,0.12)]'
                                : 'border-slate-700 bg-slate-900 text-slate-500'
                          }`}
                        >
                          {state === 'done' ? <Check className="h-3 w-3" /> : stage}
                        </div>
                        <div className="pt-0.5">
                          <div
                            className={`text-sm font-medium ${
                              state === 'active'
                                ? 'text-cyan-200'
                                : state === 'done'
                                  ? 'text-emerald-300'
                                  : 'text-slate-500'
                            }`}
                          >
                            {stageLabels[stage]}
                          </div>
                          {state === 'active' && (
                            <div className="mt-0.5 text-[11px] text-slate-500">In progress</div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </Card>

              {deal.currentStage === 4 ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  <Check className="h-4 w-4" />
                  This deal is in your portfolio.
                </div>
              ) : deal.currentStage === 0 && !canAdvanceFromNegotiation ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-xs leading-5 text-slate-400">
                  Agree on terms in the Negotiation Room to advance.
                </div>
              ) : (
                <Button
                  onClick={handleAdvance}
                  disabled={advanceDisabled}
                  className="w-full"
                >
                  {advanceLabel}
                </Button>
              )}
              {error ? (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}
            </aside>

            {/* RIGHT: workspace */}
            <div className="min-w-0 space-y-6">
              {notice ? (
                <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
                  {notice}
                </div>
              ) : null}

              {deal.currentStage === 0 && (
                <NegotiationPanel deal={deal} isInvestor={true} />
              )}

            {deal.currentStage === 1 ? (
              <Card className="space-y-4 p-5">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Stage 1 payment placeholder
                </div>
                <div className="text-sm text-slate-300">
                  Payment gateway is not connected yet. This stage is temporarily read-only from the investor UI.
                </div>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    deal.founderDecision.status === 'accepted'
                      ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                      : deal.founderDecision.status === 'rejected'
                        ? 'border border-red-500/30 bg-red-500/10 text-red-200'
                        : 'border border-amber-500/30 bg-amber-500/10 text-amber-200'
                  }`}
                >
                  {deal.founderDecision.status === 'accepted'
                    ? 'Founder accepted this proposal. No payment action can be initiated here yet.'
                    : deal.founderDecision.status === 'rejected'
                      ? 'Founder rejected this proposal. This deal cannot advance.'
                      : 'Waiting for founder acceptance before the payment placeholder can be viewed.'}
                </div>
                {deal.founderDecision.note ? (
                  <div className="text-sm text-slate-400">Founder note: {deal.founderDecision.note}</div>
                ) : null}
                <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Proposed amount</div>
                  <div className="mt-2 text-base font-semibold text-white">{formatInr(deal.amountINR)}</div>
                </div>
                {error ? <div className="text-sm text-red-300">{error}</div> : null}
              </Card>
            ) : null}

            {deal.currentStage === 2 ? (
              <Card className="space-y-4 p-5">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Stage 2 to Stage 3
                </div>
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  This stage requires admin approval for equity documentation.
                </div>
                {awaitingAdminApproval ? (
                  <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
                    Awaiting Admin Verification
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                        Equity percent
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={equityPercent}
                        onChange={(event) => setEquityPercent(event.target.value)}
                      />
                    </div>
                    <div>
                      <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                        Investor role
                      </div>
                      <select
                        value={investorRole}
                        onChange={(event) =>
                          setInvestorRole(event.target.value as (typeof investorRoles)[number])
                        }
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                      >
                        {(deal.investorType === 'penny'
                          ? investorRoles.filter((role) => role !== 'director')
                          : investorRoles.filter((role) => role !== 'observer')
                        ).map((role) => (
                          <option key={role} value={role}>
                            {formatRoleLabel(role)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                {error ? <div className="text-sm text-red-300">{error}</div> : null}
              </Card>
            ) : null}

            {deal.currentStage === 3 ? (
              <Card className="space-y-4 p-5">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Stage 3 to Stage 4
                </div>
                {deal.stockTransfer.status === 'rejected' ? (
                  <>
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      Transfer rejected by admin. Update the equity terms or role and resubmit.
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                          Equity percent
                        </div>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={equityPercent}
                          onChange={(event) => setEquityPercent(event.target.value)}
                        />
                      </div>
                      <div>
                        <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                          Investor role
                        </div>
                        <select
                          value={investorRole}
                          onChange={(event) =>
                            setInvestorRole(event.target.value as (typeof investorRoles)[number])
                          }
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                        >
                          {(deal.investorType === 'penny'
                            ? investorRoles.filter((role) => role !== 'director')
                            : investorRoles.filter((role) => role !== 'observer')
                          ).map((role) => (
                            <option key={role} value={role}>
                              {formatRoleLabel(role)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {deal.stockTransfer.reviewNotes ? (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
                        Admin notes: {deal.stockTransfer.reviewNotes}
                      </div>
                    ) : null}
                  </>
                ) : deal.adminApprovedAt ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                    Equity transfer has been verified. You may now move the deal to your portfolio.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                    Waiting for ProMove admin verification before portfolio transfer.
                  </div>
                )}
              </Card>
            ) : null}

            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
