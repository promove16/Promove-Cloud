import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Award, CheckCircle, Clock, FileText, Send, ShieldCheck } from 'lucide-react';
import { patentApi } from '../../api/patent.api';
import { workspaceApi } from '../../api/workspace.api';
import type { PatentFilingDocuments } from '../../types/patent.types';
import { DashboardLayout } from '../components/DashboardLayout';

const QUESTIONS = [
  { key: 'whatIsYourInnovation', label: 'What is your innovation? Describe it in simple terms.' },
  { key: 'noveltyExplanation', label: 'What makes it novel or unique? How is it different from existing solutions?' },
  { key: 'technicalDetails', label: 'Explain the technical details of how your innovation works.' },
  { key: 'marketUseCase', label: 'What is the real-world market use case for your innovation?' },
  { key: 'priorArtAwareness', label: 'Are you aware of any prior art or similar existing patents/products?' },
] as const;

const INVENTION_CATEGORIES: Array<{
  value: PatentFilingDocuments['inventionCategory'];
  label: string;
}> = [
  { value: 'mobile_app_backend', label: 'Mobile app with unique backend' },
  { value: 'iot_hardware_interface', label: 'IoT and hardware interface' },
  { value: 'mechanical_improvement', label: 'Mechanical improvement' },
  { value: 'software_hardware_integration', label: 'Software-hardware integration' },
  { value: 'other', label: 'Other invention type' },
];

const SPECIFICATION_TYPES: Array<{
  value: PatentFilingDocuments['specificationType'];
  label: string;
}> = [
  { value: 'provisional', label: 'Provisional specification' },
  { value: 'complete', label: 'Complete specification' },
];

const PROTOTYPE_STATUSES: Array<{
  value: PatentFilingDocuments['prototypeStatus'];
  label: string;
}> = [
  { value: 'concept_only', label: 'Concept only' },
  { value: 'partial_prototype', label: 'Partial prototype' },
  { value: 'working_prototype', label: 'Working prototype' },
  { value: 'validated_prototype', label: 'Validated prototype' },
];

const REQUIRED_DOC_ITEMS = [
  'Select at least one uploaded project document from your workspace before you submit.',
  'Complete the abstract, specification, and claims drafts so the review team can assess patentability.',
  'Confirm Form 1 and Form 5 readiness, plus disclosure safety, before filing support begins.',
  'Use Form 26 details when an attorney or agent will file on your behalf.',
];

type QuestionKey = (typeof QUESTIONS)[number]['key'];

const DEFAULT_ANSWERS: Record<QuestionKey, string> = {
  whatIsYourInnovation: '',
  noveltyExplanation: '',
  technicalDetails: '',
  marketUseCase: '',
  priorArtAwareness: '',
};

const DEFAULT_FILING_DOCUMENTS: PatentFilingDocuments = {
  inventionCategory: 'software_hardware_integration',
  specificationType: 'provisional',
  inventorJournalSummary: '',
  priorArtSearchSummary: '',
  prototypeStatus: 'concept_only',
  specificationDraft: '',
  abstractDraft: '',
  claimsDraft: '',
  drawingsPrepared: false,
  drawingsNotes: '',
  form1ApplicantDetailsConfirmed: false,
  form3ForeignFilingDetails: '',
  form5InventorshipConfirmed: false,
  form26PowerOfAttorneyRequired: false,
  form26PowerOfAttorneyDetails: '',
  examinationRequestPlan: '',
  publicDisclosureChecked: false,
  professionalSupportNeeded: false,
  costManagementNotes: '',
};

const fieldClassName =
  'w-full rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-white outline-none transition focus:border-cyan-400/60';

