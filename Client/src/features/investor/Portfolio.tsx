import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { investorApi } from '../../api/investor.api';
import { Spinner } from '../../components/ui/Spinner';

const formatRoleLabel = (role: string) => role.charAt(0).toUpperCase() + role.slice(1);

export default function Portfolio() {
  const portfolioQuery = useQuery({
    queryKey: ['investor-portfolio'],
    queryFn: investorApi.getPortfolio,
    refetchInterval: 60_000,
  });

  const items = portfolioQuery.data?.items ?? [];

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => right.liveInnovationScore - left.liveInnovationScore),
    [items],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">My Portfolio</h1>
        <p className="mt-2 text-slate-400">Live innovation scores keep the portfolio current after investment.</p>
      </div>

      {portfolioQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-5">
              <div className="text-3xl font-bold text-white">
                {portfolioQuery.data?.portfolioStrength.averageLiveInnovationScore ?? 0}
              </div>
              <div className="mt-2 text-sm text-slate-400">Portfolio Strength</div>
            </Card>
            <Card className="p-5">
              <div className="text-3xl font-bold text-white">
                {portfolioQuery.data?.portfolioStrength.totalPortfolioCount ?? 0}
              </div>
              <div className="mt-2 text-sm text-slate-400">Portfolio Companies</div>
            </Card>
            <Card className="p-5">
              <div className="text-3xl font-bold text-white">{sortedItems[0]?.liveInnovationScore ?? 0}</div>
              <div className="mt-2 text-sm text-slate-400">Top Live Score</div>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {sortedItems.map((item) => (
              <Card key={item._id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xl font-semibold text-white">{item.startupName}</div>
                    <div className="mt-1 text-sm text-cyan-300">{item.startupCategory}</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge>Stage 4</Badge>
                      <Badge className={item.investorType === 'sole' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'}>
                        {item.investorType === 'penny' ? 'Penny Investor' : 'Sole Investor'}
                      </Badge>
                      <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                        {formatRoleLabel(item.investorRole)}
                      </Badge>
                      {item.canVeto ? <Badge className="border-red-500/30 bg-red-500/10 text-red-300">Veto</Badge> : null}
                      {item.closedAt ? (
                        <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                          Transfer verified {new Date(item.closedAt).toLocaleDateString('en-IN')}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">{item.liveInnovationScore}</div>
                    <div className="text-xs text-slate-400">Live Innovation Score</div>
                    <div className={`mt-2 text-sm font-semibold ${item.scoreTrend >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {item.scoreTrend >= 0 ? '+' : ''}
                      {item.scoreTrend} since investment
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Founding student</div>
                    <div className="mt-2 font-semibold text-white">{item.studentDisplayName}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Snapshot at entry</div>
                    <div className="mt-2 font-semibold text-white">{item.innovationScoreSnapshot}</div>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Equity</div>
                    <div className="mt-2 font-semibold text-white">{item.equityPercent}%</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Shares</div>
                    <div className="mt-2 font-semibold text-white">{item.sharesAllocated}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Financial Access</div>
                    <div className="mt-2 font-semibold text-white">{item.canAccessFinancials ? 'Full' : 'Limited'}</div>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                    <span>Voting Weight</span>
                    <span>{item.votingWeight}%</span>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${item.investorType === 'sole' ? 'bg-amber-400' : 'bg-cyan-400'}`}
                      style={{ width: `${Math.min(item.votingWeight, 100)}%` }}
                    />
                  </div>
                  <div className="mt-3 text-sm text-slate-400">
                    Updates: {item.canRequestUpdates ? 'Enabled' : 'Restricted'}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
