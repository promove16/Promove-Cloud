import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, MessageSquareText, Search, Send, Sparkles, Ticket, X } from 'lucide-react';
import { supportApi } from '../../api/support.api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types/roles.types';
import { SupportCategory, SupportTicket } from '../../types/support.types';
import {
  FAQ_ENTRIES,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_USER_BASE_PATH,
  SupportPriorityBadge,
  SupportStatusBadge,
  buildUserTicketPath,
  formatRelative,
} from './supportShared';

const SUPPORTED_ROLES = new Set<UserRole>([UserRole.STUDENT, UserRole.SCHOOL, UserRole.COLLEGE]);
const QUICK_PROMPTS = [
  'I cannot sign in to my account',
  'My workspace access is still blocked',
  'Startup review is stuck after checklist completion',
  'A marketplace application is missing',
  'My profile updates are not visible',
];

const inferCategoryFromDraft = (draft: string): SupportCategory => {
  const value = draft.toLowerCase();

  if (/(login|sign in|signin|password|otp|access denied|locked)/.test(value)) {
    return 'access_login';
  }
  if (/(workspace|invite|chat|collaboration|member|permission)/.test(value)) {
    return 'workspace_collaboration';
  }
  if (/(startup|patent|launch|review|checklist)/.test(value)) {
    return 'startup_patent';
  }
  if (/(marketplace|application|job|listing|offer)/.test(value)) {
    return 'marketplace_applications';
  }
  if (/(school|college|institution|verification|operations)/.test(value)) {
    return 'institution_operations';
  }
  if (/(deal|payment|invoice|investment|investor|transaction)/.test(value)) {
    return 'deals_payments';
  }
  if (/(account|profile|portfolio|avatar|notification)/.test(value)) {
    return 'account_profile';
  }

  return 'other';
};

const buildFallbackReply = (category: SupportCategory) => {
  switch (category) {
    case 'access_login':
      return 'Try password reset first, then retry from a private tab. If the error persists, create a support ticket and include the exact login message.';
    case 'workspace_collaboration':
      return 'Check whether the workspace invite is still pending. If access remains blocked after acceptance, share the workspace name and the action that fails.';
    case 'startup_patent':
      return 'Startup and patent reviews are often queue-based. If the stage is stuck beyond the expected window, escalate with the startup or patent reference.';
    case 'marketplace_applications':
      return 'Refresh the application or listing page once, then confirm whether the action completed in your notifications. If data is still missing, escalate with the related item.';
    case 'institution_operations':
      return 'Include the institution, module, and exact workflow step that is blocked so support can trace the issue quickly.';
    case 'deals_payments':
      return 'Please include the deal or payment reference and whether the issue happened during initiation, confirmation, or settlement.';
    case 'account_profile':
      return 'Profile and account changes can take a few minutes to propagate. If the issue remains, share the field you changed and where it is still outdated.';
    default:
      return 'Describe the page, the action you tried, what you expected, and what happened instead. If the issue needs manual review, create a ticket from this panel.';
  }
};

const deriveSmartReplies = (draft: string, category: SupportCategory) => {
  if (!draft.trim()) {
    return [];
  }

  const value = draft.trim().toLowerCase();
  const faqMatches = FAQ_ENTRIES.filter((faq) =>
    `${faq.question} ${faq.answer} ${SUPPORT_CATEGORY_LABELS[faq.category]}`.toLowerCase().includes(value),
  );

  const replies = faqMatches.map((faq) => faq.answer);
  replies.push(buildFallbackReply(category));

  return Array.from(new Set(replies)).slice(0, 3);
};

const buildTicketTitle = (draft: string) =>
  draft
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80) || 'Support request';

const upsertTicketList = (tickets: SupportTicket[] | undefined, ticket: SupportTicket) =>
  [ticket, ...(tickets ?? []).filter((item) => item._id !== ticket._id)].sort(
    (left, right) =>
      new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime(),
  );

