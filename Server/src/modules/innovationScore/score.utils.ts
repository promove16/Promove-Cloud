import { ScoreBreakdown } from '../user/user.types';

export const MAX_INNOVATION_SCORE = 200;

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
