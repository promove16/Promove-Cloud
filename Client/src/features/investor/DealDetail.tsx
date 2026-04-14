import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm">
      <div className="h-full w-full max-w-3xl overflow-y-auto border-l border-slate-800 bg-slate-950 px-6 py-6 text-white">
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="text-2xl font-bold text-white">Deal Detail</div>
            <div className="mt-2 text-sm text-slate-400">
              Stage progression is sequential and stage 3 requires admin verification.
            </div>
          </div>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>

        {dealQuery.isLoading ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <Spinner />
          </div>
        ) : deal ? (
          <div className="space-y-6">
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-3xl font-bold text-white">{deal.startupName}</div>
                  <div className="mt-2 text-slate-400">{deal.startupCategory}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>Stage {deal.currentStage}</Badge>
                  <Badge className={deal.investorType === 'sole' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'}>
                    {formatInvestorTypeLabel(deal.investorType)}
                  </Badge>
                  {deal.adminApprovalRequired ? (
                    <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                      Awaiting Admin Approval
                    </Badge>
                  ) : null}
                  <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                    {deal.nextActionLabel}
                  </Badge>
                </div>
              </div>
            </Card>

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
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-300">
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

            <Card className="p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Deal Progress
              </div>
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3, 4].map((stage) => (
                  <div key={stage} className="flex flex-1 items-center gap-1">
                    <div className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className={`h-2 w-full rounded-full ${
                          stage < deal.currentStage
                            ? 'bg-emerald-400'
                            : stage === deal.currentStage
                              ? 'bg-cyan-400'
                              : 'bg-slate-800'
                        }`}
                      />
                      <span
                        className={`text-[10px] ${
                          stage === deal.currentStage
                            ? 'font-semibold text-cyan-300'
                            : stage < deal.currentStage
                              ? 'text-emerald-400'
                              : 'text-slate-600'
                        }`}
                      >
                        {stageLabels[stage]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {deal.currentStage === 0 && !canAdvanceFromNegotiation ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
                Complete the negotiation above and agree on terms before advancing to Due Diligence.
              </div>
            ) : deal.currentStage === 4 ? null : (
              <div className="flex items-center justify-between gap-4">
                {error ? <div className="text-sm text-red-300">{error}</div> : <div />}
                <Button
                  onClick={handleAdvance}
                  disabled={
                    advanceMutation.isPending ||
                    (deal.currentStage === 1 && deal.founderDecision.status !== 'accepted') ||
                    (awaitingAdminApproval && deal.stockTransfer.status !== 'rejected') ||
                    (deal.currentStage === 3 && deal.stockTransfer.status !== 'rejected' && !deal.adminApprovedAt)
                  }
                >
                  {advanceMutation.isPending
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
                            : 'Already in Portfolio'}
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
