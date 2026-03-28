import { InstitutionProfile } from '../user/user.types';
import {
  DashboardEventView,
  PendingStudentVerificationView,
  SchoolDashboardPayload,
  StudentAccessTokenView,
  StudentVerificationReviewResult,
} from '../school/school.types';
import { EventParticipantView, EventRankingView } from '../event/event.types';
import { PlacementStatus } from './placementRecord.model';

export interface RecruiterDirectoryItem {
  _id: string;
  displayName: string;
  avatar?: string;
  company: string;
  activePositions: number;
  activeDrives: number;
  domains: string[];
}

export interface PlacementRecordView {
  _id: string;
  studentId: string;
  studentName: string;
  studentAvatar?: string;
  recruiterId?: string;
  recruiterName?: string;
  companyName?: string;
  innovationScore: number;
  status: PlacementStatus;
  updatedAt: string;
}

export interface HiringPartner {
  _id: string;
  displayName: string;
  avatar?: string;
  company: string;
  openPositions: number;
  activeDrives: number;
  domains: string[];
}

export interface PlacementTrackerPayload {
  placementVelocity: number;
  totalInnovators: number;
  studentsPlaced: number;
  hiringPartners: HiringPartner[];
  placementTable: PlacementRecordView[];
}

export interface CollegeDashboardStats {
  totalStudents: number;
  totalInnovationActivities: number;
  patentsFiled: number;
  totalMentoringHours: number;
  startupsLaunched: number;
  industryCollaborations: number;
  studentsPlaced: number;
  activeHRPartners: number;
  placementVelocity: number;
}

export interface CollegeDashboardPayload
  extends Omit<SchoolDashboardPayload, 'stats' | 'institutionProfile' | 'upcomingEvents'> {
  institutionProfile?: InstitutionProfile;
  stats: CollegeDashboardStats;
  upcomingEvents: DashboardEventView[];
}

export interface EventListItem extends DashboardEventView {
  rankingsComputedAt?: string;
  participants: EventParticipantView[];
  rankings: EventRankingView[];
}

export interface PlacementStatusUpdateResult {
  _id: string;
  status: PlacementStatus;
  companyName?: string;
  recruiterId?: string;
  updatedAt: string;
}

export type {
  PendingStudentVerificationView,
  StudentAccessTokenView,
  StudentVerificationReviewResult,
};
