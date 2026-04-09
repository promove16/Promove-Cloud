import type {
  RecruiterJobApplicationStage,
  RecruiterStudentApplicationView,
} from '../types/recruiter.types';

type StudentApplicationSource = RecruiterStudentApplicationView['source'];
type StudentProgressStageKey = 'Applied' | 'Screening' | 'Shortlisted' | 'Interview' | 'Offered' | 'Hired';
type StudentProgressStepKey = 'source' | StudentProgressStageKey;

interface StudentProgressStep {
  key: StudentProgressStepKey;
  label: string;
}

export interface StudentApplicationProgress {
  currentIndex: number;
  helperText: string;
  steps: StudentProgressStep[];
  tone: 'default' | 'success' | 'danger';
}

export const APPLICATION_STAGE_ORDER: RecruiterJobApplicationStage[] = [
  'Invited Pending',
  'Invite Accepted',
  'Applied',
  'Screening',
  'Shortlisted',
  'Interview',
  'Offered',
  'Hired',
  'Invite Declined',
  'Rejected',
];

export const APPLICATION_STAGE_BADGE: Record<RecruiterJobApplicationStage, string> = {
  'Invited Pending': 'border-amber-500/30 text-amber-300',
  'Invite Accepted': 'border-emerald-500/30 text-emerald-300',
  'Invite Declined': 'border-rose-500/30 text-rose-300',
  Applied: 'border-slate-700 text-slate-200',
  Screening: 'border-cyan-500/30 text-cyan-300',
  Shortlisted: 'border-blue-500/30 text-blue-300',
  Interview: 'border-violet-500/30 text-violet-300',
  Offered: 'border-amber-500/30 text-amber-300',
  Hired: 'border-emerald-500/30 text-emerald-300',
  Rejected: 'border-rose-500/30 text-rose-300',
};

const SHARED_PROGRESS_STEPS: StudentProgressStep[] = [
  { key: 'Applied', label: 'Applied' },
  { key: 'Screening', label: 'Screening' },
  { key: 'Shortlisted', label: 'Shortlisted' },
  { key: 'Interview', label: 'Interview' },
  { key: 'Offered', label: 'Offer' },
  { key: 'Hired', label: 'Hired' },
];

const SOURCE_STEP_LABEL: Record<StudentApplicationSource, string> = {
  student_apply: 'Applied',
  recruiter_invite: 'Invited',
  hiring_event: 'Event',
};

const STAGE_TO_PROGRESS_KEY: Record<RecruiterJobApplicationStage, StudentProgressStepKey> = {
  'Invited Pending': 'source',
  'Invite Accepted': 'source',
  'Invite Declined': 'source',
  Applied: 'Applied',
  Screening: 'Screening',
  Shortlisted: 'Shortlisted',
  Interview: 'Interview',
  Offered: 'Offered',
  Hired: 'Hired',
  Rejected: 'Applied',
};

const STAGE_HELPER_TEXT: Record<RecruiterJobApplicationStage, string> = {
  'Invited Pending': 'Recruiter invite received. Accept or decline it from your pending invites.',
  'Invite Accepted': 'Invite accepted. The recruiter can now move your application into review.',
  'Invite Declined': 'Invite declined. This application is now closed.',
  Applied: 'Application submitted. Waiting for the recruiter to review your profile.',
  Screening: 'Your profile is currently under recruiter review.',
  Shortlisted: 'You made the shortlist and are still in consideration.',
  Interview: 'Interview stage is active. Watch messages for scheduling updates.',
  Offered: 'Offer stage reached. Stay in touch with the recruiter for next steps.',
  Hired: 'Marked as hired. This application reached its final stage.',
  Rejected: 'This application was closed by the recruiter.',
};

const buildStudentProgressSteps = (source: StudentApplicationSource): StudentProgressStep[] =>
  source === 'student_apply'
    ? SHARED_PROGRESS_STEPS
    : [{ key: 'source', label: SOURCE_STEP_LABEL[source] }, ...SHARED_PROGRESS_STEPS];

export const getStudentApplicationProgress = (
  stage: RecruiterJobApplicationStage,
  source: StudentApplicationSource,
): StudentApplicationProgress => {
  const steps = buildStudentProgressSteps(source);
  const currentStepKey = STAGE_TO_PROGRESS_KEY[stage];
  const currentIndex = Math.max(
    steps.findIndex((step) => step.key === currentStepKey),
    0,
  );

  return {
    currentIndex,
    helperText: STAGE_HELPER_TEXT[stage],
    steps,
    tone:
      stage === 'Rejected' || stage === 'Invite Declined'
        ? 'danger'
        : stage === 'Hired'
          ? 'success'
          : 'default',
  };
};
