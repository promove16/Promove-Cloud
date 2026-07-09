import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Search,
  Star,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import { mentorScoreApi, MentorVerificationTask, LeaderboardEntry } from '../../api/mentorScore.api';

// ─── Types / Helpers ──────────────────────────────────────────────────────────

type AdminTab = 'leaderboard' | 'verifications' | 'history';

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const daysSince = (d: string) =>
  Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);

const TASK_TYPE_LABEL: Record<MentorVerificationTask['type'], string> = {
  lab_sync:         'Lab Hardware Sync',
  curriculum_pdf:   'Curriculum PDF',
  class_photo:      'Class Photo',
  industry_session: 'Industry Session',
  demo_day:         'Demo Day',
  outcome_bonus:    'Outcome Bonus',
};

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
    />
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function LeaderboardTab() {
  const [page, setPage] = useState(1);
  const [phase, setPhase] = useState<'1' | '2' | '3' | ''>('');

  const query = useQuery({
    queryKey: ['admin', 'mentor-leaderboard', page, phase],
    queryFn: () => mentorScoreApi.getLeaderboard(page, phase as '1' | '2' | '3' | undefined),
  });

  const data = query.data;
  const totalPages = data ? Math.ceil(data.total / (data.limit ?? 20)) : 1;

  return (
    <div className="space-y-4">
      {/* Phase filter */}
      <div className="flex flex-wrap gap-2">
        {[
          { val: '', label: 'Overall' },
          { val: '1', label: 'Phase 1' },
          { val: '2', label: 'Phase 2' },
          { val: '3', label: 'Phase 3' },
        ].map((opt) => (
          <button
            key={opt.val}
            onClick={() => { setPhase(opt.val as '' | '1' | '2' | '3'); setPage(1); }}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              phase === opt.val
                ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : (data?.docs.length ?? 0) === 0 ? (
        <div className="text-sm text-slate-400 py-8 text-center">No mentor scores recorded yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Mentor</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ph1</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ph2</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ph3</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Rating</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data!.docs.map((entry: LeaderboardEntry, i: number) => {
                const days = entry.lastActivityAt ? daysSince(entry.lastActivityAt) : null;
                const decaying = days !== null && days > 60;
                return (
                  <tr key={entry._id} className="bg-slate-900 transition hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <span className={`font-bold ${i < 3 ? 'text-amber-300' : 'text-slate-400'}`}>
                        #{entry.rank || (page - 1) * 20 + i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{entry.mentorId?.displayName}</div>
                      {entry.mentorId?.headline && (
                        <div className="text-xs text-slate-500 truncate max-w-[200px]">{entry.mentorId.headline}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white">{entry.totalScore}</td>
                    <td className="px-4 py-3 text-right text-cyan-400">{entry.phase1Score}</td>
                    <td className="px-4 py-3 text-right text-violet-400">{entry.phase2Score}</td>
                    <td className="px-4 py-3 text-right text-emerald-400">{entry.phase3Score}</td>
                    <td className="px-4 py-3 text-right">
                      {entry.mentorshipRating > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-300">
                          <Star className="h-3 w-3 fill-amber-300" />
                          {entry.mentorshipRating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {days !== null ? (
                        <span className={decaying ? 'text-rose-400' : 'text-slate-400'}>
                          {days}d ago
                          {decaying && <span className="ml-1 text-xs">(decaying)</span>}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="inline-flex items-center gap-1 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <span>Page {page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex items-center gap-1 disabled:opacity-40"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Verification Queue ────────────────────────────────────────────────────────

function VerificationTask({ task }: { task: MentorVerificationTask }) {
  const queryClient = useQueryClient();
  const [pts, setPts] = useState(String(task.pointsToAward));
  const [note, setNote] = useState('');
  const [showReject, setShowReject] = useState(false);

  const approveMutation = useMutation({
    mutationFn: () => mentorScoreApi.approveTask(task._id, Number(pts)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'verifications'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => mentorScoreApi.rejectTask(task._id, note),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'verifications'] }),
  });

  const mentorName = task.mentorId?.displayName ?? 'Unknown';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-violet-400">
            {TASK_TYPE_LABEL[task.type] ?? task.type}
          </span>
          <div className="mt-0.5 text-sm font-medium text-white">{mentorName}</div>
          <div className="text-xs text-slate-500">{fmt(task.createdAt)}</div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Pts:</label>
          <input
            type="number"
            min={0}
            value={pts}
            onChange={(e) => setPts(e.target.value)}
            className="w-16 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-white text-center focus:border-violet-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Evidence URLs */}
      {task.submissionUrls.length > 0 && (
        <div className="space-y-1">
          {task.submissionUrls.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-violet-400 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {url.length > 60 ? `${url.slice(0, 60)}…` : url}
            </a>
          ))}
        </div>
      )}

      {/* Submission data */}
      <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400 space-y-0.5">
        {Object.entries(task.submissionData).map(([k, v]) => (
          <div key={k}>
            <span className="text-slate-500">{k}: </span>
            <span className="text-slate-300">
              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
            </span>
          </div>
        ))}
      </div>

      {/* Reject note input */}
      {showReject && (
        <div>
          <label className="block text-xs text-slate-400 mb-1">Rejection reason (optional)</label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Photos are unclear…" />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => approveMutation.mutate()}
          disabled={approveMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {approveMutation.isPending ? 'Approving…' : `Approve (${pts} pts)`}
        </button>
        {!showReject ? (
          <button
            onClick={() => setShowReject(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/10"
          >
            <XCircle className="h-3.5 w-3.5" />
            Reject
          </button>
        ) : (
          <button
            onClick={() => rejectMutation.mutate()}
            disabled={rejectMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
          >
            <XCircle className="h-3.5 w-3.5" />
            {rejectMutation.isPending ? 'Rejecting…' : 'Confirm Reject'}
          </button>
        )}
      </div>
    </div>
  );
}

function VerificationsTab() {
  const [filterType, setFilterType] = useState('');

  const query = useQuery({
    queryKey: ['admin', 'verifications', 'pending', filterType],
    queryFn: () =>
      mentorScoreApi.listVerificationTasks({
        status: 'pending',
        ...(filterType ? { type: filterType } : {}),
      }),
    refetchInterval: 30_000,
  });

  const tasks = query.data?.tasks ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">Filter by type:</span>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none"
        >
          <option value="">All</option>
          <option value="lab_sync">Lab Sync</option>
          <option value="curriculum_pdf">Curriculum PDF</option>
          <option value="class_photo">Class Photo</option>
          <option value="industry_session">Industry Session</option>
          <option value="demo_day">Demo Day</option>
          <option value="outcome_bonus">Outcome Bonus</option>
        </select>
        <span className="ml-auto rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-0.5 text-xs font-semibold text-amber-300">
          {query.data?.total ?? 0} pending
        </span>
      </div>

      {query.isLoading ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 py-12 text-center text-sm text-slate-400">
          No pending verifications.
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <VerificationTask key={task._id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Score History ────────────────────────────────────────────────────────────

function ScoreHistoryTab() {
  const [mentorId, setMentorId] = useState('');
  const [submittedId, setSubmittedId] = useState('');

  const query = useQuery({
    queryKey: ['admin', 'mentor-history', submittedId],
    queryFn: () => mentorScoreApi.getMentorScoreHistory(submittedId),
    enabled: !!submittedId,
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={mentorId}
          onChange={(e) => setMentorId(e.target.value)}
          placeholder="Paste mentor user ID…"
          className="flex-1"
        />
        <button
          onClick={() => setSubmittedId(mentorId.trim())}
          disabled={!mentorId.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
          Load
        </button>
      </div>

      {query.isLoading && <div className="text-sm text-slate-400">Loading…</div>}

      {query.data && (
        <>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Score Summary</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-slate-400">Total Score</div>
              <div className="text-right font-bold text-white">{query.data.scoreDoc?.totalScore ?? 0}</div>
              <div className="text-slate-400">Phase 1</div>
              <div className="text-right text-cyan-400">{query.data.scoreDoc?.phase1Score ?? 0}</div>
              <div className="text-slate-400">Phase 2</div>
              <div className="text-right text-violet-400">{query.data.scoreDoc?.phase2Score ?? 0}</div>
              <div className="text-slate-400">Phase 3</div>
              <div className="text-right text-emerald-400">{query.data.scoreDoc?.phase3Score ?? 0}</div>
              <div className="text-slate-400">Rating</div>
              <div className="text-right text-amber-300">
                {query.data.scoreDoc?.mentorshipRating?.toFixed(1) ?? '—'} ★
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
            <div className="border-b border-slate-800 px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Score Events ({query.data.total})
            </div>
            <div className="divide-y divide-slate-800/60 max-h-[60vh] overflow-y-auto">
              {query.data.events.map((ev) => (
                <div key={ev._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div>
                    <div className="text-xs text-white">{ev.trigger}</div>
                    <div className="text-xs text-slate-500">{fmt(ev.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${ev.delta < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {ev.delta > 0 ? '+' : ''}{ev.delta}
                    </div>
                    <div className="text-xs text-slate-500">{ev.scoreAfter} total</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminMentorScores() {
  const [activeTab, setActiveTab] = useState<AdminTab>('leaderboard');

  const TABS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: 'leaderboard',   label: 'Leaderboard',        icon: TrendingUp },
    { id: 'verifications', label: 'Verification Queue',  icon: Clock3 },
    { id: 'history',       label: 'Score History',       icon: Award },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-violet-400" />
          <h1 className="text-2xl font-bold text-white">Mentor Scores</h1>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Teacher leaderboard, evidence verification queue, and individual score audit trail.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'border-violet-500 text-violet-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'leaderboard'   && <LeaderboardTab />}
      {activeTab === 'verifications' && <VerificationsTab />}
      {activeTab === 'history'       && <ScoreHistoryTab />}
    </div>
  );
}
