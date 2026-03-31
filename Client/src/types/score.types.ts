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

export interface ScoreResponse {
  score: number;
  breakdown: ScoreBreakdown;
  weeklyDelta: number;
  rankPercentile: number;
}

export interface ScoreEvent {
  _id: string;
  userId: string;
  trigger:
    | 'PROBLEM_CLAIMED'
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
    | 'PROFILE_COMPLETE';
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
