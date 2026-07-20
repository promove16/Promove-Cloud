import { type ElementType, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  MapPin,
  MessageCircle,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { DashboardLayout } from '../../app/components/DashboardLayout';
import { recruiterApi } from '../../api/recruiter.api';
import { marketplaceApi } from '../../api/marketplace.api';
import { useAuthStore } from '../../store/authStore';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { RecruiterJobView } from '../../types/recruiter.types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const formatDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return dateFormatter.format(date);
};

const formatRelativeDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diff = Date.now() - date.getTime();
  const day = 1000 * 60 * 60 * 24;
  const days = Math.max(1, Math.floor(diff / day));
  if (days <= 1) return 'Posted today';
  if (days < 7) return `Posted ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `Posted ${weeks} week${weeks === 1 ? '' : 's'} ago`;
  return `Posted ${formatDate(value)}`;
};

const buildDetailList = (items: string[], fallbackText?: string) => {
  if (items.length > 0) return items;
  return (fallbackText ?? '')
    .split(/[\n.]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
};

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

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title, icon: Icon }: { title: string; icon?: ElementType }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="h-5 w-1 shrink-0 rounded-full bg-cyan-400" />
      <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
        {Icon ? <Icon className="h-4.5 w-4.5 text-cyan-300 shrink-0" /> : null}
        {title}
      </h2>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-200">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="space-y-4">
      {items.map((item, idx) => (
        <li key={item} className="flex items-start gap-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-bold text-cyan-300">
            {idx + 1}
          </span>
          <span className="pt-0.5 text-sm leading-6 text-slate-200">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function StatItem({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs">
      <Icon className="h-3.5 w-3.5 text-cyan-400" />
      <span className="text-slate-500">{label}:</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-800/60 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-medium text-white">{value}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MarketplaceJobDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { jobId } = useParams();
  const authUser = useAuthStore((state) => state.user);
  const userRole = authUser?.role ?? 'student';
  const isStudent = userRole === 'student';
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
  const isApplyLocked = !isStudent || hasApplied || !job?.isActive;

  const relatedJobs = useMemo(
    () => (relatedJobsQuery.data ?? []).filter((j) => j._id !== job?._id).slice(0, 4),
    [job?._id, relatedJobsQuery.data],
  );

  const responsibilityList = buildDetailList(job?.keyResponsibilities ?? [], job?.description);
  const requirementList = buildDetailList(
    job?.requirements ?? [],
    recruiter?.skills?.map((s) => s.name).join('. '),
  );
  const benefitList = buildDetailList(job?.benefits ?? [], job?.companyOverview);
  const applicationSteps = buildDetailList(
    job?.applicationSteps ?? [],
    'Review the JD here, apply from this page, and track recruiter updates in My Applications.',
  );

  useEffect(() => {
    setHasApplied(Boolean(job?.hasApplied));
  }, [job?.hasApplied]);

  const markJobAsApplied = () => {
    if (!job) return;
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
      (current) => current?.map((j) => (j._id === job._id ? applyPatch(j) : j)) ?? current,
    );
    queryClient.setQueryData<RecruiterJobView>(
      ['marketplace', 'job-detail', job._id],
      (current) => (current ? applyPatch(current) : current),
    );
    queryClient.setQueriesData<RecruiterJobView[]>(
      { queryKey: ['marketplace', 'job-detail', 'related'] },
      (current) =>
        Array.isArray(current) ? current.map((j) => (j._id === job._id ? applyPatch(j) : j)) : current,
    );
    void queryClient.invalidateQueries({ queryKey: ['student', 'applications'] });
  };

  const applyToJob = useMutation({
    mutationFn: async () => recruiterApi.applyToJob(jobId!),
    onMutate: () => { setApplyError(null); },
    onSuccess: (response) => {
      if (response.applied || response.alreadyApplied) markJobAsApplied();
    },
    onError: () => { setApplyError('Unable to apply to this job right now.'); },
  });

  const handleMessage = () => {
    if (!job) return;
    const storageKey = `dm_first_contact_${job.recruiterId}`;
    if (!localStorage.getItem(storageKey)) localStorage.setItem(storageKey, 'true');
    navigate(`/dashboard/messages/${job.recruiterId}`);
  };

  const handleApply = () => {
    if (!job || !isStudent || hasApplied || applyToJob.isPending || !job.isActive) return;
    applyToJob.mutate();
  };

  const applyLabel = !isStudent
    ? 'Job Active'
    : applyToJob.isPending
      ? 'Applying…'
      : hasApplied
        ? job?.applicationSource === 'recruiter_invite'
          ? 'Invited'
          : 'Applied ✓'
        : job?.isActive
          ? 'Apply Now'
          : 'Applications Closed';

  return (
    <DashboardLayout role={userRole}>
      <div className="-mx-4 -my-6 min-h-[calc(100vh-5rem)] bg-[#080d1a] px-4 py-6 text-white sm:px-5 lg:-mx-8 lg:px-8 lg:py-8">
        <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-5">

          {/* ── Nav row ── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to marketplace
            </Link>
            {isStudent ? (
              <Link
                to="/dashboard/student/applications"
                className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-400/40 hover:text-white"
              >
                <BriefcaseBusiness className="h-4 w-4" />
                My applications
              </Link>
            ) : userRole === 'recruiter' ? (
              <Link
                to="/dashboard/recruiter/hiring-events"
                className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-400/40 hover:text-white"
              >
                <BriefcaseBusiness className="h-4 w-4" />
                Hiring Events
              </Link>
            ) : null}
          </div>

          {/* ── Loading / Error ── */}
          {jobQuery.isLoading && (
            <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-slate-800 bg-slate-950">
              <Spinner />
            </div>
          )}
          {jobQuery.isError && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-6 py-5 text-sm text-rose-200">
              Unable to load this job right now.
            </div>
          )}

          {job && (
            <div className="space-y-5">

              {/* ── Applied success banner ── */}
              {hasApplied && (
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-5 py-4">
                  <div className="flex items-center gap-3 text-sm text-emerald-200">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                    <span>
                      <span className="font-semibold">Application submitted.</span> Track updates in My Applications.
                    </span>
                  </div>
                  <Link
                    to="/dashboard/student/applications"
                    className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
                  >
                    View status <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  HERO CARD  —  Naukri / LinkedIn style job header
              ════════════════════════════════════════════════════════════ */}
              <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/70 p-6 sm:p-7">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-500/4 via-transparent to-blue-500/4" />

                <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:gap-6">
                  {/* Left: avatar + job info */}
                  <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
                    {/* Company avatar */}
                    <div
                      className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-lg font-bold text-white shadow-lg ${getCompanyGradient(job.company)}`}
                    >
                      {job.company.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Badges */}
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {job.isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Actively Hiring
                          </span>
                        ) : (
                          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-slate-500">
                            Closed
                          </span>
                        )}
                        <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-slate-400">
                          {job.domain}
                        </span>
                        {job.workMode && (
                          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-slate-400">
                            {job.workMode}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{job.title}</h1>

                      {/* Company + recruiter + location */}
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
                        <span className="font-semibold text-slate-200">{job.company}</span>
                        <span className="text-slate-700">·</span>
                        <span>{recruiter?.displayName ?? 'Recruiter'}</span>
                        <span className="text-slate-700">·</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                          {job.location}
                        </span>
                      </div>

                      {/* Key stats row — Naukri highlights */}
                      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-800/60 pt-4">
                        {job.salaryExpectation && (
                          <StatItem icon={Wallet} label="Salary" value={job.salaryExpectation} />
                        )}
                        {job.experienceLevel && (
                          <StatItem icon={Award} label="Exp" value={job.experienceLevel} />
                        )}
                        <StatItem icon={BriefcaseBusiness} label="Type" value={job.type} />
                        <StatItem
                          icon={Users}
                          label="Openings"
                          value={typeof job.openings === 'number' ? String(job.openings) : 'Open'}
                        />
                        <StatItem icon={Sparkles} label="Min Score" value={`${job.minimumInnovationScore}+`} />
                      </div>

                      {/* Meta row: posted, applicants, deadline */}
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {formatRelativeDate(job.createdAt) && (
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatRelativeDate(job.createdAt)}
                          </span>
                        )}
                        <span>·</span>
                        <span>{job.applicantCount} applicants</span>
                        {job.shortlistedCount > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-cyan-400">{job.shortlistedCount} shortlisted</span>
                          </>
                        )}
                        {job.expiresAt && (
                          <>
                            <span>·</span>
                            <span className="text-amber-400">Apply by {formatDate(job.expiresAt)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: CTA buttons — desktop only */}
                  <div className="hidden shrink-0 flex-col gap-2.5 xl:flex xl:min-w-[180px]">
                    <Button
                      className="h-11 w-full rounded-full"
                      onClick={handleApply}
                      disabled={isApplyLocked || applyToJob.isPending}
                    >
                      <ArrowRight className="mr-2 h-4 w-4" />
                      {applyLabel}
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-11 w-full rounded-full border-slate-700 bg-transparent text-slate-200 hover:border-slate-500 hover:bg-slate-900"
                      onClick={handleMessage}
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Message
                    </Button>
                    {applyError && <p className="text-center text-xs text-rose-300">{applyError}</p>}
                  </div>
                </div>

                {/* CTA buttons — mobile */}
                <div className="relative mt-5 flex gap-3 border-t border-slate-800/60 pt-5 xl:hidden">
                  <Button
                    className="h-11 flex-1 rounded-full"
                    onClick={handleApply}
                    disabled={isApplyLocked || applyToJob.isPending}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    {applyLabel}
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-11 flex-1 rounded-full border-slate-700 bg-transparent text-slate-200 hover:border-slate-500 hover:bg-slate-900"
                    onClick={handleMessage}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Message
                  </Button>
                </div>
              </section>

              {/* ═══════════════════════════════════════════════════════════
                  TWO-COLUMN LAYOUT
              ════════════════════════════════════════════════════════════ */}
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr),360px]">

                {/* ─── Left: Main JD content ─── */}
                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">

                  {/* Skills chips — Naukri "Key Skills Required" */}
                  {(recruiter?.skills?.length ?? 0) > 0 && (
                    <section className="border-b border-slate-800 px-6 py-6">
                      <SectionHeader title="Key Skills Required" />
                      <div className="flex flex-wrap gap-2">
                        {(recruiter?.skills ?? []).map((skill) => (
                          <span
                            key={skill.name}
                            className="rounded-full border border-cyan-500/20 bg-cyan-500/8 px-3 py-1 text-sm font-medium text-cyan-200"
                          >
                            {skill.name}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* About the Role */}
                  <section className="border-b border-slate-800 px-6 py-6">
                    <SectionHeader title="About the Role" />
                    <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-7 text-slate-300">
                      {job.roleSummary ?? job.description}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-400">{job.type}</span>
                      <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-400">{job.domain}</span>
                      {job.workMode && (
                        <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-400">{job.workMode}</span>
                      )}
                      <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-400">{job.location}</span>
                    </div>
                  </section>

                  {/* Key Responsibilities */}
                  {responsibilityList.length > 0 && (
                    <section className="border-b border-slate-800 px-6 py-6">
                      <SectionHeader title="Key Responsibilities" />
                      <BulletList items={responsibilityList} />
                    </section>
                  )}

                  {/* Requirements */}
                  {requirementList.length > 0 && (
                    <section className="border-b border-slate-800 px-6 py-6">
                      <SectionHeader title="Requirements" />
                      <BulletList items={requirementList} />
                    </section>
                  )}

                  {/* Perks & Benefits */}
                  {benefitList.length > 0 && (
                    <section className="border-b border-slate-800 px-6 py-6">
                      <SectionHeader title="Perks & Benefits" />
                      <CheckList items={benefitList} />
                    </section>
                  )}

                  {/* Application Process — numbered steps like Indeed */}
                  {applicationSteps.length > 0 && (
                    <section className="border-b border-slate-800 px-6 py-6">
                      <SectionHeader title="Application Process" />
                      <NumberedList items={applicationSteps} />
                    </section>
                  )}

                  {/* About the Company */}
                  <section className="px-6 py-6">
                    <SectionHeader title="About the Company" />
                    <p className="text-sm leading-7 text-slate-300">
                      {job.companyOverview ??
                        recruiter?.bio ??
                        `${job.company} is hiring through the ProMove marketplace. Company details will appear here as the recruiter completes their profile.`}
                    </p>
                    {recruiter?.links?.websiteUrl && (
                      <a
                        href={recruiter.links.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-300 transition hover:text-cyan-200"
                      >
                        <Building2 className="h-4 w-4" />
                        Visit company website
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </section>
                </div>

                {/* ─── Right: Sticky sidebar ─── */}
                <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">

                  {/* Apply card */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-base font-bold text-white ${getCompanyGradient(job.company)}`}
                      >
                        {job.company.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{recruiter?.displayName ?? job.company}</div>
                        <div className="mt-0.5 text-xs text-slate-500">Hiring Contact</div>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <Button
                        className="h-11 w-full rounded-full"
                        onClick={handleApply}
                        disabled={isApplyLocked || applyToJob.isPending}
                      >
                        <ArrowRight className="mr-2 h-4 w-4" />
                        {applyLabel}
                      </Button>
                      <Button
                        variant="secondary"
                        className="h-11 w-full rounded-full border-slate-700 bg-transparent text-slate-200 hover:border-slate-500 hover:bg-slate-900"
                        onClick={handleMessage}
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Message Recruiter
                      </Button>
                    </div>

                    {applyError && <p className="mt-3 text-sm text-rose-300">{applyError}</p>}
                    {hasApplied && !applyError && (
                      <p className="mt-3 text-sm text-emerald-300">
                        Application recorded. Track updates in My Applications.
                      </p>
                    )}
                  </div>

                  {/* Job Overview — Naukri-style table */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                    <SectionHeader title="Job Overview" />
                    <div className="space-y-3">
                      <OverviewRow label="Posted" value={formatDate(job.createdAt) ?? 'Recently'} />
                      <OverviewRow
                        label="Salary"
                        value={job.salaryExpectation ?? 'To be discussed'}
                      />
                      <OverviewRow
                        label="Experience"
                        value={job.experienceLevel ?? 'Open to all'}
                      />
                      <OverviewRow label="Job Type" value={job.type} />
                      {job.workMode && <OverviewRow label="Work Mode" value={job.workMode} />}
                      <OverviewRow
                        label="Openings"
                        value={typeof job.openings === 'number' ? String(job.openings) : 'Not specified'}
                      />
                      <OverviewRow label="Applicants" value={String(job.applicantCount)} />
                      <OverviewRow label="Shortlisted" value={String(job.shortlistedCount)} />
                      <OverviewRow label="Min Score" value={`${job.minimumInnovationScore}+`} />
                      {job.expiresAt && (
                        <OverviewRow label="Apply Before" value={formatDate(job.expiresAt) ?? ''} />
                      )}
                    </div>
                  </div>

                  {/* About Recruiter */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                    <SectionHeader title="About Recruiter" />
                    <div className="space-y-2.5 text-sm text-slate-300">
                      <div className="font-semibold text-white">{recruiter?.displayName ?? 'Recruiter'}</div>
                      {recruiter?.headline && <div className="text-slate-400">{recruiter.headline}</div>}
                      {recruiter?.location && (
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <MapPin className="h-3.5 w-3.5 text-slate-600" />
                          {recruiter.location}
                        </div>
                      )}
                      {recruiter?.links?.websiteUrl && (
                        <a
                          href={recruiter.links.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-cyan-300 transition hover:text-cyan-200"
                        >
                          <Building2 className="h-3.5 w-3.5" />
                          Company site
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Related jobs from same recruiter */}
                  {relatedJobs.length > 0 && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                      <SectionHeader title="More from this Recruiter" />
                      <div className="space-y-2">
                        {relatedJobs.map((rj) => (
                          <button
                            key={rj._id}
                            type="button"
                            onClick={() => navigate(`/marketplace/jobs/${rj._id}`)}
                            className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-left transition hover:border-slate-600 hover:bg-slate-900"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-white">{rj.title}</div>
                              <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-slate-500">
                                <span>{rj.company}</span>
                                <span>·</span>
                                <span>{rj.location}</span>
                                <span>·</span>
                                <span>{rj.type}</span>
                              </div>
                            </div>
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </aside>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default MarketplaceJobDetail;
