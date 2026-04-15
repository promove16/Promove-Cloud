import { FormEvent, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { type AdminProblem, type AdminProblemPayload, adminApi } from '../../api/admin.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { type ApiErrorResponse } from '../../types/auth.types';
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

const problemArrayFieldSchema = (
  maxItems: number,
  maxCharactersPerItem: number,
  fieldLabel: string,
) =>
  z
    .array(
      z
        .string()
        .trim()
        .min(1, `${fieldLabel} entries cannot be empty.`)
        .max(maxCharactersPerItem, `Each ${fieldLabel.toLowerCase()} entry must be ${maxCharactersPerItem} characters or fewer.`),
    )
    .max(maxItems, `Add no more than ${maxItems} ${fieldLabel.toLowerCase()} entries.`);

const problemFormSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters.').max(160, 'Title must be 160 characters or fewer.'),
  domain: z.string().trim().min(2, 'Domain must be at least 2 characters.').max(120, 'Domain must be 120 characters or fewer.'),
  description: z
    .string()
    .trim()
    .min(20, 'Description must be at least 20 characters.')
    .max(1200, 'Description must be 1200 characters or fewer.'),
  tags: problemArrayFieldSchema(12, 40, 'Tag'),
  deliverables: problemArrayFieldSchema(10, 200, 'Deliverable'),
});

type ProblemFormField = keyof z.infer<typeof problemFormSchema>;
type ProblemFormErrors = Partial<Record<ProblemFormField, string>>;

const editableProblemFields = new Set<ProblemFormField>(['title', 'domain', 'description', 'tags', 'deliverables']);

const mapProblemValidationIssues = (
  issues: Array<{ path?: string | number | Array<string | number>; message: string }>,
) =>
  issues.reduce<ProblemFormErrors>((errors, issue) => {
    const rawPath = Array.isArray(issue.path)
      ? issue.path[0]
      : typeof issue.path === 'string'
        ? issue.path.split('.')[0]
        : issue.path;

    if (typeof rawPath !== 'string' || !editableProblemFields.has(rawPath as ProblemFormField) || errors[rawPath as ProblemFormField]) {
      return errors;
    }

    errors[rawPath as ProblemFormField] = issue.message;
    return errors;
  }, {});

const getProblemFormFieldErrors = (error: unknown) => {
  if (!isAxiosError<ApiErrorResponse>(error)) {
    return {};
  }

  const details = error.response?.data?.error?.details;
  if (!details?.length) {
    return {};
  }

  return mapProblemValidationIssues(details);
};

const inputBaseClassName = 'w-full rounded-xl border bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none';
const inputDefaultClassName = `${inputBaseClassName} border-slate-800 focus:border-cyan-500`;
const inputErrorClassName = `${inputBaseClassName} border-rose-500/70 focus:border-rose-400`;
const fieldLabelClassName = 'mb-2 block text-sm font-medium text-slate-300';
const fieldErrorClassName = 'mt-2 text-xs text-rose-300';

