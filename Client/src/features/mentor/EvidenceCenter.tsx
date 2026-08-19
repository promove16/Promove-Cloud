import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Cpu,
  ExternalLink,
  FlaskConical,
  Globe,
  ImagePlus,
  Mic2,
  Plus,
  Rocket,
  Trash2,
  Trophy,
  Upload,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { mentorScoreApi, MentorVerificationTask } from '../../api/mentorScore.api';
import { mentorApi, MentorFeedStudent } from '../../api/mentor.api';
import { mentorResourceApi } from '../../api/mentorResource.api';
import { ResearchNote } from '../../components/ui/ResearchSpotlight';

// ─── Types / Constants ────────────────────────────────────────────────────────

type Tab = 'lab' | 'curriculum' | 'class' | 'industry' | 'prototype' | 'demo' | 'resources';

const TABS: { id: Tab; label: string; icon: React.ElementType; points: string }[] = [
  { id: 'lab',        label: 'Lab Sync',         icon: Cpu,         points: '+40 pts' },
  { id: 'curriculum', label: 'Curriculum PDF',    icon: BookOpen,    points: '+20 pts approval' },
  { id: 'class',      label: 'Class Photos',      icon: ImagePlus,   points: '+20 pts total' },
  { id: 'industry',   label: 'Industry Session',  icon: Mic2,        points: '+10 pts each' },
  { id: 'prototype',  label: 'Prototype Velocity', icon: Rocket,     points: '+10 pts each' },
  { id: 'demo',       label: 'Demo Day',          icon: Trophy,      points: '+50 pts/year' },
  { id: 'resources',  label: 'Resources',         icon: Globe,       points: '+20 per milestone' },
];

const STATUS_STYLE: Record<MentorVerificationTask['status'], string> = {
  pending:  'border-amber-500/20 bg-amber-500/10 text-amber-300',
  approved: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  rejected: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
};

const TASK_TYPE_FOR_TAB: Record<Tab, MentorVerificationTask['type'] | null> = {
  lab:        'lab_sync',
  curriculum: 'curriculum_pdf',
  class:      'class_photo',
  industry:   'industry_session',
  prototype:  'prototype_velocity',
  demo:       'demo_day',
  resources:  null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Label({ text }: { text: string }) {
  return <label className="block text-xs font-medium text-slate-400 mb-1">{text}</label>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      rows={3}
      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none resize-none"
    />
  );
}

function SubmitBtn({ pending, label = 'Submit for Review' }: { pending: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
    >
      {pending ? <Clock3 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      {pending ? 'Submitting…' : label}
    </button>
  );
}

function SuccessBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
      <span className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4" />
        {message}
      </span>
      <button onClick={onDismiss} className="text-emerald-400 hover:text-white">
        <XCircle className="h-4 w-4" />
      </button>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
      {message}
    </div>
  );
}

