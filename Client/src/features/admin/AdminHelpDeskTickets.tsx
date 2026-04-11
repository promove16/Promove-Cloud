import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, CheckCircle2, Headphones, Inbox } from 'lucide-react';
import { adminApi } from '../../api/admin.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import {
  getHelpDeskIssueLabel,
  getHelpDeskResolutionNote,
  parseHelpDeskMetadata,
} from '../shared/helpDesk';

type HelpDeskStatusFilter = 'pending' | 'completed' | 'all';

const HELP_DESK_STATUS_OPTIONS: Array<{ value: HelpDeskStatusFilter; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return 'Not available';
  }

  return new Date(value).toLocaleString('en-IN');
};

export default function AdminHelpDeskTickets() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<HelpDeskStatusFilter>('pending');
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, string>>({});

  const helpDeskQuery = useQuery({
    queryKey: ['admin-helpdesk', statusFilter],
    queryFn: () => adminApi.getHelpDeskTickets({ status: statusFilter }),
  });

  const resolveTicketMutation = useMutation({
    mutationFn: ({ requestId, resolutionNotes }: { requestId: string; resolutionNotes: string }) =>
      adminApi.resolveHelpDeskTicket(requestId, { resolutionNotes }),
    onSuccess: async (_, variables) => {
      setResolutionDrafts((current) => ({
        ...current,
        [variables.requestId]: '',
      }));

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-helpdesk'] }),
        queryClient.invalidateQueries({ queryKey: ['requests', 'outgoing'] }),
      ]);
    },
  });

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_35%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%)]" />
        <div className="relative flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="max-w-3xl">
              <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-300">Admin Help Desk</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Resolve submitted query tickets</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Review the user's original text, the mediator's preset context, and add a final resolution note when the
                issue is handled.
              </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {HELP_DESK_STATUS_OPTIONS.map((option) => {
              const active = option.value === statusFilter;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    active
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                      : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <Card className="border-slate-800 bg-slate-950/90 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Queue</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Help desk tickets</h2>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-cyan-300">
            <Headphones className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {helpDeskQuery.isLoading ? (
            <div className="flex min-h-[24vh] items-center justify-center">
              <Spinner />
            </div>
          ) : helpDeskQuery.data?.length ? (
            helpDeskQuery.data.map((ticket) => {
              const metadata = parseHelpDeskMetadata(ticket.metadata);
              const draftValue = resolutionDrafts[ticket._id] ?? '';
              const resolutionNote = getHelpDeskResolutionNote(ticket);
              const isCompleted = ticket.status === 'completed';

              return (
                <div key={ticket._id} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge
                          className={
                            isCompleted
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                          }
                        >
                          {ticket.status}
                        </Badge>
                        <Badge className="border-slate-700 bg-slate-950 text-slate-200">
                          {getHelpDeskIssueLabel(metadata.issueType)}
                        </Badge>
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          Created {formatDateTime(ticket.createdAt)}
                        </div>
                      </div>

                      <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                        <div>
                          <span className="text-slate-500">From:</span>{' '}
                          {ticket.fromUser?.displayName ?? ticket.fromUser?.email ?? 'Unknown user'}
                        </div>
                        <div>
                          <span className="text-slate-500">Role:</span> {metadata.submittedByRole ?? ticket.fromUser?.role ?? 'Unknown'}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-4 text-sm leading-6 text-slate-300">
                        {ticket.message || 'No issue text attached.'}
                      </div>

                      {metadata.mediatorReplies.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                            <Bot className="h-4 w-4" />
                            Mediator replies
                          </div>
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
                    </div>

                    <div className="w-full max-w-xl space-y-3 xl:min-w-[360px]">
                      {resolutionNote ? (
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
                          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-emerald-300">
                            <CheckCircle2 className="h-4 w-4" />
                            Resolution note
                          </div>
                          <div className="mt-2 text-sm leading-6 text-emerald-100">{resolutionNote}</div>
                          <div className="mt-2 text-xs uppercase tracking-[0.18em] text-emerald-200/80">
                            Resolved {formatDateTime(metadata.resolvedAt ?? ticket.respondedAt)}
                          </div>
                        </div>
                      ) : null}

                      {!isCompleted ? (
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                          <label htmlFor={`resolution-${ticket._id}`} className="text-sm font-medium text-slate-200">
                            Resolution note
                          </label>
                          <textarea
                            id={`resolution-${ticket._id}`}
                            value={draftValue}
                            onChange={(event) =>
                              setResolutionDrafts((current) => ({
                                ...current,
                                [ticket._id]: event.target.value,
                              }))
                            }
                            rows={5}
                            placeholder="Explain what was checked, what changed, and what the user should do next."
                            className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                          />

                          <div className="mt-4 flex flex-wrap gap-3">
                            <Button
                              onClick={() =>
                                resolveTicketMutation.mutate({
                                  requestId: ticket._id,
                                  resolutionNotes: draftValue.trim(),
                                })
                              }
                              disabled={draftValue.trim().length < 10 || resolveTicketMutation.isPending}
                              className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Mark Resolved
                            </Button>
                          </div>

                          {resolveTicketMutation.isError ? (
                            <div className="mt-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                              {resolveTicketMutation.error instanceof Error
                                ? resolveTicketMutation.error.message
                                : 'Unable to resolve the ticket right now.'}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-800 px-6 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-400">
                <Inbox className="h-6 w-6" />
              </div>
              <div className="mt-4 text-lg font-semibold text-white">No tickets in this view</div>
              <div className="mt-2 text-sm text-slate-400">
                Change the status filter or wait for a new help desk submission.
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
