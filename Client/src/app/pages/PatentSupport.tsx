import { useRef, useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  CheckCircle,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Files,
  ImageIcon,
  Loader2,
  Send,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { patentApi } from '../../api/patent.api';
import { patentRequestApi } from '../../api/patentRequest.api';
import { startupApi } from '../../api/startup.api';
import { workspaceApi } from '../../api/workspace.api';
import { getStartupSectionPath, normalizeStartupRouteId } from '../../features/startup/navigation';
import type {
  PatentDocumentCategory,
  PatentFilingDocuments,
  PatentQuestionnaire,
  PatentSubmission,
} from '../../types/patent.types';
import type { PatentRequestSubmission } from '../../types/patentRequest.types';
import { DashboardLayout } from '../components/DashboardLayout';

// ─── Constants ───────────────────────────────────────────────────────────────

const PATENT_SUPPORT_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;

type PatentQuestionOption = {
  value: string;
  label: string;
};

type PatentQuestionConfig =
  | {
      key: keyof PatentQuestionnaire;
      label: string;
      minLength: number;
      type?: 'textarea';
      options?: never;
    }
  | {
      key: keyof PatentQuestionnaire;
      label: string;
      type: 'select';
      options: readonly PatentQuestionOption[];
      minLength?: never;
    };

type PatentQuestionSection = {
  title: string;
  questions: readonly PatentQuestionConfig[];
};

const DEVELOPMENT_STAGE_OPTIONS = [
  { value: 'idea', label: 'Idea' },
  { value: 'prototype', label: 'Prototype' },
  { value: 'mvp', label: 'MVP' },
  { value: 'market_ready', label: 'Market-ready' },
] as const;

const OWNERSHIP_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'team', label: 'Team' },
  { value: 'organization', label: 'Organization' },
] as const;

const COMMERCIALIZATION_OPTIONS = [
  { value: 'build_startup', label: 'Build startup' },
  { value: 'license', label: 'License' },
  { value: 'sell', label: 'Sell' },
  { value: 'partnership', label: 'Partnership' },
] as const;

const IP_PROTECTION_OPTIONS = [
  { value: 'patent', label: 'Patent' },
  { value: 'copyright', label: 'Copyright' },
  { value: 'trademark', label: 'Trademark' },
  { value: 'design', label: 'Design' },
] as const;

const QUESTION_SECTIONS: readonly PatentQuestionSection[] = [
  {
    title: 'Innovation & Problem Clarity',
    questions: [
      {
        key: 'problemStatement',
        label:
          'What problem does your innovation solve, and who are the primary users or stakeholders affected by this problem?',
        minLength: 40,
      },
      {
        key: 'solutionDifferentiation',
        label: 'How is your solution different from existing solutions currently available in the market?',
        minLength: 40,
      },
    ],
  },
  {
    title: 'Novelty & Uniqueness',
    questions: [
      {
        key: 'coreInnovation',
        label: 'What is the core unique feature or innovation in your solution?',
        minLength: 30,
      },
      {
        key: 'priorArtStatus',
        label:
          'Have you conducted any prior art search or reviewed similar patents? If yes, provide details or references. If not, say so clearly.',
        minLength: 20,
      },
    ],
  },
  {
    title: 'Technical Understanding',
    questions: [
      {
        key: 'workingMechanism',
        label: 'Explain the working mechanism or process flow of your innovation.',
        minLength: 40,
      },
      {
        key: 'keyComponents',
        label: 'What are the key components involved: hardware, software, process, or a combination?',
        minLength: 20,
      },
    ],
  },
  {
    title: 'Development Stage',
    questions: [
      {
        key: 'developmentStage',
        label: 'What is the current stage of your innovation?',
        type: 'select',
        options: DEVELOPMENT_STAGE_OPTIONS,
      },
      {
        key: 'documentationReadiness',
        label:
          'Do you have any prototypes, diagrams, or technical documentation ready? Mention what is available and upload supporting files if you have them.',
        minLength: 10,
      },
    ],
  },
  {
    title: 'Ownership & Rights',
    questions: [
      {
        key: 'inventorOwnership',
        label: 'Who are the inventors or creators of this innovation?',
        type: 'select',
        options: OWNERSHIP_OPTIONS,
      },
      {
        key: 'developmentContext',
        label:
          'Was this innovation developed independently or under any institution, company, or funded program?',
        minLength: 20,
      },
    ],
  },
  {
    title: 'Commercial Potential',
    questions: [
      {
        key: 'targetMarkets',
        label: 'Which industries or markets can this innovation be applied to?',
        minLength: 20,
      },
      {
        key: 'commercializationStrategy',
        label: 'What is your intended commercialization strategy?',
        type: 'select',
        options: COMMERCIALIZATION_OPTIONS,
      },
    ],
  },
  {
    title: 'Confidentiality & Disclosure',
    questions: [
      {
        key: 'publicDisclosureStatus',
        label:
          'Have you publicly disclosed this innovation anywhere such as pitch events, social media, competitions, or publications?',
        minLength: 10,
      },
      {
        key: 'legalAgreements',
        label: 'Are there any existing NDAs or legal agreements related to this innovation?',
        minLength: 10,
      },
    ],
  },
  {
    title: 'Strategic Intent',
    questions: [
      {
        key: 'ipProtectionType',
        label: 'What type of intellectual property protection are you seeking?',
        type: 'select',
        options: IP_PROTECTION_OPTIONS,
      },
    ],
  },
] as const;

