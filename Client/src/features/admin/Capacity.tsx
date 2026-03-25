import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { adminApi } from '../../api/admin.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';

export default function Capacity() {
  const capacityQuery = useQuery({
    queryKey: ['admin-capacity'],
    queryFn: adminApi.getCapacity,
  });

  const usersQuery = useQuery({
    queryKey: ['admin-export-users'],
    queryFn: () => adminApi.getUsers({ page: 1, limit: 2000 }),
  });

  const roleBreakdown = useMemo<Array<[string, number]>>(
    () =>
      Object.entries(
        (usersQuery.data?.items ?? []).reduce<Record<string, number>>((acc, user) => {
          acc[user.role] = (acc[user.role] ?? 0) + 1;
          return acc;
        }, {}),
      ),
    [usersQuery.data],
  );

  const exportMutation = useMutation({
    mutationFn: async () => {
      const rows = [
        ['Name', 'Email', 'Role'],
        ...(usersQuery.data?.items ?? []).map((user) => [user.displayName, user.email, user.role]),
      ];
      const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'promove-users.csv';
      link.click();
      URL.revokeObjectURL(url);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Capacity</div>
          <h1 className="mt-2 text-3xl font-bold text-white">Platform capacity</h1>
          <p className="mt-2 text-slate-400">Monitor usage against the Year 1 user cap.</p>
        </div>
        <Button onClick={() => exportMutation.mutate()}>
          <Download className="mr-2 h-4 w-4" />
          Export User List
        </Button>
      </div>

      {capacityQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[320px,1fr]">
          <Card className="p-6">
            <div className="relative mx-auto flex h-56 w-56 items-center justify-center">
              <svg viewBox="0 0 120 120" className="h-56 w-56 -rotate-90">
                <circle cx="60" cy="60" r="42" className="fill-none stroke-slate-800" strokeWidth="16" />
                <circle
                  cx="60"
                  cy="60"
                  r="42"
                  className="fill-none stroke-cyan-400"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray="263.89"
                  strokeDashoffset={263.89 - ((capacityQuery.data?.percentUsed ?? 0) / 100) * 263.89}
                />
              </svg>
              <div className="absolute text-center">
                <div className="text-4xl font-bold text-white">{capacityQuery.data?.percentUsed ?? 0}%</div>
                <div className="mt-2 text-sm text-slate-400">Used</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="text-3xl font-bold text-white">{capacityQuery.data?.current ?? 0}</div>
                <div className="mt-2 text-sm text-slate-400">Current Users</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="text-3xl font-bold text-white">{capacityQuery.data?.remainingSlots ?? 0}</div>
                <div className="mt-2 text-sm text-slate-400">Remaining Slots</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="text-3xl font-bold text-white">{capacityQuery.data?.waitlistCount ?? 0}</div>
                <div className="mt-2 text-sm text-slate-400">Waitlist Count</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="text-3xl font-bold text-white">{capacityQuery.data?.max ?? 0}</div>
                <div className="mt-2 text-sm text-slate-400">Max Capacity</div>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-3 text-xs uppercase tracking-[0.3em] text-cyan-300">Role Breakdown</div>
              <div className="flex flex-wrap gap-3">
                {roleBreakdown.map(([role, count]) => (
                  <Badge key={role}>
                    {role}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
