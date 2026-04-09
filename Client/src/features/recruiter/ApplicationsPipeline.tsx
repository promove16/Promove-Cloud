import { isAxiosError } from 'axios';
import { useDeferredValue, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BriefcaseBusiness,
  CheckCircle2,
  MapPin,
  MessageSquare,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { recruiterApi } from '../../api/recruiter.api';
import { getMarketplaceDetailPath } from '../../features/marketplace/navigation';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { APPLICATION_STAGE_BADGE, APPLICATION_STAGE_ORDER } from '../../utils/applicationStages';
import type {
  RecruiterJobApplicantView,
  RecruiterJobApplicationStage,
  RecruiterJobDetail,
} from '../../types/recruiter.types';
import { UserRole } from '../../types/roles.types';

const compactActionClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-700 hover:bg-slate-900';

const metricLabelClass = 'text-[11px] uppercase tracking-[0.22em] text-slate-500';

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const relativeLabel = (value: string) => {
  const ms = Date.now() - new Date(value).getTime();
  const days = Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
};

const initialsFor = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'ST';

const getApplicantSearchText = (applicant: RecruiterJobApplicantView) =>
  [
    applicant.displayName,
    applicant.institution?.name,
    applicant.activeProject?.title,
    applicant.activeProject?.category,
    applicant.skills.join(' '),
    applicant.source,
  ]
    .join(' ')
    .toLowerCase();

const SOURCE_LABELS: Record<RecruiterJobApplicantView['source'], string> = {
  student_apply: 'Applied',
  recruiter_invite: 'Invited',
  hiring_event: 'Hiring event',
};

const countByStage = (applications: RecruiterJobApplicantView[]) =>
  APPLICATION_STAGE_ORDER.reduce<Record<RecruiterJobApplicationStage, number>>((acc, stage) => {
    acc[stage] = applications.filter((application) => application.stage === stage).length;
    return acc;
  }, {} as Record<RecruiterJobApplicationStage, number>);

const getDefaultStage = (
  stageCounts: Record<RecruiterJobApplicationStage, number>,
): RecruiterJobApplicationStage =>
  APPLICATION_STAGE_ORDER.find((stage) => stageCounts[stage] > 0) ?? 'Applied';

const formatCandidateCount = (count: number) => `${count} candidate${count === 1 ? '' : 's'}`;

function InlineMetric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="border-l border-slate-800 pl-4 first:border-l-0 first:pl-0">
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className={metricLabelClass}>{label}</div>
    </div>
  );
}

