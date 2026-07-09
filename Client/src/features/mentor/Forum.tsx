import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  MessageSquare,
  Plus,
  Send,
  ThumbsUp,
  Users,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { forumApi, ForumPost, ForumAnswer } from '../../api/forum.api';
import { useAuthStore } from '../../store/authStore';
import { ResearchNote } from '../../components/ui/ResearchSpotlight';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const ROLE_COLOR: Record<string, string> = {
  mentor:   'text-violet-300 bg-violet-500/10 border-violet-500/20',
  student:  'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  college:  'text-amber-300 bg-amber-500/10 border-amber-500/20',
  school:   'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  admin:    'text-rose-300 bg-rose-500/10 border-rose-500/20',
};

function RoleBadge({ role }: { role: string }) {
  const cls = ROLE_COLOR[role] ?? 'text-slate-300 bg-slate-500/10 border-slate-500/20';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${cls}`}>
      {role}
    </span>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none resize-none"
    />
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
    />
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({ post, onOpen }: { post: ForumPost; onOpen: (id: string) => void }) {
  return (
    <button
      onClick={() => onOpen(post._id)}
      className="w-full text-left rounded-2xl border border-slate-800 bg-slate-900 p-4 transition hover:border-slate-700"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {post.solved && (
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
            )}
            <span className="text-sm font-semibold text-white truncate">{post.title}</span>
          </div>
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {post.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {post.solved && (
          <span className="flex-shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
            Solved
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          {post.answerCount} answers
        </span>
        <span className="flex items-center gap-1">
          <Eye className="h-3 w-3" />
          {post.viewCount} views
        </span>
        <span>{fmt(post.createdAt)}</span>
        {post.authorId && (
          <>
            <RoleBadge role={post.authorRole} />
            <span className="text-slate-400">{post.authorId.displayName}</span>
          </>
        )}
      </div>
    </button>
  );
}

// ─── Answer Card ──────────────────────────────────────────────────────────────

function AnswerCard({
  answer,
  myId,
  postId,
}: {
  answer: ForumAnswer;
  myId: string;
  postId: string;
}) {
  const queryClient = useQueryClient();
  const alreadyVoted = answer.helpfulVotes.includes(myId);

  const mutation = useMutation({
    mutationFn: () => forumApi.markHelpful(answer._id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum', 'post', postId] });
    },
  });

  return (
    <div
      className={`rounded-xl border p-4 ${
        answer.isVerifiedSolution
          ? 'border-emerald-500/30 bg-emerald-950/30'
          : 'border-slate-800 bg-slate-900/60'
      }`}
    >
      {answer.isVerifiedSolution && (
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Verified Solution
        </div>
      )}
      <p className="text-sm text-slate-200 whitespace-pre-wrap">{answer.body}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{answer.authorId?.displayName}</span>
          <RoleBadge role={answer.authorRole} />
          <span>{fmt(answer.createdAt)}</span>
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
            alreadyVoted
              ? 'border-violet-500/30 bg-violet-500/10 text-violet-300'
              : 'border-slate-700 text-slate-400 hover:border-violet-500/30 hover:text-violet-300'
          }`}
        >
          <ThumbsUp className="h-3 w-3" />
          {answer.helpfulCount} helpful
        </button>
      </div>
    </div>
  );
}

// ─── Post Detail ──────────────────────────────────────────────────────────────

