import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { dealApi } from '../../api/deal.api';
import { DealDetailView } from '../../types/deal.types';

type Props = {
  dealId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const investorRoles = ['shareholder', 'director', 'observer'] as const;
const formatRoleLabel = (role: (typeof investorRoles)[number]) => role.charAt(0).toUpperCase() + role.slice(1);

export function DealDetail({ dealId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [amountINR, setAmountINR] = useState('20000');
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
      setAwaitingAdminApproval(Boolean(dealQuery.data.adminApprovalRequired && !dealQuery.data.adminApprovedAt));
    }
  }, [dealQuery.data]);

  useEffect(() => {
    if (!open) {
      setAmountINR('20000');
      setEquityPercent('10');
      setInvestorRole('shareholder');
      setError('');
      setNotice('');
      setAwaitingAdminApproval(false);
    }
  }, [open]);

  const advanceMutation = useMutation({
    mutationFn: (payload: {
      newStage: 2 | 3 | 4;
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
  });

  const deal = dealQuery.data as DealDetailView | undefined;

  const handleAdvance = () => {
    if (!deal) {
      return;
    }

    setError('');
    if (deal.currentStage === 1) {
      const parsedAmount = Number(amountINR);
      if (!Number.isFinite(parsedAmount) || parsedAmount < 20000) {
        setError('Minimum investment is ₹20,000.');
        return;
      }

      advanceMutation.mutate({
        newStage: 2,
        stageData: { amountINR: parsedAmount },
      });
      return;
    }

    if (deal.currentStage === 2) {
      advanceMutation.mutate({
        newStage: 3,
        stageData: {
          equityPercent: Number(equityPercent) || undefined,
          investorRole,
        },
      });
      return;
    }

    if (deal.currentStage === 3 && deal.adminApprovedAt) {
      advanceMutation.mutate({ newStage: 4 });
    }
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
                    {deal.investorType.toUpperCase()}
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

            {deal.currentStage === 1 ? (
              <Card className="space-y-4 p-5">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Stage 1 to Stage 2
                </div>
                <div className="text-sm text-slate-300">Minimum investment: ₹20,000</div>
                <Input
                  type="number"
                  min={20000}
                  value={amountINR}
                  onChange={(event) => setAmountINR(event.target.value)}
                  placeholder="Enter investment amount"
                />
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
              </Card>
            ) : null}

            {deal.currentStage === 3 ? (
              <Card className="space-y-4 p-5">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Stage 3 to Stage 4
                </div>
                {deal.adminApprovedAt ? (
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

            <div className="flex justify-end">
              <Button
                onClick={handleAdvance}
                disabled={
                  advanceMutation.isPending ||
                  awaitingAdminApproval ||
                  (deal.currentStage === 3 && !deal.adminApprovedAt)
                }
              >
                {advanceMutation.isPending
                  ? 'Updating...'
                  : deal.currentStage === 1
                    ? 'Advance to Stage 2'
                    : deal.currentStage === 2
                      ? awaitingAdminApproval
                        ? 'Awaiting Admin Verification'
                        : 'Submit for Admin Approval'
                      : 'Move to Portfolio'}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
