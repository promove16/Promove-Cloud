import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, X } from 'lucide-react';
import { adminApi, AdminPatentItem } from '../../api/admin.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';

type TabKey = 'submitted' | 'under_review' | 'approved' | 'rejected';

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'submitted', label: 'Pending' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

function ReviewModal({
  patent,
  open,
  onClose,
}: {
  patent: AdminPatentItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');

  const approveMutation = useMutation({
    mutationFn: () => adminApi.approvePatent(patent!._id),
    onSuccess: async () => {
      onClose();
      await queryClient.invalidateQueries({ queryKey: ['admin-patents'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => adminApi.rejectPatent(patent!._id, reason),
    onSuccess: async () => {
      onClose();
      setReason('');
      await queryClient.invalidateQueries({ queryKey: ['admin-patents'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
  });

  if (!open || !patent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-4xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Patent Review</div>
            <h3 className="mt-2 text-2xl font-bold text-white">{patent.projectTitle}</h3>
          </div>
          <Button variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr,1fr]">
          <Card className="p-5">
            <div className="mb-3 text-xs uppercase tracking-[0.3em] text-cyan-300">Questionnaire</div>
            <div className="space-y-4 text-sm text-slate-300">
              {Object.entries(patent.questionnaire).map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="text-slate-500">{label.replace(/([A-Z])/g, ' $1').trim()}</div>
                  <div className="mt-2 leading-7 text-white">{value}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 text-xs uppercase tracking-[0.3em] text-cyan-300">Student Score</div>
            <div className="text-4xl font-bold text-white">{patent.student.innovationScore}</div>
            <div className="mt-2 text-sm text-slate-400">Full score breakdown is visible before review.</div>
            <div className="mt-4 grid gap-3">
              {Object.entries(patent.student.scoreBreakdown).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm">
                  <span className="text-slate-300">{label}</span>
                  <span className="font-semibold text-white">{value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full max-w-xl">
            <div className="text-sm text-slate-400">Approve will award 25 Innovation Score.</div>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Enter a rejection reason (minimum 20 characters)"
              className="mt-3 min-h-28 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => rejectMutation.mutate()} disabled={reason.trim().length < 20 || rejectMutation.isPending}>
              Reject
            </Button>
            <Button onClick={() => {
              if (window.confirm('This will award 25 Innovation Score. Confirm?')) {
                approveMutation.mutate();
              }
            }} disabled={approveMutation.isPending}>
              Approve (+25 pts)
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function Patents() {
  const [activeTab, setActiveTab] = useState<TabKey>('submitted');
  const [selectedPatent, setSelectedPatent] = useState<AdminPatentItem | null>(null);

  const patentsQuery = useQuery({
    queryKey: ['admin-patents', activeTab],
    queryFn: () => adminApi.getPatents(activeTab),
    refetchInterval: 60_000,
  });

  const patents = useMemo(() => patentsQuery.data ?? [], [patentsQuery.data]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Patents</div>
          <h1 className="mt-2 text-3xl font-bold text-white">Patent Review</h1>
          <p className="mt-2 text-slate-400">Review submissions before approving score awards.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {tabs.map((tab) => (
          <Button key={tab.key} variant={activeTab === tab.key ? 'primary' : 'secondary'} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </Button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1.4fr,1fr,160px,120px,140px] border-b border-slate-800 bg-slate-900/70 px-5 py-4 text-xs uppercase tracking-[0.3em] text-slate-400">
          <div>Student</div>
          <div>Project</div>
          <div>Submitted</div>
          <div>Status</div>
          <div>Actions</div>
        </div>
        <div className="divide-y divide-slate-800">
          {patentsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12"><Spinner /></div>
          ) : patents.length === 0 ? (
            <div className="px-5 py-12 text-sm text-slate-400">No patents in this bucket.</div>
          ) : (
            patents.map((patent) => (
              <div key={patent._id} className="grid grid-cols-[1.4fr,1fr,160px,120px,140px] items-center gap-4 px-5 py-5">
                <div className="font-semibold text-white">{patent.student.displayName}</div>
                <div className="text-slate-300">{patent.projectTitle}</div>
                <div className="text-slate-400">{new Date(patent.submittedAt).toLocaleDateString('en-IN')}</div>
                <div>
                  <Badge>{patent.status}</Badge>
                </div>
                <div>
                  <Button variant="secondary" onClick={() => setSelectedPatent(patent)}>
                    <Shield className="mr-2 h-4 w-4" />
                    Review
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <ReviewModal patent={selectedPatent} open={Boolean(selectedPatent)} onClose={() => setSelectedPatent(null)} />
    </div>
  );
}
