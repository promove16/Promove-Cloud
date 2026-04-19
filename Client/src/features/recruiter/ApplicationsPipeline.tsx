import { isAxiosError } from 'axios';
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ElementType,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Eye,
  FileText,
  LayoutGrid,
  List,
  Mail,
  MapPin,
  Search,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import { recruiterApi } from '../../api/recruiter.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import type {
  RecruiterJobApplicantView,
  RecruiterJobApplicationStage,
  RecruiterJobDetail,
} from '../../types/recruiter.types';
import { APPLICATION_STAGE_ORDER } from '../../utils/applicationStages';
import {
  RECRUITER_PAGE_CONTENT_CLASS,
  RecruiterSectionNav,
  recruiterMarketplaceSectionItems,
} from './RecruiterSectionNav';
import { StudentProfileDrawer } from './StudentProfileDrawer';

type StageConfig = {
  label: string;
  icon: ElementType;
  color: string;
};

type PipelineViewMode = 'grid' | 'list';

const STAGE_CONFIG: Record<RecruiterJobApplicationStage, StageConfig> = {
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

const PIPELINE_STAGE_OPTIONS: Array<{ stage: RecruiterJobApplicationStage; label: string; color: string }> = [
  { stage: 'Applied', label: 'Applied', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { stage: 'Screening', label: 'Screen', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  { stage: 'Shortlisted', label: 'Shortlist', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  { stage: 'Interview', label: 'Interview', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { stage: 'Offered', label: 'Offer', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { stage: 'Hired', label: 'Hired', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  { stage: 'Rejected', label: 'Reject', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
];

const viewToggleButtonClass =
  'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60';

const cardActionClass =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60';

const selectClass =
  'rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/50';

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
    applicant.contactEmail,
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

function StageMenuButton({
  applicant,
  onMove,
  isUpdating,
  className = 'w-full',
}: {
  applicant: RecruiterJobApplicantView;
  onMove: (stage: RecruiterJobApplicationStage) => void;
  isUpdating: boolean;
  className?: string;
}) {
  const [showStageMenu, setShowStageMenu] = useState(false);
  const config = STAGE_CONFIG[applicant.stage];
  const Icon = config.icon;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={showStageMenu}
        aria-label={`Change ${applicant.displayName} stage. Current stage ${config.label}.`}
        onClick={() => setShowStageMenu((current) => !current)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${
          config.color
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{config.label}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${showStageMenu ? 'rotate-180' : ''}`} />
      </button>

      {showStageMenu ? (
        <div className="absolute bottom-full left-0 right-0 z-20 mb-2 max-h-56 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-xl">
          {PIPELINE_STAGE_OPTIONS.map((option) => (
            <button
              key={`${applicant._id}-${option.stage}`}
              type="button"
              role="menuitem"
              onClick={() => {
                onMove(option.stage);
                setShowStageMenu(false);
              }}
              disabled={isUpdating || applicant.stage === option.stage}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition ${
                applicant.stage === option.stage
                  ? `${option.color} font-semibold`
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span>{option.label}</span>
              {applicant.stage === option.stage ? <Check className="h-4 w-4" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ApplicantCard({
  applicant,
  isSelected,
  isUpdating,
  onCopyEmail,
  onMove,
  onOpenProfile,
  onOpenSession,
  onToggleSelect,
}: {
  applicant: RecruiterJobApplicantView;
  isSelected: boolean;
  isUpdating: boolean;
  onCopyEmail: (applicant: RecruiterJobApplicantView) => void;
  onMove: (stage: RecruiterJobApplicationStage) => void;
  onOpenProfile: () => void;
  onOpenSession: () => void;
  onToggleSelect: () => void;
}) {
  const hasContact = Boolean(applicant.contactEmail);

  return (
    <article className="group relative flex flex-col rounded-2xl border border-slate-800 bg-slate-900 p-4 transition hover:border-slate-700 hover:bg-slate-800/40">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
        >
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
              {applicant.institution?.name ?? 'Independent'} | {SOURCE_LABELS[applicant.source]}
            </div>
            {applicant.activeProject ? (
              <div className="mt-1 truncate text-xs text-slate-500">{applicant.activeProject.title}</div>
            ) : null}
            <div className="mt-2 truncate text-xs text-emerald-300" translate="no">
              {applicant.contactEmail ?? 'Direct contact locked'}
            </div>
          </div>
        </button>

        <label className="mt-0.5 flex shrink-0 cursor-pointer items-center gap-2 text-xs text-slate-400">
          <span className="sr-only">Select {applicant.displayName}</span>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-400 focus:ring-cyan-400"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1">
          <div className="text-lg font-bold tabular-nums text-white">{applicant.innovationScore}</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Score</div>
        </div>

        <div className="flex flex-wrap justify-end gap-1.5">
          {applicant.skills.slice(0, 2).map((skill) => (
            <span
              key={`${applicant._id}-${skill}`}
              className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 text-[11px] text-slate-500">
        Applied {relativeLabel(applicant.appliedAt)} | Updated {relativeLabel(applicant.updatedAt)}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onOpenProfile} className={cardActionClass}>
          <Eye className="h-3.5 w-3.5" />
          View Profile
        </button>
        {hasContact ? (
          <button type="button" onClick={() => onCopyEmail(applicant)} className={cardActionClass}>
            <Copy className="h-3.5 w-3.5" />
            Copy Email
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200">
            <Mail className="h-3.5 w-3.5" />
            Contact Locked
          </span>
        )}
        <button type="button" onClick={onOpenSession} className={cardActionClass}>
          <ArrowUpRight className="h-3.5 w-3.5" />
          Hiring Session
        </button>
      </div>

      <div className="mt-auto pt-4">
        <StageMenuButton applicant={applicant} onMove={onMove} isUpdating={isUpdating} />
      </div>
    </article>
  );
}

function ApplicantTable({
  applicants,
  isApplicantSelected,
  isApplicantUpdating,
  onCopyEmail,
  onMove,
  onOpenProfile,
  onOpenSession,
  onToggleSelect,
}: {
  applicants: RecruiterJobApplicantView[];
  isApplicantSelected: (applicantId: string) => boolean;
  isApplicantUpdating: (applicantId: string) => boolean;
  onCopyEmail: (applicant: RecruiterJobApplicantView) => void;
  onMove: (applicantId: string, stage: RecruiterJobApplicationStage) => void;
  onOpenProfile: (applicantId: string) => void;
  onOpenSession: (applicantId: string) => void;
  onToggleSelect: (applicantId: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800">
      <table className="min-w-full border-collapse">
        <thead className="bg-slate-900">
          <tr className="text-left text-xs uppercase tracking-[0.22em] text-slate-500">
            <th scope="col" className="w-12 px-4 py-3">
              <span className="sr-only">Select</span>
            </th>
            <th scope="col" className="px-4 py-3">
              Candidate
            </th>
            <th scope="col" className="px-4 py-3">
              Score
            </th>
            <th scope="col" className="px-4 py-3">
              Contact
            </th>
            <th scope="col" className="px-4 py-3">
              Updated
            </th>
            <th scope="col" className="px-4 py-3">
              Stage
            </th>
            <th scope="col" className="px-4 py-3">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {applicants.map((applicant) => (
            <tr key={applicant._id} className="border-t border-slate-800 bg-slate-950 align-top">
              <td className="px-4 py-4">
                <label className="inline-flex cursor-pointer items-center">
                  <span className="sr-only">Select {applicant.displayName}</span>
                  <input
                    type="checkbox"
                    checked={isApplicantSelected(applicant._id)}
                    onChange={() => onToggleSelect(applicant._id)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-400 focus:ring-cyan-400"
                  />
                </label>
              </td>
              <td className="px-4 py-4">
                <button
                  type="button"
                  onClick={() => onOpenProfile(applicant._id)}
                  className="flex items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-xs font-semibold text-white">
                    {applicant.avatar ? (
                      <img src={applicant.avatar} alt={applicant.displayName} className="h-10 w-10 rounded-xl object-cover" />
                    ) : (
                      initialsFor(applicant.displayName)
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-white">{applicant.displayName}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {applicant.institution?.name ?? 'Independent'} | {SOURCE_LABELS[applicant.source]}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {applicant.activeProject?.title ?? 'No active project shared'}
                    </div>
                  </div>
                </button>
              </td>
              <td className="px-4 py-4">
                <div className="text-lg font-semibold tabular-nums text-white">{applicant.innovationScore}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {applicant.skills.slice(0, 2).map((skill) => (
                    <span
                      key={`${applicant._id}-table-${skill}`}
                      className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-400"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-4">
                {applicant.contactEmail ? (
                  <div className="space-y-2">
                    <div className="max-w-[14rem] truncate text-sm text-emerald-300" translate="no">
                      {applicant.contactEmail}
                    </div>
                    <button type="button" onClick={() => onCopyEmail(applicant)} className={cardActionClass}>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </button>
                  </div>
                ) : (
                  <span className="text-sm text-amber-200">Locked</span>
                )}
              </td>
              <td className="px-4 py-4 text-sm text-slate-400">
                <div>{relativeLabel(applicant.updatedAt)}</div>
                <div className="mt-1 text-xs text-slate-500">{formatDateTime(applicant.updatedAt)}</div>
              </td>
              <td className="px-4 py-4">
                <StageMenuButton
                  applicant={applicant}
                  onMove={(stage) => onMove(applicant._id, stage)}
                  isUpdating={isApplicantUpdating(applicant._id)}
                  className="min-w-[10rem]"
                />
              </td>
              <td className="px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => onOpenProfile(applicant._id)} className={cardActionClass}>
                    <Eye className="h-3.5 w-3.5" />
                    Profile
                  </button>
                  <button type="button" onClick={() => onOpenSession(applicant._id)} className={cardActionClass}>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Session
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ApplicationsPipeline() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [selectedApplicantIds, setSelectedApplicantIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<PipelineViewMode>('grid');
  const [bulkStage, setBulkStage] = useState<RecruiterJobApplicationStage | ''>('');
  const [statusMessage, setStatusMessage] = useState('');
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
  const selectedApplicantIdSet = useMemo(() => new Set(selectedApplicantIds), [selectedApplicantIds]);
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

  const visibleApplicantIds = useMemo(
    () => filteredApplications.map((application) => application._id),
    [filteredApplications],
  );

  const allVisibleSelected =
    visibleApplicantIds.length > 0 && visibleApplicantIds.every((applicationId) => selectedApplicantIdSet.has(applicationId));

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

  const invalidateRecruiterData = async (jobId?: string) => {
    await Promise.all([
      jobId
        ? queryClient.invalidateQueries({ queryKey: ['recruiter', 'job-applications', jobId] })
        : queryClient.invalidateQueries({ queryKey: ['recruiter', 'job-applications'] }),
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'jobs'] }),
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'onboarding'] }),
      queryClient.invalidateQueries({ queryKey: ['recruiter', 'talent'] }),
    ]);
  };

  useEffect(() => {
    setSelectedApplicantIds((current) => current.filter((applicantId) => applications.some((item) => item._id === applicantId)));

    if (selectedApplicantId && !applications.some((item) => item._id === selectedApplicantId)) {
      setSelectedApplicantId(null);
    }
  }, [applications, selectedApplicantId]);

  useEffect(() => {
    setSelectedApplicantIds([]);
    setBulkStage('');
  }, [selectedJobId]);

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
      setStatusMessage(`Moved candidate to ${STAGE_CONFIG[variables.stage].label}.`);
      await invalidateRecruiterData(variables.jobId);
    },
    onError: () => {
      setStatusMessage('Unable to update candidate stage right now.');
    },
  });

  const bulkStageMutation = useMutation({
    mutationFn: async ({
      jobId,
      studentIds,
      stage,
    }: {
      jobId: string;
      studentIds: string[];
      stage: RecruiterJobApplicationStage;
    }) => {
      await Promise.all(
        studentIds.map((studentId) => recruiterApi.updateJobApplication(jobId, studentId, { stage })),
      );
      return { count: studentIds.length, stage };
    },
    onSuccess: async ({ count, stage }, variables) => {
      setSelectedApplicantIds([]);
      setBulkStage('');
      setStatusMessage(`Moved ${count} candidate${count === 1 ? '' : 's'} to ${STAGE_CONFIG[stage].label}.`);
      await invalidateRecruiterData(variables.jobId);
    },
    onError: () => {
      setStatusMessage('Unable to update selected candidates right now.');
    },
  });

  const isApplicantUpdating = (applicantId: string) =>
    (stageMutation.isPending && stageMutation.variables?.studentId === applicantId) ||
    Boolean(bulkStageMutation.isPending && bulkStageMutation.variables?.studentIds.includes(applicantId));

  const toggleApplicantSelection = (applicantId: string) => {
    setSelectedApplicantIds((current) =>
      current.includes(applicantId)
        ? current.filter((currentApplicantId) => currentApplicantId !== applicantId)
        : [...current, applicantId],
    );
  };

  const toggleVisibleSelection = () => {
    setSelectedApplicantIds((current) => {
      const currentSet = new Set(current);

      if (allVisibleSelected) {
        visibleApplicantIds.forEach((applicantId) => currentSet.delete(applicantId));
        return Array.from(currentSet);
      }

      visibleApplicantIds.forEach((applicantId) => currentSet.add(applicantId));
      return Array.from(currentSet);
    });
  };

  const openHiringSession = (applicantId: string) => {
    if (!selectedJob?._id) {
      return;
    }

    navigate(`/dashboard/recruiter/applications/${applicantId}?jobId=${selectedJob._id}`);
  };

  const copyApplicantEmail = async (applicant: RecruiterJobApplicantView) => {
    if (!applicant.contactEmail) {
      setStatusMessage(`${applicant.displayName} has no unlocked email yet.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(applicant.contactEmail);
      setStatusMessage(`Copied ${applicant.displayName}'s email.`);
    } catch {
      setStatusMessage('Unable to copy email from this browser session.');
    }
  };

  const submitBulkStageUpdate = () => {
    if (!selectedJob?._id || !bulkStage || selectedApplicantIds.length === 0) {
      return;
    }

    bulkStageMutation.mutate({
      jobId: selectedJob._id,
      studentIds: selectedApplicantIds,
      stage: bulkStage,
    });
  };

  return (
    <div className={`${RECRUITER_PAGE_CONTENT_CLASS} space-y-5`}>
      <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950 px-5 py-5 sm:px-6">
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
                Track, manage, and move candidates through your hiring stages without leaving the pipeline.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-3">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Total Applications</div>
              <div className="mt-1 text-2xl font-bold text-white">{totalApplicants}</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-3">
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
        <aside className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950 p-4">
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
                    className={`w-full rounded-xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${
                      isSelected
                        ? 'border-cyan-500/50 bg-cyan-500/5'
                        : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">{job.title}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                          <span>{job.company}</span>
                          <span className="text-slate-600">|</span>
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
                <div className="mt-1 text-xs text-slate-500">Post a job to start receiving applications</div>
              </div>
            )}
          </div>
        </aside>

        <main className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950 p-5">
          <div aria-live="polite" className="sr-only">
            {statusMessage}
          </div>

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
                      <span className="text-slate-600">|</span>
                      <span>{selectedJob.type}</span>
                      {selectedJob.workMode ? (
                        <>
                          <span className="text-slate-600">|</span>
                          <span>{selectedJob.workMode}</span>
                        </>
                      ) : null}
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

                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="relative max-w-md flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      aria-label="Search applicants"
                      autoComplete="off"
                      value={search}
                      onChange={(event) =>
                        startTransition(() => {
                          setSearch(event.target.value);
                        })
                      }
                      placeholder="Search by name, email, skill, or project..."
                      className="pl-10"
                    />
                  </div>

                  <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1">
                    <button
                      type="button"
                      aria-pressed={viewMode === 'grid'}
                      onClick={() => setViewMode('grid')}
                      className={`${viewToggleButtonClass} ${
                        viewMode === 'grid' ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <LayoutGrid className="h-4 w-4" />
                      Grid
                    </button>
                    <button
                      type="button"
                      aria-pressed={viewMode === 'list'}
                      onClick={() => setViewMode('list')}
                      className={`${viewToggleButtonClass} ${
                        viewMode === 'list' ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <List className="h-4 w-4" />
                      List
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleVisibleSelection}
                        disabled={visibleApplicantIds.length === 0}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-400 focus:ring-cyan-400"
                      />
                      Select visible
                    </label>
                    <span className="text-slate-500">|</span>
                    <span className="tabular-nums text-white">{selectedApplicantIds.length}</span>
                    <span className="text-slate-400">selected</span>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label htmlFor="bulk-stage" className="sr-only">
                      Move selected applicants to stage
                    </label>
                    <select
                      id="bulk-stage"
                      value={bulkStage}
                      onChange={(event) => setBulkStage(event.target.value as RecruiterJobApplicationStage | '')}
                      className={selectClass}
                    >
                      <option value="">Move selected to...</option>
                      {PIPELINE_STAGE_OPTIONS.map((option) => (
                        <option key={`bulk-${option.stage}`} value={option.stage}>
                          {STAGE_CONFIG[option.stage].label}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={submitBulkStageUpdate}
                      disabled={!bulkStage || selectedApplicantIds.length === 0 || bulkStageMutation.isPending}
                    >
                      {bulkStageMutation.isPending ? 'Updating...' : 'Apply bulk update'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="min-h-[300px]">
                {pipelineQuery.isLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Spinner />
                  </div>
                ) : (
                  <>
                    {pipelineUnavailable ? (
                      <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                        Showing fallback pipeline data. Advanced stages appear when the full applications API is available.
                      </div>
                    ) : null}

                    {filteredApplications.length ? (
                      viewMode === 'grid' ? (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {filteredApplications.map((applicant) => (
                            <ApplicantCard
                              key={applicant._id}
                              applicant={applicant}
                              isSelected={selectedApplicantIdSet.has(applicant._id)}
                              isUpdating={isApplicantUpdating(applicant._id)}
                              onCopyEmail={copyApplicantEmail}
                              onMove={(stage) =>
                                stageMutation.mutate({
                                  jobId: selectedJob._id,
                                  studentId: applicant._id,
                                  stage,
                                })
                              }
                              onOpenProfile={() => setSelectedApplicantId(applicant._id)}
                              onOpenSession={() => openHiringSession(applicant._id)}
                              onToggleSelect={() => toggleApplicantSelection(applicant._id)}
                            />
                          ))}
                        </div>
                      ) : (
                        <ApplicantTable
                          applicants={filteredApplications}
                          isApplicantSelected={(applicantId) => selectedApplicantIdSet.has(applicantId)}
                          isApplicantUpdating={isApplicantUpdating}
                          onCopyEmail={copyApplicantEmail}
                          onMove={(applicantId, stage) =>
                            stageMutation.mutate({
                              jobId: selectedJob._id,
                              studentId: applicantId,
                              stage,
                            })
                          }
                          onOpenProfile={(applicantId) => setSelectedApplicantId(applicantId)}
                          onOpenSession={openHiringSession}
                          onToggleSelect={toggleApplicantSelection}
                        />
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="rounded-full bg-slate-900 p-4">
                          <Users className="h-8 w-8 text-slate-600" />
                        </div>
                        <div className="mt-4 text-lg font-medium text-slate-400">No candidates yet</div>
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
                Choose a job posting from the sidebar to see its application pipeline.
              </p>
            </div>
          )}
        </main>
      </div>

      <StudentProfileDrawer
        studentId={selectedApplicantId}
        open={Boolean(selectedApplicantId)}
        onClose={() => setSelectedApplicantId(null)}
        onChanged={() => {
          void invalidateRecruiterData(selectedJobId ?? undefined);
        }}
        activeJobCount={activeJobs}
      />
    </div>
  );
}
