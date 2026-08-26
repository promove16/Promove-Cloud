import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';

export interface MentorScoreBreakdown {
  totalScore: number;
  phase1Score: number;
  phase2Score: number;
  phase3Score: number;
  phase1Breakdown: {
    training: number;
    labSync: number;
    curriculumMapping: number;
  };
  phase2Breakdown: {
    industryConnects: number;
    prototypeVelocity: number;
    demoDay: number;
  };
  phase3Breakdown: {
    resourceLibrary: number;
    forum: number;
    sessions: number;
    equityLOIs: number;
    outcomeBonuses: number;
    contentCreatorBonus: number;
  };
  mentorshipRating: number;
  incubationRate?: number;
  rank: number;
  lastActivityAt?: string;
}

export interface MentorScoreEvent {
  _id: string;
  trigger: string;
  delta: number;
  scoreAfter: number;
  phase: 1 | 2 | 3;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface MentorVerificationTask {
  _id: string;
  type: 'lab_sync' | 'curriculum_pdf' | 'class_photo' | 'industry_session' | 'prototype_velocity' | 'demo_day' | 'outcome_bonus';
  status: 'pending' | 'approved' | 'rejected';
  pointsToAward: number;
  submissionUrls: string[];
  submissionData: Record<string, unknown>;
  rejectionNote?: string;
  reviewedAt?: string;
  createdAt: string;
  mentorId?: {
    _id: string;
    displayName: string;
    avatar?: string;
    email?: string;
  };
}

export interface LeaderboardEntry {
  _id: string;
  mentorId: {
    _id: string;
    displayName: string;
    avatar?: string;
    headline?: string;
  };
  totalScore: number;
  phase1Score: number;
  phase2Score: number;
  phase3Score: number;
  mentorshipRating: number;
  incubationRate: number;
  rank: number;
  lastActivityAt: string;
}

export const mentorScoreApi = {
  // ─── Read ────────────────────────────────────────────────────────────────────

  async getMyScore() {
    const res = await api.get<ApiSuccessResponse<MentorScoreBreakdown>>('/api/mentor-score/me');
    return res.data.data;
  },

  async getMyHistory() {
    const res = await api.get<ApiSuccessResponse<MentorScoreEvent[]>>('/api/mentor-score/me/history');
    return res.data.data;
  },

  async getMySubmissions(params?: { type?: string; status?: string }) {
    const res = await api.get<ApiSuccessResponse<MentorVerificationTask[]>>('/api/mentor-score/submissions', {
      params,
    });
    return res.data.data;
  },

  // ─── Phase 1 Training & Quizzes ──────────────────────────────────────────────

  async completeQuiz(body: { quizId: string; quizPoints: number }) {
    const res = await api.post<ApiSuccessResponse<{ recorded: boolean }>>('/api/mentor-score/training/quiz', body);
    return res.data.data;
  },

  async completeTrainingModule(body: { moduleId: string; modulePoints: number }) {
    const res = await api.post<ApiSuccessResponse<{ recorded: boolean }>>('/api/mentor-score/training/complete', body);
    return res.data.data;
  },

  // ─── Phase 1 Submissions ──────────────────────────────────────────────────────

  async submitLabSync(body: { photoUrls: string[]; kitDescription: string; labDate: string }) {
    const res = await api.post<ApiSuccessResponse<MentorVerificationTask>>('/api/mentor-score/submit/lab-sync', body);
    return res.data.data;
  },

  async submitCurriculumPdf(body: { pdfUrl: string; plannedClassesCount: number; academicYear: string }) {
    const res = await api.post<ApiSuccessResponse<MentorVerificationTask>>('/api/mentor-score/submit/curriculum', body);
    return res.data.data;
  },

  async submitClassPhoto(body: {
    photoUrls: string[];
    curriculumTaskId: string;
    classIndex: number;
    classDate: string;
    topic: string;
  }) {
    const res = await api.post<ApiSuccessResponse<MentorVerificationTask>>('/api/mentor-score/submit/class-photo', body);
    return res.data.data;
  },

  // ─── Phase 2 Submissions ──────────────────────────────────────────────────────

  async submitIndustrySession(body: {
    founderName: string;
    companyName: string;
    sessionDate: string;
    topic: string;
    attendeeCount: number;
    evidenceUrl?: string;
  }) {
    const res = await api.post<ApiSuccessResponse<MentorVerificationTask>>('/api/mentor-score/submit/industry-session', body);
    return res.data.data;
  },

  async submitPrototypeVelocity(body: {
    studentId: string;
    projectTitle: string;
    stage: string;
    photoUrls: string[];
  }) {
    const res = await api.post<ApiSuccessResponse<MentorVerificationTask>>('/api/mentor-score/submit/prototype-velocity', body);
    return res.data.data;
  },

  async submitDemoDay(body: {
    videoUrl: string;
    winners: { studentName: string; projectTitle: string }[];
    academicYear: string;
  }) {
    const res = await api.post<ApiSuccessResponse<MentorVerificationTask>>('/api/mentor-score/submit/demo-day', body);
    return res.data.data;
  },

  // ─── Phase 3 – Session Token ──────────────────────────────────────────────────

  async endSession(sessionId: string) {
    const res = await api.post<ApiSuccessResponse<{ released: boolean; pointsAwarded: number }>>(
      `/api/mentor-score/sessions/${sessionId}/end`,
    );
    return res.data.data;
  },

  async rateSession(sessionId: string, rating: number) {
    const res = await api.post<ApiSuccessResponse<{ rated: boolean; newRating: number }>>(
      `/api/mentor-score/sessions/${sessionId}/rate`,
      { rating },
    );
    return res.data.data;
  },

  // ─── Admin: Leaderboard ───────────────────────────────────────────────────────

  async getLeaderboard(page = 1, phase?: '1' | '2' | '3') {
    const res = await api.get<ApiSuccessResponse<{ docs: LeaderboardEntry[]; total: number; page: number; limit: number }>>(
      '/api/admin/mentor-score/leaderboard',
      { params: { page, ...(phase ? { phase } : {}) } },
    );
    return res.data.data;
  },

  // ─── Admin: Verification Queue ────────────────────────────────────────────────

  async listVerificationTasks(params?: { status?: string; type?: string; page?: number }) {
    const res = await api.get<ApiSuccessResponse<{ tasks: MentorVerificationTask[]; total: number; page: number }>>(
      '/api/admin/mentor-score/verifications',
      { params },
    );
    return res.data.data;
  },

  async approveTask(id: string, pointsOverride?: number) {
    const res = await api.post<ApiSuccessResponse<{ task: MentorVerificationTask; newTotal: number; pointsAwarded: number }>>(
      `/api/admin/mentor-score/verifications/${id}/approve`,
      pointsOverride !== undefined ? { pointsOverride } : {},
    );
    return res.data.data;
  },

  async rejectTask(id: string, note?: string) {
    const res = await api.post<ApiSuccessResponse<{ task: MentorVerificationTask }>>(
      `/api/admin/mentor-score/verifications/${id}/reject`,
      { note },
    );
    return res.data.data;
  },

  // ─── Admin: Score History ─────────────────────────────────────────────────────

  async getMentorScoreHistory(mentorId: string) {
    const res = await api.get<ApiSuccessResponse<{ scoreDoc: MentorScoreBreakdown; events: MentorScoreEvent[]; total: number }>>(
      `/api/admin/mentor-score/score-history/${mentorId}`,
    );
    return res.data.data;
  },

  // ─── Admin: Manual Adjustment ─────────────────────────────────────────────────

  async adminAdjustScore(body: { mentorId: string; delta: number; reason: string; phase: 1 | 2 | 3 }) {
    const res = await api.post<ApiSuccessResponse<{ mentorId: string; delta: number; newTotal: number }>>(
      '/api/admin/mentor-score/score/adjust',
      body,
    );
    return res.data.data;
  },
};
