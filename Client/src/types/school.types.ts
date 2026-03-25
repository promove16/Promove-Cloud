export interface InstitutionPolicy {
  name: string;
  status: 'Active' | 'On Track' | 'Pending' | 'Inactive';
  lastUpdated?: string;
}

export interface InstitutionStats {
  totalInnovationActivities: number;
  patentsFiled: number;
  totalMentoringHours: number;
  startupsLaunched: number;
  industryCollaborations: number;
  totalHRConnections?: number;
  studentsPlaced?: number;
  directShortlistsThisQuarter?: number;
  topHiringSector?: string;
}

export interface InstitutionProfile {
  institutionName: string;
  location: string;
  totalStudentsEnrolled: number;
  academicYear: string;
  iicStarRating: number;
  iicLastUpdated?: string;
  policies: InstitutionPolicy[];
  stats: InstitutionStats;
}

export interface StudentActiveProject {
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
  scoreBreakdown: {
    problemsClaimed: number;
    skillsCompleted: number;
    progressUploads: number;
    patentsSubmitted: number;
    patentsApproved: number;
    mvpsVerified: number;
    marketReadyVerified: number;
    startupsLaunched: number;
    awardsApproved: number;
  };
  activeSince: string;
  stage?: string;
  activeProject?: StudentActiveProject;
}

export interface LeaderboardPage {
  items: StudentLeaderboardItem[];
  nextCursor: string | null;
}

export interface DashboardEvent {
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

export interface SchoolDashboardData {
  institutionProfile?: InstitutionProfile;
  stats: SchoolDashboardStats;
  recentActivityCounts: {
    scoreEventsLast30Days: number;
    patentsLast30Days: number;
    startupsLast30Days: number;
  };
  upcomingEvents: DashboardEvent[];
  topStudents: StudentLeaderboardItem[];
}

export interface StudentJourney {
  student: {
    _id: string;
    displayName: string;
    avatar?: string;
    innovationScore: number;
    scoreBreakdown: StudentLeaderboardItem['scoreBreakdown'];
  };
  scoreEvents: Array<{
    _id: string;
    trigger: string;
    delta: number;
    scoreAfter: number;
    createdAt: string;
  }>;
  workspaces: Array<{
    _id: string;
    title: string;
    category: string;
    stage: string;
    progressPercent: number;
    updatedAt: string;
  }>;
  patents: Array<{
    _id: string;
    projectTitle: string;
    status: string;
    submittedAt: string;
  }>;
  startups: Array<{
    _id: string;
    name: string;
    category: string;
    stage: string;
    launchedAt?: string;
  }>;
}

export interface DirectoryInvestor {
  _id: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  domain?: string;
  contactPreference: string;
}

export interface StudentAccessToken {
  _id: string;
  token: string;
  label?: string;
  isActive: boolean;
  usageCount: number;
  expiresAt?: string;
  createdAt: string;
}

export interface PendingStudentVerification {
  _id: string;
  displayName: string;
  email: string;
  domain?: string;
  bio?: string;
  verificationRequestedAt?: string;
  createdAt: string;
}

export interface StudentVerificationReviewResponse {
  _id: string;
  status: 'verified' | 'rejected';
  reviewedBy: string;
  reviewedAt?: string;
  reason?: string;
}

export interface ComplianceReportRecord {
  _id: string;
  institutionId: string;
  institutionType: 'school' | 'college';
  generatedAt: string;
  pdfUrl: string;
  academicYear: string;
  kpis: Record<string, number>;
}
