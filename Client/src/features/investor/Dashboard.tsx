import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeIndianRupee,
  BriefcaseBusiness,
  Building2,
  Rocket,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { dealApi } from '../../api/deal.api';
import { startupApi } from '../../api/startup.api';
import { DealDetail } from './DealDetail';
import { PatentShowcase } from '../shared/PatentShowcase';
import { InvestorWorkspaceLayout } from './InvestorWorkspaceLayout';

const formatInvestorTypeLabel = (type: string) =>
  type === 'penny' ? 'Penny Investor' : type === 'sole' ? 'Sole Investor' : type;

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

const stageLabels: Record<number, string> = {
  0: 'Negotiation',
  1: 'Due Diligence',
  2: 'Fund Transfer',
  3: 'Equity Transfer',
  4: 'Portfolio',
};

const quickLinks = [
  {
    label: 'Startup Marketplace',
    path: '/dashboard/investor/startups',
    description: 'Browse new founders and open pitch decks.',
    icon: Rocket,
  },
  {
    label: 'Investment Pipeline',
    path: '/dashboard/investor/pipeline',
    description: 'Track active negotiations and stage changes.',
    icon: BriefcaseBusiness,
  },
  {
    label: 'Institutions',
    path: '/dashboard/investor/institutions',
    description: 'Explore colleges and schools behind the startups.',
    icon: Building2,
  },
];

type ActivityItem = {
  id: string;
  title: string;
  description: string;
  occurredAt: string;
  tone: 'deal' | 'pitch';
};

