import { SCORE_DELTAS, ONE_TIME_SCORE_TRIGGERS, ScoreTrigger } from '../../services/scoreEngine';

type ImprovementCategory = 'quick_win' | 'milestone' | 'consistency';

type ScoreRule = {
  label: string;
  description: string;
  improvementLabel: string;
  improvementDescription: string;
  actionPath?: string;
  category: ImprovementCategory;
};

type ScoreEventStat = {
  occurrences: number;
  totalPoints: number;
  lastAwardedAt: Date | null;
};

export type ScoreEventStats = Partial<Record<ScoreTrigger, ScoreEventStat>>;

export interface ScoreBreakdownDetail {
  trigger: ScoreTrigger;
  label: string;
  description: string;
  occurrences: number;
  pointsPerOccurrence: number;
  totalPoints: number;
  repeatable: boolean;
  actionPath?: string;
  lastAwardedAt: Date | null;
}

export interface ScoreImprovementTip {
  trigger: ScoreTrigger;
  label: string;
  description: string;
  points: number;
  repeatable: boolean;
  actionPath?: string;
  category: ImprovementCategory;
  currentCount: number;
  alreadyClaimed: boolean;
}

const SCORE_RULES: Record<ScoreTrigger, ScoreRule> = {
  PROBLEM_CLAIMED: {
    label: 'Problems Claimed',
    description: 'Validated problems you have picked up from the problem bank.',
    improvementLabel: 'Claim another problem',
    improvementDescription: 'Pick up a new validated problem statement to add +5 more points.',
    actionPath: '/problem-bank',
    category: 'consistency',
  },
  PROBLEM_COMPLETED: {
    label: 'Problems Completed',
    description: 'Problems you carried through to completion.',
    improvementLabel: 'Complete a claimed problem',
    improvementDescription: 'Move one of your active problems to completion for a +20 point jump.',
    actionPath: '/product-workspace',
    category: 'milestone',
  },
  SKILL_COMPLETED: {
    label: 'Skills Completed',
    description: 'Skill milestones completed inside your innovation journey.',
    improvementLabel: 'Finish a skill milestone',
    improvementDescription: 'Complete another skill milestone to add +8 points.',
    actionPath: '/dashboard/student',
    category: 'consistency',
  },
  PROGRESS_UPLOADED: {
    label: 'Progress Uploads',
    description: 'Progress evidence submitted from your product workspace.',
    improvementLabel: 'Upload fresh progress evidence',
    improvementDescription: 'Post a new progress update from your workspace to earn +3 more points.',
    actionPath: '/product-workspace',
    category: 'consistency',
  },
  PATENT_SUBMITTED: {
    label: 'Patents Submitted',
    description: 'Patent filings submitted for review.',
    improvementLabel: 'Submit a patent filing',
    improvementDescription: 'File a patent request for one of your innovations to earn +15 points.',
    actionPath: '/patent-support',
    category: 'milestone',
  },
  PATENT_APPROVED: {
    label: 'Patents Approved',
    description: 'Patents approved after review.',
    improvementLabel: 'Get a patent approved',
    improvementDescription: 'An approved patent is one of the highest-value score milestones at +25 points.',
    actionPath: '/patent-support',
    category: 'milestone',
  },
  MVP_VERIFIED: {
    label: 'MVPs Verified',
    description: 'Minimum viable products verified by the platform.',
    improvementLabel: 'Verify an MVP',
    improvementDescription: 'Get an MVP verified from your startup profile to add +20 points.',
    actionPath: '/startup-launch',
    category: 'milestone',
  },
  MARKET_READY_VERIFIED: {
    label: 'Market-Ready Verifications',
    description: 'Products verified as ready for market.',
    improvementLabel: 'Reach market-ready verification',
    improvementDescription: 'Market-ready verification adds +30 points and signals launch readiness.',
    actionPath: '/startup-launch',
    category: 'milestone',
  },
  STARTUP_LAUNCHED: {
    label: 'Startups Launched',
    description: 'Startups launched from your innovation work.',
    improvementLabel: 'Launch a startup',
    improvementDescription: 'Launch your startup profile to add +10 points and open investor discovery.',
    actionPath: '/startup-launch',
    category: 'milestone',
  },
  AWARD_SUBMITTED: {
    label: 'Awards Submitted',
    description: 'Awards submitted for review.',
    improvementLabel: 'Submit an award',
    improvementDescription: 'Award submissions are tracked here once approved.',
    category: 'consistency',
  },
  AWARD_APPROVED: {
    label: 'Awards Approved',
    description: 'Awards approved after review.',
    improvementLabel: 'Get an award approved',
    improvementDescription: 'Approved awards contribute +15 points to your score.',
    category: 'milestone',
  },
  GITHUB_CONNECTED: {
    label: 'GitHub Connected',
    description: 'One-time reward for connecting your GitHub profile.',
    improvementLabel: 'Connect GitHub',
    improvementDescription: 'Connect your GitHub account to unlock a one-time +5 points.',
    actionPath: '/dashboard/profile',
    category: 'quick_win',
  },
  LINKEDIN_CONNECTED: {
    label: 'LinkedIn Connected',
    description: 'One-time reward for connecting your LinkedIn profile.',
    improvementLabel: 'Connect LinkedIn',
    improvementDescription: 'Connect your LinkedIn account to unlock a one-time +5 points.',
    actionPath: '/dashboard/profile',
    category: 'quick_win',
  },
  RESUME_UPLOADED: {
    label: 'Resume Uploaded',
    description: 'One-time reward for uploading a resume or portfolio document.',
    improvementLabel: 'Upload your resume',
    improvementDescription: 'Upload your resume or equivalent profile document for a one-time +3 points.',
    actionPath: '/dashboard/profile',
    category: 'quick_win',
  },
  PROFILE_COMPLETE: {
    label: 'Profile Completed',
    description: 'One-time reward for completing your core student profile.',
    improvementLabel: 'Complete your profile',
    improvementDescription: 'Finish your profile to unlock a one-time +10 points.',
    actionPath: '/dashboard/profile',
    category: 'quick_win',
  },
  ONBOARDING_PROFILE: {
    label: 'Onboarding Profile',
    description: 'One-time onboarding reward for setting up your student profile.',
    improvementLabel: 'Finish profile onboarding',
    improvementDescription: 'Complete the profile onboarding step to claim +10 points.',
    actionPath: '/dashboard/profile',
    category: 'quick_win',
  },
  ONBOARDING_PROJECT: {
    label: 'Onboarding Project',
    description: 'One-time onboarding reward for adding your first project signal.',
    improvementLabel: 'Finish project onboarding',
    improvementDescription: 'Complete the project onboarding step to claim +20 points.',
    actionPath: '/problem-bank',
    category: 'quick_win',
  },
  ONBOARDING_GITHUB: {
    label: 'Onboarding GitHub',
    description: 'One-time onboarding reward for GitHub proof setup.',
    improvementLabel: 'Finish GitHub onboarding',
    improvementDescription: 'Complete the GitHub onboarding step to unlock +30 points.',
    actionPath: '/dashboard/profile',
    category: 'quick_win',
  },
  ONBOARDING_SHARE: {
    label: 'Onboarding Share',
    description: 'One-time onboarding reward for sharing your public profile.',
    improvementLabel: 'Share your portfolio',
    improvementDescription: 'Share your public portfolio link once to claim +10 points.',
    actionPath: '/portfolio',
    category: 'quick_win',
  },
};

