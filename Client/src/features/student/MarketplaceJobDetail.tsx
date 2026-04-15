import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Clock3,
  ExternalLink,
  MapPin,
  MessageCircle,
  Sparkles,
  Users,
} from 'lucide-react';
import { DashboardLayout } from '../../app/components/DashboardLayout';
import { recruiterApi } from '../../api/recruiter.api';
import { marketplaceApi } from '../../api/marketplace.api';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { RecruiterJobView } from '../../types/recruiter.types';

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const formatDate = (value?: string) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return dateFormatter.format(date);
};

const formatRelativeDate = (value?: string) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const diff = Date.now() - date.getTime();
  const day = 1000 * 60 * 60 * 24;
  const days = Math.max(1, Math.floor(diff / day));

  if (days <= 1) {
    return 'Posted today';
  }

  if (days < 7) {
    return `Posted ${days} days ago`;
  }

  const weeks = Math.floor(days / 7);

  if (weeks < 5) {
    return `Posted ${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }

  return `Posted ${formatDate(value)}`;
};

const buildDetailList = (items: string[], fallbackText?: string) => {
  if (items.length > 0) {
    return items;
  }

  return (fallbackText ?? '')
    .split(/[\n.]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
};

function DetailSection({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: string[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-slate-800/80 py-8">
      <div className="grid gap-6 lg:grid-cols-[220px,minmax(0,1fr)] xl:grid-cols-[240px,minmax(0,1fr)]">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">{title}</div>
          {subtitle ? <p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p> : null}
        </div>
        <div className="space-y-3.5">
          {items.map((item) => (
            <div key={item} className="flex gap-3 text-sm leading-6 text-slate-200">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-cyan-300" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 py-1">
      <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-medium text-white">{value}</div>
    </div>
  );
}

export function MarketplaceJobDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { jobId } = useParams();
  const [hasApplied, setHasApplied] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const jobQuery = useQuery({
    queryKey: ['marketplace', 'job-detail', jobId],
    queryFn: () => recruiterApi.getPublicJob(jobId!),
    enabled: Boolean(jobId),
  });

  const recruiterQuery = useQuery({
    queryKey: ['marketplace', 'job-detail', 'recruiter', jobQuery.data?.recruiterId],
    queryFn: () => marketplaceApi.getProfile(jobQuery.data!.recruiterId),
    enabled: Boolean(jobQuery.data?.recruiterId),
  });

  const relatedJobsQuery = useQuery({
    queryKey: ['marketplace', 'job-detail', 'related', jobQuery.data?.recruiterId],
    queryFn: () => recruiterApi.getPublicJobs(jobQuery.data!.recruiterId),
    enabled: Boolean(jobQuery.data?.recruiterId),
  });

  const job = jobQuery.data;
  const recruiter = recruiterQuery.data;
  const isApplyLocked = hasApplied || !job?.isActive;
  const relatedJobs = useMemo(
    () => (relatedJobsQuery.data ?? []).filter((relatedJob) => relatedJob._id !== job?._id).slice(0, 4),
    [job?._id, relatedJobsQuery.data],
  );

  const responsibilityList = buildDetailList(job?.keyResponsibilities ?? [], job?.description);
  const requirementList = buildDetailList(job?.requirements ?? [], recruiter?.skills?.map((skill) => skill.name).join('. '));
  const benefitList = buildDetailList(job?.benefits ?? [], job?.companyOverview);
  const applicationSteps = buildDetailList(
    job?.applicationSteps ?? [],
    'Review the JD here, apply from this page, and track recruiter updates in My Applications.',
  );

  useEffect(() => {
    setHasApplied(Boolean(job?.hasApplied));
  }, [job?.hasApplied]);

  const markJobAsApplied = () => {
    if (!job) {
      return;
    }

    const applicationUpdatedAt = new Date().toISOString();

    const applyPatch = <T extends RecruiterJobView>(current: T): T => ({
      ...current,
      hasApplied: true,
      applicationStage: current.applicationStage ?? 'Applied',
      applicationSource: current.applicationSource ?? 'student_apply',
      applicationUpdatedAt,
    });

    setHasApplied(true);

    queryClient.setQueriesData<RecruiterJobView[]>(
      { queryKey: ['marketplace', 'student-recruiter-jobs'] },
      (current) =>
        current?.map((currentJob) =>
          currentJob._id === job._id ? applyPatch(currentJob) : currentJob,
        ) ?? current,
    );

    queryClient.setQueryData<RecruiterJobView>(
      ['marketplace', 'job-detail', job._id],
      (current) => (current ? applyPatch(current) : current),
    );

    queryClient.setQueriesData<RecruiterJobView[]>(
      { queryKey: ['marketplace', 'job-detail', 'related'] },
      (current) =>
        Array.isArray(current)
          ? current.map((currentJob) =>
              currentJob._id === job._id ? applyPatch(currentJob) : currentJob,
            )
          : current,
    );

    void queryClient.invalidateQueries({ queryKey: ['student', 'applications'] });
  };

  const applyToJob = useMutation({
    mutationFn: async () => recruiterApi.applyToJob(jobId!),
    onMutate: () => {
      setApplyError(null);
    },
    onSuccess: (response) => {
      if (response.applied || response.alreadyApplied) {
        markJobAsApplied();
      }
    },
    onError: () => {
      setApplyError('Unable to apply to this job right now.');
    },
  });

  const handleMessage = () => {
    if (!job) {
      return;
    }

    const storageKey = `dm_first_contact_${job.recruiterId}`;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, 'true');
    }
    navigate(`/dashboard/messages/${job.recruiterId}`);
  };

  const handleApply = () => {
    if (!job || hasApplied || applyToJob.isPending || !job.isActive) {
      return;
    }

    applyToJob.mutate();
  };

  return (
    <DashboardLayout role="student">
      <div className="-mx-4 -my-6 min-h-[calc(100vh-5rem)] bg-[#0a0f1d] px-4 py-6 text-white sm:px-5 lg:-mx-8 lg:px-8 lg:py-8">
        <div className="mx-auto flex w-full max-w-[96rem] min-h-full flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-700 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to marketplace
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              {job ? (
                <Button
                  className="rounded-full px-5"
                  onClick={handleApply}
                  disabled={isApplyLocked || applyToJob.isPending}
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  {applyToJob.isPending
                    ? 'Applying...'
                    : hasApplied
                      ? job.applicationSource === 'recruiter_invite'
                        ? 'Invited'
                        : 'Applied'
                      : job.isActive
                        ? 'Apply now'
                        : 'Applications closed'}
                </Button>
              ) : null}
              <Link
                to="/dashboard/student/applications"
                className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-400/50 hover:text-white"
              >
                <BriefcaseBusiness className="h-4 w-4" />
                My applications
              </Link>
            </div>
          </div>

          <div className="marketplace-scroll min-h-0 flex-1 overflow-y-auto rounded-[30px] border border-slate-800/80 bg-[linear-gradient(180deg,#101624_0%,#0c1220_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="w-full px-5 py-6 sm:px-7 sm:py-7 lg:px-8 lg:py-8 xl:px-10">
            {jobQuery.isLoading ? (
              <div className="flex min-h-[40vh] items-center justify-center">
                <Spinner />
              </div>
            ) : null}

            {jobQuery.isError ? (
              <div className="border border-rose-500/30 bg-rose-500/10 px-6 py-5 text-sm text-rose-200">
                Unable to load this job right now.
              </div>
            ) : null}

            {job ? (
              <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr),340px] xl:gap-10">
                <div className="min-w-0">
                  <section className="border-b border-slate-800/80 pb-8">
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.28em] text-cyan-300">
                      <span>{job.type}</span>
                      <span className="text-slate-600">|</span>
                      <span>{job.domain}</span>
                      {job.workMode ? (
                        <>
                          <span className="text-slate-600">|</span>
                          <span>{job.workMode}</span>
                        </>
                      ) : null}
                      {formatRelativeDate(job.createdAt) ? (
                        <>
                          <span className="text-slate-600">|</span>
                          <span>{formatRelativeDate(job.createdAt)}</span>
                        </>
                      ) : null}
                    </div>

                    <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{job.title}</h1>

                    <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-slate-300">
                      <span className="font-semibold text-white">{job.company}</span>
                      <span className="text-slate-600">|</span>
                      <span>{recruiter?.displayName ?? 'Recruiter'}</span>
                      <span className="text-slate-600">|</span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-cyan-300" />
                        {job.location}
                      </span>
                    </div>

                    <div className="mt-6 grid gap-4 border-t border-slate-800/80 pt-5 md:grid-cols-2 md:divide-x md:divide-slate-800/80 xl:grid-cols-4">
                      <InfoTile label="Salary" value={job.salaryExpectation ?? 'To be discussed'} />
                      <InfoTile label="Experience" value={job.experienceLevel ?? 'Open to aligned profiles'} />
                      <InfoTile label="Openings" value={typeof job.openings === 'number' ? String(job.openings) : 'Not specified'} />
                      <InfoTile label="Min Score" value={`${job.minimumInnovationScore}+`} />
                    </div>
                  </section>

                  <section className="border-t border-slate-800/80 py-8">
                    <div className="grid gap-6 lg:grid-cols-[220px,minmax(0,1fr)] xl:grid-cols-[240px,minmax(0,1fr)]">
                      <div>
                        <div className="text-xs uppercase tracking-[0.28em] text-slate-500">About Company</div>
                        <p className="mt-2 text-sm leading-6 text-slate-400">Recruiter-provided company context and public profile summary.</p>
                      </div>
                      <div className="space-y-4">
                        <p className="text-sm leading-7 text-slate-200">
                          {job.companyOverview ??
                            recruiter?.bio ??
                            `${job.company} is hiring through the marketplace. Recruiter-authored company details will appear here as they complete their job setup.`}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                          <span className="rounded-full border border-slate-700 px-3 py-1.5">{job.domain}</span>
                          <span className="rounded-full border border-slate-700 px-3 py-1.5">{job.type}</span>
                          {job.workMode ? <span className="rounded-full border border-slate-700 px-3 py-1.5">{job.workMode}</span> : null}
                          <span className="rounded-full border border-slate-700 px-3 py-1.5">{job.location}</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="border-t border-slate-800/80 py-8">
                    <div className="grid gap-6 lg:grid-cols-[220px,minmax(0,1fr)] xl:grid-cols-[240px,minmax(0,1fr)]">
                      <div>
                        <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Role Overview</div>
                        <p className="mt-2 text-sm leading-6 text-slate-400">High-level summary before the full JD.</p>
                      </div>
                      <div className="space-y-4 text-sm leading-7 text-slate-200">
                        <p>{job.roleSummary ?? job.description}</p>
                      </div>
                    </div>
                  </section>

                  <DetailSection
                    title="Key Responsibilities"
                    subtitle="What the recruiter expects this role to own."
                    items={responsibilityList}
                  />

                  <DetailSection
                    title="Requirements"
                    subtitle="Skills, background, or portfolio depth expected for shortlisting."
                    items={requirementList}
                  />

                  <DetailSection
                    title="Benefits"
                    subtitle="Benefits, exposure, or role incentives shared by the recruiter."
                    items={benefitList}
                  />

                  <DetailSection
                    title="Application Process"
                    subtitle="Naukri-style workflow: review the JD, apply, recruiter screens, then shortlisted candidates are contacted."
                    items={applicationSteps}
                  />

                  {relatedJobs.length > 0 ? (
                    <section className="border-t border-slate-800/80 py-8">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">More Jobs</div>
                          <h2 className="mt-2 text-2xl font-semibold text-white">More openings from this recruiter</h2>
                        </div>
                      </div>
                      <div className="mt-5 space-y-4">
                        {relatedJobs.map((relatedJob) => (
                          <button
                            key={relatedJob._id}
                            type="button"
                            onClick={() => navigate(`/marketplace/jobs/${relatedJob._id}`)}
                            className="flex w-full items-start justify-between gap-4 border border-slate-800/80 px-5 py-4 text-left transition hover:border-slate-700 hover:bg-slate-950/40"
                          >
                            <div>
                              <div className="text-lg font-semibold text-white">{relatedJob.title}</div>
                              <div className="mt-1 flex flex-wrap gap-2 text-sm text-slate-400">
                                <span>{relatedJob.company}</span>
                                <span>{relatedJob.location}</span>
                                <span>{relatedJob.type}</span>
                              </div>
                            </div>
                            <ArrowRight className="mt-1 h-5 w-5 text-slate-500" />
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>

                <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
                  <section className="rounded-[24px] border border-slate-800/80 bg-slate-950/70 p-5 sm:p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 text-lg font-semibold text-white">
                        {(recruiter?.displayName ?? job.company).slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{recruiter?.displayName ?? job.company}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">Hiring Contact</div>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      <Button
                        className="h-11 w-full rounded-full"
                        onClick={handleApply}
                        disabled={isApplyLocked || applyToJob.isPending}
                      >
                        <ArrowRight className="mr-2 h-4 w-4" />
                        {applyToJob.isPending
                          ? 'Applying...'
                          : hasApplied
                            ? job.applicationSource === 'recruiter_invite'
                              ? 'Invited'
                              : 'Applied'
                            : job.isActive
                              ? 'Apply now'
                              : 'Applications closed'}
                      </Button>
                      <Button
                        variant="secondary"
                        className="h-11 w-full rounded-full border-slate-700 bg-transparent text-slate-200 hover:border-slate-500 hover:bg-slate-900/40"
                        onClick={handleMessage}
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Message recruiter
                      </Button>
                      {applyError ? (
                        <div className="text-sm text-rose-300">{applyError}</div>
                      ) : hasApplied ? (
                        <div className="text-sm text-emerald-200">
                          Application recorded. Track updates in My Applications.
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-slate-800/80 bg-slate-950/70 p-5 sm:p-6">
                    <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Application Snapshot</div>
                    <div className="mt-4 space-y-4">
                      <div className="flex items-start gap-3 text-sm text-slate-300">
                        <Clock3 className="mt-0.5 h-4 w-4 text-cyan-300" />
                        <div>
                          <div className="font-medium text-white">{formatRelativeDate(job.createdAt) ?? 'Recently posted'}</div>
                          <div className="mt-1 text-slate-400">{formatDate(job.createdAt)}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 text-sm text-slate-300">
                        <Users className="mt-0.5 h-4 w-4 text-cyan-300" />
                        <div>
                          <div className="font-medium text-white">{job.applicantCount} applicants</div>
                          <div className="mt-1 text-slate-400">{job.shortlistedCount} shortlisted so far</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 text-sm text-slate-300">
                        <Sparkles className="mt-0.5 h-4 w-4 text-cyan-300" />
                        <div>
                          <div className="font-medium text-white">Minimum innovation score {job.minimumInnovationScore}+</div>
                          <div className="mt-1 text-slate-400">Used as the baseline fit signal for this role.</div>
                        </div>
                      </div>
                      {job.expiresAt ? (
                        <div className="flex items-start gap-3 text-sm text-slate-300">
                          <BriefcaseBusiness className="mt-0.5 h-4 w-4 text-cyan-300" />
                          <div>
                            <div className="font-medium text-white">Apply before {formatDate(job.expiresAt)}</div>
                            <div className="mt-1 text-slate-400">Recruiter closes this role after the listed date.</div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-slate-800/80 bg-slate-950/70 p-5 sm:p-6">
                    <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Recruiter Profile</div>
                    <div className="mt-4 space-y-3 text-sm text-slate-300">
                      <div className="font-medium text-white">{recruiter?.displayName ?? 'Recruiter'}</div>
                      {recruiter?.headline ? <div>{recruiter.headline}</div> : null}
                      {recruiter?.location ? (
                        <div className="inline-flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 text-cyan-300" />
                          {recruiter.location}
                        </div>
                      ) : null}
                      {recruiter?.links?.websiteUrl ? (
                        <a
                          href={recruiter.links.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-cyan-300 transition hover:text-cyan-200"
                        >
                          <Building2 className="h-4 w-4" />
                          Company site
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                    </div>
                  </section>
                </aside>
              </div>
            ) : null}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default MarketplaceJobDetail;
