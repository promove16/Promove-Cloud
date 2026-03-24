import { Types } from 'mongoose';

export interface IPatent {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  workspaceId?: Types.ObjectId;
  projectTitle: string;
  questionnaire: {
    whatIsYourInnovation: string;
    noveltyExplanation: string;
    technicalDetails: string;
    marketUseCase: string;
    priorArtAwareness: string;
  };
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
  submittedAt: Date;
  adminReviewedAt?: Date;
  adminReviewedBy?: Types.ObjectId;
  adminNotes?: string;
  scoreAwarded: boolean;
  createdAt: Date;
  updatedAt: Date;
}
