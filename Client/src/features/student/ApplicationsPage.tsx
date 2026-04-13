import { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BriefcaseBusiness,
  Clock3,
  MapPin,
  MessageCircle,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { recruiterApi } from '../../api/recruiter.api';
import { requestApi } from '../../api/request.api';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { ApplicationStatusBar } from './ApplicationStatusBar';
import { APPLICATION_STAGE_BADGE } from '../../utils/applicationStages';
import type { RecruiterStudentApplicationView } from '../../types/recruiter.types';
import type { WorkflowRequest } from '../../types/request.types';

const SOURCE_COPY = {
  student_apply: 'Applied by you',
  recruiter_invite: 'Invited by recruiter',
  hiring_event: 'From hiring event',
} as const;

const relativeLabel = (value: string) => {
  const ms = Date.now() - new Date(value).getTime();
  const hours = Math.max(0, Math.floor(ms / (60 * 60 * 1000)));
  if (hours < 24) return hours <= 1 ? 'Updated just now' : `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Updated ${days}d ago`;
  return `Updated ${new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
};

const getSearchText = (application: RecruiterStudentApplicationView) =>
  [
    application.job.title,
    application.job.company,
    application.job.location,
    application.job.domain,
    application.recruiter.displayName,
    application.recruiter.headline,
    application.note,
    application.stage,
    SOURCE_COPY[application.source],
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const getRequestMetadataString = (request: WorkflowRequest, key: string) => {
  const value = request.metadata?.[key];
  return typeof value === 'string' ? value : undefined;
};

export default function ApplicationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const applicationsQuery = useQuery({
    queryKey: ['student', 'applications'],
    queryFn: recruiterApi.getMyApplications,
  });
  const invitesQuery = useQuery({
    queryKey: ['requests', 'incoming', 'recruiter-job-invites'],
    queryFn: requestApi.incoming,
  });
  const inviteActionMutation = useMutation({
    mutationFn: (params: { action: 'accept' | 'decline'; requestId: string }) =>
      params.action === 'accept' ? requestApi.accept(params.requestId) : requestApi.decline(params.requestId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['requests'] }),
        queryClient.invalidateQueries({ queryKey: ['student', 'applications'] }),
      ]);
    },
  });

  const applications = useMemo(() => {
    const source = applicationsQuery.data ?? [];
    if (!deferredSearch) {
      return source;
    }

    return source.filter((application) => getSearchText(application).includes(deferredSearch));
  }, [applicationsQuery.data, deferredSearch]);

  const invitedCount = useMemo(
    () => (applicationsQuery.data ?? []).filter((application) => application.source === 'recruiter_invite').length,
    [applicationsQuery.data],
  );
  const activeCount = useMemo(
    () =>
      (applicationsQuery.data ?? []).filter(
        (application) => application.stage !== 'Rejected' && application.stage !== 'Hired',
      ).length,
    [applicationsQuery.data],
  );
  const pendingJobInvites = useMemo(
    () =>
      (invitesQuery.data ?? [])
        .filter((request) => request.type === 'recruiter_job_invite' && request.status === 'pending')
        .filter((request) => {
          if (!deferredSearch) return true;
          return [
            getRequestMetadataString(request, 'jobTitle'),
            getRequestMetadataString(request, 'company'),
            request.fromUser?.displayName,
            request.message,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(deferredSearch);
        }),
    [deferredSearch, invitesQuery.data],
  );

  return (
    <div className="space-y-5">
      <header className="border-b border-slate-800 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
              <Sparkles className="h-4 w-4" />
              Hiring Flow
            </div>
            <h1 className="text-2xl font-semibold text-white">My applications</h1>
            <p className="mt-1 text-sm text-slate-400">
              Track jobs you applied to and recruiter-led invites in one hiring timeline.
            </p>
          </div>
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by job, recruiter, company, or stage"
              className="pl-11"
            />
          </div>
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-4 border-b border-slate-800 pb-4 text-sm text-slate-300">
        <div className="flex items-center gap-2">
          <BriefcaseBusiness className="h-4 w-4 text-cyan-300" />
          <span className="font-medium text-white">{applicationsQuery.data?.length ?? 0}</span>
          total applications
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-300" />
          <span className="font-medium text-white">{invitedCount}</span>
          recruiter invites
        </div>
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-emerald-300" />
          <span className="font-medium text-white">{activeCount}</span>
          active
        </div>
      </section>

      {applicationsQuery.isLoading ? (
        <div className="flex items-center justify-center border border-slate-800 p-12">
          <Spinner />
        </div>
      ) : null}

      {applicationsQuery.isError ? (
        <div className="border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
          Unable to load your applications right now.
        </div>
      ) : null}

      {!invitesQuery.isLoading && pendingJobInvites.length > 0 ? (
        <section className="border border-cyan-500/20 bg-cyan-500/5">
          <div className="border-b border-cyan-500/20 px-4 py-3 text-xs uppercase tracking-[0.28em] text-cyan-200">
            Pending recruiter invites
          </div>
          <div className="divide-y divide-cyan-500/10">
            {pendingJobInvites.map((request) => {
              const jobTitle = getRequestMetadataString(request, 'jobTitle') ?? 'Job invite';
              const company = getRequestMetadataString(request, 'company') ?? 'Recruiter';
              return (
                <article key={request._id} className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                  <div>
                    <div className="text-base font-semibold text-white">{jobTitle}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {company} | {request.fromUser?.displayName ?? 'Recruiter'}
                    </div>
                    {request.message ? (
                      <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                        {request.message}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => inviteActionMutation.mutate({ action: 'accept', requestId: request._id })}
                      disabled={inviteActionMutation.isPending}
                      className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => inviteActionMutation.mutate({ action: 'decline', requestId: request._id })}
                      disabled={inviteActionMutation.isPending}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-100 disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {!applicationsQuery.isLoading && !applicationsQuery.isError && applications.length === 0 ? (
        <div className="border border-slate-800 p-12 text-center">
          <BriefcaseBusiness className="mx-auto h-14 w-14 text-slate-600" />
          <h2 className="mt-4 text-2xl font-semibold text-white">No applications yet</h2>
          <p className="mt-2 text-slate-400">
            Apply from the marketplace or wait for recruiter invites to appear here.
          </p>
        </div>
      ) : null}

      {!applicationsQuery.isLoading && !applicationsQuery.isError && applications.length > 0 ? (
        <section className="border border-slate-800">
          <div className="divide-y divide-slate-800">
            {applications.map((application) => (
              <article
                key={`${application.job._id}-${application.updatedAt}`}
                className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1.4fr),220px,220px]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-lg font-semibold text-white">{application.job.title}</div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] ${APPLICATION_STAGE_BADGE[application.stage]}`}
                    >
                      {application.stage}
                    </span>
                    <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
                      {SOURCE_COPY[application.source]}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-slate-400">
                    <span className="font-medium text-slate-200">{application.job.company}</span>
                    <span className="text-slate-600">|</span>
                    <span>{application.recruiter.displayName}</span>
                    <span className="text-slate-600">|</span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-cyan-300" />
                      {application.job.location}
                    </span>
                  </div>

                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{application.job.description}</p>

                  {application.note ? (
                    <div className="mt-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                      {application.note}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2 text-sm text-slate-400">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Applied</div>
                    <div className="mt-1 text-slate-200">
                      {new Date(application.appliedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Latest update</div>
                    <div className="mt-1 text-slate-200">{relativeLabel(application.updatedAt)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Role</div>
                    <div className="mt-1 text-slate-200">
                      {application.job.type}
                      {application.job.workMode ? ` · ${application.job.workMode}` : ''}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/dashboard/student/applications/${application.job._id}-${application.recruiter._id}`)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                  >
                    View Details
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/dashboard/messages/${application.recruiter._id}`)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-slate-600 hover:bg-slate-800"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Message recruiter
                  </button>
                </div>

                <div className="xl:col-span-3">
                  <ApplicationStatusBar application={application} />
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
