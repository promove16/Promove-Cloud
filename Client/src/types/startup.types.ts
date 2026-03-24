export interface StartupTraction {
  patentFiled: boolean;
  mvpBuilt: boolean;
  revenueGenerating: boolean;
  usersCount?: number;
}

export interface Startup {
  _id: string;
  founderIds: string[];
  projectId?: string;
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
  launchedToRecruiters?: boolean;
  launchedAt?: string;
  innovationScoreAtLaunch: number;
  traction: StartupTraction;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
