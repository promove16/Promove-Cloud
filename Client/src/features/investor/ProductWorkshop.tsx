import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Briefcase, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar,
  ChevronDown,
  Filter,
  ArrowUpDown,
  Clock,
  CheckCircle2,
  BarChart3,
  Building2
} from 'lucide-react';
import { investorApi } from '../../api/investor.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { dealApi } from '../../api/deal.api';
import type { DealSummaryView } from '../../types/deal.types';
import type { InvestorPortfolioResponse } from '../../types/investor.types';

const getUniqueWorkshopCount = (deals: DealSummaryView[]) =>
  new Set(
    deals
      .map((deal) => deal.productWorkshop?.workspaceId)
      .filter((workspaceId): workspaceId is string => Boolean(workspaceId)),
  ).size;

const formatStageLabel = (deal: DealSummaryView) => {
  if (deal.currentStage === 4) {
    return 'Portfolio Company';
  }

  if (deal.currentStage === 3) {
    return 'Equity Transfer';
  }

  if (deal.currentStage === 2) {
    return 'Fund Transfer';
  }

  return 'Founder Accepted';
};

const formatRoleLabel = (role: string) => role.charAt(0).toUpperCase() + role.slice(1);

const WorkshopCard = ({
  deal,
  onOpen,
}: {
  deal: DealSummaryView;
  onOpen: (workspaceId: string) => void;
}) => {
  if (!deal.productWorkshop) {
    return null;
  }

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-xl font-semibold text-white">{deal.startupName}</div>
          <div className="mt-1 text-sm text-cyan-300">{deal.startupCategory}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge>{formatStageLabel(deal)}</Badge>
            <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              Product Workshop Ready
            </Badge>
            <Badge
              className={
                deal.investorType === 'sole'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                  : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
              }
            >
              {deal.investorType === 'penny' ? 'Penny Investor' : 'Sole Investor'}
            </Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {deal.productWorkshop && (
              <>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Workshop</div>
                  <div className="mt-2 font-semibold text-white">{deal.productWorkshop.title}</div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Workspace Stage</div>
                  <div className="mt-2 font-semibold text-white">{deal.productWorkshop.stage}</div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Progress</div>
                  <div className="mt-2 font-semibold text-white">{deal.productWorkshop.progressPercent}%</div>
                </div>
              </>
            )}
          </div>
          <div className="mt-4 text-sm text-slate-400">
            {deal.studentDisplayName} accepted this investor workflow. Use the product workshop to review execution updates, linked workspace status, and founder team progress.
          </div>
        </div>
        <div className="flex shrink-0">
          <Button onClick={() => onOpen(deal.productWorkshop!.workspaceId)}>Open Product Workshop</Button>
        </div>
      </div>
    </Card>
  );
};

type InvestorPortfolioItem = InvestorPortfolioResponse['items'][number];

