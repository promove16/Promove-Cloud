import {
  ComplianceActionRecord,
  ComplianceAlertRecord,
  ComplianceIncidentRecord,
  InstitutionPolicySubmissionListResponse,
  InstitutionPolicySubmissionRecord,
  ComplianceOverviewData,
  ComplianceReportRecord,
  DashboardEvent,
  InnovationScoreDistributionBucket,
  InstitutionPatent,
  InstitutionProfile,
  InstitutionStartup,
  InstitutionTrendGraph,
  PendingStudentVerification,
  RecentProject,
  TemporaryStudentCredentials,
  StudentRosterEntry,
  StudentRosterImportResult,
  StudentAccessToken,
  StudentLeaderboardItem,
  StudentVerificationReviewResponse,
} from './school.types';
import { HiringPartner, PlacementTrackerData } from './placement.types';

export interface RecruiterDirectoryItem {
  _id: string;
  displayName: string;
  avatar?: string;
  company: string;
  activePositions: number;
  activeDrives: number;
  domains: string[];
}

export interface CollegeDashboardStats {
  totalStudents: number;
  activeProjects: number;
  totalInnovationActivities: number;
  patentsFiled: number;
  totalMentoringHours: number;
  startupsLaunched: number;
  industryCollaborations: number;
  studentsPlaced: number;
  activeHRPartners: number;
  placementVelocity: number;
}

export interface CollegeDashboardData {
  institutionProfile?: InstitutionProfile;
  stats: CollegeDashboardStats;
  recentActivityCounts: {
    scoreEventsLast30Days: number;
    patentsLast30Days: number;
    startupsLast30Days: number;
  };
  trendGraph: InstitutionTrendGraph;
  innovationScoreDistribution: InnovationScoreDistributionBucket[];
  upcomingEvents: DashboardEvent[];
  topStudents: StudentLeaderboardItem[];
  recentProjects: RecentProject[];
}

export interface EventRanking {
  rank: number;
  studentId: string;
  studentName: string;
  avatar?: string;
  compositeScore: number;
  innovationScore: number;
  submissionScore: number;
}

export interface CollegeEventParticipant {
  studentId: string;
  studentName: string;
  avatar?: string;
  innovationScore: number;
  registeredAt: string;
  submissionScore?: number;
}

export interface CollegeEvent {
  _id: string;
  title: string;
  type: string;
  category?: 'internal' | 'hiring';
  description: string;
  scheduledAt: string;
  participantsCount: number;
  participants: CollegeEventParticipant[];
  rankingsComputedAt?: string;
  rankings: EventRanking[];
  recruiterId?: string;
  recruiterName?: string;
  recruiterCompany?: string;
  linkedJobId?: string;
  jobTitle?: string;
  companyName?: string;
  minimumInnovationScore?: number;
}

export interface CollegeEventRankingsResponse {
  formula: string;
  rankings: EventRanking[];
}

export interface PlacementStatusUpdateResponse {
  _id: string;
  status: 'Shortlisted' | 'Hired' | 'Rejected';
  companyName?: string;
  recruiterId?: string;
  updatedAt: string;
}

export type {
  ComplianceActionRecord,
  ComplianceAlertRecord,
  ComplianceIncidentRecord,
  InstitutionPolicySubmissionListResponse,
  InstitutionPolicySubmissionRecord,
  ComplianceOverviewData,
  ComplianceReportRecord,
  InstitutionPatent,
  InstitutionStartup,
  HiringPartner,
  PendingStudentVerification,
  PlacementTrackerData,
  RecentProject,
  TemporaryStudentCredentials,
  StudentRosterEntry,
  StudentRosterImportResult,
  StudentAccessToken,
  StudentLeaderboardItem,
  StudentVerificationReviewResponse,
};
