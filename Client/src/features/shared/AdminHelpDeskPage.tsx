import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Headphones, LifeBuoy, Send, Sparkles } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { dmApi } from '../../api/dm.api';
import { requestApi } from '../../api/request.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { useAuthStore } from '../../store/authStore';
import type { WorkflowRequest } from '../../types/request.types';
import {
  buildMediatorReplies,
  getHelpDeskIssueLabel,
  getHelpDeskResolutionNote,
  HELP_DESK_ISSUE_OPTIONS,
  HELP_DESK_REQUEST_TYPE,
  HELP_DESK_TARGET_ENTITY_ID,
  HELP_DESK_TARGET_ENTITY_TITLE,
  HELP_DESK_TARGET_ENTITY_TYPE,
  inferHelpDeskIssueType,
  isHelpDeskTicket,
  parseHelpDeskMetadata,
  type HelpDeskIssueType,
} from './helpDesk';

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return 'Not available';
  }

  return new Date(value).toLocaleString('en-IN');
};

const helpDeskStatusClassName = (status: WorkflowRequest['status']) => {
  if (status === 'completed') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  }

  if (status === 'declined' || status === 'cancelled' || status === 'expired') {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
  }

  if (status === 'accepted') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  }

  return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
};

export default function AdminHelpDeskPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const authUser = useAuthStore((state) => state.user);
  const [issueType, setIssueType] = useState<HelpDeskIssueType>('other');
  const [message, setMessage] = useState('');
  const [submissionFeedback, setSubmissionFeedback] = useState<string | null>(null);

  const adminQuery = useQuery({
    queryKey: ['help-desk', 'admins'],
    queryFn: async () => {
      const users = await dmApi.searchUsers('admin');
      return users.filter((user) => user.role.toLowerCase() === 'admin');
    },
  });

  const ticketsQuery = useQuery({
    queryKey: ['requests', 'outgoing', 'help-desk'],
    queryFn: async () => {
      const requests = await requestApi.outgoing();
      return requests.filter(isHelpDeskTicket);
    },
  });

  const primaryAdmin = adminQuery.data?.[0] ?? null;
  const resolvedIssueType = inferHelpDeskIssueType(message, issueType);
  const mediatorReplies = buildMediatorReplies({
    issueType: resolvedIssueType,
    message,
    displayName: authUser?.displayName,
  });

  const createTicketMutation = useMutation({
    mutationFn: async () => {
      if (!primaryAdmin?._id) {
        throw new Error('No admin contact is available right now.');
      }

      return requestApi.create({
        requestType: HELP_DESK_REQUEST_TYPE,
        actionType: 'connect',
        toUserId: primaryAdmin._id,
        targetEntityType: HELP_DESK_TARGET_ENTITY_TYPE,
        targetEntityId: HELP_DESK_TARGET_ENTITY_ID,
        targetEntityTitle: HELP_DESK_TARGET_ENTITY_TITLE,
        message: message.trim(),
        deepLink: '/dashboard/help-desk',
        metadata: {
          issueType: resolvedIssueType,
          mediatorReplies,
          submittedByRole: authUser?.role,
          submittedByName: authUser?.displayName,
          submittedFromPath: location.pathname,
        },
      });
    },
    onSuccess: async () => {
      setIssueType('other');
      setMessage('');
      setSubmissionFeedback('Your query ticket has been submitted to the admin help desk.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['requests', 'outgoing'] }),
        queryClient.invalidateQueries({ queryKey: ['requests', 'outgoing', 'help-desk'] }),
      ]);
    },
    onError: (error) => {
      setSubmissionFeedback(error instanceof Error ? error.message : 'Unable to submit the help desk ticket.');
    },
  });

  const canSubmit = Boolean(primaryAdmin?._id) && message.trim().length >= 15 && !createTicketMutation.isPending;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
        <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_35%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%)]" />
        <div className="relative space-y-6 px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-300">Help Desk</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Query portal for admin resolution</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Submit platform issues as text tickets. The mediator preview structures the issue first, then the admin
                team reviews and resolves it with notes in the same queue.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Mode</div>
                <div className="mt-2 text-sm font-semibold text-white">Text only</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Mediator</div>
                <div className="mt-2 text-sm font-semibold text-white">Preset AI replies</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Owner</div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {primaryAdmin?.displayName ?? 'Admin unavailable'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr),minmax(320px,0.85fr)]">
        <Card className="border-slate-800 bg-slate-950/90 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">New Ticket</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Submit a help desk query</h2>
              <p className="mt-2 text-sm text-slate-400">
                Choose the issue area, write the problem in plain text, and submit it as an admin ticket.
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
              <Headphones className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {HELP_DESK_ISSUE_OPTIONS.map((option) => {
              const active = issueType === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setIssueType(option.value)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    active
                      ? 'border-cyan-500/40 bg-cyan-500/10'
                      : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                  }`}
                >
                  <div className="text-sm font-semibold text-white">{option.label}</div>
                  <div className="mt-2 text-xs leading-5 text-slate-400">{option.description}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-3">
            <label htmlFor="help-desk-message" className="text-sm font-medium text-slate-200">
              Describe the issue
            </label>
            <textarea
              id="help-desk-message"
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                if (submissionFeedback) {
                  setSubmissionFeedback(null);
                }
              }}
              rows={7}
              placeholder="Example: I submitted my startup for review, but the launch workspace is still blocked after the checklist is complete."
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <div>Minimum 15 characters. Be specific about the page, action, and expected result.</div>
              <div>{message.trim().length} characters</div>
            </div>
          </div>

          {submissionFeedback ? (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                createTicketMutation.isError
                  ? 'border-rose-500/20 bg-rose-500/10 text-rose-200'
                  : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
              }`}
            >
              {submissionFeedback}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              onClick={() => createTicketMutation.mutate()}
              disabled={!canSubmit}
              className="min-w-[180px] gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
            >
              <Send className="h-4 w-4" />
              Submit Ticket
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setIssueType('other');
                setMessage('');
                setSubmissionFeedback(null);
              }}
              disabled={createTicketMutation.isPending}
            >
              Reset Form
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-800 bg-slate-950/90 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Mediator Preview</div>
                <h2 className="mt-2 text-xl font-semibold text-white">Automatic pre-text replies</h2>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                <Bot className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Badge className="border-slate-700 bg-slate-900 text-slate-200">
                {getHelpDeskIssueLabel(resolvedIssueType)}
              </Badge>
              <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">Mediator ready</Badge>
            </div>

            <div className="mt-5 space-y-3">
              {mediatorReplies.map((reply) => (
                <div key={reply} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 text-sm leading-6 text-slate-300">
                  {reply}
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-slate-800 bg-slate-950/90 p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-cyan-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">What to include</div>
                <div className="mt-2 text-sm leading-6 text-slate-400">
                  Mention the affected module, the exact action you tried, any visible error, and what should have happened instead.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card className="border-slate-800 bg-slate-950/90 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">My Tickets</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Submitted help desk queries</h2>
            <p className="mt-2 text-sm text-slate-400">
              Track what was submitted, what the mediator logged, and whether the admin has resolved it.
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-cyan-300">
            <LifeBuoy className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {ticketsQuery.isLoading ? (
            <div className="flex min-h-[24vh] items-center justify-center">
              <Spinner />
            </div>
          ) : ticketsQuery.data?.length ? (
            ticketsQuery.data.map((ticket) => {
              const metadata = parseHelpDeskMetadata(ticket.metadata);
              const resolutionNote = getHelpDeskResolutionNote(ticket);

              return (
                <div key={ticket._id} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge className={helpDeskStatusClassName(ticket.status)}>{ticket.status}</Badge>
                        <Badge className="border-slate-700 bg-slate-950 text-slate-200">
                          {getHelpDeskIssueLabel(metadata.issueType)}
                        </Badge>
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                          Submitted {formatDateTime(ticket.createdAt)}
                        </div>
                      </div>

                      <div className="max-w-4xl rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-4 text-sm leading-6 text-slate-300">
                        {ticket.message || 'No message attached.'}
                      </div>

                      {metadata.mediatorReplies.length > 0 ? (
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Mediator replies</div>
                          {metadata.mediatorReplies.map((reply) => (
                            <div
                              key={reply}
                              className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-sm text-slate-300"
                            >
                              {reply}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {resolutionNote ? (
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
                          <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">Resolution note</div>
                          <div className="mt-2 text-sm leading-6 text-emerald-100">{resolutionNote}</div>
                          <div className="mt-2 text-xs uppercase tracking-[0.18em] text-emerald-200/80">
                            Resolved {formatDateTime(metadata.resolvedAt ?? ticket.respondedAt)}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-800 px-5 py-12 text-sm text-slate-400">
              No help desk tickets submitted yet.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
