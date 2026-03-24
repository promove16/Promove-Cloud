import { Types } from 'mongoose';

export interface IScoreBreakdown {
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

export interface IScoreEvent {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  trigger: string;
  delta: number;
  scoreAfter: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
