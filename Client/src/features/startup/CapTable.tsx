import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle2,
  Crown,
  Layers,
  PieChart as PieIcon,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { OptionTabs, type OptionTabItem } from '../../components/ui/OptionTabs';
import { startupApi } from '../../api/startup.api';
import { dealApi } from '../../api/deal.api';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../utils/apiError';
import { normalizeStartupRouteId } from './navigation';
import { isStartupFounder } from './startupAccess';
import { StudentNegotiationCard } from '../../app/pages/dashboards/StudentNegotiationCard';
import { DealCard } from './equity/DealCard';
import { DEAL_STAGE_META, PIPELINE_ORDER } from './equity/dealStageMeta';
import type {
  CapTableInvestorRow,
  CapTableResponse,
  DealStage,
  DealSummaryView,
} from '../../types/deal.types';

type ViewId = 'overview' | 'cap-table' | 'pipeline';

const VIEW_IDS: ViewId[] = ['overview', 'cap-table', 'pipeline'];

const DEFAULT_VIEW: ViewId = 'overview';

const VIEW_TABS: ReadonlyArray<OptionTabItem<ViewId>> = [
  { id: 'overview', label: 'Overview', icon: PieIcon },
  { id: 'cap-table', label: 'Cap Table', icon: Layers },
  { id: 'pipeline', label: 'Deal Pipeline', icon: Briefcase },
];

const formatRoleLabel = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const formatPercent = (value?: number) => {
  if (value === undefined || value === null) return '–';
  return `${Number(value).toFixed(value >= 10 ? 0 : 1)}%`;
};

const formatINR = (value?: number) => {
  if (!value) return '₹0';
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1)} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
};

const formatNumber = (value?: number) => {
  if (!value) return '0';
  return value.toLocaleString('en-IN');
};

const parseView = (value: string | null): ViewId => {
  if (value && (VIEW_IDS as string[]).includes(value)) {
    return value as ViewId;
  }
  return DEFAULT_VIEW;
};

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'warning';
}

