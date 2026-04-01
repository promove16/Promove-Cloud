export interface StartupTraction {
  patentFiled: boolean;
  mvpBuilt: boolean;
  revenueGenerating: boolean;
  usersCount?: number;
}

export type StartupReviewStatus = 'draft' | 'review_requested' | 'changes_requested' | 'approved';

export interface Startup {
  _id: string;
  founderIds: string[];
  projectId?: string;
  name: string;
  tagline: string;
  category: string;
  stage: 'Pre-Idea' | 'Ideation' | 'MVP' | 'Pre-Launch' | 'Launched';
  pitchDeckUrl?: string;
  pitchDeckName?: string;
  teamSize: number;
  fundingNeeded?: number;
  activeProducts: number;
  launchedToInvestors: boolean;
  launchedToMentors: boolean;
  launchedToRecruiters?: boolean;
  launchedAt?: string;
  innovationScoreAtLaunch: number;
  totalShares: number;
  availableShares: number;
  reservedForSole: number;
  maxPennyInvestors: number;
  currentPennyCount: number;
  hasSoleInvestor: boolean;
  soleInvestorId?: string | null;
  traction: StartupTraction;
  reviewStatus: StartupReviewStatus;
  reviewRequestedAt?: string;
  adminReviewedAt?: string;
  adminReviewedBy?: string | null;
  adminNotes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
