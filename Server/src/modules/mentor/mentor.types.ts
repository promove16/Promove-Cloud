import { Types } from 'mongoose';
import { ScoreBreakdown } from '../user/user.types';

export interface MentorDashboardActivity {
  studentId: string;
  studentName: string;
  avatar?: string;
  trigger: string;
  newScore: number;
  delta: number;
  timestamp: string;
}

export interface MentorDashboardData {
  sessionsToday: number;
  pendingReviews: number;
  activeStudentCount: number;
  assignedProjectsCount: number;
  assignedProgramsCount: number;
  recentActivities: MentorDashboardActivity[];
  projectAssignments: MentorAssignedProject[];
  institutionPrograms: MentorAssignedInstitutionProgram[];
}

export interface MentorFeedStudent {
  _id: string;
  workspaceId: string;
  studentId: string;
  displayName: string;
  avatar?: string;
  startupName: string;
  category: string;
  innovationScore: number;
  recentActivitySummary: string;
  isWatched: boolean;
  activeSince: string;
}

export interface MentorStudentProfile {
  student: {
    _id: string;
    displayName: string;
    avatar?: string;
    bio?: string;
    domain?: string;
    innovationScore: number;
    scoreBreakdown: ScoreBreakdown;
    institutionName?: string;
  };
  workspaces: Array<{
    _id: string;
    title: string;
    category: string;
    stage: string;
    progressPercent: number;
    updatedAt: string;
  }>;
  scoreEvents: Array<{
    _id: string;
    trigger: string;
    delta: number;
    scoreAfter: number;
    createdAt: string;
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
    innovationScore: number;
    innovationScoreAtLaunch: number;
  }>;
}

export interface MentorSessionParticipant {
  _id: string;
  displayName: string;
  avatar?: string;
}

export interface MentorSessionItem {
  _id: string;
  mentor: MentorSessionParticipant;
  student: MentorSessionParticipant;
  workspaceId?: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  meetLink?: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  mentorNotes?: string;
  studentFeedback?: string;
  createdAt: string;
}

export interface MentorSessionsResponse {
  upcoming: MentorSessionItem[];
  completed: MentorSessionItem[];
  cancelled: MentorSessionItem[];
}

export interface CreateMentorSessionInput {
  studentId: string;
  workspaceId?: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  meetLink?: string;
}

export interface UpdateMentorSessionInput {
  status?: 'Scheduled' | 'Completed' | 'Cancelled';
  mentorNotes?: string;
  meetLink?: string;
}

export interface CreateMentorFeedbackInput {
  studentId: string;
  workspaceId?: string;
  feedbackText: string;
  rating: 1 | 2 | 3 | 4 | 5;
}

export interface MentorFeedbackItem {
  _id: string;
  mentorId: string;
  studentId: string;
  workspaceId?: string;
  feedbackText: string;
  rating: 1 | 2 | 3 | 4 | 5;
  createdAt: string;
}

export interface MentorWorkspaceDetail {
  _id: string;
  title: string;
  category: string;
  stage: string;
  progressPercent: number;
  milestones: Array<{
    _id: Types.ObjectId | string;
    name: string;
    isCompleted: boolean;
    completionPercent: number;
    completedAt?: Date;
    completedBy?: Types.ObjectId | string;
  }>;
  tasks: Array<{
    _id: Types.ObjectId | string;
    title: string;
    priority: 'High' | 'Medium' | 'Low';
    done: boolean;
    dueDate?: Date;
  }>;
  uploads: Array<{
    _id: Types.ObjectId | string;
    fileUrl: string;
    fileType: 'pdf' | 'image';
    fileName: string;
    uploadedAt: Date;
  }>;
  progressUpdates: Array<{
    _id: Types.ObjectId | string;
    note: string;
    submittedAt: Date;
  }>;
}

export interface MentorAssignmentStudent {
  _id: string;
  displayName: string;
  avatar?: string;
  institutionName?: string;
}

export interface MentorAssignedProject {
  workspaceId: string;
  title: string;
  category: string;
  stage: string;
  progressPercent: number;
  updatedAt: string;
  startupName?: string;
  students: MentorAssignmentStudent[];
}

