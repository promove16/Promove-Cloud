import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Clock3, ExternalLink, FileText, Link2, ShieldX } from 'lucide-react';
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
  getRequestLinkTargets,
  getRequestMetadataEntries,
  getRequestPrimaryLink,
} from './requestPresentation';

const rowClassName =
  'grid gap-3 border-b border-slate-800/80 px-3 py-3 lg:grid-cols-[minmax(0,1.2fr)_170px_150px_170px] lg:items-center';

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
    fallback
  );
}

function getConversationRequestPartnerId(request: WorkflowRequest, viewerUserId?: string) {
  if (request.type !== 'generic' || request.actionType !== 'connect' || request.targetEntityType !== 'conversation') {
    return null;
  }

  if (viewerUserId) {
    if (request.fromUserId === viewerUserId) {
      return request.toUserId ?? request.targetEntityId ?? null;
    }

    if (request.toUserId === viewerUserId || request.targetEntityId === viewerUserId) {
      return request.fromUserId;
    }
  }

  return request.toUserId ?? request.fromUserId ?? null;
}

function getRequestNavigationTarget(request: WorkflowRequest, viewerUserId?: string) {
  const conversationPartnerId = getConversationRequestPartnerId(request, viewerUserId);
  if (conversationPartnerId) {
    return `/dashboard/messages/${conversationPartnerId}`;
  }

  return request.acceptRedirect ?? request.deepLink ?? request.declineRedirect ?? null;
}

