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
  createdAt: string;
  updatedAt: string;
}

export interface ProblemListMeta {
  page: number;
  limit: number;
  total: number;
}
