import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, FileCheck2, X } from 'lucide-react';
import { adminApi, type AdminRegistrationRequestItem } from '../../api/admin.api';
import { toast } from '../../app/components/ui/sonner';
import { Spinner } from '../../components/ui/Spinner';
import { UserRole } from '../../types/roles.types';
import type {
  InstitutionPolicy,
  InstitutionPolicyEvidence,
  InstitutionPolicySubmissionRecord,
} from '../../types/school.types';
import { getApiErrorMessage } from '../../utils/apiError';

// ─── constants ────────────────────────────────────────────────────────────────

const isInstitutionRequest = (role: UserRole) =>
  role === UserRole.SCHOOL || role === UserRole.COLLEGE;

const FALLBACK_PILL = 'bg-slate-800 text-slate-300 ring-1 ring-slate-700';

const statusConfig: Record<
  InstitutionPolicySubmissionRecord['status'],
  { label: string; pillClass: string; dot: string }
> = {
  pending:  { label: 'Pending review', pillClass: 'bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/20',   dot: 'bg-amber-400'  },
  approved: { label: 'Approved',       pillClass: 'bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20', dot: 'bg-emerald-400' },
  rejected: { label: 'Rejected',       pillClass: 'bg-rose-400/10 text-rose-300 ring-1 ring-rose-400/20',     dot: 'bg-rose-400'   },
  edit_requested: { label: 'Edit Requested', pillClass: 'bg-blue-400/10 text-blue-300 ring-1 ring-blue-400/20', dot: 'bg-blue-400' },
};

const policyStatusPill: Record<InstitutionPolicy['status'], string> = {
  Active:     'bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20',
  'On Track': 'bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20',
  Pending:    'bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/20',
  Inactive:   'bg-rose-400/10 text-rose-300 ring-1 ring-rose-400/20',
};

// ─── formatters ───────────────────────────────────────────────────────────────

const parseDate = (value?: string): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatDateTime = (value?: string) =>
  parseDate(value)?.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) ?? 'Not recorded';

const formatDate = (value?: string) =>
  parseDate(value)?.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) ?? 'No update';

const timeAgo = (value?: string): string => {
  const d = parseDate(value);
  if (!d) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const formatEvidenceType = (v: string) => v.replace(/_/g, ' ');

// ─── primitives ───────────────────────────────────────────────────────────────

function Pill({
  children,
  className = FALLBACK_PILL,
  dot,
}: {
  children: ReactNode;
  className?: string;
  dot?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none tracking-wide ${className}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {children}
    </span>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1 text-[11px] font-medium text-slate-400">
      {children}
    </span>
  );
}

function DataCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden space-y-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="min-w-0 overflow-hidden break-words text-sm font-medium text-slate-200">{children}</div>
    </div>
  );
}

