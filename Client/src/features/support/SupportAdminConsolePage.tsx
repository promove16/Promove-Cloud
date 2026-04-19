import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlarmClock,
  CheckCircle2,
  Clock,
  Filter,
  Gauge,
  LifeBuoy,
  ListChecks,
  Search,
  Timer,
} from 'lucide-react';
import { supportApi } from '../../api/support.api';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
  SupportAnalyticsSummary,
  SupportCategory,
  SupportPriority,
  SupportStatus,
} from '../../types/support.types';
import {
  SupportPriorityBadge,
  SupportStatusBadge,
  buildAdminTicketPath,
  formatRelative,
} from './supportShared';

type QueueTab = 'all' | SupportStatus | 'overdue';

const QUEUE_TABS: Array<{ id: QueueTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
];

const formatHours = (hours: number | null) => {
  if (hours === null || Number.isNaN(hours)) {
    return '—';
  }
  if (hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))}m`;
  }
  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }
  return `${(hours / 24).toFixed(1)}d`;
};

export default function SupportAdminConsolePage() {
  const [activeTab, setActiveTab] = useState<QueueTab>('all');
  const [categoryFilter, setCategoryFilter] = useState<SupportCategory | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<SupportPriority | 'all'>('all');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [search, setSearch] = useState('');

  const analyticsQuery = useQuery({
    queryKey: ['support', 'admin', 'analytics'],
    queryFn: () => supportApi.adminAnalytics(),
  });

  const ticketsQuery = useQuery({
    queryKey: [
      'support',
      'admin',
      'tickets',
      { activeTab, categoryFilter, priorityFilter, assignedFilter, search },
    ],
    queryFn: () =>
      supportApi.adminList({
        status: activeTab === 'all' || activeTab === 'overdue' ? undefined : activeTab,
        overdue: activeTab === 'overdue' ? true : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        assignedTo: assignedFilter.trim() || undefined,
        search: search.trim() || undefined,
      }),
  });

  const analytics = analyticsQuery.data;
  const tickets = ticketsQuery.data ?? [];

  const summaryCards = useMemo(() => buildSummaryCards(analytics), [analytics]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
        <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_35%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%)]" />
        <div className="relative flex flex-col gap-4 px-6 py-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="max-w-2xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-300">Admin · Support</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Help Desk Console</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Track every user query, triage priority, and keep SLAs on schedule. Tabs cover the full lifecycle
              from open through resolved.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
            <LifeBuoy className="h-4 w-4 text-cyan-300" />
            Support Agents respond during IST working hours
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <Card key={card.label} className="border-slate-800 bg-slate-950 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.label}</div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {analyticsQuery.isLoading ? '—' : card.value}
                </div>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${card.iconClass}`}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
            {card.hint ? <div className="mt-3 text-xs text-slate-500">{card.hint}</div> : null}
          </Card>
        ))}
      </div>

      {analytics ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="border-slate-800 bg-slate-950 p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Volume by category</div>
            <div className="mt-3 space-y-2">
              {SUPPORT_CATEGORIES.map((category) => {
                const value = analytics.byCategory?.[category] ?? 0;
                return (
                  <div key={category} className="flex items-center justify-between text-sm text-slate-300">
                    <span>{SUPPORT_CATEGORY_LABELS[category]}</span>
                    <Badge className="border-slate-700 bg-slate-950 text-slate-200">{value}</Badge>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card className="border-slate-800 bg-slate-950 p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Volume by priority</div>
            <div className="mt-3 space-y-2">
              {SUPPORT_PRIORITIES.map((priority) => {
                const value = analytics.byPriority?.[priority] ?? 0;
                return (
                  <div key={priority} className="flex items-center justify-between text-sm text-slate-300">
                    <span>{SUPPORT_PRIORITY_LABELS[priority]}</span>
                    <Badge className="border-slate-700 bg-slate-950 text-slate-200">{value}</Badge>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      ) : null}

      <Card className="border-slate-800 bg-slate-950 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {QUEUE_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  active
                    ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                    : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500">
            <Filter className="h-3.5 w-3.5" /> Filters
          </div>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as SupportCategory | 'all')}
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All categories</option>
            {SUPPORT_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {SUPPORT_CATEGORY_LABELS[option]}
              </option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value as SupportPriority | 'all')}
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All priorities</option>
            {SUPPORT_PRIORITIES.map((option) => (
              <option key={option} value={option}>
                {SUPPORT_PRIORITY_LABELS[option]}
              </option>
            ))}
          </select>
          <Input
            value={assignedFilter}
            onChange={(event) => setAssignedFilter(event.target.value)}
            placeholder="Assigned admin id"
            className="w-[220px] border-slate-800 bg-slate-950 text-white placeholder:text-slate-500 focus:border-cyan-500"
          />
          <div className="relative ml-auto min-w-[220px] max-w-[320px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by code, title, or user"
              className="border-slate-800 bg-slate-950 pl-9 text-white placeholder:text-slate-500 focus:border-cyan-500"
            />
          </div>
        </div>
      </Card>

      <Card className="border-slate-800 bg-slate-950 p-6">
        {ticketsQuery.isLoading ? (
          <div className="flex min-h-[24vh] items-center justify-center">
            <Spinner />
          </div>
        ) : ticketsQuery.isError ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
            Unable to load support tickets right now. Try refreshing.
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 px-5 py-12 text-center text-sm text-slate-400">
            No tickets match these filters.
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <Link
                key={ticket._id}
                to={buildAdminTicketPath(ticket._id)}
                className="block rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4 transition hover:border-cyan-500/40"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-slate-700 bg-slate-950 font-mono text-slate-200">
                        {ticket.ticketCode}
                      </Badge>
                      <SupportStatusBadge status={ticket.status} />
                      <SupportPriorityBadge priority={ticket.priority} />
                      <Badge className="border-slate-700 bg-slate-950 text-slate-300">
                        {SUPPORT_CATEGORY_LABELS[ticket.category]}
                      </Badge>
                      {ticket.overdue ? (
                        <Badge className="border-rose-500/30 bg-rose-500/10 text-rose-300">Overdue</Badge>
                      ) : null}
                    </div>
                    <div className="text-sm font-semibold text-white">{ticket.title}</div>
                    <div className="text-xs text-slate-500">
                      From {ticket.author?.displayName ?? 'User'}
                      {ticket.assignee?.displayName
                        ? ` · Assigned to ${ticket.assignee.displayName}`
                        : ' · Unassigned'}
                      {' · Updated '}
                      {formatRelative(ticket.lastActivityAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    {SUPPORT_STATUS_LABELS[ticket.status]}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

type SummaryCard = {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof ListChecks;
  iconClass: string;
};

function buildSummaryCards(analytics: SupportAnalyticsSummary | undefined): SummaryCard[] {
  return [
    {
      label: 'Open',
      value: analytics?.open ?? 0,
      icon: ListChecks,
      iconClass: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
      hint: 'Unclaimed and claimed open tickets',
    },
    {
      label: 'In Progress',
      value: analytics?.inProgress ?? 0,
      icon: Gauge,
      iconClass: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
      hint: 'Being actively worked',
    },
    {
      label: 'Resolved Today',
      value: analytics?.resolvedToday ?? 0,
      icon: CheckCircle2,
      iconClass: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
      hint: 'Closed out since midnight',
    },
    {
      label: 'Overdue',
      value: analytics?.overdue ?? 0,
      icon: AlarmClock,
      iconClass: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
      hint: 'Past SLA window for priority',
    },
    {
      label: 'Avg First Response',
      value: formatHours(analytics?.avgFirstResponseHours ?? null),
      icon: Clock,
      iconClass: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
    },
    {
      label: 'Avg Resolution',
      value: formatHours(analytics?.avgResolutionHours ?? null),
      icon: Timer,
      iconClass: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
    },
  ];
}
