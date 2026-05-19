import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from 'react';
import { toast } from '../../app/components/ui/sonner';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { getApiErrorMessage } from '../../utils/apiError';
import type {
  ComplianceEvidenceUploadResponse,
  ComplianceFrameworkItem,
  InstitutionPolicy,
  InstitutionPolicyEvidence,
  InstitutionPolicyEvidenceType,
  InstitutionPolicySubmissionRecord,
} from '../../types/school.types';

type InstitutionMode = 'school' | 'college';

interface PolicyDraft {
  id: string;
  name: string;
  status: InstitutionPolicy['status'];
  lastUpdated: string;
  evidence: EvidenceDraft[];
}

interface EvidenceDraft {
  id: string;
  title: string;
  type: InstitutionPolicyEvidenceType;
  url: string;
  notes: string;
  submittedAt: string;
  fileName: string;
  fileSizeBytes?: number;
  isUploading?: boolean;
  isSubmitted?: boolean;
}

interface InstitutionComplianceVerificationTabProps {
  mode: InstitutionMode;
  frameworks: ComplianceFrameworkItem[];
  submission?: InstitutionPolicySubmissionRecord | null;
  isLoadingSubmission?: boolean;
  isSubmitting?: boolean;
  isRequestingEdit?: boolean;
  uploadEvidenceFile: (file: File) => Promise<ComplianceEvidenceUploadResponse>;
  onRequestEvidenceEdit?: (payload: {
    submissionId: string;
    policyName: string;
    evidenceTitle: string;
    evidenceUrl: string;
  }) => void;
  onSubmit: (payload: {
    policies: InstitutionPolicy[];
    summaryNote?: string;
  }) => void;
}

const reviewToneClass: Record<string, string> = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  rejected: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

const policyStatusOptions: InstitutionPolicy['status'][] = [
  'Active',
  'On Track',
  'Pending',
  'Inactive',
];
const evidenceTypeOptions: Array<{
  value: InstitutionPolicyEvidenceType;
  label: string;
}> = [
  { value: 'policy_document', label: 'Policy document' },
  { value: 'activity_report', label: 'Activity report' },
  { value: 'attendance_log', label: 'Attendance log' },
  { value: 'photo', label: 'Photo proof' },
  { value: 'video', label: 'Video proof' },
  { value: 'meeting_minutes', label: 'Meeting minutes' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'mou', label: 'MoU' },
  { value: 'external_audit', label: 'External audit' },
  { value: 'other', label: 'Other' },
];
const maxEvidenceFileSizeBytes = 50 * 1024 * 1024;
const fieldClassName =
  'h-10 min-w-0 w-full rounded-lg border-0 bg-slate-950/80 px-3 text-sm text-white shadow-inner shadow-black/20 outline-none transition placeholder:text-slate-500 focus:bg-slate-950 focus:ring-2 focus:ring-cyan-400/25';
const policyCardClassName =
  'overflow-hidden border border-slate-700 bg-slate-900';
const evidencePanelClassName = 'bg-slate-950/60 px-4 py-4';

const createDraftId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getEvidenceInputId = (policyId: string, evidenceId: string) =>
  `compliance-evidence-${policyId}-${evidenceId}`;

const formatReviewStatus = (
  status: InstitutionPolicySubmissionRecord['status'],
) =>
  status === 'pending'
    ? 'Pending Review'
    : status === 'approved'
      ? 'Approved'
      : 'Rejected';

const formatFrameworkStatus = (
  framework: ComplianceFrameworkItem,
): InstitutionPolicy['status'] => {
  if (framework.status === 'on_track') {
    return 'On Track';
  }

  if (framework.status === 'needs_attention') {
    return 'Inactive';
  }

  return 'Pending';
};

const formatDateInput = (value?: string) => {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString().slice(0, 10);
};

const createEmptyEvidenceDraft = (): EvidenceDraft => ({
  id: createDraftId(),
  title: '',
  type: 'policy_document',
  url: '',
  notes: '',
  submittedAt: '',
  fileName: '',
});

