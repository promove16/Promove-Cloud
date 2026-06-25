import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, FileText, Inbox, SendHorizontal, ShieldX, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { recruiterApi } from '../../api/recruiter.api';
import { requestApi } from '../../api/request.api';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types/roles.types';
import { WorkflowRequest } from '../../types/request.types';
import {
  getRequestTypeLabel,
  REQUEST_STATUS_COLOR_CLASSES,
  formatRequestStamp,
  formatRequestStatus,
  getRequestActorLabel,
  getRequestEntityName,
  getRequestPrimaryAction,
  getRequestPrimaryLink,
} from './requestPresentation';

const rowClassName =
  'grid gap-4 border-b border-[#334155] px-4 py-4 transition last:border-b-0 lg:grid-cols-[minmax(0,1.7fr)_150px_150px_170px_170px] lg:items-center';

const tableSectionHeaderClassName =
  'flex items-center justify-between border-b border-[#5b5bd6]/50 bg-[#252c6a] px-4 py-4';

function getRequestInitials(value: string) {
  const words = value
    .replace(/[_-]/g, ' ')
    .split(' ')
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return 'RQ';
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
}

function getActionTypeLabel(request: WorkflowRequest) {
  return request.actionType ? request.actionType.replace(/_/g, ' ') : request.targetEntityType.replace(/_/g, ' ');
}

function RequestSummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Inbox;
}) {
  return (
    <div className="rounded-2xl border border-[#3b4658] bg-[#202938] px-4 py-4 shadow-[0_18px_50px_rgba(2,6,23,0.24)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tabular-nums text-white">{value}</div>
          <div className="mt-1 text-sm text-slate-400">{label}</div>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#4b5870] bg-[#2b3547] text-slate-200">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
    fallback
  );
}

