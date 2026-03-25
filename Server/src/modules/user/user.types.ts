import { Types } from 'mongoose';
import { UserRole } from '../../types/roles.types';

export type AccessGrantedBy =
  | 'self_registered'
  | 'institution_token';

export type StudentVerificationStatus = 'not_required' | 'pending' | 'verified' | 'rejected';

export interface ScoreBreakdown {
  problemsClaimed: number;
  skillsCompleted: number;
  progressUploads: number;
  patentsSubmitted: number;
  patentsApproved: number;
  mvpsVerified: number;
  marketReadyVerified: number;
  startupsLaunched: number;
  awardsApproved: number;
}

export type InstitutionPolicyStatus = 'Active' | 'On Track' | 'Pending' | 'Inactive';

export interface InstitutionPolicy {
  name: string;
  status: InstitutionPolicyStatus;
  lastUpdated?: Date;
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
  iicLastUpdated?: Date;
  policies: InstitutionPolicy[];
  stats: InstitutionStats;
}

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  role: UserRole;
  displayName: string;
  avatar?: string;
  bio?: string;
  domain?: string;
  profileComplete: boolean;
  innovationScore: number;
  scoreBreakdown: ScoreBreakdown;
  accessGrantedBy: AccessGrantedBy;
  accessExpiresAt: Date;
  isActive: boolean;
  lastLogin?: Date;
  discoverableToRecruiters?: boolean;
  institutionId?: Types.ObjectId;
  institutionProfile?: InstitutionProfile;
  verificationStatus: StudentVerificationStatus;
  verificationRequestedAt?: Date;
  verifiedAt?: Date;
  verificationRejectedAt?: Date;
  verificationRejectedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SanitizedUser {
  _id: string;
  email: string;
  role: UserRole;
  displayName: string;
  avatar?: string;
  bio?: string;
  domain?: string;
  profileComplete: boolean;
  innovationScore: number;
  scoreBreakdown: ScoreBreakdown;
  accessGrantedBy: AccessGrantedBy;
  accessExpiresAt: Date;
  isActive: boolean;
  lastLogin?: Date;
  discoverableToRecruiters?: boolean;
  institutionId?: string;
  institutionProfile?: InstitutionProfile;
  verificationStatus: StudentVerificationStatus;
  verificationRequestedAt?: Date;
  verifiedAt?: Date;
  verificationRejectedAt?: Date;
  verificationRejectedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MentorSessionMentor {
  _id: string;
  displayName: string;
  avatar?: string;
}

export interface StudentMentorSessionView {
  _id: string;
  mentor: MentorSessionMentor;
  workspaceId?: string;
  title: string;
  scheduledAt: Date;
  durationMinutes: number;
  meetLink?: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  mentorNotes?: string;
  studentFeedback?: string;
  createdAt: Date;
}

export interface LaunchToRecruitersResult {
  bridgesCreated: number;
}
