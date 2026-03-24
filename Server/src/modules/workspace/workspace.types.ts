import { Types } from 'mongoose';

export type WorkspaceStage = 'Ideation' | 'Problem' | 'Build' | 'Patent' | 'Launch';

export interface IWorkspace {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  teamMemberIds: Types.ObjectId[];
  claimedProblemId?: Types.ObjectId;
  title: string;
  category: string;
  stage: WorkspaceStage;
  progressPercent: number;
  milestones: Array<{
    _id: Types.ObjectId;
    name: 'Research & Planning' | 'Design & Prototyping' | 'Development' | 'Testing & Validation' | 'Final Delivery';
    isCompleted: boolean;
    completedAt?: Date;
    completedBy?: Types.ObjectId;
    completionPercent: number;
  }>;
  tasks: Array<{
    _id: Types.ObjectId;
    title: string;
    priority: 'High' | 'Medium' | 'Low';
    assignedTo?: Types.ObjectId;
    dueDate?: Date;
    done: boolean;
    createdAt: Date;
  }>;
  uploads: Array<{
    _id: Types.ObjectId;
    fileUrl: string;
    fileType: 'pdf' | 'image';
    fileName: string;
    fileSizeBytes: number;
    uploadedBy: Types.ObjectId;
    uploadedAt: Date;
    note?: string;
    cloudinaryPublicId?: string;
  }>;
  progressUpdates: Array<{
    _id: Types.ObjectId;
    submittedBy: Types.ObjectId;
    note: string;
    milestoneRef?: string;
    submittedAt: Date;
  }>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
