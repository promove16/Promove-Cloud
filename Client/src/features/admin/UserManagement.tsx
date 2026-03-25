import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Search } from 'lucide-react';
import { adminApi, AdminUserListItem } from '../../api/admin.api';
import { scoreApi } from '../../api/score.api';
import { UserRole } from '../../types/roles.types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';

type ModalMode = 'role' | 'access' | null;

function ConfirmModal({
  open,
  title,
  description,
  children,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  children?: ReactNode;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg p-6">
        <h3 className="text-2xl font-bold text-white">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={onConfirm} disabled={busy}>{busy ? 'Working...' : confirmLabel}</Button>
        </div>
      </Card>
    </div>
  );
}

function ActivityDrawer({
  user,
  open,
  onClose,
}: {
  user: AdminUserListItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const activityQuery = useQuery({
    queryKey: ['admin-user-activity', user?._id],
    queryFn: () => scoreApi.getScoreHistory(user!._id),
    enabled: open && Boolean(user),
  });

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-800 bg-slate-950 px-6 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">User Activity</div>
            <h3 className="mt-2 text-2xl font-bold text-white">{user.displayName}</h3>
          </div>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
        <div className="mt-6 space-y-3">
          {activityQuery.isLoading ? (
            <div className="flex items-center justify-center py-16"><Spinner /></div>
          ) : (activityQuery.data ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
              No score events available.
            </div>
          ) : (
            (activityQuery.data ?? []).map((event) => (
              <div key={event._id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-white">{event.trigger.replace(/_/g, ' ')}</div>
                  <Badge>+{event.delta}</Badge>
                </div>
                <div className="mt-2 text-sm text-slate-400">{new Date(event.createdAt).toLocaleString('en-IN')}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [roleDraft, setRoleDraft] = useState<UserRole>(UserRole.STUDENT);

  const usersQuery = useQuery({
    queryKey: ['admin-users', roleFilter, statusFilter],
    queryFn: () =>
      adminApi.getUsers({
        role: roleFilter === 'all' ? undefined : roleFilter,
        isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
        page: 1,
        limit: 100,
      }),
    refetchInterval: 60_000,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) => adminApi.updateUserRole(userId, role),
    onSuccess: async () => {
      setModalMode(null);
      setSelectedUser(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const updateAccessMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      adminApi.updateUserAccess(userId, isActive),
    onSuccess: async () => {
      setModalMode(null);
      setSelectedUser(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const users = useMemo(
    () =>
      (usersQuery.data?.items ?? []).filter((user) =>
        `${user.displayName} ${user.email} ${user.role}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [search, usersQuery.data?.items],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Users</div>
          <h1 className="mt-2 text-3xl font-bold text-white">User Management</h1>
          <p className="mt-2 text-slate-400">Search, review, and control access across every role.</p>
        </div>
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input className="pl-11" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value as UserRole | 'all')}
        >
          <option value="all">All Roles</option>
          {Object.values(UserRole).map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1.2fr,1.6fr,120px,140px,120px,120px,110px,200px] border-b border-slate-800 bg-slate-900/70 px-5 py-4 text-xs uppercase tracking-[0.3em] text-slate-400">
          <div>Name</div>
          <div>Email</div>
          <div>Role</div>
          <div>Score</div>
          <div>Access</div>
          <div>Expires</div>
          <div>Status</div>
          <div>Actions</div>
        </div>
        <div className="divide-y divide-slate-800">
          {usersQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : users.length === 0 ? (
            <div className="px-5 py-12 text-sm text-slate-400">No users found.</div>
          ) : (
            users.map((user) => (
              <div key={user._id} className="grid grid-cols-[1.2fr,1.6fr,120px,140px,120px,120px,110px,200px] items-center gap-4 px-5 py-5">
                <div className="font-semibold text-white">{user.displayName}</div>
                <div className="text-sm text-slate-300">{user.email}</div>
                <div className="text-sm text-slate-300 capitalize">{user.role}</div>
                <div className="text-sm text-slate-300">{user.innovationScore}</div>
                <div className="text-sm text-slate-300">{user.accessGrantedBy}</div>
                <div className="text-sm text-slate-400">{new Date(user.accessExpiresAt).toLocaleDateString('en-IN')}</div>
                <div>
                  <Badge className={user.isActive ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelectedUser(user);
                      setRoleDraft(user.role);
                      setModalMode('role');
                    }}
                  >
                    Change Role
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelectedUser(user);
                      setModalMode('access');
                    }}
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button variant="secondary" onClick={() => setSelectedUser(user)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Activity
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <ConfirmModal
        open={modalMode === 'role' && Boolean(selectedUser)}
        title="Change user role"
        description={`Update ${selectedUser?.displayName ?? 'this user'} to a new role.`}
        confirmLabel="Update Role"
        busy={updateRoleMutation.isPending}
        onClose={() => {
          setModalMode(null);
          setSelectedUser(null);
        }}
        onConfirm={() => {
          if (selectedUser) {
            updateRoleMutation.mutate({ userId: selectedUser._id, role: roleDraft });
          }
        }}
      >
        <select
          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
          value={roleDraft}
          onChange={(event) => setRoleDraft(event.target.value as UserRole)}
        >
          {Object.values(UserRole).map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </ConfirmModal>

      <ConfirmModal
        open={modalMode === 'access' && Boolean(selectedUser)}
        title={selectedUser?.isActive ? 'Deactivate user access' : 'Activate user access'}
        description={`This will update access for ${selectedUser?.displayName ?? 'the selected user'} and clear their session tokens.`}
        confirmLabel={selectedUser?.isActive ? 'Deactivate' : 'Activate'}
        busy={updateAccessMutation.isPending}
        onClose={() => {
          setModalMode(null);
          setSelectedUser(null);
        }}
        onConfirm={() => {
          if (selectedUser) {
            updateAccessMutation.mutate({ userId: selectedUser._id, isActive: !selectedUser.isActive });
          }
        }}
      />

      <ActivityDrawer
        user={selectedUser}
        open={Boolean(selectedUser) && modalMode === null}
        onClose={() => setSelectedUser(null)}
      />
    </div>
  );
}
