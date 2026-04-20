import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck,
  FileText,
  Loader2,
  MessageCircle,
  MessageSquarePlus,
  Send,
  Upload,
  User,
  X,
} from 'lucide-react';
import { adminApi, AdminPatentRequestDetail, AdminPatentRequestListItem } from '../../api/admin.api';
import { toast } from '../../app/components/ui/sonner';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { OptionTabs } from '../../components/ui/OptionTabs';
import { Spinner } from '../../components/ui/Spinner';
import type { PatentRequestDocCategory } from '../../types/patentRequest.types';
import { getApiErrorMessage } from '../../utils/apiError';

// ─── Constants ───────────────────────────────────────────────────────────────

type FilterGroup = 'intake' | 'filing' | 'examination' | 'decided' | 'all';

const FILTER_TABS: Array<{ key: FilterGroup; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'intake', label: 'Intake' },
  { key: 'filing', label: 'Filing' },
  { key: 'examination', label: 'Examination' },
  { key: 'decided', label: 'Decided' },
];

const STATUS_GROUP_MAP: Record<string, FilterGroup> = {
  draft: 'intake',
  submitted: 'intake',
  documents_review: 'intake',
  ready_for_filing: 'filing',
  filed_with_ipo: 'filing',
  published: 'filing',
  examination_requested: 'examination',
  fer_issued: 'examination',
  fer_response_submitted: 'examination',
  granted: 'decided',
  rejected: 'decided',
  abandoned: 'decided',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  documents_review: 'Documents Review',
  ready_for_filing: 'Ready for Filing',
  filed_with_ipo: 'Filed with IPO',
  published: 'Published',
  examination_requested: 'Examination Requested',
  fer_issued: 'FER Issued',
  fer_response_submitted: 'FER Response Submitted',
  granted: 'Granted',
  rejected: 'Rejected',
  abandoned: 'Abandoned',
  // Legacy
  under_review: 'Under Review',
  in_progress: 'In Progress',
  filed: 'Filed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  filing_in_progress: 'Filing in Progress',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-700/60 text-slate-300',
  submitted: 'bg-yellow-500/15 text-yellow-300',
  documents_review: 'bg-cyan-500/15 text-cyan-300',
  ready_for_filing: 'bg-blue-500/15 text-blue-300',
  filed_with_ipo: 'bg-indigo-500/15 text-indigo-300',
  published: 'bg-violet-500/15 text-violet-300',
  examination_requested: 'bg-purple-500/15 text-purple-300',
  fer_issued: 'bg-orange-500/15 text-orange-300',
  fer_response_submitted: 'bg-amber-500/15 text-amber-300',
  granted: 'bg-emerald-500/15 text-emerald-300',
  rejected: 'bg-red-500/15 text-red-300',
  abandoned: 'bg-slate-600/40 text-slate-400',
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
  patent_certificate: 'Patent certificate',
  supporting_evidence: 'Supporting evidence',
  other: 'Other',
};

const DOCUMENT_REVIEW_LABELS: Record<string, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  revision_requested: 'Revision requested',
};

const DOCUMENT_REVIEW_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-300',
  approved: 'bg-emerald-500/10 text-emerald-300',
  rejected: 'bg-rose-500/10 text-rose-300',
  revision_requested: 'bg-orange-500/10 text-orange-300',
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted'],
  submitted: ['documents_review', 'abandoned'],
  documents_review: ['ready_for_filing', 'abandoned'],
  ready_for_filing: ['filed_with_ipo', 'abandoned'],
  filed_with_ipo: ['published', 'abandoned'],
  published: ['examination_requested'],
  examination_requested: ['fer_issued', 'granted', 'rejected'],
  fer_issued: ['fer_response_submitted', 'abandoned'],
  fer_response_submitted: ['granted', 'rejected'],
  granted: [],
  rejected: [],
  abandoned: [],
};

