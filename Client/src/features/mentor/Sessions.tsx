import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock3, Plus, X } from 'lucide-react';
import { mentorApi, MentorSessionItem } from '../../api/mentor.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { OptionTabs } from '../../components/ui/OptionTabs';

type TabKey = 'upcoming' | 'completed' | 'cancelled';

const tabLabels: Record<TabKey, string> = {
  upcoming: 'Upcoming',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function SessionCard({
  session,
  canEditNotes,
  noteDraft,
  linkDraft,
  onDraftChange,
  onSave,
  onCancel,
  onLinkChange,
  onSaveLink,
}: {
  session: MentorSessionItem;
  canEditNotes: boolean;
  noteDraft: string;
  linkDraft: string;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onLinkChange: (value: string) => void;
  onSaveLink: () => void;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{session.status}</Badge>
            <Badge>{session.durationMinutes} min</Badge>
          </div>
          <h3 className="mt-3 text-2xl font-semibold text-white">{session.title}</h3>
          <p className="mt-2 text-sm text-slate-400">
            {session.student.displayName} {session.meetLink ? ` - ${session.meetLink}` : ''}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-300">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-cyan-300" />
              {new Date(session.scheduledAt).toLocaleString('en-IN')}
            </span>
            <span className="inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-cyan-300" />
              {session.durationMinutes} minutes
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {session.status === 'Scheduled' ? (
            <Button variant="secondary" onClick={onCancel}>
              Cancel Session
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr,260px]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="mb-3 text-xs uppercase tracking-[0.3em] text-cyan-300">Mentor Notes</div>
          <textarea
            className="min-h-28 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 disabled:opacity-60"
            value={noteDraft}
            onChange={(event) => onDraftChange(event.target.value)}
            disabled={!canEditNotes}
            placeholder="Add notes after the session"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {canEditNotes ? 'Editable for 24 hours after completion.' : 'Notes are locked for this session.'}
            </div>
            <Button variant="secondary" onClick={onSave} disabled={!canEditNotes}>
              Save Notes
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="mb-3 text-xs uppercase tracking-[0.3em] text-cyan-300">Session Details</div>
          <div className="space-y-3 text-sm text-slate-300">
            <div>
              <div className="text-slate-500">Student</div>
              <div className="font-semibold text-white">{session.student.displayName}</div>
            </div>
            <div>
              <div className="text-slate-500">Workspace</div>
              <div className="font-semibold text-white">{session.workspaceId ?? 'Not linked'}</div>
            </div>
            <div>
              <div className="text-slate-500">Meet Link</div>
              <Input value={linkDraft} onChange={(event) => onLinkChange(event.target.value)} placeholder="Add or edit meet link" />
              <div className="mt-2 flex justify-end">
                <Button variant="secondary" onClick={onSaveLink}>
                  Save Link
                </Button>
              </div>
            </div>
            {session.studentFeedback ? (
              <div>
                <div className="text-slate-500">Student Feedback</div>
                <div className="font-semibold text-white">{session.studentFeedback}</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function Sessions() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('upcoming');
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    studentId: '',
    workspaceId: '',
    title: '',
    scheduledAt: '',
    durationMinutes: 45,
    meetLink: '',
  });
  const [formErrors, setFormErrors] = useState<{ studentId?: string; title?: string; scheduledAt?: string }>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const sessionsQuery = useQuery({
    queryKey: ['mentor-sessions'],
    queryFn: mentorApi.getSessions,
    refetchInterval: 60_000,
  });

  const studentsQuery = useQuery({
    queryKey: ['mentor-students'],
    queryFn: mentorApi.getStudents,
    refetchInterval: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: mentorApi.createSession,
    onSuccess: async () => {
      setShowCreate(false);
      setForm({ studentId: '', workspaceId: '', title: '', scheduledAt: '', durationMinutes: 45, meetLink: '' });
      setFormErrors({});
      setSubmitAttempted(false);
      setMessage('Session scheduled successfully.');
      await queryClient.invalidateQueries({ queryKey: ['mentor-sessions'] });
    },
  });

  const validateSessionForm = () => {
    const errors: typeof formErrors = {};
    if (!form.studentId) errors.studentId = 'Please select a student.';
    if (!form.title.trim()) errors.title = 'Session title is required.';
    if (!form.scheduledAt) errors.scheduledAt = 'Please pick a date and time.';
    return errors;
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { status?: MentorSessionItem['status']; mentorNotes?: string; meetLink?: string } }) =>
      mentorApi.updateSession(id, payload),
    onSuccess: async () => {
      setMessage('Session updated.');
      await queryClient.invalidateQueries({ queryKey: ['mentor-sessions'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: mentorApi.deleteSession,
    onSuccess: async () => {
      setMessage('Session cancelled.');
      await queryClient.invalidateQueries({ queryKey: ['mentor-sessions'] });
    },
  });

  const sessions = sessionsQuery.data ?? { upcoming: [], completed: [], cancelled: [] };
  const currentSessions = sessions[activeTab];

  const canEditNotes = (session: MentorSessionItem) =>
    session.status === 'Completed' &&
    Date.now() <= new Date(session.scheduledAt).getTime() + 24 * 60 * 60 * 1000;

  const groupedStats = useMemo(
    () => [
      ['Upcoming', sessions.upcoming.length],
      ['Completed', sessions.completed.length],
      ['Cancelled', sessions.cancelled.length],
    ],
    [sessions],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Mentor Sessions</div>
          <h1 className="mt-2 text-3xl font-bold text-white">Sessions</h1>
          <p className="mt-2 text-slate-400">Track upcoming sessions, review completed notes, and cancel scheduled calls.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Schedule Session
        </Button>
      </div>

      {message ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {groupedStats.map(([label, value]) => (
          <Card key={label as string} className="p-5">
            <div className="text-3xl font-bold text-white">{value as number}</div>
            <div className="mt-2 text-sm text-slate-400">{label as string}</div>
          </Card>
        ))}
      </div>

      <OptionTabs
        items={(Object.keys(tabLabels) as TabKey[]).map((tab) => ({ id: tab, label: tabLabels[tab] }))}
        activeId={activeTab}
        onChange={setActiveTab}
        aria-label="Mentor session filters"
      />

      <div className="space-y-4">
        {currentSessions.map((session) => (
          <SessionCard
            key={session._id}
            session={session}
            canEditNotes={canEditNotes(session)}
            noteDraft={drafts[session._id] ?? session.mentorNotes ?? ''}
            linkDraft={linkDrafts[session._id] ?? session.meetLink ?? ''}
            onDraftChange={(value) => setDrafts((current) => ({ ...current, [session._id]: value }))}
            onSave={() =>
              updateMutation.mutate({
                id: session._id,
                payload: { status: session.status, mentorNotes: drafts[session._id] ?? session.mentorNotes ?? '' },
              })
            }
            onCancel={() => deleteMutation.mutate(session._id)}
            onLinkChange={(value) => setLinkDrafts((current) => ({ ...current, [session._id]: value }))}
            onSaveLink={() =>
              updateMutation.mutate({
                id: session._id,
                payload: {
                  status: session.status,
                  mentorNotes: drafts[session._id] ?? session.mentorNotes ?? '',
                  meetLink: linkDrafts[session._id] ?? session.meetLink ?? '',
                },
              })
            }
          />
        ))}
      </div>

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Schedule Session</div>
                <h2 className="mt-2 text-2xl font-bold text-white">Create a new session</h2>
              </div>
              <Button variant="ghost" onClick={() => { setShowCreate(false); setFormErrors({}); setSubmitAttempted(false); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <select
                  className={`rounded-lg border bg-slate-950 px-4 py-3 text-white ${submitAttempted && formErrors.studentId ? 'border-red-500' : 'border-slate-800'}`}
                  value={form.studentId}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, studentId: event.target.value }));
                    if (submitAttempted) setFormErrors((e) => ({ ...e, studentId: event.target.value ? undefined : 'Please select a student.' }));
                  }}
                >
                  <option value="">Select student *</option>
                  {studentsQuery.data?.map((student) => (
                    <option key={student.studentId} value={student.studentId}>
                      {student.displayName} - {student.startupName}
                    </option>
                  ))}
                </select>
                {submitAttempted && formErrors.studentId && (
                  <span className="text-xs text-red-400">{formErrors.studentId}</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Input
                  value={form.title}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, title: event.target.value }));
                    if (submitAttempted) setFormErrors((e) => ({ ...e, title: event.target.value.trim() ? undefined : 'Session title is required.' }));
                  }}
                  placeholder="Session title *"
                  className={submitAttempted && formErrors.title ? 'border-red-500' : ''}
                />
                {submitAttempted && formErrors.title && (
                  <span className="text-xs text-red-400">{formErrors.title}</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, scheduledAt: event.target.value }));
                    if (submitAttempted) setFormErrors((e) => ({ ...e, scheduledAt: event.target.value ? undefined : 'Please pick a date and time.' }));
                  }}
                  className={submitAttempted && formErrors.scheduledAt ? 'border-red-500' : ''}
                />
                {submitAttempted && formErrors.scheduledAt && (
                  <span className="text-xs text-red-400">{formErrors.scheduledAt}</span>
                )}
              </div>
              <select
                className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                value={form.durationMinutes}
                onChange={(event) => setForm((current) => ({ ...current, durationMinutes: Number(event.target.value) }))}
              >
                {[30, 45, 60, 90].map((duration) => (
                  <option key={duration} value={duration}>
                    {duration} minutes
                  </option>
                ))}
              </select>
              <Input value={form.workspaceId} onChange={(event) => setForm((current) => ({ ...current, workspaceId: event.target.value }))} placeholder="Workspace ID (optional)" />
              <Input value={form.meetLink} onChange={(event) => setForm((current) => ({ ...current, meetLink: event.target.value }))} placeholder="Google Meet URL (optional)" />
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => {
                  setSubmitAttempted(true);
                  const errors = validateSessionForm();
                  if (Object.keys(errors).length > 0) {
                    setFormErrors(errors);
                    return;
                  }
                  createMutation.mutate({
                    studentId: form.studentId,
                    workspaceId: form.workspaceId || undefined,
                    title: form.title,
                    scheduledAt: new Date(form.scheduledAt).toISOString(),
                    durationMinutes: form.durationMinutes,
                    meetLink: form.meetLink || undefined,
                  });
                }}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Scheduling...' : 'Schedule Session'}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
