import { isAxiosError } from 'axios';
import { useDeferredValue, useEffect, useMemo, useState, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BriefcaseBusiness,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Users,
  ChevronDown,
  Clock,
  CheckCircle2,
  FileText,
  XCircle,
} from 'lucide-react';
import { recruiterApi } from '../../api/recruiter.api';
import { getMarketplaceDetailPath } from '../../features/marketplace/navigation';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import {
  RECRUITER_PAGE_CONTENT_CLASS,
  RecruiterSectionNav,
  recruiterMarketplaceSectionItems,
} from './RecruiterSectionNav';
import { APPLICATION_STAGE_ORDER } from '../../utils/applicationStages';
import type {
  RecruiterJobApplicantView,
  RecruiterJobApplicationStage,
  RecruiterJobDetail,
} from '../../types/recruiter.types';
import { UserRole } from '../../types/roles.types';

const STAGE_CONFIG: Record<RecruiterJobApplicationStage, { label: string; icon: React.ElementType; color: string }> = {
  'Invited Pending': { label: 'Invited', icon: Clock, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  'Invite Accepted': { label: 'Accepted', icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  'Invite Declined': { label: 'Declined', icon: XCircle, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  Applied: { label: 'Applied', icon: Clock, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  Screening: { label: 'Screening', icon: FileText, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  Shortlisted: { label: 'Shortlisted', icon: Users, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  Interview: { label: 'Interview', icon: Users, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  Offered: { label: 'Offer', icon: ChevronDown, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  Hired: { label: 'Hired', icon: CheckCircle2, color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  Rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

const cardActionClass =
  'flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800';

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

function InlineMetric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="border-l border-slate-800 pl-4 first:border-l-0 first:pl-0">
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className={metricLabelClass}>{label}</div>
    </div>
  );
}

const STAGES_WITH_ICONS: { stage: RecruiterJobApplicationStage; label: string; color: string }[] = [
  { stage: 'Applied', label: 'Applied', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { stage: 'Screening', label: 'Screen', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  { stage: 'Shortlisted', label: 'Shortlist', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  { stage: 'Interview', label: 'Interview', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { stage: 'Offered', label: 'Offer', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { stage: 'Hired', label: 'Hired', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  { stage: 'Rejected', label: 'Reject', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
];

const STAGE_MOVE_OPTIONS = STAGES_WITH_ICONS.filter(s => s.stage !== 'Invited Pending' && s.stage !== 'Invite Accepted' && s.stage !== 'Invite Declined');

function ApplicantCard({
  applicant,
  onMove,
  isUpdating,
  jobId,
}: {
  applicant: RecruiterJobApplicantView;
  onMove: (stage: RecruiterJobApplicationStage) => void;
  isUpdating: boolean;
  jobId: string;
}) {
  const config = STAGE_CONFIG[applicant.stage];
  const navigate = useNavigate();
  const [showStageMenu, setShowStageMenu] = useState(false);
  
  return (
    <div className="group relative flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-slate-700 hover:bg-slate-800/40">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-semibold text-white">
          {applicant.avatar ? (
            <img src={applicant.avatar} alt={applicant.displayName} className="h-11 w-11 rounded-xl object-cover" />
          ) : (
            initialsFor(applicant.displayName)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{applicant.displayName}</div>
          <div className="mt-0.5 truncate text-xs text-slate-400">
            {applicant.institution?.name ?? 'Independent'} · {SOURCE_LABELS[applicant.source]}
          </div>
          {applicant.activeProject && (
            <div className="mt-1 truncate text-xs text-slate-500">
              {applicant.activeProject.title}
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="text-lg font-bold text-white">{applicant.innovationScore}</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Score</div>
        </div>
        {applicant.skills.slice(0, 2).map((skill) => (
          <span key={skill} className="rounded-full border border-slate-700 bg-slate-800/50 px-2 py-0.5 text-[10px] text-slate-400">
            {skill}
          </span>
        ))}
      </div>
      
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[10px] text-slate-500">{relativeLabel(applicant.appliedAt)}</span>
      </div>
      
      <div className="mt-auto pt-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowStageMenu(!showStageMenu)}
            className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              config.color.replace('text-', 'border-').replace(' bg-', 'bg-').replace('border-', 'border-')
            }`}
          >
            <span className="flex items-center gap-2">
              {config.label}
            </span>
            <svg className={`h-4 w-4 transition-transform ${showStageMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showStageMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-1 z-20 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-xl">
              {STAGE_MOVE_OPTIONS.map((option) => (
                <button
                  key={option.stage}
                  type="button"
                  onClick={() => {
                    onMove(option.stage as RecruiterJobApplicationStage);
                    setShowStageMenu(false);
                  }}
                  disabled={isUpdating || applicant.stage === option.stage}
                  className={`w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition ${
                    applicant.stage === option.stage
                      ? `${option.color} font-semibold`
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>{option.label}</span>
                  {applicant.stage === option.stage && (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ApplicationsPipeline() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

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
  const filteredApplications = useMemo(
    () =>
      applications.filter((application) => {
        const matchesSearch = deferredSearch
          ? getApplicantSearchText(application).includes(deferredSearch)
          : true;
        return matchesSearch;
      }),
    [applications, deferredSearch],
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
    <div className={`${RECRUITER_PAGE_CONTENT_CLASS} space-y-5`}>
      <section className="space-y-4 rounded-3xl border border-slate-800/80 bg-slate-950/45 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <RecruiterSectionNav items={recruiterMarketplaceSectionItems} />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
                <Sparkles className="h-4 w-4" />
                Applications Pipeline
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">Hiring Pipeline</h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-400">
                Track, manage, and move candidates through your hiring stages
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-3">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Total Applications</div>
              <div className="mt-1 text-2xl font-bold text-white">{totalApplicants}</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-3">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Active Jobs</div>
              <div className="mt-1 text-2xl font-bold text-white">{activeJobs}</div>
            </div>
            <div className="rounded-2xl border border-green-900/30 bg-green-900/20 px-5 py-3">
              <div className="text-xs uppercase tracking-[0.22em] text-green-400">Hired</div>
              <div className="mt-1 text-2xl font-bold text-green-400">{stageCounts.Hired}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
        <aside className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/45 p-4">
          <div className="flex items-center justify-between px-1 pb-2">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Jobs</div>
              <h2 className="mt-1 text-lg font-semibold text-white">Open Positions</h2>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/10 text-sm font-semibold text-cyan-300">
              {jobsQuery.data?.length ?? 0}
            </div>
          </div>

          <div className="space-y-2">
            {jobsQuery.isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner />
              </div>
            ) : jobsQuery.data?.length ? (
              jobsQuery.data.map((job) => {
                const isSelected = job._id === selectedJobId;
                const isActive = job.isActive;

                return (
                  <button
                    key={job._id}
                    type="button"
                    onClick={() => setSelectedJobId(job._id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? 'border-cyan-500/50 bg-cyan-500/5'
                        : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">{job.title}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                          <span>{job.company}</span>
                          <span className="text-slate-600">·</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {job.location}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                          isActive
                            ? 'border-green-500/30 bg-green-500/10 text-green-400'
                            : 'border-slate-700 text-slate-500'
                        }`}
                      >
                        {isActive ? 'Active' : 'Closed'}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {job.applicantCount}
                      </span>
                      <span>{job.type}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center">
                <BriefcaseBusiness className="mx-auto h-10 w-10 text-slate-600" />
                <div className="mt-3 text-sm font-medium text-slate-400">No jobs posted yet</div>
                <div className="mt-1 text-xs text-slate-500">
                  Post a job to start receiving applications
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/45 p-5">
          {selectedJob ? (
            <>
              <div className="space-y-4 border-b border-slate-800 pb-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
                      <BriefcaseBusiness className="h-4 w-4" />
                      {selectedJob.company}
                    </div>
                    <h2 className="text-2xl font-semibold text-white">{selectedJob.title}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {selectedJob.location}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span>{selectedJob.type}</span>
                      {selectedJob.workMode && (
                        <>
                          <span className="text-slate-600">·</span>
                          <span>{selectedJob.workMode}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div>
                      <div className="text-3xl font-bold text-white">{applications.length}</div>
                      <div className="text-xs uppercase tracking-wider text-slate-500">Applicants</div>
                    </div>
                    <div>
                      <div className="text-lg font-medium text-slate-400">{latestMovement}</div>
                      <div className="text-xs uppercase tracking-wider text-slate-500">Last Activity</div>
                    </div>
                  </div>
                </div>

                <div className="relative max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={search}
                    onChange={(event) =>
                      startTransition(() => {
                        setSearch(event.target.value);
                      })
                    }
                    placeholder="Search by name, skill, project..."
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="min-h-[300px]">
                {pipelineQuery.isLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Spinner />
                  </div>
                ) : (
                  <>
                    {pipelineUnavailable && (
                      <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                        Showing fallback pipeline data. Advanced stages available when server API is enabled.
                      </div>
                    )}

                    {filteredApplications.length ? (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {filteredApplications.map((applicant) => (
                          <ApplicantCard
                            key={applicant._id}
                            applicant={applicant}
                            onMove={(stage) =>
                              stageMutation.mutate({
                                jobId: selectedJob._id,
                                studentId: applicant._id,
                                stage,
                              })
                            }
                            isUpdating={
                              stageMutation.isPending &&
                              stageMutation.variables?.jobId === selectedJob._id &&
                              stageMutation.variables?.studentId === applicant._id
                            }
                            jobId={selectedJob._id}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="rounded-full bg-slate-900 p-4">
                          <Users className="h-8 w-8 text-slate-600" />
                        </div>
                        <div className="mt-4 text-lg font-medium text-slate-400">
                          No candidates yet
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {search ? 'Try a different search term' : 'Applicants will appear here once they apply'}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <BriefcaseBusiness className="h-16 w-16 text-slate-700" />
              <h2 className="mt-5 text-2xl font-semibold text-white">Select a job to view</h2>
              <p className="mt-2 max-w-md text-slate-400">
                Choose a job posting from the sidebar to see its application pipeline
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
