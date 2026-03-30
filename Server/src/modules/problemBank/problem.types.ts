import { Types } from 'mongoose';

export type ProblemCategory =
  | 'Agriculture'
  | 'Technology'
  | 'Healthcare'
  | 'Education'
  | 'Environment'
  | 'Rural Development'
  | 'Other';

export type ProblemDifficulty = 'Easy' | 'Medium' | 'Hard';
export type ProblemPublicationStatus = 'draft' | 'published' | 'archived';
export type ProblemClaimStatus = 'open' | 'claimed' | 'completed';

export interface ProblemSubmissionConfig {
  allowDocuments: boolean;
  allowImages: boolean;
  allowGithubRepos: boolean;
  allowCodeSnippets: boolean;
  maxFileSizeMb: number;
  maxRepoLinks: number;
  maxCodeSnippets: number;
  codeExecutionAllowed: boolean;
}

export interface IProblem {
  _id: Types.ObjectId;
  title: string;
  description: string;
  category: ProblemCategory;
  difficulty: ProblemDifficulty;
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
  publicationStatus: ProblemPublicationStatus;
  claimStatus: ProblemClaimStatus;
  maxClaims: number;
  submissionConfig: ProblemSubmissionConfig;
  createdByAdminId?: Types.ObjectId;
  claimedBy?: Types.ObjectId;
  claimedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
