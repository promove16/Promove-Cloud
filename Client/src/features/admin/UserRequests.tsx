import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { UserRole } from '../../types/roles.types';

const isInstitutionRequest = (role: UserRole) =>
  role === UserRole.SCHOOL || role === UserRole.COLLEGE;

export default function UserRequests() {
  const queryClient = useQueryClient();
  const registrationRequestsQuery = useQuery({
    queryKey: ['admin-registration-requests', 'pending'],
    queryFn: () => adminApi.getRegistrationRequests({ status: 'pending' }),
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

  const pendingRequests = registrationRequestsQuery.data?.items ?? [];

  return (
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
            School and college requests now include legal verification
            documents. Admin approval stays blocked until the institution packet
            is complete.
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
            No registration requests are waiting right now.
          </div>
        ) : (
          pendingRequests.map((request) => {
            const readiness = request.institutionVerification?.readiness;
            const isInstitution = isInstitutionRequest(request.role);

            return (
              <div
                key={request._id}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-5"
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
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
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
                                className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 md:flex-row md:items-center md:justify-between"
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
  );
}
