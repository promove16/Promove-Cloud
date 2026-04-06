import { ScoreBreakdown } from '../user/user.types';

export const MAX_INNOVATION_SCORE = 1000;
export const SCORE_DISTRIBUTION_BUCKETS = ['0-250', '251-500', '501-750', '751-1000'] as const;

export type InnovationScoreDistributionBucket = (typeof SCORE_DISTRIBUTION_BUCKETS)[number];

export const createDefaultScoreBreakdown = (): ScoreBreakdown => ({
  problemsClaimed: 0,
  skillsCompleted: 0,
  progressUploads: 0,
  patentsSubmitted: 0,
  patentsApproved: 0,
  mvpsVerified: 0,
  marketReadyVerified: 0,
  startupsLaunched: 0,
  awardsApproved: 0,
});

const normalizeBreakdownValue = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
};

export const normalizeInnovationScore = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.min(MAX_INNOVATION_SCORE, Math.max(0, value));
};

export const getInnovationScoreDistributionBucket = (
  value: unknown,
): InnovationScoreDistributionBucket => {
  const score = normalizeInnovationScore(value);

  if (score <= 250) {
    return '0-250';
  }

  if (score <= 500) {
    return '251-500';
  }

  if (score <= 750) {
    return '501-750';
  }

  return '751-1000';
};

export const normalizeScoreBreakdown = (value: Partial<ScoreBreakdown> | null | undefined): ScoreBreakdown => {
  const defaults = createDefaultScoreBreakdown();

  return {
    problemsClaimed: normalizeBreakdownValue(value?.problemsClaimed ?? defaults.problemsClaimed),
    skillsCompleted: normalizeBreakdownValue(value?.skillsCompleted ?? defaults.skillsCompleted),
    progressUploads: normalizeBreakdownValue(value?.progressUploads ?? defaults.progressUploads),
    patentsSubmitted: normalizeBreakdownValue(value?.patentsSubmitted ?? defaults.patentsSubmitted),
    patentsApproved: normalizeBreakdownValue(value?.patentsApproved ?? defaults.patentsApproved),
    mvpsVerified: normalizeBreakdownValue(value?.mvpsVerified ?? defaults.mvpsVerified),
    marketReadyVerified: normalizeBreakdownValue(
      value?.marketReadyVerified ?? defaults.marketReadyVerified,
    ),
    startupsLaunched: normalizeBreakdownValue(value?.startupsLaunched ?? defaults.startupsLaunched),
    awardsApproved: normalizeBreakdownValue(value?.awardsApproved ?? defaults.awardsApproved),
  };
};
