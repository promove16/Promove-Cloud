import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Handshake, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  MessageSquare,
  TrendingUp,
  DollarSign,
  Users,
  ArrowRight,
  ChevronRight,
  Filter,
  Search,
  Building2
} from 'lucide-react';
import { dealApi } from '../../api/deal.api';
import { investorApi } from '../../api/investor.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { DealDetail } from './DealDetail';

const STAGE_LABELS: Record<number, string> = {
  0: 'Negotiation',
  1: 'Due Diligence',
  2: 'Fund Transfer',
  3: 'Equity Transfer',
  4: 'Portfolio',
};

const STAGE_COLORS: Record<number, string> = {
  0: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  1: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  2: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  3: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  4: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
};

const formatInr = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

export default function InvestmentPipeline() {
  const navigate = useNavigate();
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [showDealDetail, setShowDealDetail] = useState(false);
  const [filterStage, setFilterStage] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const dealsQuery = useQuery({
    queryKey: ['investor-deals'],
    queryFn: dealApi.getInvestorDeals,
    refetchInterval: 30_000,
  });

  const allDeals = useMemo(() => {
    return (dealsQuery.data ?? []).flatMap(group => group.deals);
  }, [dealsQuery.data]);

  const filteredDeals = useMemo(() => {
    let deals = allDeals;

    if (filterStage !== 'all') {
      deals = deals.filter(d => d.currentStage === parseInt(filterStage));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      deals = deals.filter(d => 
        d.startupName.toLowerCase().includes(query) ||
        d.studentDisplayName.toLowerCase().includes(query)
      );
    }

    return deals;
  }, [allDeals, filterStage, searchQuery]);

  const dealsByStage = useMemo(() => {
    const grouped: Record<number, typeof allDeals> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    allDeals.forEach(deal => {
      if (grouped[deal.currentStage]) {
        grouped[deal.currentStage].push(deal);
      }
    });
    return grouped;
  }, [allDeals]);

  const getNegotiationStatus = (deal: any) => {
    const neg = deal.negotiation;
    if (!neg) return null;
    
    const statusLabels: Record<string, { label: string; color: string }> = {
      initial: { label: 'Initial Terms', color: 'text-slate-400' },
      terms_proposed: { label: 'Terms Proposed', color: 'text-amber-400' },
      counter_offer: { label: 'Counter Offer', color: 'text-orange-400' },
      terms_agreed: { label: 'Terms Agreed', color: 'text-emerald-400' },
      stalled: { label: 'Stalled', color: 'text-red-400' },
      cancelled: { label: 'Cancelled', color: 'text-slate-500' },
    };
    
    return statusLabels[neg.status] || { label: neg.status, color: 'text-slate-400' };
  };

  const handleOpenDeal = (dealId: string) => {
    setSelectedDealId(dealId);
    setShowDealDetail(true);
  };

  const DealCard = ({ deal }: { deal: any }) => {
    const negStatus = getNegotiationStatus(deal);
    const isActive = deal.status === 'active';
    const isPendingAcceptance = deal.founderDecision?.status === 'pending';
    const canAdvance = deal.currentStage === 0 && negStatus?.label === 'Terms Agreed';

    return (
      <Card 
        className="cursor-pointer border border-slate-800 bg-slate-950/50 p-4 transition-all hover:border-slate-700 hover:bg-slate-900/50"
        onClick={() => handleOpenDeal(deal._id)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold text-white">{deal.startupName}</h3>
              <Badge className={STAGE_COLORS[deal.currentStage]}>
                {STAGE_LABELS[deal.currentStage]}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-cyan-300">
              <Building2 className="h-3.5 w-3.5" />
              {deal.startupCategory}
            </div>
            
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Users className="h-3.5 w-3.5" />
                <span>{deal.studentDisplayName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <DollarSign className="h-3.5 w-3.5" />
                <span>{formatInr(deal.amountINR)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>{deal.equityPercent}%</span>
              </div>
            </div>

            {deal.currentStage === 0 && negStatus && (
              <div className="mt-3 flex items-center gap-2">
                <span className={`text-xs font-medium ${negStatus.color}`}>
                  {negStatus.label}
                </span>
                {deal.negotiation?.messages?.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <MessageSquare className="h-3 w-3" />
                    {deal.negotiation.messages.length} messages
                  </span>
                )}
              </div>
            )}

            {isPendingAcceptance && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2">
                <Clock className="h-4 w-4 text-amber-400" />
                <span className="text-sm text-amber-300">Awaiting founder response</span>
              </div>
            )}
          </div>

          <ChevronRight className="h-5 w-5 text-slate-600" />
        </div>
      </Card>
    );
  };

  if (dealsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
            <Handshake className="h-4 w-4" />
            Investment Pipeline
          </div>
          <h1 className="mt-2 text-3xl font-bold text-white">Deals & Negotiations</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Track all your investment deals from initial handshake through closing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search startups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl border border-slate-800 bg-slate-900/80 pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Stages</option>
            <option value="0">Negotiation</option>
            <option value="1">Due Diligence</option>
            <option value="2">Fund Transfer</option>
            <option value="3">Equity Transfer</option>
            <option value="4">Portfolio</option>
          </select>
        </div>
      </div>

      {/* Stage Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {Object.entries(STAGE_LABELS).map(([stage, label]) => {
          const count = dealsByStage[parseInt(stage)].length;
          return (
            <button
              key={stage}
              onClick={() => setFilterStage(stage)}
              className={`rounded-xl border p-4 text-left transition ${
                filterStage === stage
                  ? 'border-cyan-500 bg-cyan-950/30'
                  : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
              }`}
            >
              <div className={`text-2xl font-bold ${STAGE_COLORS[parseInt(stage)].split(' ')[2]}`}>
                {count}
              </div>
              <div className="mt-1 text-xs uppercase tracking-wider text-slate-500">{label}</div>
            </button>
          );
        })}
      </div>

      {/* Deals List */}
      {filteredDeals.length === 0 ? (
        <Card className="border-dashed border-slate-800 bg-slate-950/50 p-12 text-center">
          <Handshake className="mx-auto mb-4 h-12 w-12 text-slate-600" />
          <h3 className="text-lg font-semibold text-white">No Deals Found</h3>
          <p className="mt-2 text-slate-400">
            {searchQuery || filterStage !== 'all'
              ? 'Try adjusting your filters'
              : 'Express interest in startups from the marketplace to start your pipeline'}
          </p>
          <Button 
            onClick={() => navigate('/dashboard/investor/startups')}
            className="mt-6"
          >
            Browse Startups
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredDeals.map(deal => (
            <DealCard key={deal._id} deal={deal} />
          ))}
        </div>
      )}

      {/* Deal Detail Modal */}
      <DealDetail
        dealId={selectedDealId}
        open={showDealDetail}
        onOpenChange={setShowDealDetail}
      />
    </div>
  );
}
