import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/admin.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';

const formatRoleLabel = (value?: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Shareholder');

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

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Deals</div>
        <h1 className="mt-2 text-3xl font-bold text-white">Stage 3 Deal Approvals</h1>
        <p className="mt-2 text-slate-400">Approve equity transfers after verifying admin review requirements.</p>
      </div>

      <Card className="space-y-3 p-6">
        {dealsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12"><Spinner /></div>
        ) : (dealsQuery.data ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-8 text-sm text-slate-400">
            No deals are awaiting approval.
          </div>
        ) : (
          (dealsQuery.data ?? []).map((deal) => (
            <div key={deal._id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>Stage {deal.stage}</Badge>
                    {deal.investorType ? <Badge>{deal.investorType.toUpperCase()}</Badge> : null}
                    <Badge>{formatRoleLabel(deal.investorRole)}</Badge>
                    {deal.canVeto ? <Badge className="border-red-500/30 bg-red-500/10 text-red-300">Veto</Badge> : null}
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold text-white">{deal.startupName}</h3>
                  <div className="mt-2 text-sm text-slate-300">
                    Investor: {deal.investorName} - Student: {deal.studentName}
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    Equity {deal.equityPercent ?? 0}% - Shares {deal.sharesAllocated ?? 0} - Voting {deal.votingWeight ?? 0}%
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => navigate(`/dashboard/admin/deals/${deal._id}`)}>
                    Review Transaction
                  </Button>
                  <Button
                    onClick={() => approveMutation.mutate(deal._id)}
                    disabled={approveMutation.isPending}
                  >
                    Approve Equity Transfer
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
