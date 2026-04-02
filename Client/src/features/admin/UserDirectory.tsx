import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, MoreHorizontal, Search, ShieldCheck, ShieldOff, UserCog } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { scoreApi } from '../../api/score.api';
import { type AdminUserListItem, adminApi } from '../../api/admin.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../app/components/ui/dropdown-menu';
import { UserRole } from '../../types/roles.types';
import { useAdminUsersContext } from './UserManagement';

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
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {busy ? 'Working...' : confirmLabel}
          </Button>
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
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="mt-6 space-y-3">
          {activityQuery.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner />
            </div>
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

function UserActionMenu({
  user,
  onViewActivity,
  onChangeRole,
  onToggleAccess,
}: {
  user: AdminUserListItem;
  onViewActivity: () => void;
  onChangeRole: () => void;
  onToggleAccess: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          className="h-10 w-10 rounded-full border-slate-700 p-0"
          aria-label={`Open actions for ${user.displayName}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 border-slate-800 bg-slate-950 text-white">
        <DropdownMenuLabel className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Actions
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-800" />
        <DropdownMenuItem className="cursor-pointer rounded-lg px-3 py-2 focus:bg-slate-900" onSelect={onViewActivity}>
          <Eye className="h-4 w-4 text-slate-400" />
          View Activity
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer rounded-lg px-3 py-2 focus:bg-slate-900" onSelect={onChangeRole}>
          <UserCog className="h-4 w-4 text-slate-400" />
          Change Role
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer rounded-lg px-3 py-2 focus:bg-slate-900" onSelect={onToggleAccess}>
          {user.isActive ? (
            <ShieldOff className="h-4 w-4 text-rose-300" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
          )}
          {user.isActive ? 'Deactivate User' : 'Activate User'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function UserDirectory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { users, isLoading } = useAdminUsersContext();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [roleDraft, setRoleDraft] = useState<UserRole>(UserRole.STUDENT);

  const roleParam = searchParams.get('role');
  const statusParam = searchParams.get('status');
  const roleFilter =
    roleParam && Object.values(UserRole).includes(roleParam as UserRole)
      ? (roleParam as UserRole)
      : 'all';
  const statusFilter =
    statusParam === 'active' || statusParam === 'inactive'
      ? statusParam
      : 'all';

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

  const filteredUsers = useMemo(
    () =>
      users
        .filter((user) => (roleFilter === 'all' ? true : user.role === roleFilter))
        .filter((user) => {
          if (statusFilter === 'all') return true;
          return statusFilter === 'active' ? user.isActive : !user.isActive;
        })
        .filter((user) =>
          `${user.displayName} ${user.email} ${user.role}`.toLowerCase().includes(search.toLowerCase()),
        ),
    [roleFilter, search, statusFilter, users],
  );

  const updateSearchParams = (patch: Partial<{ role: UserRole | 'all'; status: 'all' | 'active' | 'inactive' }>) => {
    const nextParams = new URLSearchParams(searchParams);

    if (patch.role) {
      if (patch.role === 'all') {
        nextParams.delete('role');
      } else {
        nextParams.set('role', patch.role);
      }
    }

    if (patch.status) {
      if (patch.status === 'all') {
        nextParams.delete('status');
      } else {
        nextParams.set('status', patch.status);
      }
    }

    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">User Directory</div>
          <h2 className="mt-2 text-2xl font-bold text-white">Search, filter, and control access</h2>
          <p className="mt-2 text-slate-400">Role changes and access actions stay isolated from the approval queue.</p>
        </div>
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            className="pl-11"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
          value={roleFilter}
          onChange={(event) => updateSearchParams({ role: event.target.value as UserRole | 'all' })}
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
          onChange={(event) =>
            updateSearchParams({ status: event.target.value as 'all' | 'active' | 'inactive' })
          }
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[minmax(180px,1.1fr)_minmax(240px,1.5fr)_88px_72px_132px_108px_96px_72px] gap-4 border-b border-slate-800 bg-slate-900/70 px-5 py-4 text-xs uppercase tracking-[0.3em] text-slate-400">
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
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-5 py-12 text-sm text-slate-400">No users found.</div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user._id}
                className="grid grid-cols-[minmax(180px,1.1fr)_minmax(240px,1.5fr)_88px_72px_132px_108px_96px_72px] items-center gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-white">{user.displayName}</div>
                </div>
                <div className="min-w-0 text-sm text-slate-300">
                  <div className="truncate">{user.email}</div>
                </div>
                <div className="text-sm text-slate-300 capitalize">{user.role}</div>
                <div className="text-sm text-slate-300">{user.innovationScore}</div>
                <div className="min-w-0 text-sm text-slate-300">
                  <div className="truncate">{user.accessGrantedBy}</div>
                </div>
                <div className="text-sm text-slate-400">{new Date(user.accessExpiresAt).toLocaleDateString('en-IN')}</div>
                <div>
                  <Badge
                    className={
                      user.isActive
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                    }
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex justify-end">
                  <UserActionMenu
                    user={user}
                    onViewActivity={() => setSelectedUser(user)}
                    onChangeRole={() => {
                      setSelectedUser(user);
                      setRoleDraft(user.role);
                      setModalMode('role');
                    }}
                    onToggleAccess={() => {
                      setSelectedUser(user);
                      setModalMode('access');
                    }}
                  />
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