function KpiCard({ icon, label, value, hint, tone = 'default' }: KpiCardProps) {
  const accent =
    tone === 'positive'
      ? 'text-emerald-300'
      : tone === 'warning'
        ? 'text-amber-300'
        : 'text-cyan-300';

  return (
    <Card className="border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
        <span className={accent}>{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </Card>
  );
}

function SectionHeader({
  icon,
  title,
  description,
  trailing,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-cyan-300">{icon}</div>
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-slate-400">{description}</p> : null}
        </div>
      </div>
      {trailing ? <div>{trailing}</div> : null}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950 p-10 text-center">
      <div className="text-slate-500">{icon}</div>
      <h3 className="mt-3 text-base font-semibold text-white">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-400">{description}</p>
    </div>
  );
}

interface OwnershipMetrics {
  founderEquity: number;
  founderShares: number;
  investorEquity: number;
  totalShares: number;
  availableShares: number;
}

function deriveOwnership(capTable?: CapTableResponse): OwnershipMetrics {
  if (!capTable) {
    return {
      founderEquity: 100,
      founderShares: 0,
      investorEquity: 0,
      totalShares: 0,
      availableShares: 0,
    };
  }
  return {
    founderEquity: capTable.founderRetained.equityPercent,
    founderShares: capTable.founderRetained.sharesAllocated,
    investorEquity: capTable.totalInvestorEquity,
    totalShares: capTable.totalShares,
    availableShares: capTable.availableShares,
  };
}

interface DealMetrics {
  active: number;
  closed: number;
  byStage: Record<DealStage, number>;
  capitalCommitted: number;
  capitalClosed: number;
  totalAmount: number;
}

function deriveDealMetrics(deals: DealSummaryView[]): DealMetrics {
  const byStage: Record<DealStage, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  let capitalCommitted = 0;
  let capitalClosed = 0;
  let totalAmount = 0;

  deals.forEach((deal) => {
    byStage[deal.currentStage] = (byStage[deal.currentStage] ?? 0) + 1;
    totalAmount += deal.amountINR ?? 0;
    if (deal.currentStage === 4) {
      capitalClosed += deal.amountINR ?? 0;
    } else if (deal.currentStage >= 2 && deal.status === 'active') {
      capitalCommitted += deal.amountINR ?? 0;
    }
  });

  return {
    active: deals.filter((d) => d.status === 'active').length,
    closed: deals.filter((d) => d.currentStage === 4).length,
    byStage,
    capitalCommitted,
    capitalClosed,
    totalAmount,
  };
}

function EquityDistributionCard({
  capTable,
  isFounder,
}: {
  capTable?: CapTableResponse;
  isFounder: boolean;
}) {
  const ownership = deriveOwnership(capTable);
  const founderShare = ownership.founderShares;
  const soleShare = capTable?.soleInvestor?.sharesAllocated ?? 0;
  const pennyShare =
    capTable?.pennyInvestors.reduce((sum, row) => sum + (row.sharesAllocated ?? 0), 0) ?? 0;
  const availableShare = ownership.availableShares;

  const chartData = useMemo(
    () =>
      [
        { name: 'Founder', value: founderShare, color: '#3b82f6' },
        { name: 'Sole Investor', value: soleShare, color: '#a855f7' },
        { name: 'Penny Pool', value: pennyShare, color: '#f59e0b' },
        { name: 'Available', value: availableShare, color: '#475569' },
      ].filter((entry) => entry.value > 0),
    [founderShare, soleShare, pennyShare, availableShare],
  );

  return (
    <Card className="border border-slate-800 bg-slate-950 p-5">
      <SectionHeader
        icon={<PieIcon className="h-4 w-4" />}
        title="Equity Distribution"
        description="How shares are split between founders and investors right now."
      />
      {!isFounder ? (
        <p className="mt-4 text-sm text-slate-400">
          Equity distribution is restricted to startup founders.
        </p>
      ) : chartData.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<PieIcon className="h-6 w-6" />}
            title="No allocation yet"
            description="Once a deal closes or you allocate shares, the distribution will appear here."
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="#0f172a"
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    color: '#e2e8f0',
                    fontSize: 12,
                  }}
                  formatter={(value, name) => [
                    `${formatNumber(Number(value))} shares`,
                    String(name),
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-2 text-sm">
            {chartData.map((entry) => {
              const percent = ownership.totalShares
                ? (entry.value / ownership.totalShares) * 100
                : 0;
              return (
                <li
                  key={entry.name}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-slate-200">{entry.name}</span>
                  </span>
                  <span className="text-right text-xs text-slate-400">
                    <span className="font-semibold text-white">{formatPercent(percent)}</span>
                    <span className="ml-2 text-slate-500">{formatNumber(entry.value)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

function PipelineFunnelCard({ metrics }: { metrics: DealMetrics }) {
  const peak = Math.max(1, ...PIPELINE_ORDER.map((stage) => metrics.byStage[stage]));

  const totalDeals = PIPELINE_ORDER.reduce<number>(
    (sum, stage) => sum + metrics.byStage[stage],
    0,
  );

  return (
    <Card className="border border-slate-800 bg-slate-950 p-5">
      <SectionHeader
        icon={<TrendingUp className="h-4 w-4" />}
        title="Pipeline Funnel"
        description="Where every deal sits across the five-stage lifecycle."
        trailing={
          <Badge className="border-slate-700 bg-slate-900 text-slate-300">
            {totalDeals} {totalDeals === 1 ? 'deal' : 'deals'}
          </Badge>
        }
      />
      {totalDeals === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<Briefcase className="h-6 w-6" />}
            title="No deals yet"
            description="Investor offers will populate the pipeline as they come in."
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {PIPELINE_ORDER.map((stage) => {
            const meta = DEAL_STAGE_META[stage];
            const count = metrics.byStage[stage];
            const width = (count / peak) * 100;
            const StageIcon = meta.icon;
            return (
              <li key={stage}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 text-slate-300">
                    <StageIcon className={`h-3.5 w-3.5 ${meta.textClassName}`} />
                    {meta.pipelineLabel}
                  </span>
                  <span className="font-semibold text-white">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full ${meta.fillClassName} transition-all`}
                    style={{ width: count === 0 ? '4px' : `${Math.max(width, 6)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function CapitalFlowCard({ metrics }: { metrics: DealMetrics }) {
  const total = metrics.capitalCommitted + metrics.capitalClosed;
  const closedRatio = total > 0 ? (metrics.capitalClosed / total) * 100 : 0;

  return (
    <Card className="border border-slate-800 bg-slate-950 p-5">
      <SectionHeader
        icon={<Wallet className="h-4 w-4" />}
        title="Capital Flow"
        description="Funds in motion versus capital already secured."
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">Committed</div>
          <div className="mt-1 text-xl font-semibold text-white">
            {formatINR(metrics.capitalCommitted)}
          </div>
          <p className="mt-1 text-xs text-slate-500">Active deals at payment or beyond.</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="text-[11px] uppercase tracking-wider text-emerald-400">Closed</div>
          <div className="mt-1 text-xl font-semibold text-white">
            {formatINR(metrics.capitalClosed)}
          </div>
          <p className="mt-1 text-xs text-emerald-300/80">Equity allocated and live on the cap table.</p>
        </div>
      </div>
      {total > 0 ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Closed share of capital</span>
            <span className="font-semibold text-white">{formatPercent(closedRatio)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-emerald-500/70 transition-all"
              style={{ width: `${closedRatio}%` }}
            />
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function RecentActivityCard({ deals }: { deals: DealSummaryView[] }) {
  const recent = useMemo(
    () =>
      [...deals]
        .sort(
          (a, b) =>
            new Date(b.updatedAt ?? b.createdAt).getTime() -
            new Date(a.updatedAt ?? a.createdAt).getTime(),
        )
        .slice(0, 5),
    [deals],
  );

  return (
    <Card className="border border-slate-800 bg-slate-950 p-5">
      <SectionHeader
        icon={<Briefcase className="h-4 w-4" />}
        title="Recent Activity"
        description="The latest movement across your deals."
      />
      {recent.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<Briefcase className="h-6 w-6" />}
            title="Nothing to show yet"
            description="Activity will appear here as deals progress."
          />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-slate-800">
          {recent.map((deal) => {
            const meta = DEAL_STAGE_META[deal.currentStage];
            return (
              <li key={deal._id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">
                    {deal.investorDisplayName || 'Investor'}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-500">
                    {deal.nextActionLabel}
                  </div>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.badgeClassName}`}
                >
                  {meta.pipelineLabel}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function CapTableSection({
  capTable,
  isFounder,
}: {
  capTable?: CapTableResponse;
  isFounder: boolean;
}) {
  if (!isFounder) {
    return (
      <Card className="max-w-3xl border border-amber-500/20 bg-amber-500/5 p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200">
          Founder-managed area
        </div>
        <h2 className="mt-3 text-xl font-bold text-white">
          Cap table details are only visible to startup founders.
        </h2>
        <p className="mt-2 text-sm text-amber-100/80">
          Ask a founder of this startup to share the equity distribution with you.
        </p>
      </Card>
    );
  }

  if (!capTable) {
    return (
      <EmptyState
        icon={<Layers className="h-6 w-6" />}
        title="Cap table not available"
        description="The cap table will appear after the first deal closes or shares are allocated."
      />
    );
  }

  const pennyRows = capTable.pennyInvestors;

  return (
    <div className="space-y-4">
      <Card className="border border-slate-800 bg-slate-950 p-5">
        <SectionHeader
          icon={<Crown className="h-4 w-4" />}
          title="Founder Retained"
          description="Shares and equity still held by the founding team."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Equity</div>
            <div className="mt-1 text-2xl font-semibold text-white">
              {formatPercent(capTable.founderRetained.equityPercent)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Shares</div>
            <div className="mt-1 text-2xl font-semibold text-white">
              {formatNumber(capTable.founderRetained.sharesAllocated)}
            </div>
          </div>
        </div>
      </Card>

      <Card className="border border-slate-800 bg-slate-950 p-5">
        <SectionHeader
          icon={<Building2 className="h-4 w-4" />}
          title="Sole Investor"
          description="A single investor with majority influence on this round."
          trailing={
            capTable.soleInvestor ? (
              <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">SOLE</Badge>
            ) : (
              <Badge className="border-slate-700 bg-slate-900 text-slate-300">Open Slot</Badge>
            )
          }
        />
        {capTable.soleInvestor ? (
          <CapTableRow row={capTable.soleInvestor} highlight />
        ) : (
          <p className="mt-4 text-sm text-slate-400">
            No sole investor has joined yet. The slot is available.
          </p>
        )}
      </Card>

      <Card className="border border-slate-800 bg-slate-950 p-5">
        <SectionHeader
          icon={<Users className="h-4 w-4" />}
          title="Penny Investors"
          description="Smaller investors who pool together to back the startup."
          trailing={
            <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
              {pennyRows.length} {pennyRows.length === 1 ? 'investor' : 'investors'}
            </Badge>
          }
        />
        {pennyRows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
            No penny investors yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {pennyRows.map((row) => (
              <CapTableRow key={row.dealId} row={row} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function CapTableRow({
  row,
  highlight = false,
}: {
  row: CapTableInvestorRow;
  highlight?: boolean;
}) {
  return (
    <div
      className={`mt-4 grid gap-3 rounded-xl border p-4 sm:grid-cols-5 ${
        highlight ? 'border-amber-500/20 bg-amber-500/5' : 'border-slate-800 bg-slate-950'
      }`}
    >
      <div className="sm:col-span-2">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">Investor</div>
        <div className="mt-1 truncate font-semibold text-white">{row.name ?? 'Restricted'}</div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-500">Equity</div>
        <div className="mt-1 font-semibold text-white">{formatPercent(row.equityPercent)}</div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-500">Shares</div>
        <div className="mt-1 font-semibold text-white">{formatNumber(row.sharesAllocated)}</div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-500">Authority</div>
        <div className="mt-1 font-semibold text-white">{formatRoleLabel(row.investorRole)}</div>
      </div>
    </div>
  );
}

interface PipelineSectionProps {
  deals: DealSummaryView[];
  onRespond: (dealId: string, decision: 'accepted' | 'rejected') => void;
  onLinkWorkshop: (dealId: string, workspaceId: string) => void;
  respondingDealId?: string;
  linkingDealId?: string;
  linkingWorkspaceId?: string;
}

function DealPipelineSection({
  deals,
  onRespond,
  onLinkWorkshop,
  respondingDealId,
  linkingDealId,
  linkingWorkspaceId,
}: PipelineSectionProps) {
  const grouped = useMemo(() => {
    const map: Record<DealStage, DealSummaryView[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    deals.forEach((deal) => {
      map[deal.currentStage].push(deal);
    });
    return map;
  }, [deals]);

  if (deals.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase className="h-6 w-6" />}
        title="No investor deals yet"
        description="Once an investor expresses interest, the deal will appear here and move through the pipeline."
      />
    );
  }

  return (
    <div className="space-y-6">
      {PIPELINE_ORDER.map((stage) => {
        const stageDeals = grouped[stage];
        if (stageDeals.length === 0) return null;
        const meta = DEAL_STAGE_META[stage];
        const StageIcon = meta.icon;

        return (
          <section key={stage} className="space-y-3">
            <div className="flex items-center gap-2">
              <StageIcon className={`h-4 w-4 ${meta.textClassName}`} />
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">
                {meta.pipelineLabel}
              </h3>
              <Badge className={`text-[10px] uppercase ${meta.badgeClassName}`}>
                {stageDeals.length}
              </Badge>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {stageDeals.map((deal, index) =>
                stage === 0 ? (
                  <StudentNegotiationCard
                    key={deal._id}
                    deal={deal}
                    investorIndex={index}
                  />
                ) : (
                  <DealCard
                    key={deal._id}
                    deal={deal}
                    index={index}
                    onRespond={(decision) => onRespond(deal._id, decision)}
                    isResponding={respondingDealId === deal._id}
                    onLinkWorkshop={(workspaceId) => onLinkWorkshop(deal._id, workspaceId)}
                    isLinking={linkingDealId === deal._id}
                    linkingWorkspaceId={
                      linkingDealId === deal._id ? linkingWorkspaceId : undefined
                    }
                  />
                ),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function StartupEquityAndDeals() {
  const { startupId } = useParams<{ startupId: string }>();
  const normalizedStartupId = normalizeStartupRouteId(startupId);
  const currentUserId = useAuthStore((state) => state.user?._id);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = parseView(searchParams.get('view'));

  const startupQuery = useQuery({
    queryKey: ['startup', normalizedStartupId],
    queryFn: () => startupApi.getById(normalizedStartupId!),
    enabled: Boolean(normalizedStartupId),
  });

  const startup = startupQuery.data;
  const isFounder = isStartupFounder(startup, currentUserId);

  const capTableQuery = useQuery({
    queryKey: ['startup', 'cap-table', normalizedStartupId],
    queryFn: () => startupApi.getCapTable(normalizedStartupId!),
    enabled: Boolean(normalizedStartupId && startup && isFounder),
  });

  const dealsQuery = useQuery({
    queryKey: ['student', 'active-deals'],
    queryFn: dealApi.getMyDeals,
    refetchInterval: 60_000,
    enabled: Boolean(normalizedStartupId),
  });

  const respondMutation = useMutation({
    mutationFn: ({
      dealId,
      decision,
    }: {
      dealId: string;
      decision: 'accepted' | 'rejected';
    }) => dealApi.respondToFounderDecision(dealId, { decision }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['student', 'active-deals'] });
      await queryClient.invalidateQueries({
        queryKey: ['startup', 'cap-table', normalizedStartupId],
      });
    },
  });

  const linkWorkshopMutation = useMutation({
    mutationFn: ({ dealId, workspaceId }: { dealId: string; workspaceId: string }) =>
      dealApi.linkWorkshopToDeal(dealId, workspaceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['student', 'active-deals'] });
    },
  });

  const startupDeals = useMemo(() => {
    const items = dealsQuery.data?.items ?? [];
    return normalizedStartupId
      ? items.filter((deal) => deal.startupId === normalizedStartupId)
      : items;
  }, [dealsQuery.data, normalizedStartupId]);

  const dealMetrics = useMemo(() => deriveDealMetrics(startupDeals), [startupDeals]);
  const ownership = useMemo(
    () => deriveOwnership(capTableQuery.data),
    [capTableQuery.data],
  );

  const isInitialLoading =
    startupQuery.isLoading ||
    (isFounder && capTableQuery.isLoading) ||
    dealsQuery.isLoading;

  if (isInitialLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const fatalError =
    startupQuery.isError || (isFounder && capTableQuery.isError) || dealsQuery.isError;

  if (fatalError) {
    return (
      <Card className="max-w-3xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm text-rose-200">
        {getApiErrorMessage(
          startupQuery.error ?? capTableQuery.error ?? dealsQuery.error,
          'Unable to load equity and deal information right now.',
        )}
      </Card>
    );
  }

  if (!startup) {
    return (
      <Card className="max-w-3xl p-8">
        <h1 className="text-2xl font-semibold text-white">Equity & Deals</h1>
        <p className="mt-2 text-sm text-slate-400">Startup not found.</p>
      </Card>
    );
  }

  const capTable = capTableQuery.data;
  const handleViewChange = (next: ViewId) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === DEFAULT_VIEW) {
          params.delete('view');
        } else {
          params.set('view', next);
        }
        return params;
      },
      { replace: true },
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Equity & Deals</h1>
          <p className="mt-1 text-sm text-slate-400">
            Track ownership and investment activity for{' '}
            <span className="font-medium text-slate-200">{startup.name}</span>.
          </p>
        </div>
        {!isFounder ? (
          <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">
            Founder-restricted view
          </Badge>
        ) : null}
      </header>

      <section
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        aria-label="Equity and deal summary"
      >
        <KpiCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Investor Equity"
          value={isFounder ? formatPercent(ownership.investorEquity) : '—'}
          hint={isFounder ? 'Allocated to investors' : 'Founder-only'}
        />
        <KpiCard
          icon={<Crown className="h-4 w-4" />}
          label="Founder Retained"
          value={isFounder ? formatPercent(ownership.founderEquity) : '—'}
          hint={isFounder ? 'Held by the founding team' : 'Founder-only'}
        />
        <KpiCard
          icon={<Briefcase className="h-4 w-4" />}
          label="Active Deals"
          value={String(dealMetrics.active)}
          hint={`${dealMetrics.closed} closed`}
          tone={dealMetrics.active > 0 ? 'positive' : 'default'}
        />
        <KpiCard
          icon={<Wallet className="h-4 w-4" />}
          label="Capital Closed"
          value={formatINR(dealMetrics.capitalClosed)}
          hint={`${formatINR(dealMetrics.capitalCommitted)} in motion`}
          tone="positive"
        />
        <KpiCard
          icon={<Layers className="h-4 w-4" />}
          label="Available Shares"
          value={isFounder ? formatNumber(ownership.availableShares) : '—'}
          hint={isFounder ? `of ${formatNumber(ownership.totalShares)} total` : 'Founder-only'}
        />
      </section>

      <OptionTabs
        items={VIEW_TABS}
        activeId={activeView}
        onChange={handleViewChange}
        aria-label="Equity and deals views"
      />

      {activeView === 'overview' ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <EquityDistributionCard capTable={capTable} isFounder={isFounder} />
            <PipelineFunnelCard metrics={dealMetrics} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <CapitalFlowCard metrics={dealMetrics} />
            <RecentActivityCard deals={startupDeals} />
          </div>
        </div>
      ) : null}

      {activeView === 'cap-table' ? (
        <CapTableSection capTable={capTable} isFounder={isFounder} />
      ) : null}

      {activeView === 'pipeline' ? (
        <DealPipelineSection
          deals={startupDeals}
          onRespond={(dealId, decision) => respondMutation.mutate({ dealId, decision })}
          onLinkWorkshop={(dealId, workspaceId) =>
            linkWorkshopMutation.mutate({ dealId, workspaceId })
          }
          respondingDealId={
            respondMutation.isPending ? respondMutation.variables?.dealId : undefined
          }
          linkingDealId={
            linkWorkshopMutation.isPending ? linkWorkshopMutation.variables?.dealId : undefined
          }
          linkingWorkspaceId={
            linkWorkshopMutation.isPending
              ? linkWorkshopMutation.variables?.workspaceId
              : undefined
          }
        />
      ) : null}

      {dealsQuery.isFetching && !dealsQuery.isLoading ? (
        <div className="pointer-events-none fixed bottom-6 right-6 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 shadow-lg">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-cyan-400" />
          Refreshing deals…
        </div>
      ) : null}

      {(respondMutation.isError || linkWorkshopMutation.isError) ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {getApiErrorMessage(
            respondMutation.error ?? linkWorkshopMutation.error,
            'Action failed. Please try again.',
          )}
        </div>
      ) : null}
    </div>
  );
}
