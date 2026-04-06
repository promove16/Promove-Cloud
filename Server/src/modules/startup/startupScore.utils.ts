import { normalizeInnovationScore } from '../innovationScore/score.utils';

type StartupScoreInput = {
  stage: 'Pre-Idea' | 'Ideation' | 'MVP' | 'Pre-Launch' | 'Launched';
  teamSize: number;
  activeProducts: number;
  traction: {
    patentFiled: boolean;
    mvpBuilt: boolean;
    revenueGenerating: boolean;
    usersCount?: number;
  };
};

const STAGE_SCORE: Record<StartupScoreInput['stage'], number> = {
  'Pre-Idea': 25,
  Ideation: 75,
  MVP: 125,
  'Pre-Launch': 175,
  Launched: 200,
};

const getUsersScore = (usersCount?: number) => {
  if (!usersCount || usersCount <= 0) {
    return 0;
  }

  if (usersCount >= 1000) {
    return 120;
  }

  if (usersCount >= 200) {
    return 100;
  }

  if (usersCount >= 50) {
    return 70;
  }

  if (usersCount >= 10) {
    return 40;
  }

  return 20;
};

// Startup score is intentionally separate from the student event score.
// It measures venture readiness rather than founder activity accumulation.
export const calculateStartupInnovationScore = (startup: StartupScoreInput) =>
  normalizeInnovationScore(
    STAGE_SCORE[startup.stage] +
      Math.min(Math.max(startup.teamSize, 0), 5) * 20 +
      Math.min(Math.max(startup.activeProducts, 0), 4) * 25 +
      (startup.traction.patentFiled ? 150 : 0) +
      (startup.traction.mvpBuilt ? 150 : 0) +
      (startup.traction.revenueGenerating ? 180 : 0) +
      getUsersScore(startup.traction.usersCount),
  );
