import { Types } from 'mongoose';

export type StartupReviewStatus = 'draft' | 'review_requested' | 'changes_requested' | 'approved';

export interface IStartup {
  _id: Types.ObjectId;
  founderIds: Types.ObjectId[];
  projectId?: Types.ObjectId;
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
  launchedToRecruiters: boolean;
  launchedAt?: Date;
  innovationScoreAtLaunch: number;
  totalShares: number;
  availableShares: number;
  reservedForSole: number;
  maxPennyInvestors: number;
  currentPennyCount: number;
  hasSoleInvestor: boolean;
  soleInvestorId?: Types.ObjectId | null;
  traction: {
    patentFiled: boolean;
    mvpBuilt: boolean;
    revenueGenerating: boolean;
    usersCount?: number;
  };
  reviewStatus: StartupReviewStatus;
  reviewRequestedAt?: Date;
  adminReviewedAt?: Date;
  adminReviewedBy?: Types.ObjectId | null;
  adminNotes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