const PortfolioCompanyCard = ({
  item,
  workshopDeal,
  onOpen,
}: {
  item: InvestorPortfolioItem;
  workshopDeal?: DealSummaryView;
  onOpen: (workspaceId: string) => void;
}) => (
  <Card className="overflow-hidden border border-slate-800 bg-slate-950/50 transition-all hover:border-slate-700">
    <div className="flex flex-col lg:flex-row">
      {/* Left Section - Main Info */}
      <div className="flex-1 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-white">{item.startupName}</h3>
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-medium text-emerald-400">Closed</span>
              </div>
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-cyan-300">
              <Building2 className="h-4 w-4" />
              {item.startupCategory}
            </div>
          </div>
          
          {/* Investment Type Badge */}
          <div className="flex items-center gap-2">
            <Badge
              className={
                item.investorType === 'sole'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                  : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
              }
            >
              {item.investorType === 'sole' ? 'Sole Investor' : 'Penny Investor'}
            </Badge>
            <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              {formatRoleLabel(item.investorRole)}
            </Badge>
            {item.canVeto && (
              <Badge className="border-red-500/30 bg-red-500/10 text-red-300">Veto Power</Badge>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Users className="h-3.5 w-3.5" />
              Founder
            </div>
            <div className="mt-1.5 font-semibold text-white truncate">{item.studentDisplayName}</div>
          </div>
          <div className="rounded-xl bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <DollarSign className="h-3.5 w-3.5" />
              Equity
            </div>
            <div className="mt-1.5 font-semibold text-white">{item.equityPercent}%</div>
          </div>
          <div className="rounded-xl bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <BarChart3 className="h-3.5 w-3.5" />
              Shares
            </div>
            <div className="mt-1.5 font-semibold text-white">{item.sharesAllocated}</div>
          </div>
          <div className="rounded-xl bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <TrendingUp className="h-3.5 w-3.5" />
              Entry Score
            </div>
            <div className="mt-1.5 font-semibold text-white">{item.innovationScoreSnapshot}</div>
          </div>
        </div>

        {/* Voting & Access Section */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span>Voting Weight</span>
              <span className="font-medium text-white">{item.votingWeight}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full ${
                  item.investorType === 'sole' ? 'bg-amber-400' : 'bg-cyan-400'
                }`}
                style={{ width: `${Math.min(item.votingWeight, 100)}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className={`flex items-center gap-1 ${item.canAccessFinancials ? 'text-emerald-400' : 'text-slate-500'}`}>
              {item.canAccessFinancials ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              {item.canAccessFinancials ? 'Financial Access' : 'Limited Access'}
            </span>
            <span className={`flex items-center gap-1 ${item.canRequestUpdates ? 'text-emerald-400' : 'text-slate-500'}`}>
              {item.canRequestUpdates ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              {item.canRequestUpdates ? 'Updates Enabled' : 'Updates Restricted'}
            </span>
          </div>
        </div>
      </div>

      {/* Right Section - Score & Actions */}
      <div className="flex flex-col border-t border-slate-800 lg:border-t-0 lg:border-l lg:w-[280px]">
        <div className="flex-1 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
          <div className="text-center">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Live Score</div>
            <div className="text-5xl font-bold text-white">{item.liveInnovationScore}</div>
            <div
              className={`mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${
                item.scoreTrend >= 0 
                  ? 'bg-emerald-500/10 text-emerald-400' 
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {item.scoreTrend >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingUp className="h-4 w-4 rotate-180" />}
              {item.scoreTrend >= 0 ? '+' : ''}{item.scoreTrend}
            </div>
            <div className="mt-1 text-xs text-slate-500">since investment</div>
          </div>

          {workshopDeal?.productWorkshop && (
            <div className="mt-6 space-y-3">
              <div className="rounded-xl bg-slate-900/80 p-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Workshop Progress</span>
                  <span className="font-semibold text-white">{workshopDeal.productWorkshop.progressPercent}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" 
                    style={{ width: `${workshopDeal.productWorkshop.progressPercent}%` }}
                  />
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/80 p-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Stage</span>
                  <span className="font-semibold text-white">{workshopDeal.productWorkshop.stage}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <Button 
          onClick={() => {
            if (workshopDeal?.productWorkshop) {
              onOpen(workshopDeal.productWorkshop.workspaceId);
            }
          }}
          disabled={!workshopDeal?.productWorkshop}
          className="w-full rounded-none border-t border-slate-800 bg-slate-900 py-4 hover:bg-slate-800"
        >
          Open Product Workshop
        </Button>
      </div>
    </div>
  </Card>
);

export default function ProductWorkshop() {
  const navigate = useNavigate();
  const [portfolioSortBy, setPortfolioSortBy] = useState<'score' | 'recent' | 'name'>('score');
  const [portfolioFilter, setPortfolioFilter] = useState<'all' | 'sole' | 'penny'>('all');
  
  const dealsQuery = useQuery({
    queryKey: ['investor-deals'],
    queryFn: dealApi.getInvestorDeals,
    refetchInterval: 60_000,
  });
  const portfolioQuery = useQuery({
    queryKey: ['investor-portfolio'],
    queryFn: investorApi.getPortfolio,
    refetchInterval: 60_000,
  });

  const workshopDeals = useMemo(() => {
    const flattened = (dealsQuery.data ?? []).flatMap((group) => group.deals);
    return flattened.filter((deal) => Boolean(deal.productWorkshop));
  }, [dealsQuery.data]);

  const pendingWorkshopDeals = useMemo(() => {
    const allDeals = (dealsQuery.data ?? []).flatMap((group) => group.deals);
    return allDeals.filter((deal) => {
      const isActive = deal.currentStage < 4 && deal.status === 'active';
      const hasAccepted = deal.founderDecision.status === 'accepted' || deal.currentStage > 1;
      const noWorkshop = !deal.productWorkshop;
      return isActive && hasAccepted && noWorkshop;
    });
  }, [dealsQuery.data]);

  const ongoingDeals = useMemo(
    () =>
      workshopDeals.filter(
        (deal) =>
          deal.currentStage < 4 &&
          (deal.founderDecision.status === 'accepted' || deal.currentStage > 1),
      ),
    [workshopDeals],
  );

  const portfolioDeals = useMemo(
    () => workshopDeals.filter((deal) => deal.currentStage === 4),
    [workshopDeals],
  );
  const portfolioItems = portfolioQuery.data?.items ?? [];
  
  const filteredAndSortedPortfolioItems = useMemo(() => {
    let items = [...portfolioItems];
    
    if (portfolioFilter !== 'all') {
      items = items.filter(item => item.investorType === portfolioFilter);
    }
    
    switch (portfolioSortBy) {
      case 'recent':
        items.sort(
          (left, right) =>
            new Date(right.closedAt ?? 0).getTime() - new Date(left.closedAt ?? 0).getTime(),
        );
        break;
      case 'name':
        items.sort((left, right) => left.startupName.localeCompare(right.startupName));
        break;
      case 'score':
      default:
        items.sort((left, right) => right.liveInnovationScore - left.liveInnovationScore);
    }
    
    return items;
  }, [portfolioItems, portfolioFilter, portfolioSortBy]);
  
  const portfolioStrength = portfolioQuery.data?.portfolioStrength;
  const portfolioWorkshopsByStartupId = useMemo(
    () =>
      new Map(
        portfolioDeals
          .filter((deal) => Boolean(deal.productWorkshop))
          .map((deal) => [deal.startupId, deal] as const),
      ),
    [portfolioDeals],
  );
  const isLoading = dealsQuery.isLoading || portfolioQuery.isLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Product Workshop</h1>
        <p className="mt-2 max-w-3xl text-slate-400">
          Review active startup execution and monitor closed portfolio companies from one investor workshop.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="p-5">
              <div className="text-3xl font-bold text-white">{getUniqueWorkshopCount(workshopDeals)}</div>
              <div className="mt-2 text-sm text-slate-400">Linked Workshops</div>
            </Card>
            <Card className="p-5">
              <div className="text-3xl font-bold text-white">{ongoingDeals.length}</div>
              <div className="mt-2 text-sm text-slate-400">Ongoing Startup Workshops</div>
            </Card>
            <Card className="p-5">
              <div className="text-3xl font-bold text-white">
                {portfolioStrength?.totalPortfolioCount ?? filteredAndSortedPortfolioItems.length}
              </div>
              <div className="mt-2 text-sm text-slate-400">Portfolio Companies</div>
            </Card>
            <Card className="p-5">
              <div className="text-3xl font-bold text-white">
                {portfolioStrength?.averageLiveInnovationScore ?? 0}
              </div>
              <div className="mt-2 text-sm text-slate-400">Avg Live Portfolio Score</div>
            </Card>
          </div>

          <section className="space-y-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Ongoing</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Active startup execution</h2>
            </div>
            {ongoingDeals.length === 0 ? (
              <Card className="p-6 text-sm text-slate-400">
                No active product workshops yet. A workshop appears here after a founder accepts your deal request and links a startup workspace.
              </Card>
            ) : (
              ongoingDeals.map((deal) => (
                <WorkshopCard
                  key={deal._id}
                  deal={deal}
                  onOpen={(workspaceId) => navigate(`/product-workspace/${workspaceId}`)}
                />
              ))
            )}
          </section>

          {pendingWorkshopDeals.length > 0 && (
            <section className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-amber-300">Awaiting Workshop</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Startups pending workshop connection</h2>
              </div>
              {pendingWorkshopDeals.map((deal) => (
                <Card key={deal._id} className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-xl font-semibold text-white">{deal.startupName}</div>
                      <div className="mt-1 text-sm text-cyan-300">{deal.startupCategory}</div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge>{formatStageLabel(deal)}</Badge>
                        <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                          Workshop not linked
                        </Badge>
                      </div>
                      <div className="mt-4 text-sm text-slate-400">
                        The founder has accepted your deal but hasn't linked a product workshop yet.
                        The workshop will appear here once they connect it from their Investor Deals page.
                      </div>
                    </div>
                    <div className="shrink-0">
                      <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-400">
                        Waiting for founder to link workshop
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </section>
          )}

          <section className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
                  <Briefcase className="h-4 w-4" />
                  Portfolio
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Closed Investments</h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-400">
                  Monitor and track your closed investments with live innovation scores.
                </p>
              </div>
              
              {filteredAndSortedPortfolioItems.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2">
                    <Filter className="h-4 w-4 text-slate-400" />
                    <select 
                      value={portfolioFilter} 
                      onChange={(e) => setPortfolioFilter(e.target.value as 'all' | 'sole' | 'penny')}
                      className="bg-transparent text-sm text-white focus:outline-none"
                    >
                      <option value="all">All Types</option>
                      <option value="sole">Sole Investor</option>
                      <option value="penny">Penny Investor</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2">
                    <ArrowUpDown className="h-4 w-4 text-slate-400" />
                    <select 
                      value={portfolioSortBy} 
                      onChange={(e) => setPortfolioSortBy(e.target.value as 'score' | 'recent' | 'name')}
                      className="bg-transparent text-sm text-white focus:outline-none"
                    >
                      <option value="score">Sort by Score</option>
                      <option value="recent">Sort by Recent</option>
                      <option value="name">Sort by Name</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {filteredAndSortedPortfolioItems.length === 0 ? (
              <Card className="border-dashed border-slate-800 bg-slate-950/50 p-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-900">
                  <Briefcase className="h-8 w-8 text-slate-600" />
                </div>
                <h3 className="text-lg font-semibold text-white">No Portfolio Companies Yet</h3>
                <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
                  Your closed investments will appear here automatically once deals reach Stage 4 - Portfolio.
                </p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredAndSortedPortfolioItems.map((item) => (
                  <PortfolioCompanyCard
                    key={item._id}
                    item={item}
                    workshopDeal={portfolioWorkshopsByStartupId.get(item.startupId)}
                    onOpen={(workspaceId) => navigate(`/product-workspace/${workspaceId}`)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