function TaskList({ tasks }: { tasks: MentorVerificationTask[] }) {
  if (!tasks.length) return null;
  return (
    <div className="mt-6 divide-y divide-slate-800/60 rounded-xl border border-slate-800 bg-slate-900">
      <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">My Submissions</div>
      {tasks.map((t) => (
        <div key={t._id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">
              {(t.submissionData.topic as string) || (t.submissionData.companyName as string) || (t.submissionData.academicYear as string) || t.type}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            {t.status === 'rejected' && t.rejectionNote && (
              <div className="text-xs text-rose-400 mt-1">{t.rejectionNote}</div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[t.status]}`}>
              {t.status}
            </span>
            <span className="text-xs text-slate-500">{t.pointsToAward} pts</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab Forms ────────────────────────────────────────────────────────────────

function parseErrorMessage(err: any): string {
  return err?.response?.data?.error?.message ?? err?.response?.data?.message ?? err?.message ?? 'Submission failed. Please try again.';
}

function LabSyncForm({ onSuccess }: { onSuccess: () => void }) {
  const [photoUrls, setPhotoUrls] = useState('');
  const [kitDesc, setKitDesc] = useState('');
  const [labDate, setLabDate] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const mutation = useMutation({
    mutationFn: mentorScoreApi.submitLabSync,
    onSuccess: () => { setSuccess(true); setPhotoUrls(''); setKitDesc(''); setLabDate(''); onSuccess(); },
    onError: (e: any) => setError(parseErrorMessage(e)),
  });

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setError('');
    setSuccess(false);
    const urls = photoUrls.split('\n').map((u) => u.trim()).filter(Boolean);
    if (!urls.length) return setError('At least one photo URL is required');
    if (labDate > todayStr) return setError('Lab date cannot be in the future.');
    mutation.mutate({ photoUrls: urls, kitDescription: kitDesc, labDate });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && <SuccessBanner message="Lab sync submitted for admin review." onDismiss={() => setSuccess(false)} />}
      {error && <ErrorBanner message={error} />}
      <div>
        <Label text="Photo URLs (one per line)" />
        <Textarea value={photoUrls} onChange={(e) => setPhotoUrls(e.target.value)} placeholder="https://..." required />
      </div>
      <div>
        <Label text="Kit description" />
        <Input value={kitDesc} onChange={(e) => setKitDesc(e.target.value)} placeholder="Arduino set, sensors…" />
      </div>
      <div>
        <Label text="Lab date" />
        <Input type="date" max={todayStr} value={labDate} onChange={(e) => setLabDate(e.target.value)} required />
      </div>
      <SubmitBtn pending={mutation.isPending} />
    </form>
  );
}

function CurriculumForm({ onSuccess }: { onSuccess: () => void }) {
  const [pdfUrl, setPdfUrl] = useState('');
  const [classCount, setClassCount] = useState('');
  const [year, setYear] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: mentorScoreApi.submitCurriculumPdf,
    onSuccess: () => { setSuccess(true); setPdfUrl(''); setClassCount(''); setYear(''); onSuccess(); },
    onError: (e: any) => setError(parseErrorMessage(e)),
  });

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setError('');
    setSuccess(false);
    if (!pdfUrl || !classCount || !year) return setError('All fields are required');
    mutation.mutate({ pdfUrl, plannedClassesCount: Number(classCount), academicYear: year });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && <SuccessBanner message="Curriculum PDF submitted for review." onDismiss={() => setSuccess(false)} />}
      {error && <ErrorBanner message={error} />}
      <div>
        <Label text="PDF URL" />
        <Input value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} placeholder="https://drive.google.com/…" required />
      </div>
      <div>
        <Label text="Planned class count" />
        <Input type="number" min={1} value={classCount} onChange={(e) => setClassCount(e.target.value)} placeholder="12" required />
      </div>
      <div>
        <Label text="Academic year (e.g. 2025-2026)" />
        <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2025-2026" required />
      </div>
      <SubmitBtn pending={mutation.isPending} />
    </form>
  );
}

function ClassPhotoForm({ onSuccess }: { onSuccess: () => void }) {
  const [photoUrls, setPhotoUrls] = useState('');
  const [curriculumId, setCurriculumId] = useState('');
  const [classIndex, setClassIndex] = useState('');
  const [classDate, setClassDate] = useState('');
  const [topic, setTopic] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const submissionsQuery = useQuery({
    queryKey: ['mentor-score', 'submissions', 'curriculum_pdf', 'approved'],
    queryFn: () => mentorScoreApi.getMySubmissions({ type: 'curriculum_pdf', status: 'approved' }),
  });

  const mutation = useMutation({
    mutationFn: mentorScoreApi.submitClassPhoto,
    onSuccess: () => { setSuccess(true); setPhotoUrls(''); setClassIndex(''); setClassDate(''); setTopic(''); onSuccess(); },
    onError: (e: any) => setError(parseErrorMessage(e)),
  });

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setError('');
    setSuccess(false);
    const urls = photoUrls.split('\n').map((u) => u.trim()).filter(Boolean);
    if (!urls.length || !curriculumId || !classIndex || !classDate || !topic) {
      return setError('All fields are required');
    }
    if (classDate > todayStr) return setError('Class date cannot be in the future.');
    mutation.mutate({ photoUrls: urls, curriculumTaskId: curriculumId, classIndex: Number(classIndex), classDate, topic });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && <SuccessBanner message="Class photo submitted for review." onDismiss={() => setSuccess(false)} />}
      {error && <ErrorBanner message={error} />}
      <div>
        <Label text="Curriculum mapping (approved)" />
        <select
          value={curriculumId}
          onChange={(e) => setCurriculumId(e.target.value)}
          required
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
        >
          <option value="">Select approved curriculum…</option>
          {(submissionsQuery.data ?? []).map((t) => (
            <option key={t._id} value={t._id}>
              {String(t.submissionData.academicYear ?? t._id)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label text="Photo URLs (one per line)" />
        <Textarea value={photoUrls} onChange={(e) => setPhotoUrls(e.target.value)} placeholder="https://…" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label text="Class number" />
          <Input type="number" min={1} value={classIndex} onChange={(e) => setClassIndex(e.target.value)} placeholder="1" required />
        </div>
        <div>
          <Label text="Class date" />
          <Input type="date" max={todayStr} value={classDate} onChange={(e) => setClassDate(e.target.value)} required />
        </div>
      </div>
      <div>
        <Label text="Topic covered" />
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="IoT sensors introduction" required />
      </div>
      <SubmitBtn pending={mutation.isPending} />
    </form>
  );
}

function IndustrySessionForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ founderName: '', companyName: '', sessionDate: '', topic: '', attendeeCount: '', evidenceUrl: '' });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const mutation = useMutation({
    mutationFn: mentorScoreApi.submitIndustrySession,
    onSuccess: () => { setSuccess(true); setForm({ founderName: '', companyName: '', sessionDate: '', topic: '', attendeeCount: '', evidenceUrl: '' }); onSuccess(); },
    onError: (e: any) => setError(parseErrorMessage(e)),
  });

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setError('');
    setSuccess(false);
    if (!form.founderName || !form.companyName || !form.sessionDate || !form.topic) {
      return setError('Founder name, company, date and topic are required');
    }
    if (form.sessionDate > todayStr) return setError('Session date cannot be in the future.');
    mutation.mutate({
      founderName:   form.founderName,
      companyName:   form.companyName,
      sessionDate:   form.sessionDate,
      topic:         form.topic,
      attendeeCount: Number(form.attendeeCount) || 0,
      evidenceUrl:   form.evidenceUrl || undefined,
    });
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && <SuccessBanner message="Industry session submitted for review." onDismiss={() => setSuccess(false)} />}
      {error && <ErrorBanner message={error} />}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label text="Founder / speaker name" />
          <Input value={form.founderName} onChange={set('founderName')} placeholder="Jane Doe" required />
        </div>
        <div>
          <Label text="Company name" />
          <Input value={form.companyName} onChange={set('companyName')} placeholder="Acme Corp" required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label text="Session date" />
          <Input type="date" max={todayStr} value={form.sessionDate} onChange={set('sessionDate')} required />
        </div>
        <div>
          <Label text="Attendee count" />
          <Input type="number" min={0} value={form.attendeeCount} onChange={set('attendeeCount')} placeholder="30" />
        </div>
      </div>
      <div>
        <Label text="Topic / title" />
        <Input value={form.topic} onChange={set('topic')} placeholder="Building a startup from scratch" required />
      </div>
      <div>
        <Label text="Evidence URL (optional – photo, video)" />
        <Input value={form.evidenceUrl} onChange={set('evidenceUrl')} placeholder="https://…" />
      </div>
      <SubmitBtn pending={mutation.isPending} />
    </form>
  );
}

function PrototypeVelocityForm({ onSuccess }: { onSuccess: () => void }) {
  const [studentId, setStudentId] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [stage, setStage] = useState('Prototype');
  const [photoUrls, setPhotoUrls] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const studentsQuery = useQuery({
    queryKey: ['mentor', 'students'],
    queryFn: mentorApi.getStudents,
  });

  const mutation = useMutation({
    mutationFn: mentorScoreApi.submitPrototypeVelocity,
    onSuccess: () => {
      setSuccess(true);
      setStudentId('');
      setProjectTitle('');
      setStage('Prototype');
      setPhotoUrls('');
      onSuccess();
    },
    onError: (e: any) => setError(parseErrorMessage(e)),
  });

  const students = studentsQuery.data ?? [];
  const selectedStudent = students.find((s) => s.studentId === studentId) ?? students.find((s) => s._id === studentId);

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setError('');
    setSuccess(false);
    const urls = photoUrls.split('\n').map((u) => u.trim()).filter(Boolean);
    if (!studentId || !projectTitle || !urls.length) {
      return setError('Student, project title and at least one photo URL are required');
    }
    mutation.mutate({ studentId, projectTitle, stage, photoUrls: urls });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && <SuccessBanner message="Prototype transition submitted for admin review." onDismiss={() => setSuccess(false)} />}
      {error && <ErrorBanner message={error} />}
      <p className="text-xs text-slate-500">
        Report a student who moved from the Idea Phase to the Prototype Phase under your mentorship. Earn +10 pts per student (max 100).
      </p>
      <div>
        <Label text="Student" />
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          required
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
        >
          <option value="">Select student…</option>
          {students.map((s) => (
            <option key={s.studentId} value={s.studentId}>
              {s.displayName} — {s.startupName || s.category}
            </option>
          ))}
        </select>
        {selectedStudent?.recentActivitySummary && (
          <p className="mt-1 text-xs text-slate-500">{selectedStudent.recentActivitySummary}</p>
        )}
      </div>
      <div>
        <Label text="Project title" />
        <Input value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} placeholder="Smart Irrigation System" required />
      </div>
      <div>
        <Label text="Stage reached" />
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
        >
          <option value="Prototype">Prototype</option>
          <option value="MVP">MVP</option>
          <option value="Working Prototype">Working Prototype</option>
        </select>
      </div>
      <div>
        <Label text="Photo / evidence URLs (one per line)" />
        <Textarea value={photoUrls} onChange={(e) => setPhotoUrls(e.target.value)} placeholder="https://…" required />
      </div>
      <SubmitBtn pending={mutation.isPending} />
    </form>
  );
}

function DemoDayForm({ onSuccess }: { onSuccess: () => void }) {
  const [videoUrl, setVideoUrl] = useState('');
  const [year, setYear] = useState('');
  const [winners, setWinners] = useState([{ studentName: '', projectTitle: '' }]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: mentorScoreApi.submitDemoDay,
    onSuccess: () => { setSuccess(true); setVideoUrl(''); setYear(''); setWinners([{ studentName: '', projectTitle: '' }]); onSuccess(); },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setError('');
    setSuccess(false);
    if (!videoUrl || !year) return setError('Video URL and academic year are required');
    const valid = winners.filter((w) => w.studentName.trim() && w.projectTitle.trim());
    if (!valid.length) return setError('At least one winner is required');
    mutation.mutate({ videoUrl, academicYear: year, winners: valid });
  };

  const updateWinner = (idx: number, field: 'studentName' | 'projectTitle', val: string) =>
    setWinners((prev) => prev.map((w, i) => i === idx ? { ...w, [field]: val } : w));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && <SuccessBanner message="Demo Day submitted for review." onDismiss={() => setSuccess(false)} />}
      {error && <ErrorBanner message={error} />}
      <div>
        <Label text="Demo Day video URL" />
        <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/…" required />
      </div>
      <div>
        <Label text="Academic year" />
        <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2025-2026" required />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label text="Winners" />
          <button
            type="button"
            onClick={() => setWinners((prev) => [...prev, { studentName: '', projectTitle: '' }])}
            className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
          >
            <Plus className="h-3 w-3" /> Add winner
          </button>
        </div>
        <div className="space-y-2">
          {winners.map((w, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input value={w.studentName} onChange={(e) => updateWinner(i, 'studentName', e.target.value)} placeholder="Student name" />
              <Input value={w.projectTitle} onChange={(e) => updateWinner(i, 'projectTitle', e.target.value)} placeholder="Project title" />
              {winners.length > 1 && (
                <button type="button" onClick={() => setWinners((prev) => prev.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4 text-slate-500 hover:text-rose-400" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      <SubmitBtn pending={mutation.isPending} />
    </form>
  );
}

function ResourcesForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ title: '', description: '', type: 'guide', fileUrl: '', tags: '' });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: mentorResourceApi.uploadResource,
    onSuccess: () => { setSuccess(true); setForm({ title: '', description: '', type: 'guide', fileUrl: '', tags: '' }); onSuccess(); },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setError('');
    setSuccess(false);
    if (!form.title || !form.fileUrl) return setError('Title and file URL are required');
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    mutation.mutate({ title: form.title, description: form.description, type: form.type, fileUrl: form.fileUrl, tags });
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-slate-500">Earn +20 pts each time your resource reaches a new 10 unique downloads milestone.</p>
      {success && <SuccessBanner message="Resource uploaded successfully." onDismiss={() => setSuccess(false)} />}
      {error && <ErrorBanner message={error} />}
      <div>
        <Label text="Title" />
        <Input value={form.title} onChange={set('title')} placeholder="IoT Lab Guide for Schools" required />
      </div>
      <div>
        <Label text="Description (optional)" />
        <Textarea value={form.description} onChange={set('description')} placeholder="A step-by-step guide…" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label text="Type" />
          <select
            value={form.type}
            onChange={set('type')}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
          >
            <option value="guide">Guide</option>
            <option value="case_study">Case Study</option>
            <option value="template">Template</option>
          </select>
        </div>
        <div>
          <Label text="Tags (comma-separated)" />
          <Input value={form.tags} onChange={set('tags')} placeholder="iot, robotics" />
        </div>
      </div>
      <div>
        <Label text="File URL (Google Drive, Dropbox, etc.)" />
        <Input value={form.fileUrl} onChange={set('fileUrl')} placeholder="https://drive.google.com/…" required />
      </div>
      <SubmitBtn pending={mutation.isPending} label="Upload Resource" />
    </form>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function EvidenceCenter() {
  const [activeTab, setActiveTab] = useState<Tab>('lab');
  const queryClient = useQueryClient();

  const submissionsQuery = useQuery({
    queryKey: ['mentor-score', 'submissions', activeTab],
    queryFn: () => {
      const type = TASK_TYPE_FOR_TAB[activeTab];
      return type ? mentorScoreApi.getMySubmissions({ type }) : Promise.resolve([]);
    },
  });

  const onSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: ['mentor-score', 'submissions'] });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link
          to="/dashboard/mentor/score"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Mentor Score
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">Evidence Center</h1>
        <p className="mt-1 text-sm text-slate-400">
          Submit evidence for admin verification to earn Mentor Score points across all three phases.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                active
                  ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              <span className={`${active ? 'text-violet-400' : 'text-slate-600'}`}>{tab.points}</span>
            </button>
          );
        })}
      </div>

      {/* Form card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center gap-2">
          {(() => {
            const t = TABS.find((x) => x.id === activeTab)!;
            const Icon = t.icon;
            return (
              <>
                <Icon className="h-4 w-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-white">{t.label}</h2>
                <span className="ml-auto rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-0.5 text-xs font-medium text-violet-300">
                  {t.points}
                </span>
              </>
            );
          })()}
        </div>

        {activeTab === 'lab'        && <LabSyncForm onSuccess={onSuccess} />}
        {activeTab === 'curriculum' && <CurriculumForm onSuccess={onSuccess} />}
        {activeTab === 'class'      && <ClassPhotoForm onSuccess={onSuccess} />}
        {activeTab === 'industry'   && <IndustrySessionForm onSuccess={onSuccess} />}
        {activeTab === 'prototype'  && <PrototypeVelocityForm onSuccess={onSuccess} />}
        {activeTab === 'demo'       && <DemoDayForm onSuccess={onSuccess} />}
        {activeTab === 'resources'  && <ResourcesForm onSuccess={onSuccess} />}
      </div>

      {/* Submissions list for current tab */}
      {activeTab !== 'resources' && (
        <TaskList tasks={submissionsQuery.data ?? []} />
      )}

      {/* Phase guide */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Scoring Guide</h2>
        <div className="space-y-3 text-xs text-slate-400">
          <div>
            <span className="font-semibold text-cyan-400">Phase 1 — Empowerment (max 140 pts)</span>
            <p>Training modules (60) + Lab hardware sync (40) + Curriculum mapping &amp; class photos (40)</p>
          </div>
          <div>
            <span className="font-semibold text-violet-400">Phase 2 — Incubation (max 245 pts)</span>
            <p>Industry sessions (max 95) + Prototype velocity (max 100) + Demo Day (50/year)</p>
          </div>
          <div>
            <span className="font-semibold text-emerald-400">Phase 3 — Global Mentorship (uncapped)</span>
            <p>Resource milestones (+20 per 10 unique downloads) + Forum answers + Session tokens + LOIs + Outcome bonuses</p>
          </div>
        </div>
        <div className="mt-4 border-t border-slate-800 pt-3">
          <ResearchNote
            icon={BookOpen}
            text="Educational Framework: This scoring model follows an e-portfolio assessment framework (informed by EDUCAUSE standards) where mentors showcase competencies dynamically through continuous growth logs, authentic evaluation artifacts, and reflection instead of exams."
          />
        </div>
      </section>

      {/* External link to resource library */}
      <Link
        to="/dashboard/mentor/resources"
        className="inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Browse the full resource library
      </Link>
    </div>
  );
}
