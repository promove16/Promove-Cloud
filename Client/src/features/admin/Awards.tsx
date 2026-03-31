import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trophy, X } from 'lucide-react';
import { adminApi, AdminAwardItem } from '../../api/admin.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { getApiErrorMessage } from '../../utils/apiError';

export default function Awards() {
  const queryClient = useQueryClient();
  const [selectedAward, setSelectedAward] = useState<AdminAwardItem | null>(null);
  const [notes, setNotes] = useState('');
  const [actionError, setActionError] = useState('');

  const awardsQuery = useQuery({
    queryKey: ['admin-awards'],
    queryFn: adminApi.getAwards,
    refetchInterval: 60_000,
  });

  const approveMutation = useMutation({
    mutationFn: () => adminApi.approveAward(selectedAward!._id),
    onSuccess: async () => {
      setSelectedAward(null);
      setActionError('');
      await queryClient.invalidateQueries({ queryKey: ['admin-awards'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
    onError: (error: unknown) => {
      setActionError(getApiErrorMessage(error, 'Failed to approve award. Please try again.'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => adminApi.rejectAward(selectedAward!._id, notes),
    onSuccess: async () => {
      setSelectedAward(null);
      setNotes('');
      setActionError('');
      await queryClient.invalidateQueries({ queryKey: ['admin-awards'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
    onError: (error: unknown) => {
      setActionError(getApiErrorMessage(error, 'Failed to reject award. Please try again.'));
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Awards</div>
        <h1 className="mt-2 text-3xl font-bold text-white">Award Review</h1>
        <p className="mt-2 text-slate-400">Review submitted awards pending score approval.</p>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1.4fr,1fr,160px,110px,140px] border-b border-slate-800 bg-slate-900/70 px-5 py-4 text-xs uppercase tracking-[0.3em] text-slate-400">
          <div>Student</div>
          <div>Award</div>
          <div>Submitted</div>
          <div>Status</div>
          <div>Actions</div>
        </div>
        <div className="divide-y divide-slate-800">
          {awardsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12"><Spinner /></div>
          ) : (awardsQuery.data ?? []).length === 0 ? (
            <div className="px-5 py-12 text-sm text-slate-400">No awards pending review.</div>
          ) : (
            (awardsQuery.data ?? []).map((award) => (
              <div key={award._id} className="grid grid-cols-[1.4fr,1fr,160px,110px,140px] items-center gap-4 px-5 py-5">
                <div className="font-semibold text-white">{award.student.displayName}</div>
                <div className="text-slate-300">{award.title}</div>
                <div className="text-slate-400">{new Date(award.submittedAt).toLocaleDateString('en-IN')}</div>
                <div><Badge>{award.status}</Badge></div>
                <div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelectedAward(award);
                      setNotes('');
                      setActionError('');
                    }}
                  >
                    <Trophy className="mr-2 h-4 w-4" />
                    Review
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {selectedAward ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Award Review</div>
                <h3 className="mt-2 text-2xl font-bold text-white">{selectedAward.title}</h3>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedAward(null);
                  setNotes('');
                  setActionError('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm leading-7 text-slate-300">
              {selectedAward.description}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => rejectMutation.mutate()}
                disabled={notes.trim().length < 5 || rejectMutation.isPending}
              >
                Reject
              </Button>
              <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                Approve (+15 pts)
              </Button>
            </div>

            {actionError ? (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {actionError}
              </div>
            ) : null}

            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add a short rejection reason"
              className="mt-4 min-h-28 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500"
            />
          </Card>
        </div>
      ) : null}
    </div>
  );
}
