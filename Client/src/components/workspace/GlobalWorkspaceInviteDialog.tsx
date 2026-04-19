import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Send, UserPlus } from 'lucide-react';
import { workspaceApi } from '../../api/workspace.api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../app/components/ui/dialog';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types/roles.types';
import { Workspace } from '../../types/workspace.types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

const ROLE_OPTIONS = ['developer', 'designer', 'researcher', 'marketer', 'lead', 'other'] as const;

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
    fallback
  );
}

export function GlobalWorkspaceInviteDialog() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [open, setOpen] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<(typeof ROLE_OPTIONS)[number]>('developer');
  const [inviteMessage, setInviteMessage] = useState('');
  const [feedback, setFeedback] = useState('');

  const canInvite = user?.role === UserRole.STUDENT;

  const workspaceListQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceApi.list,
    enabled: canInvite,
    staleTime: 30_000,
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

  useEffect(() => {
    if (!open) {
      setFeedback('');
    }
  }, [open]);

  const sendWorkspaceInviteMutation = useMutation({
    mutationFn: (payload: {
      workspaceId: string;
      email: string;
      message?: string;
      proposedRole: (typeof ROLE_OPTIONS)[number];
    }) =>
      workspaceApi.invite(payload.workspaceId, {
        email: payload.email,
        message: payload.message,
        proposedRole: payload.proposedRole,
      }),
    onSuccess: async () => {
      setInviteEmail('');
      setInviteMessage('');
      setInviteRole('developer');
      setFeedback('Workspace invite sent.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['requests'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace'] }),
      ]);
    },
    onError: (error) => {
      setFeedback(getErrorMessage(error, 'Unable to send workspace invite.'));
    },
  });

  const handleSubmit = () => {
    const email = inviteEmail.trim().toLowerCase();

    if (!selectedWorkspaceId) {
      setFeedback('Select a workspace first.');
      return;
    }

    if (!email) {
      setFeedback('Student email is required.');
      return;
    }

    setFeedback('');
    sendWorkspaceInviteMutation.mutate({
      workspaceId: selectedWorkspaceId,
      email,
      proposedRole: inviteRole,
      message: inviteMessage.trim() || undefined,
    });
  };

  if (!canInvite || ownedWorkspaces.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        variant="secondary"
        className="h-11 gap-2 rounded-2xl border-slate-700 bg-slate-950 px-4 text-white hover:border-slate-600 hover:bg-slate-900"
        onClick={() => setOpen(true)}
      >
        <UserPlus className="h-4 w-4" />
        <span className="hidden sm:inline">Invite teammate</span>
        <span className="sm:hidden">Invite</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl border-slate-800 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Send workspace invite</DialogTitle>
            <DialogDescription>
              Invite a student teammate from anywhere in the dashboard without leaving your current screen.
            </DialogDescription>
          </DialogHeader>

          {feedback ? (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
              {feedback}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_180px_minmax(0,1fr)]">
            <div className="min-w-0 md:col-span-2 lg:col-span-1">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Workspace
              </label>
              <select
                value={selectedWorkspaceId}
                onChange={(event) => setSelectedWorkspaceId(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-blue-500"
              >
                {ownedWorkspaces.map((workspace) => (
                  <option key={workspace._id} value={workspace._id} className="bg-slate-950">
                    {workspace.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as (typeof ROLE_OPTIONS)[number])}
                className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-blue-500"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role} className="bg-slate-950">
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Student email
              </label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="student@email.com"
                className="h-11 border-slate-800 bg-slate-950 px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Message
            </label>
            <textarea
              value={inviteMessage}
              onChange={(event) => setInviteMessage(event.target.value)}
              placeholder="Optional message or collaboration context"
              rows={3}
              className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedWorkspaceId || !inviteEmail.trim() || sendWorkspaceInviteMutation.isPending}
            >
              {sendWorkspaceInviteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
