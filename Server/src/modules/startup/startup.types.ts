import { Types } from 'mongoose';

export interface IStartup {
  _id: Types.ObjectId;
  founderIds: Types.ObjectId[];
  projectId?: Types.ObjectId;
  name: string;
  tagline: string;
  category: string;
  stage: 'Pre-Idea' | 'Ideation' | 'MVP' | 'Pre-Launch' | 'Launched';
  pitchDeckUrl?: string;
  teamSize: number;
  fundingNeeded?: number;
  activeProducts: number;
  launchedToInvestors: boolean;
  launchedToMentors: boolean;
  launchedToRecruiters: boolean;
  launchedAt?: Date;
  innovationScoreAtLaunch: number;
  traction: {
    patentFiled: boolean;
    mvpBuilt: boolean;
    revenueGenerating: boolean;
    usersCount?: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