export interface MentorAssignedInstitutionProgram {
  _id: string;
  institution: InstitutionMentorshipProgramInstitution;
  title: string;
  objective: string;
  preferredDate: string;
  scheduledAt?: string;
  durationMinutes: number;
  expectedParticipants: number;
  deliveryMode: 'Online' | 'Offline';
  platform: 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Offline';
  meetingLink?: string;
  venue?: string;
  adminNotes?: string;
  preferredExpertise?: string;
  status: 'Assigned';
}

export interface InstitutionMentorshipProgramInstitution {
  _id: string;
  displayName: string;
  type: 'school' | 'college';
}

export interface InstitutionMentorshipProgramRequester {
  _id: string;
  displayName: string;
  email: string;
}

export interface InstitutionMentorshipProgramMentor {
  _id: string;
  displayName: string;
  email: string;
  avatar?: string;
  domain?: string;
  bio?: string;
}

export interface InstitutionMentorshipProgramItem {
  _id: string;
  institution: InstitutionMentorshipProgramInstitution;
  requestedBy: InstitutionMentorshipProgramRequester;
  mentor?: InstitutionMentorshipProgramMentor;
  title: string;
  objective: string;
  preferredDate: string;
  scheduledAt?: string;
  durationMinutes: number;
  expectedParticipants: number;
  deliveryMode: 'Online' | 'Offline';
  platform: 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Offline';
  meetingLink?: string;
  venue?: string;
  preferredExpertise?: string;
  adminNotes?: string;
  rejectionReason?: string;
  status: 'Pending' | 'Assigned' | 'Rejected';
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionMentorshipProgramStats {
  total: number;
  pending: number;
  assigned: number;
  rejected: number;
}

export interface InstitutionMentorshipProgramView {
  items: InstitutionMentorshipProgramItem[];
  stats: InstitutionMentorshipProgramStats;
}

export type InstitutionMentorshipProgramListResponse = InstitutionMentorshipProgramView;

export interface CreateInstitutionMentorshipProgramInput {
  title: string;
  objective: string;
  preferredDate: string;
  durationMinutes: number;
  expectedParticipants: number;
  deliveryMode: 'Online' | 'Offline';
  platform: 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Offline';
  meetingLink?: string;
  venue?: string;
  preferredExpertise?: string;
}

export interface AdminCreateInstitutionMentorshipProgramInput extends CreateInstitutionMentorshipProgramInput {
  institutionId: string;
  mentorId: string;
  scheduledAt: string;
  adminNotes?: string;
}

export type InstitutionMentorshipProgramReviewInput =
  | {
      decision: 'assigned';
      mentorId: string;
      scheduledAt: string;
      deliveryMode: 'Online' | 'Offline';
      platform: 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Offline';
      meetingLink?: string;
      venue?: string;
      adminNotes?: string;
    }
  | {
      decision: 'rejected';
      rejectionReason: string;
      adminNotes?: string;
    };

export interface MentorshipAdminMentorItem {
  _id: string;
  displayName: string;
  email: string;
  avatar?: string;
  domain?: string;
  bio?: string;
  headline?: string;
  assignedProjects: number;
  assignedPrograms: number;
  createdAt: string;
}

export interface CreateMentorProfileInput {
  displayName: string;
  email: string;
  domain?: string;
  bio?: string;
  headline?: string;
}

export interface CreatedMentorProfileResult {
  mentor: MentorshipAdminMentorItem;
  temporaryPassword: string;
}

export interface AdminProjectMentorshipItem {
  workspaceId: string;
  title: string;
  category: string;
  stage: string;
  progressPercent: number;
  updatedAt: string;
  startupName?: string;
  preferredExpertise?: string;
  students: MentorAssignmentStudent[];
  mentor?: InstitutionMentorshipProgramMentor;
}

export interface AdminProjectMentorshipStats {
  total: number;
  assigned: number;
  unassigned: number;
}

export interface AdminProjectMentorshipView {
  items: AdminProjectMentorshipItem[];
  stats: AdminProjectMentorshipStats;
}

export type ProjectMentorAssignmentInput =
  | {
      decision: 'assigned';
      mentorId: string;
    }
  | {
      decision: 'unassigned';
    };
