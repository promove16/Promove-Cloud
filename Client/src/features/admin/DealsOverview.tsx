import { useMemo } from 'react';
import { ArrowRight, BriefcaseBusiness, FileCheck2, IndianRupee, ShieldCheck } from 'lucide-react';
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

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof BriefcaseBusiness;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-300">{label}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </Card>
  );
}

export default function DealsOverview() {
  const navigate = useNavigate();
  const { deals, urgentDeals, totalRoyaltyPool, approvedDeals, approveDeal, approveBusy } = useAdminDealsContext();

  const recentApprovals = useMemo(
    () =>
      [...deals]
        .filter((deal) => Boolean(deal.adminApprovedAt))
        .sort((left, right) => {
          const leftTime = left.adminApprovedAt ? new Date(left.adminApprovedAt).getTime() : 0;
          const rightTime = right.adminApprovedAt ? new Date(right.adminApprovedAt).getTime() : 0;

          return rightTime - leftTime;
        })
        .slice(0, 5),
    [deals],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={BriefcaseBusiness}
          label="Tracked Deals"
          value={String(deals.length)}
          detail="All investor-startup mediation records"
        />
        <StatCard
          icon={FileCheck2}
          label="Pending Deal Reviews"
          value={String(urgentDeals.length)}
          detail="Transfers and cancellation requests needing action"
        />
        <StatCard
          icon={IndianRupee}
          label="Royalty Pool"
          value={formatCurrency.format(totalRoyaltyPool)}
          detail="Captured across active and closed records"
        />
        <StatCard
          icon={ShieldCheck}
          label="Verified by ProMove"
          value={String(approvedDeals)}
          detail="Deals already cleared by admin review"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Transfer Queue</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Priority approvals</h2>
              <p className="mt-2 text-sm text-slate-400">
                Keep the overview focused on deals that are blocked on stock-transfer review.
              </p>
            </div>
            <Button variant="secondary" onClick={() => navigate('/dashboard/admin/deals/register')}>
              Open Register
            </Button>
          </div>

          {urgentDeals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-10 text-sm text-slate-400">
              No deals are waiting for admin review right now.
            </div>
          ) : (
            <div className="space-y-4">
              {urgentDeals.map((deal) => (
                <div key={deal._id} className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge>Stage {deal.stage}</Badge>
                        <Badge className={transferTone[deal.stockTransfer.status] ?? transferTone.not_started}>
                          {deal.stockTransfer.status.replace(/_/g, ' ')}
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
                        <h3 className="text-xl font-semibold text-white">{deal.startupName}</h3>
                        <div className="mt-1 text-sm text-slate-300">
                          Investor: {deal.investorName} | Student: {deal.studentName}
                        </div>
                        <div className="mt-2 text-sm text-slate-400">
                          {deal.stockDetails.shareClassLabel} | {deal.sharesAllocated ?? 0} shares | Transfer value{' '}
                          {formatCurrency.format(deal.stockDetails.transferValueInr)}
                        </div>
                      </div>
                    </div>

                    <div className="flex w-full max-w-sm flex-col gap-3">
                      <Button variant="secondary" onClick={() => navigate(`/dashboard/admin/deals/${deal._id}`)}>
                        Open Review
                      </Button>
                      <Button
                        onClick={() => approveDeal(deal._id)}
                        disabled={approveBusy || deal.cancellationRequest?.status === 'pending'}
                      >
                        {deal.cancellationRequest?.status === 'pending' ? 'Open Cancellation Review' : 'Approve Transfer'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-4 p-6">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Recent Decisions</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Latest approvals</h2>
            <p className="mt-2 text-sm text-slate-400">
              The overview keeps recent admin-cleared transfers visible without mixing them into the urgent queue.
            </p>
          </div>

          {recentApprovals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-10 text-sm text-slate-400">
              No deal approvals have been recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {recentApprovals.map((deal) => (
                <button
                  key={deal._id}
                  type="button"
                  onClick={() => navigate(`/dashboard/admin/deals/${deal._id}`)}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 text-left transition hover:border-cyan-500/40"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-white">{deal.startupName}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        {deal.investorName} | {formatCurrency.format(deal.stockDetails.transferValueInr)}
                      </div>
                    </div>
                    <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">approved</Badge>
                  </div>
                  <div className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                    Approved {deal.adminApprovedAt ? new Date(deal.adminApprovedAt).toLocaleString('en-IN') : 'recently'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