function Avatar({ name, colorClass }: { name: string; colorClass: string }) {
  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${colorClass}`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function ReviewTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: Array<{ key: T; label: string }>;
  activeTab: T;
  onChange: (tab: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-0.5 rounded-xl bg-slate-950 p-1 ring-1 ring-slate-800">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 ${
              isActive ? 'bg-slate-800 text-white ring-1 ring-slate-700' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function DecisionPanel({
  value,
  onChange,
  onApprove,
  onReject,
  isPending,
  rejectDisabled,
  approveLabel = 'Approve',
  rejectLabel = 'Reject',
  placeholder = 'Reason if rejected',
}: {
  value: string;
  onChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
  rejectDisabled?: boolean;
  approveLabel?: string;
  rejectLabel?: string;
  placeholder?: string;
}) {
  const minLength = 10;
  const currentLength = value.trim().length;
  const isValid = currentLength >= minLength;
  const [isFocused, setIsFocused] = useState(false);

  const showInstruction = !isValid && !isFocused && currentLength > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Rejection Reason
            {!isValid && currentLength > 0 && (
              <span className="ml-2 text-rose-400">
                ({minLength - currentLength} more chars required)
              </span>
            )}
          </label>
          <span className={`text-[10px] font-medium ${isValid ? 'text-emerald-400' : 'text-rose-400'}`}>
            {currentLength}/{minLength} min
          </span>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Explain why this submission is being rejected (minimum 10 characters)..."
          rows={3}
          className={`w-full resize-none rounded-xl border bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600 focus:ring-2 ${
            isValid
              ? 'border-emerald-500/50 focus:border-emerald-500/60 focus:ring-emerald-500/20'
              : isFocused
                ? 'border-slate-700 focus:ring-cyan-400/20'
                : 'border-rose-500/50 focus:ring-rose-500/20'
          }`}
        />
        {showInstruction && (
          <p className="text-[11px] text-rose-400">
            Please enter at least {minLength} characters to enable the reject button.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onApprove}
          disabled={isPending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/25 transition-all duration-150 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
        >
          <Check className="h-4 w-4" />
          {approveLabel}
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={isPending || rejectDisabled}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-500/10 px-4 text-sm font-semibold text-rose-300 ring-1 ring-rose-500/25 transition-all duration-150 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
        >
          <X className="h-4 w-4" />
          {rejectLabel}
        </button>
      </div>
    </div>
  );
}

function ReviewLane({
  count,
  isLoading,
  children,
}: {
  count: number;
  isLoading: boolean;
  children: ReactNode;
}) {
  if (!isLoading && count === 0) {
    return null;
  }

  return (
    <section className="flex flex-col">
      <div className="flex-1">
        {isLoading ? (
          <div className="flex min-h-36 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900">
            <Spinner />
          </div>
        ) : (
          <div className="grid max-h-[calc(100vh-20rem)] grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] gap-5 overflow-y-auto pr-1 [scrollbar-color:rgba(100,116,139,0.3)_transparent] [scrollbar-width:thin]">
            {children}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── evidence / policy blocks ─────────────────────────────────────────────────

function EvidenceFileRow({ evidence }: { evidence: InstitutionPolicyEvidence }) {
  return (
    <div className="space-y-2 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="break-words text-sm font-semibold text-slate-100">{evidence.title}</p>
          {evidence.notes && <p className="break-words text-xs leading-5 text-slate-500">{evidence.notes}</p>}
          <p className="text-xs capitalize text-slate-500">
            {formatEvidenceType(evidence.type)}
            {evidence.submittedAt ? ` · ${formatDate(evidence.submittedAt)}` : ''}
          </p>
        </div>
        <a
          href={evidence.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-500/15 px-2.5 py-1.5 text-xs font-bold text-cyan-300 ring-1 ring-cyan-500/30 transition-all hover:bg-cyan-500/25 hover:text-white"
        >
          Open file <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

function PolicyBlock({ policy }: { policy: InstitutionPolicy }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-white">{policy.name}</p>
          <p className="text-xs text-slate-500">
            {policy.evidence.length} file{policy.evidence.length === 1 ? '' : 's'} · Updated {formatDate(policy.lastUpdated)}
          </p>
        </div>
        <Pill className={policyStatusPill[policy.status] ?? FALLBACK_PILL}>{policy.status}</Pill>
      </div>
      {policy.evidence.length === 0 ? (
        <p className="text-xs text-rose-400/80">No evidence submitted.</p>
      ) : (
        <div className="divide-y divide-slate-800">
          {policy.evidence.map((ev) => <EvidenceFileRow key={`${policy.name}-${ev.url}`} evidence={ev} />)}
        </div>
      )}
    </div>
  );
}

// ─── compliance card ──────────────────────────────────────────────────────────

type ComplianceTabKey = 'evidence' | 'details' | 'decision';

const complianceTabs: Array<{ key: ComplianceTabKey; label: string }> = [
  { key: 'evidence', label: 'Evidence' },
  { key: 'details',  label: 'Details'  },
  { key: 'decision', label: 'Decision' },
];

function ComplianceEvidencePanel({
  evidenceItems,
}: {
  evidenceItems: Array<{ policy: InstitutionPolicy; evidence: InstitutionPolicyEvidence }>;
}) {
  if (evidenceItems.length === 0) {
    return <p className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-400">No evidence submitted.</p>;
  }
  return (
    <div className="divide-y divide-slate-800">
      {evidenceItems.map(({ policy, evidence }) => (
        <div key={`${policy.name}-${evidence.url}`} className="flex items-start justify-between gap-3 py-4 first:pt-1">
          <div className="min-w-0 space-y-1">
            <p className="break-words text-sm font-semibold text-white">{evidence.title || 'Untitled Evidence'}</p>
            {evidence.notes && <p className="break-words text-xs leading-5 text-slate-400">{evidence.notes}</p>}
            <p className="text-xs text-slate-500 capitalize">
              {policy.name} · {formatEvidenceType(evidence.type)}
              {evidence.submittedAt ? ` · ${formatDate(evidence.submittedAt)}` : ''}
            </p>
          </div>
          <a
            href={evidence.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-500/15 px-2.5 py-1.5 text-xs font-bold text-cyan-300 ring-1 ring-cyan-500/30 transition-all hover:bg-cyan-500/25 hover:text-white"
          >
            Open file <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ))}
    </div>
  );
}

function ComplianceDetailsPanel({ submission }: { submission: InstitutionPolicySubmissionRecord }) {
  return (
    <div className="space-y-5">
      {submission.summaryNote && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Summary Note</p>
          <p className="text-sm leading-6 text-slate-300">{submission.summaryNote}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <DataCell label="Submitted By">{submission.submittedByUser?.displayName ?? 'Unknown'}</DataCell>
        <DataCell label="Submitted At">{formatDateTime(submission.submittedAt)}</DataCell>
        <DataCell label="Contact">{submission.submittedByUser?.email ?? 'N/A'}</DataCell>
        <DataCell label="Type">{submission.institutionType}</DataCell>
      </div>
      {submission.policies.length > 0 ? (
        <div className="space-y-3">
          {submission.policies.map((p) => <PolicyBlock key={p.name} policy={p} />)}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No policy rows submitted.</p>
      )}
    </div>
  );
}

function ComplianceSubmissionCard({
  submission,
  rejectNote,
  onRejectNoteChange,
  onApprove,
  onReject,
  isPending,
}: {
  submission: InstitutionPolicySubmissionRecord;
  rejectNote: string;
  onRejectNoteChange: (value: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isPending: boolean;
}) {
  const [activeTab, setActiveTab] = useState<ComplianceTabKey>('evidence');

  const institutionName =
    submission.institution?.institutionName ||
    submission.institution?.displayName ||
    submission.institutionId;

  const evidenceItems = submission.policies.flatMap((p) =>
    p.evidence.map((ev) => ({ policy: p, evidence: ev })),
  );
  const totalEvidence = evidenceItems.length;
  const cfg = statusConfig[submission.status];

  return (
    <article className="flex max-h-[640px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
      {/* ── job-card header ── */}
      <div className="shrink-0 p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={institutionName} colorClass="bg-teal-600" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{institutionName}</p>
              <p className="text-xs text-slate-500">
                {submission.submittedByUser?.email ?? submission.submittedBy}
                {submission.submittedAt && ` · ${timeAgo(submission.submittedAt)}`}
              </p>
            </div>
          </div>
          <Pill className={cfg.pillClass} dot={cfg.dot}>{cfg.label}</Pill>
        </div>

        <h3 className="text-xl font-bold tracking-tight text-white">
          {submission.institutionType === 'college'
            ? 'College Compliance Verification'
            : 'School Compliance Verification'}
        </h3>

        <div className="flex flex-wrap gap-2">
          <Tag>{submission.institutionType}</Tag>
          <Tag>{submission.policies.length} policy row{submission.policies.length === 1 ? '' : 's'}</Tag>
          <Tag>{totalEvidence} evidence file{totalEvidence === 1 ? '' : 's'}</Tag>
        </div>
      </div>

      {/* ── tab bar ── */}
      <div className="shrink-0 border-t border-slate-800 px-5 py-3">
        <ReviewTabs tabs={complianceTabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* ── tab content ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 [scrollbar-color:rgba(100,116,139,0.3)_transparent] [scrollbar-width:thin]">
        {activeTab === 'evidence' ? (
          <ComplianceEvidencePanel evidenceItems={evidenceItems} />
        ) : activeTab === 'details' ? (
          <ComplianceDetailsPanel submission={submission} />
        ) : (
          <div className="space-y-4">
            {submission.adminNotes && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-500/80">Admin Notes</p>
                <p className="text-sm leading-6 text-slate-300">{submission.adminNotes}</p>
              </div>
            )}
            <DecisionPanel
              value={rejectNote}
              onChange={onRejectNoteChange}
              onApprove={() => onApprove(submission._id)}
              onReject={() => onReject(submission._id)}
              isPending={isPending}
              rejectDisabled={rejectNote.trim().length < 10}
            />
          </div>
        )}
      </div>

      {/* ── footer ── */}
      <div className="shrink-0 border-t border-slate-800 px-5 py-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onApprove(submission._id)}
          disabled={isPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-xs font-bold text-emerald-400 ring-1 ring-slate-700 transition-all hover:ring-emerald-500/50 disabled:opacity-40 active:scale-[0.97]"
        >
          <Check className="h-3.5 w-3.5" /> Approve
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('decision')}
          disabled={isPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-800 px-4 text-xs font-bold text-white ring-1 ring-slate-700 transition-all hover:bg-slate-700 disabled:opacity-40 active:scale-[0.97]"
        >
          Decide →
        </button>
      </div>
    </article>
  );
}

// ─── registration card ────────────────────────────────────────────────────────

type RegistrationTabKey = 'details' | 'verification' | 'decision';

const registrationTabs: Array<{ key: RegistrationTabKey; label: string }> = [
  { key: 'details',      label: 'Details'      },
  { key: 'verification', label: 'Verification' },
  { key: 'decision',     label: 'Decision'     },
];

function RegistrationDetailsPanel({ request }: { request: AdminRegistrationRequestItem }) {
  const p = request.institutionProfile;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4 sm:grid-cols-2">
        <DataCell label="Institution">{p?.institutionName ?? 'Not provided'}</DataCell>
        <DataCell label="Location">{p?.location ?? 'Not provided'}</DataCell>
        {p && (
          <>
            <DataCell label="Students">{p.totalStudentsEnrolled ?? 'Not provided'}</DataCell>
            <DataCell label="Academic Year">{p.academicYear ?? 'Not provided'}</DataCell>
            <DataCell label="Contact Email">{p.contactEmail ?? 'Not provided'}</DataCell>
            <DataCell label="Contact Phone">{p.contactPhone ?? 'Not provided'}</DataCell>
          </>
        )}
      </div>
      {request.bio && (
        <p className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-400">
          {request.bio}
        </p>
      )}
    </div>
  );
}

function RegistrationVerificationPanel({ request }: { request: AdminRegistrationRequestItem }) {
  const v = request.institutionVerification;
  const readiness = v?.readiness;

  if (!v) {
    return (
      <p className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-500">
        No institution verification packet was submitted for this request.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Verification packet</span>
        {v.regulatoryBodies.length > 0
          ? v.regulatoryBodies.map((b) => <Pill key={b}>{b}</Pill>)
          : <Pill>No body selected</Pill>}
      </div>

      <div className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4 sm:grid-cols-2">
        <DataCell label="Affiliation">{v.affiliationName ?? 'Not provided'}</DataCell>
        <DataCell label="Reference">{v.referenceCode ?? 'Not provided'}</DataCell>
        <DataCell label="Documents">{`${v.documents.length} file${v.documents.length === 1 ? '' : 's'}`}</DataCell>
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Website</p>
          {v.websiteUrl ? (
            <a
              href={v.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-300 transition hover:text-white"
            >
              Open website <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          ) : (
            <p className="text-sm text-slate-400">Not provided</p>
          )}
        </div>
      </div>

      {v.documents.length > 0 && (
        <div className="space-y-3">
          {v.documents.map((doc) => (
            <div
              key={doc._id}
              className="flex min-w-0 items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="break-words text-sm font-medium text-white">{doc.category.replace(/_/g, ' ')}</p>
                <p className="text-xs text-slate-500">
                  {doc.fileName} · {doc.fileType.toUpperCase()} · {formatDateTime(doc.uploadedAt)}
                </p>
              </div>
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-500/15 px-2.5 py-1.5 text-xs font-bold text-cyan-300 ring-1 ring-cyan-500/30 transition-all hover:bg-cyan-500/25 hover:text-white"
              >
                Open file <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>
      )}

      {readiness && readiness.missingItems.length > 0 && (
        <p className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-300">
          Missing: {readiness.missingItems.join(', ')}
        </p>
      )}
    </div>
  );
}

function RegistrationRequestCard({
  request,
  rejectReason,
  onRejectReasonChange,
  onApprove,
  onReject,
  isPending,
}: {
  request: AdminRegistrationRequestItem;
  rejectReason: string;
  onRejectReasonChange: (value: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isPending: boolean;
}) {
  const [activeTab, setActiveTab] = useState<RegistrationTabKey>('details');
  const readiness = request.institutionVerification?.readiness;
  const isInstitution = isInstitutionRequest(request.role);

  return (
    <article className="flex max-h-[600px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
      {/* ── job-card header ── */}
      <div className="shrink-0 p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={request.displayName} colorClass="bg-violet-600" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{request.displayName}</p>
              <p className="text-xs text-slate-500">
                {request.email}
                {request.requestedAt && ` · ${timeAgo(request.requestedAt)}`}
              </p>
            </div>
          </div>
          <Pill className="bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/20" dot="bg-amber-400">
            Pending
          </Pill>
        </div>

        <h3 className="text-xl font-bold tracking-tight text-white capitalize">{request.role} Registration</h3>

        <div className="flex flex-wrap gap-2">
          <Tag>{request.role}</Tag>
          {request.domain && <Tag>{request.domain}</Tag>}
          {isInstitution && (
            <Tag>{readiness?.isReadyForReview ? '✓ Docs ready' : '⚠ Docs incomplete'}</Tag>
          )}
        </div>
      </div>

      {/* ── tab bar ── */}
      <div className="shrink-0 border-t border-slate-800 px-5 py-3">
        <ReviewTabs tabs={registrationTabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* ── tab content ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 [scrollbar-color:rgba(100,116,139,0.3)_transparent] [scrollbar-width:thin]">
        {activeTab === 'details' ? (
          <RegistrationDetailsPanel request={request} />
        ) : activeTab === 'verification' ? (
          <RegistrationVerificationPanel request={request} />
        ) : (
          <DecisionPanel
            value={rejectReason}
            onChange={onRejectReasonChange}
            onApprove={() => onApprove(request._id)}
            onReject={() => onReject(request._id)}
            isPending={isPending}
            approveLabel="Approve access"
            rejectLabel="Reject access"
            placeholder="Optional rejection reason"
          />
        )}
      </div>

      {/* ── footer ── */}
      <div className="shrink-0 border-t border-slate-800 px-5 py-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onApprove(request._id)}
          disabled={isPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-xs font-bold text-emerald-400 ring-1 ring-slate-700 transition-all hover:ring-emerald-500/50 disabled:opacity-40 active:scale-[0.97]"
        >
          <Check className="h-3.5 w-3.5" /> Approve
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('decision')}
          disabled={isPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-800 px-4 text-xs font-bold text-white ring-1 ring-slate-700 transition-all hover:bg-slate-700 disabled:opacity-40 active:scale-[0.97]"
        >
          Decide →
        </button>
      </div>
    </article>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function UserRequests({ roleFilter }: { roleFilter?: UserRole } = {}) {
  const queryClient = useQueryClient();
  const [registrationRejectReasons, setRegistrationRejectReasons] = useState<Record<string, string>>({});
  const [complianceRejectNotes, setComplianceRejectNotes] = useState<Record<string, string>>({});

  const registrationRequestsQuery = useQuery({
    queryKey: ['admin-registration-requests', 'pending'],
    queryFn: () => adminApi.getRegistrationRequests({ status: 'pending' }),
  });
  const complianceSubmissionsQuery = useQuery({
    queryKey: ['admin-compliance-submissions', 'pending'],
    queryFn: () => adminApi.getComplianceSubmissions({ status: 'pending' }),
  });
  const editRequestedSubmissionsQuery = useQuery({
    queryKey: ['admin-compliance-submissions', 'edit_requested'],
    queryFn: () => adminApi.getComplianceSubmissions({ status: 'edit_requested' }),
  });

  const reviewRequestMutation = useMutation({
    mutationFn: ({ requestId, decision, reason }: { requestId: string; decision: 'approved' | 'rejected'; reason?: string }) =>
      decision === 'approved'
        ? adminApi.approveRegistrationRequest(requestId)
        : adminApi.rejectRegistrationRequest(requestId, reason ?? 'Registration request rejected by admin'),
    onSuccess: async () => {
      toast.success('Registration request reviewed.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-registration-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-analytics'] }),
      ]);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to review this registration request.'));
    },
  });

  const reviewComplianceMutation = useMutation({
    mutationFn: ({ submissionId, decision, adminNotes }: { submissionId: string; decision: 'approved' | 'rejected'; adminNotes?: string }) =>
      adminApi.reviewComplianceSubmission(submissionId, { decision, adminNotes }),
    onSuccess: async () => {
      toast.success('Compliance submission reviewed.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-compliance-submissions'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-analytics'] }),
      ]);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to review this compliance submission.'));
    },
  });

  const pendingRequests    = registrationRequestsQuery.data?.items  ?? [];
  const pendingSubmissions = complianceSubmissionsQuery.data?.items  ?? [];
  const editRequestedSubmissions = editRequestedSubmissionsQuery.data?.items ?? [];
  const allComplianceSubmissions = [...pendingSubmissions, ...editRequestedSubmissions];
  const isComplianceLoading = complianceSubmissionsQuery.isLoading || editRequestedSubmissionsQuery.isLoading;

  const isStudentRole = roleFilter === UserRole.STUDENT;
  const isInstitutionRole = roleFilter === UserRole.SCHOOL || roleFilter === UserRole.COLLEGE;

  // Only surface the approval cards that match the selected role.
  const registrationItems = roleFilter
    ? pendingRequests.filter((req) => req.role === roleFilter)
    : pendingRequests;
  const complianceItems = !roleFilter
    ? allComplianceSubmissions
    : isInstitutionRole
      ? allComplianceSubmissions.filter((sub) => sub.institutionType === roleFilter)
      : [];

  // Students have no public sign-up requests — they are managed inside the institution.
  if (isStudentRole) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900 px-6 py-12 text-center text-sm text-slate-400">
        Student approvals happen inside the school or college workspace, not as public sign-up
        requests. Use the roster tools on the left to invite or create student accounts.
      </div>
    );
  }

  const showComplianceLane = !roleFilter || isInstitutionRole;

  return (
    <div className={`grid gap-10 xl:items-start ${showComplianceLane ? '2xl:grid-cols-2' : ''}`}>
      <ReviewLane
        count={registrationItems.length}
        isLoading={registrationRequestsQuery.isLoading}
      >
        {registrationItems.map((req) => (
          <RegistrationRequestCard
            key={req._id}
            request={req}
            rejectReason={registrationRejectReasons[req._id] ?? ''}
            onRejectReasonChange={(v) => setRegistrationRejectReasons((c) => ({ ...c, [req._id]: v }))}
            isPending={reviewRequestMutation.isPending}
            onApprove={(id) => reviewRequestMutation.mutate({ requestId: id, decision: 'approved' })}
            onReject={(id) => reviewRequestMutation.mutate({
              requestId: id,
              decision: 'rejected',
              reason: registrationRejectReasons[id]?.trim() || undefined,
            })}
          />
        ))}
      </ReviewLane>

      {showComplianceLane ? (
        <ReviewLane
          count={complianceItems.length}
          isLoading={isComplianceLoading}
        >
          {complianceItems.map((sub) => (
            <ComplianceSubmissionCard
              key={sub._id}
              submission={sub}
              rejectNote={complianceRejectNotes[sub._id] ?? ''}
              onRejectNoteChange={(v) => setComplianceRejectNotes((c) => ({ ...c, [sub._id]: v }))}
              isPending={reviewComplianceMutation.isPending}
              onApprove={(id) => reviewComplianceMutation.mutate({ submissionId: id, decision: 'approved' })}
              onReject={(id) => reviewComplianceMutation.mutate({
                submissionId: id,
                decision: 'rejected',
                adminNotes: complianceRejectNotes[id]?.trim(),
              })}
            />
          ))}
        </ReviewLane>
      ) : null}
    </div>
  );
}
