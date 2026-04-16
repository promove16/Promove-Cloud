import { Link } from 'react-router-dom';
import { ArrowRight, Building2, CheckCircle2, Clock3, ShieldAlert, ShieldCheck } from 'lucide-react';
import { AuthUser } from '../../types/auth.types';

type StudentInstitutionStatusPanelProps = {
  user: AuthUser | null;
  className?: string;
  showSettingsLink?: boolean;
};

type StatusTone = 'slate' | 'amber' | 'emerald' | 'rose';

type StudentInstitutionStatusSummary = {
  institutionStatusLabel: string;
  approvalStatusLabel: string;
  escalationLabel: string;
  accessSourceLabel: string | null;
  institutionName: string;
  tone: StatusTone;
  headline: string;
  description: string;
  ownershipNote: string;
};

const toneClassMap: Record<StatusTone, string> = {
  slate: 'border-slate-800 bg-slate-950/60',
  amber: 'border-amber-500/20 bg-amber-500/10',
  emerald: 'border-emerald-500/20 bg-emerald-500/10',
  rose: 'border-rose-500/20 bg-rose-500/10',
};

const badgeToneMap: Record<StatusTone, string> = {
  slate: 'border-slate-700 bg-slate-900/70 text-slate-200',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  rose: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
};

const titleCase = (value: string) =>
  value
    .replace(/_/g, ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const accessSourceLabelMap: Record<NonNullable<AuthUser['accessGrantedBy']>, string> = {
  self_registered: 'Self registered',
  institution_token: 'Institution token',
  institution_roster: 'Institution roster',
  institution_admin: 'Institution admin',
  admin: 'ProMove admin',
  startup_school: 'Startup school',
  skill_dev: 'Skill development',
};

export const getStudentInstitutionStatusSummary = (
  user: AuthUser | null,
): StudentInstitutionStatusSummary => {
  const institutionName =
    user?.institutionProfile?.institutionName?.trim() || 'No linked institution yet';
  const institutionStatusLabel = titleCase(user?.institutionVerificationStatus ?? 'none');
  const approvalStatusLabel = titleCase(user?.verificationStatus ?? 'not_required');
  const accessSourceLabel = user?.accessGrantedBy
    ? accessSourceLabelMap[user.accessGrantedBy]
    : null;

  if (user?.adminApprovalStatus === 'pending') {
    return {
      institutionStatusLabel,
      approvalStatusLabel,
      escalationLabel: 'Admin review required',
      accessSourceLabel,
      institutionName,
      tone: 'amber',
      headline: 'Platform admin approval is still blocking this account.',
      description:
        'A ProMove admin still needs to review the related institution or operator request before this account can fully proceed.',
      ownershipNote:
        'Student verification is normally handled by your school or college. Admin only steps in when the institution account itself is under review or a special escalation is needed.',
    };
  }

  if (
    user?.verificationStatus === 'rejected' ||
    user?.institutionVerificationStatus === 'failed'
  ) {
    return {
      institutionStatusLabel,
      approvalStatusLabel,
      escalationLabel: 'Action required',
      accessSourceLabel,
      institutionName,
      tone: 'rose',
      headline: 'Your institution link needs attention.',
      description:
        'The current institution verification did not complete successfully. Contact your school or college operator or submit a valid institution token again.',
      ownershipNote:
        'This is an institution-owned workflow. ProMove admin approval is not the next step unless your institution asks for a platform escalation.',
    };
  }

  if (
    user?.verificationStatus === 'pending' ||
    user?.institutionVerificationStatus === 'pending'
  ) {
    return {
      institutionStatusLabel,
      approvalStatusLabel,
      escalationLabel: 'Institution review required',
      accessSourceLabel,
      institutionName,
      tone: 'amber',
      headline: 'Your school or college still needs to verify this link.',
      description:
        'The institution token or roster match has been recorded, but the institution has not finished the student approval step yet.',
      ownershipNote:
        'This approval is handled by your school or college dashboard. ProMove admin approval is not normally required for student verification.',
    };
  }

  if (
    user?.verificationStatus === 'verified' ||
    user?.institutionVerificationStatus === 'verified'
  ) {
    return {
      institutionStatusLabel,
      approvalStatusLabel,
      escalationLabel: 'No admin escalation',
      accessSourceLabel,
      institutionName,
      tone: 'emerald',
      headline: 'Your institution link is active and already verified.',
      description:
        'Your school or college has already approved the student link, so no additional platform approval is pending for this account.',
      ownershipNote:
        'Future changes such as swapping institution tokens still go back through the institution-owned review flow, not the general admin queue.',
    };
  }

  return {
    institutionStatusLabel,
    approvalStatusLabel,
    escalationLabel: 'Institution link missing',
    accessSourceLabel,
    institutionName,
    tone: 'slate',
    headline: 'No institution link is active on this account yet.',
    description:
      'Add a valid school or college token to start the institution verification flow and sync institution-managed education details.',
    ownershipNote:
      'Once a token is submitted, your school or college owns the student verification step. ProMove admin approval is only for institution and operator sign-up requests.',
  };
};

export function StudentInstitutionStatusPanel({
  user,
  className,
  showSettingsLink,
}: StudentInstitutionStatusPanelProps) {
  const summary = getStudentInstitutionStatusSummary(user);
  const toneClass = toneClassMap[summary.tone];
  const badgeToneClass = badgeToneMap[summary.tone];
  const SummaryIcon =
    summary.tone === 'emerald'
      ? CheckCircle2
      : summary.tone === 'amber'
        ? Clock3
        : summary.tone === 'rose'
          ? ShieldAlert
          : Building2;

  return (
    <div className={`rounded-2xl border p-5 ${toneClass} ${className ?? ''}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${badgeToneClass}`}>
              Institution link {summary.institutionStatusLabel}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
              Account approval {summary.approvalStatusLabel}
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${badgeToneClass}`}>
              {summary.escalationLabel}
            </span>
            {summary.accessSourceLabel ? (
              <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
                Access via {summary.accessSourceLabel}
              </span>
            ) : null}
          </div>

          <div className="mt-4 flex items-start gap-3">
            <div className={`mt-0.5 rounded-xl border p-2 ${badgeToneClass}`}>
              <SummaryIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                Institution Status
              </div>
              <div className="mt-1 text-lg font-semibold text-white">
                {summary.institutionName}
              </div>
              <p className="mt-2 text-sm font-medium text-white">{summary.headline}</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                {summary.description}
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                {summary.ownershipNote}
              </p>
            </div>
          </div>
        </div>

        {showSettingsLink ? (
          <Link
            to="/dashboard/settings?tab=role"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:text-white"
          >
            Manage institution link
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-800/80 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
        <span>
          Student institution approvals live with the linked school or college dashboard. The admin queue is for institution and operator sign-up requests, not day-to-day student roster verification.
        </span>
      </div>
    </div>
  );
}