const createEvidenceDrafts = (
  evidence: InstitutionPolicyEvidence[] = [],
): EvidenceDraft[] => {
  if (evidence.length === 0) {
    return [createEmptyEvidenceDraft()];
  }

  const submittedEvidence = evidence.map((item) => ({
    id: createDraftId(),
    title: item.title,
    type: item.type,
    url: item.url,
    notes: item.notes ?? '',
    submittedAt: formatDateInput(item.submittedAt),
    fileName: item.title,
    isSubmitted: true,
  }));

  return [...submittedEvidence, createEmptyEvidenceDraft()];
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) {
    return '';
  }

  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
};

const createDrafts = (
  submission?: InstitutionPolicySubmissionRecord | null,
  frameworks: ComplianceFrameworkItem[] = [],
): PolicyDraft[] => {
  if (submission?.policies?.length) {
    const submittedByName = new Map(
      submission.policies.map((policy) => [
        policy.name.trim().toLowerCase(),
        policy,
      ]),
    );

    const frameworkDrafts = frameworks.map((framework) => {
      const submittedPolicy = submittedByName.get(
        framework.name.trim().toLowerCase(),
      );

      return {
        id: createDraftId(),
        name: submittedPolicy?.name ?? framework.name,
        status: submittedPolicy?.status ?? formatFrameworkStatus(framework),
        lastUpdated: formatDateInput(
          submittedPolicy?.lastUpdated ?? framework.lastUpdated,
        ),
        evidence: createEvidenceDrafts(submittedPolicy?.evidence),
      };
    });

    const frameworkNames = new Set(
      frameworks.map((framework) => framework.name.trim().toLowerCase()),
    );
    const extraSubmittedDrafts = submission.policies
      .filter((policy) => !frameworkNames.has(policy.name.trim().toLowerCase()))
      .map((policy) => ({
        id: createDraftId(),
        name: policy.name,
        status: policy.status,
        lastUpdated: formatDateInput(policy.lastUpdated),
        evidence: createEvidenceDrafts(policy.evidence),
      }));

    return [...frameworkDrafts, ...extraSubmittedDrafts];
  }

  if (frameworks.length) {
    return frameworks.map((framework) => ({
      id: createDraftId(),
      name: framework.name,
      status: formatFrameworkStatus(framework),
      lastUpdated: formatDateInput(framework.lastUpdated),
      evidence: [createEmptyEvidenceDraft()],
    }));
  }

  return [
    {
      id: createDraftId(),
      name: '',
      status: 'Pending',
      lastUpdated: '',
      evidence: [createEmptyEvidenceDraft()],
    },
  ];
};