const QUESTION_LABELS = Object.fromEntries(
  QUESTION_SECTIONS.flatMap((section) => section.questions.map((question) => [question.key, question.label])),
) as Record<string, string>;

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
  { category: 'design_plan_sketch', label: 'Design, plan, or pen-paper sketch', required: false, hint: 'Recommended for rough concepts, paper sketches, hand-drawn plans, or lightweight images' },
  { category: 'prior_art_search', label: 'Prior art search', required: false, hint: 'Search notes, patent references, or prior-art report' },
  { category: 'specification_draft', label: 'Specification draft', required: false, hint: 'Background, working principle, components, or best method draft' },
  { category: 'abstract_draft', label: 'Abstract draft', required: false, hint: 'Short technical summary or invention overview' },
  { category: 'claims_draft', label: 'Claims draft', required: false, hint: 'Draft claims or early scope definition, if available' },
  { category: 'drawings_diagrams', label: 'Drawings, block diagrams, or flowcharts', required: false, hint: 'PDF or image of technical drawings' },
  { category: 'examination_request', label: 'Examination request plan', required: false, hint: 'Form 18 or equivalent examination request preparation' },
  { category: 'form3_foreign_filing', label: 'Form 3 foreign filing', required: false, hint: 'Required only if filing in foreign jurisdictions' },
  { category: 'cost_management', label: 'Cost management notes', required: false, hint: 'Budget plan, provisional-first strategy, funding notes' },
];

type QuestionKey = keyof PatentQuestionnaire;

const DEFAULT_ANSWERS: PatentQuestionnaire = {
  problemStatement: '',
  solutionDifferentiation: '',
  coreInnovation: '',
  priorArtStatus: '',
  workingMechanism: '',
  keyComponents: '',
  developmentStage: '',
  documentationReadiness: '',
  inventorOwnership: '',
  developmentContext: '',
  targetMarkets: '',
  commercializationStrategy: '',
  publicDisclosureStatus: '',
  legalAgreements: '',
  ipProtectionType: '',
};

const getPatentAnswersFromStartupProfile = (profile?: Partial<PatentQuestionnaire>): PatentQuestionnaire => ({
  ...DEFAULT_ANSWERS,
  ...(profile ?? {}),
});

const hasAnyPatentAnswer = (answers: Record<QuestionKey, string>) =>
  Object.values(answers).some((value) => value.trim().length > 0);

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

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString('en-IN') : 'Not recorded';

const formatKey = (value: string) =>
  value.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();

const formatQuestionValue = (key: string, value: string) => {
  if (!value) return value;
  if (key === 'developmentStage') return DEVELOPMENT_STAGE_OPTIONS.find((option) => option.value === value)?.label ?? value;
  if (key === 'inventorOwnership') return OWNERSHIP_OPTIONS.find((option) => option.value === value)?.label ?? value;
  if (key === 'commercializationStrategy') return COMMERCIALIZATION_OPTIONS.find((option) => option.value === value)?.label ?? value;
  if (key === 'ipProtectionType') return IP_PROTECTION_OPTIONS.find((option) => option.value === value)?.label ?? value;
  return value;
};

const formatBoolean = (value: boolean) => (value ? 'Yes' : 'No');

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-green-500/10 text-green-300',
  rejected: 'bg-red-500/10 text-red-300',
  under_review: 'bg-cyan-500/10 text-cyan-300',
  submitted: 'bg-yellow-500/10 text-yellow-300',
  documents_review: 'bg-cyan-500/10 text-cyan-300',
  filing_in_progress: 'bg-blue-500/10 text-blue-300',
  filed_with_ipo: 'bg-indigo-500/10 text-indigo-300',
  examination_requested: 'bg-purple-500/10 text-purple-300',
  granted: 'bg-green-500/10 text-green-300',
  draft: 'bg-slate-700/60 text-slate-300',
};

const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  form1_application: 'Form 1 application',
  form2_specification: 'Form 2 specification',
  form3_foreign_filing: 'Form 3 foreign filing',
  form5_inventorship: 'Form 5 inventorship',
  form26_power_of_attorney: 'Form 26 power of attorney',
  form28_startup_status: 'Form 28 startup status',
  drawings: 'Drawings',
  prior_art_report: 'Prior art report',
  assignment_deed: 'Assignment deed',
  priority_document: 'Priority document',
  other: 'Other',
};

