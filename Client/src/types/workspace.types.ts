export type WorkspaceStage = 'Ideation' | 'Problem' | 'Build' | 'Patent' | 'Launch';

export interface WorkspaceMilestone {
  _id: string;
  name:
    | 'Research & Planning'
    | 'Design & Prototyping'
    | 'Development'
    | 'Testing & Validation'
    | 'Final Delivery';
  isCompleted: boolean;
  completedAt?: string;
  completedBy?: string;
  completionPercent: number;
}

export interface WorkspaceTask {
  _id: string;
  title: string;
  priority: 'High' | 'Medium' | 'Low';
  assignedTo?: string;
  dueDate?: string;
  done: boolean;
  createdAt: string;
}

export interface WorkspaceUpload {
  _id: string;
  fileUrl: string;
  fileType: 'pdf' | 'image';
  fileName: string;
  fileSizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
  note?: string;
}

export interface WorkspaceProgressUpdate {
  _id: string;
  submittedBy: string;
  note: string;
  milestoneRef?: string;
  submittedAt: string;
}

export interface Workspace {
  _id: string;
  ownerId: string;
  teamMemberIds: string[];
  claimedProblemId?: string;
  title: string;
  category: string;
  stage: WorkspaceStage;
  progressPercent: number;
  milestones: WorkspaceMilestone[];
  tasks: WorkspaceTask[];
  uploads: WorkspaceUpload[];
  progressUpdates: WorkspaceProgressUpdate[];
  teamMembers?: Array<{
    _id: string;
    displayName: string;
    role: string;
    avatar?: string;
  }>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  _id: string;
  workspaceId: string;
  senderId: string;
  message: string;
  attachmentUrl?: string;
  attachmentType?: 'pdf' | 'image';
  sentAt: string;
}
