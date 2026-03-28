import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { dealApi } from '../../api/deal.api';
import { investorApi } from '../../api/investor.api';
import { DealDetail } from './DealDetail';

const quickLinks = [
  { label: 'Startups', path: '/dashboard/investor/startups' },
  { label: 'Institutions', path: '/dashboard/investor/institutions' },
  { label: 'My Portfolio', path: '/dashboard/investor/portfolio' },
];

export default function InvestorDashboard() {
  const navigate = useNavigate();
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ['investor-dashboard'],
    queryFn: investorApi.getDashboard,
    refetchInterval: 60_000,
  });

  const dealsQuery = useQuery({
    queryKey: ['investor-deals'],
    queryFn: dealApi.getInvestorDeals,
    refetchInterval: 60_000,
  });

  const stageGroups = useMemo(() => dealsQuery.data ?? [], [dealsQuery.data]);
  const stageLabels: Record<number, string> = {
    1: 'Due Diligence',
    2: 'Fund Transfer',
    3: 'Equity Transfer',
    4: 'Portfolio',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Deal Flow</h1>
          <p className="mt-2 text-slate-400">Track every active deal, approval, and closed portfolio company.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {quickLinks.map((link) => (
            <Button key={link.path} variant="secondary" onClick={() => navigate(link.path)}>
              {link.label}
            </Button>
          ))}
        </div>
      </div>

      {dashboardQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['Active Deals', dashboardQuery.data?.activeDeals ?? 0],
            ['New Startups This Week', dashboardQuery.data?.newStartupsThisWeek ?? 0],
            ['Portfolio Companies', dashboardQuery.data?.portfolioCount ?? 0],
            ['Avg Portfolio Score', dashboardQuery.data?.avgPortfolioScore ?? 0],
          ].map(([label, value]) => (
            <Card key={label} className="p-5">
              <div className="text-3xl font-bold text-white">{String(value)}</div>
              <div className="mt-2 text-sm text-slate-400">{label}</div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-4">
        {stageGroups.map((group) => (
          <Card key={group.stage} className="min-h-[280px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">{group.label}</div>
                <div className="mt-1 text-sm text-slate-400">{group.deals.length} deals</div>
              </div>
              <Badge>{group.stage}</Badge>
            </div>

            <div className="mt-4 space-y-3">
              {group.deals.map((deal) => (
                <button
                  key={deal._id}
                  type="button"
                  onClick={() => setSelectedDealId(deal._id)}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-left transition hover:border-cyan-500/30 hover:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{deal.startupName}</div>
                      <div className="mt-1 text-sm text-slate-400">{deal.startupCategory}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={deal.investorType === 'sole' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'}>
                        {deal.investorType.toUpperCase()}
                      </Badge>
                      {deal.adminApprovalRequired ? (
                        <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                          Awaiting Admin Approval
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-slate-400">{deal.studentDisplayName}</span>
                    <span className="font-semibold text-cyan-200">{deal.nextActionLabel}</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-slate-500">
                      <span>Progress</span>
                      <span>{stageLabels[deal.currentStage]}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {[1, 2, 3, 4].map((stage) => (
                        <div
                          key={stage}
                          className={`h-2 rounded-full ${
                            stage <= deal.currentStage ? 'bg-cyan-400' : 'bg-slate-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </button>
              ))}
              {group.deals.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-500">
                  No deals in this stage.
                </div>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      <DealDetail
        dealId={selectedDealId}
        open={Boolean(selectedDealId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDealId(null);
          }
        }}
      />
    </div>
  );
}
