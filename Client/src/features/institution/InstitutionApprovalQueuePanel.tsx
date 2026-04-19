import { AlertCircle, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import type { PendingStudentVerification } from '../../types/school.types';

type InstitutionApprovalQueuePanelProps = {
  pendingStudents: PendingStudentVerification[];
  isLoading?: boolean;
  isReviewing?: boolean;
  rejectingStudentId: string | null;
  rejectReason: string;
  onRejectReasonChange: (value: string) => void;
  onBeginReject: (studentId: string) => void;
  onCancelReject: () => void;
  onApprove: (studentId: string) => void;
  onConfirmReject: (studentId: string) => void;
};

function formatDateTime(date: string) {
  return new Date(date).toLocaleString('en-IN');
}

export function InstitutionApprovalQueuePanel({
  pendingStudents,
  isLoading = false,
  isReviewing = false,
  rejectingStudentId,
  rejectReason,
  onRejectReasonChange,
  onBeginReject,
  onCancelReject,
  onApprove,
  onConfirmReject,
}: InstitutionApprovalQueuePanelProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4 lg:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-cyan-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500">
              Approval Queue
            </div>
            <div className="mt-1 text-lg font-semibold text-white">Pending Requests</div>
          </div>
        </div>
        <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
          {pendingStudents.length === 0 ? 'Queue clear' : `${pendingStudents.length} waiting`}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-400">
          Loading approval queue...
        </div>
      ) : pendingStudents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-400">
          No student approvals are waiting right now.
        </div>
      ) : (
        <div className="space-y-3">
          {pendingStudents.map((student) => {
            const isRejecting = rejectingStudentId === student._id;

            return (
              <div
                key={student._id}
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4"
              >
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="font-semibold text-white">{student.displayName}</div>
                    <div className="mt-1 text-sm text-slate-400">{student.email}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      Requested {formatDateTime(student.verificationRequestedAt ?? student.createdAt)}
                    </div>
                    {student.domain ? (
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
                        {student.domain}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => onApprove(student._id)} disabled={isReviewing}>
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => onBeginReject(student._id)}
                      disabled={isReviewing}
                    >
                      Reject
                    </Button>
                  </div>
                </div>

                {isRejecting ? (
                  <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-rose-200">
                      <AlertCircle className="h-4 w-4" />
                      Reject request
                    </div>
                    <textarea
                      value={rejectReason}
                      onChange={(event) => onRejectReasonChange(event.target.value)}
                      placeholder="Reason (optional)"
                      rows={3}
                      className="mt-3 w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                    />
                    <div className="mt-3 flex justify-end gap-3">
                      <Button variant="secondary" onClick={onCancelReject}>
                        Cancel
                      </Button>
                      <button
                        type="button"
                        onClick={() => onConfirmReject(student._id)}
                        disabled={isReviewing}
                        className="rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
                      >
                        {isReviewing ? 'Rejecting...' : 'Confirm Rejection'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
