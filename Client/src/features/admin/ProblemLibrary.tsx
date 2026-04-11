import { FormEvent, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type AdminProblem, type AdminProblemPayload, adminApi } from '../../api/admin.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { PROBLEM_CATEGORIES, type Problem } from '../../types/problem.types';
import { getApiErrorMessage } from '../../utils/apiError';

const emptyForm: AdminProblemPayload = {
  title: '',
  description: '',
  category: 'Agriculture & AgriTech',
  difficulty: 'Medium',
  domain: '',
  tags: [],
  isVerified: true,
  targetBeneficiaries: [],
  deliverables: [],
  acceptanceCriteria: [],
  constraints: [],
  resourceLinks: [],
  publicationStatus: 'published',
};

const parseListField = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export default function ProblemLibrary() {
  const queryClient = useQueryClient();
  const [editingProblem, setEditingProblem] = useState<AdminProblem | null>(null);
  const [form, setForm] = useState<AdminProblemPayload>(emptyForm);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const formCardRef = useRef<HTMLDivElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const problemsQuery = useQuery({
    queryKey: ['admin-problems'],
    queryFn: adminApi.getProblems,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { problemId?: string; body: AdminProblemPayload }) =>
      payload.problemId
        ? adminApi.updateProblem(payload.problemId, payload.body)
        : adminApi.createProblem(payload.body),
    onSuccess: (_savedProblem, payload) => {
      setFeedback({
        tone: 'success',
        message: payload.problemId ? 'Problem updated successfully.' : 'Problem created successfully.',
      });
      setEditingProblem(null);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ['admin-problems'] });
    },
    onError: (error) => {
      setFeedback({
        tone: 'error',
        message: getApiErrorMessage(error, 'Unable to save the problem right now.'),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (problemId: string) => adminApi.deleteProblem(problemId),
    onSuccess: (_result, problemId) => {
      if (editingProblem?._id === problemId) {
        setEditingProblem(null);
        setForm(emptyForm);
      }
      setFeedback({
        tone: 'success',
        message: 'Problem deleted successfully.',
      });
      void queryClient.invalidateQueries({ queryKey: ['admin-problems'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-problem-review-requests'] });
    },
    onError: (error) => {
      setFeedback({
        tone: 'error',
        message: getApiErrorMessage(error, 'Unable to delete the problem right now.'),
      });
    },
  });

  const resetForm = () => {
    setEditingProblem(null);
    setForm(emptyForm);
  };

  const startEdit = (problem: AdminProblem) => {
    setFeedback(null);
    setEditingProblem(problem);
    setForm({
      title: problem.title,
      description: problem.description,
      category: problem.category,
      difficulty: problem.difficulty,
      domain: problem.domain,
      tags: problem.tags,
      isVerified: problem.isVerified,
      sponsorName: problem.sponsorName,
      geography: problem.geography,
      targetBeneficiaries: problem.targetBeneficiaries,
      impactGoal: problem.impactGoal,
      expectedOutcome: problem.expectedOutcome,
      deliverables: problem.deliverables,
      acceptanceCriteria: problem.acceptanceCriteria,
      constraints: problem.constraints,
      resourceLinks: problem.resourceLinks,
      securityNotice: problem.securityNotice,
      publicationStatus: problem.publicationStatus,
      submissionConfig: problem.submissionConfig,
    });
    requestAnimationFrame(() => {
      formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      titleInputRef.current?.focus();
    });
  };

  const canDeleteProblem = (problem: AdminProblem) =>
    problem.stats.activeTeamsCount === 0 &&
    (problem.stats.reviewRequestedCount ?? 0) === 0 &&
    problem.stats.approvedTeamsCount === 0;

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveMutation.mutate({
      problemId: editingProblem?._id,
      body: {
        ...form,
        tags: form.tags ?? [],
        targetBeneficiaries: form.targetBeneficiaries ?? [],
        deliverables: form.deliverables ?? [],
        acceptanceCriteria: form.acceptanceCriteria ?? [],
        constraints: form.constraints ?? [],
        resourceLinks: form.resourceLinks ?? [],
      },
    });
  };

  return (
    <div className="space-y-6">
      {feedback ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.tone === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/20 bg-rose-500/10 text-rose-200'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <div ref={formCardRef}>
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">
                {editingProblem ? 'Edit Problem' : 'Create Problem'}
              </div>
              <div className="mt-2 text-xl font-semibold text-white">
                {editingProblem ? editingProblem.title : 'New assignment'}
              </div>
            </div>
            {editingProblem ? (
              <Button variant="secondary" onClick={resetForm}>
                Cancel Edit
              </Button>
            ) : null}
          </div>

          <form className="grid gap-4 md:grid-cols-2" onSubmit={submitForm}>
            <input
              ref={titleInputRef}
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Title"
              className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            />
            <input
              value={form.domain}
              onChange={(event) => setForm((current) => ({ ...current, domain: event.target.value }))}
              placeholder="Domain"
              className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            />
            <select
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  category: event.target.value as Problem['category'],
                }))
              }
              className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            >
              {PROBLEM_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={form.difficulty}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  difficulty: event.target.value as Problem['difficulty'],
                }))
              }
              className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            >
              {['Easy', 'Medium', 'Hard'].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Description"
              className="min-h-[120px] rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white md:col-span-2"
            />
            <input
              value={(form.tags ?? []).join(', ')}
              onChange={(event) =>
                setForm((current) => ({ ...current, tags: parseListField(event.target.value) }))
              }
              placeholder="Tags, comma separated"
              className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            />
            <input
              value={(form.deliverables ?? []).join(', ')}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  deliverables: parseListField(event.target.value),
                }))
              }
              placeholder="Deliverables, comma separated"
              className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white"
            />
            <div className="md:col-span-2">
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : editingProblem ? 'Update Problem' : 'Create Problem'}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-4 text-xs uppercase tracking-[0.25em] text-cyan-300">Problems</div>
        {problemsQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-4">
            {(problemsQuery.data ?? []).map((problem) => (
              <div key={problem._id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-white">{problem.title}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {problem.category} / {problem.difficulty} / {problem.domain}
                    </div>
                    <div className="mt-3 text-sm text-slate-300">{problem.description}</div>
                    <div className="mt-3 text-xs text-slate-500">
                      Teams {problem.stats.activeTeamsCount} / pending reviews {problem.stats.reviewRequestedCount ?? 0} /
                      approved {problem.stats.approvedTeamsCount}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={() => startEdit(problem)}>
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      title={
                        canDeleteProblem(problem)
                          ? `Delete ${problem.title}`
                          : 'Problems with workspace or review activity cannot be deleted.'
                      }
                      onClick={() => {
                        if (!canDeleteProblem(problem)) {
                          setFeedback({
                            tone: 'error',
                            message: 'This problem already has workspace or review activity and cannot be deleted.',
                          });
                          return;
                        }
                        if (window.confirm(`Delete "${problem.title}"?`)) {
                          deleteMutation.mutate(problem._id);
                        }
                      }}
                      disabled={deleteMutation.isPending || !canDeleteProblem(problem)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                {!canDeleteProblem(problem) ? (
                  <div className="mt-3 text-xs text-amber-300">
                    Delete is disabled because this problem already has workspace or review activity.
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
