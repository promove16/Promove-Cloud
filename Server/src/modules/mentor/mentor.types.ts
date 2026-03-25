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
  recentActivities: MentorDashboardActivity[];
}

export interface MentorFeedStudent {
  _id: string;
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
