import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BriefcaseBusiness, FileCheck2, IndianRupee, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/admin.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';

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
};

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BriefcaseBusiness;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-400">{label}</div>
    </Card>
  );
}

export default function Deals() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const dealsQuery = useQuery({
    queryKey: ['admin-deals'],
    queryFn: adminApi.getDeals,
    refetchInterval: 60_000,
  });

  const approveMutation = useMutation({
    mutationFn: adminApi.approveDealStage,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-deals'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
  });

  const deals = dealsQuery.data ?? [];
  const urgentDeals = useMemo(
    () =>
      deals.filter(
        (deal) =>
          deal.stage === 3 &&
          deal.stockTransfer.status !== 'approved' &&
          !deal.adminApprovedAt,
      ),
    [deals],
  );
  const totalRoyaltyPool = useMemo(
    () => deals.reduce((sum, deal) => sum + deal.royalty.promoveAmountINR, 0),
    [deals],
  );
  const approvedDeals = useMemo(
    () => deals.filter((deal) => deal.mediationStatus === 'approved' || Boolean(deal.adminApprovedAt)).length,
    [deals],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Admin Deals</div>
          <h1 className="mt-2 text-3xl font-bold text-white">ProMove mediated deal desk</h1>
          <p className="mt-2 max-w-4xl text-slate-400">
            This workspace stores investor deal mediation, stock transfer requests, admin review status,
            and the royalty share earned by ProMove on each transaction.
          </p>
        </div>
        <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">Mediator: ProMove</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={BriefcaseBusiness} label="Tracked Deals" value={String(deals.length)} />
        <StatCard icon={FileCheck2} label="Pending Transfer Reviews" value={String(urgentDeals.length)} />
        <StatCard icon={IndianRupee} label="Royalty Pool" value={formatCurrency.format(totalRoyaltyPool)} />
        <StatCard icon={ShieldCheck} label="Verified by ProMove" value={String(approvedDeals)} />
      </div>

      <Card className="space-y-4 p-6">
        <div className="flex flex-col gap-2">
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Deal Register</div>
          <h2 className="text-2xl font-semibold text-white">Mediation queue and history</h2>
          <p className="text-sm text-slate-400">
            Student-investor transactions move through ProMove for stock transfer review and royalty capture before closure.
          </p>
        </div>

        {dealsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : deals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-10 text-sm text-slate-400">
            No deals have entered the mediation workspace yet.
          </div>
        ) : (
          <div className="space-y-4">
            {deals.map((deal) => {
              const canApprove =
                deal.stage === 3 &&
                deal.stockTransfer.status !== 'approved' &&
                !deal.adminApprovedAt;

              return (
                <div key={deal._id} className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
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
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Transfer Value</div>
                          <div className="mt-2 font-semibold text-white">
                            {formatCurrency.format(deal.stockDetails.transferValueInr)}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Equity</div>
                          <div className="mt-2 font-semibold text-white">{deal.equityPercent ?? 0}%</div>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">ProMove Royalty</div>
                          <div className="mt-2 font-semibold text-white">
                            {formatCurrency.format(deal.royalty.promoveAmountINR)}
                          </div>
                        </div>
                      </div>

                      {deal.stockTransfer.requestSummary ? (
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-400">
                          {deal.stockTransfer.requestSummary}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex w-full max-w-sm flex-col gap-3">
                      <Button variant="secondary" onClick={() => navigate(`/dashboard/admin/deals/${deal._id}`)}>
                        Open Review
                      </Button>
                      <Button
                        onClick={() => approveMutation.mutate(deal._id)}
                        disabled={!canApprove || approveMutation.isPending}
                      >
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
    </div>
  );
}