export function SupportFloatingWidget() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'assistant' | 'tickets'>('assistant');
  const [draft, setDraft] = useState('');
  const [assistantReply, setAssistantReply] = useState<string | null>(null);

  const role = user?.role as UserRole | undefined;
  const isSupported = role ? SUPPORTED_ROLES.has(role) : false;

  const ticketsQuery = useQuery({
    queryKey: ['support', 'tickets', 'widget'],
    queryFn: () => supportApi.listMyTickets(),
    enabled: isSupported,
    staleTime: 60_000,
  });

  const inferredCategory = useMemo(() => inferCategoryFromDraft(draft), [draft]);
  const smartReplies = useMemo(() => deriveSmartReplies(draft, inferredCategory), [draft, inferredCategory]);
  const recentTickets = useMemo(() => (ticketsQuery.data ?? []).slice(0, 4), [ticketsQuery.data]);
  const openTicketCount = useMemo(
    () => (ticketsQuery.data ?? []).filter((ticket) => ticket.status === 'open' || ticket.status === 'in_progress').length,
    [ticketsQuery.data],
  );

  const createTicketMutation = useMutation({
    mutationFn: async () =>
      supportApi.createTicket({
        title: buildTicketTitle(draft),
        description: draft.trim(),
        category: inferredCategory,
        priority: inferredCategory === 'deals_payments' ? 'high' : 'medium',
      }),
    onSuccess: async (ticket) => {
      queryClient.setQueryData<SupportTicket[]>(
        ['support', 'tickets', 'widget'],
        (current) => upsertTicketList(current, ticket),
      );
      queryClient.setQueriesData<SupportTicket[]>(
        { queryKey: ['support', 'tickets'] },
        (current) => upsertTicketList(current, ticket),
      );
      setAssistantReply(`I have created ticket ${ticket.ticketCode}. Support will follow up here as needed.`);
      setActiveTab('tickets');
      setDraft('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['support', 'tickets', 'widget'] }),
      ]);
    },
  });

  if (!isSupported) {
    return null;
  }

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px] sm:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="fixed bottom-6 right-4 z-50 md:bottom-8 md:right-6 xl:bottom-6">
        {open ? (
          <div className="flex max-h-[calc(100vh-1.5rem)] w-[min(100vw-1.5rem,24rem)] flex-col overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950/95 shadow-[0_24px_80px_rgba(2,8,23,0.55)] backdrop-blur-xl sm:max-h-[calc(100vh-3rem)]">
            <div className="border-b border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_35%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_32%)] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">Smart Help</div>
                  <div className="mt-1 text-lg font-semibold text-white">Quick answers and support</div>
                  <div className="mt-1 text-xs text-slate-400">
                    Resolve common issues instantly before opening a ticket.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-slate-700 p-2 text-slate-400 transition hover:border-slate-500 hover:text-white"
                  aria-label="Close support assistant"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('assistant')}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    activeTab === 'assistant'
                      ? 'bg-cyan-500/15 text-cyan-200'
                      : 'bg-slate-900/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Assistant
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('tickets')}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    activeTab === 'tickets'
                      ? 'bg-cyan-500/15 text-cyan-200'
                      : 'bg-slate-900/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Tickets
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-6">
              {activeTab === 'assistant' ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setDraft(prompt)}
                        className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-left text-[11px] text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-200"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                    <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
                      <Search className="h-3.5 w-3.5" />
                      Describe the issue
                    </label>
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      rows={4}
                      placeholder="Example: I completed the startup checklist but the launch workspace still says blocked."
                      className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                    />
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs text-slate-500 sm:max-w-[11rem]">
                        {draft.trim().length > 0
                          ? `Detected category: ${SUPPORT_CATEGORY_LABELS[inferredCategory]}`
                          : 'Type an issue to get instant guidance.'}
                      </div>
                      <Button
                        className="w-full gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 sm:w-auto"
                        onClick={() => setAssistantReply(smartReplies[0] ?? buildFallbackReply(inferredCategory))}
                        disabled={draft.trim().length < 6}
                      >
                        <Send className="h-4 w-4" />
                        Get Reply
                      </Button>
                    </div>
                  </div>

                  {assistantReply ? (
                    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/8 p-4">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-cyan-300">
                        <Sparkles className="h-3.5 w-3.5" />
                        Suggested reply
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-100">{assistantReply}</div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
                      <MessageSquareText className="h-3.5 w-3.5" />
                      Recommended next steps
                    </div>
                    {smartReplies.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-4 text-xs text-slate-500">
                        Smart replies appear here once you add enough detail.
                      </div>
                    ) : (
                      smartReplies.map((reply) => (
                        <button
                          key={reply}
                          type="button"
                          onClick={() => setAssistantReply(reply)}
                          className="block w-full rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-left text-sm leading-6 text-slate-200 transition hover:border-cyan-500/40"
                        >
                          {reply}
                        </button>
                      ))
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">Still need human help?</div>
                        <div className="mt-1 text-xs leading-5 text-slate-400">
                          Only escalate once the instant guidance above does not solve the issue.
                        </div>
                      </div>
                      <Ticket className="h-5 w-5 text-cyan-300" />
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs text-slate-500 sm:max-w-[11rem]">
                        Ticket title will be generated from your message.
                      </div>
                      <Button
                        variant="secondary"
                        className="w-full sm:w-auto"
                        onClick={() => createTicketMutation.mutate()}
                        disabled={draft.trim().length < 15 || createTicketMutation.isPending}
                      >
                        {createTicketMutation.isPending ? 'Creating...' : 'Create Ticket'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {ticketsQuery.isLoading ? (
                    <div className="flex min-h-[14rem] items-center justify-center">
                      <Spinner />
                    </div>
                  ) : ticketsQuery.isError ? (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
                      Unable to load tickets right now.
                    </div>
                  ) : recentTickets.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
                      No tickets yet. Use the assistant first and escalate only when needed.
                    </div>
                  ) : (
                    recentTickets.map((ticket) => <TicketListItem key={ticket._id} ticket={ticket} />)
                  )}

                  <Link
                    to={SUPPORT_USER_BASE_PATH}
                    className="block rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-center text-sm font-semibold text-cyan-300 transition hover:border-cyan-500/40 hover:text-cyan-200"
                    onClick={() => setOpen(false)}
                  >
                    Open full support history
                  </Link>
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group flex h-14 w-14 items-center justify-center rounded-full border border-cyan-500/20 bg-slate-950/95 text-left shadow-[0_20px_50px_rgba(2,8,23,0.45)] backdrop-blur-xl transition hover:border-cyan-400/40 xl:h-auto xl:w-auto xl:justify-start xl:gap-2 xl:px-3 xl:py-2.5"
            aria-label="Open smart help desk"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white xl:h-10 xl:w-10">
              <LifeBuoy className="h-5 w-5 xl:h-4.5 xl:w-4.5" />
            </div>
            <div className="hidden xl:block">
              <div className="text-sm font-semibold leading-tight text-white">Smart Help</div>
              <div className="text-[11px] leading-tight text-slate-400">Quick support</div>
            </div>
            {openTicketCount > 0 ? (
              <div className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border border-cyan-500/30 bg-slate-950 px-1 text-[11px] font-semibold text-cyan-200 xl:static xl:h-5 xl:min-w-5 xl:rounded-full xl:px-1.5 xl:text-[10px]">
                {openTicketCount}
              </div>
            ) : null}
          </button>
        )}
      </div>
    </>
  );
}

function TicketListItem({ ticket }: { ticket: SupportTicket }) {
  return (
    <Link
      to={buildUserTicketPath(ticket._id)}
      className="block rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-4 transition hover:border-cyan-500/40"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="border-slate-700 bg-slate-950 font-mono text-slate-200">{ticket.ticketCode}</Badge>
        <SupportStatusBadge status={ticket.status} />
        <SupportPriorityBadge priority={ticket.priority} />
      </div>
      <div className="mt-3 text-sm font-semibold text-white">{ticket.title}</div>
      <div className="mt-2 text-xs text-slate-500">Updated {formatRelative(ticket.lastActivityAt)}</div>
    </Link>
  );
}