function PostDetail({ postId, onBack }: { postId: string; onBack: () => void }) {
  const [answerBody, setAnswerBody] = useState('');
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['forum', 'post', postId],
    queryFn: () => forumApi.getPost(postId),
  });

  const answerMutation = useMutation({
    mutationFn: (body: string) => forumApi.createAnswer(postId, body),
    onSuccess: () => {
      setAnswerBody('');
      void queryClient.invalidateQueries({ queryKey: ['forum', 'post', postId] });
    },
  });

  const { post, answers = [] } = query.data ?? {};

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to forum
      </button>

      {query.isLoading ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : !post ? (
        <div className="text-sm text-slate-400">Post not found.</div>
      ) : (
        <>
          {/* Post */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {post.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                  {tag}
                </span>
              ))}
              {post.solved && (
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                  Solved
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-white mb-3">{post.title}</h1>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{post.body}</p>
            <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
              <span>{post.authorId?.displayName}</span>
              <RoleBadge role={post.authorRole} />
              <span>{fmt(post.createdAt)}</span>
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" /> {post.viewCount}
              </span>
            </div>
          </div>

          {/* Answers */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">{answers.length} Answer{answers.length !== 1 ? 's' : ''}</h2>
            {answers.map((a) => (
              <AnswerCard key={a._id} answer={a} myId={user?._id ?? ''} postId={postId} />
            ))}
          </div>

          {/* Submit answer */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white">Your Answer</h2>
            <p className="text-xs text-slate-500">
              Mentor answers earn +5 pts per helpful vote and +15 pts when marked as a verified solution.
            </p>
            <ResearchNote
              icon={Users}
              text="Communities of Practice: Answering questions drives Etienne Wenger's social learning model, where regular interaction and collaborative troubleshooting refine community expertise and build a shared repertoire of solutions."
            />
            <Textarea
              rows={5}
              value={answerBody}
              onChange={(e) => setAnswerBody(e.target.value)}
              placeholder="Write a clear, helpful answer…"
            />
            <button
              onClick={() => { if (answerBody.trim()) answerMutation.mutate(answerBody.trim()); }}
              disabled={answerMutation.isPending || !answerBody.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {answerMutation.isPending ? 'Posting…' : 'Post Answer'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── New Post Modal ────────────────────────────────────────────────────────────

function NewPostModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: forumApi.createPost,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum', 'posts'] });
      onCreated();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!title.trim() || !body.trim()) return setError('Title and body are required');
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
    mutation.mutate({ title: title.trim(), body: body.trim(), tags: tagList });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Ask a Question</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400 hover:text-white" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <div className="text-xs text-rose-400">{error}</div>}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How do I wire the sensor to Arduino?" required />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Body</label>
            <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Describe your question…" required />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tags (comma-separated)</label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="iot, arduino" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {mutation.isPending ? 'Posting…' : 'Post Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Forum List ───────────────────────────────────────────────────────────────

function ForumList({ onOpen }: { onOpen: (id: string) => void }) {
  const [filterSolved, setFilterSolved] = useState<boolean | undefined>(undefined);
  const [filterTag, setFilterTag] = useState('');
  const [showNew, setShowNew] = useState(false);

  const query = useQuery({
    queryKey: ['forum', 'posts', filterSolved, filterTag],
    queryFn: () =>
      forumApi.listPosts({
        ...(filterSolved !== undefined ? { solved: filterSolved } : {}),
        ...(filterTag ? { tag: filterTag } : {}),
      }),
  });

  return (
    <div className="space-y-5">
      {showNew && (
        <NewPostModal onClose={() => setShowNew(false)} onCreated={() => setShowNew(false)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Forum</h1>
          <p className="mt-1 text-sm text-slate-400">
            Ask questions, share expertise. Mentors earn +5 pts per helpful vote, +15 for verified solutions.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          <Plus className="h-4 w-4" />
          Ask
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
          placeholder="Filter by tag…"
          className="max-w-[180px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
        />
        {[
          { label: 'All', val: undefined },
          { label: 'Open', val: false },
          { label: 'Solved', val: true },
        ].map((opt) => (
          <button
            key={String(opt.label)}
            onClick={() => setFilterSolved(opt.val)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              filterSolved === opt.val
                ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Posts */}
      {query.isLoading ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : (query.data?.posts.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 py-12 text-center">
          <MessageSquare className="mx-auto mb-3 h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-400">No posts yet. Ask the first question!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {query.data!.posts.map((post) => (
            <PostCard key={post._id} post={post} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function MentorForum() {
  const [openPostId, setOpenPostId] = useState<string | null>(null);

  if (openPostId) {
    return (
      <div className="space-y-5">
        <Link
          to="/dashboard/mentor/score"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Mentor Score
        </Link>
        <PostDetail postId={openPostId} onBack={() => setOpenPostId(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        to="/dashboard/mentor/score"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Mentor Score
      </Link>
      <ForumList onOpen={(id) => setOpenPostId(id)} />
    </div>
  );
}
