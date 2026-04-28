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
  description?: string;
  priority: 'High' | 'Medium' | 'Low';
  assignedTo?: string;
  dueDate?: string;
  done: boolean;
  createdAt: string;
}

export type WorkspaceUploadCategory = 'bug_report' | 'error_log' | 'screenshot' | 'test_result' | 'design_mockup' | 'other';

export type WorkspaceUploadFileType = 'pdf' | 'image' | 'doc' | 'ppt' | 'xls' | 'video' | 'audio' | 'other';

export interface WorkspaceUpload {
  _id: string;
  fileUrl: string;
  fileType: WorkspaceUploadFileType;
  fileName: string;
  fileSizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
  note?: string;
  category?: WorkspaceUploadCategory;
  mimeType?: string;
  storageProvider?: 'cloudinary' | 's3';
  storageKey?: string;
}

export interface WorkspaceRepoSubmission {
  _id: string;
  provider: 'github';
  repoUrl: string;
  displayName: string;
  branch?: string;
  commitHash?: string;
  note?: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface WorkspaceCodeSubmission {
  _id: string;
  title: string;
  language: string;
  summary?: string;
  codeSnippet: string;
  lineCount: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface WorkspaceProgressUpdate {
  _id: string;
  submittedBy: string;
  note: string;
  milestoneRef?: string;
  submittedAt: string;
}

export interface WorkspaceChatParticipant {
  _id: string;
  userId: string;
  role: 'mentor' | 'investor';
  addedBy: string;
  addedAt: string;
  displayName: string | null;
  avatar: string | null;
  profileSlug?: string | null;
}

export interface ChatMessageAttachment {
  fileUrl: string;
  fileType: WorkspaceUploadFileType;
  fileName: string;
  fileSizeBytes: number;
  mimeType?: string;
}

export interface ChatMessageCodeSnippet {
  title: string;
  language: string;
  code: string;
  lineCount: number;
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
  repoSubmissions: WorkspaceRepoSubmission[];
  codeSubmissions: WorkspaceCodeSubmission[];
  progressUpdates: WorkspaceProgressUpdate[];
  teamMembers?: Array<{
    _id: string;
    displayName: string;
    role: string;
    avatar?: string;
    profileSlug?: string;
  }>;
  pendingInvites?: Array<{
    _id: string;
    toUserId: string;
    displayName: string;
    email: string | null;
    proposedRole: string;
    type?: 'workspace_member' | 'workspace_chat_access';
    message?: string;
    status: 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'expired';
    expiresAt: string;
    createdAt: string;
  }>;
  chatParticipants?: WorkspaceChatParticipant[];
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
  attachmentType?: WorkspaceUploadFileType;
  attachmentName?: string;
  attachmentSizeBytes?: number;
  attachmentMimeType?: string;
  attachmentUploadId?: string;
  attachment?: ChatMessageAttachment;
  codeSnippet?: ChatMessageCodeSnippet;
  sentAt: string;
  deliveredAt?: string;
  seenAt?: string;
  seenBy?: string[];
}
