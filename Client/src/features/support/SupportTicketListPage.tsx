import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Filter, Plus, Search } from 'lucide-react';
import { supportApi } from '../../api/support.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
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
  SupportCategory,
  SupportPriority,
  SupportStatus,
} from '../../types/support.types';
import {
  SUPPORT_USER_BASE_PATH,
  SupportPriorityBadge,
  SupportStatusBadge,
  buildUserTicketPath,
  formatRelative,
} from './supportShared';

export default function SupportTicketListPage() {
  const [statusFilter, setStatusFilter] = useState<SupportStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<SupportCategory | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<SupportPriority | 'all'>('all');
  const [search, setSearch] = useState('');

  const ticketsQuery = useQuery({
    queryKey: ['support', 'tickets', 'mine', { statusFilter, categoryFilter, priorityFilter, search }],
    queryFn: () =>
      supportApi.listMyTickets({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        search: search.trim() || undefined,
      }),
  });

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_35%)]" />
        <div className="relative flex flex-col gap-4 px-6 py-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="max-w-2xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-300">Support</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">My tickets</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Track every ticket you have raised. Filter by status or priority to focus on what needs a reply.
            </p>
          </div>
          <Link to={`${SUPPORT_USER_BASE_PATH}/new`}>
            <Button className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500">
              <Plus className="h-4 w-4" />
              New Ticket
            </Button>
          </Link>
        </div>
      </section>

      <Card className="border-slate-800 bg-slate-950 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500">
            <Filter className="h-3.5 w-3.5" /> Filters
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as SupportStatus | 'all')}
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All statuses</option>
            {SUPPORT_STATUSES.map((option) => (
              <option key={option} value={option}>
                {SUPPORT_STATUS_LABELS[option]}
              </option>
            ))}
          </select>
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
          <div className="relative ml-auto min-w-[220px] max-w-[360px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by ticket code or keyword"
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
            Unable to load tickets right now. Try refreshing.
          </div>
        ) : (ticketsQuery.data ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 px-5 py-12 text-center text-sm text-slate-400">
            No tickets match these filters. Reset filters or raise a new query.
          </div>
        ) : (
          <div className="space-y-3">
            {ticketsQuery.data?.map((ticket) => (
              <Link
                key={ticket._id}
                to={buildUserTicketPath(ticket._id)}
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
                    </div>
                    <div className="text-sm font-semibold text-white">{ticket.title}</div>
                    <div className="text-xs text-slate-500">
                      Updated {formatRelative(ticket.lastActivityAt)} · Created{' '}
                      {formatRelative(ticket.createdAt)}
                    </div>
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
