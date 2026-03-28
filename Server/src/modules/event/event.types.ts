import { Types } from 'mongoose';

export type EventType =
  | 'Industry Connect Session'
  | 'Placement Hackathon'
  | 'Innovation Drive'
  | 'Other';

export interface IEventParticipant {
  studentId: Types.ObjectId;
  submissionScore?: number;
  joinedAt: Date;
}

export interface IEventRanking {
  rank: number;
  studentId: Types.ObjectId;
  compositeScore: number;
  innovationScore: number;
  submissionScore: number;
}

export interface IEvent {
  _id: Types.ObjectId;
  institutionId: Types.ObjectId;
  createdBy: Types.ObjectId;
  title: string;
  type: EventType;
  description: string;
  scheduledAt: Date;
  isActive: boolean;
  participants: IEventParticipant[];
  rankings: IEventRanking[];
  rankingsComputedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventRankingView {
  rank: number;
  studentId: string;
  studentName: string;
  avatar?: string;
  compositeScore: number;
  innovationScore: number;
  submissionScore: number;
}

export interface EventParticipantView {
  studentId: string;
  studentName: string;
  avatar?: string;
  innovationScore: number;
  registeredAt: string;
  submissionScore?: number;
}
