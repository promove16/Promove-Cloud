import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  History,
  Lock,
  MessageSquare,
  RefreshCw,
  Send,
  Shield,
  Star,
  UserCog,
} from 'lucide-react';
import { supportApi } from '../../api/support.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { useAuthStore } from '../../store/authStore';
import {
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
  SupportMessage,
  SupportPriority,
  SupportStatus,
  SupportTicket,
} from '../../types/support.types';
import {
  SUPPORT_ADMIN_BASE_PATH,
  SUPPORT_USER_BASE_PATH,
  SupportPriorityBadge,
  SupportStatusBadge,
  formatSupportDate,
  formatRelative,
} from './supportShared';

interface SupportTicketDetailPageProps {
  context: 'user' | 'admin';
}

const getAdminEntityPath = (ticket: SupportTicket): string | null => {
  if (ticket.relatedStartup?._id) {
    return `/dashboard/admin/startups?startupId=${encodeURIComponent(ticket.relatedStartup._id)}`;
  }

  if (ticket.relatedEntityType === 'startup' && ticket.relatedEntityId) {
    return `/dashboard/admin/startups?startupId=${encodeURIComponent(ticket.relatedEntityId)}`;
  }

  if (ticket.relatedEntityType === 'deal' && ticket.relatedEntityId) {
    return `/dashboard/admin/deals/${encodeURIComponent(ticket.relatedEntityId)}`;
  }

  if (ticket.relatedEntityType === 'patent') {
    return '/dashboard/admin/patents';
  }

  return null;
};

