import { useEffect, useMemo, useState } from 'react';
import { toast } from '../../app/components/ui/sonner';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import type {
  ComplianceFrameworkItem,
  InstitutionPolicy,
  InstitutionPolicySubmissionRecord,
} from '../../types/school.types';

type InstitutionMode = 'school' | 'college';

interface PolicyDraft {
  id: string;
  name: string;
  status: InstitutionPolicy['status'];
  lastUpdated: string;
}

interface InstitutionComplianceVerificationTabProps {
  mode: InstitutionMode;
  frameworks: ComplianceFrameworkItem[];
  submission?: InstitutionPolicySubmissionRecord | null;
  isLoadingSubmission?: boolean;
  isSubmitting?: boolean;
  onSubmit: (payload: { policies: InstitutionPolicy[]; summaryNote?: string }) => void;
}

const reviewToneClass: Record<string, string> = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  rejected: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

const policyStatusOptions: InstitutionPolicy['status'][] = ['Active', 'On Track', 'Pending', 'Inactive'];

const createDraftId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const formatReviewStatus = (status: InstitutionPolicySubmissionRecord['status']) =>
  status === 'pending' ? 'Pending Review' : status === 'approved' ? 'Approved' : 'Rejected';

const formatFrameworkStatus = (framework: ComplianceFrameworkItem): InstitutionPolicy['status'] => {
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

const createDrafts = (
  submission?: InstitutionPolicySubmissionRecord | null,
  frameworks: ComplianceFrameworkItem[] = [],
): PolicyDraft[] => {
  if (submission?.policies?.length) {
    return submission.policies.map((policy) => ({
      id: createDraftId(),
      name: policy.name,
      status: policy.status,
      lastUpdated: formatDateInput(policy.lastUpdated),
    }));
  }

  if (frameworks.length) {
    return frameworks.map((framework) => ({
      id: createDraftId(),
      name: framework.name,
      status: formatFrameworkStatus(framework),
      lastUpdated: formatDateInput(framework.lastUpdated),
    }));
  }

  return [
    {
      id: createDraftId(),
      name: '',
      status: 'Pending',
      lastUpdated: '',
    },
  ];
};

export function InstitutionComplianceVerificationTab({
  mode,
  frameworks,
  submission,
  isLoadingSubmission,
  isSubmitting,
  onSubmit,
}: InstitutionComplianceVerificationTabProps) {
  const [policyDrafts, setPolicyDrafts] = useState<PolicyDraft[]>(() => createDrafts(submission, frameworks));
  const [summaryNote, setSummaryNote] = useState(submission?.summaryNote ?? '');

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
      current.map((policy) => (policy.id === policyId ? { ...policy, [field]: value } : policy)),
    );
  };

  const handleAddPolicy = () => {
    setPolicyDrafts((current) => [
      ...current,
      {
        id: createDraftId(),
        name: '',
        status: 'Pending',
        lastUpdated: '',
      },
    ]);
  };

  const handleRemovePolicy = (policyId: string) => {
    setPolicyDrafts((current) => {
      const nextPolicies = current.filter((policy) => policy.id !== policyId);
      return nextPolicies.length > 0
        ? nextPolicies
        : [
            {
              id: createDraftId(),
              name: '',
              status: 'Pending',
              lastUpdated: '',
            },
          ];
    });
  };

  const handleSubmit = () => {
    const sanitizedPolicies = policyDrafts
      .map((policy) => ({
        name: policy.name.trim(),
        status: policy.status,
        lastUpdated: policy.lastUpdated.trim(),
      }))
      .filter((policy) => policy.name.length > 0);

    if (sanitizedPolicies.length === 0) {
      toast.error('Add at least one policy row before submitting for verification.');
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
      toast.error(`Remove duplicate policy names: ${Array.from(duplicateNames).join(', ')}`);
      return;
    }

    onSubmit({
      policies: sanitizedPolicies.map((policy) => ({
        name: policy.name,
        status: policy.status,
        ...(policy.lastUpdated ? { lastUpdated: policy.lastUpdated } : {}),
      })),
      ...(summaryNote.trim() ? { summaryNote: summaryNote.trim() } : {}),
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Verification Workflow</div>
            <h3 className="text-2xl font-semibold text-white">Submit policy data for admin approval</h3>
            <p className="max-w-3xl text-sm text-slate-400">
              {mode === 'school' ? 'School' : 'College'} teams can prepare framework updates here and send them for
              admin verification. The command-centre dashboard continues to use the last approved packet until review
              is complete.
            </p>
          </div>

          {submission ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest Packet</div>
              <div
                className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                  reviewToneClass[submission.status] ?? 'border-slate-700 bg-slate-800 text-slate-200'
                }`}
              >
                {formatReviewStatus(submission.status)}
              </div>
              <div className="mt-3 text-sm text-slate-300">
                Submitted {new Date(submission.submittedAt).toLocaleString('en-IN')}
              </div>
              {submission.reviewedAt ? (
                <div className="text-sm text-slate-400">
                  Reviewed {new Date(submission.reviewedAt).toLocaleString('en-IN')}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {isLoadingSubmission ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
            Loading the latest verification packet...
          </div>
        ) : null}

        {submission?.adminNotes ? (
          <div
            className={`mt-6 rounded-2xl border px-4 py-4 text-sm ${
              submission.status === 'approved'
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100'
                : 'border-rose-500/20 bg-rose-500/10 text-rose-100'
            }`}
          >
            <div className="text-xs uppercase tracking-[0.2em] opacity-80">Admin Notes</div>
            <div className="mt-2">{submission.adminNotes}</div>
          </div>
        ) : null}
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Submission Packet</div>
            <div className="mt-2 text-lg font-semibold text-white">Framework status rows</div>
          </div>
          <Button variant="secondary" className="py-2" onClick={handleAddPolicy}>
            Add Policy
          </Button>
        </div>

        <div className="mt-6 space-y-4">
          {policyDrafts.map((policy) => (
            <div
              key={policy.id}
              className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 lg:grid-cols-[1.6fr,180px,180px,110px]"
            >
              <input
                value={policy.name}
                onChange={(event) => handlePolicyChange(policy.id, 'name', event.target.value)}
                placeholder="Policy name"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              />
              <select
                value={policy.status}
                onChange={(event) => handlePolicyChange(policy.id, 'status', event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              >
                {policyStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={policy.lastUpdated}
                onChange={(event) => handlePolicyChange(policy.id, 'lastUpdated', event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              />
              <Button
                variant="outline"
                className="py-2"
                onClick={() => handleRemovePolicy(policy.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Institution Note</div>
          <textarea
            value={summaryNote}
            onChange={(event) => setSummaryNote(event.target.value)}
            rows={4}
            placeholder="Add a short note for the admin reviewer about this packet, pending gaps, or evidence references."
            className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-400">
            Approved packets update the live dashboard. Pending or rejected packets stay in this review lane only.
          </div>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? 'Submitting...'
              : submission?.status === 'pending'
                ? 'Resubmit Pending Packet'
                : 'Submit for Verification'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
