import { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageCircle,
  Search,
  Users,
  Zap,
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

const SOURCE_COLOR = {
  student_apply: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  recruiter_invite: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  hiring_event: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
} as const;

const STAGE_FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'Applied', label: 'Applied' },
  { key: 'Screening', label: 'Screening' },
  { key: 'Shortlisted', label: 'Shortlisted' },
  { key: 'Interview', label: 'Interview' },
  { key: 'Offered', label: 'Offered' },
  { key: 'Hired', label: 'Hired' },
  { key: 'Rejected', label: 'Rejected' },
] as const;

type StageFilter = (typeof STAGE_FILTER_TABS)[number]['key'];

const COMPANY_GRADIENTS = [
  'from-blue-600 to-blue-700',
  'from-violet-600 to-violet-700',
  'from-emerald-600 to-emerald-700',
  'from-rose-600 to-rose-700',
  'from-amber-500 to-amber-600',
  'from-cyan-600 to-cyan-700',
  'from-indigo-600 to-indigo-700',
  'from-pink-600 to-pink-700',
  'from-teal-600 to-teal-700',
  'from-orange-500 to-orange-600',
];

const getCompanyGradient = (name: string) =>
  COMPANY_GRADIENTS[name.charCodeAt(0) % COMPANY_GRADIENTS.length];

