import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ArrowRight,
  BadgeIndianRupee,
  BriefcaseBusiness,
  Building2,
  Inbox,
  Rocket,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { dealApi } from '../../api/deal.api';
import { startupApi } from '../../api/startup.api';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '../../components/ui/chart';
import { DealDetail } from './DealDetail';
import { PatentShowcase } from '../shared/PatentShowcase';
import { InvestorWorkspaceLayout } from './InvestorWorkspaceLayout';

const formatInvestorTypeLabel = (type: string) =>
  type === 'penny'
    ? 'Penny Investor'
    : type === 'sole'
      ? 'Sole Investor'
      : type;

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

const stageAccentClasses: Record<number, string> = {
  0: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  1: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
  2: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  3: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
  4: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
};

const stageShortLabels: Record<number, string> = {
  0: 'Neg.',
  1: 'DD',
  2: 'Funds',
  3: 'Equity',
  4: 'Port.',
};

const quickLinks = [
  {
    label: 'Startup Marketplace',
    path: '/dashboard/investor/startups',
    description: 'Browse new founders and open pitch decks.',
    icon: Rocket,
    accentClassName: 'bg-cyan-400',
    iconClassName: 'text-cyan-200',
  },
  {
    label: 'Investment Pipeline',
    path: '/dashboard/investor/pipeline',
    description: 'Track active negotiations and stage changes.',
    icon: BriefcaseBusiness,
    accentClassName: 'bg-blue-400',
    iconClassName: 'text-blue-200',
  },
  {
    label: 'Institutions',
    path: '/dashboard/investor/institutions',
    description: 'Explore colleges and schools behind the startups.',
    icon: Building2,
    accentClassName: 'bg-violet-400',
    iconClassName: 'text-violet-200',
  },
];

type SummaryMetric = {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  to: string;
  accentClassName: string;
  iconClassName: string;
};

