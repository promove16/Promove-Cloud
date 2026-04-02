import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Files, ImageIcon, Shield, X } from 'lucide-react';
import { adminApi, AdminPatentItem } from '../../api/admin.api';
import { PatentSupportingDocument } from '../../types/patent.types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { OptionTabs } from '../../components/ui/OptionTabs';
import { Spinner } from '../../components/ui/Spinner';
import { getApiErrorMessage } from '../../utils/apiError';

const PATENT_APPROVAL_SCORE = 25;

type TabKey = 'submitted' | 'under_review' | 'approved' | 'rejected';

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'submitted', label: 'Pending' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const INVENTION_CATEGORY_LABELS: Record<NonNullable<AdminPatentItem['filingDocuments']>['inventionCategory'], string> = {
  mobile_app_backend: 'Mobile app with unique backend',
  iot_hardware_interface: 'IoT and hardware interface',
  mechanical_improvement: 'Mechanical improvement',
  software_hardware_integration: 'Software-hardware integration',
  other: 'Other invention type',
};

const SPECIFICATION_TYPE_LABELS: Record<NonNullable<AdminPatentItem['filingDocuments']>['specificationType'], string> = {
  provisional: 'Provisional specification',
  complete: 'Complete specification',
};

const PROTOTYPE_STATUS_LABELS: Record<NonNullable<AdminPatentItem['filingDocuments']>['prototypeStatus'], string> = {
  concept_only: 'Concept only',
  partial_prototype: 'Partial prototype',
  working_prototype: 'Working prototype',
  validated_prototype: 'Validated prototype',
};

const formatKey = (value: string) => value.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();

