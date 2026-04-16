import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck,
  FileText,
  Loader2,
  MessageSquarePlus,
  Send,
  User,
  X,
} from 'lucide-react';
import { adminApi, AdminPatentRequestListItem } from '../../api/admin.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { OptionTabs } from '../../components/ui/OptionTabs';
import { Spinner } from '../../components/ui/Spinner';
import { getApiErrorMessage } from '../../utils/apiError';

// ─── Constants ───────────────────────────────────────────────────────────────

type FilterGroup = 'intake' | 'filing' | 'examination' | 'decided' | 'all';

const FILTER_TABS: Array<{ key: FilterGroup; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'intake', label: 'Intake' },
  { key: 'filing', label: 'Filing' },
  { key: 'examination', label: 'Examination' },
  { key: 'decided', label: 'Decided' },
];

const STATUS_GROUP_MAP: Record<string, FilterGroup> = {
  draft: 'intake',
  submitted: 'intake',
  documents_review: 'intake',
  ready_for_filing: 'filing',
  filed_with_ipo: 'filing',
  published: 'filing',
  examination_requested: 'examination',
  fer_issued: 'examination',
  fer_response_submitted: 'examination',
  granted: 'decided',
  rejected: 'decided',
  abandoned: 'decided',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  documents_review: 'Documents Review',
  ready_for_filing: 'Ready for Filing',
  filed_with_ipo: 'Filed with IPO',
  published: 'Published',
  examination_requested: 'Examination Requested',
  fer_issued: 'FER Issued',
  fer_response_submitted: 'FER Response Submitted',
  granted: 'Granted',
  rejected: 'Rejected',
  abandoned: 'Abandoned',
  // Legacy
  under_review: 'Under Review',
  in_progress: 'In Progress',
  filed: 'Filed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  filing_in_progress: 'Filing in Progress',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-700/60 text-slate-300',
  submitted: 'bg-yellow-500/15 text-yellow-300',
  documents_review: 'bg-cyan-500/15 text-cyan-300',
  ready_for_filing: 'bg-blue-500/15 text-blue-300',
  filed_with_ipo: 'bg-indigo-500/15 text-indigo-300',
  published: 'bg-violet-500/15 text-violet-300',
  examination_requested: 'bg-purple-500/15 text-purple-300',
  fer_issued: 'bg-orange-500/15 text-orange-300',
  fer_response_submitted: 'bg-amber-500/15 text-amber-300',
  granted: 'bg-emerald-500/15 text-emerald-300',
  rejected: 'bg-red-500/15 text-red-300',
  abandoned: 'bg-slate-600/40 text-slate-400',
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted'],
  submitted: ['documents_review', 'abandoned'],
  documents_review: ['ready_for_filing', 'abandoned'],
  ready_for_filing: ['filed_with_ipo', 'abandoned'],
  filed_with_ipo: ['published', 'abandoned'],
  published: ['examination_requested'],
  examination_requested: ['fer_issued', 'granted', 'rejected'],
  fer_issued: ['fer_response_submitted', 'abandoned'],
  fer_response_submitted: ['granted', 'rejected'],
  granted: [],
  rejected: [],
  abandoned: [],
};

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const getDeadlineUrgency = (deadline?: string) => {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, color: 'text-red-400 bg-red-500/15' };
  if (days <= 30) return { label: `${days}d left`, color: 'text-orange-400 bg-orange-500/15' };
  if (days <= 90) return { label: `${days}d left`, color: 'text-yellow-400 bg-yellow-500/10' };
  return { label: `${days}d left`, color: 'text-slate-400 bg-slate-700/40' };
};

// ─── Case Detail Modal ───────────────────────────────────────────────────────

