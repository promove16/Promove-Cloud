import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ShieldX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { recruiterApi } from '../../api/recruiter.api';
import { requestApi } from '../../api/request.api';
import { workspaceApi } from '../../api/workspace.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types/roles.types';
import { WorkflowRequest } from '../../types/request.types';
import { Workspace } from '../../types/workspace.types';

const WORKSPACE_INVITE_SENDER_ROLES = [UserRole.STUDENT, UserRole.RECRUITER] as const;

const REQUEST_LABELS: Record<WorkflowRequest['type'], string> = {
  generic: 'Workflow request',
  workspace_member: 'Workspace member',
  workspace_chat_access: 'Workspace chat access',
  startup_member: 'Startup member',
  startup_cofounder: 'Startup cofounder',
  mentor_assignment: 'Mentor assignment',
  investor_startup_access: 'Investor startup access',
  recruiter_job_invite: 'Recruiter job invite',
  campus_drive_registration: 'Campus drive registration',
  college_event_invite: 'College event invite',
  college_recruiter_partnership: 'College recruiter partnership',
  patent_coinventor: 'Patent co-inventor',
  problem_review: 'Problem review',
  startup_review: 'Startup review',
  patent_request_review: 'Patent request review',
};

const ROLE_OPTIONS = ['developer', 'designer', 'researcher', 'marketer', 'lead', 'other'] as const;

const rowClassName =
  'grid gap-3 border-b border-slate-800/80 px-3 py-3 lg:grid-cols-[minmax(0,1.2fr)_170px_150px_170px] lg:items-center';

