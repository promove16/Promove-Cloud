import { User } from './user.model';
import { ApiError } from '../../utils/ApiError';
import { applyScoreAsync, SCORE_DELTAS, ScoreTrigger } from '../../services/scoreEngine';
import { ScoreEvent } from '../innovationScore/score.model';
import { isGithubOauthAvailable } from './githubProof';

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  points: number;
  optional: boolean;
  completed: boolean;
  claimed: boolean;
  href: string;
}

export interface OnboardingStatus {
  steps: OnboardingStep[];
  totalPoints: number;
  earnedPoints: number;
  allComplete: boolean;
}

const STEP_TRIGGERS: Record<string, ScoreTrigger> = {
  profile: 'ONBOARDING_PROFILE',
  project: 'ONBOARDING_PROJECT',
  github: 'ONBOARDING_GITHUB',
  share: 'ONBOARDING_SHARE',
};

export const getOnboardingStatus = async (userId: string): Promise<OnboardingStatus> => {
  const user = await User.findById(userId).lean();
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');

  const claimedEvents = await ScoreEvent.find({
    userId,
    trigger: { $in: Object.values(STEP_TRIGGERS) },
  })
    .select('trigger')
    .lean();
  const claimedTriggers = new Set(claimedEvents.map((e) => e.trigger));

  const profileDone = Boolean(
    user.displayName?.trim() &&
      user.bio?.trim() &&
      (user.domain?.trim() || user.headline?.trim()),
  );

  const projectDone =
    (user.portfolioProjects?.length ?? 0) > 0 ||
    (user.scoreBreakdown?.problemsClaimed ?? 0) > 0;

  const githubDone = Boolean(user.connectedAccounts?.github?.userId);
  const githubOauthAvailable = isGithubOauthAvailable();

  const shareDone = user.discoverableToRecruiters === true;

  const steps: OnboardingStep[] = [
    {
      id: 'profile',
      label: 'Complete your profile',
      description: 'Add your bio, domain, and basic details',
      points: SCORE_DELTAS.ONBOARDING_PROFILE,
      optional: false,
      completed: profileDone,
      claimed: claimedTriggers.has('ONBOARDING_PROFILE'),
      href: '/portfolio',
    },
    {
      id: 'project',
      label: 'Add a project',
      description: 'Claim a problem or add a portfolio project',
      points: SCORE_DELTAS.ONBOARDING_PROJECT,
      optional: false,
      completed: projectDone,
      claimed: claimedTriggers.has('ONBOARDING_PROJECT'),
      href: '/problem-bank',
    },
    {
      id: 'share',
      label: 'Share your profile',
      description: 'Make your profile discoverable to recruiters',
      points: SCORE_DELTAS.ONBOARDING_SHARE,
      optional: false,
      completed: shareDone,
      claimed: claimedTriggers.has('ONBOARDING_SHARE'),
      href: '/leadership-profile',
    },
  ];

  if (githubOauthAvailable || githubDone) {
    steps.splice(2, 0, {
      id: 'github',
      label: 'Connect GitHub',
      description: 'Optional for technical proof. Skip if your startup or work is non-technical.',
      points: SCORE_DELTAS.ONBOARDING_GITHUB,
      optional: true,
      completed: githubDone,
      claimed: claimedTriggers.has('ONBOARDING_GITHUB'),
      href: '/portfolio',
    });
  }

  const totalPoints = steps.reduce((sum, s) => sum + s.points, 0);
  const earnedPoints = steps.reduce((sum, s) => sum + (s.claimed ? s.points : 0), 0);

  return {
    steps,
    totalPoints,
    earnedPoints,
    allComplete: steps.filter((s) => !s.optional).every((s) => s.completed),
  };
};

export const claimOnboardingStep = async (
  userId: string,
  stepId: string,
): Promise<{ awarded: number }> => {
  const trigger = STEP_TRIGGERS[stepId];
  if (!trigger) throw new ApiError(400, 'INVALID_STEP', 'Invalid onboarding step');

  const status = await getOnboardingStatus(userId);
  const step = status.steps.find((s) => s.id === stepId);

  if (!step) throw new ApiError(400, 'INVALID_STEP', 'Invalid onboarding step');
  if (!step.completed)
    throw new ApiError(400, 'STEP_NOT_COMPLETE', 'Complete this step before claiming points');
  if (step.claimed) return { awarded: 0 };

  await applyScoreAsync({ userId, trigger, metadata: { onboardingStep: stepId } });
  return { awarded: step.points };
};
