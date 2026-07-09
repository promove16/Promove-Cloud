import { Types } from 'mongoose';

// ─── Trigger Enum ────────────────────────────────────────────────────────────

export const MentorScoreTrigger = {
  // Phase 1 – Empowerment
  TRAINING_MODULE_COMPLETED:    'TRAINING_MODULE_COMPLETED',
  QUIZ_PASSED:                  'QUIZ_PASSED',
  LAB_HARDWARE_VERIFIED:        'LAB_HARDWARE_VERIFIED',
  CURRICULUM_APPROVED:          'CURRICULUM_APPROVED',
  CLASS_PHOTO_VERIFIED:         'CLASS_PHOTO_VERIFIED',

  // Phase 2 – Institutional Incubation
  INDUSTRY_SESSION_VERIFIED:    'INDUSTRY_SESSION_VERIFIED',
  STUDENT_PROTOTYPE_TRANSITION: 'STUDENT_PROTOTYPE_TRANSITION',
  DEMO_DAY_VERIFIED:            'DEMO_DAY_VERIFIED',

  // Phase 3 – Global Mentorship & Knowledge
  RESOURCE_MILESTONE_REACHED:   'RESOURCE_MILESTONE_REACHED',
  FORUM_ANSWER_HELPFUL:         'FORUM_ANSWER_HELPFUL',
  FORUM_VERIFIED_SOLUTION:      'FORUM_VERIFIED_SOLUTION',
  SESSION_TOKEN_RELEASED:       'SESSION_TOKEN_RELEASED',
  EQUITY_LOI_SIGNED:            'EQUITY_LOI_SIGNED',
  MENTEE_OUTCOME_BONUS:         'MENTEE_OUTCOME_BONUS',

  // System
  SCORE_DECAY:                  'SCORE_DECAY',
  ADMIN_ADJUSTMENT:             'ADMIN_ADJUSTMENT',
} as const;

export type MentorScoreTriggerType = (typeof MentorScoreTrigger)[keyof typeof MentorScoreTrigger];

// ─── Phase Caps ──────────────────────────────────────────────────────────────

export const MENTOR_PHASE_CAPS = {
  phase1: 140,
  phase2: 245,
  phase3: 315,
} as const;

export const MENTOR_PHASE1_CAPS = {
  training:          60,
  labSync:           40,
  curriculumMapping: 40,
} as const;

export const MENTOR_PHASE2_CAPS = {
  industryConnects:  95,
  prototypeVelocity: 100,
  demoDay:           50,
} as const;

// ─── ScoreEvent ───────────────────────────────────────────────────────────────

export interface IMentorScoreEvent {
  _id:             Types.ObjectId;
  mentorId:        Types.ObjectId;
  trigger:         MentorScoreTriggerType;
  delta:           number;
  scoreAfter:      number;
  phase:           1 | 2 | 3;
  idempotencyKey?: string;
  metadata?:       Record<string, unknown>;
  createdAt:       Date;
}

// ─── Cached Score ─────────────────────────────────────────────────────────────

export interface IMentorPhase1Breakdown {
  training:          number;
  labSync:           number;
  curriculumMapping: number;
}

export interface IMentorPhase2Breakdown {
  industryConnects:  number;
  prototypeVelocity: number;
  demoDay:           number;
}

export interface IMentorPhase3Breakdown {
  resourceLibrary: number;
  forum:           number;
  sessions:        number;
  equityLOIs:      number;
  outcomeBonuses:  number;
}

export interface IMentorScore {
  _id:              Types.ObjectId;
  mentorId:         Types.ObjectId;
  totalScore:       number;
  phase1Score:      number;
  phase2Score:      number;
  phase3Score:      number;
  phase1Breakdown:  IMentorPhase1Breakdown;
  phase2Breakdown:  IMentorPhase2Breakdown;
  phase3Breakdown:  IMentorPhase3Breakdown;
  lastActivityAt:   Date;
  mentorshipRating: number;
  incubationRate:   number;
  rank:             number;
  updatedAt:        Date;
}

// ─── Verification Task ────────────────────────────────────────────────────────

export type VerificationTaskType =
  | 'lab_sync'
  | 'curriculum_pdf'
  | 'class_photo'
  | 'industry_session'
  | 'demo_day'
  | 'outcome_bonus';

export type VerificationTaskStatus = 'pending' | 'approved' | 'rejected';

export interface IMentorVerificationTask {
  _id:            Types.ObjectId;
  type:           VerificationTaskType;
  mentorId:       Types.ObjectId;
  submissionUrls: string[];
  submissionData: Record<string, unknown>;
  status:         VerificationTaskStatus;
  pointsToAward:  number;
  reviewedBy?:    Types.ObjectId;
  reviewedAt?:    Date;
  rejectionNote?: string;
  createdAt:      Date;
  updatedAt:      Date;
}

// ─── Service Params ───────────────────────────────────────────────────────────

export interface AwardPointsParams {
  mentorId:        string | Types.ObjectId;
  trigger:         MentorScoreTriggerType;
  delta:           number;
  phase:           1 | 2 | 3;
  idempotencyKey:  string;
  metadata?:       Record<string, unknown>;
}