export default function ProblemLibrary() {
  const queryClient = useQueryClient();
  const [editingProblem, setEditingProblem] = useState<AdminProblem | null>(null);
  const [form, setForm] = useState<AdminProblemPayload>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<ProblemFormErrors>({});
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
      setFieldErrors({});
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ['admin-problems'] });
    },
    onError: (error) => {
      const nextFieldErrors = getProblemFormFieldErrors(error);
      setFieldErrors(nextFieldErrors);
      setFeedback({
        tone: 'error',
        message:
          Object.keys(nextFieldErrors).length > 0
            ? 'Fix the highlighted fields before saving the problem.'
            : getApiErrorMessage(error, 'Unable to save the problem right now.'),
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
    setFieldErrors({});
    setFeedback(null);
    setForm(emptyForm);
  };

  const startEdit = (problem: AdminProblem) => {
    setFeedback(null);
    setFieldErrors({});
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

  const clearFieldError = (field: ProblemFormField) => {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const updateProblemField = <Field extends keyof AdminProblemPayload>(
    field: Field,
    value: AdminProblemPayload[Field],
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    if (editableProblemFields.has(field as ProblemFormField)) {
      clearFieldError(field as ProblemFormField);
    }
  };

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationResult = problemFormSchema.safeParse({
      title: form.title,
      domain: form.domain,
      description: form.description,
      tags: form.tags ?? [],
      deliverables: form.deliverables ?? [],
    });

    if (!validationResult.success) {
      setFieldErrors(mapProblemValidationIssues(validationResult.error.issues));
      setFeedback({
        tone: 'error',
        message: 'Fix the highlighted fields before saving the problem.',
      });
      return;
    }

    setFieldErrors({});
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

          <form className="grid gap-4 md:grid-cols-2" onSubmit={submitForm} noValidate>
            <div>
              <label htmlFor="problem-title" className={fieldLabelClassName}>
                Problem Title *
              </label>
              <input
                id="problem-title"
                ref={titleInputRef}
                value={form.title}
                onChange={(event) => updateProblemField('title', event.target.value)}
                placeholder="Enter a clear problem title"
                aria-invalid={Boolean(fieldErrors.title)}
                className={fieldErrors.title ? inputErrorClassName : inputDefaultClassName}
              />
              {fieldErrors.title ? <p className={fieldErrorClassName}>{fieldErrors.title}</p> : null}
            </div>

            <div>
              <label htmlFor="problem-domain" className={fieldLabelClassName}>
                Domain *
              </label>
              <input
                id="problem-domain"
                value={form.domain}
                onChange={(event) => updateProblemField('domain', event.target.value)}
                placeholder="Mobility, healthcare, fintech..."
                aria-invalid={Boolean(fieldErrors.domain)}
                className={fieldErrors.domain ? inputErrorClassName : inputDefaultClassName}
              />
              {fieldErrors.domain ? <p className={fieldErrorClassName}>{fieldErrors.domain}</p> : null}
            </div>

            <div>
              <label htmlFor="problem-category" className={fieldLabelClassName}>
                Category
              </label>
              <select
                id="problem-category"
                value={form.category}
                onChange={(event) => updateProblemField('category', event.target.value as Problem['category'])}
                className={inputDefaultClassName}
              >
                {PROBLEM_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="problem-difficulty" className={fieldLabelClassName}>
                Difficulty
              </label>
              <select
                id="problem-difficulty"
                value={form.difficulty}
                onChange={(event) => updateProblemField('difficulty', event.target.value as Problem['difficulty'])}
                className={inputDefaultClassName}
              >
                {['Easy', 'Medium', 'Hard'].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="problem-description" className={fieldLabelClassName}>
                Description *
              </label>
              <textarea
                id="problem-description"
                value={form.description}
                onChange={(event) => updateProblemField('description', event.target.value)}
                placeholder="Describe the problem statement, constraints, and intended outcome."
                aria-invalid={Boolean(fieldErrors.description)}
                className={`min-h-[120px] ${fieldErrors.description ? inputErrorClassName : inputDefaultClassName}`}
              />
              {fieldErrors.description ? (
                <p className={fieldErrorClassName}>{fieldErrors.description}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="problem-tags" className={fieldLabelClassName}>
                Tags
              </label>
              <input
                id="problem-tags"
                value={(form.tags ?? []).join(', ')}
                onChange={(event) => updateProblemField('tags', parseListField(event.target.value))}
                placeholder="Comma separated tags"
                aria-invalid={Boolean(fieldErrors.tags)}
                className={fieldErrors.tags ? inputErrorClassName : inputDefaultClassName}
              />
              {fieldErrors.tags ? <p className={fieldErrorClassName}>{fieldErrors.tags}</p> : null}
            </div>

            <div>
              <label htmlFor="problem-deliverables" className={fieldLabelClassName}>
                Deliverables
              </label>
              <input
                id="problem-deliverables"
                value={(form.deliverables ?? []).join(', ')}
                onChange={(event) => updateProblemField('deliverables', parseListField(event.target.value))}
                placeholder="Comma separated deliverables"
                aria-invalid={Boolean(fieldErrors.deliverables)}
                className={fieldErrors.deliverables ? inputErrorClassName : inputDefaultClassName}
              />
              {fieldErrors.deliverables ? (
                <p className={fieldErrorClassName}>{fieldErrors.deliverables}</p>
              ) : null}
            </div>

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