const formatBoolean = (value: boolean) => (value ? 'Yes' : 'No');

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function SupportingDocsModal({
  documents,
  patentTitle,
  open,
  onClose,
}: {
  documents: PatentSupportingDocument[];
  patentTitle: string;
  open: boolean;
  onClose: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!open) return null;

  const active = documents[activeIndex];

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm sm:p-6">
      <div className="mx-auto flex min-h-full w-full items-start justify-center">
        <Card className="flex w-full max-w-5xl flex-col overflow-hidden p-6 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Supporting Documents</div>
              <h3 className="mt-2 text-2xl font-bold text-white">{patentTitle}</h3>
              <div className="mt-1 text-sm text-slate-400">{documents.length} document{documents.length !== 1 ? 's' : ''} attached</div>
            </div>
            <Button variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {documents.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center py-16 text-slate-500">
              <Files className="h-10 w-10 mb-3 opacity-40" />
              <div className="text-sm">No supporting documents were attached.</div>
            </div>
          ) : (
            <div className="mt-6 grid min-h-0 flex-1 gap-6 overflow-hidden lg:grid-cols-[240px,1fr]">
              {/* Sidebar list */}
              <div className="flex flex-col gap-2 overflow-y-auto pr-1">
                {documents.map((doc, i) => (
                  <button
                    key={`${doc.fileUrl}-${i}`}
                    onClick={() => setActiveIndex(i)}
                    className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
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
                      <div className="truncate text-sm font-medium">{doc.fileName}</div>
                      <div className="mt-0.5 text-xs uppercase tracking-[0.15em] text-slate-500">
                        {doc.fileType} · {formatBytes(doc.fileSizeBytes)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Preview pane */}
              <div className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/60">
                <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
                  <div>
                    <div className="font-semibold text-white">{active.fileName}</div>
                    <div className="mt-0.5 text-xs uppercase tracking-[0.15em] text-slate-500">
                      {active.fileType} · {formatBytes(active.fileSizeBytes)}
                    </div>
                  </div>
                  <a
                    href={active.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                  >
                    Open in new tab
                  </a>
                </div>

                {active.note && (
                  <div className="border-b border-slate-800 px-5 py-3 text-sm text-slate-400">
                    <span className="font-medium text-slate-300">Note: </span>{active.note}
                  </div>
                )}

                <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
                  {active.fileType === 'image' ? (
                    <img
                      src={active.fileUrl}
                      alt={active.fileName}
                      className="max-h-full max-w-full rounded-2xl object-contain"
                    />
                  ) : (
                    <iframe
                      src={active.fileUrl}
                      title={active.fileName}
                      className="h-full min-h-[480px] w-full rounded-2xl border-0"
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ReviewModal({
  patent,
  open,
  onClose,
}: {
  patent: AdminPatentItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [docsOpen, setDocsOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  const approveMutation = useMutation({
    mutationFn: () => adminApi.approvePatent(patent!._id),
    onSuccess: async () => {
      onClose();
      setActionError('');
      await queryClient.invalidateQueries({ queryKey: ['admin-patents'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
    onError: (err: unknown) => {
      setActionError(getApiErrorMessage(err, 'Failed to approve patent. Please try again.'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => adminApi.rejectPatent(patent!._id, reason),
    onSuccess: async () => {
      onClose();
      setReason('');
      setActionError('');
      await queryClient.invalidateQueries({ queryKey: ['admin-patents'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
    onError: (err: unknown) => {
      setActionError(getApiErrorMessage(err, 'Failed to reject patent. Please try again.'));
    },
  });

  if (!open || !patent) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm sm:p-6">
      <div className="mx-auto flex min-h-full w-full items-start justify-center">
        <Card className="flex w-full max-w-4xl flex-col overflow-hidden p-6 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Patent Review</div>
              <h3 className="mt-2 text-2xl font-bold text-white">{patent.projectTitle}</h3>
            </div>
            <Button variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-6 grid min-h-0 flex-1 gap-8 overflow-y-auto pr-2 lg:grid-cols-[1.2fr,0.9fr]">
            <section className="min-w-0 space-y-6">
              <div>
                <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Questionnaire</div>
                <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/60">
                  {Object.entries(patent.questionnaire).map(([label, value], index, entries) => (
                    <div
                      key={label}
                      className={`px-5 py-5 ${index !== entries.length - 1 ? 'border-b border-slate-800' : ''}`}
                    >
                      <div className="text-sm font-medium text-slate-500">{formatKey(label)}</div>
                      <div className="mt-3 text-base leading-8 text-white">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Filing Checklist</div>
                <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/60">
                  {!patent.filingDocuments ? (
                    <div className="px-5 py-5 text-base text-slate-500">No filing documents submitted.</div>
                  ) : [
                    ['Invention category', INVENTION_CATEGORY_LABELS[patent.filingDocuments.inventionCategory]],
                    ['Specification type', SPECIFICATION_TYPE_LABELS[patent.filingDocuments.specificationType]],
                    ['Prototype status', PROTOTYPE_STATUS_LABELS[patent.filingDocuments.prototypeStatus]],
                    ['Inventor journal summary', patent.filingDocuments.inventorJournalSummary],
                    ['Prior art search summary', patent.filingDocuments.priorArtSearchSummary],
                    ['Specification draft', patent.filingDocuments.specificationDraft],
                    ['Abstract draft', patent.filingDocuments.abstractDraft],
                    ['Claims draft', patent.filingDocuments.claimsDraft],
                    ['Drawings prepared', formatBoolean(patent.filingDocuments.drawingsPrepared)],
                    ['Drawings notes', patent.filingDocuments.drawingsNotes],
                    ['Form 1 confirmed', formatBoolean(patent.filingDocuments.form1ApplicantDetailsConfirmed)],
                    ['Form 3 details', patent.filingDocuments.form3ForeignFilingDetails || 'Not provided'],
                    ['Form 5 confirmed', formatBoolean(patent.filingDocuments.form5InventorshipConfirmed)],
                    ['Form 26 required', formatBoolean(patent.filingDocuments.form26PowerOfAttorneyRequired)],
                    ['Form 26 details', patent.filingDocuments.form26PowerOfAttorneyDetails || 'Not required'],
                    ['Examination request plan', patent.filingDocuments.examinationRequestPlan],
                    ['Public disclosure checked', formatBoolean(patent.filingDocuments.publicDisclosureChecked)],
                    ['Professional support needed', formatBoolean(patent.filingDocuments.professionalSupportNeeded)],
                    ['Cost management notes', patent.filingDocuments.costManagementNotes || 'Not provided'],
                  ].map(([label, value], index, entries) => (
                    <div
                      key={label}
                      className={`px-5 py-5 ${index !== entries.length - 1 ? 'border-b border-slate-800' : ''}`}
                    >
                      <div className="text-sm font-medium text-slate-500">{label}</div>
                      <div className="mt-3 text-base leading-8 text-white">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="min-w-0 space-y-6">
              <div>
                <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Student Score</div>
                <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
                  <div className="text-5xl font-bold leading-none text-white">{patent.student.innovationScore}</div>
                  <div className="mt-3 text-sm text-slate-400">Full score breakdown is visible before review.</div>
                  <div className="mt-6 space-y-2">
                    {Object.entries(patent.student.scoreBreakdown).map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm"
                      >
                        <span className="text-slate-300">{formatKey(label)}</span>
                        <span className="font-semibold text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Supporting Documents</div>
                <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
                  {!patent.supportingDocuments?.length ? (
                    <div className="text-sm text-slate-500">No supporting documents were attached.</div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-sm text-slate-400">
                        {patent.supportingDocuments.length} document{patent.supportingDocuments.length !== 1 ? 's' : ''} attached
                      </div>
                      <Button variant="secondary" onClick={() => setDocsOpen(true)}>
                        <Files className="mr-2 h-4 w-4" />
                        View Documents
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          {actionError && (
            <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {actionError}
            </div>
          )}

          {patent && ['submitted', 'under_review'].includes(patent.status) ? (
            <div className="mt-6 flex shrink-0 flex-col gap-4 border-t border-slate-800 bg-slate-900/95 pt-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="w-full max-w-xl">
                <div className="text-sm text-slate-400">Approve will award {PATENT_APPROVAL_SCORE} Innovation Score.</div>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Enter a rejection reason (minimum 20 characters)"
                  className="mt-3 min-h-28 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => rejectMutation.mutate()} disabled={reason.trim().length < 20 || rejectMutation.isPending}>
                  Reject
                </Button>
                <Button onClick={() => {
                  if (window.confirm(`This will award ${PATENT_APPROVAL_SCORE} Innovation Score. Confirm?`)) {
                    approveMutation.mutate();
                  }
                }} disabled={approveMutation.isPending}>
                  Approve (+{PATENT_APPROVAL_SCORE} pts)
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex shrink-0 items-center gap-3 border-t border-slate-800 pt-5">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                patent?.status === 'approved' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
              }`}>
                {patent?.status === 'approved' ? 'Approved' : 'Rejected'}
              </span>
              <span className="text-sm text-slate-400">
                {patent?.status === 'approved' ? 'This patent has already been approved.' : 'This patent has already been rejected.'}
                {patent?.adminNotes && ` Reason: ${patent.adminNotes}`}
              </span>
            </div>
          )}
        </Card>
      </div>
      {patent && (
        <SupportingDocsModal
          documents={patent.supportingDocuments ?? []}
          patentTitle={patent.projectTitle}
          open={docsOpen}
          onClose={() => setDocsOpen(false)}
        />
      )}
    </div>
  );
}

export default function Patents() {
  const [activeTab, setActiveTab] = useState<TabKey>('submitted');
  const [selectedPatent, setSelectedPatent] = useState<AdminPatentItem | null>(null);
  const [docsPatent, setDocsPatent] = useState<AdminPatentItem | null>(null);

  const patentsQuery = useQuery({
    queryKey: ['admin-patents', activeTab],
    queryFn: () => adminApi.getPatents(activeTab),
    refetchInterval: 60_000,
  });

  const patents = useMemo(() => patentsQuery.data ?? [], [patentsQuery.data]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Patents</div>
          <h1 className="mt-2 text-3xl font-bold text-white">Patent Review</h1>
          <p className="mt-2 text-slate-400">Review submissions before approving score awards.</p>
        </div>
      </div>

      <OptionTabs
        items={tabs.map((tab) => ({ id: tab.key, label: tab.label }))}
        activeId={activeTab}
        onChange={setActiveTab}
        aria-label="Patent status filters"
      />

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1.4fr,1fr,160px,120px,100px,140px] border-b border-slate-800 bg-slate-900/70 px-5 py-4 text-xs uppercase tracking-[0.3em] text-slate-400">
          <div>Student</div>
          <div>Project</div>
          <div>Submitted</div>
          <div>Status</div>
          <div>Docs</div>
          <div>Actions</div>
        </div>
        <div className="divide-y divide-slate-800">
          {patentsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12"><Spinner /></div>
          ) : patents.length === 0 ? (
            <div className="px-5 py-12 text-sm text-slate-400">No patents in this bucket.</div>
          ) : (
            patents.map((patent) => (
              <div key={patent._id} className="grid grid-cols-[1.4fr,1fr,160px,120px,100px,140px] items-center gap-4 px-5 py-5">
                <div className="font-semibold text-white">{patent.student.displayName}</div>
                <div className="text-slate-300">{patent.projectTitle}</div>
                <div className="text-slate-400">{new Date(patent.submittedAt).toLocaleDateString('en-IN')}</div>
                <div>
                  <Badge>{patent.status}</Badge>
                </div>
                <div>
                  {patent.supportingDocuments?.length ? (
                    <button
                      onClick={() => setDocsPatent(patent)}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors"
                    >
                      <Files className="h-3.5 w-3.5" />
                      {patent.supportingDocuments.length}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-600">—</span>
                  )}
                </div>
                <div>
                  <Button variant="secondary" onClick={() => setSelectedPatent(patent)}>
                    <Shield className="mr-2 h-4 w-4" />
                    Review
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <ReviewModal patent={selectedPatent} open={Boolean(selectedPatent)} onClose={() => setSelectedPatent(null)} />
      <SupportingDocsModal
        documents={docsPatent?.supportingDocuments ?? []}
        patentTitle={docsPatent?.projectTitle ?? ''}
        open={Boolean(docsPatent)}
        onClose={() => setDocsPatent(null)}
      />
    </div>
  );
}