const PANEL_CLASS_NAME =
  'rounded-[20px] border border-slate-800 bg-slate-900 shadow-[0_24px_70px_rgba(2,6,23,0.28)]';

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
  const allDeals = useMemo(
    () => stageGroups.flatMap((group) => group.deals),
    [stageGroups],
  );
  const pitchRequests = pitchRequestsQuery.data ?? [];

  const activeDealsCount = useMemo(
    () =>
      allDeals.filter(
        (deal) => deal.status === 'active' && deal.currentStage < 4,
      ).length,
    [allDeals],
  );

  const pendingPitchRequestsCount = useMemo(
    () =>
      pitchRequests.filter((request) => request.status === 'pending').length,
    [pitchRequests],
  );

  const portfolioValue = useMemo(
    () =>
      allDeals
        .filter((deal) => deal.currentStage === 4 || deal.status === 'closed')
        .reduce((total, deal) => total + deal.amountINR, 0),
    [allDeals],
  );

  const pipelineDealCount = allDeals.length;
  const stageChartData = useMemo(
    () =>
      stageGroups.map((group) => ({
        stage: stageShortLabels[group.stage] ?? group.label,
        label: group.label,
        deals: group.deals.length,
      })),
    [stageGroups],
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
          : (request.responseNote ?? 'Outreach state changed.'),
      occurredAt: request.respondedAt ?? request.requestedAt,
      tone: 'pitch' as const,
    }));

    return [...dealActivity, ...pitchActivity]
      .sort(
        (left, right) =>
          new Date(right.occurredAt).getTime() -
          new Date(left.occurredAt).getTime(),
      )
      .slice(0, 6);
  }, [allDeals, pitchRequests]);

  const isLoading = dealsQuery.isLoading || pitchRequestsQuery.isLoading;

  const summaryMetrics = useMemo<SummaryMetric[]>(
    () => [
      {
        label: 'Active Deals',
        value: String(activeDealsCount),
        description: 'Need diligence, transfer, or closing action.',
        icon: BriefcaseBusiness,
        to: '/dashboard/investor/pipeline',
        accentClassName: 'bg-cyan-400',
        iconClassName: 'text-cyan-200',
      },
      {
        label: 'Pitch Requests',
        value: String(pendingPitchRequestsCount),
        description: 'Founder requests waiting for review.',
        icon: Inbox,
        to: '/dashboard/investor/startups',
        accentClassName: 'bg-amber-400',
        iconClassName: 'text-amber-200',
      },
      {
        label: 'Portfolio Value',
        value: formatCurrency(portfolioValue),
        description: 'Committed capital in closed or portfolio deals.',
        icon: BadgeIndianRupee,
        to: '/portfolio',
        accentClassName: 'bg-emerald-400',
        iconClassName: 'text-emerald-200',
      },
    ],
    [activeDealsCount, pendingPitchRequestsCount, portfolioValue],
  );

  return (
    <InvestorWorkspaceLayout
      title="Investor Dashboard"
      description="Watch live deal flow, respond to founder outreach, and move active startups into due diligence."
      contentClassName="flex w-full flex-col gap-6"
    >
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-3">
            {summaryMetrics.map((metric) => {
              const Icon = metric.icon;

              return (
                <button
                  key={metric.label}
                  type="button"
                  onClick={() => navigate(metric.to)}
                  className={`${PANEL_CLASS_NAME} h-full rounded-[16px] px-4 py-4 text-left transition hover:border-slate-700 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/40`}
                >
                  <div
                    className={`h-1 w-12 rounded-full ${metric.accentClassName}`}
                  />
                  <div className="mt-4 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800">
                    <Icon className={`h-4.5 w-4.5 ${metric.iconClassName}`} />
                  </div>
                  <div className="mt-4 text-[30px] font-semibold leading-none tracking-[-0.05em] text-white">
                    {metric.value}
                  </div>
                  <div className="mt-3 text-sm font-semibold text-slate-100">
                    {metric.label}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    {metric.description}
                  </div>
                </button>
              );
            })}
          </section>

          <section className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Quick Actions
                </div>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  Operate the investor workflow
                </h2>
              </div>
              <Button
                variant="secondary"
                onClick={() => navigate('/dashboard/investor/pipeline')}
              >
                Review pipeline
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {quickLinks.map((link) => {
                const Icon = link.icon;

                return (
                  <button
                    key={link.path}
                    type="button"
                    onClick={() => navigate(link.path)}
                    className={`${PANEL_CLASS_NAME} group h-full rounded-[16px] px-4 py-4 text-left transition hover:border-slate-700 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/40`}
                  >
                    <div
                      className={`h-1 w-12 rounded-full ${link.accentClassName}`}
                    />
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800">
                        <Icon className={`h-4.5 w-4.5 ${link.iconClassName}`} />
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-1 group-hover:text-cyan-200" />
                    </div>
                    <div className="mt-4 text-sm font-semibold text-slate-100">
                      {link.label}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {link.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Pipeline Snapshot
                </div>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  Deals by stage
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  One-line view of every deal stage, ordered from negotiation to
                  portfolio.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => navigate('/dashboard/investor/pipeline')}
              >
                Open pipeline
              </Button>
            </div>
            <Card className={`${PANEL_CLASS_NAME} overflow-hidden p-0`}>
              <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-4 py-3">
                <div className="text-xs font-semibold text-white">
                  {pipelineDealCount} total deals
                </div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                  Stage 0-4
                </div>
              </div>
              <div className="overflow-x-auto">
                <div className="grid min-w-[760px] grid-cols-5 lg:min-w-0">
                  {stageGroups.map((group, index) => (
                    <div
                      key={group.stage}
                      className={`flex min-h-[250px] flex-col border-slate-800 bg-slate-950/50 ${
                        index === stageGroups.length - 1 ? '' : 'border-r'
                      }`}
                    >
                      <div className="border-b border-slate-800 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                              {group.label}
                            </div>
                            <div className="mt-1.5 text-xs text-slate-400">
                              {group.deals.length}{' '}
                              {group.deals.length === 1 ? 'deal' : 'deals'}
                            </div>
                          </div>
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                              stageAccentClasses[group.stage]
                            }`}
                          >
                            {group.stage}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col gap-2 p-2.5">
                        {group.deals.length === 0 ? (
                          <div className="flex min-h-[88px] flex-1 items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-950/80 px-3 text-center text-xs leading-5 text-slate-500">
                            No deals in this stage.
                          </div>
                        ) : (
                          <>
                            {group.deals.slice(0, 3).map((deal) => (
                              <button
                                key={deal._id}
                                type="button"
                                onClick={() => setSelectedDealId(deal._id)}
                                className="group rounded-lg border border-slate-800 bg-slate-900/80 p-2.5 text-left transition hover:border-cyan-500/40 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-xs font-semibold text-white">
                                      {deal.startupName}
                                    </div>
                                    <div className="mt-1 truncate text-xs text-slate-400">
                                      {deal.studentDisplayName}
                                    </div>
                                  </div>
                                  <Badge
                                    className={
                                      deal.investorType === 'sole'
                                        ? 'shrink-0 border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300'
                                        : 'shrink-0 border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300'
                                    }
                                  >
                                    {formatInvestorTypeLabel(deal.investorType)}
                                  </Badge>
                                </div>
                                <div className="mt-2 space-y-1 text-xs">
                                  <div className="truncate text-slate-400">
                                    {deal.startupCategory}
                                  </div>
                                  <div className="line-clamp-1 font-semibold leading-5 text-cyan-200">
                                    {deal.nextActionLabel}
                                  </div>
                                </div>
                              </button>
                            ))}
                            {group.deals.length > 3 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  navigate('/dashboard/investor/pipeline')
                                }
                                className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-cyan-200 transition hover:border-cyan-500/40 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                              >
                                +{group.deals.length - 3} more
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </section>

          <section className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-2.5">
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Recent Activity
                </div>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  Latest investor signals
                </h2>
              </div>
              <Card className={`${PANEL_CLASS_NAME} p-3`}>
                <div className="max-h-[248px] space-y-2 overflow-y-auto pr-1">
                  {recentActivity.length === 0 ? (
                    <div className="flex min-h-[48px] items-center rounded-lg border border-dashed border-slate-800 bg-slate-950 p-2.5 text-xs leading-5 text-slate-500">
                      Activity will appear here after your first pitch response or
                      deal movement.
                    </div>
                  ) : (
                    recentActivity.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-slate-800 bg-slate-950 p-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-white">
                              {item.title}
                            </div>
                            <div className="mt-1 line-clamp-1 text-xs text-slate-400">
                              {item.description}
                            </div>
                          </div>
                          <Badge
                            className={`shrink-0 px-2 py-0.5 text-[10px] ${
                              item.tone === 'deal'
                                ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                            }`}
                          >
                            {item.tone === 'deal' ? 'Deal' : 'Pitch'}
                          </Badge>
                        </div>
                        <div className="mt-1.5 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                          {new Date(item.occurredAt).toLocaleString('en-IN')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            <div className="space-y-2.5">
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Investor Graph
                </div>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  Deal distribution by stage
                </h2>
              </div>
              <Card className={`${PANEL_CLASS_NAME} p-3`}>
                <ChartContainer
                  config={{
                    deals: {
                      label: 'Deals',
                      color: '#22d3ee',
                    },
                  }}
                  className="h-[248px] w-full aspect-auto sm:h-[280px]"
                >
                  <BarChart data={stageChartData} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.14)" />
                    <XAxis
                      dataKey="stage"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      width={36}
                    />
                    <ChartTooltip
                      cursor={{ fill: 'rgba(34,211,238,0.08)' }}
                      content={<ChartTooltipContent hideLabel />}
                    />
                    <Bar
                      dataKey="deals"
                      fill="var(--color-deals)"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={54}
                    />
                  </BarChart>
                </ChartContainer>
              </Card>
            </div>
          </section>

          <section>
            <Card className="rounded-[18px] border border-[#5c3512] bg-[linear-gradient(135deg,#321103_0%,#6b2e08_52%,#2b1307_100%)] px-5 py-4 shadow-[0_18px_60px_rgba(120,49,8,0.28)]">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-[#e58b39]/35 bg-[#351809] p-3 text-[#ffb15d]">
                  <BadgeIndianRupee className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-white">
                    Portfolio at a glance
                  </div>
                  <p className="mt-2 text-sm leading-6 text-orange-100/80">
                    Closed deals now feed the shared portfolio page, so your
                    investor profile stays aligned with the same presentation
                    used across other roles.
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => navigate('/portfolio')}
                  >
                    Open Portfolio
                  </Button>
                </div>
              </div>
            </Card>
          </section>
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
