import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, UserPlus, Briefcase, Loader2 } from 'lucide-react';
import { workspaceApi } from '../../api/workspace.api';
import { requestApi } from '../../api/request.api';
import { Workspace } from '../../types/workspace.types';
import { Startup } from '../../types/startup.types';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
  workspaces: Workspace[];
  startups: Startup[];
  onInviteSent?: () => void;
}

export function InviteModal({
  isOpen,
  onClose,
  recipientId,
  recipientName,
  workspaces,
  startups,
  onInviteSent,
}: InviteModalProps) {
  const queryClient = useQueryClient();
  const [inviteType, setInviteType] = useState<'workspace' | 'startup' | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [selectedStartup, setSelectedStartup] = useState<Startup | null>(null);
  const [role, setRole] = useState('developer');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const workspaceInviteMutation = useMutation({
    mutationFn: (data: { workspaceId: string; userId: string; proposedRole?: string; message?: string }) =>
      workspaceApi.invite(data.workspaceId, { userId: data.userId, proposedRole: data.proposedRole as 'developer' | 'designer' | 'researcher' | 'marketer' | 'lead' | 'other', message: data.message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        resetState();
      }, 1500);
    },
    onError: (err: unknown) => {
      const errorMessage = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to send invite';
      setError(errorMessage);
    },
  });

  const startupInviteMutation = useMutation({
    mutationFn: async (data: { startupId: string; targetUserId: string; targetRole: string; message?: string }) => {
      return requestApi.create({
        requestType: 'startup_member',
        actionType: 'join',
        toUserId: data.targetUserId,
        targetEntityType: 'startup',
        targetEntityId: data.startupId,
        targetRole: data.targetRole,
        message: data.message,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        resetState();
      }, 1500);
    },
    onError: (err: unknown) => {
      const errorMessage = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to send invite';
      setError(errorMessage);
    },
  });

  const resetState = () => {
    setInviteType(null);
    setSelectedWorkspace(null);
    setSelectedStartup(null);
    setRole('developer');
    setMessage('');
    setError('');
    setSuccess(false);
  };

  const handleSendInvite = () => {
    if (inviteType === 'workspace' && selectedWorkspace) {
      workspaceInviteMutation.mutate({
        workspaceId: selectedWorkspace._id,
        userId: recipientId,
        proposedRole: role as 'developer' | 'designer' | 'researcher' | 'marketer' | 'lead' | 'other',
        message: message || undefined,
      });
    } else if (inviteType === 'startup' && selectedStartup) {
      startupInviteMutation.mutate({
        startupId: selectedStartup._id,
        targetUserId: recipientId,
        targetRole: role,
        message: message || undefined,
      });
    }
  };

  const isLoading = workspaceInviteMutation.isPending || startupInviteMutation.isPending;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Invite {recipientName}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center text-emerald-400">
            Invite sent successfully!
          </div>
        ) : error ? (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        ) : null}

        {!inviteType ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">Select what you want to invite them to:</p>
            {workspaces.length > 0 && (
              <button
                type="button"
                onClick={() => setInviteType('workspace')}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-left transition hover:border-cyan-500/50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium text-white">Workspace</div>
                  <div className="text-xs text-slate-400">Invite as a team member</div>
                </div>
              </button>
            )}
            {startups.length > 0 && (
              <button
                type="button"
                onClick={() => setInviteType('startup')}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-left transition hover:border-emerald-500/50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium text-white">Startup</div>
                  <div className="text-xs text-slate-400">Invite as a teammate</div>
                </div>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setInviteType(null)}
              className="text-sm text-cyan-400 transition hover:text-cyan-300"
            >
              ← Back
            </button>

            {inviteType === 'workspace' && (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Select Workspace</label>
                  <select
                    value={selectedWorkspace?._id ?? ''}
                    onChange={(e) => setSelectedWorkspace(workspaces.find((w) => w._id === e.target.value) ?? null)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
                  >
                    <option value="">Select a workspace...</option>
                    {workspaces.map((ws) => (
                      <option key={ws._id} value={ws._id}>
                        {ws.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
                  >
                    <option value="developer">Developer</option>
                    <option value="designer">Designer</option>
                    <option value="researcher">Researcher</option>
                    <option value="marketer">Marketer</option>
                    <option value="lead">Lead</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </>
            )}

            {inviteType === 'startup' && (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Select Startup</label>
                  <select
                    value={selectedStartup?._id ?? ''}
                    onChange={(e) => setSelectedStartup(startups.find((s) => s._id === e.target.value) ?? null)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                  >
                    <option value="">Select a startup...</option>
                    {startups.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Role</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Founding engineer, Product designer"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Message (optional)</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a personal message..."
                rows={2}
                className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-500"
              />
            </div>

            <button
              type="button"
              onClick={handleSendInvite}
              disabled={isLoading || (inviteType === 'workspace' && !selectedWorkspace) || (inviteType === 'startup' && !selectedStartup)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-2.5 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}