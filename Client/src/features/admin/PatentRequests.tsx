import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FileCheck,
  FileText,
  Filter,
  ImageIcon,
  Loader2,
  MessageCircle,
  MessageSquarePlus,
  Search,
  Send,
  Upload,
  User,
  X,
} from 'lucide-react';
import { adminApi, AdminPatentRequestDetail, AdminPatentRequestListItem } from '../../api/admin.api';
import { toast } from '../../components/ui/sonner';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { OptionTabs } from '../../components/ui/OptionTabs';
import { Spinner } from '../../components/ui/Spinner';
import type { PatentRequestDocCategory } from '../../types/patentRequest.types';
import { getApiErrorMessage } from '../../utils/apiError';

// ─── Constants ───────────────────────────────────────────────────────────────

type FilterGroup = 'intake' | 'filing' | 'examination' | 'decided' | 'all';

const FILTER_TABS: Array<{ key: FilterGroup; label: string }> = [
  { key: 'all', label: 'All Cases' },
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
  submitted: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30',
  documents_review: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
  ready_for_filing: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
  filed_with_ipo: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
  published: 'bg-violet-500/15 text-violet-300 border border-violet-500/30',
  examination_requested: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
  fer_issued: 'bg-orange-500/15 text-orange-300 border border-orange-500/30',
  fer_response_submitted: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  granted: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-300 border border-red-500/30',
  abandoned: 'bg-slate-600/40 text-slate-400 border border-slate-700/40',
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
  system_generated: 'System-generated document',
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
  pending: 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
  approved: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
  rejected: 'bg-rose-500/10 text-rose-300 border border-rose-500/20',
  revision_requested: 'bg-orange-500/10 text-orange-300 border border-orange-500/20',
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

const PIPELINE_STEPS = [
  { key: 'submitted', label: 'Intake' },
  { key: 'documents_review', label: 'Docs Review' },
  { key: 'ready_for_filing', label: 'Ready' },
  { key: 'filed_with_ipo', label: 'Filed IPO' },
  { key: 'published', label: 'Published' },
  { key: 'examination_requested', label: 'Exam Req.' },
  { key: 'fer_issued', label: 'FER Issued' },
  { key: 'fer_response_submitted', label: 'FER Response' },
  { key: 'granted', label: 'Granted' },
];

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatKey = (value: string) => value.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();

const getDocumentDisplayTitle = (document: { fileName: string; documentCategory?: string }) => {
  const categoryLabel =
    DOCUMENT_CATEGORY_LABELS[document.documentCategory ?? ''] ??
    formatKey(document.documentCategory ?? '');

  const fileName = document.fileName ?? '';
  const isSystemGeneratedCode =
    /^PMV-[A-Z0-9-]+\.pdf$/i.test(fileName) ||
    fileName.startsWith('PMV-CON-') ||
    fileName.startsWith('PMV-PAT-');

  if (categoryLabel && (isSystemGeneratedCode || !fileName)) {
    return categoryLabel;
  }

  return fileName || categoryLabel || 'Attached Document';
};

const getDocumentDisplaySubtext = (document: {
  fileName: string;
  documentCategory?: string;
  fileSizeBytes?: number;
  uploadedAt?: string;
}) => {
  const categoryLabel =
    DOCUMENT_CATEGORY_LABELS[document.documentCategory ?? ''] ??
    formatKey(document.documentCategory ?? '');
  const title = getDocumentDisplayTitle(document);
  const sizeText = formatFileSize(document.fileSizeBytes ?? 0);

  if (title === categoryLabel) {
    return `${document.fileName} · ${sizeText}`;
  } else if (categoryLabel) {
    return `${categoryLabel} · ${sizeText}`;
  }

  return sizeText;
};

const getDeadlineUrgency = (deadline?: string) => {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, color: 'text-red-400 bg-red-500/15 border border-red-500/30' };
  if (days <= 30) return { label: `${days}d left`, color: 'text-orange-400 bg-orange-500/15 border border-orange-500/30' };
  if (days <= 90) return { label: `${days}d left`, color: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20' };
  return { label: `${days}d left`, color: 'text-slate-400 bg-slate-700/40 border border-slate-700/60' };
};

const getNearestDeadlineInfo = (item: AdminPatentRequestListItem) => {
  if (item.completeSpecDeadline) {
    return { name: 'Complete Spec', value: item.completeSpecDeadline, urgency: getDeadlineUrgency(item.completeSpecDeadline) };
  }
  if (item.examRequestDeadline) {
    return { name: 'Exam Request', value: item.examRequestDeadline, urgency: getDeadlineUrgency(item.examRequestDeadline) };
  }
  if (item.ferResponseDeadline) {
    return { name: 'FER Response', value: item.ferResponseDeadline, urgency: getDeadlineUrgency(item.ferResponseDeadline) };
  }
  return null;
};

// ─── Inline Document Preview Modal ──────────────────────────────────────────

function InlineDocPreviewModal({
  url,
  fileName,
  open,
  onClose,
}: {
  url: string | null;
  fileName: string;
  open: boolean;
  onClose: () => void;
}) {
  if (!open || !url) return null;

  const isImage = url.match(/\.(png|jpe?g|webp|gif|svg)$/i);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <Card className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden p-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan-400" />
            <h4 className="font-semibold text-white">{fileName}</h4>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition"
            >
              Open Tab
            </a>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-950 p-4">
          {isImage ? (
            <div className="flex h-full items-center justify-center">
              <img src={url} alt={fileName} className="max-h-full max-w-full rounded-lg object-contain" />
            </div>
          ) : (
            <iframe src={url} title={fileName} className="h-full w-full rounded-lg border-0 bg-white" />
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── Pipeline Stepper ────────────────────────────────────────────────────────

function PipelineStepper({ currentStatus }: { currentStatus: string }) {
  const currentIndex = PIPELINE_STEPS.findIndex((s) => s.key === currentStatus);
  const isTerminalNegative = currentStatus === 'rejected' || currentStatus === 'abandoned';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">Lifecycle Progress</div>
        <div className="text-xs font-semibold text-slate-400">
          Status: <span className="text-white">{STATUS_LABELS[currentStatus] ?? currentStatus}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {PIPELINE_STEPS.map((step, idx) => {
          const isDone = currentIndex > idx;
          const isCurrent = currentStatus === step.key;

          return (
            <div key={step.key} className="flex items-center gap-1 shrink-0">
              <div
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isCurrent
                    ? 'border border-cyan-500/50 bg-cyan-500/20 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                    : isDone
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                      : 'bg-slate-900 text-slate-500 border border-slate-800'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : isCurrent ? (
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                ) : null}
                <span>{step.label}</span>
              </div>
              {idx < PIPELINE_STEPS.length - 1 ? (
                <ChevronRight className="h-3 w-3 text-slate-700 shrink-0" />
              ) : null}
            </div>
          );
        })}
      </div>
      {isTerminalNegative ? (
        <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          Case closed in terminal state: {STATUS_LABELS[currentStatus]}
        </div>
      ) : null}
    </div>
  );
}

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
  const [isEditingIpo, setIsEditingIpo] = useState(false);
  const [handoverNote, setHandoverNote] = useState('');
  const [handoverUploadNote, setHandoverUploadNote] = useState('');
  const [handoverCategory, setHandoverCategory] = useState<PatentRequestDocCategory>('patent_certificate');
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'handover' | 'conversation'>('overview');
  const [conversationMessage, setConversationMessage] = useState('');
  const [documentReviewNotes, setDocumentReviewNotes] = useState<Record<string, string>>({});
  const [previewDoc, setPreviewDoc] = useState<{ url: string; fileName: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const handoverFileInputRef = useRef<HTMLInputElement>(null);

  const detailQuery = useQuery({
    queryKey: ['admin-patent-detail', item._id],
    queryFn: () => adminApi.getPatentRequestDetail(item._id),
  });

  const detail = detailQuery.data as AdminPatentRequestDetail | undefined;
  const currentStatus = detail?.status ?? item.status;
  const nextStatuses = VALID_TRANSITIONS[currentStatus] ?? [];
  const questionnaire = detail?.questionnaire as Record<string, string> | undefined;
  const documents = detail?.documents ?? [];
  const officialHandover = detail?.officialHandover;
  const handoverDocuments = officialHandover?.documents ?? [];
  const handoverCompleted = !!officialHandover?.handedOverAt;
  const handoverAcknowledged = !!officialHandover?.studentAcknowledgedAt;

  useEffect(() => {
    if (detail?.ipoApplicationNumber) {
      setIpoAppNumber(detail.ipoApplicationNumber);
    }
    if (detail?.ipoFilingDate) {
      setIpoFilingDate(detail.ipoFilingDate.split('T')[0]);
    }
  }, [detail]);

  const messagesQuery = useQuery({
    queryKey: ['admin-patent-messages', item._id],
    queryFn: () => adminApi.getPatentMessages(item._id),
    enabled: activeTab === 'conversation',
    refetchInterval: 15_000,
  });

  const sortedMessages = useMemo(() => {
    const raw = messagesQuery.data ?? [];
    return [...raw].sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
    );
  }, [messagesQuery.data]);

  useEffect(() => {
    if (activeTab === 'conversation') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sortedMessages, activeTab]);

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) =>
      adminApi.updatePatentRequestStatus(item._id, {
        status: newStatus,
        note: statusNote.trim() || undefined,
      }),
    onSuccess: async (data, newStatus) => {
      setStatusNote('');
      setActionError('');
      toast.success('Case status updated successfully');
      queryClient.setQueryData(['admin-patent-detail', item._id], (old: any) =>
        old ? { ...old, status: newStatus } : old,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-patent-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-patent-detail', item._id] }),
      ]);
    },
    onError: (err) => setActionError(getApiErrorMessage(err, 'Failed to update status.')),
  });

  const ipoMutation = useMutation({
    mutationFn: () =>
      adminApi.updatePatentRequestIpoDetails(item._id, {
        applicationNumber: ipoAppNumber.trim(),
        filingDate: ipoFilingDate,
      }),
    onSuccess: async () => {
      setActionError('');
      setIsEditingIpo(false);
      toast.success('IPO details saved successfully');
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-detail', item._id] });
    },
    onError: (err) => setActionError(getApiErrorMessage(err, 'Failed to save IPO details.')),
  });

  const noteMutation = useMutation({
    mutationFn: () => adminApi.addPatentRequestNote(item._id, noteText.trim()),
    onSuccess: async () => {
      setNoteText('');
      setActionError('');
      toast.success('Internal note added');
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-detail', item._id] });
    },
    onError: (err) => setActionError(getApiErrorMessage(err, 'Failed to add note.')),
  });

  const reviewDocumentMutation = useMutation({
    mutationFn: (params: { documentId: string; reviewStatus: 'approved' | 'rejected' | 'revision_requested'; reviewNote?: string }) =>
      adminApi.reviewPatentRequestDocument(item._id, params.documentId, {
        reviewStatus: params.reviewStatus,
        reviewNote: params.reviewNote,
      }),
    onSuccess: async () => {
      setActionError('');
      toast.success('Document review saved');
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-detail', item._id] });
    },
    onError: (err) => setActionError(getApiErrorMessage(err, 'Failed to review document.')),
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
      setHandoverUploadNote('');
      if (handoverFileInputRef.current) handoverFileInputRef.current.value = '';
      setActionError('');
      toast.success('Handover document uploaded');
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-detail', item._id] });
    },
    onError: (err) => setActionError(getApiErrorMessage(err, 'Failed to upload handover document.')),
  });

  const completeHandoverMutation = useMutation({
    mutationFn: () =>
      adminApi.completePatentRequestHandover(item._id, {
        note: handoverNote.trim() || undefined,
      }),
    onSuccess: async () => {
      setActionError('');
      toast.success('Official handover marked complete');
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-detail', item._id] });
    },
    onError: (err) => setActionError(getApiErrorMessage(err, 'Failed to complete handover.')),
  });

  const sendMessageMutation = useMutation({
    mutationFn: () =>
      adminApi.sendPatentMessage(item._id, conversationMessage.trim()),
    onSuccess: async () => {
      setConversationMessage('');
      setActionError('');
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-messages', item._id] });
    },
    onError: (err) => setActionError(getApiErrorMessage(err, 'Failed to send message.')),
  });

  const handleStatusTransition = (targetStatus: string) => {
    statusMutation.mutate(targetStatus);
  };

  const handleHandoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setActionError('Handover file must be 3MB or less.');
      e.target.value = '';
      return;
    }
    setActionError('');
    uploadHandoverDocumentMutation.mutate(file);
  };

  const unreadCount = sortedMessages.filter((m) => m.senderRole === 'student' && !m.readAt).length;
  const deadlines = [
    { label: 'Complete Spec Deadline', value: item.completeSpecDeadline },
    { label: 'Exam Request Deadline', value: item.examRequestDeadline },
    { label: 'FER Response Deadline', value: item.ferResponseDeadline },
  ].filter((d) => d.value);

  const displayIpoNumber = item.ipoApplicationNumber || detail?.ipoApplicationNumber;
  const displayIpoDate = item.ipoFilingDate || detail?.ipoFilingDate;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 p-4 backdrop-blur-md sm:p-6">
      <div className="mx-auto flex min-h-full w-full items-start justify-center">
        <Card className="flex w-full max-w-5xl flex-col overflow-hidden p-6 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-[0.3em] text-cyan-300">Assisted Filing Case</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[currentStatus]}`}>
                  {STATUS_LABELS[currentStatus] ?? currentStatus}
                </span>
              </div>
              <h3 className="mt-1 text-2xl font-bold text-white">{item.inventionTitle}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><User className="h-3.5 w-3.5 text-slate-500" /> {item.student.displayName}</span>
                {displayIpoNumber ? <span className="font-mono text-cyan-300">IPO: {displayIpoNumber}</span> : null}
              </div>
            </div>
            <Button variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Grouped 4 Tabs */}
          <div className="mt-5 flex gap-1 border-b border-slate-800 pb-0">
            {[
              { id: 'overview', label: 'Overview & Actions' },
              { id: 'documents', label: 'Documents', badge: documents.length },
              { id: 'handover', label: 'Handover', badge: handoverDocuments.length },
              { id: 'conversation', label: 'Messages & Notes', unread: unreadCount },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-cyan-400 bg-slate-900 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 ? (
                  <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                    {tab.badge}
                  </span>
                ) : null}
                {tab.unread ? (
                  <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-cyan-400 px-1 text-[10px] font-extrabold text-slate-950">
                    {tab.unread}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Pipeline Stepper */}
                <PipelineStepper currentStatus={currentStatus} />

                {/* Status Transition Action Bar */}
                {nextStatuses.length > 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Advance Case Status</div>
                    <textarea
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="Optional status transition note..."
                      className="mb-3 min-h-16 w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500"
                    />
                    <div className="flex flex-wrap gap-2">
                      {nextStatuses.map((status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant={status === 'abandoned' || status === 'rejected' ? 'secondary' : 'primary'}
                          onClick={() => handleStatusTransition(status)}
                          disabled={statusMutation.isPending}
                        >
                          <ChevronRight className="mr-1 h-3.5 w-3.5" />
                          Advance to: {STATUS_LABELS[status] ?? status}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Key Info Cards */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ['Student Name', item.student.displayName],
                    ['Student Email', item.student.email],
                    ['Patent Type', item.patentType ?? '—'],
                    ['Specification Type', item.specificationType ?? '—'],
                    ['Applicant Entity', item.applicantEntityType ?? '—'],
                    ['Submission Date', formatDate(item.submittedAt)],
                    ['Innovation Score', String(item.student.innovationScore)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
                      <div className="mt-1 text-sm font-medium text-white">{value}</div>
                    </div>
                  ))}
                </div>

                {/* IPO Details Card */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">IPO Government Details</div>
                    {!isEditingIpo && displayIpoNumber ? (
                      <Button variant="ghost" size="sm" onClick={() => setIsEditingIpo(true)}>
                        Edit IPO Details
                      </Button>
                    ) : null}
                  </div>

                  {!displayIpoNumber || isEditingIpo ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs text-slate-400">IPO Application Number</label>
                          <input
                            type="text"
                            value={ipoAppNumber}
                            onChange={(e) => setIpoAppNumber(e.target.value)}
                            placeholder="e.g. 20261109984"
                            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-white placeholder:text-slate-500"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-400">IPO Filing Date</label>
                          <input
                            type="date"
                            value={ipoFilingDate}
                            onChange={(e) => setIpoFilingDate(e.target.value)}
                            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-white [color-scheme:dark]"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => ipoMutation.mutate()}
                          disabled={ipoMutation.isPending}
                        >
                          {ipoMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <FileCheck className="mr-1 h-3.5 w-3.5" />}
                          Save IPO Details
                        </Button>
                        {displayIpoNumber && (
                          <Button variant="secondary" size="sm" onClick={() => setIsEditingIpo(false)}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-900 bg-slate-900/60 p-3">
                        <div className="text-xs text-slate-400">Application Number</div>
                        <div className="mt-1 font-mono text-sm font-bold text-cyan-300">{displayIpoNumber}</div>
                      </div>
                      <div className="rounded-xl border border-slate-900 bg-slate-900/60 p-3">
                        <div className="text-xs text-slate-400">Filing Date</div>
                        <div className="mt-1 text-sm font-semibold text-white">{formatDate(displayIpoDate)}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Deadlines */}
                {deadlines.length > 0 && (
                  <div>
                    <div className="mb-3 text-xs uppercase tracking-[0.2em] text-cyan-300">Statutory Deadlines</div>
                    <div className="space-y-2">
                      {deadlines.map((d) => {
                        const urgency = getDeadlineUrgency(d.value);
                        return (
                          <div
                            key={d.label}
                            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3"
                          >
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-cyan-400" />
                              <span className="text-sm font-medium text-slate-300">{d.label}</span>
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
                      Intake Questionnaire Answers
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                      {Object.entries(questionnaire)
                        .filter(([, value]) => value)
                        .map(([key, value], i, arr) => (
                          <div
                            key={key}
                            className={`px-4 py-3.5 ${i !== arr.length - 1 ? 'border-b border-slate-800' : ''}`}
                          >
                            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
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
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="space-y-5">
                {documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 p-12 text-center text-slate-500">
                    <FileText className="mb-3 h-10 w-10 opacity-40 text-cyan-400" />
                    <div className="text-sm font-semibold text-white">No uploaded documents yet</div>
                    <div className="mt-1 text-xs text-slate-400 max-w-sm">
                      Documents uploaded by the student or generated during intake will be listed here for review.
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-3 text-xs uppercase tracking-[0.2em] text-cyan-300">
                      Case Documents ({documents.length})
                    </div>
                    <div className="space-y-3">
                      {documents.map((document) => {
                        const reviewStatus = document.reviewStatus ?? 'pending';
                        const noteKey = document._id ?? document.fileUrl;
                        const noteValue = documentReviewNotes[noteKey] ?? document.reviewNote ?? '';

                        return (
                          <div
                            key={document._id ?? document.fileUrl}
                            className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-cyan-400 shrink-0" />
                                  <span className="truncate text-sm font-semibold text-white">
                                    {getDocumentDisplayTitle(document)}
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-slate-400">
                                  {getDocumentDisplaySubtext(document)}
                                </div>
                              </div>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${DOCUMENT_REVIEW_STYLES[reviewStatus]}`}
                              >
                                {DOCUMENT_REVIEW_LABELS[reviewStatus] ?? reviewStatus}
                              </span>
                            </div>

                            {document.note ? (
                              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
                                <span className="font-semibold text-slate-400">Student Note:</span> {document.note}
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
                              placeholder="Add admin review note..."
                              className="mt-3 min-h-16 w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500"
                            />

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setPreviewDoc({ url: document.fileUrl, fileName: document.fileName })}
                              >
                                <Eye className="mr-1.5 h-3.5 w-3.5" />
                                Inline Preview
                              </Button>
                              <a href={document.fileUrl} target="_blank" rel="noreferrer">
                                <Button variant="secondary" size="sm">
                                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                                  Open
                                </Button>
                              </a>

                              {(['approved', 'revision_requested', 'rejected'] as const)
                                .filter((status) => !(reviewStatus === 'approved' && status === 'approved'))
                                .map((status) => (
                                <Button
                                  key={status}
                                  size="sm"
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
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 px-5 py-8 text-center text-sm text-slate-500">
                    Official document handover package becomes available after the patent is granted.
                  </div>
                ) : (
                  <>
                    <div
                      className={`rounded-2xl border px-4 py-3 text-sm ${
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
                          ? `Official handover completed on ${formatDate(officialHandover?.handedOverAt)}. Waiting for student acknowledgement.`
                          : 'Upload the final patent certificate, assignment deed, and closing package.'}
                    </div>

                    {!handoverAcknowledged ? (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">
                              Upload Official Closing Documents
                            </div>
                            <p className="mt-1 text-xs text-slate-400">
                              Attach final patent certificate, assignment deed, or closing records.
                            </p>
                          </div>
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400">
                            {uploadHandoverDocumentMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                            Upload File
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
                            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white"
                          >
                            {Object.entries(DOCUMENT_CATEGORY_LABELS)
                              .filter(([value]) => value !== 'system_generated')
                              .map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                          </select>
                          <input
                            value={handoverUploadNote}
                            onChange={(e) => setHandoverUploadNote(e.target.value)}
                            placeholder="Optional note for this file"
                            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-500"
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                      {handoverDocuments.length === 0 ? (
                        <div className="px-5 py-8 text-center text-xs text-slate-500">
                          No official handover documents uploaded yet.
                        </div>
                      ) : (
                        handoverDocuments.map((doc, idx) => (
                          <div key={doc._id ?? idx} className="flex items-center justify-between border-b border-slate-800 p-4 last:border-b-0">
                            <div>
                              <div className="text-sm font-semibold text-white">{doc.fileName}</div>
                              <div className="text-xs text-slate-400">{DOCUMENT_CATEGORY_LABELS[doc.documentCategory]} · {formatFileSize(doc.fileSizeBytes)}</div>
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => setPreviewDoc({ url: doc.fileUrl, fileName: doc.fileName })}>
                              Preview
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'conversation' && (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* 1-on-1 Student Chat */}
                <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden min-h-[360px]">
                  <div className="border-b border-slate-800 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-cyan-400" />
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                        Student Chat
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Direct 1-on-1 channel with {item.student.displayName}
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-72">
                    {messagesQuery.isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                      </div>
                    ) : sortedMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                        <Send className="mb-2 h-6 w-6 opacity-40" />
                        <div className="text-xs">No messages yet. Send a message to the student.</div>
                      </div>
                    ) : (
                      sortedMessages.map((msg) => (
                        <div
                          key={msg._id}
                          className={`flex ${msg.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs ${
                              msg.senderRole === 'admin'
                                ? 'bg-cyan-500/15 border border-cyan-500/30 text-white'
                                : 'bg-slate-800 text-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-bold text-slate-400">{msg.senderName}</span>
                              <span className="text-[10px] text-slate-500">
                                {new Date(msg.sentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="leading-relaxed whitespace-pre-wrap">{msg.message}</div>
                            {msg.readAt && msg.senderRole === 'admin' && (
                              <div className="mt-1 flex justify-end">
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-400">
                                  <CheckCircle2 className="h-3 w-3" /> Read
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="border-t border-slate-800 p-3">
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
                        className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs text-white placeholder:text-slate-500"
                        placeholder="Type message to student..."
                      />
                      <Button
                        size="sm"
                        onClick={() => sendMessageMutation.mutate()}
                        disabled={!conversationMessage.trim() || sendMessageMutation.isPending}
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Internal Admin Notes Log */}
                <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-950 p-4 min-h-[360px]">
                  <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <MessageSquarePlus className="h-4 w-4 text-emerald-400" />
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                        Internal Admin Notes History
                      </span>
                    </div>
                    <span className="text-[10px] uppercase text-slate-500">Only visible to admins</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2.5 max-h-60 mb-4 pr-1">
                    {!detail?.adminNotes ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-slate-500">
                        No internal notes saved on this case yet.
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
                        {detail.adminNotes}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 mt-auto">
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add a new internal note..."
                      className="min-h-16 w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => noteMutation.mutate()}
                      disabled={!noteText.trim() || noteMutation.isPending}
                    >
                      {noteMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <MessageSquarePlus className="mr-1 h-3.5 w-3.5" />}
                      Add Internal Note
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Error */}
          {actionError && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {actionError}
            </div>
          )}
        </Card>
      </div>

      <InlineDocPreviewModal
        url={previewDoc?.url ?? null}
        fileName={previewDoc?.fileName ?? ''}
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PatentRequests() {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<FilterGroup>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCase, setSelectedCase] = useState<AdminPatentRequestListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTargetStatus, setBulkTargetStatus] = useState<string>('');

  const requestsQuery = useQuery({
    queryKey: ['admin-patent-requests'],
    queryFn: () => adminApi.getPatentRequests(),
    refetchInterval: 60_000,
  });

  const allItems = useMemo(() => requestsQuery.data?.items ?? [], [requestsQuery.data]);

  const groupFilteredItems = useMemo(() => {
    if (activeFilter === 'all') return allItems;
    return allItems.filter((item) => STATUS_GROUP_MAP[item.status] === activeFilter);
  }, [allItems, activeFilter]);

  const items = useMemo(() => {
    if (!searchQuery.trim()) return groupFilteredItems;
    const q = searchQuery.toLowerCase().trim();
    return groupFilteredItems.filter(
      (item) =>
        item.inventionTitle.toLowerCase().includes(q) ||
        item.student.displayName.toLowerCase().includes(q) ||
        item.student.email.toLowerCase().includes(q) ||
        (item.ipoApplicationNumber && item.ipoApplicationNumber.toLowerCase().includes(q)),
    );
  }, [groupFilteredItems, searchQuery]);

  const counts = useMemo(() => {
    const result: Record<FilterGroup, number> = { all: allItems.length, intake: 0, filing: 0, examination: 0, decided: 0 };
    allItems.forEach((item) => {
      const group = STATUS_GROUP_MAP[item.status];
      if (group) result[group]++;
    });
    return result;
  }, [allItems]);

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i._id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const bulkStatusMutation = useMutation({
    mutationFn: async (targetStatus: string) => {
      for (const id of selectedIds) {
        await adminApi.updatePatentRequestStatus(id, { status: targetStatus });
      }
    },
    onSuccess: async () => {
      toast.success(`Updated ${selectedIds.length} patent cases`);
      setSelectedIds([]);
      setBulkTargetStatus('');
      await queryClient.invalidateQueries({ queryKey: ['admin-patent-requests'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Bulk update failed.')),
  });

  return (
    <div className="space-y-6">
      {/* Top Filter & Search Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <OptionTabs
          items={FILTER_TABS.map((tab) => ({
            id: tab.key,
            label: `${tab.label} (${counts[tab.key]})`,
          }))}
          activeId={activeFilter}
          onChange={setActiveFilter}
          aria-label="Patent request status filters"
        />

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search title, student, email, IPO #..."
            className="w-full rounded-2xl border border-slate-800 bg-slate-900 pl-10 pr-9 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[950px]">
            <div className="grid grid-cols-[40px,1.4fr,0.8fr,130px,180px,120px,100px] gap-4 border-b border-slate-800 bg-slate-900 px-5 py-4 text-xs uppercase tracking-[0.2em] text-slate-400">
              <div>
                <input
                  type="checkbox"
                  checked={items.length > 0 && selectedIds.length === items.length}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                />
              </div>
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
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <FileText className="mb-3 h-10 w-10 text-cyan-400/50" />
                  <div className="text-base font-semibold text-white">No patent cases found</div>
                  <div className="mt-1 text-xs text-slate-400 max-w-sm text-center">
                    {searchQuery
                      ? `No cases matched search "${searchQuery}". Try searching by invention title, student name, or IPO number.`
                      : `All assisted patent cases in category "${activeFilter}" are up to date.`}
                  </div>
                  {searchQuery && (
                    <Button variant="secondary" size="sm" className="mt-4" onClick={() => setSearchQuery('')}>
                      Clear Search Filter
                    </Button>
                  )}
                </div>
              ) : (
                items.map((item) => {
                  const deadlineInfo = getNearestDeadlineInfo(item);
                  const isSelected = selectedIds.includes(item._id);

                  return (
                    <div
                      key={item._id}
                      className={`grid grid-cols-[40px,1.4fr,0.8fr,130px,180px,120px,100px] items-center gap-4 px-5 py-4 transition-colors ${
                        isSelected ? 'bg-cyan-500/5' : 'hover:bg-slate-900/60'
                      }`}
                    >
                      <div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(item._id)}
                          className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-white">{item.inventionTitle}</div>
                        <div className="mt-0.5 truncate text-xs text-slate-400">
                          {item.student.displayName} · {item.specificationType ?? 'N/A'}
                        </div>
                      </div>
                      <div>
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            STATUS_COLORS[item.status] ?? 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {STATUS_LABELS[item.status] ?? item.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">{formatDate(item.submittedAt)}</div>
                      <div>
                        {deadlineInfo?.urgency ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${deadlineInfo.urgency.color}`}
                          >
                            <Clock className="h-3 w-3 shrink-0" />
                            <span className="truncate">{deadlineInfo.name}: {deadlineInfo.urgency.label}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </div>
                      <div className="truncate font-mono text-xs text-slate-300">{item.ipoApplicationNumber ?? '—'}</div>
                      <div>
                        <Button variant="secondary" size="sm" onClick={() => setSelectedCase(item)}>
                          Open
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-cyan-500/40 bg-slate-950/95 px-6 py-3.5 shadow-2xl backdrop-blur-xl">
          <div className="text-xs font-bold text-cyan-300">{selectedIds.length} case(s) selected</div>
          <div className="h-4 w-px bg-slate-800" />
          <select
            value={bulkTargetStatus}
            onChange={(e) => setBulkTargetStatus(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white"
          >
            <option value="">Select target status...</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={() => bulkTargetStatus && bulkStatusMutation.mutate(bulkTargetStatus)}
            disabled={!bulkTargetStatus || bulkStatusMutation.isPending}
          >
            {bulkStatusMutation.isPending ? 'Updating...' : 'Advance Selected'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
            Clear
          </Button>
        </div>
      ) : null}

      {selectedCase && <CaseDetailModal item={selectedCase} onClose={() => setSelectedCase(null)} />}
    </div>
  );
}
