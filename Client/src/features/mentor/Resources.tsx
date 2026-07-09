import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BookMarked,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Globe,
  Sparkles,
  Star,
  Upload,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { mentorResourceApi, MentorResourceItem } from '../../api/mentorResource.api';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types/roles.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  case_study: 'Case Study',
  guide:      'Guide',
  template:   'Template',
};

const TYPE_COLOR: Record<string, string> = {
  case_study: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  guide:      'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  template:   'text-violet-300 bg-violet-500/10 border-violet-500/20',
};

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

// ─── Resource Card ─────────────────────────────────────────────────────────────

function ResourceCard({ resource }: { resource: MentorResourceItem }) {
  const queryClient = useQueryClient();
  const nextMilestone = (resource.milestonesAwarded ?? 0 + 1) * 10;

  const downloadMutation = useMutation({
    mutationFn: () => mentorResourceApi.downloadResource(resource._id),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['mentor-resources'] });
      window.open(data.fileUrl, '_blank', 'noopener,noreferrer');
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => mentorResourceApi.saveResource(resource._id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mentor-resources'] });
    },
  });

  const typeColor = TYPE_COLOR[resource.type] ?? 'text-slate-300 bg-slate-700/10 border-slate-700';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${typeColor}`}>
              {TYPE_LABEL[resource.type] ?? resource.type}
            </span>
            {resource.isCuratedByAdmin && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-300">
                <Star className="h-3 w-3" /> Curated
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-white">{resource.title}</h3>
          {resource.description && (
            <p className="mt-1 text-xs text-slate-400 line-clamp-2">{resource.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {resource.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-500">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Download className="h-3 w-3" />
          {resource.downloadCount} downloads
        </span>
        <span className="flex items-center gap-1">
          <BookMarked className="h-3 w-3" />
          {resource.savedCount} saved
        </span>
        {(resource.milestonesAwarded ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-emerald-400">
            <Sparkles className="h-3 w-3" />
            {resource.milestonesAwarded} milestone{resource.milestonesAwarded !== 1 ? 's' : ''}
          </span>
        )}
        <span className="ml-auto">
          by <span className="text-white">{resource.mentorId?.displayName}</span>
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => downloadMutation.mutate()}
          disabled={downloadMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-violet-500/40 hover:text-violet-300 disabled:opacity-50"
        >
          <ExternalLink className="h-3 w-3" />
          {downloadMutation.isPending ? 'Opening…' : 'Download'}
        </button>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-50"
        >
          <BookMarked className="h-3 w-3" />
          Save
        </button>
      </div>
    </div>
  );
}

// ─── Upload Form (mentor only) ─────────────────────────────────────────────────

function UploadForm() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'guide', fileUrl: '', tags: '' });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: mentorResourceApi.uploadResource,
    onSuccess: () => {
      setSuccess(true);
      setForm({ title: '', description: '', type: 'guide', fileUrl: '', tags: '' });
      void queryClient.invalidateQueries({ queryKey: ['mentor-resources'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setError('');
    if (!form.title || !form.fileUrl) return setError('Title and file URL are required');
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    mutation.mutate({ ...form, tags });
  };

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-sm font-semibold text-white"
      >
        <span className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-violet-400" />
          Upload a Resource
          <span className="text-xs font-normal text-slate-500">(+20 pts per 10 unique downloads)</span>
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-3 border-t border-slate-800 pt-4">
          {success && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              Resource uploaded successfully!
            </div>
          )}
          {error && <div className="text-xs text-rose-400">{error}</div>}
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
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {mutation.isPending ? 'Uploading…' : 'Upload Resource'}
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MentorResources() {
  const user = useAuthStore((state) => state.user);
  const isMentor = user?.role === UserRole.MENTOR;

  const [filterType, setFilterType] = useState('');
  const [filterCurated, setFilterCurated] = useState(false);

  const query = useQuery({
    queryKey: ['mentor-resources', filterType, filterCurated],
    queryFn: () =>
      mentorResourceApi.listResources({
        ...(filterType ? { type: filterType } : {}),
        ...(filterCurated ? { curated: true } : {}),
      }),
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link
          to="/dashboard/mentor/score"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Mentor Score
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">Resource Library</h1>
        <p className="mt-1 text-sm text-slate-400">
          Guides, templates and case studies shared by mentors across the network.
          Mentors earn +20 pts every time their resource hits a new 10-unique-download milestone.
        </p>
      </div>

      {/* Upload form (mentor only) */}
      {isMentor && <UploadForm />}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { val: '', label: 'All types' },
          { val: 'guide', label: 'Guides' },
          { val: 'case_study', label: 'Case Studies' },
          { val: 'template', label: 'Templates' },
        ].map((opt) => (
          <button
            key={opt.val}
            onClick={() => setFilterType(opt.val)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              filterType === opt.val
                ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <button
          onClick={() => setFilterCurated((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            filterCurated
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
              : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Star className="h-3 w-3" />
          Curated only
        </button>
      </div>

      {/* Resource list */}
      {query.isLoading ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : (query.data?.resources.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 py-12 text-center">
          <Globe className="mx-auto mb-3 h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-400">No resources yet. Be the first to upload!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {query.data!.resources.map((r) => (
            <ResourceCard key={r._id} resource={r} />
          ))}
        </div>
      )}
    </div>
  );
}
