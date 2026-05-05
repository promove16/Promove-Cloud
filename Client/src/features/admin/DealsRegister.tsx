import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAdminDealsContext } from './Deals';

const formatCurrency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const transferTone: Record<string, string> = {
  not_started: 'border-slate-700 bg-slate-900 text-slate-300',
  pending_review: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  under_review: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  rejected: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

export default function DealsRegister() {
  const navigate = useNavigate();
  const { deals, approveDeal, approveBusy } = useAdminDealsContext();

  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-col gap-2">
        <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Deal Register</div>
        <h2 className="text-2xl font-semibold text-white">Mediation queue and history</h2>
        <p className="text-sm text-slate-400">
          The full register stays available here once the overview has narrowed down what needs immediate attention.
        </p>
      </div>

      {deals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-10 text-sm text-slate-400">
          No deals have entered the mediation workspace yet.
        </div>
      ) : (
        <div className="space-y-4">
          {deals.map((deal) => {
            const canApprove =
              deal.stage === 3 &&
              deal.adminApprovalRequired &&
              deal.stockTransfer.status !== 'approved' &&
              deal.stockTransfer.status !== 'rejected' &&
              !deal.adminApprovedAt &&
              deal.cancellationRequest?.status !== 'pending';

            return (
              <div key={deal._id} className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge>Stage {deal.stage}</Badge>
                      <Badge className={transferTone[deal.stockTransfer.status] ?? transferTone.not_started}>
                        {deal.stockTransfer.status.replace('_', ' ')}
                      </Badge>
                      <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                        {deal.requestOrigin} request
                      </Badge>
                      <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                        {deal.royalty.promovePercentage}% royalty
                      </Badge>
                      {deal.cancellationRequest?.status === 'pending' ? (
                        <Badge className="border-rose-500/30 bg-rose-500/10 text-rose-300">
                          cancellation requested
                        </Badge>
                      ) : null}
                    </div>

                    <div>
                      <h3 className="text-2xl font-semibold text-white">{deal.startupName}</h3>
                      <div className="mt-2 text-sm text-slate-300">
                        Investor: {deal.investorName} | Student: {deal.studentName}
                      </div>
                      <div className="mt-2 text-sm text-slate-400">
                        {deal.stockDetails.shareClassLabel} | {deal.sharesAllocated ?? 0} shares | Share price{' '}
                        {formatCurrency.format(deal.stockDetails.sharePriceInr)}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Transfer Value</div>
                        <div className="mt-2 font-semibold text-white">
                          {formatCurrency.format(deal.stockDetails.transferValueInr)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Equity</div>
                        <div className="mt-2 font-semibold text-white">{deal.equityPercent ?? 0}%</div>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">ProMove Royalty</div>
                        <div className="mt-2 font-semibold text-white">
                          {formatCurrency.format(deal.royalty.promoveAmountINR)}
                        </div>
                      </div>
                    </div>

                    {deal.stockTransfer.requestSummary ? (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400">
                        {deal.stockTransfer.requestSummary}
                      </div>
                    ) : null}
                    {deal.cancellationRequest?.status === 'pending' ? (
                      <div className="rounded-2xl border border-rose-500/30 bg-rose-950/10 px-4 py-3 text-sm text-rose-200">
                        Cancellation reason: {deal.cancellationRequest.reason?.trim() || 'No reason provided.'}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex w-full max-w-sm flex-col gap-3">
                    <Button variant="secondary" onClick={() => navigate(`/dashboard/admin/deals/${deal._id}`)}>
                      Open Review
                    </Button>
                    <Button onClick={() => approveDeal(deal._id)} disabled={!canApprove || approveBusy}>
                      {canApprove ? 'Approve Transfer' : 'Review Required'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
