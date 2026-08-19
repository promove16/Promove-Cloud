import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  MoreHorizontal,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react';
import { adminApi, type AdminUserListItem } from '../../api/admin.api';
import { Spinner } from '../../components/ui/Spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { UserRole } from '../../types/roles.types';

const AVATAR_COLORS: Record<UserRole, string> = {
  [UserRole.STUDENT]:  'bg-cyan-600',
  [UserRole.MENTOR]:   'bg-violet-600',
  [UserRole.INVESTOR]: 'bg-emerald-600',
  [UserRole.RECRUITER]: 'bg-amber-600',
  [UserRole.SCHOOL]:   'bg-teal-600',
  [UserRole.COLLEGE]:  'bg-indigo-600',
  [UserRole.ADMIN]:    'bg-rose-600',
};

const modalOverlayCls =
  'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm';
const modalCardCls = 'w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl';

function ConfirmModal({
  open,
  title,
  description,
  children,
  confirmLabel,
  confirmDanger = false,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  children?: ReactNode;
  confirmLabel: string;
  confirmDanger?: boolean;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className={modalOverlayCls} role="dialog" aria-modal="true">
      <div className={modalCardCls}>
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
              confirmDanger
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-cyan-600 hover:bg-cyan-700'
            }`}
          >
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserDirectoryPanel({ role }: { role: UserRole }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);
  const [modalMode, setModalMode] = useState<'role' | 'access' | 'delete' | null>(null);
  const [roleDraft, setRoleDraft] = useState<UserRole>(UserRole.STUDENT);

  const usersQuery = useQuery({
    queryKey: ['admin-users', role],
    queryFn: () => adminApi.getUsers({ role, page: 1, limit: 2000 }),
  });

  const users = usersQuery.data?.items ?? [];

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-analytics'] }),
    ]);

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, nextRole }: { userId: string; nextRole: UserRole }) =>
      adminApi.updateUserRole(userId, nextRole),
    onSuccess: async () => {
      toast.success('User role updated');
      setModalMode(null);
      setSelectedUser(null);
      await invalidate();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Could not update role');
    },
  });

  const updateAccessMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      adminApi.updateUserAccess(userId, isActive),
    onSuccess: async () => {
      toast.success('User access updated');
      setModalMode(null);
      setSelectedUser(null);
      await invalidate();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Could not update access');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId),
    onSuccess: async () => {
      toast.success('User deleted');
      setModalMode(null);
      setSelectedUser(null);
      await invalidate();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Could not delete user');
    },
  });

  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        `${user.displayName} ${user.email}`.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [search, users],
  );

  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="border-b border-slate-800 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Users className="h-4 w-4 text-cyan-300" />
            Existing {roleLabel} accounts
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-300">
              {search.trim() ? filteredUsers.length : users.length}
            </span>
          </div>
          <div className="relative w-full max-w-[15rem]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="max-h-[26rem] divide-y divide-slate-800/80 overflow-y-auto [scrollbar-color:rgba(100,116,139,0.3)_transparent] [scrollbar-width:thin]">
        {usersQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            {search
              ? `No ${roleLabel.toLowerCase()} accounts match "${search}".`
              : `No ${roleLabel.toLowerCase()} accounts yet. Create one with the form.`}
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div key={user._id} className="flex items-center gap-3 px-5 py-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${
                  AVATAR_COLORS[user.role] ?? 'bg-slate-700'
                }`}
              >
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">
                  {user.displayName}
                </div>
                <div className="truncate text-xs text-slate-400">{user.email}</div>
              </div>
              <span
                className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none sm:inline-flex ${
                  user.isActive
                    ? 'bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20'
                    : 'bg-rose-400/10 text-rose-300 ring-1 ring-rose-400/20'
                }`}
              >
                {user.isActive ? 'Active' : 'Inactive'}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Edit ${user.displayName}`}
                    className="shrink-0 rounded-lg border border-slate-800 p-2 text-slate-400 transition hover:border-slate-700 hover:text-white"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 border-slate-800 bg-slate-950 text-white">
                  <DropdownMenuLabel className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Edit {user.displayName}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-800" />
                  <DropdownMenuItem
                    className="cursor-pointer rounded-lg px-3 py-2 text-slate-200 focus:bg-slate-900 focus:text-white"
                    onSelect={() => {
                      setSelectedUser(user);
                      setRoleDraft(user.role);
                      setModalMode('role');
                    }}
                  >
                    <UserCog className="h-4 w-4 text-slate-400" />
                    Change Role
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer rounded-lg px-3 py-2 text-slate-200 focus:bg-slate-900 focus:text-white"
                    onSelect={() => {
                      setSelectedUser(user);
                      setModalMode('access');
                    }}
                  >
                    {user.isActive ? (
                      <ShieldOff className="h-4 w-4 text-rose-300" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 text-emerald-300" />
                    )}
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </DropdownMenuItem>
                  {user.role !== UserRole.ADMIN ? (
                    <>
                      <DropdownMenuSeparator className="bg-slate-800" />
                      <DropdownMenuItem
                        className="cursor-pointer rounded-lg px-3 py-2 text-rose-300 focus:bg-rose-950/40 focus:text-rose-100"
                        onSelect={() => {
                          setSelectedUser(user);
                          setModalMode('delete');
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-rose-300" />
                        Delete User
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))
        )}
      </div>

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
            updateRoleMutation.mutate({ userId: selectedUser._id, nextRole: roleDraft });
          }
        }}
      >
        <select
          value={roleDraft}
          onChange={(event) => setRoleDraft(event.target.value as UserRole)}
          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
        >
          {Object.values(UserRole).map((nextRole) => (
            <option key={nextRole} value={nextRole}>
              {nextRole.charAt(0).toUpperCase() + nextRole.slice(1)}
            </option>
          ))}
        </select>
      </ConfirmModal>

      <ConfirmModal
        open={modalMode === 'access' && Boolean(selectedUser)}
        title={selectedUser?.isActive ? 'Deactivate access' : 'Activate access'}
        description={`This will ${selectedUser?.isActive ? 'revoke' : 'restore'} access for ${selectedUser?.displayName ?? 'this user'} and clear their session tokens.`}
        confirmLabel={selectedUser?.isActive ? 'Deactivate' : 'Activate'}
        confirmDanger={selectedUser?.isActive ?? false}
        busy={updateAccessMutation.isPending}
        onClose={() => {
          setModalMode(null);
          setSelectedUser(null);
        }}
        onConfirm={() => {
          if (selectedUser) {
            updateAccessMutation.mutate({
              userId: selectedUser._id,
              isActive: !selectedUser.isActive,
            });
          }
        }}
      />

      <ConfirmModal
        open={modalMode === 'delete' && Boolean(selectedUser)}
        title="Delete user"
        description={`This permanently deletes ${selectedUser?.displayName ?? 'this user'} from the platform. This cannot be undone.`}
        confirmLabel="Delete User"
        confirmDanger
        busy={deleteUserMutation.isPending}
        onClose={() => {
          setModalMode(null);
          setSelectedUser(null);
        }}
        onConfirm={() => {
          if (selectedUser && selectedUser.role !== UserRole.ADMIN) {
            deleteUserMutation.mutate(selectedUser._id);
          }
        }}
      />
    </div>
  );
}
