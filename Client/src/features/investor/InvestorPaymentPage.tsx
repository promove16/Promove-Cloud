import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { dealApi } from '../../api/deal.api';

export default function InvestorPaymentPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [amountINR, setAmountINR] = useState('20000');

  const dealQuery = useQuery({
    queryKey: ['investor-deal', dealId],
    queryFn: () => dealApi.getInvestorDeal(dealId!),
    enabled: Boolean(dealId),
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!dealQuery.data) {
        throw new Error('Deal not loaded');
      }

      const parsedAmount = Number(amountINR);
      if (!Number.isFinite(parsedAmount) || parsedAmount < 20000) {
        throw new Error('Minimum investment is INR 20,000');
      }

      return dealApi.advanceInvestorDealStage(dealQuery.data._id, {
        newStage: 2,
        stageData: { amountINR: parsedAmount },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['investor-deals'] });
      await queryClient.invalidateQueries({ queryKey: ['investor-deal', dealId] });
      await queryClient.invalidateQueries({ queryKey: ['investor-dashboard'] });
      navigate('/dashboard/investor');
    },
  });

  if (dealQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const deal = dealQuery.data;

  useEffect(() => {
    if (deal) {
      setAmountINR(String(deal.amountINR || 20000));
    }
  }, [deal]);

  if (!deal) {
    return (
      <Card className="p-6">
        <div className="text-lg font-semibold text-white">Deal not found</div>
      </Card>
    );
  }

  const founderAccepted = deal.founderDecision.status === 'accepted';
  const paymentAlreadyMarked = deal.currentStage >= 2;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Dummy Payment Page</h1>
          <p className="mt-2 text-slate-400">
            This screen is a placeholder. No payment gateway or escrow service is connected yet.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/dashboard/investor')}>
          Back to Dashboard
        </Button>
      </div>

      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Deal Stage {deal.currentStage}</Badge>
          <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
            {deal.investorType.toUpperCase()}
          </Badge>
          <Badge
            className={
              founderAccepted
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            }
          >
            Founder {deal.founderDecision.status}
          </Badge>
        </div>

        <div>
          <div className="text-2xl font-semibold text-white">{deal.startupName}</div>
          <div className="mt-1 text-sm text-slate-400">{deal.startupCategory}</div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Amount</div>
            <Input
              type="number"
              min={20000}
              value={amountINR}
              onChange={(event) => setAmountINR(event.target.value)}
              disabled={paymentAlreadyMarked}
              className="mt-2"
            />
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Equity</div>
            <div className="mt-2 text-xl font-semibold text-white">{deal.equityPercent}%</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Role</div>
            <div className="mt-2 text-xl font-semibold capitalize text-white">{deal.investorRole}</div>
          </div>
        </div>

        {!founderAccepted ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Founder acceptance is still pending. Dummy payment cannot be initiated yet.
          </div>
        ) : paymentAlreadyMarked ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Payment is already marked as initiated for this deal. Continue the workflow from the deal board.
          </div>
        ) : (
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
            Use this placeholder to simulate a successful payment until the real integration is added.
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => paymentMutation.mutate()}
            disabled={!founderAccepted || paymentAlreadyMarked || paymentMutation.isPending}
          >
            {paymentMutation.isPending ? 'Marking Payment...' : 'Simulate Payment Success'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/dashboard/investor')}>
            Continue Later
          </Button>
        </div>
        {paymentMutation.error ? (
          <div className="text-sm text-red-300">
            {paymentMutation.error instanceof Error
              ? paymentMutation.error.message
              : 'Unable to simulate payment right now.'}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
