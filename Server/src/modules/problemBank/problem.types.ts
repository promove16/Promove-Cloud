import { Types } from 'mongoose';

export type ProblemCategory =
  | 'Agriculture'
  | 'Technology'
  | 'Healthcare'
  | 'Education'
  | 'Environment'
  | 'Rural Development'
  | 'Other';

export type ProblemDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface IProblem {
  _id: Types.ObjectId;
  title: string;
  description: string;
  category: ProblemCategory;
  difficulty: ProblemDifficulty;
  domain: string;
  tags: string[];
  isVerified: boolean;
  postedBy: string;
  claimedBy?: Types.ObjectId;
  claimedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
