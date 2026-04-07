import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { dealApi } from '../../api/deal.api';

export default function InvestorPaymentPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();

  const dealQuery = useQuery({
    queryKey: ['investor-deal', dealId],
    queryFn: () => dealApi.getInvestorDeal(dealId!),
    enabled: Boolean(dealId),
  });

  if (dealQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const deal = dealQuery.data;

  if (!deal) {
    return (
      <Card className="p-6">
        <div className="text-lg font-semibold text-white">Deal not found</div>
      </Card>
    );
  }

  const founderAccepted = deal.founderDecision.status === 'accepted';
  const paymentAlreadyMarked = deal.currentStage >= 2;
  const amountLabel =
    typeof deal.amountINR === 'number' ? `INR ${deal.amountINR.toLocaleString()}` : deal.amountINR;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Payment Placeholder</h1>
          <p className="mt-2 text-slate-400">
            Payment gateway is not connected yet. This is a temporary placeholder.
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
            <div className="mt-2 text-xl font-semibold text-white">{amountLabel}</div>
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
            Founder acceptance is still pending. This placeholder cannot initiate payment.
          </div>
        ) : paymentAlreadyMarked ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            The deal is already beyond the payment placeholder stage.
          </div>
        ) : (
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
            Review the deal details here. No payment action is available in this temporary page.
          </div>
        )}
      </Card>
    </div>
  );
}