const textAreaClassName = `${fieldClassName} min-h-28`;

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function PatentSupport() {
  const queryClient = useQueryClient();
  const [workspaceId, setWorkspaceId] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [selectedUploadIds, setSelectedUploadIds] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<QuestionKey, string>>(DEFAULT_ANSWERS);
  const [filingDocuments, setFilingDocuments] = useState<PatentFilingDocuments>(DEFAULT_FILING_DOCUMENTS);

  const workspacesQuery = useQuery({ queryKey: ['workspaces'], queryFn: () => workspaceApi.list() });
  const patentsQuery = useQuery({ queryKey: ['patents', 'mine'], queryFn: () => patentApi.mine() });

  const selectedWorkspaceId = workspaceId || workspacesQuery.data?.[0]?._id || '';
  const activeWorkspace = useMemo(
    () => workspacesQuery.data?.find((item) => item._id === selectedWorkspaceId),
    [selectedWorkspaceId, workspacesQuery.data],
  );

  const workspaceDetailQuery = useQuery({
    queryKey: ['workspace', selectedWorkspaceId],
    queryFn: () => workspaceApi.getById(selectedWorkspaceId),
    enabled: Boolean(selectedWorkspaceId),
  });

  const availableUploads = workspaceDetailQuery.data?.uploads ?? activeWorkspace?.uploads ?? [];

  useEffect(() => {
    setSelectedUploadIds((current) =>
      current.filter((uploadId) => availableUploads.some((upload) => upload._id === uploadId)),
    );
  }, [availableUploads]);

  const submitPatent = useMutation({
    mutationFn: () =>
      patentApi.submit({
        projectTitle: projectTitle || activeWorkspace?.title || 'Untitled innovation',
        workspaceId: selectedWorkspaceId,
        supportingUploadIds: selectedUploadIds,
        questionnaire: answers,
        filingDocuments,
      }),
    onSuccess: async () => {
      setSubmitted(true);
      setError('');
      setAnswers(DEFAULT_ANSWERS);
      setFilingDocuments(DEFAULT_FILING_DOCUMENTS);
      setSelectedUploadIds([]);
      await queryClient.invalidateQueries({ queryKey: ['patents', 'mine'] });
      await queryClient.invalidateQueries({ queryKey: ['score', 'me'] });
    },
    onError: (mutationError) => {
      setError(
        (mutationError as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
          'Unable to submit your patent questionnaire right now.',
      );
    },
  });

  const allQuestionAnswersValid = Object.values(answers).every((value) => value.trim().length >= 50);
  const hasWorkspace = Boolean(selectedWorkspaceId);
  const hasSupportingDocuments = selectedUploadIds.length > 0;
  const canSubmit = hasWorkspace && hasSupportingDocuments && allQuestionAnswersValid && !submitPatent.isPending;

  const updateFilingDocument = <K extends keyof PatentFilingDocuments>(
    key: K,
    value: PatentFilingDocuments[K],
  ) => {
    setFilingDocuments((current) => ({ ...current, [key]: value }));
  };

  const toggleUpload = (uploadId: string) => {
    setSelectedUploadIds((current) =>
      current.includes(uploadId)
        ? current.filter((item) => item !== uploadId)
        : [...current, uploadId],
    );
  };

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-white">Patent Support System</h1>
            <p className="text-slate-400">
              Submit the questionnaire, filing notes, and essential project docs together so the admin patent review is complete in one pass.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
            Every questionnaire answer needs at least 50 characters, and at least one workspace document must be attached.
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          {REQUIRED_DOC_ITEMS.map((item) => (
            <div key={item} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-300">
              {item}
            </div>
          ))}
        </div>

        {submitted ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="mb-3 text-2xl font-bold text-white">Patent filing package submitted</h2>
            <p className="mx-auto max-w-2xl text-slate-300">
              Your patent support request now includes the questionnaire, filing declarations, and supporting project documents. The admin and IPR review team can pick it up without asking you for the basics again.
            </p>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6">
            <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
              <section className="space-y-6">
                <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5">
                  <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Project Setup</div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">Workspace</label>
                      <select
                        value={selectedWorkspaceId}
                        onChange={(event) => {
                          const nextId = event.target.value;
                          setWorkspaceId(nextId);
                          const nextWorkspace = workspacesQuery.data?.find((item) => item._id === nextId);
                          setProjectTitle(nextWorkspace?.title ?? '');
                          setSelectedUploadIds([]);
                          setSubmitted(false);
                        }}
                        className={fieldClassName}
                      >
                        {(workspacesQuery.data ?? []).map((workspace) => (
                          <option key={workspace._id} value={workspace._id}>
                            {workspace.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">Project title for filing</label>
                      <input
                        value={projectTitle || activeWorkspace?.title || ''}
                        onChange={(event) => setProjectTitle(event.target.value)}
                        className={fieldClassName}
                        placeholder="Patent-facing title"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5">
                  <div className="mb-2 text-xs uppercase tracking-[0.3em] text-cyan-300">Required Project Documents</div>
                  <p className="mb-4 text-sm text-slate-400">
                    Attach the essential proof already uploaded in your workspace. These become the supporting documents admins review with your filing notes.
                  </p>

                  {availableUploads.length === 0 ? (
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                      Upload PDFs or images in your project workspace first. Patent submission is locked until at least one supporting project document exists.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {availableUploads.map((upload) => {
                        const checked = selectedUploadIds.includes(upload._id);
                        return (
                          <label
                            key={upload._id}
                            className={`flex cursor-pointer items-start gap-4 rounded-2xl border px-4 py-4 transition ${
                              checked
                                ? 'border-cyan-400/60 bg-cyan-500/10'
                                : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleUpload(upload._id)}
                              className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-400"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-white">{upload.fileName}</span>
                                <span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">
                                  {upload.fileType}
                                </span>
                                <span className="text-xs text-slate-500">{formatFileSize(upload.fileSizeBytes)}</span>
                              </div>
                              {upload.note ? <div className="mt-2 text-sm text-slate-400">{upload.note}</div> : null}
                            </div>
                            <a
                              href={upload.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-medium text-cyan-300 hover:text-cyan-200"
                              onClick={(event) => event.stopPropagation()}
                            >
                              Open
                            </a>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5">
                  <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Patent Questionnaire</div>
                  <div className="space-y-5">
                    {QUESTIONS.map((question, index) => (
                      <div key={question.key}>
                        <label className="mb-2 block text-sm font-semibold text-white">
                          {index + 1}. {question.label}
                        </label>
                        <textarea
                          value={answers[question.key]}
                          onChange={(event) =>
                            setAnswers((current) => ({
                              ...current,
                              [question.key]: event.target.value,
                            }))
                          }
                          className={textAreaClassName}
                        />
                        <div
                          className={`mt-2 text-xs ${
                            answers[question.key].trim().length >= 50 ? 'text-green-400' : 'text-slate-500'
                          }`}
                        >
                          {answers[question.key].trim().length} / 50 characters
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5">
                  <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Filing Readiness</div>
                  <div className="grid gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">Invention category</label>
                      <select
                        value={filingDocuments.inventionCategory}
                        onChange={(event) =>
                          updateFilingDocument('inventionCategory', event.target.value as PatentFilingDocuments['inventionCategory'])
                        }
                        className={fieldClassName}
                      >
                        {INVENTION_CATEGORIES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-white">Specification type</label>
                        <select
                          value={filingDocuments.specificationType}
                          onChange={(event) =>
                            updateFilingDocument('specificationType', event.target.value as PatentFilingDocuments['specificationType'])
                          }
                          className={fieldClassName}
                        >
                          {SPECIFICATION_TYPES.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-white">Prototype status</label>
                        <select
                          value={filingDocuments.prototypeStatus}
                          onChange={(event) =>
                            updateFilingDocument('prototypeStatus', event.target.value as PatentFilingDocuments['prototypeStatus'])
                          }
                          className={fieldClassName}
                        >
                          {PROTOTYPE_STATUSES.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">Inventor journal or invention disclosure summary</label>
                      <textarea
                        value={filingDocuments.inventorJournalSummary}
                        onChange={(event) => updateFilingDocument('inventorJournalSummary', event.target.value)}
                        className={textAreaClassName}
                        placeholder="Capture dated notes, experiments, sketches, and witness support."
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">Prior art or patent search summary</label>
                      <textarea
                        value={filingDocuments.priorArtSearchSummary}
                        onChange={(event) => updateFilingDocument('priorArtSearchSummary', event.target.value)}
                        className={textAreaClassName}
                        placeholder="Summarize USPTO, WIPO, IPO, product, or literature comparisons."
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">Specification draft</label>
                      <textarea
                        value={filingDocuments.specificationDraft}
                        onChange={(event) => updateFilingDocument('specificationDraft', event.target.value)}
                        className={textAreaClassName}
                        placeholder="Describe background, working, components, and best method."
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">Abstract draft</label>
                      <textarea
                        value={filingDocuments.abstractDraft}
                        onChange={(event) => updateFilingDocument('abstractDraft', event.target.value)}
                        className={textAreaClassName}
                        placeholder="Keep this concise. A short technical summary is ideal."
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">Claims draft</label>
                      <textarea
                        value={filingDocuments.claimsDraft}
                        onChange={(event) => updateFilingDocument('claimsDraft', event.target.value)}
                        className={textAreaClassName}
                        placeholder="State the legal scope you want protected."
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">Drawings, block diagrams, or flowcharts notes</label>
                      <textarea
                        value={filingDocuments.drawingsNotes}
                        onChange={(event) => updateFilingDocument('drawingsNotes', event.target.value)}
                        className={textAreaClassName}
                        placeholder="Mention which diagrams are ready or still pending."
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">Examination request plan</label>
                      <textarea
                        value={filingDocuments.examinationRequestPlan}
                        onChange={(event) => updateFilingDocument('examinationRequestPlan', event.target.value)}
                        className={textAreaClassName}
                        placeholder="Explain when Form 18 or the equivalent examination request will be prepared."
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">Form 3 foreign filing details</label>
                      <textarea
                        value={filingDocuments.form3ForeignFilingDetails ?? ''}
                        onChange={(event) => updateFilingDocument('form3ForeignFilingDetails', event.target.value)}
                        className={textAreaClassName}
                        placeholder="Optional. Add foreign filing references if they exist."
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">Cost management notes</label>
                      <textarea
                        value={filingDocuments.costManagementNotes ?? ''}
                        onChange={(event) => updateFilingDocument('costManagementNotes', event.target.value)}
                        className={textAreaClassName}
                        placeholder="Optional. Mention budget plans, provisional-first strategy, or funding constraints."
                      />
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <div className="grid gap-3">
                        <label className="flex items-start gap-3 text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={filingDocuments.drawingsPrepared}
                            onChange={(event) => updateFilingDocument('drawingsPrepared', event.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-400"
                          />
                          Drawings or diagrams are already prepared for review.
                        </label>

                        <label className="flex items-start gap-3 text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={filingDocuments.form1ApplicantDetailsConfirmed}
                            onChange={(event) => updateFilingDocument('form1ApplicantDetailsConfirmed', event.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-400"
                          />
                          Form 1 applicant and inventor details are confirmed.
                        </label>

                        <label className="flex items-start gap-3 text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={filingDocuments.form5InventorshipConfirmed}
                            onChange={(event) => updateFilingDocument('form5InventorshipConfirmed', event.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-400"
                          />
                          Form 5 declaration of inventorship is confirmed.
                        </label>

                        <label className="flex items-start gap-3 text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={filingDocuments.form26PowerOfAttorneyRequired}
                            onChange={(event) => updateFilingDocument('form26PowerOfAttorneyRequired', event.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-400"
                          />
                          Form 26 power of attorney is required because an agent or attorney will be involved.
                        </label>

                        {filingDocuments.form26PowerOfAttorneyRequired ? (
                          <textarea
                            value={filingDocuments.form26PowerOfAttorneyDetails ?? ''}
                            onChange={(event) => updateFilingDocument('form26PowerOfAttorneyDetails', event.target.value)}
                            className={textAreaClassName}
                            placeholder="Add the attorney or agent details and filing intent."
                          />
                        ) : null}

                        <label className="flex items-start gap-3 text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={filingDocuments.publicDisclosureChecked}
                            onChange={(event) => updateFilingDocument('publicDisclosureChecked', event.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-400"
                          />
                          I have checked that the invention has not been publicly disclosed in a way that could harm filing rights.
                        </label>

                        <label className="flex items-start gap-3 text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={filingDocuments.professionalSupportNeeded}
                            onChange={(event) => updateFilingDocument('professionalSupportNeeded', event.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-400"
                          />
                          Professional patent attorney or agent support is needed.
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {error ? (
              <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-4 border-t border-slate-800 pt-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3 text-sm text-slate-400">
                <AlertCircle className="mt-0.5 h-4 w-4 text-cyan-300" />
                <div>
                  Patent support packages are reviewed only after the questionnaire, filing checklist, and attached workspace docs are all present.
                </div>
              </div>
              <button
                onClick={() => submitPatent.mutate()}
                disabled={!canSubmit}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Submit for Patent Review
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 lg:col-span-2">
            <h2 className="mb-4 text-xl font-bold text-white">Existing submissions</h2>
            <div className="space-y-3">
              {(patentsQuery.data ?? []).map((patent) => (
                <div
                  key={patent._id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4"
                >
                  <div>
                    <div className="font-semibold text-white">{patent.projectTitle}</div>
                    <div className="text-sm text-slate-400">
                      Submitted {new Date(patent.submittedAt).toLocaleDateString('en-IN')}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {(patent.supportingDocuments ?? []).length} supporting document
                      {(patent.supportingDocuments ?? []).length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      patent.status === 'approved'
                        ? 'bg-green-500/10 text-green-400'
                        : patent.status === 'rejected'
                          ? 'bg-red-500/10 text-red-400'
                          : patent.status === 'under_review'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-yellow-500/10 text-yellow-400'
                    }`}
                  >
                    {patent.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-yellow-800/30 bg-gradient-to-br from-yellow-900/20 to-orange-900/20 p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500">
                <Award className="h-6 w-6 text-white" />
              </div>
              <h3 className="mb-2 font-bold text-white">ProMove IPR Services</h3>
              <p className="mb-4 text-sm text-slate-400">Professional patent filing support included</p>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>Novelty and filing readiness review</li>
                <li>Prior-art positioning support</li>
                <li>Guidance for Forms 1, 3, 5, 18, and 26 readiness</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6">
              <h3 className="mb-4 font-bold text-white">Submission Flow</h3>
              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-blue-400" />
                  Questionnaire plus filing notes completed
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  Supporting workspace documents attached
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-purple-400" />
                  Admin and IPR review begins after submission
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  Status updates appear here automatically
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