const relativeLabel = (value: string) => {
  const ms = Date.now() - new Date(value).getTime();
  const hours = Math.max(0, Math.floor(ms / (60 * 60 * 1000)));
  if (hours < 24) return hours <= 1 ? 'Just now' : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

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
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');
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
    return source.filter((application) => {
      const matchesSearch = deferredSearch ? getSearchText(application).includes(deferredSearch) : true;
      const matchesStage = stageFilter === 'all' || application.stage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [applicationsQuery.data, deferredSearch, stageFilter]);

  const stageCounts = useMemo(() => {
    const source = applicationsQuery.data ?? [];
    const counts: Record<string, number> = { all: source.length };
    STAGE_FILTER_TABS.slice(1).forEach((tab) => {
      counts[tab.key] = source.filter((a) => a.stage === tab.key).length;
    });
    return counts;
  }, [applicationsQuery.data]);

  const invitedCount = useMemo(
    () => (applicationsQuery.data ?? []).filter((a) => a.source === 'recruiter_invite').length,
    [applicationsQuery.data],
  );
  const activeCount = useMemo(
    () =>
      (applicationsQuery.data ?? []).filter((a) => a.stage !== 'Rejected' && a.stage !== 'Hired').length,
    [applicationsQuery.data],
  );
  const hiredCount = useMemo(
    () => (applicationsQuery.data ?? []).filter((a) => a.stage === 'Hired').length,
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
      {/* Header */}
      <header className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/60 px-6 py-6">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-blue-500/5" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-cyan-400">
              <Zap className="h-3.5 w-3.5" />
              Hiring Flow
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">My Applications</h1>
            <p className="mt-1 text-sm text-slate-400">
              Track jobs you applied to and recruiter-led invites in one timeline.
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs, companies, recruiters…"
              className="pl-10"
            />
          </div>
        </div>
      </header>

      {/* KPI stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            icon: BriefcaseBusiness,
            label: 'Total',
            value: applicationsQuery.data?.length ?? 0,
            color: 'text-white',
            iconColor: 'text-slate-400',
            border: 'border-slate-800',
            bg: 'bg-slate-900',
          },
          {
            icon: Clock3,
            label: 'Active',
            value: activeCount,
            color: 'text-emerald-400',
            iconColor: 'text-emerald-400',
            border: 'border-emerald-500/20',
            bg: 'bg-emerald-500/5',
          },
          {
            icon: Users,
            label: 'Invited',
            value: invitedCount,
            color: 'text-violet-400',
            iconColor: 'text-violet-400',
            border: 'border-violet-500/20',
            bg: 'bg-violet-500/5',
          },
          {
            icon: CheckCircle2,
            label: 'Hired',
            value: hiredCount,
            color: 'text-cyan-400',
            iconColor: 'text-cyan-400',
            border: 'border-cyan-500/20',
            bg: 'bg-cyan-500/5',
          },
        ].map(({ icon: Icon, label, value, color, iconColor, border, bg }) => (
          <div key={label} className={`rounded-2xl border px-4 py-4 ${border} ${bg}`}>
            <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
              <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
              {label}
            </div>
            <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
          </div>
        ))}
      </section>

      {/* Stage filter tabs */}
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-2 pb-0.5">
          {STAGE_FILTER_TABS.map((tab) => {
            const count = stageCounts[tab.key] ?? 0;
            const isActive = stageFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStageFilter(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${
                  isActive
                    ? 'bg-cyan-400 text-slate-950'
                    : 'border border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                      isActive ? 'bg-slate-950/25 text-slate-900' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading */}
      {applicationsQuery.isLoading && (
        <div className="flex items-center justify-center rounded-2xl border border-slate-800 p-16">
          <Spinner />
        </div>
      )}

      {/* Error */}
      {applicationsQuery.isError && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          Unable to load your applications right now.
        </div>
      )}

      {/* Pending recruiter invites */}
      {!invitesQuery.isLoading && pendingJobInvites.length > 0 && (
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center gap-2.5 border-b border-amber-500/20 px-5 py-3">
            <Bell className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-200">
              {pendingJobInvites.length} Pending Recruiter Invite{pendingJobInvites.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="divide-y divide-amber-500/10">
            {pendingJobInvites.map((request) => {
              const jobTitle = getRequestMetadataString(request, 'jobTitle') ?? 'Job invite';
              const company = getRequestMetadataString(request, 'company') ?? 'Company';
              return (
                <div
                  key={request._id}
                  className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white ${getCompanyGradient(company)}`}
                    >
                      {company.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{jobTitle}</div>
                      <div className="mt-0.5 text-sm text-slate-400">
                        {company} · {request.fromUser?.displayName ?? 'Recruiter'}
                      </div>
                      {request.message ? (
                        <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                          "{request.message}"
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => inviteActionMutation.mutate({ action: 'accept', requestId: request._id })}
                      disabled={inviteActionMutation.isPending}
                      className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:opacity-60"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => inviteActionMutation.mutate({ action: 'decline', requestId: request._id })}
                      disabled={inviteActionMutation.isPending}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!applicationsQuery.isLoading && !applicationsQuery.isError && applications.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-800 p-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900">
            <BriefcaseBusiness className="h-8 w-8 text-slate-600" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white">
            {stageFilter !== 'all' ? `No ${stageFilter} applications` : 'No applications yet'}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {stageFilter !== 'all'
              ? 'Try a different stage filter or clear the search.'
              : 'Apply from the marketplace or wait for recruiter invites to appear here.'}
          </p>
        </div>
      )}

      {/* Applications list */}
      {!applicationsQuery.isLoading && !applicationsQuery.isError && applications.length > 0 && (
        <div className="space-y-3">
          {applications.map((application) => (
            <article
              key={`${application.job._id}-${application.updatedAt}`}
              className="rounded-2xl border border-slate-800 bg-slate-950 p-5 transition hover:border-slate-700"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:gap-5">
                {/* Company avatar */}
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-base font-bold text-white ${getCompanyGradient(application.job.company)}`}
                >
                  {application.job.company.slice(0, 2).toUpperCase()}
                </div>

                {/* Job info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold text-white">{application.job.title}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
                        <span className="font-medium text-slate-200">{application.job.company}</span>
                        <span className="text-slate-700">·</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-500" />
                          {application.job.location}
                        </span>
                        <span className="text-slate-700">·</span>
                        <span>
                          {application.job.type}
                          {application.job.workMode ? ` · ${application.job.workMode}` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Status + date */}
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${APPLICATION_STAGE_BADGE[application.stage]}`}
                      >
                        {application.stage}
                      </span>
                      <div className="text-xs text-slate-500">Applied {formatDate(application.appliedAt)}</div>
                    </div>
                  </div>

                  {/* Badge row */}
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${SOURCE_COLOR[application.source]}`}
                    >
                      {SOURCE_COPY[application.source]}
                    </span>
                    <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-0.5 text-[11px] text-slate-400">
                      via {application.recruiter.displayName}
                    </span>
                    <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-0.5 text-[11px] text-slate-400">
                      Updated {relativeLabel(application.updatedAt)}
                    </span>
                  </div>

                  {/* Note */}
                  {application.note ? (
                    <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2.5 text-sm text-cyan-100">
                      {application.note}
                    </div>
                  ) : null}

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/dashboard/student/applications/${application.job._id}-${application.recruiter._id}`,
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                    >
                      View Application
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/dashboard/messages/${application.recruiter._id}`)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Message
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress stepper */}
              <div className="mt-5 border-t border-slate-800/70 pt-4">
                <ApplicationStatusBar application={application} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