function RequestRow({
  request,
  direction,
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
  const primaryLink = getRequestPrimaryLink(request);
  const isActionable = direction === 'incoming' ? request.status === 'pending' : request.status === 'pending';

  return (
    <div
      className={`${rowClassName} transition ${
        isSelected ? 'bg-slate-900/70' : 'hover:bg-slate-900/50'
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
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">
          {getRequestTypeLabel(request)} for {entityName}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {direction === 'incoming' ? 'From' : 'To'} {actorLabel}
          {request.requestedRole ?? request.targetRole ? ` | ${request.requestedRole ?? request.targetRole}` : ''}
          {request.requestedPermission ? ` | ${request.requestedPermission}` : ''}
        </div>
        {request.message ? (
          <div className="mt-2 rounded border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
            {request.message}
          </div>
        ) : null}
      </div>

      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
        {formatRequestStatus(request.status)}
        <div className="mt-1 normal-case tracking-normal text-slate-600">Expires {formatRequestStamp(request.expiresAt)}</div>
      </div>

      <div className="text-xs text-slate-500">
        Created {formatRequestStamp(request.createdAt)}
        {request.respondedAt ? <div>Responded {formatRequestStamp(request.respondedAt)}</div> : null}
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-end" onClick={(event) => event.stopPropagation()}>
        {direction === 'incoming' && isActionable ? (
          <>
            <Button className="h-9 rounded-none px-3" onClick={() => onAccept(request)} disabled={isUpdating}>
              Accept
            </Button>
            <Button variant="secondary" className="h-9 rounded-none px-3" onClick={() => onDecline(request)} disabled={isUpdating}>
              Decline
            </Button>
          </>
        ) : null}
        {direction === 'outgoing' && isActionable ? (
          <Button variant="secondary" className="h-9 rounded-none px-3" onClick={() => onWithdraw(request)} disabled={isUpdating}>
            Withdraw
          </Button>
        ) : null}
        {primaryLink ? (
          <Button variant="ghost" className="h-9 rounded-none px-3" onClick={() => onOpen(request)}>
            <ArrowRight className="mr-2 h-3.5 w-3.5" />
            Open
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function RequestDetailCard({
  request,
  direction,
  isUpdating,
  onAccept,
  onDecline,
  onWithdraw,
  onOpen,
}: {
  request: WorkflowRequest;
  direction: 'incoming' | 'outgoing';
  isUpdating: boolean;
  onAccept: (request: WorkflowRequest) => void;
  onDecline: (request: WorkflowRequest) => void;
  onWithdraw: (request: WorkflowRequest) => void;
  onOpen: (request: WorkflowRequest) => void;
}) {
  const navigate = useNavigate();
  const entityName = getRequestEntityName(request);
  const actorLabel = getRequestActorLabel(request, direction);
  const metadataEntries = getRequestMetadataEntries(request);
  const linkedTargets = getRequestLinkTargets(request);
  const statusClassName = REQUEST_STATUS_COLOR_CLASSES[request.status];

  return (
    <section className="border border-slate-800">
      <div className="border-b border-slate-800 px-3 py-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">
        Request detail
      </div>
      <div className="space-y-5 px-3 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-white">
              {getRequestTypeLabel(request)} for {entityName}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-400">
              <span>{direction === 'incoming' ? 'From' : 'To'} {actorLabel}</span>
              <span className="text-slate-600">|</span>
              <span>{request.targetEntityType.replace(/_/g, ' ')}</span>
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
          <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] ${statusClassName}`}>
            {formatRequestStatus(request.status)}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Created</div>
            <div className="mt-2 text-sm text-white">{formatRequestStamp(request.createdAt)}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Expires</div>
            <div className="mt-2 text-sm text-white">{formatRequestStamp(request.expiresAt)}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Last response</div>
            <div className="mt-2 text-sm text-white">{formatRequestStamp(request.respondedAt ?? request.updatedAt)}</div>
          </div>
        </div>

        {request.message ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
              <FileText className="h-3.5 w-3.5" />
              Message
            </div>
            <div className="mt-3 text-sm leading-6 text-slate-200">{request.message}</div>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
              <Link2 className="h-3.5 w-3.5" />
              Linked content
            </div>
            {linkedTargets.length > 0 ? (
              <div className="mt-3 space-y-2">
                {linkedTargets.map((target) => (
                  <button
                    key={`${target.label}-${target.path}`}
                    type="button"
                    onClick={() => navigate(target.path)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-800 px-3 py-3 text-left transition hover:border-cyan-500/40 hover:bg-slate-900/80"
                  >
                    <div>
                      <div className="text-sm font-medium text-white">{target.label}</div>
                      <div className="mt-1 break-all text-xs text-slate-500">{target.path}</div>
                    </div>
                    <ExternalLink className="h-4 w-4 flex-shrink-0 text-slate-500" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-slate-500">No linked destination was attached to this request.</div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
              <Clock3 className="h-3.5 w-3.5" />
              Request context
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div>
                <div className="text-xs text-slate-500">Entity</div>
                <div className="mt-1 text-sm text-white">{entityName}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Direction</div>
                <div className="mt-1 text-sm capitalize text-white">{direction}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Entity type</div>
                <div className="mt-1 text-sm text-white">{request.targetEntityType.replace(/_/g, ' ')}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Request ID</div>
                <div className="mt-1 break-all text-sm text-white">{request._id}</div>
              </div>
            </div>
          </div>
        </div>

        {metadataEntries.length > 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Linked details</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {metadataEntries.map((entry) => (
                <div key={`${entry.label}-${entry.value}`} className="min-w-0 rounded-lg border border-slate-800 px-3 py-2">
                  <div className="text-xs text-slate-500">{entry.label}</div>
                  <div className="mt-1 break-words text-sm text-white">{entry.value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {direction === 'incoming' && request.status === 'pending' ? (
            <>
              <Button className="h-10 rounded-none px-4" onClick={() => onAccept(request)} disabled={isUpdating}>
                Accept
              </Button>
              <Button variant="secondary" className="h-10 rounded-none px-4" onClick={() => onDecline(request)} disabled={isUpdating}>
                Decline
              </Button>
            </>
          ) : null}
          {direction === 'outgoing' && request.status === 'pending' ? (
            <Button variant="secondary" className="h-10 rounded-none px-4" onClick={() => onWithdraw(request)} disabled={isUpdating}>
              Withdraw
            </Button>
          ) : null}
          {getRequestPrimaryLink(request) ? (
            <Button variant="ghost" className="h-10 rounded-none px-4" onClick={() => onOpen(request)}>
              <ArrowRight className="mr-2 h-4 w-4" />
              Open linked content
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
          ? getRequestNavigationTarget(request, user?._id) ?? getRequestNavigationTarget(variables.request, user?._id)
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
      <section className="border-b border-slate-800 pb-3">
        <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Requests</div>
        <h1 className="mt-1 text-xl font-semibold text-white">Request inbox</h1>
        <p className="mt-1 text-sm text-slate-400">
          Review access requests, invite status, expiry, and the next destination after acceptance.
        </p>
      </section>

      {feedback ? <div className="border border-cyan-500/30 px-3 py-2 text-sm text-cyan-200">{feedback}</div> : null}

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
        <section className="border border-slate-800 lg:hidden">
          <div className="border-b border-slate-800 px-3 py-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">
            Choose request
          </div>
          <div className="px-3 py-3">
            <select
              value={selectedEntry?.request._id ?? ''}
              onChange={(event) => onSelectRequest?.(event.target.value)}
              className="h-10 w-full rounded-none border border-slate-800 bg-transparent px-3 text-sm text-white focus:border-blue-500 focus:outline-none"
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
          isUpdating={requestActionMutation.isPending}
          onAccept={(item) => requestActionMutation.mutate({ action: 'accept', request: item })}
          onDecline={(item) => requestActionMutation.mutate({ action: 'decline', request: item })}
          onWithdraw={(item) => requestActionMutation.mutate({ action: 'withdraw', request: item })}
          onOpen={(item) => {
            const target = getRequestPrimaryLink(item);
            if (target) {
              navigate(target);
            }
          }}
        />
      ) : null}

      <section className="border border-slate-800">
        <div className="border-b border-slate-800 px-3 py-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">
          Incoming
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Spinner />
          </div>
        ) : incomingRequests.length === 0 ? (
          <div className="px-3 py-4 text-sm text-slate-500">No incoming requests.</div>
        ) : (
          incomingRequests.map((request) => (
            <RequestRow
              key={request._id}
              request={request}
              direction="incoming"
              isUpdating={requestActionMutation.isPending}
              isSelected={selectedEntry?.request._id === request._id}
              onAccept={(item) => requestActionMutation.mutate({ action: 'accept', request: item })}
              onDecline={(item) => requestActionMutation.mutate({ action: 'decline', request: item })}
              onWithdraw={(item) => requestActionMutation.mutate({ action: 'withdraw', request: item })}
              onOpen={(item) => {
                const target = getRequestPrimaryLink(item);
                if (target) {
                  navigate(target);
                }
              }}
              onSelect={onSelectRequest ? (item) => onSelectRequest(item._id) : undefined}
            />
          ))
        )}
      </section>

      <section className="border border-slate-800">
        <div className="border-b border-slate-800 px-3 py-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">
          Outgoing
        </div>
        {isLoading ? null : outgoingRequests.length === 0 ? (
          <div className="px-3 py-4 text-sm text-slate-500">No outgoing requests.</div>
        ) : (
          outgoingRequests.map((request) => (
            <RequestRow
              key={request._id}
              request={request}
              direction="outgoing"
              isUpdating={requestActionMutation.isPending}
              isSelected={selectedEntry?.request._id === request._id}
              onAccept={(item) => requestActionMutation.mutate({ action: 'accept', request: item })}
              onDecline={(item) => requestActionMutation.mutate({ action: 'decline', request: item })}
              onWithdraw={(item) => requestActionMutation.mutate({ action: 'withdraw', request: item })}
              onOpen={(item) => {
                const target = getRequestPrimaryLink(item);
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
