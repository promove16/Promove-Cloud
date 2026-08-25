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
  { key: 'submitted', label: 'Submitted' },
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

const QUESTION_LABELS: Record<keyof AdminPatentItem['questionnaire'], string> = {
  problemStatement:
    'What problem does your innovation solve, and who are the primary users or stakeholders affected by this problem?',
  solutionDifferentiation: 'How is your solution different from existing solutions currently available in the market?',
  coreInnovation: 'What is the core unique feature or innovation in your solution?',
  priorArtStatus:
    'Have you conducted any prior art search or reviewed similar patents? If yes, provide details or references. If not, say so clearly.',
  workingMechanism: 'Explain the working mechanism or process flow of your innovation.',
  keyComponents: 'What are the key components involved: hardware, software, process, or a combination?',
  developmentStage: 'What is the current stage of your innovation?',
  documentationReadiness:
    'Do you have any prototypes, diagrams, or technical documentation ready? Mention what is available and upload supporting files if you have them.',
  inventorOwnership: 'Who are the inventors or creators of this innovation?',
  developmentContext: 'Was this innovation developed independently or under any institution, company, or funded program?',
  targetMarkets: 'Which industries or markets can this innovation be applied to?',
  commercializationStrategy: 'What is your intended commercialization strategy?',
  publicDisclosureStatus:
    'Have you publicly disclosed this innovation anywhere such as pitch events, social media, competitions, or publications?',
  legalAgreements: 'Are there any existing NDAs or legal agreements related to this innovation?',
  ipProtectionType: 'What type of intellectual property protection are you seeking?',
};

const QUESTION_VALUE_LABELS: Record<string, Record<string, string>> = {
  developmentStage: {
    idea: 'Idea',
    prototype: 'Prototype',
    mvp: 'MVP',
    market_ready: 'Market-ready',
  },
  inventorOwnership: {
    individual: 'Individual',
    team: 'Team',
    organization: 'Organization',
  },
  commercializationStrategy: {
    build_startup: 'Build startup',
    license: 'License',
    sell: 'Sell',
    partnership: 'Partnership',
  },
  ipProtectionType: {
    patent: 'Patent',
    copyright: 'Copyright',
    trademark: 'Trademark',
    design: 'Design',
  },
};

const formatKey = (value: string) => value.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();