const fieldCls =
  'w-full rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-2.5 text-white outline-none transition focus:border-cyan-400/60';
const textAreaCls = `${fieldCls} min-h-20`;

// ─── Upload slot state ────────────────────────────────────────────────────────

type SlotState = {
  uploadId: string | null;
  fileName: string | null;
  uploading: boolean;
  error: string;
  workspaceId: string | null;
};

const createEmptySlotState = (workspaceId: string | null = null): SlotState => ({
  uploadId: null,
  fileName: null,
  uploading: false,
  error: '',
  workspaceId,
});

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
                    <div className="mb-2 text-xs font-medium text-slate-500">{QUESTION_LABELS[key] ?? formatKey(key)}</div>
                    <div className="text-sm leading-7 text-white">{formatQuestionValue(key, value as string)}</div>
                  </div>
                )) : (
                  <div className="px-5 py-6 text-sm text-slate-500">No questionnaire data available.</div>
                )}
              </div>

              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Legacy Filing Checklist</div>
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
                <div className="text-sm">No legacy filing checklist was included with this submission.</div>
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

function StartupPatentRequestOverview({
  requests,
  latestSubmission,
  isLoading,
}: {
  requests: PatentRequestSubmission[];
  latestSubmission?: PatentSubmission;
  isLoading: boolean;
}) {
  const latestRequest = requests[0];
  const status = latestRequest?.status ?? latestSubmission?.status;
  const documents = latestRequest?.documents ?? latestSubmission?.supportingDocuments ?? [];
  const title = latestRequest?.inventionTitle ?? latestSubmission?.projectTitle;
  const submittedAt = latestRequest?.submittedAt ?? latestSubmission?.submittedAt;
  const adminNotes = latestRequest?.adminNotes ?? latestSubmission?.adminNotes;
  const scoreAwarded = latestRequest?.scoreAwarded ?? latestSubmission?.scoreAwarded ?? false;
  const requestType = latestRequest ? 'Assisted filing request' : latestSubmission ? 'Patent intake submission' : 'Patent request';

  if (isLoading) {
    return (
      <section className="grid gap-4 border-b border-slate-800 pb-5 lg:grid-cols-3">
        {['Patent Request', 'Review', 'Uploaded Data'].map((label) => (
          <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</div>
            <div className="mt-4 h-5 w-2/3 rounded bg-slate-800" />
            <div className="mt-3 h-4 w-full rounded bg-slate-800/70" />
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="grid gap-4 border-b border-slate-800 pb-5 lg:grid-cols-3">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">Patent Request</div>
        <h2 className="mt-3 text-lg font-semibold text-white">{title ?? 'No patent request submitted'}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {status ? (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[status] ?? STATUS_STYLES.submitted}`}>
              {status.replace(/_/g, ' ')}
            </span>
          ) : (
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
              Not started
            </span>
          )}
          <span className="text-xs text-slate-500">{requestType}</span>
        </div>
        <div className="mt-4 text-sm text-slate-400">
          Submitted {formatDate(submittedAt)}
        </div>
        {latestRequest ? (
          <div className="mt-2 text-sm text-slate-400">
            {formatKey(latestRequest.inventionCategory)} / {latestRequest.specificationType}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">Review</div>
        <h2 className="mt-3 text-lg font-semibold text-white">
          {adminNotes ? 'Reviewer notes available' : status ? 'Review in progress' : 'Awaiting request'}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          {adminNotes ?? 'Admin and IPR review details will appear here after the filing team updates the request.'}
        </p>
        <div className="mt-4 grid gap-2 text-sm text-slate-400">
          <div className="flex items-center justify-between gap-3">
            <span>Score award</span>
            <span className="font-semibold text-white">{scoreAwarded ? 'Awarded' : 'Pending'}</span>
          </div>
          {latestRequest?.ipoApplicationNumber ? (
            <div className="flex items-center justify-between gap-3">
              <span>IPO application</span>
              <span className="font-semibold text-white">{latestRequest.ipoApplicationNumber}</span>
            </div>
          ) : null}
          {latestRequest?.ipoFilingDate ? (
            <div className="flex items-center justify-between gap-3">
              <span>IPO filing date</span>
              <span className="font-semibold text-white">{formatDate(latestRequest.ipoFilingDate)}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">Uploaded Data</div>
        <h2 className="mt-3 text-lg font-semibold text-white">
          {documents.length} file{documents.length === 1 ? '' : 's'} attached
        </h2>
        {documents.length > 0 ? (
          <div className="mt-4 space-y-2">
            {documents.slice(0, 4).map((document, index) => (
              <a
                key={`${document.fileUrl}-${index}`}
                href={document.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 transition hover:border-cyan-500/40"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">{document.fileName}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500">
                    {DOCUMENT_CATEGORY_LABELS[document.documentCategory ?? ''] ??
                      formatKey(document.documentCategory ?? 'Supporting document')}{' '}
                    / {formatFileSize(document.fileSizeBytes)}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-cyan-300">Open</span>
              </a>
            ))}
            {documents.length > 4 ? (
              <div className="text-xs text-slate-500">+{documents.length - 4} more files in the submission detail.</div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Uploaded sketches, drafts, prior-art notes, and specification files will appear here after submission.
          </p>
        )}
      </div>
    </section>
  );
}

export function PatentSupport() {
  const { innovationId, startupId: routeStartupId } = useParams<{
    innovationId?: string;
    startupId?: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startupId = normalizeStartupRouteId(routeStartupId);
  const isStartupScoped = Boolean(startupId);
  const [workspaceId, setWorkspaceId] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const [categorySlots, setCategorySlots] = useState<Record<string, SlotState>>({});
  const [answers, setAnswers] = useState<Record<QuestionKey, string>>(DEFAULT_ANSWERS);
  const [filing, setFiling] = useState<PatentFilingDocuments>(DEFAULT_FILING);
  const [viewPatent, setViewPatent] = useState<PatentSubmission | null>(null);
  const [showFilingReadiness, setShowFilingReadiness] = useState(false);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const categorySlotsRef = useRef(categorySlots);
  const selectedWorkspaceIdRef = useRef('');

  const [showcaseError, setShowcaseError] = useState('');

  const workspacesQuery = useQuery({ queryKey: ['workspaces'], queryFn: () => workspaceApi.list() });
  const patentsQuery = useQuery({ queryKey: ['patents', 'mine'], queryFn: () => patentApi.mine() });
  const patentRequestsQuery = useQuery({
    queryKey: ['patent-requests', 'mine'],
    queryFn: () => patentRequestApi.mine(),
    enabled: isStartupScoped,
  });
  const startupQuery = useQuery({
    queryKey: ['startup', startupId],
    queryFn: () => startupApi.getById(startupId!),
    enabled: isStartupScoped,
  });
  const startup = startupQuery.data;
  const startupWorkspaceId = startup?.projectId ?? '';
  const patentEligibleWorkspaces = useMemo(
    () => (workspacesQuery.data ?? []).filter((workspace) => !workspace.claimedProblemId),
    [workspacesQuery.data],
  );

  const showcaseMutation = useMutation({
    mutationFn: (patentId: string) => patentApi.toggleShowcase(patentId),
    onSuccess: async () => {
      setShowcaseError('');
      await queryClient.invalidateQueries({ queryKey: ['patents', 'mine'] });
    },
    onError: (err: unknown) => {
      type ApiErr = { response?: { data?: { error?: { message?: string } } } };
      const msg = (err as ApiErr)?.response?.data?.error?.message ?? 'Unable to update showcase status.';
      setShowcaseError(msg);
    },
  });

  const preferredWorkspaceId = isStartupScoped ? startupWorkspaceId : workspaceId || innovationId || '';
  const selectedWorkspaceId = isStartupScoped
    ? patentEligibleWorkspaces.find((workspace) => workspace._id === startupWorkspaceId)?._id ?? ''
    : patentEligibleWorkspaces.find((workspace) => workspace._id === preferredWorkspaceId)?._id ??
      patentEligibleWorkspaces[0]?._id ??
      '';
  const activeWorkspace = useMemo(
    () => patentEligibleWorkspaces.find((workspace) => workspace._id === selectedWorkspaceId),
    [patentEligibleWorkspaces, selectedWorkspaceId],
  );
  const hasPatentEligibleWorkspaces = isStartupScoped ? Boolean(activeWorkspace) : patentEligibleWorkspaces.length > 0;
  const scopedStartupTitle = startup?.name?.trim() || activeWorkspace?.title || 'this startup';
  const visiblePatents = useMemo(() => {
    const patents = patentsQuery.data ?? [];
    if (!isStartupScoped) {
      return patents;
    }
    if (!selectedWorkspaceId) {
      return [];
    }
    return patents.filter((patent) => patent.workspaceId === selectedWorkspaceId);
  }, [isStartupScoped, patentsQuery.data, selectedWorkspaceId]);
  const visiblePatentRequests = useMemo(() => {
    const requests = patentRequestsQuery.data ?? [];
    if (!isStartupScoped) {
      return requests;
    }
    if (!selectedWorkspaceId) {
      return [];
    }
    return requests.filter((request) => request.workspaceId === selectedWorkspaceId);
  }, [isStartupScoped, patentRequestsQuery.data, selectedWorkspaceId]);

  useEffect(() => {
    if (isStartupScoped) {
      if (workspaceId) {
        setWorkspaceId('');
      }
      return;
    }

    if (!patentEligibleWorkspaces.length) {
      if (workspaceId) {
        setWorkspaceId('');
      }
      return;
    }

    if (!preferredWorkspaceId) {
      setWorkspaceId(patentEligibleWorkspaces[0]._id);
      return;
    }

    const match = patentEligibleWorkspaces.find((item) => item._id === preferredWorkspaceId);
    if (!match) {
      setWorkspaceId(patentEligibleWorkspaces[0]._id);
    }
  }, [isStartupScoped, patentEligibleWorkspaces, preferredWorkspaceId, workspaceId]);

  useEffect(() => {
    if (!isStartupScoped || !startup) {
      return;
    }

    setProjectTitle((current) => current || startup.name || '');
    setAnswers((current) => {
      if (hasAnyPatentAnswer(current)) {
        return current;
      }
      return getPatentAnswersFromStartupProfile(startup.registrationProfile);
    });
  }, [isStartupScoped, startup]);

  useEffect(() => {
    categorySlotsRef.current = categorySlots;
  }, [categorySlots]);

  useEffect(() => {
    const previousWorkspaceId = selectedWorkspaceIdRef.current;
    if (previousWorkspaceId && previousWorkspaceId !== selectedWorkspaceId) {
      const uploadsToCleanup = Object.values(categorySlotsRef.current).filter(
        (slot): slot is SlotState & { uploadId: string; workspaceId: string } =>
          Boolean(slot.uploadId && slot.workspaceId === previousWorkspaceId),
      );

      if (uploadsToCleanup.length > 0) {
        void Promise.allSettled(
          uploadsToCleanup.map((slot) => workspaceApi.removeUpload(previousWorkspaceId, slot.uploadId)),
        );
      }

      setCategorySlots((current) => {
        const next = { ...current };
        for (const [slotKey, slot] of Object.entries(next)) {
          if (slot.workspaceId === previousWorkspaceId) {
            delete next[slotKey];
          }
        }
        return next;
      });
    }

    selectedWorkspaceIdRef.current = selectedWorkspaceId;
  }, [selectedWorkspaceId]);

  useEffect(
    () => () => {
      const currentWorkspaceId = selectedWorkspaceIdRef.current;
      if (!currentWorkspaceId) {
        return;
      }

      const uploadsToCleanup = Object.values(categorySlotsRef.current).filter(
        (slot): slot is SlotState & { uploadId: string; workspaceId: string } =>
          Boolean(slot.uploadId && slot.workspaceId === currentWorkspaceId),
      );

      if (uploadsToCleanup.length === 0) {
        return;
      }

      void Promise.allSettled(
        uploadsToCleanup.map((slot) => workspaceApi.removeUpload(currentWorkspaceId, slot.uploadId)),
      );
    },
    [],
  );

  // ── File upload per category ────────────────────────────────────────────────

  const updateFiling = <K extends keyof PatentFilingDocuments>(key: K, value: PatentFilingDocuments[K]) =>
    setFiling((prev) => ({ ...prev, [key]: value }));

  const handleFileSelect = async (category: PatentDocumentCategory, file: File) => {
    const targetWorkspaceId = selectedWorkspaceIdRef.current;
    if (!targetWorkspaceId) return;

    if (file.size > PATENT_SUPPORT_UPLOAD_MAX_BYTES) {
      setCategorySlots((prev) => ({
        ...prev,
        [category]: {
          ...createEmptySlotState(targetWorkspaceId),
          error: `File must be ${formatFileSize(PATENT_SUPPORT_UPLOAD_MAX_BYTES)} or less.`,
        },
      }));
      if (fileInputRefs.current[category]) {
        fileInputRefs.current[category]!.value = '';
      }
      return;
    }

    const existingSlot = categorySlotsRef.current[category];
    if (existingSlot?.uploadId && existingSlot.workspaceId) {
      try {
        await workspaceApi.removeUpload(existingSlot.workspaceId, existingSlot.uploadId);
      } catch (_error) {
        setCategorySlots((prev) => ({
          ...prev,
          [category]: {
            ...(prev[category] ?? createEmptySlotState(existingSlot.workspaceId)),
            uploading: false,
            error: 'Unable to remove the previous upload. Please try again.',
          },
        }));
        return;
      }
    }

    setCategorySlots((prev) => ({
      ...prev,
      [category]: {
        uploadId: null,
        fileName: null,
        uploading: true,
        error: '',
        workspaceId: targetWorkspaceId,
      },
    }));
    try {
      const uploads = await workspaceApi.upload(
        targetWorkspaceId,
        file,
        GOVT_DOCS.find((d) => d.category === category)?.label,
      );
      const newUpload = uploads[uploads.length - 1];
      if (selectedWorkspaceIdRef.current !== targetWorkspaceId) {
        await workspaceApi.removeUpload(targetWorkspaceId, newUpload._id).catch(() => undefined);
        return;
      }
      setCategorySlots((prev) => ({
        ...prev,
        [category]: {
          uploadId: newUpload._id,
          fileName: newUpload.fileName,
          uploading: false,
          error: '',
          workspaceId: targetWorkspaceId,
        },
      }));
    } catch (error) {
      const apiMessage =
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        'Upload failed. Try again.';
      setCategorySlots((prev) => ({
        ...prev,
        [category]: { ...createEmptySlotState(targetWorkspaceId), error: apiMessage },
      }));
    }
  };

  const clearSlot = async (category: PatentDocumentCategory) => {
    const slot = categorySlotsRef.current[category];

    if (slot?.uploadId && slot.workspaceId) {
      try {
        await workspaceApi.removeUpload(slot.workspaceId, slot.uploadId);
      } catch (_error) {
        setCategorySlots((prev) => ({
          ...prev,
          [category]: {
            ...(prev[category] ?? createEmptySlotState(slot.workspaceId)),
            uploading: false,
            error: 'Unable to remove the uploaded file. Please try again.',
          },
        }));
        return;
      }
    }

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
  const uploadedSupportCount = documentUploads.length;
  const requiredDocsUploaded = uploadedSupportCount > 0;

  const allQuestionsValid = QUESTION_SECTIONS.every((section) =>
    section.questions.every((question) => {
      const value = answers[question.key].trim();
      if (question.type === 'select') {
        return value.length > 0;
      }
      return value.length >= question.minLength;
    }),
  );
  const anySlotUploading = Object.values(categorySlots).some((s) => s.uploading);

  const canSubmit =
    Boolean(selectedWorkspaceId) &&
    allQuestionsValid &&
    !anySlotUploading;

  // ── Submit ──────────────────────────────────────────────────────────────────

  const submitMutation = useMutation({
    mutationFn: () =>
      patentApi.submit({
        projectTitle: projectTitle || startup?.name || activeWorkspace?.title || 'Untitled innovation',
        workspaceId: selectedWorkspaceId,
        documentUploads,
        questionnaire: answers,
      }),
    onSuccess: async () => {
      setSubmitted(true);
      setFormError('');
      setAnswers(DEFAULT_ANSWERS);
      setCategorySlots({});
      await queryClient.invalidateQueries({ queryKey: ['patents', 'mine'] });
      await queryClient.invalidateQueries({ queryKey: ['patent-requests', 'mine'] });
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
        setFormError(apiErr?.message ?? 'Unable to submit your patent intake request right now.');
      }
    },
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  const pageContent = (
    <>
      <div className="space-y-5">
        {/* Page header */}
        <div className="border-b border-slate-800 pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="max-w-4xl">
              <div className="mb-2 text-xs uppercase tracking-[0.28em] text-cyan-300">
                {isStartupScoped ? 'Startup Patent Support' : 'Student Patent Support'}
              </div>
              <h1 className="text-2xl font-semibold text-white">IPR / Patent Intake Request</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {isStartupScoped
                  ? `This patent request is attached to ${scopedStartupTitle}. Answer the admin intake questions and attach supporting files from the startup's linked workspace for IPR review.`
                  : 'Choose your own product workspace, answer the admin intake questions, and attach light supporting files for IPR review. ProMove problem-bank workspaces are for leaderboard points and are not eligible for patent filing.'}
              </p>
            </div>
            <div className="text-sm text-slate-400 md:max-w-sm md:text-right">
              Self-created products only. Optional uploads can be up to {formatFileSize(PATENT_SUPPORT_UPLOAD_MAX_BYTES)} each.
            </div>
          </div>
        </div>

        {!hasPatentEligibleWorkspaces && !workspacesQuery.isLoading && !startupQuery.isLoading ? (
          <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/60 p-8 text-center">
            <FileText className="mx-auto mb-4 h-10 w-10 text-slate-500" />
            <h2 className="mb-3 text-xl font-semibold text-white">
              {isStartupScoped ? 'Link a product workspace to this startup first' : 'Create your own product workspace first'}
            </h2>
            <p className="mx-auto mb-5 max-w-2xl text-sm leading-6 text-slate-400">
              {isStartupScoped
                ? `Patent support for ${scopedStartupTitle} is locked to the startup's own linked product workspace. Open the Launch section and link a self-created workspace before requesting review.`
                : 'Patent support is tied to your own product workspace so your filing documents, evidence, and review history stay attached to one innovation. Problem-bank workspaces remain available for leaderboard points only.'}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => navigate(isStartupScoped && startupId ? getStartupSectionPath(startupId, 'overview') : '/product-workspace')}
                className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                {isStartupScoped ? 'Open Startup Launch' : 'Create Workspace'}
              </button>
            </div>
          </div>
        ) : null}

        {isStartupScoped && hasPatentEligibleWorkspaces ? (
          <StartupPatentRequestOverview
            requests={visiblePatentRequests}
            latestSubmission={visiblePatents[0]}
            isLoading={patentRequestsQuery.isLoading || patentsQuery.isLoading}
          />
        ) : null}

        {hasPatentEligibleWorkspaces ? submitted ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="mb-3 text-xl font-semibold text-white">Patent intake request submitted</h2>
            <p className="mx-auto max-w-2xl text-sm leading-6 text-slate-300">
              Your student patent request now includes the intake questionnaire and any supporting files attached from the selected workspace. The admin and IPR review team can start from this package without asking for the same basics again.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* ── Project Setup ──────────────────────────────────────── */}
            <section className="border-b border-slate-800 pb-5">
              <div className="mb-3 text-xs uppercase tracking-[0.28em] text-cyan-300">Project Setup</div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">Workspace</label>
                  {isStartupScoped ? (
                    <div className={fieldCls}>
                      {activeWorkspace?.title ?? 'Linked startup workspace'}
                    </div>
                  ) : (
                    <select
                      value={selectedWorkspaceId}
                      onChange={(e) => {
                        setWorkspaceId(e.target.value);
                        setProjectTitle(
                          patentEligibleWorkspaces.find((w) => w._id === e.target.value)?.title ?? '',
                        );
                      }}
                      className={fieldCls}
                    >
                      {patentEligibleWorkspaces.map((w) => (
                        <option key={w._id} value={w._id}>
                          {w.title} - {w.claimedProblemId ? 'Problem Bank' : 'Own Product'}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    {isStartupScoped
                      ? 'Patent support is locked to the product workspace linked from this startup.'
                      : 'Pick the self-created workspace that represents the invention you want to file. Problem-bank workspaces are excluded from patent support.'}
                  </p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">Project title for filing</label>
                  <input
                    value={projectTitle || startup?.name || activeWorkspace?.title || ''}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    className={fieldCls}
                    placeholder="Patent-facing title"
                  />
                </div>
              </div>
            </section>

            {/* ── Government Filing Documents ───────────────────────── */}
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr),minmax(360px,0.8fr)]">
            <section className="order-2 border-t border-slate-800 pt-5 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.28em] text-cyan-300">Supporting Files</div>
                  <p className="mt-2 text-sm text-slate-400">
                    Optional PDF or image evidence for faster review.
                  </p>
                </div>
                <div className="text-sm text-slate-400">
                  {uploadedSupportCount} / {GOVT_DOCS.length} added - {formatFileSize(PATENT_SUPPORT_UPLOAD_MAX_BYTES)} max each
                </div>
              </div>

              <div className="mt-4 divide-y divide-slate-800 border-y border-slate-800">
                {GOVT_DOCS.map(({ category, label, required, hint }) => {
                  const slot = categorySlots[category];
                  const hasUpload = Boolean(slot?.uploadId);
                  const isUploading = Boolean(slot?.uploading);
                  const slotError = slot?.error ?? '';
                  const isDisabled = !selectedWorkspaceId || isUploading;
                  const isSketchUpload = category === 'design_plan_sketch';

                  return (
                    <div key={category} className="grid gap-3 py-2.5 md:grid-cols-[minmax(0,1fr),220px] md:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                          {label}
                          {isSketchUpload ? (
                            <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-cyan-200">
                              Recommended
                            </span>
                          ) : null}
                          {required && <span className="text-red-400">*</span>}
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">{hint}</p>
                        {slotError && (
                          <p className="mt-1 text-xs text-red-400">{slotError}</p>
                        )}
                      </div>

                      <div className="flex justify-start md:justify-end">
                        {hasUpload ? (
                          <div className="flex w-full items-center justify-between gap-2 rounded-lg bg-cyan-500/10 px-3 py-2 md:w-[220px]">
                            <div className="flex min-w-0 items-center gap-2">
                              <FileText className="h-4 w-4 shrink-0 text-cyan-400" />
                              <span className="truncate text-sm text-white">{slot!.fileName}</span>
                            </div>
                            <button
                              onClick={() => {
                                void clearSlot(category);
                              }}
                              className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:text-red-400"
                              title="Remove and re-upload"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <label
                            className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-center transition md:w-[220px] ${
                              isDisabled
                                ? 'cursor-not-allowed border-slate-800 opacity-50'
                                : 'border-slate-700 hover:border-cyan-500/50 hover:bg-slate-950/40'
                            }`}
                          >
                            {isUploading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                                <span className="text-xs text-slate-400">Uploading</span>
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4 text-slate-500" />
                                <span className="text-xs text-slate-400">
                                  {!selectedWorkspaceId ? 'Select workspace' : 'Upload file'}
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
                      </div>
                    </div>
                  );
                })}
              </div>

            </section>

            {/* ── Two-column: Questionnaire + Filing Readiness ──────── */}
            <div className="order-1 min-w-0 xl:order-1">
              {/* Patent Questionnaire */}
              <section className="min-w-0">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div className="text-xs uppercase tracking-[0.28em] text-cyan-300">Patent Intake Questions</div>
                  <div className="text-xs text-slate-500">Complete each field to submit.</div>
                </div>
                <div className="space-y-4">
                  {QUESTION_SECTIONS.map((section) => (
                    <div key={section.title} className="border-t border-slate-800 pt-3 first:border-t-0 first:pt-0">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">{section.title}</div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {section.questions.map((question) => {
                          const value = answers[question.key];
                          const valueLength = value.trim().length;
                          const minLength = question.type === 'select' ? 1 : question.minLength;
                          const isValid = valueLength >= minLength;

                          return (
                            <div key={question.key}>
                              <label className="mb-1.5 block text-xs font-semibold leading-5 text-white">
                                {QUESTION_LABELS[question.key]}
                              </label>
                              {question.type === 'select' ? (
                                <select
                                  value={value}
                                  onChange={(e) => setAnswers((prev) => ({ ...prev, [question.key]: e.target.value }))}
                                  className={fieldCls}
                                >
                                  <option value="">Select an option</option>
                                  {question.options.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              ) : (
                                <textarea
                                  value={value}
                                  onChange={(e) => setAnswers((prev) => ({ ...prev, [question.key]: e.target.value }))}
                                  className={textAreaCls}
                                />
                              )}
                              <div className={`mt-1 text-xs ${isValid ? 'text-green-400' : 'text-slate-500'}`}>
                                {question.type === 'select' ? (isValid ? 'Selected' : 'Required') : `${valueLength}/${question.minLength}`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Filing Readiness</div>
                    <p className="mt-2 text-sm text-slate-400">
                      Expand this only when you want to prepare the deeper filing notes beyond the intake questionnaire.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFilingReadiness((current) => !current)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/40 hover:text-white"
                  >
                    {showFilingReadiness ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showFilingReadiness ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showFilingReadiness ? (
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
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 px-4 py-5 text-sm text-slate-400">
                    Filing readiness details stay collapsed until you need them. The main intake form above is enough to submit a patent request.
                  </div>
                )}
              </div>
            </div>

            {/* ── Submit bar ─────────────────────────────────────────── */}
            </div>

            {formError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                {formError}
              </div>
            )}

            <div className="flex flex-col gap-4 border-t border-slate-800 pt-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3 text-sm text-slate-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                <div>
                  Patent intake requests are reviewed after the questionnaire is complete. Supporting uploads are optional but useful for faster admin review.
                </div>
              </div>
              <button
                onClick={() => submitMutation.mutate()}
                disabled={!canSubmit || submitMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit IPR / Patent Request
              </button>
            </div>
          </div>
        ) : null}

        {/* ── Existing submissions ───────────────────────────────────── */}
        <section className="grid gap-5 border-t border-slate-800 pt-5 lg:grid-cols-[1fr,280px]">
          <div className="min-w-0">
            <h2 className="mb-3 text-lg font-semibold text-white">Existing submissions</h2>
            {visiblePatents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 py-8 text-slate-500">
                <FileText className="mb-3 h-8 w-8 opacity-40" />
                <div className="text-sm">{isStartupScoped ? 'No submissions for this startup yet.' : 'No submissions yet.'}</div>
              </div>
            ) : (
              <div className="space-y-3">
                {showcaseError && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {showcaseError}
                  </div>
                )}
                {visiblePatents.map((patent) => (
                  <div
                    key={patent._id}
                    className="flex flex-col justify-between gap-3 border-b border-slate-800 py-3 md:flex-row md:items-center"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{patent.projectTitle}</span>
                        {patent.showcasedInMarketplace && (
                          <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs font-medium text-cyan-300">
                            Showcased
                          </span>
                        )}
                      </div>
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
                      {patent.status === 'approved' && (
                        <button
                          onClick={() => showcaseMutation.mutate(patent._id)}
                          disabled={showcaseMutation.isPending}
                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                            patent.showcasedInMarketplace
                              ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20'
                              : 'border-slate-700 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300'
                          }`}
                          title={patent.showcasedInMarketplace ? 'Remove from marketplace showcase' : 'Showcase in marketplace'}
                        >
                          {patent.showcasedInMarketplace ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                          {patent.showcasedInMarketplace ? 'Unshowcase' : 'Showcase'}
                        </button>
                      )}
                      <button
                        onClick={() => setViewPatent(patent)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-300"
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

          <aside className="space-y-5 border-t border-slate-800 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <Award className="h-4 w-4 text-cyan-300" />
                ProMove IPR Services
              </div>
              <p className="mb-3 text-sm text-slate-400">Professional patent filing support included</p>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>Novelty and filing readiness review</li>
                <li>Prior-art positioning support</li>
                <li>Guidance for Forms 1, 3, 5, 18, and 26</li>
              </ul>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-white">Submission Flow</h3>
              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center gap-3">
                  <Upload className="h-4 w-4 text-blue-400" />
                  Supporting sketches, drafts, and diagrams uploaded by category
                </div>
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-cyan-400" />
                  Intake questionnaire completed with innovation, novelty, rights, and market context
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  Disclosure and legal-agreement status captured for IPR review
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
          </aside>
        </section>
      </div>

      {/* Patent detail view modal */}
      {viewPatent && (
        <PatentDetailModal patent={viewPatent} onClose={() => setViewPatent(null)} />
      )}
    </>
  );

  return isStartupScoped ? pageContent : <DashboardLayout role="student">{pageContent}</DashboardLayout>;
}
