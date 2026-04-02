import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { UserRole } from '../../types/roles.types';
import { useAdminUsersContext } from './UserManagement';

export default function UserRequests() {
  const queryClient = useQueryClient();
  const { users, isLoading } = useAdminUsersContext();

  const reviewRequestMutation = useMutation({
    mutationFn: ({
      userId,
      decision,
      reason,
    }: {
      userId: string;
      decision: 'approved' | 'rejected';
      reason?: string;
    }) => adminApi.reviewRegistrationRequest(userId, { decision, reason }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-analytics'] }),
      ]);
    },
  });

  const pendingRequests = useMemo(
    () =>
      users.filter(
        (user) =>
          user.adminApprovalStatus === 'pending' &&
          ![UserRole.STUDENT].includes(user.role),
      ),
    [users],
  );

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Registration Requests</div>
          <h2 className="mt-2 text-2xl font-bold text-white">Approve public sign-up requests</h2>
          <p className="mt-2 text-slate-400">
            Students complete public signup with an institution token. All other roles wait here for admin approval.
          </p>
        </div>
        <Badge>{pendingRequests.length} pending</Badge>
      </div>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 px-5 py-10 text-sm text-slate-400">
            No registration requests are waiting right now.
          </div>
        ) : (
          pendingRequests.map((request) => (
            <div key={request._id} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-lg font-semibold text-white">{request.displayName}</div>
                    <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">pending</Badge>
                    <Badge className="border-slate-700 bg-slate-800 text-slate-200 capitalize">{request.role}</Badge>
                  </div>
                  <div className="text-sm text-slate-300">{request.email}</div>
                  {request.adminApprovalRequestedAt ? (
                    <div className="text-xs uppercase tracking-[0.25em] text-slate-500">
                      Requested {new Date(request.adminApprovalRequestedAt).toLocaleString('en-IN')}
                    </div>
                  ) : null}
                  <div className="text-sm text-slate-400">
                    Access will stay disabled until this request is approved.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() =>
                      reviewRequestMutation.mutate({
                        userId: request._id,
                        decision: 'approved',
                      })
                    }
                    disabled={reviewRequestMutation.isPending}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const reason = window.prompt('Add a short rejection reason (optional):')?.trim();
                      reviewRequestMutation.mutate({
                        userId: request._id,
                        decision: 'rejected',
                        ...(reason ? { reason } : {}),
                      });
                    }}
                    disabled={reviewRequestMutation.isPending}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
