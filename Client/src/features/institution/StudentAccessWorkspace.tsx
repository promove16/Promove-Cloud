import { FormEventHandler } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { PendingStudentVerification, StudentAccessToken } from '../../types/school.types';
import { DashboardRow } from './dashboardSurface';

type StudentAccessWorkspaceProps = {
  tokenLabel: string;
  tokenPlaceholder: string;
  tokenFallbackLabel: string;
  tokens: StudentAccessToken[];
  pendingStudents: PendingStudentVerification[];
  isCreatingToken: boolean;
  isReviewingStudents: boolean;
  onTokenLabelChange: (value: string) => void;
  onCreateToken: FormEventHandler<HTMLFormElement>;
  onApproveStudent: (studentId: string) => void;
  onRejectStudent: (studentId: string) => void;
};

function formatDate(date?: string) {
  return date ? new Date(date).toLocaleDateString('en-IN') : 'No expiry';
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString('en-IN');
}

function getExpiryLabel(date?: string) {
  const formattedDate = formatDate(date);
  return formattedDate === 'No expiry' ? formattedDate : `Expires ${formattedDate}`;
}

export function StudentAccessWorkspace({
  tokenLabel,
  tokenPlaceholder,
  tokenFallbackLabel,
  tokens,
  pendingStudents,
  isCreatingToken,
  isReviewingStudents,
  onTokenLabelChange,
  onCreateToken,
  onApproveStudent,
  onRejectStudent,
}: StudentAccessWorkspaceProps) {
  return (
    <div className="grid gap-8 border-t border-slate-800 pt-6 xl:grid-cols-[minmax(0,1.2fr),minmax(320px,0.8fr)]">
      <div className="space-y-6 xl:border-r xl:border-slate-800 xl:pr-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-white">Access Tokens</h3>
          </div>
          <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
            {tokens.length} active
          </div>
        </div>

        <form onSubmit={onCreateToken} className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={tokenLabel}
              onChange={(event) => onTokenLabelChange(event.target.value)}
              placeholder={tokenPlaceholder}
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <Button type="submit" disabled={isCreatingToken}>
            {isCreatingToken ? 'Issuing...' : 'Issue Access Token'}
          </Button>
        </form>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 px-5 py-4">
          <div className="mb-1 flex items-center justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Tokens</div>
            <div className="text-xs text-slate-500">Latest 4</div>
          </div>
          {tokens.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-500">
              No access tokens issued yet.
            </div>
          ) : (
            <div className="space-y-0">
              {tokens.slice(0, 4).map((token) => (
                <DashboardRow key={token._id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-mono text-sm font-semibold text-cyan-300">{token.token}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        {token.label ?? tokenFallbackLabel}
                      </div>
                    </div>
                    <div className="text-right text-sm text-slate-400">
                      <div>{token.usageCount} registrations</div>
                      <div>{getExpiryLabel(token.expiresAt)}</div>
                    </div>
                  </div>
                </DashboardRow>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex h-full flex-col space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-white">Approval Queue</h3>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300">
            <ShieldCheck className="h-3.5 w-3.5 text-cyan-300" />
            {pendingStudents.length === 0 ? 'Queue clear' : `${pendingStudents.length} waiting`}
          </div>
        </div>

        <div className="flex flex-1 flex-col rounded-3xl border border-slate-800 bg-slate-900 px-5 py-4">
          {pendingStudents.length === 0 ? (
            <div className="min-h-[220px] flex-1" />
          ) : (
            <div className="space-y-0">
              {pendingStudents.map((student) => (
                <DashboardRow key={student._id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-white">{student.displayName}</div>
                      <div className="mt-1 text-sm text-slate-400">{student.email}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        Requested {formatDateTime(student.verificationRequestedAt ?? student.createdAt)}
                      </div>
                      {student.domain ? (
                        <div className="mt-2 text-sm text-cyan-200">Focus: {student.domain}</div>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => onApproveStudent(student._id)}
                        disabled={isReviewingStudents}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => onRejectStudent(student._id)}
                        disabled={isReviewingStudents}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </DashboardRow>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