function CaseDetailModal({
  item,
  onClose,
}: {
  item: AdminPatentRequestListItem;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [actionError, setActionError] = useState('');
  const [ipoAppNumber, setIpoAppNumber] = useState('');
  const [ipoFilingDate, setIpoFilingDate] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'actions' | 'notes'>('overview');

  const nextStatuses = VALID_TRANSITIONS[item.status] ?? [];

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      adminApi.updatePatentRequestStatus(item._id, { status, note: statusNote || undefined }),
    onSuccess: async () => {
      setActionError('');
      setStatusNote('');
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-requests'] });
      onClose();
    },
    onError: (err: unknown) => {
      setActionError(getApiErrorMessage(err, 'Failed to update status.'));
    },
  });

  const ipoMutation = useMutation({
    mutationFn: () =>
      adminApi.updatePatentRequestIpoDetails(item._id, {
        applicationNumber: ipoAppNumber,
        filingDate: new Date(ipoFilingDate).toISOString(),
      }),
    onSuccess: async () => {
      setActionError('');
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-requests'] });
      onClose();
    },
    onError: (err: unknown) => {
      setActionError(getApiErrorMessage(err, 'Failed to update IPO details.'));
    },
  });

  const noteMutation = useMutation({
    mutationFn: () => adminApi.addPatentRequestNote(item._id, noteText),
    onSuccess: async () => {
      setNoteText('');
      setActionError('');
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-requests'] });
    },
    onError: (err: unknown) => {
      setActionError(getApiErrorMessage(err, 'Failed to add note.'));
    },
  });

  const deadlines = [
    { label: 'Complete Specification', value: item.completeSpecDeadline },
    { label: 'Examination Request', value: item.examRequestDeadline },
    { label: 'FER Response', value: item.ferResponseDeadline },
  ].filter((d) => d.value);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm sm:p-6">
      <div className="mx-auto flex min-h-full w-full items-start justify-center">
        <Card className="flex w-full max-w-3xl flex-col overflow-hidden p-6 max-h-[calc(100vh-2rem)]">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Patent Support Case</div>
              <h3 className="mt-2 truncate text-xl font-bold text-white">{item.inventionTitle}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[item.status] ?? 'bg-slate-700 text-slate-300'}`}
                >
                  {STATUS_LABELS[item.status] ?? item.status}
                </span>
                <span className="text-sm text-slate-400">
                  <User className="mr-1 inline-block h-3.5 w-3.5" />
                  {item.student.displayName}
                </span>
                {item.ipoApplicationNumber && (
                  <span className="text-sm text-slate-400">IPO: {item.ipoApplicationNumber}</span>
                )}
              </div>
            </div>
            <Button variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Tabs */}
          <div className="mt-5 flex gap-1 border-b border-slate-800 pb-0">
            {(['overview', 'actions', 'notes'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === tab ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {tab === 'overview' ? 'Overview' : tab === 'actions' ? 'Actions' : 'Notes'}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            {activeTab === 'overview' && (
              <div className="space-y-5">
                {/* Key Info */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['Student', item.student.displayName],
                    ['Email', item.student.email],
                    ['Status', STATUS_LABELS[item.status] ?? item.status],
                    ['Patent Type', item.patentType ?? '—'],
                    ['Spec Type', item.specificationType ?? '—'],
                    ['Entity Type', item.applicantEntityType ?? '—'],
                    ['Submitted', formatDate(item.submittedAt)],
                    ['IPO Application', item.ipoApplicationNumber ?? '—'],
                    ['IPO Filing Date', formatDate(item.ipoFilingDate)],
                    ['Innovation Score', String(item.student.innovationScore)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                      <div className="text-xs font-medium text-slate-500">{label}</div>
                      <div className="mt-1 text-sm text-white">{value}</div>
                    </div>
                  ))}
                </div>

                {/* Deadlines */}
                {deadlines.length > 0 && (
                  <div>
                    <div className="mb-3 text-xs uppercase tracking-[0.2em] text-cyan-300">Deadlines</div>
                    <div className="space-y-2">
                      {deadlines.map((d) => {
                        const urgency = getDeadlineUrgency(d.value);
                        return (
                          <div
                            key={d.label}
                            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3"
                          >
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-slate-500" />
                              <span className="text-sm text-slate-300">{d.label}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-slate-400">{formatDate(d.value)}</span>
                              {urgency && (
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${urgency.color}`}>
                                  {urgency.label}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'actions' && (
              <div className="space-y-5">
                {/* Status Transition */}
                {nextStatuses.length > 0 ? (
                  <div>
                    <div className="mb-3 text-xs uppercase tracking-[0.2em] text-cyan-300">
                      Change Status
                    </div>
                    <textarea
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="Optional note for this status change..."
                      className="mb-3 min-h-20 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                    />
                    <div className="flex flex-wrap gap-2">
                      {nextStatuses.map((status) => (
                        <Button
                          key={status}
                          variant={status === 'abandoned' || status === 'rejected' ? 'secondary' : 'primary'}
                          onClick={() => {
                            if (
                              status === 'abandoned' || status === 'rejected'
                                ? window.confirm(`Mark as ${STATUS_LABELS[status]}? This is a terminal action.`)
                                : true
                            ) {
                              statusMutation.mutate(status);
                            }
                          }}
                          disabled={statusMutation.isPending}
                        >
                          <ChevronRight className="mr-1 h-3.5 w-3.5" />
                          {STATUS_LABELS[status] ?? status}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-5 py-6 text-center text-sm text-slate-500">
                    <CheckCircle2 className="mx-auto mb-2 h-6 w-6 opacity-40" />
                    This case has reached a terminal status. No further transitions available.
                  </div>
                )}

                {/* IPO Details */}
                <div>
                  <div className="mb-3 text-xs uppercase tracking-[0.2em] text-cyan-300">
                    IPO Details
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      value={ipoAppNumber}
                      onChange={(e) => setIpoAppNumber(e.target.value)}
                      placeholder="IPO Application Number"
                      className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
                    />
                    <input
                      type="date"
                      value={ipoFilingDate}
                      onChange={(e) => setIpoFilingDate(e.target.value)}
                      className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white [color-scheme:dark]"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    className="mt-3"
                    onClick={() => ipoMutation.mutate()}
                    disabled={!ipoAppNumber.trim() || !ipoFilingDate || ipoMutation.isPending}
                  >
                    {ipoMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileCheck className="mr-2 h-4 w-4" />
                    )}
                    Save IPO Details
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add an internal note..."
                    className="min-h-20 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={() => noteMutation.mutate()}
                  disabled={!noteText.trim() || noteMutation.isPending}
                >
                  {noteMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquarePlus className="mr-2 h-4 w-4" />
                  )}
                  Add Note
                </Button>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-5 py-4 text-sm text-slate-400">
                  Internal notes are stored on the case and are only visible to admins.
                  View full notes and timeline in the detailed case view.
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {actionError && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {actionError}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PatentRequests() {
  const [activeFilter, setActiveFilter] = useState<FilterGroup>('all');
  const [selectedCase, setSelectedCase] = useState<AdminPatentRequestListItem | null>(null);

  const requestsQuery = useQuery({
    queryKey: ['admin-patent-requests', activeFilter],
    queryFn: () => adminApi.getPatentRequests(),
    refetchInterval: 60_000,
  });

  const items = useMemo(() => {
    const all = requestsQuery.data?.items ?? [];
    if (activeFilter === 'all') return all;
    return all.filter((item) => STATUS_GROUP_MAP[item.status] === activeFilter);
  }, [requestsQuery.data, activeFilter]);

  const counts = useMemo(() => {
    const all = requestsQuery.data?.items ?? [];
    const result: Record<FilterGroup, number> = { all: all.length, intake: 0, filing: 0, examination: 0, decided: 0 };
    all.forEach((item) => {
      const group = STATUS_GROUP_MAP[item.status];
      if (group) result[group]++;
    });
    return result;
  }, [requestsQuery.data]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Patent Requests</div>
          <h1 className="mt-2 text-3xl font-bold text-white">Assisted Filing Cases</h1>
          <p className="mt-2 text-slate-400">
            Manage patent support requests from intake through India patent office workflow.
          </p>
        </div>
      </div>

      <OptionTabs
        items={FILTER_TABS.map((tab) => ({
          id: tab.key,
          label: `${tab.label} (${counts[tab.key]})`,
        }))}
        activeId={activeFilter}
        onChange={setActiveFilter}
        aria-label="Patent request status filters"
      />

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1.4fr,0.8fr,140px,140px,120px,100px] border-b border-slate-800 bg-slate-900/70 px-5 py-4 text-xs uppercase tracking-[0.2em] text-slate-400">
          <div>Student / Invention</div>
          <div>Status</div>
          <div>Submitted</div>
          <div>Next Deadline</div>
          <div>IPO #</div>
          <div>Actions</div>
        </div>
        <div className="divide-y divide-slate-800">
          {requestsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <FileText className="mb-3 h-8 w-8 opacity-40" />
              <div className="text-sm">No cases in this group.</div>
            </div>
          ) : (
            items.map((item) => {
              const nearestDeadline =
                item.completeSpecDeadline ?? item.examRequestDeadline ?? item.ferResponseDeadline;
              const urgency = getDeadlineUrgency(nearestDeadline);

              return (
                <div
                  key={item._id}
                  className="grid grid-cols-[1.4fr,0.8fr,140px,140px,120px,100px] items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-900/40"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">{item.inventionTitle}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {item.student.displayName} · {item.specificationType ?? 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[item.status] ?? 'bg-slate-700 text-slate-300'}`}
                    >
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </div>
                  <div className="text-sm text-slate-400">{formatDate(item.submittedAt)}</div>
                  <div>
                    {urgency ? (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${urgency.color}`}>
                        {urgency.label}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </div>
                  <div className="truncate text-sm text-slate-400">{item.ipoApplicationNumber ?? '—'}</div>
                  <div>
                    <Button variant="secondary" onClick={() => setSelectedCase(item)}>
                      Open
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {selectedCase && <CaseDetailModal item={selectedCase} onClose={() => setSelectedCase(null)} />}
    </div>
  );
}
