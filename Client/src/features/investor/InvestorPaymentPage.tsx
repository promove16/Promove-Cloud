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

  const dealClosed = deal.status !== 'active' || deal.currentStage === 4;
  const founderAccepted = deal.founderDecision.status === 'accepted';
  const paymentAlreadyMarked = deal.currentStage >= 2;
  const amountLabel =
    typeof deal.amountINR === 'number' ? `INR ${deal.amountINR.toLocaleString()}` : deal.amountINR;
  const founderDecisionLabel = dealClosed && deal.founderDecision.status === 'pending'
    ? 'deal closed'
    : deal.founderDecision.status;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            {dealClosed ? 'Deal Completed' : 'Payment'}
          </h1>
          <p className="mt-2 text-slate-400">
            {dealClosed
              ? 'This deal is already closed. The payment step is locked.'
              : 'Payment gateway is not yet connected. Review the deal details below; payment will unlock once the integration is live.'}
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
            {deal.investorType === 'penny' ? 'Penny Investor' : 'Sole Investor'}
          </Badge>
          <Badge
            className={
              founderAccepted || dealClosed
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            }
          >
            Founder {founderDecisionLabel}
          </Badge>
          {deal.adminApprovedAt ? (
            <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              Admin approved {new Date(deal.adminApprovedAt).toLocaleDateString('en-IN')}
            </Badge>
          ) : null}
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

        {dealClosed ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            This deal is closed. Track the investment from your portfolio instead.
          </div>
        ) : !founderAccepted ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Founder acceptance is still pending. Payment is locked until the founder accepts.
          </div>
        ) : paymentAlreadyMarked ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            The deal is already beyond the payment step.
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Payment gateway integration is pending. Payment will unlock once the integration is live; no action is required from you right now.
          </div>
        )}
      </Card>
    </div>
  );
}
