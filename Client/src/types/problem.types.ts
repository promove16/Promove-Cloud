export interface Problem {
  _id: string;
  title: string;
  description: string;
  category:
    | 'Agriculture'
    | 'Technology'
    | 'Healthcare'
    | 'Education'
    | 'Environment'
    | 'Rural Development'
    | 'Other';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  domain: string;
  tags: string[];
  isVerified: boolean;
  postedBy: string;
  claimedBy?: string;
  claimedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProblemListMeta {
  page: number;
  limit: number;
  total: number;
}
