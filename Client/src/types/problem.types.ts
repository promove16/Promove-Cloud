export type ProblemViewerStatus =
  | 'in_progress'
  | 'review_requested'
  | 'changes_requested'
  | 'approved';

export interface ProblemViewerState {
  workspaceId: string;
  submissionId?: string;
  status: ProblemViewerStatus;
  progressPercent: number;
  teamSize: number;
  requestedAt?: string;
  reviewedAt?: string;
  pointsAwarded?: number;
  adminNotes?: string;
}

export interface ProblemStats {
  activeTeamsCount: number;
  approvedTeamsCount: number;
  topPointsAwarded: number;
}

export interface ProblemLeaderboardEntry {
  rank: number;
  submissionId: string;
  workspaceId: string;
  teamName: string;
  pointsAwarded: number;
  reviewedAt: string;
  teamMembers: Array<{
    _id: string;
    displayName: string;
    avatar?: string;
  }>;
}

export interface Problem {
  _id: string;
  title: string;
  description: string;
  category:
    | 'Agriculture'
    | 'Technology'
    | 'Healthcare'
    | 'Education'
    | 'Environment'
    | 'Rural Development'
    | 'Other';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  domain: string;
  tags: string[];
  isVerified: boolean;
  postedBy: string;
  sponsorName?: string;
  geography?: string;
  targetBeneficiaries: string[];
  impactGoal?: string;
  expectedOutcome?: string;
  deliverables: string[];
  acceptanceCriteria: string[];
  constraints: string[];
  resourceLinks: string[];
  securityNotice: string;
  publicationStatus: 'draft' | 'published' | 'archived';
  claimStatus: 'open' | 'claimed' | 'completed';
  maxClaims: number;
  submissionConfig: {
    allowDocuments: boolean;
    allowImages: boolean;
    allowGithubRepos: boolean;
    allowCodeSnippets: boolean;
    maxFileSizeMb: number;
    maxRepoLinks: number;
    maxCodeSnippets: number;
    codeExecutionAllowed: false;
  };
  claimedBy?: string;
  claimedAt?: string;
  stats: ProblemStats;
  viewerState: ProblemViewerState | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProblemListMeta {
  page: number;
  limit: number;
  total: number;
}

export interface ProblemLeaderboardResponse {
  items: ProblemLeaderboardEntry[];
  total: number;
}
