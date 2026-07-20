import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  Calendar,
  Clock,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Sparkles,
  Star,
  Users,
  XCircle,
} from 'lucide-react';
import { recruiterApi } from '../../api/recruiter.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import type { RecruiterJobApplicationStage, RecruiterJobApplicantView } from '../../types/recruiter.types';
import { getStudentPortfolioViewPath } from '../../features/marketplace/navigation';

const STAGE_CONFIG: Record<RecruiterJobApplicationStage, { label: string; color: string }> = {
  'Invited Pending': { label: 'Invited Pending', color: 'bg-amber-500/10 text-amber-200 border-amber-500/20' },
  'Invite Accepted': { label: 'Invite Accepted', color: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20' },
  'Invite Declined': { label: 'Invite Declined', color: 'bg-rose-500/10 text-rose-200 border-rose-500/20' },
  Applied: { label: 'Applied', color: 'bg-blue-500/10 text-blue-200 border-blue-500/20' },
  Screening: { label: 'Screening', color: 'bg-yellow-500/10 text-yellow-200 border-yellow-500/20' },
  Shortlisted: { label: 'Shortlisted', color: 'bg-cyan-500/10 text-cyan-200 border-cyan-500/20' },
  Interview: { label: 'Interview', color: 'bg-purple-500/10 text-purple-200 border-purple-500/20' },
  Offered: { label: 'Offered', color: 'bg-orange-500/10 text-orange-200 border-orange-500/20' },
  Hired: { label: 'Hired', color: 'bg-green-500/10 text-green-200 border-green-500/20' },
  Rejected: { label: 'Rejected', color: 'bg-red-500/10 text-red-200 border-red-500/20' },
};

const SOURCE_LABELS: Record<'student_apply' | 'recruiter_invite' | 'hiring_event', string> = {
  student_apply: 'Applied by Student',
  recruiter_invite: 'Invited by Recruiter',
  hiring_event: 'From Hiring Event',
};

const NEXT_STEPS: Record<RecruiterJobApplicationStage, string> = {
  'Invited Pending': 'Waiting for student to accept or decline the invitation',
  'Invite Accepted': 'Student has accepted. Move to screening or interview stage.',
  'Invite Declined': 'Student has declined this opportunity.',
  Applied: 'New application received. Review and shortlist if interested.',
  Screening: 'Review student profile and schedule interview.',
  Shortlisted: 'Candidate is shortlisted. Schedule interview or extend offer.',
  Interview: 'Interview in progress. Evaluate and make decision.',
  Offered: 'Offer extended. Awaiting candidate acceptance.',
  Hired: 'Candidate has been hired!',
  Rejected: 'Application rejected.',
};

type ApplicationData = {
  _id: string;
  displayName?: string;
  avatar?: string;
  innovationScore?: number;
  skills?: string[];
  institution?: { name: string };
  activeProject?: { title: string };
  job: {
    _id: string;
    title: string;
    company: string;
    location: string;
    type: string;
    description?: string;
    workMode?: string;
    domain?: string;
  };
  recruiter?: { _id: string; displayName: string };
  source: 'student_apply' | 'recruiter_invite' | 'hiring_event';
  stage: RecruiterJobApplicationStage;
  note?: string;
  appliedAt: string;
  updatedAt: string;
};

export default function HiringSessionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { applicationId } = useParams<{ applicationId: string }>();
  const [searchParams] = useSearchParams();
  const jobIdParam = searchParams.get('jobId');
  const [note, setNote] = useState('');

  const isRecruiterView = window.location.pathname.includes('/dashboard/recruiter/');
  const isStudentView = window.location.pathname.includes('/dashboard/student/');

  const studentApplicationsQuery = useQuery({
    queryKey: ['student', 'applications'],
    queryFn: recruiterApi.getMyApplications,
    enabled: isStudentView,
  });

  const jobsQuery = useQuery({
    queryKey: ['recruiter', 'jobs'],
    queryFn: recruiterApi.getJobs,
    enabled: isRecruiterView,
  });

  const recruiterJobs = jobsQuery.data ?? [];
  const pipelineQueryResults = useQueries({
    queries: isRecruiterView
      ? recruiterJobs.map((job) => ({
          queryKey: ['recruiter', 'job-applications', job._id],
          queryFn: () => recruiterApi.getJobApplications(job._id),
          enabled: true,
        }))
      : [],
  });
  const pipelineQueries = useMemo(
    () =>
      recruiterJobs.map((job, index) => ({
        jobId: job._id,
        query: pipelineQueryResults[index],
      })),
    [pipelineQueryResults, recruiterJobs],
  );
  const isRecruiterPipelineLoading =
    isRecruiterView &&
    jobsQuery.isSuccess &&
    pipelineQueryResults.some((query) => query.isLoading);

  const application = useMemo((): ApplicationData | null => {
    if (!applicationId) return null;

    if (isStudentView && studentApplicationsQuery.data) {
      const found = studentApplicationsQuery.data.find(
        (app) => app.job._id === applicationId || `${app.job._id}-${app.recruiter?._id}` === applicationId
      );
      if (found) {
        return {
          _id: found.recruiter?._id || '',
          displayName: 'Student',
          innovationScore: 0,
          job: found.job,
          recruiter: found.recruiter,
          source: found.source,
          stage: found.stage,
          note: found.note,
          appliedAt: found.appliedAt,
          updatedAt: found.updatedAt,
        };
      }
    }

    if (isRecruiterView && jobsQuery.data) {
      const targetJobId = jobIdParam || applicationId;
      const job = jobsQuery.data.find((j) => j._id === targetJobId);
      if (job) {
        for (const pq of pipelineQueries) {
          if (pq.query.data?.applications) {
            const app = pq.query.data.applications.find((a: RecruiterJobApplicantView) => a._id === applicationId);
            if (app) {
              return {
                ...app,
                job: {
                  _id: job._id,
                  title: job.title,
                  company: job.company,
                  location: job.location,
                  type: job.type,
                  description: job.description,
                  workMode: job.workMode,
                  domain: job.domain,
                },
              };
            }
          }
        }
      }
    }

    return null;
  }, [
    isStudentView,
    studentApplicationsQuery.data,
    isRecruiterView,
    jobsQuery.data,
    pipelineQueries,
    applicationId,
    jobIdParam,
  ]);

  const stageMutation = useMutation({
    mutationFn: ({
      jobId,
      studentId,
      stage,
    }: {
      jobId: string;
      studentId: string;
      stage: RecruiterJobApplicationStage;
    }) => recruiterApi.updateJobApplication(jobId, studentId, { stage, note: note.trim() || undefined }),
    onSuccess: async () => {
      setNote('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['student', 'applications'] }),
        queryClient.invalidateQueries({ queryKey: ['recruiter', 'jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['recruiter', 'job-applications'] }),
      ]);
    },
  });

  if (isStudentView && studentApplicationsQuery.isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isRecruiterView && (jobsQuery.isLoading || isRecruiterPipelineLoading)) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="space-y-6 p-6">
        <Button variant="secondary" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card className="p-12 text-center">
          <XCircle className="mx-auto h-12 w-12 text-slate-600" />
          <h2 className="mt-4 text-xl font-semibold text-white">Application not found</h2>
          <p className="mt-2 text-slate-400">
            The application you're looking for doesn't exist or you don't have access.
          </p>
        </Card>
      </div>
    );
  }

  const stageConfig = STAGE_CONFIG[application.stage] || STAGE_CONFIG.Applied;
  const nextStep = NEXT_STEPS[application.stage] || 'Review and take next steps';

  return (
    <div className="space-y-6 p-6">
      <Button variant="secondary" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="grid gap-6 xl:grid-cols-[1fr,380px]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
                  <Sparkles className="h-4 w-4" />
                  Hiring Session
                </div>
                <h1 className="mt-2 text-2xl font-semibold text-white">{application.job.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    {application.job.company}
                  </span>
                  <span className="text-slate-600">|</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {application.job.location}
                  </span>
                  <span className="text-slate-600">|</span>
                  <span>{application.job.type}</span>
                  {application.job.workMode && (
                    <>
                      <span className="text-slate-600">|</span>
                      <span>{application.job.workMode}</span>
                    </>
                  )}
                </div>
              </div>
              <Badge className={`border ${stageConfig.color}`}>
                {stageConfig.label}
              </Badge>
            </div>

            {application.job.description && (
              <div className="mt-6">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Job Description</div>
                <p className="mt-3 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-7 text-slate-300">{application.job.description}</p>
              </div>
            )}
          </Card>

          {isRecruiterView && (
            <Card className="p-6">
              <div className="mb-4 text-xs uppercase tracking-[0.22em] text-slate-500">Update Status</div>
              {application.source === 'recruiter_invite' && application.stage === 'Invited Pending' ? (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  Waiting for the student to accept your invite. You can't move this pipeline stage until
                  they respond — withdraw the invite from your requests if you want to cancel it.
                </div>
              ) : (
                <div className="space-y-4">
                  <select
                    value={application.stage}
                    onChange={(e) => {
                      const newStage = e.target.value as RecruiterJobApplicationStage;
                      stageMutation.mutate({
                        jobId: application.job._id,
                        studentId: application._id,
                        stage: newStage,
                      });
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white"
                  >
                    {Object.entries(STAGE_CONFIG)
                      .filter(([stage]) =>
                        stage === 'Invite Accepted' || stage === 'Invite Declined'
                          ? false
                          : stage === 'Invited Pending'
                            ? application.source === 'recruiter_invite'
                            : true,
                      )
                      .map(([stage, config]) => (
                        <option key={stage} value={stage}>
                          {config.label}
                        </option>
                      ))}
                  </select>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a note for the student (optional)"
                  />
                  <Button
                    onClick={() => {
                      stageMutation.mutate({
                        jobId: application.job._id,
                        studentId: application._id,
                        stage: application.stage,
                      });
                    }}
                    disabled={stageMutation.isPending}
                  >
                    {stageMutation.isPending ? 'Saving...' : 'Update Status'}
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="mb-4 text-xs uppercase tracking-[0.22em] text-cyan-300">
              {isRecruiterView ? 'Candidate' : 'Your Application'}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-lg font-semibold text-white">
                {application.displayName?.slice(0, 1).toUpperCase() || 'S'}
              </div>
              <div>
                <div className="text-lg font-semibold text-white">{application.displayName || 'Student'}</div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Star className="h-4 w-4 text-amber-400" />
                  <span>Score {application.innovationScore || 0}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <BriefcaseBusiness className="h-4 w-4" />
                <span>Source: {SOURCE_LABELS[application.source]}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Calendar className="h-4 w-4" />
                <span>
                  Applied {new Date(application.appliedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Clock className="h-4 w-4" />
                <span>
                  Updated {new Date(application.updatedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {application.note && (
              <div className="mt-6 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">Note from Recruiter</div>
                <p className="mt-2 text-sm text-cyan-100">{application.note}</p>
              </div>
            )}

            {isRecruiterView && application._id && (
              <div className="mt-6 flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => navigate(getStudentPortfolioViewPath(application._id))}
                >
                  <Users className="mr-2 h-4 w-4" />
                  View Profile
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => navigate(`/dashboard/messages/${application._id}`)}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Message
                </Button>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-cyan-300">
              <FileText className="h-4 w-4" />
              Next Steps
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{nextStep}</p>

            {isStudentView && application.stage !== 'Hired' && application.stage !== 'Rejected' && application.stage !== 'Invite Declined' && application.recruiter?._id && (
              <div className="mt-6">
                <Button
                  className="w-full"
                  onClick={() => navigate(`/dashboard/messages/${application.recruiter?._id}`)}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Contact Recruiter
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
