import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminMentorsSwitcher } from './AdminMentorsSwitcher';
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
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { mentorScoreApi, MentorVerificationTask, LeaderboardEntry } from '../../api/mentorScore.api';
import { adminApi } from '../../api/admin.api';
import { toast } from 'sonner';

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

function LeaderboardTab({ onViewHistory }: { onViewHistory: (id: string) => void }) {
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
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
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
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onViewHistory(entry.mentorId?._id)}
                        className="inline-flex items-center gap-1 rounded bg-violet-600/80 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-violet-650 hover:shadow shadow-violet-500/20"
                        title="View Score History Audit"
                      >
                        History
                      </button>
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

// ─── Score History Tab ────────────────────────────────────────────────────────

function ScoreHistoryTab({
  selectedMentorId,
  setSelectedMentorId,
}: {
  selectedMentorId: string;
  setSelectedMentorId: (id: string) => void;
}) {
  const queryClient = useQueryClient();

  // Fetch mentors list for dropdown selector
  const mentorsQuery = useQuery({
    queryKey: ['admin', 'mentors'],
    queryFn: adminApi.getMentors,
  });

  // Fetch selected mentor's score history
  const historyQuery = useQuery({
    queryKey: ['admin', 'mentor-history', selectedMentorId],
    queryFn: () => mentorScoreApi.getMentorScoreHistory(selectedMentorId),
    enabled: !!selectedMentorId,
  });

  // Score adjustment inputs
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [phase, setPhase] = useState<'1' | '2' | '3'>('1');

  const adjustMutation = useMutation({
    mutationFn: () =>
      mentorScoreApi.adminAdjustScore({
        mentorId: selectedMentorId,
        delta: Number(delta),
        reason,
        phase: Number(phase) as 1 | 2 | 3,
      }),
    onSuccess: () => {
      toast.success('Score adjusted successfully');
      setDelta('');
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'mentor-history', selectedMentorId] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'mentor-leaderboard'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to adjust score');
    },
  });

  const mentors = mentorsQuery.data ?? [];
  const selectedMentor = mentors.find((m) => m._id === selectedMentorId);

  return (
    <div className="space-y-6">
      {/* Mentor Selector Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Award className="h-5 w-5 text-violet-400" />
            Score Audit & Adjustments
          </h3>
          <p className="text-xs text-slate-400">
            Select a mentor to review complete scoring logs and perform manual point adjustments.
          </p>
        </div>
        
        <div className="w-full md:w-80">
          {mentorsQuery.isLoading ? (
            <div className="text-sm text-slate-500">Loading mentors...</div>
          ) : (
            <select
              value={selectedMentorId}
              onChange={(e) => setSelectedMentorId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
            >
              <option value="">-- Select a Mentor --</option>
              {mentors.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.displayName} ({m.email})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {!selectedMentorId ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/20 py-20 text-center text-sm text-slate-400">
          Please select a mentor from the dropdown above to view their audit log.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column: Summary & History Events */}
          <div className="lg:col-span-2 space-y-6">
            {/* Score Summary Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Score Summary: {selectedMentor?.displayName}
              </h4>
              
              {historyQuery.isLoading ? (
                <div className="text-sm text-slate-500 py-4">Loading scores...</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                    <div className="text-xs text-slate-500 font-medium">Total Score</div>
                    <div className="text-2xl font-bold text-white mt-1">
                      {historyQuery.data?.scoreDoc?.totalScore ?? 0}
                    </div>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                    <div className="text-xs text-cyan-500 font-medium font-semibold">Phase 1</div>
                    <div className="text-2xl font-bold text-cyan-400 mt-1">
                      {historyQuery.data?.scoreDoc?.phase1Score ?? 0}
                    </div>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                    <div className="text-xs text-violet-500 font-medium font-semibold">Phase 2</div>
                    <div className="text-2xl font-bold text-violet-400 mt-1">
                      {historyQuery.data?.scoreDoc?.phase2Score ?? 0}
                    </div>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                    <div className="text-xs text-emerald-500 font-medium font-semibold">Phase 3</div>
                    <div className="text-2xl font-bold text-emerald-400 mt-1">
                      {historyQuery.data?.scoreDoc?.phase3Score ?? 0}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Audit Log / Score Events Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
              <div className="border-b border-slate-800 bg-slate-900 px-6 py-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-white uppercase tracking-wider">
                  Audit Trail
                </span>
                <span className="rounded-full bg-violet-500/10 border border-violet-500/20 px-3 py-0.5 text-xs text-violet-300">
                  {historyQuery.data?.total ?? 0} events
                </span>
              </div>

              <div className="divide-y divide-slate-800 bg-slate-950/20 max-h-[500px] overflow-y-auto">
                {historyQuery.isLoading ? (
                  <div className="text-sm text-slate-500 py-12 text-center">Loading event logs...</div>
                ) : !historyQuery.data?.events || historyQuery.data.events.length === 0 ? (
                  <div className="text-sm text-slate-500 py-16 text-center">
                    No scoring events logged for this mentor.
                  </div>
                ) : (
                  historyQuery.data.events.map((ev) => (
                    <div key={ev._id} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-900/30 transition">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-white">{ev.trigger}</div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>{fmt(ev.createdAt)}</span>
                          <span>•</span>
                          <span className="text-slate-400 font-semibold">Phase {ev.phase}</span>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className={`text-sm font-bold ${ev.delta < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {ev.delta > 0 ? '+' : ''}{ev.delta}
                        </div>
                        <div className="text-xs text-slate-500 font-medium">
                          {ev.scoreAfter} total
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Score Adjustment Panel */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 h-fit space-y-4">
            <div className="space-y-1">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                Adjust Score
              </h4>
              <p className="text-xs text-slate-400">
                Manually add or deduct points from this mentor's score for administrative overrides.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Target Phase</label>
                <select
                  value={phase}
                  onChange={(e) => setPhase(e.target.value as '1' | '2' | '3')}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                >
                  <option value="1">Phase 1 (Core Prep & Foundation)</option>
                  <option value="2">Phase 2 (Connect & Startup Velocity)</option>
                  <option value="3">Phase 3 (Ecosystem Contribution)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Point Delta</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={delta}
                    onChange={(e) => setDelta(e.target.value)}
                    placeholder="e.g. 50 or -25"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                  />
                </div>
                {/* Quick select buttons */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['+10', '+50', '+100', '-10', '-50'].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setDelta(val.replace('+', ''))}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700"
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Reason for Adjustment</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Manual override for outstanding community contribution..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none resize-none"
                />
              </div>

              <button
                type="button"
                onClick={() => adjustMutation.mutate()}
                disabled={!delta || !reason || adjustMutation.isPending}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {adjustMutation.isPending ? 'Applying...' : 'Apply Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminMentorScores() {
  const [activeTab, setActiveTab] = useState<AdminTab>('leaderboard');
  const [selectedMentorId, setSelectedMentorId] = useState('');

  const TABS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: 'leaderboard',   label: 'Leaderboard',        icon: TrendingUp },
    { id: 'verifications', label: 'Verification Queue',  icon: Clock3 },
    { id: 'history',       label: 'Score History',      icon: Award },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-b border-slate-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-violet-400" />
            <h1 className="text-2xl font-bold text-white">Mentor Scores</h1>
          </div>
          <p className="mt-1.5 text-sm text-slate-400">
            Teacher leaderboard, evidence verification queue, and individual score audit trail.
          </p>
        </div>
        <AdminMentorsSwitcher />
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
      {activeTab === 'leaderboard'   && (
        <LeaderboardTab
          onViewHistory={(id) => {
            setSelectedMentorId(id);
            setActiveTab('history');
          }}
        />
      )}
      {activeTab === 'verifications' && <VerificationsTab />}
      {activeTab === 'history'       && (
        <ScoreHistoryTab
          selectedMentorId={selectedMentorId}
          setSelectedMentorId={setSelectedMentorId}
        />
      )}
    </div>
  );
}