function getMetadataString(request: WorkflowRequest, keys: string[]) {
  for (const key of keys) {
    const value = request.metadata?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return undefined;
}

function getEntityName(request: WorkflowRequest) {
  return (
    request.targetEntityTitle ??
    getMetadataString(request, ['entityName', 'targetName', 'workspaceTitle', 'jobTitle', 'company']) ??
    `${request.targetEntityType} ${request.targetEntityId}`
  );
}

function formatStamp(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
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
  const entityName = getEntityName(request);
  const actorLabel =
    direction === 'incoming'
      ? request.fromUser?.displayName ?? request.fromUser?.email ?? 'Sender'
      : request.toUser?.displayName ?? request.recipientEmail ?? 'Pending account';

  return (
    <div className={rowClassName}>
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">
          {REQUEST_LABELS[request.type]} for {entityName}
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
        {request.status}
        <div className="mt-1 normal-case tracking-normal text-slate-600">Expires {formatStamp(request.expiresAt)}</div>
      </div>

      <div className="text-xs text-slate-500">
        Created {formatStamp(request.createdAt)}
        {request.respondedAt ? <div>Responded {formatStamp(request.respondedAt)}</div> : null}
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-end">
        {direction === 'incoming' && request.status === 'pending' ? (
          <>
            <Button className="h-9 rounded-none px-3" onClick={() => onAccept(request)} disabled={isUpdating}>
              Accept
            </Button>
            <Button variant="secondary" className="h-9 rounded-none px-3" onClick={() => onDecline(request)} disabled={isUpdating}>
              Decline
            </Button>
          </>
        ) : null}
        {direction === 'outgoing' && request.status === 'pending' ? (
          <Button variant="secondary" className="h-9 rounded-none px-3" onClick={() => onWithdraw(request)} disabled={isUpdating}>
            Withdraw
          </Button>
        ) : null}
        {request.deepLink ? (
          <Button variant="ghost" className="h-9 rounded-none px-3" onClick={() => onOpen(request)}>
            <ArrowRight className="mr-2 h-3.5 w-3.5" />
            Open
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function InvitationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const currentRole = user?.role;

  const [workspaceInviteEmail, setWorkspaceInviteEmail] = useState('');
  const [workspaceInviteMessage, setWorkspaceInviteMessage] = useState('');
  const [workspaceInviteRole, setWorkspaceInviteRole] = useState<(typeof ROLE_OPTIONS)[number]>('developer');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [feedback, setFeedback] = useState('');

  const allowedPageRoles = useMemo(
    () => [UserRole.STUDENT, UserRole.RECRUITER, UserRole.INVESTOR, UserRole.MENTOR],
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
  const workspaceListQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceApi.list,
    enabled: Boolean(
      user &&
        currentRole &&
        WORKSPACE_INVITE_SENDER_ROLES.includes(currentRole as (typeof WORKSPACE_INVITE_SENDER_ROLES)[number]),
    ),
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

  const ownedWorkspaces = useMemo(() => {
    if (!user) {
      return [] as Workspace[];
    }

    return (workspaceListQuery.data ?? []).filter((workspace) => workspace.ownerId === user._id);
  }, [user, workspaceListQuery.data]);

  useEffect(() => {
    if (!ownedWorkspaces.length) {
      setSelectedWorkspaceId('');
      return;
    }

    setSelectedWorkspaceId((current) =>
      ownedWorkspaces.some((workspace) => workspace._id === current) ? current : ownedWorkspaces[0]._id,
    );
  }, [ownedWorkspaces]);

  const refreshRequests = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['requests'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
      queryClient.invalidateQueries({ queryKey: ['student', 'applications'] }),
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'job-applications'] }),
    ]);
  };

  const sendWorkspaceInviteMutation = useMutation({
    mutationFn: (payload: { workspaceId: string; email: string; message?: string; proposedRole: string }) =>
      workspaceApi.invite(payload.workspaceId, {
        email: payload.email,
        message: payload.message,
        proposedRole: payload.proposedRole as (typeof ROLE_OPTIONS)[number],
      }),
    onSuccess: async () => {
      setWorkspaceInviteEmail('');
      setWorkspaceInviteMessage('');
      setFeedback('Workspace invite sent.');
      await refreshRequests();
    },
    onError: (error) => setFeedback(getErrorMessage(error, 'Unable to send workspace invite.')),
  });

  const requestActionMutation = useMutation({
    mutationFn: (params: { action: 'accept' | 'decline' | 'withdraw'; request: WorkflowRequest }) => {
      if (params.action === 'accept') return requestApi.accept(params.request._id);
      if (params.action === 'decline') return requestApi.decline(params.request._id);
      return requestApi.withdraw(params.request._id);
    },
    onSuccess: async (request, variables) => {
      await refreshRequests();
      if (variables.action === 'accept' && (request.acceptRedirect || request.deepLink)) {
        navigate(request.acceptRedirect ?? request.deepLink!);
        return;
      }
      setFeedback(`Request ${request.status}.`);
    },
    onError: (error) => setFeedback(getErrorMessage(error, 'Unable to update request.')),
  });

  const handleCreateWorkspaceInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedWorkspaceId) {
      setFeedback('Select a workspace first.');
      return;
    }

    const email = workspaceInviteEmail.trim().toLowerCase();
    if (!email) {
      setFeedback('Student email is required.');
      return;
    }

    sendWorkspaceInviteMutation.mutate({
      workspaceId: selectedWorkspaceId,
      email,
      proposedRole: workspaceInviteRole,
      message: workspaceInviteMessage.trim() || undefined,
    });
  };

  const incomingRequests = incomingQuery.data ?? [];
  const outgoingRequests = outgoingQuery.data ?? [];
  const isLoading = incomingQuery.isLoading || outgoingQuery.isLoading;
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

      {WORKSPACE_INVITE_SENDER_ROLES.includes(currentRole as (typeof WORKSPACE_INVITE_SENDER_ROLES)[number]) ? (
        <section className="border border-slate-800">
          <div className="border-b border-slate-800 px-3 py-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">
            Create Workspace Invite
          </div>
          <form onSubmit={handleCreateWorkspaceInvite} className="grid gap-3 px-3 py-3 lg:grid-cols-[190px_160px_minmax(0,1fr)_180px] lg:items-center">
            <select
              value={selectedWorkspaceId}
              onChange={(event) => setSelectedWorkspaceId(event.target.value)}
              className="h-10 rounded-none border border-slate-800 bg-transparent px-3 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">Select workspace</option>
              {ownedWorkspaces.map((workspace) => (
                <option key={workspace._id} value={workspace._id} className="bg-slate-950">
                  {workspace.title}
                </option>
              ))}
            </select>
            <select
              value={workspaceInviteRole}
              onChange={(event) => setWorkspaceInviteRole(event.target.value as (typeof ROLE_OPTIONS)[number])}
              className="h-10 rounded-none border border-slate-800 bg-transparent px-3 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role} className="bg-slate-950">
                  {role}
                </option>
              ))}
            </select>
            <Input
              type="email"
              value={workspaceInviteEmail}
              onChange={(event) => setWorkspaceInviteEmail(event.target.value)}
              placeholder="student@email.com"
              className="h-10 rounded-none border-slate-800 bg-transparent px-3 py-2"
            />
            <Button
              type="submit"
              className="h-10 rounded-none"
              disabled={!selectedWorkspaceId || !workspaceInviteEmail.trim() || sendWorkspaceInviteMutation.isPending}
            >
              Send invite
            </Button>
            <Input
              value={workspaceInviteMessage}
              onChange={(event) => setWorkspaceInviteMessage(event.target.value)}
              placeholder="Optional message"
              className="h-10 rounded-none border-slate-800 bg-transparent px-3 py-2 lg:col-span-4"
            />
          </form>
        </section>
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
              onAccept={(item) => requestActionMutation.mutate({ action: 'accept', request: item })}
              onDecline={(item) => requestActionMutation.mutate({ action: 'decline', request: item })}
              onWithdraw={(item) => requestActionMutation.mutate({ action: 'withdraw', request: item })}
              onOpen={(item) => item.deepLink && navigate(item.deepLink)}
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
              onAccept={(item) => requestActionMutation.mutate({ action: 'accept', request: item })}
              onDecline={(item) => requestActionMutation.mutate({ action: 'decline', request: item })}
              onWithdraw={(item) => requestActionMutation.mutate({ action: 'withdraw', request: item })}
              onOpen={(item) => item.deepLink && navigate(item.deepLink)}
            />
          ))
        )}
      </section>
    </div>
  );
}
