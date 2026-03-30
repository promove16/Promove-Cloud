import { useRef, useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Award,
  CheckCircle,
  Clock,
  FileText,
  Files,
  ImageIcon,
  Send,
  ShieldCheck,
  Upload,
  X,
  Eye,
  Loader2,
} from 'lucide-react';
import { patentApi } from '../../api/patent.api';
import { workspaceApi } from '../../api/workspace.api';
import type {
  PatentDocumentCategory,
  PatentFilingDocuments,
  PatentSubmission,
} from '../../types/patent.types';
import { DashboardLayout } from '../components/DashboardLayout';

// ─── Constants ───────────────────────────────────────────────────────────────

const QUESTIONS = [
  { key: 'whatIsYourInnovation', label: 'What is your innovation? Describe it in simple terms.' },
  { key: 'noveltyExplanation', label: 'What makes it novel or unique? How is it different from existing solutions?' },
  { key: 'technicalDetails', label: 'Explain the technical details of how your innovation works.' },
  { key: 'marketUseCase', label: 'What is the real-world market use case for your innovation?' },
  { key: 'priorArtAwareness', label: 'Are you aware of any prior art or similar existing patents/products?' },
] as const;

const INVENTION_CATEGORIES: Array<{ value: PatentFilingDocuments['inventionCategory']; label: string }> = [
  { value: 'mobile_app_backend', label: 'Mobile app with unique backend' },
  { value: 'iot_hardware_interface', label: 'IoT and hardware interface' },
  { value: 'mechanical_improvement', label: 'Mechanical improvement' },
  { value: 'software_hardware_integration', label: 'Software-hardware integration' },
  { value: 'other', label: 'Other invention type' },
];

const SPECIFICATION_TYPES: Array<{ value: PatentFilingDocuments['specificationType']; label: string }> = [
  { value: 'provisional', label: 'Provisional specification' },
  { value: 'complete', label: 'Complete specification' },
];

const PROTOTYPE_STATUSES: Array<{ value: PatentFilingDocuments['prototypeStatus']; label: string }> = [
  { value: 'concept_only', label: 'Concept only' },
  { value: 'partial_prototype', label: 'Partial prototype' },
  { value: 'working_prototype', label: 'Working prototype' },
  { value: 'validated_prototype', label: 'Validated prototype' },
];

const GOVT_DOCS: Array<{
  category: PatentDocumentCategory;
  label: string;
  required: boolean;
  hint: string;
}> = [
  { category: 'prior_art_search', label: 'Prior art search', required: true, hint: 'USPTO, WIPO, IPO search result document' },
  { category: 'specification_draft', label: 'Specification draft', required: true, hint: 'Background, working principle, components, best method' },
  { category: 'abstract_draft', label: 'Abstract draft', required: true, hint: 'Concise technical summary — max 300 words' },
  { category: 'claims_draft', label: 'Claims draft', required: true, hint: 'Document defining the legal scope of protection' },
  { category: 'drawings_diagrams', label: 'Drawings, block diagrams, or flowcharts', required: false, hint: 'PDF or image of technical drawings' },
  { category: 'examination_request', label: 'Examination request plan', required: false, hint: 'Form 18 or equivalent examination request preparation' },
  { category: 'form3_foreign_filing', label: 'Form 3 foreign filing', required: false, hint: 'Required only if filing in foreign jurisdictions' },
  { category: 'cost_management', label: 'Cost management notes', required: false, hint: 'Budget plan, provisional-first strategy, funding notes' },
];

type QuestionKey = (typeof QUESTIONS)[number]['key'];

const DEFAULT_ANSWERS: Record<QuestionKey, string> = {
  whatIsYourInnovation: '',
  noveltyExplanation: '',
  technicalDetails: '',
  marketUseCase: '',
  priorArtAwareness: '',
};

const DEFAULT_FILING: PatentFilingDocuments = {
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatKey = (value: string) =>
  value.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();

const formatBoolean = (value: boolean) => (value ? 'Yes' : 'No');

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-green-500/10 text-green-400',
  rejected: 'bg-red-500/10 text-red-400',
  under_review: 'bg-blue-500/10 text-blue-400',
  submitted: 'bg-yellow-500/10 text-yellow-400',
};

