export interface InvestorDashboardStats {
  activeDeals: number;
  newStartupsThisWeek: number;
  portfolioCount: number;
  avgPortfolioScore: number;
}

export interface InvestorStartupFounder {
  _id: string;
  displayName: string;
  avatar?: string;
  innovationScore: number;
  scoreBreakdown: Record<string, number>;
  domain?: string;
}

export interface InvestorStartupCard {
  _id: string;
  name: string;
  tagline: string;
  category: string;
  stage: string;
  launchedAt?: string;
  innovationScoreAtLaunch: number;
  teamSize: number;
  pitchDeckUrl?: string;
  traction: {
    patentFiled: boolean;
    mvpBuilt: boolean;
    revenueGenerating: boolean;
  };
  founder?: InvestorStartupFounder;
}

export interface InvestorStartupListResponse {
  items: InvestorStartupCard[];
  page: number;
  limit: number;
  total: number;
}

export interface InvestorStartupDetailResponse {
  startup: InvestorStartupCard & {
    founders: InvestorStartupFounder[];
  };
  scoreEvents: Array<{
    _id: string;
    trigger: string;
    delta: number;
    scoreAfter: number;
    createdAt: string;
  }>;
  teamMembers: InvestorStartupFounder[];
  canExpressInterest: boolean;
}

export interface InvestorInstitutionCard {
  _id: string;
  institutionName: string;
  location: string;
  totalStudentsEnrolled: number;
  academicYear: string;
  iicStarRating: number;
  institutionType: 'school' | 'college';
  focusLabel: string;
}

export interface InvestorPortfolioResponse {
  items: Array<{
    _id: string;
    dealId: string;
    startupId: string;
    startupName: string;
    startupCategory: string;
    investorRole?: 'Shareholder' | 'Director' | 'Co-Founder';
    equityPercent?: number;
    currentStage: 4;
    innovationScoreSnapshot: number;
    liveInnovationScore: number;
    scoreTrend: number;
    closedAt?: string;
    studentDisplayName: string;
    studentAvatar?: string;
  }>;
  portfolioStrength: {
    averageLiveInnovationScore: number;
    totalPortfolioCount: number;
  };
}
