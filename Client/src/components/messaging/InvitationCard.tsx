import { UserPlus, Briefcase, Check, X, Clock, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { workspaceApi } from '../../api/workspace.api';
import { requestApi } from '../../api/request.api';

interface InvitationCardProps {
  messageId: string;
  invitationType: 'workspace_invite' | 'startup_invite';
  entityTitle: string;
  entityType: 'workspace' | 'startup';
  role?: string;
  requestId?: string;
  status?: 'pending' | 'accepted' | 'declined';
  senderName: string;
  isMine: boolean;
  onStatusChange?: () => void;
}

export function InvitationCard({
  invitationType,
  entityTitle,
  entityType,
  role,
  requestId,
  status,
  senderName,
  isMine,
  onStatusChange,
}: InvitationCardProps) {
  const isPending = status === 'pending';
  const isAccepted = status === 'accepted';
  const isDeclined = status === 'declined';

  const acceptWorkspaceMutation = useMutation({
    mutationFn: (data: { workspaceId: string; requestId: string }) =>
      workspaceApi.acceptInvite(data.workspaceId, data.requestId),
    onSuccess: () => onStatusChange?.(),
  });

  const declineWorkspaceMutation = useMutation({
    mutationFn: (data: { workspaceId: string; requestId: string }) =>
      workspaceApi.declineInvite(data.workspaceId, data.requestId),
    onSuccess: () => onStatusChange?.(),
  });

  const acceptRequestMutation = useMutation({
    mutationFn: (reqId: string) => requestApi.accept(reqId),
    onSuccess: () => onStatusChange?.(),
  });

  const declineRequestMutation = useMutation({
    mutationFn: (reqId: string) => requestApi.decline(reqId),
    onSuccess: () => onStatusChange?.(),
  });

  const handleAccept = () => {
    if (!requestId) return;
    
    if (entityType === 'workspace') {
      acceptWorkspaceMutation.mutate({ workspaceId: entityTitle, requestId });
    } else {
      acceptRequestMutation.mutate(requestId);
    }
  };

  const handleDecline = () => {
    if (!requestId) return;
    
    if (entityType === 'workspace') {
      declineWorkspaceMutation.mutate({ workspaceId: entityTitle, requestId });
    } else {
      declineRequestMutation.mutate(requestId);
    }
  };

  const isLoading = acceptWorkspaceMutation.isPending || declineWorkspaceMutation.isPending 
    || acceptRequestMutation.isPending || declineRequestMutation.isPending;

  const accentColor = entityType === 'workspace' ? 'cyan' : 'emerald';
  const Icon = entityType === 'workspace' ? UserPlus : Briefcase;

  return (
    <div className={`w-full overflow-hidden rounded-[1.1rem] border border-${accentColor}-500/20 bg-gradient-to-br from-${accentColor}-500/10 via-slate-800 to-slate-900`}>
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-${accentColor}-500/20 text-${accentColor}-400`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              {invitationType === 'workspace_invite' ? 'Workspace Invite' : 'Startup Invite'}
            </div>
            <div className="font-semibold text-white">{entityTitle}</div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        {role && (
          <div className="mb-2">
            <span className="text-xs text-slate-400">Role: </span>
            <span className="text-sm font-medium text-white">{role}</span>
          </div>
        )}
        
        <p className="text-sm text-slate-300">
          {isMine ? (
            <>You invited {senderName} to join this {entityType}</>
          ) : (
            <>You have been invited to join this {entityType}</>
          )}
        </p>

        {isPending && !isMine && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleAccept}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Accept
            </button>
            <button
              type="button"
              onClick={handleDecline}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Decline
            </button>
          </div>
        )}

        {isAccepted && (
          <div className="mt-2 flex items-center gap-1.5 text-sm text-emerald-400">
            <Check className="h-4 w-4" />
            Invitation accepted
          </div>
        )}

        {isDeclined && (
          <div className="mt-2 flex items-center gap-1.5 text-sm text-red-400">
            <X className="h-4 w-4" />
            Invitation declined
          </div>
        )}

        {isPending && isMine && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="h-3 w-3" />
            Waiting for response...
          </div>
        )}
      </div>
    </div>
  );
}