export default function InvestorDashboard() {
  const navigate = useNavigate();
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  const dealsQuery = useQuery({
    queryKey: ['investor-deals'],
    queryFn: dealApi.getInvestorDeals,
    refetchInterval: 60_000,
  });

  const pitchRequestsQuery = useQuery({
    queryKey: ['investor', 'pitch-requests'],
    queryFn: startupApi.getPitchRequests,
    refetchInterval: 60_000,
  });

  const stageGroups = useMemo(() => dealsQuery.data ?? [], [dealsQuery.data]);
  const allDeals = useMemo(() => stageGroups.flatMap((group) => group.deals), [stageGroups]);
  const pitchRequests = pitchRequestsQuery.data ?? [];

  const activeDealsCount = useMemo(
    () => allDeals.filter((deal) => deal.status === 'active' && deal.currentStage < 4).length,
    [allDeals],
  );

  const pendingPitchRequestsCount = useMemo(
    () => pitchRequests.filter((request) => request.status === 'pending').length,
    [pitchRequests],
  );

  const portfolioValue = useMemo(
    () =>
      allDeals
        .filter((deal) => deal.currentStage === 4 || deal.status === 'closed')
        .reduce((total, deal) => total + deal.amountINR, 0),
    [allDeals],
  );

  const recentActivity = useMemo<ActivityItem[]>(() => {
    const dealActivity = allDeals.map((deal) => ({
      id: `deal-${deal._id}`,
      title: `${deal.startupName} is in ${stageLabels[deal.currentStage]}`,
      description: deal.nextActionLabel,
      occurredAt: deal.updatedAt,
      tone: 'deal' as const,
    }));

    const pitchActivity = pitchRequests.map((request) => ({
      id: `pitch-${request._id}`,
      title:
        request.status === 'pending'
          ? `New founder outreach from ${request.startupName}`
          : `${request.startupName} outreach ${request.status}`,
      description:
        request.status === 'pending'
          ? 'Review the founder request and decide whether to engage.'
          : request.responseNote ?? 'Outreach state changed.',
      occurredAt: request.respondedAt ?? request.requestedAt,
      tone: 'pitch' as const,
    }));

    return [...dealActivity, ...pitchActivity]
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
      .slice(0, 6);
  }, [allDeals, pitchRequests]);

  const isLoading = dealsQuery.isLoading || pitchRequestsQuery.isLoading;

  return (
    <InvestorWorkspaceLayout
      title="Investor Dashboard"
      description="Watch live deal flow, respond to founder outreach, and move active startups into due diligence."
    >

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Active Deals</div>
              <div className="mt-3 text-3xl font-bold text-white">{activeDealsCount}</div>
              <div className="mt-2 text-sm text-slate-400">Deals that still need diligence, payment, or closing work.</div>
            </Card>
            <Card className="p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Pitch Requests</div>
              <div className="mt-3 text-3xl font-bold text-white">{pendingPitchRequestsCount}</div>
              <div className="mt-2 text-sm text-slate-400">Pending founder requests waiting for investor review.</div>
            </Card>
            <Card className="p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Portfolio Value</div>
              <div className="mt-3 text-3xl font-bold text-white">{formatCurrency(portfolioValue)}</div>
              <div className="mt-2 text-sm text-slate-400">Committed capital across closed or portfolio-stage deals.</div>
            </Card>
          </div>

          <section className="space-y-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Quick Actions</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Operate the investor workflow</h2>
            </div>
            <div className="grid gap-4 xl:grid-cols-4">
              {quickLinks.map((link) => {
                const Icon = link.icon;

                return (
                  <button
                    key={link.path}
                    type="button"
                    onClick={() => navigate(link.path)}
                    className="rounded-3xl border border-slate-800 bg-slate-950 p-5 text-left transition hover:border-cyan-500/30 hover:bg-slate-900"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-cyan-300">
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-5 w-5 text-slate-500" />
                    </div>
                    <div className="mt-5 text-lg font-semibold text-white">{link.label}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{link.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
            <section className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Pipeline Snapshot</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Deals by stage</h2>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
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
                      {group.deals.slice(0, 3).map((deal) => (
                        <button
                          key={deal._id}
                          type="button"
                          onClick={() => setSelectedDealId(deal._id)}
                          className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left transition hover:border-cyan-500/30 hover:bg-slate-900"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-white">{deal.startupName}</div>
                              <div className="mt-1 text-sm text-slate-400">{deal.studentDisplayName}</div>
                            </div>
                            <Badge
                              className={
                                deal.investorType === 'sole'
                                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                  : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                              }
                            >
                              {formatInvestorTypeLabel(deal.investorType)}
                            </Badge>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-sm">
                            <span className="text-slate-400">{deal.startupCategory}</span>
                            <span className="font-semibold text-cyan-200">{deal.nextActionLabel}</span>
                          </div>
                        </button>
                      ))}
                      {group.deals.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950 p-4 text-sm text-slate-500">
                          No deals in this stage.
                        </div>
                      ) : null}
                      {group.deals.length > 3 ? (
                        <Button variant="secondary" onClick={() => navigate('/dashboard/investor/pipeline')}>
                          View all {group.deals.length} deals
                        </Button>
                      ) : null}
                    </div>
                  </Card>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Recent Activity</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Latest investor signals</h2>
              </div>
              <Card className="p-5">
                <div className="space-y-4">
                  {recentActivity.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950 p-4 text-sm text-slate-500">
                      Activity will appear here after your first pitch response or deal movement.
                    </div>
                  ) : (
                    recentActivity.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-semibold text-white">{item.title}</div>
                            <div className="mt-2 text-sm leading-6 text-slate-400">{item.description}</div>
                          </div>
                          <Badge
                            className={
                              item.tone === 'deal'
                                ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                            }
                          >
                            {item.tone === 'deal' ? 'Deal' : 'Pitch'}
                          </Badge>
                        </div>
                        <div className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                          {new Date(item.occurredAt).toLocaleString('en-IN')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className="border border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 to-slate-950 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300">
                    <BadgeIndianRupee className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white">Portfolio at a glance</div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Closed deals now feed the shared portfolio page, so your investor profile stays aligned with the same presentation used across other roles.
                    </p>
                    <Button className="mt-4" onClick={() => navigate('/portfolio')}>
                      Open Portfolio
                    </Button>
                  </div>
                </div>
              </Card>
            </section>
          </div>
        </>
      )}

      <DealDetail
        dealId={selectedDealId}
        open={Boolean(selectedDealId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDealId(null);
          }
        }}
      />

      <PatentShowcase />
    </InvestorWorkspaceLayout>
  );
}