const PATENT_HANDOVER_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getDeadlineUrgency = (deadline?: string) => {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, color: 'text-red-400 bg-red-500/15' };
  if (days <= 30) return { label: `${days}d left`, color: 'text-orange-400 bg-orange-500/15' };
  if (days <= 90) return { label: `${days}d left`, color: 'text-yellow-400 bg-yellow-500/10' };
  return { label: `${days}d left`, color: 'text-slate-400 bg-slate-700/40' };
};

// ─── Case Detail Modal ───────────────────────────────────────────────────────

function CaseDetailModal({
  item,
  onClose,
}: {
  item: AdminPatentRequestListItem;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [actionError, setActionError] = useState('');
  const [ipoAppNumber, setIpoAppNumber] = useState('');
  const [ipoFilingDate, setIpoFilingDate] = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [handoverUploadNote, setHandoverUploadNote] = useState('');
  const [handoverCategory, setHandoverCategory] = useState<PatentRequestDocCategory>('patent_certificate');
  const [activeTab, setActiveTab] = useState<
    'overview' | 'documents' | 'handover' | 'actions' | 'notes' | 'conversation'
  >('overview');
  const [conversationMessage, setConversationMessage] = useState('');
  const [documentReviewNotes, setDocumentReviewNotes] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const handoverFileInputRef = useRef<HTMLInputElement>(null);

  const nextStatuses = VALID_TRANSITIONS[item.status] ?? [];

  const detailQuery = useQuery({
    queryKey: ['admin-patent-detail', item._id],
    queryFn: () => adminApi.getPatentRequestDetail(item._id),
  });

  const detail = detailQuery.data as AdminPatentRequestDetail | undefined;
  const questionnaire = detail?.questionnaire as Record<string, string> | undefined;
  const documents = detail?.documents ?? [];
  const officialHandover = detail?.officialHandover;
  const handoverDocuments = officialHandover?.documents ?? [];
  const handoverCompleted = !!officialHandover?.handedOverAt;
  const handoverAcknowledged = !!officialHandover?.studentAcknowledgedAt;

  const messagesQuery = useQuery({
    queryKey: ['admin-patent-messages', item._id],
    queryFn: () => adminApi.getPatentMessages(item._id),
    refetchInterval: activeTab === 'conversation' ? 10_000 : false,
    enabled: activeTab === 'conversation',
  });

  const unreadQuery = useQuery({
    queryKey: ['admin-patent-unread', item._id],
    queryFn: () => adminApi.getPatentUnreadCount(item._id),
  });

  const savedIpoApplicationNumber = detail?.ipoApplicationNumber?.trim() || item.ipoApplicationNumber?.trim() || '';
  const savedIpoFilingDate = detail?.ipoFilingDate || item.ipoFilingDate || '';

  const getIpoDetailsValidationMessage = () => {
    if (!ipoAppNumber.trim() && !ipoFilingDate) {
      return 'Write the patent number and select the filing date before saving IPO details.';
    }
    if (!ipoAppNumber.trim()) {
      return 'Write the patent number before saving IPO details.';
    }
    if (!ipoFilingDate) {
      return 'Select the filing date before saving IPO details.';
    }

    const filingDate = new Date(ipoFilingDate);
    if (Number.isNaN(filingDate.getTime())) {
      return 'Select a valid filing date before saving IPO details.';
    }

    return '';
  };

  const handleSaveIpoDetails = () => {
    const validationMessage = getIpoDetailsValidationMessage();
    if (validationMessage) {
      setActionError(validationMessage);
      toast.error(validationMessage);
      return;
    }

    setActionError('');
    ipoMutation.mutate();
  };

  const handleStatusTransition = (status: string) => {
    if (status === 'granted' && (!savedIpoApplicationNumber || !savedIpoFilingDate)) {
      const validationMessage =
        'Write and save the patent number and filing date before marking this patent case as granted.';
      setActionError(validationMessage);
      setActiveTab('actions');
      toast.error(validationMessage);
      return;
    }

    if (
      status === 'abandoned' || status === 'rejected'
        ? !window.confirm(`Mark as ${STATUS_LABELS[status]}? This is a terminal action.`)
        : false
    ) {
      return;
    }

    setActionError('');
    statusMutation.mutate(status);
  };

  const sendMessageMutation = useMutation({
    mutationFn: () => adminApi.sendPatentMessage(item._id, conversationMessage),
    onSuccess: async () => {
      setConversationMessage('');
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-messages', item._id] });
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-unread', item._id] });
    },
  });

  useEffect(() => {
    if (activeTab === 'conversation' && messagesQuery.data?.length) {
      void adminApi.markPatentMessagesRead(item._id);
      void queryClient.invalidateQueries({ queryKey: ['admin-patent-unread', item._id] });
    }
  }, [activeTab, messagesQuery.data?.length, item._id, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesQuery.data]);

  const sortedMessages = useMemo(
    () => [...(messagesQuery.data ?? [])].reverse(),
    [messagesQuery.data],
  );

  const unreadCount = unreadQuery.data?.count ?? 0;

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      adminApi.updatePatentRequestStatus(item._id, { status, note: statusNote || undefined }),
    onSuccess: async () => {
      setActionError('');
      setStatusNote('');
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-requests'] });
      onClose();
    },
    onError: (err: unknown) => {
      setActionError(getApiErrorMessage(err, 'Failed to update status.'));
    },
  });

  const ipoMutation = useMutation({
    mutationFn: () =>
      adminApi.updatePatentRequestIpoDetails(item._id, {
        applicationNumber: ipoAppNumber.trim(),
        filingDate: new Date(ipoFilingDate).toISOString(),
      }),
    onSuccess: async () => {
      setActionError('');
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-requests'] });
      onClose();
    },
    onError: (err: unknown) => {
      setActionError(getApiErrorMessage(err, 'Failed to update IPO details.'));
    },
  });

  const noteMutation = useMutation({
    mutationFn: () => adminApi.addPatentRequestNote(item._id, noteText),
    onSuccess: async () => {
      setNoteText('');
      setActionError('');
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-requests'] });
    },
    onError: (err: unknown) => {
      setActionError(getApiErrorMessage(err, 'Failed to add note.'));
    },
  });

  const reviewDocumentMutation = useMutation({
    mutationFn: ({
      documentId,
      reviewStatus,
      reviewNote,
    }: {
      documentId: string;
      reviewStatus: 'approved' | 'rejected' | 'revision_requested';
      reviewNote?: string;
    }) =>
      adminApi.reviewPatentRequestDocument(item._id, documentId, {
        reviewStatus,
        reviewNote,
      }),
    onSuccess: async () => {
      setActionError('');
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-detail', item._id] });
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-requests'] });
    },
    onError: (err: unknown) => {
      setActionError(getApiErrorMessage(err, 'Failed to review document.'));
    },
  });

  const uploadHandoverDocumentMutation = useMutation({
    mutationFn: (file: File) =>
      adminApi.uploadPatentRequestHandoverDocument(
        item._id,
        file,
        handoverCategory,
        handoverUploadNote.trim() || undefined,
      ),
    onSuccess: async () => {
      setActionError('');
      setHandoverUploadNote('');
      if (handoverFileInputRef.current) {
        handoverFileInputRef.current.value = '';
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-detail', item._id] });
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-requests'] });
    },
    onError: (err: unknown) => {
      setActionError(getApiErrorMessage(err, 'Failed to upload official handover document.'));
    },
  });

  const completeHandoverMutation = useMutation({
    mutationFn: () =>
      adminApi.completePatentRequestHandover(item._id, {
        note: handoverNote.trim() || undefined,
      }),
    onSuccess: async () => {
      setActionError('');
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-detail', item._id] });
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-requests'] });
    },
    onError: (err: unknown) => {
      setActionError(getApiErrorMessage(err, 'Failed to complete official handover.'));
    },
  });

  const deadlines = [
    { label: 'Complete Specification', value: item.completeSpecDeadline },
    { label: 'Examination Request', value: item.examRequestDeadline },
    { label: 'FER Response', value: item.ferResponseDeadline },
  ].filter((d) => d.value);

  const handleHandoverFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > PATENT_HANDOVER_UPLOAD_MAX_BYTES) {
      setActionError(`File must be ${formatFileSize(PATENT_HANDOVER_UPLOAD_MAX_BYTES)} or less.`);
      event.target.value = '';
      return;
    }

    setActionError('');
    uploadHandoverDocumentMutation.mutate(file);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 p-4 backdrop-blur-sm sm:p-6">
      <div className="mx-auto flex min-h-full w-full items-start justify-center">
        <Card className="flex w-full max-w-3xl flex-col overflow-hidden p-6 max-h-[calc(100vh-2rem)]">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Patent Support Case</div>
              <h3 className="mt-2 truncate text-xl font-bold text-white">{item.inventionTitle}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[item.status] ?? 'bg-slate-700 text-slate-300'}`}
                >
                  {STATUS_LABELS[item.status] ?? item.status}
                </span>
                <span className="text-sm text-slate-400">
                  <User className="mr-1 inline-block h-3.5 w-3.5" />
                  {item.student.displayName}
                </span>
                {item.ipoApplicationNumber && (
                  <span className="text-sm text-slate-400">IPO: {item.ipoApplicationNumber}</span>
                )}
              </div>
            </div>
            <Button variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Tabs */}
          <div className="mt-5 flex gap-1 border-b border-slate-800 pb-0">
            {(['overview', 'documents', 'handover', 'actions', 'conversation', 'notes'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === tab ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {tab === 'overview'
                  ? 'Overview'
                  : tab === 'documents'
                    ? 'Documents'
                    : tab === 'handover'
                      ? 'Handover'
                    : tab === 'actions'
                      ? 'Actions'
                      : tab === 'conversation'
                        ? 'Conversation'
                        : 'Notes'}
                {tab === 'documents' && documents.length > 0 ? (
                  <span className="ml-2 rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200">
                    {documents.length}
                  </span>
                ) : null}
                {tab === 'handover' && handoverDocuments.length > 0 ? (
                  <span className="ml-2 rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200">
                    {handoverDocuments.length}
                  </span>
                ) : null}
                {tab === 'conversation' && unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-[10px] font-bold text-slate-950">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            {activeTab === 'overview' && (
              <div className="space-y-5">
                {/* Key Info */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['Student', item.student.displayName],
                    ['Email', item.student.email],
                    ['Status', STATUS_LABELS[item.status] ?? item.status],
                    ['Patent Type', item.patentType ?? '—'],
                    ['Spec Type', item.specificationType ?? '—'],
                    ['Entity Type', item.applicantEntityType ?? '—'],
                    ['Submitted', formatDate(item.submittedAt)],
                    ['IPO Application', item.ipoApplicationNumber ?? '—'],
                    ['IPO Filing Date', formatDate(item.ipoFilingDate)],
                    ['Innovation Score', String(item.student.innovationScore)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
                      <div className="text-xs font-medium text-slate-500">{label}</div>
                      <div className="mt-1 text-sm text-white">{value}</div>
                    </div>
                  ))}
                </div>

                {/* Deadlines */}
                {deadlines.length > 0 && (
                  <div>
                    <div className="mb-3 text-xs uppercase tracking-[0.2em] text-cyan-300">Deadlines</div>
                    <div className="space-y-2">
                      {deadlines.map((d) => {
                        const urgency = getDeadlineUrgency(d.value);
                        return (
                          <div
                            key={d.label}
                            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3"
                          >
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-slate-500" />
                              <span className="text-sm text-slate-300">{d.label}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-slate-400">{formatDate(d.value)}</span>
                              {urgency && (
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${urgency.color}`}>
                                  {urgency.label}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Intake Questionnaire */}
                {questionnaire && Object.values(questionnaire).some((v) => v) && (
                  <div>
                    <div className="mb-3 text-xs uppercase tracking-[0.2em] text-cyan-300">
                      Intake Questionnaire
                    </div>
                    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                      {Object.entries(questionnaire)
                        .filter(([, value]) => value)
                        .map(([key, value], i, arr) => (
                          <div
                            key={key}
                            className={`px-4 py-3 ${i !== arr.length - 1 ? 'border-b border-slate-800' : ''}`}
                          >
                            <div className="mb-1 text-xs font-medium text-slate-500">
                              {key
                                .replace(/([A-Z])/g, ' $1')
                                .replace(/_/g, ' ')
                                .trim()}
                            </div>
                            <div className="text-sm leading-relaxed text-white">{value}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {documents.length > 0 ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                    {documents.length} document{documents.length === 1 ? '' : 's'} uploaded.
                    Open the <span className="font-medium text-white">Documents</span> tab to review files.
                  </div>
                ) : null}

                {item.status === 'granted' ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                    Official document handover:{' '}
                    <span className="font-medium text-white">
                      {handoverAcknowledged
                        ? 'Acknowledged by student'
                        : handoverCompleted
                          ? 'Shared with student'
                          : 'Pending package creation'}
                    </span>
                    . Open the <span className="font-medium text-white">Handover</span> tab to manage the final package.
                  </div>
                ) : null}
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="space-y-5">
                {documents.length === 0 ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 px-5 py-8 text-center text-sm text-slate-500">
                    No documents have been uploaded for this patent support case yet.
                  </div>
                ) : (
                  <div>
                    <div className="mb-3 text-xs uppercase tracking-[0.2em] text-cyan-300">
                      Uploaded Documents
                    </div>
                    <div className="space-y-3">
                      {documents.map((document) => {
                        const reviewStatus = document.reviewStatus ?? 'pending';
                        const noteKey = document._id ?? document.fileUrl;
                        const noteValue = documentReviewNotes[noteKey] ?? document.reviewNote ?? '';

                        return (
                          <div
                            key={document._id ?? document.fileUrl}
                            className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <a
                                  href={document.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="truncate text-sm font-semibold text-white hover:text-cyan-300"
                                >
                                  {document.fileName}
                                </a>
                                <div className="mt-1 text-xs text-slate-500">
                                  {DOCUMENT_CATEGORY_LABELS[document.documentCategory] ?? document.documentCategory}
                                </div>
                                {document.uploadedAt ? (
                                  <div className="mt-1 text-xs text-slate-500">
                                    Uploaded {formatDate(document.uploadedAt)}
                                  </div>
                                ) : null}
                              </div>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${DOCUMENT_REVIEW_STYLES[reviewStatus]}`}
                              >
                                {DOCUMENT_REVIEW_LABELS[reviewStatus] ?? reviewStatus}
                              </span>
                            </div>

                            {document.note ? (
                              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300">
                                Student note: {document.note}
                              </div>
                            ) : null}

                            <textarea
                              value={noteValue}
                              onChange={(e) =>
                                setDocumentReviewNotes((current) => ({
                                  ...current,
                                  [noteKey]: e.target.value,
                                }))
                              }
                              placeholder="Add admin review note"
                              className="mt-3 min-h-20 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                            />

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <a href={document.fileUrl} target="_blank" rel="noreferrer">
                                <Button variant="secondary">
                                  <FileText className="mr-2 h-4 w-4" />
                                  Open Document
                                </Button>
                              </a>

                              {(['approved', 'revision_requested', 'rejected'] as const)
                                .filter((status) => !(reviewStatus === 'approved' && status === 'approved'))
                                .map((status) => (
                                <Button
                                  key={status}
                                  variant={status === 'approved' ? 'primary' : 'secondary'}
                                  onClick={() =>
                                    document._id &&
                                    reviewDocumentMutation.mutate({
                                      documentId: document._id,
                                      reviewStatus: status,
                                      reviewNote: noteValue.trim() || undefined,
                                    })
                                  }
                                  disabled={!document._id || reviewDocumentMutation.isPending}
                                >
                                  {reviewDocumentMutation.isPending ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : null}
                                  {DOCUMENT_REVIEW_LABELS[status]}
                                </Button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'handover' && (
              <div className="space-y-5">
                {item.status !== 'granted' ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 px-5 py-8 text-center text-sm text-slate-500">
                    Official document handover becomes available after the patent is granted.
                  </div>
                ) : (
                  <>
                    <div
                      className={`rounded-xl border px-4 py-3 text-sm ${
                        handoverAcknowledged
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                          : handoverCompleted
                            ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-100'
                            : 'border-amber-500/20 bg-amber-500/10 text-amber-100'
                      }`}
                    >
                      {handoverAcknowledged
                        ? `Student acknowledged the official handover on ${formatDate(officialHandover?.studentAcknowledgedAt)}.`
                        : handoverCompleted
                          ? `Official handover was completed on ${formatDate(officialHandover?.handedOverAt)} and is waiting for student acknowledgement.`
                          : 'Upload the final grant package, certificate, and any closing documents, then mark the handover complete.'}
                    </div>

                    {!handoverAcknowledged ? (
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">
                              Upload Official Documents
                            </div>
                            <p className="mt-1 text-sm text-slate-400">
                              Share the final patent certificate, assignment deed, and other closing records.
                            </p>
                          </div>
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
                            {uploadHandoverDocumentMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                            Upload file
                            <input
                              ref={handoverFileInputRef}
                              type="file"
                              accept=".pdf,image/*"
                              className="hidden"
                              onChange={handleHandoverFileChange}
                              disabled={uploadHandoverDocumentMutation.isPending}
                            />
                          </label>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-[220px,1fr]">
                          <select
                            value={handoverCategory}
                            onChange={(e) => setHandoverCategory(e.target.value as PatentRequestDocCategory)}
                            className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white"
                          >
                            {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <input
                            value={handoverUploadNote}
                            onChange={(e) => setHandoverUploadNote(e.target.value)}
                            placeholder="Optional note for this handover file"
                            className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                      {handoverDocuments.length === 0 ? (
                        <div className="px-5 py-8 text-center text-sm text-slate-500">
                          No official handover documents uploaded yet.
                        </div>
                      ) : (
                        handoverDocuments
                          .slice()
                          .sort((left, right) => {
                            const leftTime = left.uploadedAt ? new Date(left.uploadedAt).getTime() : 0;
                            const rightTime = right.uploadedAt ? new Date(right.uploadedAt).getTime() : 0;
                            return rightTime - leftTime;
                          })
                          .map((document, index, arr) => (
                            <div
                              key={document._id ?? `${document.fileUrl}-${index}`}
                              className={`px-5 py-4 ${index !== arr.length - 1 ? 'border-b border-slate-800' : ''}`}
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="min-w-0">
                                  <a
                                    href={document.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="truncate text-sm font-semibold text-white hover:text-cyan-300"
                                  >
                                    {document.fileName}
                                  </a>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {DOCUMENT_CATEGORY_LABELS[document.documentCategory] ?? document.documentCategory}
                                    {' / '}
                                    {formatFileSize(document.fileSizeBytes)}
                                    {document.uploadedAt ? ` / Uploaded ${formatDate(document.uploadedAt)}` : ''}
                                  </div>
                                  {document.note ? (
                                    <div className="mt-2 text-sm text-slate-300">{document.note}</div>
                                  ) : null}
                                </div>
                                <a href={document.fileUrl} target="_blank" rel="noreferrer">
                                  <Button variant="secondary">
                                    <FileText className="mr-2 h-4 w-4" />
                                    Open
                                  </Button>
                                </a>
                              </div>
                            </div>
                          ))
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Complete Handover</div>
                      <textarea
                        value={handoverNote}
                        onChange={(e) => setHandoverNote(e.target.value)}
                        placeholder="Optional note for the student about what is included in the final handover package."
                        className="mt-3 min-h-24 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                        disabled={handoverCompleted || handoverAcknowledged}
                      />
                      {!handoverCompleted && !handoverAcknowledged ? (
                        <Button
                          variant="primary"
                          className="mt-3"
                          onClick={() => completeHandoverMutation.mutate()}
                          disabled={handoverDocuments.length === 0 || completeHandoverMutation.isPending}
                        >
                          {completeHandoverMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <FileCheck className="mr-2 h-4 w-4" />
                          )}
                          Mark Official Handover Complete
                        </Button>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'actions' && (
              <div className="space-y-5">
                {/* Status Transition */}
                {nextStatuses.length > 0 ? (
                  <div>
                    <div className="mb-3 text-xs uppercase tracking-[0.2em] text-cyan-300">
                      Change Status
                    </div>
                    <textarea
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="Optional note for this status change..."
                      className="mb-3 min-h-20 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                    />
                    <div className="flex flex-wrap gap-2">
                      {nextStatuses.map((status) => (
                        <Button
                          key={status}
                          variant={status === 'abandoned' || status === 'rejected' ? 'secondary' : 'primary'}
                          onClick={() => handleStatusTransition(status)}
                          disabled={statusMutation.isPending}
                        >
                          <ChevronRight className="mr-1 h-3.5 w-3.5" />
                          {STATUS_LABELS[status] ?? status}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 px-5 py-6 text-center text-sm text-slate-500">
                    <CheckCircle2 className="mx-auto mb-2 h-6 w-6 opacity-40" />
                    This case has reached a terminal status. No further transitions available.
                  </div>
                )}

                {/* IPO Details */}
                <div>
                  <div className="mb-3 text-xs uppercase tracking-[0.2em] text-cyan-300">
                    IPO Details
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      value={ipoAppNumber}
                      onChange={(e) => setIpoAppNumber(e.target.value)}
                      placeholder="IPO Application Number"
                      className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
                    />
                    <input
                      type="date"
                      value={ipoFilingDate}
                      onChange={(e) => setIpoFilingDate(e.target.value)}
                      className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white [color-scheme:dark]"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    className="mt-3"
                    onClick={handleSaveIpoDetails}
                    disabled={ipoMutation.isPending}
                  >
                    {ipoMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileCheck className="mr-2 h-4 w-4" />
                    )}
                    Save IPO Details
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'conversation' && (
              <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
                <div className="border-b border-slate-800 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-cyan-400" />
                    <span className="text-xs uppercase tracking-[0.2em] text-cyan-300">
                      1-on-1 Conversation with Student
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.student.displayName} &middot; Messages are visible to both admin and student
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 max-h-72 min-h-[200px]">
                  {messagesQuery.isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                    </div>
                  ) : sortedMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                      <Send className="mb-2 h-6 w-6 opacity-40" />
                      <div className="text-sm">No messages yet. Start a conversation with the student.</div>
                    </div>
                  ) : (
                    sortedMessages.map((msg) => (
                      <div
                        key={msg._id}
                        className={`flex ${msg.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                            msg.senderRole === 'admin'
                              ? 'bg-cyan-500/15 text-white'
                              : 'bg-slate-800 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-slate-400">
                              {msg.senderName}
                            </span>
                            <span className="text-[10px] text-slate-600">
                              {new Date(msg.sentAt).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {msg.readAt && msg.senderRole === 'admin' && (
                              <span className="text-[10px] text-cyan-500">Read</span>
                            )}
                          </div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap">
                            {msg.message}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-slate-800 px-5 py-3">
                  <div className="flex gap-2">
                    <input
                      value={conversationMessage}
                      onChange={(e) => setConversationMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && conversationMessage.trim()) {
                          e.preventDefault();
                          sendMessageMutation.mutate();
                        }
                      }}
                      className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
                      placeholder="Type a message to the student..."
                    />
                    <Button
                      variant="primary"
                      onClick={() => sendMessageMutation.mutate()}
                      disabled={!conversationMessage.trim() || sendMessageMutation.isPending}
                    >
                      {sendMessageMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add an internal note..."
                    className="min-h-20 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={() => noteMutation.mutate()}
                  disabled={!noteText.trim() || noteMutation.isPending}
                >
                  {noteMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquarePlus className="mr-2 h-4 w-4" />
                  )}
                  Add Note
                </Button>
                <div className="rounded-xl border border-slate-800 bg-slate-950 px-5 py-4 text-sm text-slate-400">
                  Internal notes are stored on the case and are only visible to admins.
                  View full notes and timeline in the detailed case view.
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {actionError && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {actionError}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PatentRequests() {
  const [activeFilter, setActiveFilter] = useState<FilterGroup>('all');
  const [selectedCase, setSelectedCase] = useState<AdminPatentRequestListItem | null>(null);

  const requestsQuery = useQuery({
    queryKey: ['admin-patent-requests', activeFilter],
    queryFn: () => adminApi.getPatentRequests(),
    refetchInterval: 60_000,
  });

  const items = useMemo(() => {
    const all = requestsQuery.data?.items ?? [];
    if (activeFilter === 'all') return all;
    return all.filter((item) => STATUS_GROUP_MAP[item.status] === activeFilter);
  }, [requestsQuery.data, activeFilter]);

  const counts = useMemo(() => {
    const all = requestsQuery.data?.items ?? [];
    const result: Record<FilterGroup, number> = { all: all.length, intake: 0, filing: 0, examination: 0, decided: 0 };
    all.forEach((item) => {
      const group = STATUS_GROUP_MAP[item.status];
      if (group) result[group]++;
    });
    return result;
  }, [requestsQuery.data]);

  return (
    <div className="space-y-6">
      <OptionTabs
        items={FILTER_TABS.map((tab) => ({
          id: tab.key,
          label: `${tab.label} (${counts[tab.key]})`,
        }))}
        activeId={activeFilter}
        onChange={setActiveFilter}
        aria-label="Patent request status filters"
      />

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1.4fr,0.8fr,140px,140px,120px,100px] border-b border-slate-800 bg-slate-900 px-5 py-4 text-xs uppercase tracking-[0.2em] text-slate-400">
          <div>Student / Invention</div>
          <div>Status</div>
          <div>Submitted</div>
          <div>Next Deadline</div>
          <div>IPO #</div>
          <div>Actions</div>
        </div>
        <div className="divide-y divide-slate-800">
          {requestsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <FileText className="mb-3 h-8 w-8 opacity-40" />
              <div className="text-sm">No cases in this group.</div>
            </div>
          ) : (
            items.map((item) => {
              const nearestDeadline =
                item.completeSpecDeadline ?? item.examRequestDeadline ?? item.ferResponseDeadline;
              const urgency = getDeadlineUrgency(nearestDeadline);

              return (
                <div
                  key={item._id}
                  className="grid grid-cols-[1.4fr,0.8fr,140px,140px,120px,100px] items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-900"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">{item.inventionTitle}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {item.student.displayName} · {item.specificationType ?? 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[item.status] ?? 'bg-slate-700 text-slate-300'}`}
                    >
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </div>
                  <div className="text-sm text-slate-400">{formatDate(item.submittedAt)}</div>
                  <div>
                    {urgency ? (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${urgency.color}`}>
                        {urgency.label}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </div>
                  <div className="truncate text-sm text-slate-400">{item.ipoApplicationNumber ?? '—'}</div>
                  <div>
                    <Button variant="secondary" onClick={() => setSelectedCase(item)}>
                      Open
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {selectedCase && <CaseDetailModal item={selectedCase} onClose={() => setSelectedCase(null)} />}
    </div>
  );
}
