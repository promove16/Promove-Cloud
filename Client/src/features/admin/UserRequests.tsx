import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import type { InstitutionPolicySubmissionRecord } from '../../types/school.types';
import { UserRole } from '../../types/roles.types';

const isInstitutionRequest = (role: UserRole) =>
  role === UserRole.SCHOOL || role === UserRole.COLLEGE;

const reviewToneClass: Record<InstitutionPolicySubmissionRecord['status'], string> = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  rejected: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

const policyToneClass: Record<string, string> = {
  Active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  'On Track': 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  Pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  Inactive: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

const formatSubmissionStatus = (status: InstitutionPolicySubmissionRecord['status']) =>
  status === 'pending' ? 'Pending Review' : status === 'approved' ? 'Approved' : 'Rejected';

function ComplianceSubmissionCard({
  submission,
  onApprove,
  onReject,
  isPending,
}: {
  submission: InstitutionPolicySubmissionRecord;
  onApprove: (submissionId: string) => void;
  onReject: (submissionId: string) => void;
  isPending: boolean;
}) {
  const institutionName =
    submission.institution?.institutionName || submission.institution?.displayName || submission.institutionId;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-lg font-semibold text-white">{institutionName}</div>
            <Badge className={reviewToneClass[submission.status]}>{formatSubmissionStatus(submission.status)}</Badge>
            <Badge className="border-slate-700 bg-slate-800 text-slate-200 capitalize">
              {submission.institutionType}
            </Badge>
          </div>

          <div className="grid gap-2 text-sm text-slate-300 md:grid-cols-2">
            <div>Email: {submission.institution?.email ?? 'Unknown'}</div>
            <div>
              Submitted: {new Date(submission.submittedAt).toLocaleString('en-IN')}
            </div>
            {submission.institution?.location ? (
              <div>Location: {submission.institution.location}</div>
            ) : null}
            {submission.submittedByUser ? (
              <div>Submitted by: {submission.submittedByUser.displayName}</div>
            ) : null}
          </div>

          {submission.summaryNote ? (
            <div className="max-w-4xl rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 text-sm text-slate-300">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Institution Note</div>
              <div className="mt-2">{submission.summaryNote}</div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Submitted Policy Rows</div>
            <div className="mt-4 space-y-3">
              {submission.policies.map((policy) => (
                <div
                  key={`${submission._id}-${policy.name}`}
                  className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 md:grid-cols-[1.8fr,160px,160px]"
                >
                  <div className="font-medium text-white">{policy.name}</div>
                  <div
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                      policyToneClass[policy.status] ?? 'border-slate-700 bg-slate-800 text-slate-200'
                    }`}
                  >
                    {policy.status}
                  </div>
                  <div className="text-sm text-slate-400">
                    {policy.lastUpdated
                      ? new Date(policy.lastUpdated).toLocaleDateString('en-IN')
                      : 'No update yet'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onApprove(submission._id)} disabled={isPending}>
            Approve
          </Button>
          <Button variant="secondary" onClick={() => onReject(submission._id)} disabled={isPending}>
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function UserRequests() {
  const queryClient = useQueryClient();
  const registrationRequestsQuery = useQuery({
    queryKey: ['admin-registration-requests', 'pending'],
    queryFn: () => adminApi.getRegistrationRequests({ status: 'pending' }),
  });
  const complianceSubmissionsQuery = useQuery({
    queryKey: ['admin-compliance-submissions', 'pending'],
    queryFn: () => adminApi.getComplianceSubmissions({ status: 'pending' }),
  });

  const reviewRequestMutation = useMutation({
    mutationFn: ({
      requestId,
      decision,
      reason,
    }: {
      requestId: string;
      decision: 'approved' | 'rejected';
      reason?: string;
    }) =>
      decision === 'approved'
        ? adminApi.approveRegistrationRequest(requestId)
        : adminApi.rejectRegistrationRequest(
            requestId,
            reason ?? 'Registration request rejected by admin',
          ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['admin-registration-requests'],
        }),
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-analytics'] }),
      ]);
    },
  });

  const reviewComplianceMutation = useMutation({
    mutationFn: ({
      submissionId,
      decision,
      adminNotes,
    }: {
      submissionId: string;
      decision: 'approved' | 'rejected';
      adminNotes?: string;
    }) => adminApi.reviewComplianceSubmission(submissionId, { decision, adminNotes }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-compliance-submissions'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-analytics'] }),
      ]);
    },
  });

  const pendingRequests = registrationRequestsQuery.data?.items ?? [];
  const pendingSubmissions = complianceSubmissionsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">
              Registration Requests
            </div>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Approve public sign-up requests
            </h2>
            <p className="mt-2 text-slate-400">
              School and college requests include legal verification documents.
              Admin approval stays blocked until the institution packet is
              complete. Student institution approvals do not appear here because
              they stay inside the linked school or college workspace.
            </p>
          </div>
          <Badge>{pendingRequests.length} pending</Badge>
        </div>

        <div className="mt-6 space-y-4">
          {registrationRequestsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-5 py-10 text-sm text-slate-400">
              No institution or operator registration requests are waiting right now. Student roster approvals are institution-owned and stay outside this admin queue.
            </div>
          ) : (
            pendingRequests.map((request) => {
              const readiness = request.institutionVerification?.readiness;
              const isInstitution = isInstitutionRequest(request.role);

              return (
                <div
                  key={request._id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-lg font-semibold text-white">
                          {request.displayName}
                        </div>
                        <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                          pending
                        </Badge>
                        <Badge className="border-slate-700 bg-slate-800 text-slate-200 capitalize">
                          {request.role}
                        </Badge>
                        {isInstitution ? (
                          <Badge
                            className={
                              readiness?.isReadyForReview
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                : 'border-red-500/30 bg-red-500/10 text-red-300'
                            }
                          >
                            {readiness?.isReadyForReview
                              ? 'docs ready'
                              : 'docs incomplete'}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="text-sm text-slate-300">{request.email}</div>
                      <div className="text-xs uppercase tracking-[0.25em] text-slate-500">
                        Requested{' '}
                        {new Date(request.requestedAt).toLocaleString('en-IN')}
                      </div>

                      {request.domain ? (
                        <div className="text-sm text-slate-400">
                          Domain: {request.domain}
                        </div>
                      ) : null}
                      {request.bio ? (
                        <div className="max-w-3xl text-sm text-slate-400">
                          {request.bio}
                        </div>
                      ) : null}

                      {request.institutionProfile ? (
                        <div className="grid gap-2 text-sm text-slate-300 md:grid-cols-2">
                          <div>
                            Institution: {request.institutionProfile.institutionName}
                          </div>
                          <div>Location: {request.institutionProfile.location}</div>
                          <div>
                            Academic Year: {request.institutionProfile.academicYear}
                          </div>
                          <div>
                            Students:{' '}
                            {request.institutionProfile.totalStudentsEnrolled}
                          </div>
                        </div>
                      ) : null}

                      {request.institutionVerification ? (
                        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                            Verification Packet
                          </div>

                          {request.institutionVerification.regulatoryBodies.length >
                          0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {request.institutionVerification.regulatoryBodies.map(
                                (body: string) => (
                                  <Badge
                                    key={body}
                                    className="border-slate-700 bg-slate-900 text-slate-200"
                                  >
                                    {body}
                                  </Badge>
                                ),
                              )}
                            </div>
                          ) : null}

                          {request.institutionVerification.affiliationName ? (
                            <div className="mt-3 text-sm text-slate-300">
                              Affiliation:{' '}
                              {request.institutionVerification.affiliationName}
                            </div>
                          ) : null}
                          {request.institutionVerification.referenceCode ? (
                            <div className="text-sm text-slate-300">
                              Reference Code:{' '}
                              {request.institutionVerification.referenceCode}
                            </div>
                          ) : null}
                          {request.institutionVerification.websiteUrl ? (
                            <a
                              href={request.institutionVerification.websiteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-cyan-300 underline"
                            >
                              {request.institutionVerification.websiteUrl}
                            </a>
                          ) : null}
                          {request.institutionVerification.notes ? (
                            <div className="mt-2 text-sm text-slate-400">
                              {request.institutionVerification.notes}
                            </div>
                          ) : null}

                          <div className="mt-4 space-y-2">
                            {request.institutionVerification.documents.map(
                              (document) => (
                                <div
                                  key={document._id}
                                  className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 md:flex-row md:items-center md:justify-between"
                                >
                                  <div>
                                    <div className="text-sm font-medium text-white">
                                      {document.category.replace(/_/g, ' ')}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                      {`${document.fileName} - ${document.fileType.toUpperCase()} - uploaded ${new Date(document.uploadedAt).toLocaleString('en-IN')}`}
                                    </div>
                                  </div>
                                  <a
                                    href={document.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm font-medium text-cyan-300 underline"
                                  >
                                    Open document
                                  </a>
                                </div>
                              ),
                            )}
                          </div>

                          {readiness && readiness.missingItems.length > 0 ? (
                            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                              Missing: {readiness.missingItems.join(', ')}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="text-sm text-slate-400">
                        Access will stay disabled until this request is approved.
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() =>
                          reviewRequestMutation.mutate({
                            requestId: request._id,
                            decision: 'approved',
                          })
                        }
                        disabled={reviewRequestMutation.isPending}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const reason = window
                            .prompt(
                              'Add a short rejection reason (optional):',
                            )
                            ?.trim();
                          reviewRequestMutation.mutate({
                            requestId: request._id,
                            decision: 'rejected',
                            ...(reason ? { reason } : {}),
                          });
                        }}
                        disabled={reviewRequestMutation.isPending}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">
              Compliance Verification
            </div>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Review institution policy submissions
            </h2>
            <p className="mt-2 text-slate-400">
              Schools and colleges now submit policy framework updates through
              their compliance workspace. Admin approval here is what moves that
              packet into the live verified dashboard state.
            </p>
          </div>
          <Badge>{pendingSubmissions.length} pending</Badge>
        </div>

        <div className="mt-6 space-y-4">
          {complianceSubmissionsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : pendingSubmissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-5 py-10 text-sm text-slate-400">
              No compliance verification packets are waiting right now.
            </div>
          ) : (
            pendingSubmissions.map((submission) => (
              <ComplianceSubmissionCard
                key={submission._id}
                submission={submission}
                isPending={reviewComplianceMutation.isPending}
                onApprove={(submissionId) =>
                  reviewComplianceMutation.mutate({
                    submissionId,
                    decision: 'approved',
                  })
                }
                onReject={(submissionId) => {
                  const adminNotes = window
                    .prompt('Add rejection notes for this submission (required):')
                    ?.trim();

                  if (!adminNotes) {
                    return;
                  }

                  reviewComplianceMutation.mutate({
                    submissionId,
                    decision: 'rejected',
                    adminNotes,
                  });
                }}
              />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