function RequestRow({
  request,
  direction,
  viewerUserId,
  isUpdating,
  isSelected,
  onAccept,
  onDecline,
  onWithdraw,
  onOpen,
  onSelect,
}: {
  request: WorkflowRequest;
  direction: 'incoming' | 'outgoing';
  viewerUserId?: string;
  isUpdating: boolean;
  isSelected?: boolean;
  onAccept: (request: WorkflowRequest) => void;
  onDecline: (request: WorkflowRequest) => void;
  onWithdraw: (request: WorkflowRequest) => void;
  onOpen: (request: WorkflowRequest) => void;
  onSelect?: (request: WorkflowRequest) => void;
}) {
  const entityName = getRequestEntityName(request);
  const actorLabel = getRequestActorLabel(request, direction);
  const primaryAction = getRequestPrimaryAction(request, viewerUserId);
  const statusClassName = REQUEST_STATUS_COLOR_CLASSES[request.status];
  const isActionable = direction === 'incoming' ? request.status === 'pending' : request.status === 'pending';

  return (
    <div
      className={`${rowClassName} transition ${
        isSelected ? 'bg-[#334155]' : 'bg-[#202938] hover:bg-[#283447]'
      } ${onSelect ? 'cursor-pointer' : ''}`}
      onClick={() => onSelect?.(request)}
      onKeyDown={(event) => {
        if (!onSelect) {
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(request);
        }
      }}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl border border-[#4b5870] bg-[#6d5dfc] text-sm font-semibold text-white shadow-inner shadow-white/10">
          {getRequestInitials(entityName)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">
            {getRequestTypeLabel(request)} for {entityName}
          </div>
          <div className="mt-1 truncate text-xs text-slate-400">
            {direction === 'incoming' ? 'From' : 'To'} {actorLabel}
          </div>
          {request.message ? <div className="mt-1 truncate text-xs text-slate-500">{request.message}</div> : null}
        </div>
      </div>

      <div className="text-sm capitalize text-slate-300">
        {getActionTypeLabel(request)}
        {(request.requestedRole ?? request.targetRole) ? (
          <div className="mt-1 text-xs text-slate-500">{request.requestedRole ?? request.targetRole}</div>
        ) : null}
      </div>

      <div className="text-xs text-slate-400">
        <div>{formatRequestStamp(request.createdAt)}</div>
        <div className="mt-1 text-slate-600">Expires {formatRequestStamp(request.expiresAt)}</div>
      </div>

      <div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClassName}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {formatRequestStatus(request.status)}
        </span>
        {request.respondedAt ? <div className="mt-1 text-xs text-slate-600">{formatRequestStamp(request.respondedAt)}</div> : null}
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-end" onClick={(event) => event.stopPropagation()}>
        {direction === 'incoming' && isActionable ? (
          <>
            <Button className="h-9 rounded-xl px-3" onClick={() => onAccept(request)} disabled={isUpdating}>
              <Check className="mr-2 h-3.5 w-3.5" />
              Accept
            </Button>
            <Button variant="secondary" className="h-9 rounded-xl px-3" onClick={() => onDecline(request)} disabled={isUpdating}>
              <X className="mr-2 h-3.5 w-3.5" />
              Decline
            </Button>
          </>
        ) : null}
        {direction === 'outgoing' && isActionable ? (
          <Button variant="secondary" className="h-9 rounded-xl px-3" onClick={() => onWithdraw(request)} disabled={isUpdating}>
            Withdraw
          </Button>
        ) : null}
        {primaryAction ? (
          <Button variant="ghost" className="h-9 rounded-xl px-3" onClick={() => onOpen(request)}>
            <ArrowRight className="mr-2 h-3.5 w-3.5" />
            {primaryAction.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function RequestDetailCard({
  request,
  direction,
  viewerUserId,
  isUpdating,
  onAccept,
  onDecline,
  onWithdraw,
  onOpen,
}: {
  request: WorkflowRequest;
  direction: 'incoming' | 'outgoing';
  viewerUserId?: string;
  isUpdating: boolean;
  onAccept: (request: WorkflowRequest) => void;
  onDecline: (request: WorkflowRequest) => void;
  onWithdraw: (request: WorkflowRequest) => void;
  onOpen: (request: WorkflowRequest) => void;
}) {
  const entityName = getRequestEntityName(request);
  const actorLabel = getRequestActorLabel(request, direction);
  const statusClassName = REQUEST_STATUS_COLOR_CLASSES[request.status];
  const primaryAction = getRequestPrimaryAction(request, viewerUserId);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#334155] bg-[#182131] shadow-[0_24px_80px_rgba(2,6,23,0.32)]">
      <div className="space-y-5 px-5 py-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl border border-[#4b5870] bg-[#6d5dfc] text-sm font-semibold text-white">
              {getRequestInitials(entityName)}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">Selected request</div>
              <div className="mt-1 text-lg font-semibold text-white">
                {getRequestTypeLabel(request)} for {entityName}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-400">
                <span>{direction === 'incoming' ? 'From' : 'To'} {actorLabel}</span>
                {request.requestedRole ?? request.targetRole ? (
                  <>
                    <span className="text-slate-600">|</span>
                    <span>Role {request.requestedRole ?? request.targetRole}</span>
                  </>
                ) : null}
                {request.requestedPermission ? (
                  <>
                    <span className="text-slate-600">|</span>
                    <span>{request.requestedPermission}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClassName}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {formatRequestStatus(request.status)}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#3b4658] bg-[#202938] px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Created</div>
            <div className="mt-2 text-sm text-white">{formatRequestStamp(request.createdAt)}</div>
          </div>
          <div className="rounded-xl border border-[#3b4658] bg-[#202938] px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Expires</div>
            <div className="mt-2 text-sm text-white">{formatRequestStamp(request.expiresAt)}</div>
          </div>
        </div>

        {request.message ? (
          <div className="rounded-xl border border-[#3b4658] bg-[#202938] px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
              <FileText className="h-3.5 w-3.5" />
              Message
            </div>
            <div className="mt-3 text-sm leading-6 text-slate-200">{request.message}</div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {direction === 'incoming' && request.status === 'pending' ? (
            <>
              <Button className="h-10 rounded-xl px-4" onClick={() => onAccept(request)} disabled={isUpdating}>
                <Check className="mr-2 h-4 w-4" />
                Accept
              </Button>
              <Button variant="secondary" className="h-10 rounded-xl px-4" onClick={() => onDecline(request)} disabled={isUpdating}>
                <X className="mr-2 h-4 w-4" />
                Decline
              </Button>
            </>
          ) : null}
          {direction === 'outgoing' && request.status === 'pending' ? (
            <Button variant="secondary" className="h-10 rounded-xl px-4" onClick={() => onWithdraw(request)} disabled={isUpdating}>
              Withdraw
            </Button>
          ) : null}
          {primaryAction ? (
            <Button variant="ghost" className="h-10 rounded-xl px-4" onClick={() => onOpen(request)}>
              <ArrowRight className="mr-2 h-4 w-4" />
              {primaryAction.label}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

type InvitationPageProps = {
  selectedRequestId?: string | null;
  onSelectRequest?: (requestId: string) => void;
};

export function InvitationPage({ selectedRequestId, onSelectRequest }: InvitationPageProps = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const currentRole = user?.role;

  const [feedback, setFeedback] = useState('');

  const allowedPageRoles = useMemo(
    () => [
      UserRole.STUDENT,
      UserRole.SCHOOL,
      UserRole.COLLEGE,
      UserRole.RECRUITER,
      UserRole.INVESTOR,
      UserRole.MENTOR,
    ],
    [],
  );
  const canOpenPage = Boolean(user && currentRole && allowedPageRoles.includes(currentRole));

  const incomingQuery = useQuery({
    queryKey: ['requests', 'incoming'],
    queryFn: requestApi.incoming,
    enabled: canOpenPage,
  });
  const outgoingQuery = useQuery({
    queryKey: ['requests', 'outgoing'],
    queryFn: requestApi.outgoing,
    enabled: canOpenPage,
  });
  const recruiterHiringEventsQuery = useQuery({
    queryKey: ['recruiter', 'hiring-events'],
    queryFn: recruiterApi.getHiringEvents,
    enabled: currentRole === UserRole.RECRUITER,
  });
  const recruiterJobsQuery = useQuery({
    queryKey: ['recruiter', 'jobs'],
    queryFn: recruiterApi.getJobs,
    enabled: currentRole === UserRole.RECRUITER,
  });

  const refreshRequests = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['requests'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
      queryClient.invalidateQueries({ queryKey: ['student', 'applications'] }),
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'job-applications'] }),
    ]);
  };

  const requestActionMutation = useMutation({
    mutationFn: (params: { action: 'accept' | 'decline' | 'withdraw'; request: WorkflowRequest }) => {
      if (params.action === 'accept') return requestApi.accept(params.request._id);
      if (params.action === 'decline') return requestApi.decline(params.request._id);
      return requestApi.withdraw(params.request._id);
    },
    onSuccess: async (request, variables) => {
      await refreshRequests();
      const nextTarget =
        variables.action === 'accept'
          ? getRequestPrimaryLink(request, user?._id) ?? getRequestPrimaryLink(variables.request, user?._id)
          : null;

      if (nextTarget) {
        navigate(nextTarget);
        return;
      }
      setFeedback(`Request ${request.status}.`);
    },
    onError: (error) => setFeedback(getErrorMessage(error, 'Unable to update request.')),
  });

  const incomingRequests = incomingQuery.data ?? [];
  const outgoingRequests = outgoingQuery.data ?? [];
  const isLoading = incomingQuery.isLoading || outgoingQuery.isLoading;
  const requestEntries = useMemo(
    () => [
      ...incomingRequests.map((request) => ({ request, direction: 'incoming' as const })),
      ...outgoingRequests.map((request) => ({ request, direction: 'outgoing' as const })),
    ],
    [incomingRequests, outgoingRequests],
  );
  const pendingRequestCount = requestEntries.filter((entry) => entry.request.status === 'pending').length;
  const selectedEntry = requestEntries.find((entry) => entry.request._id === selectedRequestId) ?? requestEntries[0] ?? null;
  const recruiterEventStats = useMemo(() => {
    const events = recruiterHiringEventsQuery.data ?? [];
    const jobs = recruiterJobsQuery.data ?? [];
    return {
      events: events.length,
      registrations: events.reduce((sum, event) => sum + event.participantsCount, 0),
      activeJobs: jobs.filter((job) => job.isActive).length,
    };
  }, [recruiterHiringEventsQuery.data, recruiterJobsQuery.data]);

  if (!canOpenPage || !user || !currentRole) {
    return (
      <div className="border border-slate-800 px-4 py-5 text-sm text-slate-300">
        <div className="flex items-center gap-2 text-amber-300">
          <ShieldX className="h-4 w-4" />
          Invitation access is restricted.
        </div>
        <div className="mt-2 text-slate-500">This page is available for active product roles only.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      <section className="overflow-hidden rounded-3xl border border-slate-800/80 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.14),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] px-5 py-5 shadow-[0_28px_90px_rgba(2,6,23,0.35)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-cyan-200/70">Requests</div>
            <h1 className="mt-2 text-3xl font-semibold leading-tight text-white">Request inbox</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
              Review incoming and outgoing requests with the essential context, status, and available action.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
            <RequestSummaryCard label="Incoming" value={incomingRequests.length} icon={Inbox} />
            <RequestSummaryCard label="Outgoing" value={outgoingRequests.length} icon={SendHorizontal} />
            <RequestSummaryCard label="Pending" value={pendingRequestCount} icon={FileText} />
          </div>
        </div>
      </section>

      {feedback ? <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">{feedback}</div> : null}

      {currentRole === UserRole.RECRUITER ? (
        <section className="border border-slate-800">
          <div className="border-b border-slate-800 px-3 py-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">
            Recruiter Hiring Hub
          </div>
          <div className="grid gap-3 px-3 py-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto_auto] lg:items-center">
            <div className="rounded-xl border border-slate-800 px-4 py-3">
              <div className="text-2xl font-semibold text-white">{recruiterEventStats.events}</div>
              <div className="mt-1 text-sm text-slate-400">Hiring events created</div>
            </div>
            <div className="rounded-xl border border-slate-800 px-4 py-3">
              <div className="text-2xl font-semibold text-white">{recruiterEventStats.registrations}</div>
              <div className="mt-1 text-sm text-slate-400">Event registrations</div>
            </div>
            <div className="rounded-xl border border-slate-800 px-4 py-3">
              <div className="text-2xl font-semibold text-white">{recruiterEventStats.activeJobs}</div>
              <div className="mt-1 text-sm text-slate-400">Active recruiter jobs</div>
            </div>
            <Button onClick={() => navigate('/dashboard/recruiter/hiring-events')}>Open Hiring Events</Button>
            <Button variant="secondary" onClick={() => navigate('/dashboard/recruiter/applications')}>
              Open Pipeline
            </Button>
          </div>
        </section>
      ) : null}

      {requestEntries.length > 0 && onSelectRequest ? (
        <section className="overflow-hidden rounded-2xl border border-[#334155] bg-[#182131] lg:hidden">
          <div className="border-b border-[#334155] bg-[#202938] px-4 py-3 text-[11px] uppercase tracking-[0.28em] text-slate-400">
            Choose request
          </div>
          <div className="px-4 py-4">
            <select
              value={selectedEntry?.request._id ?? ''}
              onChange={(event) => onSelectRequest?.(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#3b4658] bg-[#202938] px-3 text-sm text-white focus:border-cyan-500 focus:outline-none"
            >
              {requestEntries.map(({ request, direction }) => (
                <option key={request._id} value={request._id} className="bg-slate-950">
                  {(direction === 'incoming' ? 'Incoming' : 'Outgoing')} · {getRequestTypeLabel(request)} · {getRequestEntityName(request)}
                </option>
              ))}
            </select>
          </div>
        </section>
      ) : null}

      {selectedEntry ? (
        <RequestDetailCard
          request={selectedEntry.request}
          direction={selectedEntry.direction}
          viewerUserId={user?._id}
          isUpdating={requestActionMutation.isPending}
          onAccept={(item) => requestActionMutation.mutate({ action: 'accept', request: item })}
          onDecline={(item) => requestActionMutation.mutate({ action: 'decline', request: item })}
          onWithdraw={(item) => requestActionMutation.mutate({ action: 'withdraw', request: item })}
          onOpen={(item) => {
            const target = getRequestPrimaryLink(item, user?._id);
            if (target) {
              navigate(target);
            }
          }}
        />
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-[#334155] bg-[#182131] shadow-[0_20px_70px_rgba(2,6,23,0.22)]">
        <div className={tableSectionHeaderClassName}>
          <div>
            <h2 className="text-sm font-semibold text-white">Incoming requests</h2>
            <p className="mt-1 text-xs text-violet-200/75">Requests waiting for your response.</p>
          </div>
          <span className="text-xs tabular-nums text-violet-100/80">{incomingRequests.length} total</span>
        </div>
        <div className="grid gap-4 border-b border-[#334155] bg-[#2b3547] px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-slate-300 lg:grid-cols-[minmax(0,1.7fr)_150px_150px_170px_170px]">
          <div>Request</div>
          <div>Type</div>
          <div>Created</div>
          <div>Status</div>
          <div className="lg:text-right">Actions</div>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center gap-3 p-8 text-sm text-slate-400">
            <Spinner />
            Loading incoming requests
          </div>
        ) : incomingRequests.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-500">No incoming requests.</div>
        ) : (
          incomingRequests.map((request) => (
            <RequestRow
              key={request._id}
              request={request}
              direction="incoming"
              viewerUserId={user?._id}
              isUpdating={requestActionMutation.isPending}
              isSelected={selectedEntry?.request._id === request._id}
              onAccept={(item) => requestActionMutation.mutate({ action: 'accept', request: item })}
              onDecline={(item) => requestActionMutation.mutate({ action: 'decline', request: item })}
              onWithdraw={(item) => requestActionMutation.mutate({ action: 'withdraw', request: item })}
              onOpen={(item) => {
                const target = getRequestPrimaryLink(item, user?._id);
                if (target) {
                  navigate(target);
                }
              }}
              onSelect={onSelectRequest ? (item) => onSelectRequest(item._id) : undefined}
            />
          ))
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#334155] bg-[#182131] shadow-[0_20px_70px_rgba(2,6,23,0.22)]">
        <div className={tableSectionHeaderClassName}>
          <div>
            <h2 className="text-sm font-semibold text-white">Outgoing requests</h2>
            <p className="mt-1 text-xs text-violet-200/75">Requests you have sent to other users.</p>
          </div>
          <span className="text-xs tabular-nums text-violet-100/80">{outgoingRequests.length} total</span>
        </div>
        <div className="grid gap-4 border-b border-[#334155] bg-[#2b3547] px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-slate-300 lg:grid-cols-[minmax(0,1.7fr)_150px_150px_170px_170px]">
          <div>Request</div>
          <div>Type</div>
          <div>Created</div>
          <div>Status</div>
          <div className="lg:text-right">Actions</div>
        </div>
        {isLoading ? null : outgoingRequests.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-500">No outgoing requests.</div>
        ) : (
          outgoingRequests.map((request) => (
            <RequestRow
              key={request._id}
              request={request}
              direction="outgoing"
              viewerUserId={user?._id}
              isUpdating={requestActionMutation.isPending}
              isSelected={selectedEntry?.request._id === request._id}
              onAccept={(item) => requestActionMutation.mutate({ action: 'accept', request: item })}
              onDecline={(item) => requestActionMutation.mutate({ action: 'decline', request: item })}
              onWithdraw={(item) => requestActionMutation.mutate({ action: 'withdraw', request: item })}
              onOpen={(item) => {
                const target = getRequestPrimaryLink(item, user?._id);
                if (target) {
                  navigate(target);
                }
              }}
              onSelect={onSelectRequest ? (item) => onSelectRequest(item._id) : undefined}
            />
          ))
        )}
      </section>
    </div>
  );
}
