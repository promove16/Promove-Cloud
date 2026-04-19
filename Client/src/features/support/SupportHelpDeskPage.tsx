import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ChevronDown,
  LifeBuoy,
  Plus,
  Search,
} from 'lucide-react';
import { supportApi } from '../../api/support.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { useAuthStore } from '../../store/authStore';
import { SUPPORT_CATEGORY_LABELS } from '../../types/support.types';
import {
  SUPPORT_USER_BASE_PATH,
  SupportPriorityBadge,
  SupportStatusBadge,
  buildUserTicketPath,
  formatRelative,
  getFaqsForRole,
  getRoleHelpConfig,
} from './supportShared';

export default function SupportHelpDeskPage() {
  const [search, setSearch] = useState('');
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const user = useAuthStore((state) => state.user);
  const role = user?.role ?? null;
  const config = getRoleHelpConfig(role);
  const roleFaqs = getFaqsForRole(role);

  const ticketsQuery = useQuery({
    queryKey: ['support', 'tickets', 'mine'],
    queryFn: () => supportApi.listMyTickets(),
  });

  // Filter FAQs by search text and active quick-topic category
  const filteredFaqs = useMemo(() => {
    let list = roleFaqs;

    if (activeCategory) {
      list = list.filter((faq) => faq.category === activeCategory);
    }

    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      list = list.filter((faq) =>
        `${faq.question} ${faq.answer} ${SUPPORT_CATEGORY_LABELS[faq.category]}`.toLowerCase().includes(needle),
      );
    }

    return list;
  }, [search, activeCategory, roleFaqs]);

  const recentTickets = ticketsQuery.data?.slice(0, 5) ?? [];

  const accentColor = config.color;

  return (
    <div className="space-y-5">
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
        <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.15),transparent_35%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.12),transparent_28%)]" />
        <div className="relative flex flex-col gap-5 px-6 py-7 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <div className="max-w-2xl">
            <div className={`text-[11px] uppercase tracking-[0.32em] ${accentColor}`}>
              Help Desk
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              {config.greeting}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-400 max-w-xl">
              {config.subtitle}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link to={`${SUPPORT_USER_BASE_PATH}/new`}>
              <Button className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500">
                <Plus className="h-4 w-4" />
                Raise a Ticket
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

      {/* ── Quick Topics (role-specific shortcuts) ───────────────────────────── */}
      {config.quickTopics.length > 0 && (
        <section>
          <div className="mb-3 text-xs uppercase tracking-[0.28em] text-slate-500">
            Common topics for you
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {config.quickTopics.map((topic) => {
              const isActive = activeCategory === topic.category;
              return (
                <button
                  key={topic.label}
                  type="button"
                  onClick={() => setActiveCategory(isActive ? null : topic.category)}
                  className={`group rounded-2xl border px-4 py-4 text-left transition-all ${
                    isActive
                      ? 'border-cyan-500/40 bg-cyan-500/10'
                      : 'border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className={`text-sm font-semibold transition-colors ${isActive ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                    {topic.label}
                  </div>
                  <div className="mt-1 text-xs leading-4 text-slate-500">
                    {topic.description}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Search + FAQ ─────────────────────────────────────────────────────── */}
      <section id="faq-section" className="space-y-3">
        {/* Search bar */}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search help articles${activeCategory ? ` in "${SUPPORT_CATEGORY_LABELS[activeCategory as keyof typeof SUPPORT_CATEGORY_LABELS]}"` : ''}…`}
            className="h-auto border-0 bg-transparent p-0 text-sm text-white placeholder:text-slate-500 focus:ring-0 focus:border-0 shadow-none"
          />
          {(search || activeCategory) && (
            <button
              type="button"
              onClick={() => { setSearch(''); setActiveCategory(null); }}
              className="text-xs text-slate-500 hover:text-slate-300 shrink-0 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* FAQ accordion */}
        <div className="space-y-2">
          {filteredFaqs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-5 py-10 text-center">
              <div className="text-sm font-semibold text-slate-300">No matching articles found</div>
              <div className="mt-2 text-xs text-slate-500">
                Try a different search term, clear the filter, or raise a ticket below.
              </div>
              <div className="mt-4">
                <Link to={`${SUPPORT_USER_BASE_PATH}/new`}>
                  <Button variant="secondary" className="gap-2 text-xs">
                    <Plus className="h-3 w-3" />
                    Raise a Ticket
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const open = openFaqId === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`rounded-2xl border transition-colors ${open ? 'border-slate-700 bg-slate-900' : 'border-slate-800 bg-slate-900 hover:border-slate-700'}`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqId(open ? null : faq.id)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white leading-snug">
                        {faq.question}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                          {SUPPORT_CATEGORY_LABELS[faq.category]}
                        </span>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180 text-slate-300' : ''}`}
                    />
                  </button>
                  {open && (
                    <div className="border-t border-slate-800 px-5 pb-5 pt-4">
                      <p className="text-sm leading-6 text-slate-300">{faq.answer}</p>
                      <div className="mt-4 flex items-center gap-3">
                        <span className="text-xs text-slate-500">Was this helpful?</span>
                        <Link
                          to={`${SUPPORT_USER_BASE_PATH}/new?category=${faq.category}`}
                          className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          Still need help
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ── Browse by category ───────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
            Browse by topic
          </div>
          {activeCategory && (
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Show all
            </button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {config.categories.map((category) => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => {
                  setActiveCategory(isActive ? null : category);
                  // scroll up to FAQ section smoothly
                  document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`rounded-2xl border px-5 py-4 text-left transition-all group ${
                  isActive
                    ? 'border-cyan-500/40 bg-cyan-500/10'
                    : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`text-sm font-semibold transition-colors ${isActive ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                    {SUPPORT_CATEGORY_LABELS[category]}
                  </div>
                  <Link
                    to={`${SUPPORT_USER_BASE_PATH}/new?category=${category}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-slate-400 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors"
                  >
                    <Plus className="h-2.5 w-2.5" />
                    Ticket
                  </Link>
                </div>
                <div className="mt-2 text-xs leading-5 text-slate-500">
                  {/* short descriptions per category */}
                  {SUPPORT_CATEGORY_DESCRIPTIONS_SHORT[category]}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Recent tickets ───────────────────────────────────────────────────── */}
      <Card className="border-slate-800 bg-slate-950 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Activity</div>
            <h2 className="mt-1.5 text-base font-semibold text-white">Your recent tickets</h2>
          </div>
          <Link
            to={`${SUPPORT_USER_BASE_PATH}/tickets`}
            className="flex items-center gap-1 text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-5 space-y-2">
          {ticketsQuery.isLoading ? (
            <div className="flex min-h-[12vh] items-center justify-center">
              <Spinner />
            </div>
          ) : ticketsQuery.isError ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
              Unable to load your tickets right now. Try refreshing.
            </div>
          ) : recentTickets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-5 py-10 text-center">
              <div className="text-sm text-slate-400">No tickets yet.</div>
              <div className="mt-3">
                <Link to={`${SUPPORT_USER_BASE_PATH}/new`}>
                  <Button variant="secondary" className="gap-2 text-xs">
                    <Plus className="h-3 w-3" />
                    Raise your first ticket
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            recentTickets.map((ticket) => (
              <Link
                key={ticket._id}
                to={buildUserTicketPath(ticket._id)}
                className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4 transition hover:border-slate-700 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-slate-700 bg-slate-950 font-mono text-slate-300 text-[11px]">
                      {ticket.ticketCode}
                    </Badge>
                    <SupportStatusBadge status={ticket.status} />
                    <SupportPriorityBadge priority={ticket.priority} />
                  </div>
                  <div className="text-sm font-medium text-white">{ticket.title}</div>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
                  <span>Updated {formatRelative(ticket.lastActivityAt)}</span>
                  <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

// Short descriptions used in category browse grid
const SUPPORT_CATEGORY_DESCRIPTIONS_SHORT: Record<string, string> = {
  access_login: 'Sign-in, password reset, locked accounts.',
  workspace_collaboration: 'Permissions, chat, invites, shared docs.',
  startup_patent: 'Launch checklist, patent submissions, reviewer feedback.',
  marketplace_applications: 'Listings, applications, offers.',
  institution_operations: 'Verification, student management, onboarding.',
  deals_payments: 'Deal rooms, payments, investment tracking.',
  account_profile: 'Profile, portfolio, notifications.',
  other: 'Anything that does not fit above.',
};