export default function ApplicationsPipeline() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [activeStage, setActiveStage] = useState<RecruiterJobApplicationStage>('Applied');
  const initializedStageJobRef = useRef<string | null>(null);

  const jobsQuery = useQuery({
    queryKey: ['recruiter', 'jobs'],
    queryFn: recruiterApi.getJobs,
  });

  useEffect(() => {
    if (!selectedJobId && jobsQuery.data?.length) {
      setSelectedJobId(jobsQuery.data[0]._id);
      return;
    }

    if (selectedJobId && jobsQuery.data && !jobsQuery.data.some((job) => job._id === selectedJobId)) {
      setSelectedJobId(jobsQuery.data[0]?._id ?? null);
    }
  }, [jobsQuery.data, selectedJobId]);

  const pipelineQuery = useQuery({
    queryKey: ['recruiter', 'job-applications', selectedJobId],
    queryFn: () => recruiterApi.getJobApplications(selectedJobId!),
    enabled: Boolean(selectedJobId),
    retry: (failureCount, error) => {
      if (isAxiosError(error) && error.response?.status === 404) {
        return false;
      }

      return failureCount < 2;
    },
  });

  const selectedJob = useMemo<RecruiterJobDetail | null>(
    () => jobsQuery.data?.find((job) => job._id === selectedJobId) ?? null,
    [jobsQuery.data, selectedJobId],
  );

  const pipelineUnavailable = isAxiosError(pipelineQuery.error) && pipelineQuery.error.response?.status === 404;

  const fallbackApplicantsQuery = useQuery({
    queryKey: ['recruiter', 'job-applications-fallback', selectedJobId, selectedJob?.applicantIds.join(',')],
    queryFn: () =>
      recruiterApi.getTalentPipeline({
        page: 1,
        limit: Math.max(selectedJob?.applicantIds.length ?? 0, 20),
      }),
    enabled: Boolean(selectedJob && pipelineUnavailable && selectedJob.applicantIds.length > 0),
  });

  const fallbackApplications = useMemo<RecruiterJobApplicantView[]>(() => {
    if (!selectedJob || !fallbackApplicantsQuery.data?.items?.length) {
      return [];
    }

    const applicantIdSet = new Set(selectedJob.applicantIds);
    const shortlistedIdSet = new Set(selectedJob.shortlistedIds);

    return fallbackApplicantsQuery.data.items
      .filter((candidate) => applicantIdSet.has(candidate._id))
      .map((candidate) => {
        const stage: RecruiterJobApplicationStage = shortlistedIdSet.has(candidate._id)
          ? 'Shortlisted'
          : 'Applied';

        return {
          ...candidate,
          stage,
          source: 'student_apply' as const,
          appliedAt: selectedJob.createdAt,
          updatedAt: selectedJob.createdAt,
        };
      })
      .sort((left, right) => right.innovationScore - left.innovationScore);
  }, [fallbackApplicantsQuery.data?.items, selectedJob]);

  const applications = pipelineQuery.data?.applications ?? fallbackApplications;
  const stageCounts = useMemo(() => countByStage(applications), [applications]);
  const stageDataReady =
    Boolean(selectedJobId) && !pipelineQuery.isLoading && (!pipelineUnavailable || !fallbackApplicantsQuery.isLoading);

  useEffect(() => {
    if (!selectedJobId) {
      initializedStageJobRef.current = null;
      setActiveStage('Applied');
      return;
    }

    if (!stageDataReady || initializedStageJobRef.current === selectedJobId) {
      return;
    }

    initializedStageJobRef.current = selectedJobId;
    setActiveStage(applications.length ? getDefaultStage(stageCounts) : 'Applied');
  }, [applications.length, selectedJobId, stageCounts, stageDataReady]);

  const visibleApplicants = useMemo(
    () =>
      applications.filter((application) => {
        const matchesStage = application.stage === activeStage;
        const matchesSearch = deferredSearch
          ? getApplicantSearchText(application).includes(deferredSearch)
          : true;
        return matchesStage && matchesSearch;
      }),
    [activeStage, applications, deferredSearch],
  );

  const totalApplicants = useMemo(
    () => (jobsQuery.data ?? []).reduce((sum, job) => sum + job.applicantCount, 0),
    [jobsQuery.data],
  );

  const activeJobs = useMemo(
    () => (jobsQuery.data ?? []).filter((job) => job.isActive).length,
    [jobsQuery.data],
  );

  const latestMovement = useMemo(() => {
    if (!applications.length) return 'No activity';
    return relativeLabel(
      applications
        .map((application) => application.updatedAt)
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0],
    );
  }, [applications]);

  const stageMutation = useMutation({
    mutationFn: ({
      jobId,
      studentId,
      stage,
    }: {
      jobId: string;
      studentId: string;
      stage: RecruiterJobApplicationStage;
    }) => recruiterApi.updateJobApplication(jobId, studentId, { stage }),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['recruiter', 'job-applications', variables.jobId] }),
        queryClient.invalidateQueries({ queryKey: ['recruiter', 'jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['recruiter', 'dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['recruiter', 'onboarding'] }),
        queryClient.invalidateQueries({ queryKey: ['recruiter', 'talent'] }),
      ]);
    },
  });

  return (
    <div className="space-y-5">
      <header className="border-b border-slate-800 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
              <Sparkles className="h-4 w-4" />
              Applications
            </div>
            <h1 className="text-2xl font-semibold text-white">Application pipeline</h1>
            <p className="mt-1 text-sm text-slate-400">
              Select a job, pick a stage, and act on applicants without switching screens.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => navigate('/dashboard/recruiter')}>
              <BriefcaseBusiness className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <Button variant="secondary" onClick={() => navigate('/dashboard/recruiter/talent')}>
              <Users className="mr-2 h-4 w-4" />
              Talent Search
            </Button>
          </div>
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-4 border-b border-slate-800 pb-4 text-sm text-slate-300">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-cyan-300" />
          <span className="font-medium text-white">{totalApplicants}</span>
          total applications
        </div>
        <div className="flex items-center gap-2">
          <BriefcaseBusiness className="h-4 w-4 text-blue-300" />
          <span className="font-medium text-white">{activeJobs}</span>
          active jobs
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          <span className="font-medium text-white">{stageCounts.Hired}</span>
          hired
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[300px,minmax(0,1fr)]">
        <aside className="border-r border-slate-800 pr-5">
          <div className="flex items-center justify-between gap-3 pb-3">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Jobs</div>
              <h2 className="mt-2 text-lg font-semibold text-white">Hiring pipelines</h2>
            </div>
            <div className="rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-300">
              {jobsQuery.data?.length ?? 0}
            </div>
          </div>

          <div className="space-y-1">
            {jobsQuery.isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner />
              </div>
            ) : jobsQuery.data?.length ? (
              jobsQuery.data.map((job) => {
                const isSelected = job._id === selectedJobId;

                return (
                  <button
                    key={job._id}
                    type="button"
                    onClick={() => setSelectedJobId(job._id)}
                    className={`w-full border-b border-slate-800 px-0 py-3 text-left transition ${
                      isSelected ? 'bg-cyan-500/5' : 'hover:bg-slate-950/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{job.title}</div>
                        <div className="mt-1 text-xs text-slate-400">{job.company}</div>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] ${
                          job.isActive
                            ? 'border-cyan-500/20 text-cyan-300'
                            : 'border-slate-700 text-slate-500'
                        }`}
                      >
                        {job.isActive ? 'Active' : 'Closed'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {job.location}
                      </span>
                      <span>{job.type}</span>
                    </div>
                    <div className="mt-3 flex gap-4">
                      <InlineMetric value={job.applicantCount} label="Applied" />
                      <InlineMetric value={job.shortlistedCount} label="Progressed" />
                      <InlineMetric value={job.minimumInnovationScore} label="Cutoff" />
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
                Post a job first. Applications appear here once students apply.
              </div>
            )}
          </div>
        </aside>

        <main className="space-y-4">
          {selectedJob ? (
            <>
              <section className="space-y-4 border-b border-slate-800 pb-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
                      <BriefcaseBusiness className="h-4 w-4" />
                      Selected Job
                    </div>
                    <h2 className="text-2xl font-semibold text-white">{selectedJob.title}</h2>
                    <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-400">
                      <span>{selectedJob.company}</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {selectedJob.location}
                      </span>
                      <span>{selectedJob.type}</span>
                      {selectedJob.workMode ? <span>{selectedJob.workMode}</span> : null}
                    </div>
                    <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">{selectedJob.description}</p>
                  </div>
                  <div className="flex gap-5">
                    <InlineMetric value={applications.length} label="Applicants" />
                    <InlineMetric value={latestMovement} label="Latest" />
                  </div>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative max-w-xl flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      value={search}
                      onChange={(event) =>
                        startTransition(() => {
                          setSearch(event.target.value);
                        })
                      }
                      placeholder="Search applicants by name, college, skill, or project"
                      className="pl-11"
                    />
                  </div>
                  <div className="text-sm text-slate-400">
                    {formatCandidateCount(stageCounts[activeStage])} in {activeStage.toLowerCase()}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {APPLICATION_STAGE_ORDER.map((stage) => {
                    const isActive = activeStage === stage;
                    return (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => setActiveStage(stage)}
                        aria-pressed={isActive}
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
                          isActive
                            ? 'border-cyan-400/30 bg-cyan-400/10 text-white'
                            : 'border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <span>{stage}</span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${APPLICATION_STAGE_BADGE[stage]}`}
                        >
                          {stageCounts[stage]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {pipelineQuery.isLoading ? (
                <div className="border border-slate-800 p-12">
                  <div className="flex items-center justify-center">
                    <Spinner />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {pipelineUnavailable ? (
                    <div className="border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                      The running server does not expose the advanced job-stage API yet. Fallback applicant data is
                      being shown from the recruiter pipeline.
                    </div>
                  ) : null}

                  {!pipelineUnavailable && pipelineQuery.isError ? (
                    <div className="border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                      Unable to load this job&apos;s application pipeline right now.
                    </div>
                  ) : null}

                  <section className="border border-slate-800">
                    <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{activeStage}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatCandidateCount(stageCounts[activeStage])} available in this stage.
                        </div>
                      </div>
                      <div
                        className={`rounded-full border px-2 py-0.5 text-[11px] ${APPLICATION_STAGE_BADGE[activeStage]}`}
                      >
                        {stageCounts[activeStage]}
                      </div>
                    </div>

                    {visibleApplicants.length ? (
                      <div className="divide-y divide-slate-800">
                        {visibleApplicants.map((applicant) => {
                          const isUpdating =
                            stageMutation.isPending &&
                            stageMutation.variables?.jobId === selectedJob._id &&
                            stageMutation.variables?.studentId === applicant._id;

                          return (
                            <article
                              key={applicant._id}
                              className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1.3fr),150px,220px,220px]"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 text-sm font-semibold text-white">
                                  {applicant.avatar ? (
                                    <img
                                      src={applicant.avatar}
                                      alt={applicant.displayName}
                                      className="h-10 w-10 rounded-xl object-cover"
                                    />
                                  ) : (
                                    initialsFor(applicant.displayName)
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-white">{applicant.displayName}</div>
                                  <div className="mt-0.5 truncate text-xs text-slate-400">
                                    {applicant.institution?.name ?? 'Independent'}
                                  </div>
                                  <div className="mt-1">
                                    <span className="rounded-full border border-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                                      {SOURCE_LABELS[applicant.source]}
                                    </span>
                                  </div>
                                  {applicant.activeProject ? (
                                    <div className="mt-1 truncate text-xs text-slate-500">
                                      {applicant.activeProject.title} · {applicant.activeProject.stage}
                                    </div>
                                  ) : null}
                                  {applicant.skills.length ? (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {applicant.skills.slice(0, 3).map((skill) => (
                                        <span
                                          key={skill}
                                          className="rounded-full border border-slate-800 px-2 py-0.5 text-[11px] text-slate-300"
                                        >
                                          {skill}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div>
                                  <div className={metricLabelClass}>Score</div>
                                  <div className="text-2xl font-semibold text-white">{applicant.innovationScore}</div>
                                </div>
                              </div>

                              <div className="space-y-2 text-xs text-slate-400">
                                <div>
                                  <span className="text-slate-500">Applied:</span>{' '}
                                  <span className="text-slate-300">{formatDateTime(applicant.appliedAt)}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Updated:</span>{' '}
                                  <span className="text-slate-300">{relativeLabel(applicant.updatedAt)}</span>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <select
                                  value={applicant.stage}
                                  onChange={(event) =>
                                    stageMutation.mutate({
                                      jobId: selectedJob._id,
                                      studentId: applicant._id,
                                      stage: event.target.value as RecruiterJobApplicationStage,
                                    })
                                  }
                                  disabled={isUpdating || pipelineUnavailable}
                                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                                >
                                  {APPLICATION_STAGE_ORDER.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>

                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    className={compactActionClass}
                                    onClick={() =>
                                      navigate(getMarketplaceDetailPath(UserRole.RECRUITER, 'student', applicant._id))
                                    }
                                  >
                                    <Users className="h-3.5 w-3.5" />
                                    Profile
                                  </button>
                                  <button
                                    type="button"
                                    className={`${compactActionClass} ${
                                      applicant.canContact ? '' : 'cursor-not-allowed opacity-60'
                                    }`}
                                    onClick={() => {
                                      if (!applicant.canContact) return;
                                      navigate(`/dashboard/recruiter/messages/${applicant._id}`);
                                    }}
                                    disabled={!applicant.canContact}
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    Message
                                  </button>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-4 py-8 text-sm text-slate-500">
                        No applicants in <span className="text-slate-300">{activeStage}</span> for the current search.
                      </div>
                    )}
                  </section>
                </div>
              )}
            </>
          ) : (
            <div className="border border-slate-800 p-12 text-center">
              <BriefcaseBusiness className="mx-auto h-14 w-14 text-slate-600" />
              <h2 className="mt-4 text-2xl font-semibold text-white">No recruiter jobs yet</h2>
              <p className="mt-2 text-slate-400">
                Create a job from the recruiter dashboard. Once students apply, this page becomes your live pipeline.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