const IMPROVEMENT_PRIORITY: ScoreTrigger[] = [
  'ONBOARDING_GITHUB',
  'ONBOARDING_PROJECT',
  'PROFILE_COMPLETE',
  'ONBOARDING_PROFILE',
  'ONBOARDING_SHARE',
  'GITHUB_CONNECTED',
  'LINKEDIN_CONNECTED',
  'RESUME_UPLOADED',
  'MARKET_READY_VERIFIED',
  'PATENT_APPROVED',
  'MVP_VERIFIED',
  'PROBLEM_COMPLETED',
  'PATENT_SUBMITTED',
  'STARTUP_LAUNCHED',
  'AWARD_APPROVED',
  'SKILL_COMPLETED',
  'PROGRESS_UPLOADED',
  'PROBLEM_CLAIMED',
];

const isRepeatableTrigger = (trigger: ScoreTrigger) => !ONE_TIME_SCORE_TRIGGERS.includes(trigger);

export const buildScoreBreakdownDetails = (eventStats: ScoreEventStats): ScoreBreakdownDetail[] =>
  Object.entries(eventStats)
    .filter(([, stats]) => Boolean(stats) && (stats?.totalPoints ?? 0) > 0)
    .map(([trigger, stats]) => {
      const typedTrigger = trigger as ScoreTrigger;
      const rule = SCORE_RULES[typedTrigger];

      return {
        trigger: typedTrigger,
        label: rule.label,
        description: rule.description,
        occurrences: stats?.occurrences ?? 0,
        pointsPerOccurrence: SCORE_DELTAS[typedTrigger],
        totalPoints: stats?.totalPoints ?? 0,
        repeatable: isRepeatableTrigger(typedTrigger),
        ...(rule.actionPath ? { actionPath: rule.actionPath } : {}),
        lastAwardedAt: stats?.lastAwardedAt ?? null,
      };
    })
    .sort((left, right) => {
      if (right.totalPoints !== left.totalPoints) {
        return right.totalPoints - left.totalPoints;
      }

      return left.label.localeCompare(right.label);
    });

export const buildScoreImprovementTips = (eventStats: ScoreEventStats): ScoreImprovementTip[] => {
  const tips = IMPROVEMENT_PRIORITY.flatMap((trigger) => {
    const rule = SCORE_RULES[trigger];
    const stats = eventStats[trigger];
    const alreadyClaimed = (stats?.occurrences ?? 0) > 0;
    const repeatable = isRepeatableTrigger(trigger);

    if (!repeatable && alreadyClaimed) {
      return [];
    }

    return [
      {
        trigger,
        label: rule.improvementLabel,
        description:
          repeatable && alreadyClaimed
            ? `${rule.improvementDescription} You have already earned this ${stats?.occurrences ?? 0} time${(stats?.occurrences ?? 0) === 1 ? '' : 's'}.`
            : rule.improvementDescription,
        points: SCORE_DELTAS[trigger],
        repeatable,
        ...(rule.actionPath ? { actionPath: rule.actionPath } : {}),
        category: rule.category,
        currentCount: stats?.occurrences ?? 0,
        alreadyClaimed,
      },
    ];
  });

  const quickWins = tips.filter((tip) => tip.category === 'quick_win').slice(0, 3);
  const milestones = tips.filter((tip) => tip.category === 'milestone').slice(0, 2);
  const consistency = tips.filter((tip) => tip.category === 'consistency').slice(0, 1);

  return [...quickWins, ...milestones, ...consistency];
};