export default function SupportTicketDetailPage({ context }: SupportTicketDetailPageProps) {
  const { ticketId } = useParams<{ ticketId?: string }>();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const [replyBody, setReplyBody] = useState('');
  const [internalNoteBody, setInternalNoteBody] = useState('');
  const [feedbackRating, setFeedbackRating] = useState<number>(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [escalateNote, setEscalateNote] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [startupUnlockNote, setStartupUnlockNote] = useState('');
  const [assignInput, setAssignInput] = useState('');

  const ticketQuery = useQuery({
    queryKey: ['support', 'ticket', context, ticketId],
    enabled: Boolean(ticketId),
    queryFn: () =>
      context === 'admin'
        ? supportApi.adminGetTicket(ticketId as string)
        : supportApi.getTicket(ticketId as string),
  });

  const ticket = ticketQuery.data;
  const isAuthor = ticket ? ticket.createdBy === currentUser?._id : false;
  const basePath = context === 'admin' ? SUPPORT_ADMIN_BASE_PATH : SUPPORT_USER_BASE_PATH;

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['support', 'ticket', context, ticketId] }),
      queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] }),
      queryClient.invalidateQueries({ queryKey: ['support', 'admin'] }),
    ]);
  };

  const userReplyMutation = useMutation({
    mutationFn: async () => {
      if (!ticketId) throw new Error('Ticket not found.');
      return supportApi.addReply(ticketId, replyBody.trim());
    },
    onSuccess: async () => {
      setReplyBody('');
      await invalidate();
    },
  });

  const adminReplyMutation = useMutation({
    mutationFn: async () => {
      if (!ticketId) throw new Error('Ticket not found.');
      return supportApi.adminReply(ticketId, replyBody.trim());
    },
    onSuccess: async () => {
      setReplyBody('');
      await invalidate();
    },
  });

  const internalNoteMutation = useMutation({
    mutationFn: async () => {
      if (!ticketId) throw new Error('Ticket not found.');
      return supportApi.adminInternalNote(ticketId, internalNoteBody.trim());
    },
    onSuccess: async () => {
      setInternalNoteBody('');
      await invalidate();
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async () => {
      if (!ticketId) throw new Error('Ticket not found.');
      return supportApi.reopenTicket(ticketId);
    },
    onSuccess: invalidate,
  });

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      if (!ticketId) throw new Error('Ticket not found.');
      return supportApi.submitFeedback(ticketId, feedbackRating, feedbackComment.trim() || undefined);
    },
    onSuccess: async () => {
      setFeedbackComment('');
      await invalidate();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (status: SupportStatus) => {
      if (!ticketId) throw new Error('Ticket not found.');
      return supportApi.adminChangeStatus(ticketId, status, statusNote.trim() || undefined);
    },
    onSuccess: async () => {
      setStatusNote('');
      await invalidate();
    },
  });

  const priorityMutation = useMutation({
    mutationFn: async (priority: SupportPriority) => {
      if (!ticketId) throw new Error('Ticket not found.');
      return supportApi.adminChangePriority(ticketId, priority);
    },
    onSuccess: invalidate,
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!ticketId) throw new Error('Ticket not found.');
      return supportApi.adminAssign(ticketId, assignInput.trim() || null);
    },
    onSuccess: async () => {
      setAssignInput('');
      await invalidate();
    },
  });

  const escalateMutation = useMutation({
    mutationFn: async () => {
      if (!ticketId) throw new Error('Ticket not found.');
      return supportApi.adminEscalate(ticketId, escalateNote.trim());
    },
    onSuccess: async () => {
      setEscalateNote('');
      await invalidate();
    },
  });
  const startupUnlockMutation = useMutation({
    mutationFn: async () => {
      if (!ticketId) throw new Error('Ticket not found.');
      return supportApi.adminApproveStartupEditUnlock(ticketId, startupUnlockNote.trim() || undefined);
    },
    onSuccess: async () => {
      setStartupUnlockNote('');
      await invalidate();
    },
  });

  const publicMessages = useMemo(
    () => (ticket?.messages ?? []).filter((message) => message.kind !== 'internal_note'),
    [ticket],
  );
  const internalNotes = useMemo(
    () => (ticket?.messages ?? []).filter((message) => message.kind === 'internal_note'),
    [ticket],
  );

  if (!ticketId) {
    return <div className="text-sm text-slate-400">Invalid ticket.</div>;
  }

  if (ticketQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (ticketQuery.isError || !ticket) {
    return (
      <Card className="border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
        Unable to load this ticket. It may have been removed or you do not have access.
      </Card>
    );
  }

  const isResolvedOrClosed = ticket.status === 'resolved' || ticket.status === 'closed';
  const isRelatedStartupLocked = Boolean(ticket.relatedStartup?.editAccess?.isLocked);
  const relatedStartupLockReason =
    ticket.relatedStartup?.editAccess?.reason ?? 'Startup edit status is unavailable.';
  const adminEntityPath = context === 'admin' ? getAdminEntityPath(ticket) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link to={basePath} className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200">
          <ArrowLeft className="h-4 w-4" />
          Back to help desk
        </Link>
        <button
          type="button"
          onClick={() => ticketQuery.refetch()}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      <Card className="border-slate-800 bg-slate-950/90 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-slate-700 bg-slate-950 font-mono text-slate-200">{ticket.ticketCode}</Badge>
              <SupportStatusBadge status={ticket.status} />
              <SupportPriorityBadge priority={ticket.priority} />
              <Badge className="border-slate-700 bg-slate-950 text-slate-300">
                {SUPPORT_CATEGORY_LABELS[ticket.category]}
              </Badge>
              {ticket.overdue ? (
                <Badge className="border-rose-500/30 bg-rose-500/10 text-rose-300">Overdue</Badge>
              ) : null}
            </div>
            <h1 className="text-2xl font-semibold text-white">{ticket.title}</h1>
            <div className="text-xs text-slate-500">
              Opened by {ticket.author?.displayName ?? 'User'} · {formatSupportDate(ticket.createdAt)}
            </div>
          </div>
          <div className="grid gap-2 text-xs uppercase tracking-[0.22em] text-slate-500 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <div>First response</div>
              <div className="mt-1 text-slate-200 normal-case tracking-normal">
                {formatSupportDate(ticket.firstRespondedAt)}
              </div>
            </div>
            <div>
              <div>Resolved</div>
              <div className="mt-1 text-slate-200 normal-case tracking-normal">
                {formatSupportDate(ticket.resolvedAt)}
              </div>
            </div>
            <div>
              <div>Assignee</div>
              <div className="mt-1 text-slate-200 normal-case tracking-normal">
                {ticket.assignee?.displayName ?? 'Unassigned'}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-4 text-sm leading-6 text-slate-300 whitespace-pre-wrap">
          {ticket.description}
        </div>

        {ticket.relatedEntityType || ticket.referenceText ? (
          <div className="mt-4 grid gap-3 text-xs text-slate-400 sm:grid-cols-2">
            {ticket.relatedEntityType ? (
              <>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                <div className="uppercase tracking-[0.22em] text-slate-500">Linked entity</div>
                <div className="mt-1 text-slate-200">
                  {ticket.relatedEntityType}
                  {ticket.relatedEntityId ? ` · ${ticket.relatedEntityId}` : ''}
                </div>
                </div>
                {adminEntityPath ? (
                  <Link
                    to={adminEntityPath}
                    className="mt-2 inline-flex text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300 hover:text-cyan-200"
                  >
                    Open linked record
                  </Link>
                ) : null}
              </>
              ) : null}
            {ticket.referenceText ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                <div className="uppercase tracking-[0.22em] text-slate-500">Reference</div>
                <div className="mt-1 text-slate-200">{ticket.referenceText}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        {ticket.relatedStartup ? (
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-4">
            <>
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Linked startup</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {adminEntityPath ? (
                <Link to={adminEntityPath} className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">
                  {ticket.relatedStartup.name}
                </Link>
              ) : (
                <div className="text-sm font-semibold text-white">{ticket.relatedStartup.name}</div>
              )}
              <Badge className="border-slate-700 bg-slate-950 text-slate-300">
                {ticket.relatedStartup.reviewStatus.replace(/_/g, ' ')}
              </Badge>
              <Badge
                className={
                  isRelatedStartupLocked
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                }
              >
                {isRelatedStartupLocked ? 'Locked' : 'Editable'}
              </Badge>
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-300">
              {relatedStartupLockReason}
            </div>
            {adminEntityPath ? (
              <Link
                to={adminEntityPath}
                className="mt-3 inline-flex text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300 hover:text-cyan-200"
              >
                Open startup review
              </Link>
            ) : null}
            </>
          </div>
        ) : null}

        {ticket.attachments.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {ticket.attachments.map((file) => (
              <a
                key={`${file.url}-${file.name}`}
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-200 hover:border-cyan-500/40 hover:text-cyan-200"
              >
                {file.name}
              </a>
            ))}
          </div>
        ) : null}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr),minmax(280px,0.6fr)]">
        <Card className="border-slate-800 bg-slate-950/90 p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
            <MessageSquare className="h-4 w-4" />
            Conversation
          </div>
          <div className="mt-5 space-y-4">
            {publicMessages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 px-5 py-8 text-sm text-slate-400">
                No replies yet. Support will respond on this ticket — you will be notified.
              </div>
            ) : (
              publicMessages.map((message) => <ConversationBubble key={message._id} message={message} />)
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            {ticket.status === 'closed' && context === 'user' ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Lock className="h-4 w-4" /> This ticket is closed. Reopen it to continue the conversation.
              </div>
            ) : (
              <>
                <label className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  {context === 'admin' ? 'Reply to user' : 'Reply to support'}
                </label>
                <textarea
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                  rows={4}
                  placeholder={
                    context === 'admin'
                      ? 'Share your response to the user…'
                      : 'Add more details, answer a clarification, or share what changed…'
                  }
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {replyBody.trim().length} characters
                  </div>
                  <Button
                    className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
                    onClick={() =>
                      context === 'admin' ? adminReplyMutation.mutate() : userReplyMutation.mutate()
                    }
                    disabled={
                      replyBody.trim().length < 1 ||
                      userReplyMutation.isPending ||
                      adminReplyMutation.isPending
                    }
                  >
                    <Send className="h-4 w-4" />
                    Send Reply
                  </Button>
                </div>
              </>
            )}
          </div>

          {context === 'admin' ? (
            <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-amber-300">
                <Shield className="h-4 w-4" /> Internal notes (visible to staff only)
              </div>
              <div className="mt-3 space-y-3">
                {internalNotes.length === 0 ? (
                  <div className="text-xs text-slate-400">
                    No internal notes yet. Use these to share context between support staff.
                  </div>
                ) : (
                  internalNotes.map((note) => (
                    <div
                      key={note._id}
                      className="rounded-xl border border-amber-500/10 bg-amber-500/5 px-3 py-3 text-sm text-amber-100"
                    >
                      <div className="text-xs uppercase tracking-[0.22em] text-amber-300">
                        {note.author?.displayName ?? 'Staff'} · {formatRelative(note.createdAt)}
                      </div>
                      <div className="mt-2 whitespace-pre-wrap leading-6">{note.body}</div>
                    </div>
                  ))
                )}
              </div>
              <textarea
                value={internalNoteBody}
                onChange={(event) => setInternalNoteBody(event.target.value)}
                rows={3}
                placeholder="Internal note visible only to admins and support staff"
                className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
              />
              <div className="mt-3 flex justify-end">
                <Button
                  variant="secondary"
                  onClick={() => internalNoteMutation.mutate()}
                  disabled={internalNoteBody.trim().length === 0 || internalNoteMutation.isPending}
                >
                  Save Internal Note
                </Button>
              </div>
            </div>
          ) : null}
        </Card>

        <div className="space-y-4">
          {context === 'admin' ? (
            <Card className="border-slate-800 bg-slate-950/90 p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
                <UserCog className="h-4 w-4" /> Admin actions
              </div>

              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Change status</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SUPPORT_STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => statusMutation.mutate(status)}
                        disabled={statusMutation.isPending}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                          ticket.status === status
                            ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                            : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {SUPPORT_STATUS_LABELS[status]}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={statusNote}
                    onChange={(event) => setStatusNote(event.target.value)}
                    rows={2}
                    placeholder="Optional status change note"
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Priority</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SUPPORT_PRIORITIES.map((priority) => (
                      <button
                        key={priority}
                        type="button"
                        onClick={() => priorityMutation.mutate(priority)}
                        disabled={priorityMutation.isPending}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                          ticket.priority === priority
                            ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                            : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {SUPPORT_PRIORITY_LABELS[priority]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Assign</div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={assignInput}
                      onChange={(event) => setAssignInput(event.target.value)}
                      placeholder="Admin user id (empty = unassign)"
                      className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => assignMutation.mutate()}
                      disabled={assignMutation.isPending}
                    >
                      Save
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Escalate</div>
                  <textarea
                    value={escalateNote}
                    onChange={(event) => setEscalateNote(event.target.value)}
                    rows={2}
                    placeholder="Reason for escalation"
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-rose-500 focus:outline-none"
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="danger"
                      onClick={() => escalateMutation.mutate()}
                      disabled={escalateNote.trim().length === 0 || escalateMutation.isPending}
                    >
                      Mark Urgent
                    </Button>
                  </div>
                </div>

                {ticket.relatedStartup && isRelatedStartupLocked ? (
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                      Startup edit unlock
                    </div>
                    <div className="mt-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                      <div className="text-xs leading-5 text-slate-400">
                        Approve a temporary edit window only when the student should be allowed to change the locked startup and resubmit it for review.
                      </div>
                      <textarea
                        value={startupUnlockNote}
                        onChange={(event) => setStartupUnlockNote(event.target.value)}
                        rows={2}
                        placeholder="Optional approval note shown to the student"
                        className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                      />
                      <div className="mt-3 flex justify-end">
                        <Button
                          onClick={() => startupUnlockMutation.mutate()}
                          disabled={startupUnlockMutation.isPending}
                        >
                          Approve Unlock
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {ticket.relatedStartup && !isRelatedStartupLocked ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs leading-5 text-emerald-200">
                    Startup edit unlock is hidden because this startup is already editable. No admin unlock is required
                    right now.
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          {context === 'user' && isAuthor ? (
            <Card className="border-slate-800 bg-slate-950/90 p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
                <CheckCircle2 className="h-4 w-4" /> Your actions
              </div>
              <div className="mt-4 space-y-4 text-sm">
                {isResolvedOrClosed ? (
                  <>
                    <Button
                      variant="secondary"
                      className="gap-2"
                      onClick={() => reopenMutation.mutate()}
                      disabled={reopenMutation.isPending}
                    >
                      <RefreshCw className="h-4 w-4" /> Reopen ticket
                    </Button>

                    {!ticket.feedback ? (
                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Rate resolution</div>
                        <div className="mt-2 flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setFeedbackRating(star)}
                              className={`rounded p-1 ${
                                star <= feedbackRating ? 'text-amber-300' : 'text-slate-600 hover:text-slate-400'
                              }`}
                            >
                              <Star className="h-5 w-5" fill={star <= feedbackRating ? 'currentColor' : 'none'} />
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={feedbackComment}
                          onChange={(event) => setFeedbackComment(event.target.value)}
                          rows={2}
                          placeholder="Optional comment"
                          className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                        />
                        <div className="mt-2 flex justify-end">
                          <Button
                            onClick={() => feedbackMutation.mutate()}
                            disabled={feedbackRating === 0 || feedbackMutation.isPending}
                          >
                            Submit Feedback
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-200">
                        You rated this resolution {ticket.feedback.rating}/5.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-slate-500">
                    You can reopen this ticket or rate it once the team marks it as resolved.
                  </div>
                )}
              </div>
            </Card>
          ) : null}

          <Card className="border-slate-800 bg-slate-950/90 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
              <History className="h-4 w-4" /> Activity log
            </div>
            <div className="mt-4 space-y-3 text-xs">
              {ticket.activity.length === 0 ? (
                <div className="text-slate-500">No activity recorded yet.</div>
              ) : (
                ticket.activity
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <div key={entry._id} className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                      <div className="uppercase tracking-[0.22em] text-slate-500">
                        {entry.type.replace(/_/g, ' ')}
                      </div>
                      <div className="mt-1 text-slate-200">
                        {entry.actor?.displayName ?? 'System'}
                        {entry.fromValue && entry.toValue ? (
                          <span className="text-slate-500">
                            {' '}
                            · {entry.fromValue} → {entry.toValue}
                          </span>
                        ) : null}
                      </div>
                      {entry.note ? <div className="mt-1 text-slate-400">{entry.note}</div> : null}
                      <div className="mt-1 text-slate-500">{formatRelative(entry.at)}</div>
                    </div>
                  ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ConversationBubble({ message }: { message: SupportMessage }) {
  const isAdmin = message.kind === 'admin_reply';
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        isAdmin
          ? 'border-cyan-500/20 bg-cyan-500/5'
          : 'border-slate-800 bg-slate-900/60'
      }`}
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-slate-500">
        <span>
          {isAdmin ? 'Support' : message.author?.role ?? 'User'} · {message.author?.displayName ?? 'Unknown'}
        </span>
        <span>{formatRelative(message.createdAt)}</span>
      </div>
      <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">{message.body}</div>
      {message.attachments.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {message.attachments.map((file) => (
            <a
              key={`${file.url}-${file.name}`}
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-200 hover:border-cyan-500/40 hover:text-cyan-200"
            >
              {file.name}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
