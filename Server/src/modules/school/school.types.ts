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

export interface StudentRosterEntryView {
  _id: string;
  displayName: string;
  email: string;
  status: 'invited' | 'registered_pending' | 'verified' | 'rejected';
  onboardingStatus: 'listed' | 'pending_verification' | 'verified' | 'rejected';
  source: 'manual' | 'csv' | 'xlsx';
  createdAt: Date;
  updatedAt: Date;
  gradeOrProgram?: string;
  rollNumber?: string;
  notes?: string;
  linkedUserId?: string;
  registeredAt?: Date;
  reviewedAt?: Date;
}

export interface StudentRosterImportResult {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  created: number;
  updated: number;
  skipped: number;
  importedRows: number;
  entries: StudentRosterEntryView[];
  errors: Array<{
    row: number;
    message: string;
    email?: string;
  }>;
}

export interface StudentVerificationReviewResult {
  _id: string;
  status: 'verified' | 'rejected';
  reviewedBy: string;
  reviewedAt?: Date;
  reason?: string;
}

export interface TemporaryStudentCredentialsView {
  student: {
    _id: string;
    displayName: string;
    email: string;
    profileSlug?: string | null;
  };
  temporaryPassword: string;
  institutionDomain: string;
  createdAt: Date;
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
  activeProjects: number;
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

export interface RecentProjectView {
  _id: string;
  studentId: string;
  studentName: string;
  title: string;
  category: string;
  stage: string;
  progressPercent: number;
  updatedAt: string;
}

export interface InstitutionPatentView {
  _id: string;
  studentId: string;
  studentName: string;
  projectTitle: string;
  status: string;
  submittedAt: string;
}

export interface InstitutionStartupView {
  _id: string;
  name: string;
  tagline: string;
  category: string;
  stage: string;
  founderNames: string[];
  activeProducts: number;
  teamSize: number;
  reviewStatus: string;
  launchedAt?: string;
  updatedAt: string;
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
  recentProjects: RecentProjectView[];
}
