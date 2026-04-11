import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, LifeBuoy, Plus, Search, Sparkles } from 'lucide-react';
import { supportApi } from '../../api/support.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_DESCRIPTIONS,
  SUPPORT_CATEGORY_LABELS,
} from '../../types/support.types';
import {
  FAQ_ENTRIES,
  SUPPORT_USER_BASE_PATH,
  SupportPriorityBadge,
  SupportStatusBadge,
  buildUserTicketPath,
  formatRelative,
} from './supportShared';

export default function SupportHelpDeskPage() {
  const [search, setSearch] = useState('');
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  const ticketsQuery = useQuery({
    queryKey: ['support', 'tickets', 'mine'],
    queryFn: () => supportApi.listMyTickets(),
  });

  const filteredFaqs = useMemo(() => {
    if (!search.trim()) {
      return FAQ_ENTRIES;
    }

    const needle = search.trim().toLowerCase();
    return FAQ_ENTRIES.filter((faq) =>
      `${faq.question} ${faq.answer} ${SUPPORT_CATEGORY_LABELS[faq.category]}`.toLowerCase().includes(needle),
    );
  }, [search]);

  const recentTickets = ticketsQuery.data?.slice(0, 5) ?? [];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
        <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_35%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%)]" />
        <div className="relative flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="max-w-2xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-300">Help Desk</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              How can we help you today?
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Browse quick answers, check the category for your issue, or raise a new support ticket.
              Support responds during IST working hours and escalates urgent issues immediately.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={`${SUPPORT_USER_BASE_PATH}/new`}>
              <Button className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500">
                <Plus className="h-4 w-4" />
                Raise New Query
              </Button>
            </Link>
            <Link to={`${SUPPORT_USER_BASE_PATH}/tickets`}>
              <Button variant="secondary" className="gap-2">
                <LifeBuoy className="h-4 w-4" />
                My Tickets
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Card className="border-slate-800 bg-slate-950/90 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-cyan-300">
            <Search className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Search Knowledge Base</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Find a quick answer</h2>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="e.g. password reset, workspace invite, payment failed…"
              className="mt-3 border-slate-800 bg-slate-950 text-white placeholder:text-slate-500 focus:border-cyan-500"
            />
          </div>
        </div>
      </Card>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Browse by category</h2>
            <p className="text-sm text-slate-400">Pick the area that matches your issue.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {SUPPORT_CATEGORIES.map((category) => (
            <Link key={category} to={`${SUPPORT_USER_BASE_PATH}/new?category=${category}`}>
              <Card className="h-full border-slate-800 bg-slate-900/70 p-5 transition hover:border-cyan-500/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-base font-semibold text-white">{SUPPORT_CATEGORY_LABELS[category]}</div>
                  <Sparkles className="h-4 w-4 text-cyan-300" />
                </div>
                <div className="mt-3 text-sm leading-5 text-slate-400">
                  {SUPPORT_CATEGORY_DESCRIPTIONS[category]}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <Card className="border-slate-800 bg-slate-950/90 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">FAQs</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Top questions</h2>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {filteredFaqs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-5 py-8 text-sm text-slate-400">
              No matching FAQs. Try a different search term or raise a ticket.
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const open = openFaqId === faq.id;
              return (
                <div key={faq.id} className="rounded-2xl border border-slate-800 bg-slate-900/60">
                  <button
                    type="button"
                    onClick={() => setOpenFaqId(open ? null : faq.id)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">{faq.question}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">
                        {SUPPORT_CATEGORY_LABELS[faq.category]}
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open ? (
                    <div className="border-t border-slate-800 px-5 py-4 text-sm leading-6 text-slate-300">
                      {faq.answer}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Card className="border-slate-800 bg-slate-950/90 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Recent Tickets</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Your latest activity</h2>
          </div>
          <Link
            to={`${SUPPORT_USER_BASE_PATH}/tickets`}
            className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
          >
            View all
          </Link>
        </div>
        <div className="mt-5 space-y-3">
          {ticketsQuery.isLoading ? (
            <div className="flex min-h-[20vh] items-center justify-center">
              <Spinner />
            </div>
          ) : ticketsQuery.isError ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
              Unable to load your tickets right now. Try refreshing.
            </div>
          ) : recentTickets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-5 py-10 text-center text-sm text-slate-400">
              You have not raised a ticket yet. Start by browsing a category above.
            </div>
          ) : (
            recentTickets.map((ticket) => (
              <Link
                key={ticket._id}
                to={buildUserTicketPath(ticket._id)}
                className="block rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4 transition hover:border-cyan-500/40"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-slate-700 bg-slate-950 font-mono text-slate-200">
                        {ticket.ticketCode}
                      </Badge>
                      <SupportStatusBadge status={ticket.status} />
                      <SupportPriorityBadge priority={ticket.priority} />
                    </div>
                    <div className="text-sm font-semibold text-white">{ticket.title}</div>
                    <div className="text-xs text-slate-500">
                      Updated {formatRelative(ticket.lastActivityAt)}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