const formatQuestionValue = (key: string, value: string) => QUESTION_VALUE_LABELS[key]?.[value] ?? value;

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
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950 p-4 backdrop-blur-sm sm:p-6">
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
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold">{doc.fileName}</div>
                      <div className="mt-1 text-[10px] text-slate-400">{formatBytes(doc.fileSizeBytes)}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Main Preview Area */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-4">
                {active ? (
                  <div className="flex flex-1 flex-col justify-between gap-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{active.fileName}</div>
                        <div className="text-xs text-slate-400">{formatBytes(active.fileSizeBytes)}</div>
                      </div>
                      <a
                        href={active.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Open Original
                      </a>
                    </div>
                    {active.fileUrl.match(/\.(png|jpe?g|webp|gif|svg)$/i) ? (
                      <div className="flex flex-1 items-center justify-center overflow-auto rounded-xl bg-slate-950 p-4">
                        <img src={active.fileUrl} alt={active.fileName} className="max-h-96 max-w-full rounded-lg object-contain" />
                      </div>
                    ) : (
                      <div className="flex flex-1 flex-col items-center justify-center rounded-xl bg-slate-950 p-8 text-center text-slate-400">
                        <ImageIcon className="h-12 w-12 mb-3 text-cyan-400/60" />
                        <div className="text-sm font-semibold text-white">{active.fileName}</div>
                        <div className="mt-1 text-xs text-slate-500">Document preview available in popup.</div>
                        <a
                          href={active.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors"
                        >
                          Open Document
                        </a>
                      </div>
                    )}
                  </div>
                ) : null}
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
  const [actionError, setActionError] = useState('');
  const [docsOpen, setDocsOpen] = useState(false);
  const [showConfirmApprove, setShowConfirmApprove] = useState(false);

  const approveMutation = useMutation({
    mutationFn: () => adminApi.approvePatent(patent!._id),
    onSuccess: async () => {
      setActionError('');
      setShowConfirmApprove(false);
      await queryClient.invalidateQueries({ queryKey: ['admin-patents'] });
      onClose();
    },
    onError: (error: unknown) => {
      setActionError(getApiErrorMessage(error, 'Unable to approve this patent.'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => adminApi.rejectPatent(patent!._id, reason.trim()),
    onSuccess: async () => {
      setActionError('');
      await queryClient.invalidateQueries({ queryKey: ['admin-patents'] });
      onClose();
    },
    onError: (error: unknown) => {
      setActionError(getApiErrorMessage(error, 'Unable to reject this patent.'));
    },
  });

  if (!open || !patent) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 p-4 backdrop-blur-sm sm:p-6">
      <div className="mx-auto flex min-h-full w-full items-start justify-center">
        <Card className="flex w-full max-w-6xl flex-col overflow-hidden p-6 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Direct Intake Review</div>
              <h2 className="mt-2 text-2xl font-bold text-white">{patent.projectTitle}</h2>
              <div className="mt-1 text-sm text-slate-400">
                Submitted by <span className="font-semibold text-white">{patent.student?.displayName ?? 'Unknown'}</span>
              </div>
            </div>
            <Button variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-6 grid min-h-0 flex-1 gap-6 overflow-y-auto pr-1 lg:grid-cols-[1fr,340px]">
            <section className="min-w-0 space-y-6">
              <div>
                <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Intake Questionnaire</div>
                <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
                  {Object.entries(patent.questionnaire).map(([key, value]) => (
                    <div key={key} className="border-b border-slate-800 px-5 py-4 last:border-b-0">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {QUESTION_LABELS[key as keyof AdminPatentItem['questionnaire']] ?? formatKey(key)}
                      </div>
                      <div className="mt-2 text-sm leading-relaxed text-white">
                        {formatQuestionValue(key, value as string) || <span className="text-slate-600">Not provided</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Government Filing Details</div>
                <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
                  {!patent.filingDocuments ? (
                    <div className="px-5 py-6 text-sm text-slate-500">No government filing documents attached.</div>
                  ) : (
                    [
                      ['Invention category', patent.filingDocuments.inventionCategory ? INVENTION_CATEGORY_LABELS[patent.filingDocuments.inventionCategory] : '—'],
                      ['Specification type', patent.filingDocuments.specificationType ? SPECIFICATION_TYPE_LABELS[patent.filingDocuments.specificationType] : '—'],
                      ['Prototype status', patent.filingDocuments.prototypeStatus ? PROTOTYPE_STATUS_LABELS[patent.filingDocuments.prototypeStatus] : '—'],
                      ['Inventor journal summary', patent.filingDocuments.inventorJournalSummary || '—'],
                      ['Prior art search summary', patent.filingDocuments.priorArtSearchSummary || '—'],
                      ['Specification draft', patent.filingDocuments.specificationDraft || '—'],
                      ['Abstract draft', patent.filingDocuments.abstractDraft || '—'],
                      ['Claims draft', patent.filingDocuments.claimsDraft || '—'],
                      ['Drawings prepared', formatBoolean(patent.filingDocuments.drawingsPrepared)],
                      ['Drawings notes', patent.filingDocuments.drawingsNotes || '—'],
                      ['Form 1 confirmed', formatBoolean(patent.filingDocuments.form1ApplicantDetailsConfirmed)],
                      ['Form 3 details', patent.filingDocuments.form3ForeignFilingDetails || 'Not provided'],
                      ['Form 5 confirmed', formatBoolean(patent.filingDocuments.form5InventorshipConfirmed)],
                      ['Form 26 required', formatBoolean(patent.filingDocuments.form26PowerOfAttorneyRequired)],
                      ['Form 26 details', patent.filingDocuments.form26PowerOfAttorneyDetails || 'Not required'],
                      ['Examination request plan', patent.filingDocuments.examinationRequestPlan || '—'],
                      ['Public disclosure checked', formatBoolean(patent.filingDocuments.publicDisclosureChecked)],
                      ['Professional support needed', formatBoolean(patent.filingDocuments.professionalSupportNeeded)],
                      ['Cost management notes', patent.filingDocuments.costManagementNotes || 'Not provided'],
                    ].map(([label, value], index, entries) => (
                      <div
                        key={label}
                        className={`px-5 py-4 ${index !== entries.length - 1 ? 'border-b border-slate-800' : ''}`}
                      >
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
                        <div className="mt-1 text-sm leading-relaxed text-white">{value}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="min-w-0 space-y-6">
              <div>
                <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Student Innovation Score</div>
                <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
                  <div className="flex items-baseline justify-between">
                    <div className="text-5xl font-bold leading-none text-white">{patent.student.innovationScore}</div>
                    <span className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 text-[11px] font-medium text-cyan-300">
                      Auto-Calculated
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-slate-400 leading-relaxed">
                    Student's score breakdown from innovation assessment (+{PATENT_APPROVAL_SCORE} pts awarded upon patent approval).
                  </div>
                  <div className="mt-5 space-y-2">
                    {Object.entries(patent.student.scoreBreakdown).map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs"
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
                <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
                  {!patent.supportingDocuments?.length ? (
                    <div className="text-sm text-slate-500">No supporting documents were attached.</div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-sm text-slate-400">
                        {patent.supportingDocuments.length} document{patent.supportingDocuments.length !== 1 ? 's' : ''} attached
                      </div>
                      <Button variant="secondary" onClick={() => setDocsOpen(true)}>
                        <Files className="mr-2 h-4 w-4" />
                        View Documents ({patent.supportingDocuments.length})
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

          {/* Custom Confirmation Banner */}
          {showConfirmApprove && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold text-emerald-300">Confirm Patent Approval</div>
                <div className="text-xs text-emerald-200/80">
                  This action will approve the direct intake submission and award +{PATENT_APPROVAL_SCORE} Innovation Score points to {patent.student.displayName}.
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowConfirmApprove(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                  {approveMutation.isPending ? 'Approving...' : 'Confirm & Approve'}
                </Button>
              </div>
            </div>
          )}

          {patent && ['submitted', 'under_review'].includes(patent.status) && !showConfirmApprove ? (
            <div className="mt-6 flex shrink-0 flex-col gap-4 border-t border-slate-800 bg-slate-900 pt-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="w-full max-w-xl">
                <div className="text-sm text-slate-400">Approving will award +{PATENT_APPROVAL_SCORE} Innovation Score to student.</div>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Enter a rejection reason (minimum 20 characters)"
                  className="mt-3 min-h-24 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => rejectMutation.mutate()} disabled={reason.trim().length < 20 || rejectMutation.isPending}>
                  {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
                </Button>
                <Button onClick={() => setShowConfirmApprove(true)}>
                  Approve (+{PATENT_APPROVAL_SCORE} pts)
                </Button>
              </div>
            </div>
          ) : !showConfirmApprove ? (
            <div className="mt-6 flex shrink-0 items-center gap-3 border-t border-slate-800 pt-5">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                patent?.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
              }`}>
                {patent?.status === 'approved' ? 'Approved' : 'Rejected'}
              </span>
              <span className="text-sm text-slate-400">
                {patent?.status === 'approved' ? 'This patent intake has been approved and score awarded.' : 'This patent intake was rejected.'}
                {patent?.adminNotes && ` Reason: ${patent.adminNotes}`}
              </span>
            </div>
          ) : null}
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
      <OptionTabs
        items={tabs.map((tab) => ({ id: tab.key, label: tab.label }))}
        activeId={activeTab}
        onChange={setActiveTab}
        aria-label="Direct patent intake filters"
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[850px]">
            <div className="grid grid-cols-[1.4fr,1fr,160px,120px,100px,140px] gap-4 border-b border-slate-800 bg-slate-900 px-5 py-4 text-xs uppercase tracking-[0.3em] text-slate-400">
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
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Shield className="mb-3 h-8 w-8 opacity-40 text-emerald-400" />
                  <div className="text-sm font-medium text-slate-300">No submissions in this bucket</div>
                  <div className="mt-1 text-xs text-slate-500 max-w-sm text-center">
                    Direct patent intake submissions in state <span className="font-semibold text-slate-400">{activeTab}</span> will appear here automatically.
                  </div>
                </div>
              ) : (
                patents.map((patent) => (
                  <div key={patent._id} className="grid grid-cols-[1.4fr,1fr,160px,120px,100px,140px] items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-900/60">
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
                          className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300 transition-colors"
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
          </div>
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
