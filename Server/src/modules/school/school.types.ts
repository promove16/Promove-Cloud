import { InstitutionProfile, ScoreBreakdown } from '../user/user.types';

export interface LeaderboardWorkspaceSummary {
  title: string;
  stage: string;
  progressPercent: number;
}

export interface StudentLeaderboardItem {
  rank: number;
  _id: string;
  displayName: string;
  avatar?: string;
  innovationScore: number;
  scoreBreakdown: ScoreBreakdown;
  activeSince: string;
  stage?: string;
  activeProject?: LeaderboardWorkspaceSummary;
}

export interface LeaderboardPage {
  items: StudentLeaderboardItem[];
  nextCursor: string | null;
}

export interface InvestorProfileView {
  _id: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  domain?: string;
  contactPreference: string;
}

export interface StudentAccessTokenView {
  _id: string;
  token: string;
  label?: string;
  isActive: boolean;
  usageCount: number;
  expiresAt?: Date;
  createdAt: Date;
}

export interface PendingStudentVerificationView {
  _id: string;
  displayName: string;
  email: string;
  domain?: string;
  bio?: string;
  verificationRequestedAt?: Date;
  createdAt: Date;
}

export interface StudentVerificationReviewResult {
  _id: string;
  status: 'verified' | 'rejected';
  reviewedBy: string;
  reviewedAt?: Date;
  reason?: string;
}

export interface DashboardEventView {
  _id: string;
  title: string;
  type: string;
  description: string;
  scheduledAt: string;
  participantsCount: number;
}

export interface SchoolDashboardStats {
  totalStudents: number;
  totalInnovationActivities: number;
  patentsFiled: number;
  totalMentoringHours: number;
  startupsLaunched: number;
  industryCollaborations: number;
}

export interface RecentActivityCounts {
  scoreEventsLast30Days: number;
  patentsLast30Days: number;
  startupsLast30Days: number;
}

export interface StudentJourneyPayload {
  student: {
    _id: string;
    displayName: string;
    avatar?: string;
    innovationScore: number;
    scoreBreakdown: ScoreBreakdown;
  };
  scoreEvents: Array<{
    _id: string;
    trigger: string;
    delta: number;
    scoreAfter: number;
    createdAt: Date;
  }>;
  workspaces: Array<{
    _id: string;
    title: string;
    category: string;
    stage: string;
    progressPercent: number;
    updatedAt: Date;
  }>;
  patents: Array<{
    _id: string;
    projectTitle: string;
    status: string;
    submittedAt: Date;
  }>;
  startups: Array<{
    _id: string;
    name: string;
    category: string;
    stage: string;
    launchedAt?: Date;
  }>;
}

export interface SchoolDashboardPayload {
  institutionProfile?: InstitutionProfile;
  stats: SchoolDashboardStats;
  recentActivityCounts: RecentActivityCounts;
  upcomingEvents: DashboardEventView[];
  topStudents: StudentLeaderboardItem[];
}
