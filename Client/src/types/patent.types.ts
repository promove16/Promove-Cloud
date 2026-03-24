export interface PatentQuestionnaire {
  whatIsYourInnovation: string;
  noveltyExplanation: string;
  technicalDetails: string;
  marketUseCase: string;
  priorArtAwareness: string;
}

export interface PatentSubmission {
  _id: string;
  studentId: string;
  workspaceId?: string;
  projectTitle: string;
  questionnaire: PatentQuestionnaire;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
  submittedAt: string;
  adminReviewedAt?: string;
  adminReviewedBy?: string;
  adminNotes?: string;
  scoreAwarded: boolean;
  createdAt: string;
  updatedAt: string;
}