const fieldCls =
  'w-full rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-white outline-none transition focus:border-cyan-400/60';
const textAreaCls = `${fieldCls} min-h-28`;

// ─── Upload slot state ────────────────────────────────────────────────────────

type SlotState = {
  uploadId: string | null;
  fileName: string | null;
  uploading: boolean;
  error: string;
};

// ─── Document preview modal (for student detail view) ────────────────────────

function DocsPreviewPane({
  documents,
}: {
  documents: PatentSubmission['supportingDocuments'];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-500">
        <Files className="mb-3 h-8 w-8 opacity-40" />
        <div className="text-sm">No documents attached.</div>
      </div>
    );
  }
  const active = documents[activeIndex];
  return (
    <div className="grid gap-4 lg:grid-cols-[200px,1fr]">
      <div className="flex flex-col gap-2">
        {documents.map((doc, i) => (
          <button
            key={`${doc.fileUrl}-${i}`}
            onClick={() => setActiveIndex(i)}
            className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left transition ${
              i === activeIndex
                ? 'border-cyan-500/50 bg-cyan-500/10 text-white'
                : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
            }`}
          >
            {doc.fileType === 'image' ? (
              <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
            ) : (
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
            )}
            <div className="min-w-0">
              <div className="truncate text-xs font-medium">{doc.fileName}</div>
              {doc.documentCategory && (
                <div className="mt-0.5 truncate text-[10px] uppercase tracking-wider text-slate-500">
                  {doc.documentCategory.replace(/_/g, ' ')}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
      <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-4 py-3">
          <div>
            <div className="font-semibold text-white">{active.fileName}</div>
            <div className="mt-0.5 text-xs uppercase tracking-wider text-slate-500">
              {active.fileType} · {formatFileSize(active.fileSizeBytes)}
            </div>
          </div>
          <a
            href={active.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 transition-colors"
          >
            Open
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-hidden p-3">
          {active.fileType === 'image' ? (
            <img
              src={active.fileUrl}
              alt={active.fileName}
              className="max-h-72 max-w-full rounded-xl object-contain"
            />
          ) : (
            <iframe
              src={active.fileUrl}
              title={active.fileName}
              className="h-72 w-full rounded-xl border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Student patent detail modal ─────────────────────────────────────────────

function PatentDetailModal({
  patent,
  onClose,
}: {
  patent: PatentSubmission;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm sm:p-6">
      <div className="mx-auto flex min-h-full w-full items-start justify-center">
        <div className="flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-6 max-h-[calc(100vh-2rem)]">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Patent Submission</div>
              <h3 className="mt-2 text-2xl font-bold text-white">{patent.projectTitle}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    STATUS_STYLES[patent.status] ?? STATUS_STYLES['submitted']
                  }`}
                >
                  {patent.status.replace(/_/g, ' ')}
                </span>
                <span className="text-sm text-slate-400">
                  Submitted {new Date(patent.submittedAt).toLocaleDateString('en-IN')}
                </span>
                {patent.scoreAwarded && (
                  <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
                    Score awarded
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-700 p-2 text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Admin notes if reviewed */}
          {patent.adminNotes && (
            <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-300">
              <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
                Admin notes
              </div>
              {patent.adminNotes}
            </div>
          )}

          <div className="mt-6 grid min-h-0 flex-1 gap-6 overflow-y-auto pr-1 lg:grid-cols-2">
            {/* Left: Questionnaire */}
            <section className="space-y-4">
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Questionnaire</div>
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
                {patent.questionnaire ? Object.entries(patent.questionnaire).map(([key, value], i, arr) => (
                  <div
                    key={key}
                    className={`px-5 py-4 ${i !== arr.length - 1 ? 'border-b border-slate-800' : ''}`}
                  >
                    <div className="mb-2 text-xs font-medium text-slate-500">{formatKey(key)}</div>
                    <div className="text-sm leading-7 text-white">{value as string}</div>
                  </div>
                )) : (
                  <div className="px-5 py-6 text-sm text-slate-500">No questionnaire data available.</div>
                )}
              </div>

              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Filing Checklist</div>
              {patent.filingDocuments ? (
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
                {[
                  ['Invention category', patent.filingDocuments.inventionCategory?.replace(/_/g, ' ') ?? '—'],
                  ['Specification type', patent.filingDocuments.specificationType ?? '—'],
                  ['Prototype status', patent.filingDocuments.prototypeStatus?.replace(/_/g, ' ') ?? '—'],
                  ['Inventor journal summary', patent.filingDocuments.inventorJournalSummary ?? '—'],
                  ['Prior art search summary', patent.filingDocuments.priorArtSearchSummary ?? '—'],
                  ['Specification draft', patent.filingDocuments.specificationDraft ?? '—'],
                  ['Abstract draft', patent.filingDocuments.abstractDraft ?? '—'],
                  ['Claims draft', patent.filingDocuments.claimsDraft ?? '—'],
                  ['Drawings prepared', formatBoolean(patent.filingDocuments.drawingsPrepared)],
                  ['Drawings notes', patent.filingDocuments.drawingsNotes ?? '—'],
                  ['Form 1 confirmed', formatBoolean(patent.filingDocuments.form1ApplicantDetailsConfirmed)],
                  ['Form 5 confirmed', formatBoolean(patent.filingDocuments.form5InventorshipConfirmed)],
                  ['Form 26 required', formatBoolean(patent.filingDocuments.form26PowerOfAttorneyRequired)],
                  ...(patent.filingDocuments.form26PowerOfAttorneyDetails
                    ? [['Form 26 details', patent.filingDocuments.form26PowerOfAttorneyDetails]]
                    : []),
                  ['Examination request plan', patent.filingDocuments.examinationRequestPlan ?? '—'],
                  ['Public disclosure checked', formatBoolean(patent.filingDocuments.publicDisclosureChecked)],
                  ['Professional support needed', formatBoolean(patent.filingDocuments.professionalSupportNeeded)],
                  ...(patent.filingDocuments.costManagementNotes
                    ? [['Cost management notes', patent.filingDocuments.costManagementNotes]]
                    : []),
                ].map(([label, value], i, arr) => (
                  <div
                    key={label}
                    className={`px-5 py-3 ${i !== arr.length - 1 ? 'border-b border-slate-800' : ''}`}
                  >
                    <div className="mb-1 text-xs font-medium text-slate-500">{label}</div>
                    <div className="text-sm text-white">{value}</div>
                  </div>
                ))}
              </div>
              ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 py-8 text-slate-500">
                <FileText className="mb-2 h-6 w-6 opacity-40" />
                <div className="text-sm">Filing checklist was not included with this submission.</div>
              </div>
              )}
            </section>

            {/* Right: Supporting documents */}
            <section className="space-y-4">
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                Supporting Documents ({(patent.supportingDocuments ?? []).length})
              </div>
              <DocsPreviewPane documents={patent.supportingDocuments ?? []} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function PatentSupport() {
  const queryClient = useQueryClient();
  const [workspaceId, setWorkspaceId] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const [categorySlots, setCategorySlots] = useState<Record<string, SlotState>>({});
  const [answers, setAnswers] = useState<Record<QuestionKey, string>>(DEFAULT_ANSWERS);
  const [filing, setFiling] = useState<PatentFilingDocuments>(DEFAULT_FILING);
  const [viewPatent, setViewPatent] = useState<PatentSubmission | null>(null);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const workspacesQuery = useQuery({ queryKey: ['workspaces'], queryFn: () => workspaceApi.list() });
  const patentsQuery = useQuery({ queryKey: ['patents', 'mine'], queryFn: () => patentApi.mine() });

  const selectedWorkspaceId = workspaceId || workspacesQuery.data?.[0]?._id || '';
  const activeWorkspace = useMemo(
    () => workspacesQuery.data?.find((w) => w._id === selectedWorkspaceId),
    [selectedWorkspaceId, workspacesQuery.data],
  );

  // Clear slots that were uploaded to a workspace that changed
  useEffect(() => {
    setCategorySlots({});
  }, [selectedWorkspaceId]);

  const updateFiling = <K extends keyof PatentFilingDocuments>(key: K, value: PatentFilingDocuments[K]) =>
    setFiling((prev) => ({ ...prev, [key]: value }));

  // ── File upload per category ────────────────────────────────────────────────

  const handleFileSelect = async (category: PatentDocumentCategory, file: File) => {
    if (!selectedWorkspaceId) return;
    setCategorySlots((prev) => ({
      ...prev,
      [category]: { uploadId: null, fileName: null, uploading: true, error: '' },
    }));
    try {
      const uploads = await workspaceApi.upload(
        selectedWorkspaceId,
        file,
        GOVT_DOCS.find((d) => d.category === category)?.label,
      );
      const newUpload = uploads[uploads.length - 1];
      setCategorySlots((prev) => ({
        ...prev,
        [category]: { uploadId: newUpload._id, fileName: newUpload.fileName, uploading: false, error: '' },
      }));
    } catch {
      setCategorySlots((prev) => ({
        ...prev,
        [category]: { uploadId: null, fileName: null, uploading: false, error: 'Upload failed. Try again.' },
      }));
    }
  };

  const clearSlot = (category: PatentDocumentCategory) => {
    setCategorySlots((prev) => {
      const next = { ...prev };
      delete next[category];
      return next;
    });
    if (fileInputRefs.current[category]) {
      fileInputRefs.current[category]!.value = '';
    }
  };

  // ── Derived values ──────────────────────────────────────────────────────────

  const documentUploads = useMemo(
    () =>
      GOVT_DOCS.filter((d) => categorySlots[d.category]?.uploadId).map((d) => ({
        uploadId: categorySlots[d.category]!.uploadId!,
        category: d.category,
      })),
    [categorySlots],
  );

  const allQuestionsValid = Object.values(answers).every((v) => v.trim().length >= 50);
  const hasAtLeastOneDoc = documentUploads.length >= 1;
  const requiredDocsUploaded = GOVT_DOCS.filter((d) => d.required).every(
    (d) => categorySlots[d.category]?.uploadId,
  );
  const anySlotUploading = Object.values(categorySlots).some((s) => s.uploading);

  const canSubmit =
    Boolean(selectedWorkspaceId) &&
    hasAtLeastOneDoc &&
    allQuestionsValid &&
    filing.form1ApplicantDetailsConfirmed &&
    filing.form5InventorshipConfirmed &&
    filing.publicDisclosureChecked &&
    !anySlotUploading &&
    filing.inventorJournalSummary.trim().length >= 50 &&
    filing.priorArtSearchSummary.trim().length >= 50 &&
    filing.specificationDraft.trim().length >= 80 &&
    filing.abstractDraft.trim().length >= 30 &&
    filing.claimsDraft.trim().length >= 50 &&
    filing.drawingsNotes.trim().length >= 20 &&
    filing.examinationRequestPlan.trim().length >= 30 &&
    (!filing.form26PowerOfAttorneyRequired || (filing.form26PowerOfAttorneyDetails?.trim().length ?? 0) > 0);

  // ── Submit ──────────────────────────────────────────────────────────────────

  const submitMutation = useMutation({
    mutationFn: () =>
      patentApi.submit({
        projectTitle: projectTitle || activeWorkspace?.title || 'Untitled innovation',
        workspaceId: selectedWorkspaceId,
        documentUploads,
        questionnaire: answers,
        filingDocuments: filing,
      }),
    onSuccess: async () => {
      setSubmitted(true);
      setFormError('');
      setAnswers(DEFAULT_ANSWERS);
      setFiling(DEFAULT_FILING);
      setCategorySlots({});
      await queryClient.invalidateQueries({ queryKey: ['patents', 'mine'] });
      await queryClient.invalidateQueries({ queryKey: ['score', 'me'] });
    },
    onError: (err) => {
      type ApiErr = {
        response?: {
          data?: {
            error?: {
              message?: string;
              details?: Array<{ path: string; message: string }>;
            };
          };
        };
      };
      const apiErr = (err as ApiErr)?.response?.data?.error;
      if (apiErr?.details?.length) {
        setFormError(apiErr.details.map((d) => `${d.path}: ${d.message}`).join(' · '));
      } else {
        setFormError(apiErr?.message ?? 'Unable to submit your patent questionnaire right now.');
      }
    },
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-white">Patent Support System</h1>
            <p className="text-slate-400">
              Upload your government filing documents, answer the questionnaire, and complete the checklist for admin review in one pass.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
            Upload the 4 required government documents and answer all 5 questionnaire fields to unlock submission.
          </div>
        </div>

        {submitted ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="mb-3 text-2xl font-bold text-white">Patent filing package submitted</h2>
            <p className="mx-auto max-w-2xl text-slate-300">
              Your patent support request now includes the uploaded government documents, questionnaire, and filing declarations. The admin and IPR review team can pick it up without asking you for the basics again.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── Project Setup ──────────────────────────────────────── */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5">
              <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Project Setup</div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">Workspace</label>
                  <select
                    value={selectedWorkspaceId}
                    onChange={(e) => {
                      setWorkspaceId(e.target.value);
                      setProjectTitle(
                        workspacesQuery.data?.find((w) => w._id === e.target.value)?.title ?? '',
                      );
                    }}
                    className={fieldCls}
                  >
                    {(workspacesQuery.data ?? []).map((w) => (
                      <option key={w._id} value={w._id}>
                        {w.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">Project title for filing</label>
                  <input
                    value={projectTitle || activeWorkspace?.title || ''}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    className={fieldCls}
                    placeholder="Patent-facing title"
                  />
                </div>
              </div>
            </div>

            {/* ── Government Filing Documents ───────────────────────── */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5">
              <div className="mb-1 text-xs uppercase tracking-[0.3em] text-cyan-300">Government Filing Documents</div>
              <p className="mb-5 text-sm text-slate-400">
                Upload each official document as a PDF or image. The 4 marked <span className="text-red-400">*</span> are required before submission.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {GOVT_DOCS.map(({ category, label, required, hint }) => {
                  const slot = categorySlots[category];
                  const hasUpload = Boolean(slot?.uploadId);
                  const isUploading = Boolean(slot?.uploading);
                  const slotError = slot?.error ?? '';
                  const isDisabled = !selectedWorkspaceId || isUploading;

                  return (
                    <div key={category} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="mb-1 flex items-center gap-1 text-sm font-semibold text-white">
                        {label}
                        {required && <span className="text-red-400">*</span>}
                      </div>
                      <p className="mb-3 text-xs text-slate-500">{hint}</p>

                      {hasUpload ? (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-cyan-400" />
                            <span className="truncate text-sm text-white">{slot!.fileName}</span>
                          </div>
                          <button
                            onClick={() => clearSlot(category)}
                            className="shrink-0 rounded-lg p-1 text-slate-400 hover:text-red-400 transition-colors"
                            title="Remove and re-upload"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label
                          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${
                            isDisabled
                              ? 'cursor-not-allowed border-slate-800 opacity-50'
                              : 'border-slate-700 hover:border-cyan-500/50 hover:bg-slate-950/40'
                          }`}
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
                              <span className="text-xs text-slate-400">Uploading…</span>
                            </>
                          ) : (
                            <>
                              <Upload className="h-5 w-5 text-slate-500" />
                              <span className="text-xs text-slate-400">
                                {!selectedWorkspaceId ? 'Select a workspace first' : 'Click to upload PDF or image'}
                              </span>
                            </>
                          )}
                          <input
                            ref={(el) => { fileInputRefs.current[category] = el; }}
                            type="file"
                            accept=".pdf,image/*"
                            className="sr-only"
                            disabled={isDisabled}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileSelect(category, file);
                            }}
                          />
                        </label>
                      )}

                      {slotError && (
                        <p className="mt-2 text-xs text-red-400">{slotError}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Upload progress summary */}
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm">
                <div className={`flex h-2 w-2 rounded-full ${requiredDocsUploaded ? 'bg-green-400' : 'bg-yellow-400'}`} />
                <span className="text-slate-300">
                  {GOVT_DOCS.filter((d) => categorySlots[d.category]?.uploadId).length} of {GOVT_DOCS.length} documents uploaded
                  {requiredDocsUploaded
                    ? ' — all required documents present'
                    : ` — ${GOVT_DOCS.filter((d) => d.required && !categorySlots[d.category]?.uploadId).length} required still missing`}
                </span>
              </div>
            </div>

            {/* ── Two-column: Questionnaire + Filing Readiness ──────── */}
            <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
              {/* Patent Questionnaire */}
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5">
                <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Patent Questionnaire</div>
                <div className="space-y-5">
                  {QUESTIONS.map((q, i) => (
                    <div key={q.key}>
                      <label className="mb-2 block text-sm font-semibold text-white">
                        {i + 1}. {q.label}
                      </label>
                      <textarea
                        value={answers[q.key]}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
                        className={textAreaCls}
                      />
                      <div
                        className={`mt-1.5 text-xs ${
                          answers[q.key].trim().length >= 50 ? 'text-green-400' : 'text-slate-500'
                        }`}
                      >
                        {answers[q.key].trim().length} / 50 minimum
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Filing Readiness */}
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5">
                <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Filing Readiness</div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white">Invention category</label>
                    <select
                      value={filing.inventionCategory}
                      onChange={(e) => updateFiling('inventionCategory', e.target.value as PatentFilingDocuments['inventionCategory'])}
                      className={fieldCls}
                    >
                      {INVENTION_CATEGORIES.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">Specification type</label>
                      <select
                        value={filing.specificationType}
                        onChange={(e) => updateFiling('specificationType', e.target.value as PatentFilingDocuments['specificationType'])}
                        className={fieldCls}
                      >
                        {SPECIFICATION_TYPES.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">Prototype status</label>
                      <select
                        value={filing.prototypeStatus}
                        onChange={(e) => updateFiling('prototypeStatus', e.target.value as PatentFilingDocuments['prototypeStatus'])}
                        className={fieldCls}
                      >
                        {PROTOTYPE_STATUSES.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white">
                      Inventor journal / disclosure summary <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={filing.inventorJournalSummary}
                      onChange={(e) => updateFiling('inventorJournalSummary', e.target.value)}
                      className={textAreaCls}
                      placeholder="Dated notes, experiments, sketches, witness support."
                    />
                    <div
                      className={`mt-1.5 text-xs ${
                        filing.inventorJournalSummary.trim().length >= 50 ? 'text-green-400' : 'text-slate-500'
                      }`}
                    >
                      {filing.inventorJournalSummary.trim().length} / 50 minimum
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white">
                      Prior art search summary <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={filing.priorArtSearchSummary}
                      onChange={(e) => updateFiling('priorArtSearchSummary', e.target.value)}
                      className={textAreaCls}
                      placeholder="Summarize prior art findings from USPTO, WIPO, or IPO searches."
                    />
                    <div className={`mt-1.5 text-xs ${filing.priorArtSearchSummary.trim().length >= 50 ? 'text-green-400' : 'text-slate-500'}`}>
                      {filing.priorArtSearchSummary.trim().length} / 50 minimum
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white">
                      Specification draft <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={filing.specificationDraft}
                      onChange={(e) => updateFiling('specificationDraft', e.target.value)}
                      className={textAreaCls}
                      placeholder="Background, working principle, components, and best method of implementation."
                    />
                    <div className={`mt-1.5 text-xs ${filing.specificationDraft.trim().length >= 80 ? 'text-green-400' : 'text-slate-500'}`}>
                      {filing.specificationDraft.trim().length} / 80 minimum
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white">
                      Abstract draft <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={filing.abstractDraft}
                      onChange={(e) => updateFiling('abstractDraft', e.target.value)}
                      className={textAreaCls}
                      placeholder="Concise technical summary of the invention — max 300 words."
                    />
                    <div className={`mt-1.5 text-xs ${filing.abstractDraft.trim().length >= 30 ? 'text-green-400' : 'text-slate-500'}`}>
                      {filing.abstractDraft.trim().length} / 30 minimum
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white">
                      Claims draft <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={filing.claimsDraft}
                      onChange={(e) => updateFiling('claimsDraft', e.target.value)}
                      className={textAreaCls}
                      placeholder="Define the legal scope and boundaries of patent protection."
                    />
                    <div className={`mt-1.5 text-xs ${filing.claimsDraft.trim().length >= 50 ? 'text-green-400' : 'text-slate-500'}`}>
                      {filing.claimsDraft.trim().length} / 50 minimum
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white">
                      Drawings / diagrams notes <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={filing.drawingsNotes}
                      onChange={(e) => updateFiling('drawingsNotes', e.target.value)}
                      className={textAreaCls}
                      placeholder="Describe technical drawings, block diagrams, or flowcharts included."
                    />
                    <div className={`mt-1.5 text-xs ${filing.drawingsNotes.trim().length >= 20 ? 'text-green-400' : 'text-slate-500'}`}>
                      {filing.drawingsNotes.trim().length} / 20 minimum
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white">
                      Examination request plan <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={filing.examinationRequestPlan}
                      onChange={(e) => updateFiling('examinationRequestPlan', e.target.value)}
                      className={textAreaCls}
                      placeholder="Describe your Form 18 request strategy and timeline."
                    />
                    <div className={`mt-1.5 text-xs ${filing.examinationRequestPlan.trim().length >= 30 ? 'text-green-400' : 'text-slate-500'}`}>
                      {filing.examinationRequestPlan.trim().length} / 30 minimum
                    </div>
                  </div>

                  {/* Declarations checklist */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                    {[
                      { key: 'drawingsPrepared', label: 'Drawings or diagrams are already prepared for review.' },
                      { key: 'form1ApplicantDetailsConfirmed', label: 'Form 1 applicant and inventor details are confirmed.' },
                      { key: 'form5InventorshipConfirmed', label: 'Form 5 declaration of inventorship is confirmed.' },
                      { key: 'form26PowerOfAttorneyRequired', label: 'Form 26 power of attorney required (agent or attorney involved).' },
                      { key: 'publicDisclosureChecked', label: 'Invention has not been publicly disclosed in a way that harms filing rights.' },
                      { key: 'professionalSupportNeeded', label: 'Professional patent attorney or agent support is needed.' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-start gap-3 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={Boolean(filing[key as keyof PatentFilingDocuments])}
                          onChange={(e) => updateFiling(key as keyof PatentFilingDocuments, e.target.checked as never)}
                          className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-400"
                        />
                        {label}
                      </label>
                    ))}

                    {filing.form26PowerOfAttorneyRequired && (
                      <textarea
                        value={filing.form26PowerOfAttorneyDetails ?? ''}
                        onChange={(e) => updateFiling('form26PowerOfAttorneyDetails', e.target.value)}
                        className={textAreaCls}
                        placeholder="Attorney or agent details and filing intent."
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Submit bar ─────────────────────────────────────────── */}
            {formError && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                {formError}
              </div>
            )}

            <div className="flex flex-col gap-4 border-t border-slate-800 pt-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3 text-sm text-slate-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                <div>
                  Patent support packages are reviewed only after the questionnaire, filing checklist, and government documents are all present.
                </div>
              </div>
              <button
                onClick={() => submitMutation.mutate()}
                disabled={!canSubmit || submitMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit for Patent Review
              </button>
            </div>
          </div>
        )}

        {/* ── Existing submissions ───────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 lg:col-span-2">
            <h2 className="mb-4 text-xl font-bold text-white">Existing submissions</h2>
            {(patentsQuery.data ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 py-10 text-slate-500">
                <FileText className="mb-3 h-8 w-8 opacity-40" />
                <div className="text-sm">No submissions yet.</div>
              </div>
            ) : (
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
                        {(patent.supportingDocuments ?? []).length} document
                        {(patent.supportingDocuments ?? []).length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          STATUS_STYLES[patent.status] ?? STATUS_STYLES['submitted']
                        }`}
                      >
                        {patent.status.replace(/_/g, ' ')}
                      </span>
                      <button
                        onClick={() => setViewPatent(patent)}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                <li>Guidance for Forms 1, 3, 5, 18, and 26</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6">
              <h3 className="mb-4 font-bold text-white">Submission Flow</h3>
              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center gap-3">
                  <Upload className="h-4 w-4 text-blue-400" />
                  Government documents uploaded per category
                </div>
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-cyan-400" />
                  Questionnaire and filing checklist completed
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-4 w-4 text-purple-400" />
                  Forms 1, 5, and disclosure confirmed
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-yellow-400" />
                  Admin and IPR review begins after submission
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  Status updates appear in submissions list
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Patent detail view modal */}
      {viewPatent && (
        <PatentDetailModal patent={viewPatent} onClose={() => setViewPatent(null)} />
      )}
    </DashboardLayout>
  );
}
