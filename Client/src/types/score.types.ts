export interface ScoreBreakdown {
  problemsClaimed: number;
  skillsCompleted: number;
  progressUploads: number;
  patentsSubmitted: number;
  patentsApproved: number;
  mvpsVerified: number;
  marketReadyVerified: number;
  startupsLaunched: number;
  awardsApproved: number;
}

export interface ScoreBreakdownDetail {
  trigger: ScoreEvent['trigger'];
  label: string;
  description: string;
  occurrences: number;
  pointsPerOccurrence: number;
  totalPoints: number;
  repeatable: boolean;
  actionPath?: string;
  lastAwardedAt: string | null;
}

export interface ScoreImprovementTip {
  trigger: ScoreEvent['trigger'];
  label: string;
  description: string;
  points: number;
  repeatable: boolean;
  actionPath?: string;
  category: 'quick_win' | 'milestone' | 'consistency';
  currentCount: number;
  alreadyClaimed: boolean;
}

export interface ScoreResponse {
  score: number;
  breakdown: ScoreBreakdown;
  weeklyDelta: number;
  rankPercentile: number;
  breakdownDetails: ScoreBreakdownDetail[];
  improvementTips: ScoreImprovementTip[];
  untrackedPoints: number;
}

export interface ScoreEvent {
  _id: string;
  userId: string;
  trigger:
    | 'PROBLEM_CLAIMED'
    | 'PROBLEM_COMPLETED'
    | 'SKILL_COMPLETED'
    | 'PROGRESS_UPLOADED'
    | 'PATENT_SUBMITTED'
    | 'PATENT_APPROVED'
    | 'MVP_VERIFIED'
    | 'MARKET_READY_VERIFIED'
    | 'STARTUP_LAUNCHED'
    | 'AWARD_SUBMITTED'
    | 'AWARD_APPROVED'
    | 'GITHUB_CONNECTED'
    | 'LINKEDIN_CONNECTED'
    | 'RESUME_UPLOADED'
    | 'PROFILE_COMPLETE'
    | 'ONBOARDING_PROFILE'
    | 'ONBOARDING_PROJECT'
    | 'ONBOARDING_GITHUB'
    | 'ONBOARDING_SHARE';
  delta: number;
  scoreAfter: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ScoreUpdatedEvent {
  userId: string;
  newScore: number;
  delta: number;
  trigger: ScoreEvent['trigger'];
}