export function InstitutionComplianceVerificationTab({
  mode,
  frameworks,
  submission,
  isLoadingSubmission,
  isSubmitting,
  isRequestingEdit,
  uploadEvidenceFile,
  onRequestEvidenceEdit,
  onSubmit,
}: InstitutionComplianceVerificationTabProps) {
  const [policyDrafts, setPolicyDrafts] = useState<PolicyDraft[]>(() =>
    createDrafts(submission, frameworks),
  );
  const [summaryNote, setSummaryNote] = useState(submission?.summaryNote ?? '');
  const uploadScrollPositionRef = useRef<{ left: number; top: number } | null>(
    null,
  );

  const restoreUploadScrollPosition = () => {
    const scrollPosition = uploadScrollPositionRef.current;
    uploadScrollPositionRef.current = null;
    if (scrollPosition) {
      window.requestAnimationFrame(() => {
        window.scrollTo(scrollPosition.left, scrollPosition.top);
      });
    }
  };

  const syncKey = useMemo(
    () =>
      JSON.stringify({
        submissionId: submission?._id,
        submissionUpdatedAt: submission?.updatedAt,
        frameworks: frameworks.map((framework) => ({
          name: framework.name,
          status: framework.status,
          lastUpdated: framework.lastUpdated,
        })),
      }),
    [frameworks, submission?._id, submission?.updatedAt],
  );

  useEffect(() => {
    setPolicyDrafts(createDrafts(submission, frameworks));
    setSummaryNote(submission?.summaryNote ?? '');
  }, [frameworks, submission, syncKey]);

  const handlePolicyChange = (
    policyId: string,
    field: keyof Omit<PolicyDraft, 'id'>,
    value: string,
  ) => {
    setPolicyDrafts((current) =>
      current.map((policy) =>
        policy.id === policyId ? { ...policy, [field]: value } : policy,
      ),
    );
  };

  const handleEvidenceChange = (
    policyId: string,
    evidenceId: string,
    field: keyof Omit<EvidenceDraft, 'id'>,
    value: string,
  ) => {
    setPolicyDrafts((current) =>
      current.map((policy) =>
        policy.id === policyId
          ? {
              ...policy,
              evidence: policy.evidence.map((evidence) =>
                evidence.id === evidenceId
                  ? { ...evidence, [field]: value }
                  : evidence,
              ),
            }
          : policy,
      ),
    );
  };

  const updateEvidenceDraft = (
    policyId: string,
    evidenceId: string,
    updater: (evidence: EvidenceDraft) => EvidenceDraft,
  ) => {
    setPolicyDrafts((current) =>
      current.map((policy) =>
        policy.id === policyId
          ? {
              ...policy,
              evidence: policy.evidence.map((evidence) =>
                evidence.id === evidenceId ? updater(evidence) : evidence,
              ),
            }
          : policy,
      ),
    );
  };

  const handleEvidenceFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
    policyId: string,
    evidenceId: string,
  ) => {
    event.stopPropagation();
    const input = event.currentTarget;
    const file = input.files?.[0];
    const targetEvidence = policyDrafts
      .flatMap((policy) => policy.evidence)
      .find((evidence) => evidence.id === evidenceId);

    if (targetEvidence?.isSubmitted) {
      toast.error('This submitted evidence is locked. Request edit access to change it.');
      input.value = '';
      restoreUploadScrollPosition();
      return;
    }

    if (!file) {
      restoreUploadScrollPosition();
      return;
    }

    if (file.size > maxEvidenceFileSizeBytes) {
      toast.error('Each compliance evidence file must be 50MB or smaller.');
      input.value = '';
      restoreUploadScrollPosition();
      return;
    }

    updateEvidenceDraft(policyId, evidenceId, (evidence) => ({
      ...evidence,
      isUploading: true,
    }));

    try {
      const uploaded = await uploadEvidenceFile(file);
      updateEvidenceDraft(policyId, evidenceId, (evidence) => ({
        ...evidence,
        url: uploaded.url,
        title: evidence.title || uploaded.fileName,
        fileName: uploaded.fileName,
        fileSizeBytes: uploaded.fileSizeBytes,
        isUploading: false,
      }));
      toast.success('Evidence file uploaded.');
    } catch (error) {
      updateEvidenceDraft(policyId, evidenceId, (evidence) => ({
        ...evidence,
        isUploading: false,
      }));
      toast.error(
        getApiErrorMessage(error, 'Unable to upload this evidence file.'),
      );
    } finally {
      input.value = '';
      restoreUploadScrollPosition();
    }
  };

  const stopUploadTriggerPropagation = (
    event: MouseEvent<HTMLButtonElement | HTMLInputElement>,
  ) => {
    event.stopPropagation();
  };

  const openEvidenceFilePicker = (
    event: MouseEvent<HTMLButtonElement>,
    inputId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    uploadScrollPositionRef.current = {
      left: window.scrollX,
      top: window.scrollY,
    };

    const input = document.getElementById(inputId);
    if (input instanceof HTMLInputElement) {
      input.click();
      const scrollPosition = uploadScrollPositionRef.current;
      window.requestAnimationFrame(() => {
        if (scrollPosition) {
          window.scrollTo(scrollPosition.left, scrollPosition.top);
        }
      });
      return;
    }

    uploadScrollPositionRef.current = null;
  };

  const handleSubmit = () => {
    if (isUploadingEvidence) {
      toast.error('Wait for evidence uploads to finish before submitting.');
      return;
    }

    const hasNewEvidence = policyDrafts.some((policy) =>
      policy.evidence.some(
        (evidence) => evidence.url.trim().length > 0 && !evidence.isSubmitted,
      ),
    );

    if (submission?.status === 'pending' && !hasNewEvidence) {
      toast.error('Upload new evidence or request edit access for a submitted evidence row.');
      return;
    }

    const normalizedPolicies = policyDrafts.map((policy) => ({
      name: policy.name.trim(),
      status: policy.status,
      lastUpdated: policy.lastUpdated.trim(),
      evidence: policy.evidence
        .map((evidence) => ({
          title: evidence.title.trim(),
          type: evidence.type,
          url: evidence.url.trim(),
          notes: evidence.notes.trim(),
          submittedAt: evidence.submittedAt.trim(),
        }))
        .filter((evidence) => evidence.url.length > 0),
    }));

    const policiesMissingName = normalizedPolicies.filter(
      (policy) => policy.name.length === 0 && policy.evidence.length > 0,
    );
    if (policiesMissingName.length > 0) {
      toast.error('Add a policy name for every row that includes evidence.');
      return;
    }

    const sanitizedPolicies = normalizedPolicies.filter(
      (policy) => policy.name.length > 0 && policy.evidence.length > 0,
    );

    if (sanitizedPolicies.length === 0) {
      toast.error(
        'Add evidence for at least one policy row before submitting for verification.',
      );
      return;
    }

    const duplicates = new Set<string>();
    const duplicateNames = new Set<string>();
    sanitizedPolicies.forEach((policy) => {
      const key = policy.name.toLowerCase();
      if (duplicates.has(key)) {
        duplicateNames.add(policy.name);
      }
      duplicates.add(key);
    });

    if (duplicateNames.size > 0) {
      toast.error(
        `Remove duplicate policy names: ${Array.from(duplicateNames).join(', ')}`,
      );
      return;
    }

    onSubmit({
      policies: sanitizedPolicies.map((policy) => ({
        name: policy.name,
        status: policy.status,
        ...(policy.lastUpdated ? { lastUpdated: policy.lastUpdated } : {}),
        evidence: policy.evidence.map((evidence) => ({
          title: evidence.title || evidence.type.replace(/_/g, ' '),
          type: evidence.type,
          url: evidence.url,
          ...(evidence.notes ? { notes: evidence.notes } : {}),
          ...(evidence.submittedAt
            ? { submittedAt: evidence.submittedAt }
            : {}),
        })),
      })),
      ...(summaryNote.trim() ? { summaryNote: summaryNote.trim() } : {}),
    });
  };

  const isUploadingEvidence = policyDrafts.some((policy) =>
    policy.evidence.some((evidence) => evidence.isUploading),
  );

  return (
    <div className="w-full">
      <div className="overflow-hidden border border-slate-700 bg-slate-950 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="h-2.5 bg-blue-500" />
        <div className="border-b border-slate-600 bg-slate-800 px-6 py-5">
          {submission ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                      reviewToneClass[submission.status] ??
                      'border-slate-700 bg-slate-800 text-slate-200'
                    }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {formatReviewStatus(submission.status)}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                  Submission #{submission._id.slice(-8)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-slate-600 pt-4">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                    Submitted At
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    {new Date(submission.submittedAt).toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                    Submitted By
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    {submission.submittedByUser?.displayName ?? 'Unknown'}
                  </div>
                </div>
                {submission.reviewedAt ? (
                  <>
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                        Reviewed At
                      </div>
                      <div className="mt-1 text-sm text-slate-300">
                        {new Date(submission.reviewedAt).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                        Reviewed By
                      </div>
                      <div className="mt-1 text-sm text-slate-300">
                        {submission.reviewedByUser?.displayName ?? 'Unknown'}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : isLoadingSubmission ? (
            <div className="text-sm text-slate-400 px-2">
              Loading the latest verification packet...
            </div>
          ) : null}
        </div>

        <div className="bg-slate-900 px-6 py-6">
          {submission?.adminNotes ? (
            <div
              className={`mb-6 rounded-xl border px-4 py-4 text-sm ${
                submission.status === 'approved'
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100'
                  : 'border-rose-500/20 bg-rose-500/10 text-rose-100'
              }`}
            >
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] opacity-80">
                Admin Notes
              </div>
              <div className="mt-2">{submission.adminNotes}</div>
            </div>
          ) : null}

          <div className="mb-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-300">
              <span className="h-1 w-1 rounded-full bg-cyan-400" />
              {mode === 'college' ? 'College' : 'School'} Policy Submission
            </div>
            <div className="mt-3 text-lg font-semibold text-white">
              {submission ? `${mode === 'college' ? 'College' : 'School'} Verification #${submission._id.slice(-8)}` : `${mode === 'college' ? 'College' : 'School'} Compliance Framework`}
            </div>
            {submission && (
              <div className="mt-1 text-xs text-slate-500">
                {submission.policies.length} policies · {submission.policies.reduce((sum, p) => sum + p.evidence.length, 0)} evidence files
              </div>
            )}
          </div>

        <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,32rem),1fr))] gap-4">
          {policyDrafts.map((policy, policyIndex) => (
            <div key={policy.id} className="min-w-0 overflow-hidden border border-slate-700 bg-slate-900">
              <div className="border-b border-slate-700 bg-slate-800 px-4 py-4 sm:px-6">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="min-w-0 space-y-2 md:col-span-2">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                      Framework {String(policyIndex + 1).padStart(2, '0')}
                    </div>
                    <input
                      value={policy.name}
                      onChange={(event) =>
                        handlePolicyChange(
                          policy.id,
                          'name',
                          event.target.value,
                        )
                      }
                      placeholder="Policy name"
                      className={fieldClassName}
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Status
                    </div>
                    <select
                      value={policy.status}
                      onChange={(event) =>
                        handlePolicyChange(
                          policy.id,
                          'status',
                          event.target.value,
                        )
                      }
                      className={fieldClassName}
                    >
                      {policyStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Updated
                    </div>
                    <input
                      type="date"
                      value={policy.lastUpdated}
                      onChange={(event) =>
                        handlePolicyChange(
                          policy.id,
                          'lastUpdated',
                          event.target.value,
                        )
                      }
                      className={fieldClassName}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 bg-slate-800 px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">
                      <span className="h-1 w-1 rounded-full bg-cyan-400" />
                      Evidence Resources
                    </div>
                    <div className="mt-2 text-xs leading-5 text-slate-400">
                      Upload one evidence file per framework. Files are capped
                      at 50MB.
                    </div>
                  </div>
                  <div className="rounded-full border border-slate-600 bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-300">
                    {
                      policy.evidence.filter((evidence) => evidence.url.trim())
                        .length
                    }{' '}
                    ready
                  </div>
                </div>

                <div className="space-y-3">
                  {policy.evidence.map((evidence, evidenceIndex) => {
                    const evidenceInputId = getEvidenceInputId(
                      policy.id,
                      evidence.id,
                    );
                    const isEvidenceInputDisabled = Boolean(
                      evidence.isUploading || isSubmitting || evidence.isSubmitted,
                    );

                    return (
                      <div key={evidence.id} className={`${evidencePanelClassName} min-w-0`}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Resource{' '}
                            {String(evidenceIndex + 1).padStart(2, '0')}
                          </div>
                        </div>
                        <div className="grid min-w-0 gap-3 md:grid-cols-2">
                          <input
                            value={evidence.title}
                            disabled={evidence.isSubmitted}
                            onChange={(event) =>
                              handleEvidenceChange(
                                policy.id,
                                evidence.id,
                                'title',
                                event.target.value,
                              )
                            }
                            placeholder="Evidence title (optional)"
                            className={`${fieldClassName} md:col-span-2`}
                          />
                          <select
                            value={evidence.type}
                            disabled={evidence.isSubmitted}
                            onChange={(event) =>
                              handleEvidenceChange(
                                policy.id,
                                evidence.id,
                                'type',
                                event.target
                                  .value as InstitutionPolicyEvidenceType,
                              )
                            }
                            className={fieldClassName}
                          >
                            {evidenceTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          {evidence.isSubmitted ? (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={isRequestingEdit}
                              onClick={() => {
                                if (!submission || !onRequestEvidenceEdit) {
                                  toast.info('Ask admin to unlock this submitted evidence for edits.');
                                  return;
                                }

                                onRequestEvidenceEdit({
                                  submissionId: submission._id,
                                  policyName: policy.name,
                                  evidenceTitle:
                                    evidence.title || evidence.fileName || 'Evidence file',
                                  evidenceUrl: evidence.url,
                                });
                              }}
                              className="h-10 w-full justify-center"
                            >
                              {isRequestingEdit ? 'Requesting...' : 'Request Edit'}
                            </Button>
                          ) : (
                            <>
                              <button
                                type="button"
                                aria-disabled={isEvidenceInputDisabled}
                                disabled={isEvidenceInputDisabled}
                                onClick={(event) =>
                                  openEvidenceFilePicker(event, evidenceInputId)
                                }
                                className={`flex h-10 min-w-0 w-full items-center justify-between gap-3 rounded-lg bg-slate-950/80 px-3 text-sm text-slate-300 shadow-inner shadow-black/20 transition focus-within:ring-2 focus-within:ring-cyan-400/25 ${
                                  isEvidenceInputDisabled
                                    ? 'cursor-not-allowed opacity-60'
                                    : 'cursor-pointer hover:bg-slate-950'
                                }`}
                              >
                                <span className="truncate">
                                  {evidence.isUploading
                                    ? 'Uploading...'
                                    : evidence.fileName ||
                                      evidence.title ||
                                      'Choose file up to 50MB'}
                                </span>
                                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
                                  Upload
                                </span>
                              </button>
                              <input
                                id={evidenceInputId}
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,application/pdf,image/jpeg,image/png,image/webp,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                                className="hidden"
                                disabled={isEvidenceInputDisabled}
                                onClick={stopUploadTriggerPropagation}
                                onChange={(event) =>
                                  handleEvidenceFileChange(
                                    event,
                                    policy.id,
                                    evidence.id,
                                  )
                                }
                              />
                            </>
                          )}
                          {evidence.fileSizeBytes ? (
                            <div className="text-xs text-slate-500 md:col-span-2">
                              {formatFileSize(evidence.fileSizeBytes)}
                            </div>
                          ) : null}
                          <input
                            value={evidence.notes}
                            disabled={evidence.isSubmitted}
                            onChange={(event) =>
                              handleEvidenceChange(
                                policy.id,
                                evidence.id,
                                'notes',
                                event.target.value,
                              )
                            }
                            placeholder="Reviewer note or checkpoint covered"
                            className={`${fieldClassName} md:col-span-2`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Institution Note
          </div>
          <textarea
            value={summaryNote}
            onChange={(event) => setSummaryNote(event.target.value)}
            rows={4}
            placeholder="Add a short note for the admin reviewer about this packet, pending gaps, or evidence references."
            className="mt-3 w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-400/25"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-400">
            Approved packets update the live dashboard. Pending or rejected
            packets stay in this review lane only.
          </div>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isUploadingEvidence}
          >
            {isUploadingEvidence
              ? 'Uploading evidence...'
              : isSubmitting
                ? 'Submitting...'
                : submission?.status === 'pending'
                  ? 'Submit New Evidence'
                  : 'Submit for Verification'}
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
}
