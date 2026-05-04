import { Types } from 'mongoose';

export interface IScoreBreakdown {
  problemsClaimed: number;
  problemsCompleted: number;
  skillsCompleted: number;
  progressUploads: number;
  patentsSubmitted: number;
  patentsApproved: number;
  mvpsVerified: number;
  marketReadyVerified: number;
  startupsLaunched: number;
}

export interface IScoreEvent {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  trigger: string;
  delta: number;
  scoreAfter: number;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
